# 🧩 Sync Engine Deep Dive

TeamPulse uses a **revision-based synchronization engine** designed for **offline-first** operation and **eventual consistency**.

Every local change — tasks, projects, users, etc. — is written first to SQLite and logged into a `revisions` table.

A background job periodically syncs unsynced changes to Supabase, while listening for remote deltas in real time.

---

## 🔄 Data Lifecycle

```text
┌────────────────────────────┐
│      Angular Frontend      │
│────────────────────────────│
│  User creates/updates task │
└─────────────┬──────────────┘
              │ (IPC)
              ▼
┌────────────────────────────┐
│       Electron Main        │
│────────────────────────────│
│ + Validates input          │
│ + Writes to local SQLite   │
│ + Inserts into revisions   │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│         SQLite DB          │
│────────────────────────────│
│ Tables: tasks, projects,   │
│ teams, etc.                │
│ + revisions(object_id, …)  │
│ + synced=0 (pending)       │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│    SupabaseSyncService     │
│────────────────────────────│
│ 🕓 Runs periodically (or on │
│    network reconnect)      │
│ 🗂  Reads all synced=0 rows │
│ 🔐 Encrypts payload         │
│ ☁️ Uploads via Supabase RPC │
│ ✅ Marks as synced=1        │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│        Supabase Cloud      │
│────────────────────────────│
│ + Stores normalized data   │
│ + Emits realtime changes   │
│ + Maintains audit trail    │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│   Realtime Subscription     │
│────────────────────────────│
│ Electron listens to        │
│ remote changes → applies to│
│ local DB via upsert        │
│ and creates revision entry │
└────────────────────────────┘
```

---

## ⚙️ Revision Table Schema

| Field         | Type    | Description                                  |
|---------------|---------|----------------------------------------------|
| `id`          | TEXT    | Unique UUID for revision                     |
| `object_type` | TEXT    | e.g., `"task"`, `"project"`, `"team_member"` |
| `object_id`   | TEXT    | UUID of affected entity                      |
| `origin_id`   | TEXT    | Client machine / session ID                  |
| `seq`         | INTEGER | Local sequence number (for ordering)         |
| `payload`     | TEXT    | JSON-encoded change data                     |
| `created_at`  | INTEGER | Timestamp (ms since epoch)                   |
| `synced`      | INTEGER | `0` = pending, `1` = synced                  |

---

## 🧠 Conflict Handling

Conflicts are rare due to **object-level revision tracking**, but when they occur:

| Case                                      | Strategy                                                 |
|-------------------------------------------|----------------------------------------------------------|
| **Concurrent edits on same object**       | Compare `updated_at`; latest wins.                       |
| **Local offline edits + remote updates**  | Merge non-overlapping fields; otherwise prompt user.     |
| **Deleted remotely but modified locally** | Recreate remotely with “recovered” flag.                 |
| **Schema drift / migration changes**      | All revisions re-evaluated through versioned migrations. |

---

## 🔒 Security Model

- **🔐 Encryption:**
  - Each revision payload is AES-256-GCM encrypted before being written to disk or synced.
- **🔑 Identity binding:**
  - Every client is tagged with a unique origin_id, allowing per-device diff tracking.
- **🌐 Secure Supabase RPC:**
  - Sync calls are signed using JWT tokens from Supabase Auth, never directly from frontend.
- **📦 Atomic writes:**
  - SQLite operations are wrapped in transactions — ensuring consistency even after crash.

---

## ⚡ Performance Optimizations

| Optimization                                     | Purpose                                 |
|--------------------------------------------------|-----------------------------------------|
| **Partial sync (since last timestamp)**          | Only uploads new revisions.             |
| **Batch uploads (100 rows)**                     | Reduces network chatter.                |
| **Compression (Brotli)**                         | Shrinks JSON payloads by ~70%.          |
| **Indexing on `timestamp`, `synced`, `user_id`** | Speeds up query filtering.              |
| **In-memory aggregation cache**                  | For analytics, avoids full table scans. |

---

## 🧰 Example: Task Update Flow

```sql
User edits task → Angular IPC → Electron:
   INSERT INTO tasks (...)
   INSERT INTO revisions (..., synced=0)

Background Sync (every 2min or on reconnect):
   SELECT * FROM revisions WHERE synced=0
   → POST /rpc/apply_revision
   → UPDATE revisions SET synced=1

Supabase triggers notify clients via Realtime:
   → Electron receives event
   → Upsert into local DB
   → Notify Angular via preload event
```
