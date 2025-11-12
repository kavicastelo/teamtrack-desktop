# 🧭 Architecture Overview

Below is a high-level view of how **Team Tracker** works internally — fully local-first, backend-free, yet cloud-synced for collaboration.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                                TeamTracker                                   │
│         Offline-First, Local + Cloud Hybrid Work Management App            │
└────────────────────────────────────────────────────────────────────────────┘

                        ┌────────────────────────────┐
                        │        Angular UI           │
                        │ (Task Board, Dashboard, etc)│
                        │────────────────────────────│
                        │ - Uses Material + Chart.js  │
                        │ - Invokes IPC via preload.ts│
                        └──────────────┬──────────────┘
                                       │ Secure IPC Calls
                                       ▼
                        ┌────────────────────────────┐
                        │       Electron Main        │
                        │────────────────────────────│
                        │ - Handles all DB access     │
                        │ - AES encryption/decryption │
                        │ - Supabase sync + Auth      │
                        │ - Metrics & Analytics IPCs  │
                        └──────────────┬──────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────┐
                        │   SQLite (better-sqlite3)  │
                        │────────────────────────────│
                        │ - Local-first datastore     │
                        │ - Tables: users, tasks,     │
                        │   projects, teams, etc.     │
                        │ - Revisions + heartbeats    │
                        └──────────────┬──────────────┘
                                       │ Periodic Sync
                                       ▼
                        ┌────────────────────────────┐
                        │        Supabase Cloud      │
                        │────────────────────────────│
                        │ - Postgres (primary store)  │
                        │ - Realtime subscriptions     │
                        │ - Auth (JWT) & Storage       │
                        │ - SQL views for analytics    │
                        └──────────────┬──────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────┐
                        │       External Services    │
                        │────────────────────────────│
                        │ - Google Calendar (OAuth2)  │
                        │ - Optional Metabase charts  │
                        └────────────────────────────┘
```

## 🔁 Data Flow Summary

| Step | Flow                               | Description                                                                             |
|------|------------------------------------|-----------------------------------------------------------------------------------------|
| ①    | **Angular → Electron (IPC)**       | UI actions trigger IPC calls (`createTask`, `listTasks`, `analytics:getAppUsage`, etc.) |
| ②    | **Electron → SQLite**              | All data writes/reads happen locally via Drizzle ORM over `better-sqlite3`              |
| ③    | **SQLite → Supabase**              | Background sync job pushes unsynced revisions to Supabase                               |
| ④    | **Supabase → Electron (Realtime)** | Live updates received through Realtime subscriptions                                    |
| ⑤    | **Electron → Angular (Event)**     | Frontend updates via IPC events (e.g., `onRemoteUpdate`)                                |
| ⑥    | **Offline Mode**                   | App continues to function entirely off SQLite; sync resumes automatically when online   |

---

## 🔐 Security Boundaries

- 🔸 **Angular Renderer:**
  - No Supabase keys or secrets — only communicates via `window.electronAPI`.
- 🔸 **Electron Main:**
  - Holds Supabase credentials, encryption keys, and performs all sensitive work.
- 🔸 **Local Database:**
  - Fully encrypted on disk with AES-256-GCM (`local.db.enc`).
- 🔸 **Sync Layer:**
  - Uses signed JWT tokens from Supabase Auth; uploads only encrypted deltas.

---

## ⚙️ Sync & Revision Strategy

```text
 ┌────────────────────────┐
 │      User Action       │
 │ (creates/updates task) │
 └────────────┬───────────┘
              ▼
    ┌────────────────────────┐
    │ Insert into `tasks`     │
    │ + append `revisions`    │
    └────────────┬───────────┘
                 ▼
      ┌────────────────────────┐
      │ SupabaseSyncService    │
      │ - Reads unsynced rows  │
      │ - Pushes to Supabase   │
      │ - Marks synced=1       │
      └────────────┬───────────┘
                   ▼
        ┌────────────────────────┐
        │ Supabase Realtime       │
        │ - Broadcasts updates    │
        │ - Triggers other clients│
        └────────────────────────┘
```

This ensures **conflict-free, eventual consistency** across all clients — even if they’ve been offline for days.

---

## 🧮 Analytics Data Flow

| Source         | Description                                                      | Aggregation                              |
|----------------|------------------------------------------------------------------|------------------------------------------|
| `heartbeats`   | Per-user activity samples (collected by Electron heartbeat loop) | Summarized daily → `heartbeat_summary`   |
| `events`       | User actions (task updates, uploads, etc.)                       | Used for timelines                       |
| `time_entries` | Active work sessions                                             | Aggregated weekly for productivity stats |
| `attachments`  | Files uploaded to Supabase Storage                               | Linked by task/project                   |
| Supabase Views | Aggregated KPIs (open tasks, team progress, throughput)          | Visualized in Dashboard & Metabase       |

