# 🧮 Data Model & Relationships (ASCII ERD)

```mermaid
erDiagram

    users {
        int id PK
        string email
        string full_name
        string role
        string avatar_url
        string timezone
        boolean calendar_sync_enabled
        string google_calendar_id
        string available_times
        string google_refresh_token
        int weekly_capacity_hours
    }

    team_members {
        int id PK
        int team_id FK
        int user_id FK
        string role
        datetime created_at
    }

    teams {
        int id PK
        string name
        string description
        datetime created_at
        datetime updated_at
        int project_id FK
    }

    projects {
        int id PK
        string name
        string description
        int owner_id FK
        int team_id FK
        datetime created_at
        datetime updated_at
    }

    tasks {
        int id PK
        int project_id FK
        string title
        string description
        string status
        int assignee FK
        string priority
        datetime created_at
        datetime updated_at
        datetime due_date
    }

    attachments {
        int id PK
        int uploaded_by FK
        int task_id FK
        string filename
        string mimetype
        int size
        string supabase_path
        datetime created_at
    }

    time_entries {
        int id PK
        int user_id FK
        int project_id FK
        int task_id FK
        datetime start_ts
        int duration_minutes
        datetime created_at
    }

    heartbeats {
        int id PK
        int user_id FK
        int team_id FK
        datetime timestamp
        int duration_ms
        string app
        string platform
        string source
        string title
        string metadata
        datetime last_seen
    }

    calendar_events {
        int id PK
        int user_id FK
        string calendar_id
        datetime start
        datetime end
        string summary
        string raw
        datetime updated_at
    }

    events {
        int id PK
        int actor FK
        string action
        string object_type
        int object_id
        string payload
        datetime created_at
    }

    revisions {
        int id PK
        string object_type
        int object_id
        int origin_id
        int seq
        string payload
        datetime created_at
        boolean synced
    }

    local_session {
        int id PK
        string session_encrypted
    }

    %% Relationships
    users ||--o{ team_members : "has"
    teams ||--o{ team_members : "includes"
    teams ||--o{ projects : "has"
    projects ||--o{ tasks : "has"
    users ||--o{ tasks : "assigned to"
    tasks ||--o{ attachments : "has"
    users ||--o{ attachments : "uploads"
    users ||--o{ time_entries : "logs"
    projects ||--o{ time_entries : "tracked by"
    tasks ||--o{ time_entries : "related to"
    users ||--o{ heartbeats : "produces"
    teams ||--o{ heartbeats : "records"
    users ||--o{ calendar_events : "owns"
    users ||--o{ events : "acts as"
```

---

## 🔗 Relationship Summary

| Entity            | Connected To                                                                                                  | Relationship                  |
|-------------------|---------------------------------------------------------------------------------------------------------------|-------------------------------|
| **users**         | `team_members`, `projects`, `tasks`, `attachments`, `heartbeats`, `time_entries`, `calendar_events`, `events` | One-to-many                   |
| **teams**         | `team_members`, `projects`, `heartbeats`                                                                      | One-to-many                   |
| **projects**      | `tasks`, `teams`, `time_entries`                                                                              | One-to-many                   |
| **tasks**         | `attachments`, `time_entries`                                                                                 | One-to-many                   |
| **heartbeats**    | `users`, `teams`                                                                                              | Many-to-one                   |
| **revisions**     | (all major entities)                                                                                          | Tracks changes                |
| **local_session** | none                                                                                                          | Device-level auth persistence |

---

## 📚 Data Schema Overview

### 🧩 Core Entities

| Entity          | 🔗 Relations                                                                                          | 🧠 Description                                                                                |
|:----------------|:------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------|
| 🧑‍💼 **users** | ↔ `team_members`, `projects`, `tasks`, `attachments`, `heartbeats`, `time_entries`, `calendar_events` | Central identity — represents workspace members. Handles auth, Google sync, and availability. |
| 👥 **teams**    | ↔ `team_members`, `projects`, `heartbeats`                                                            | Logical grouping of users. Each team can own multiple projects.                               |
| 🧱 **projects** | ↔ `teams`, `tasks`, `time_entries`                                                                    | Represents a single workstream or deliverable; owned by a team and user.                      |
| ✅ **tasks**     | ↔ `projects`, `users`, `attachments`, `time_entries`                                                  | Atomic unit of work. Tracks progress, assignees, due dates, and priorities.                   |

---

### 👷 Collaboration & Structure

| Entity                 | 🔗 Relations       | 🧠 Description                                                        |
|:-----------------------|:-------------------|:----------------------------------------------------------------------|
| 🧩 **team_members**    | ↔ `teams`, `users` | Maps users to teams with role-based access (`admin`, `member`, etc.). |
| 📎 **attachments**     | ↔ `tasks`, `users` | File uploads for task-related documents, stored via Supabase.         |
| 📅 **calendar_events** | ↔ `users`          | External or synced calendar entries (Google Calendar integration).    |

---

### ⚙️ Activity & Analytics

| Entity              | 🔗 Relations                   | 🧠 Description                                                                                                                          |
|:--------------------|:-------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------|
| 🔥 **heartbeats**   | ↔ `users`, `teams`             | Continuous activity pings from desktop apps & extensions. Used for real-time presence, app usage analytics, and user activity heatmaps. |
| ⏱️ **time_entries** | ↔ `users`, `projects`, `tasks` | Tracks duration of work sessions, feeding productivity analytics and reporting.                                                         |
| 🧾 **events**       | ↔ `users`, all entities        | Audit log of user-triggered actions (task updates, file uploads, etc.).                                                                 |
| 🧬 **revisions**    | ↔ `tasks`, `projects`, `teams` | Sync history and offline-first data change tracking for conflict resolution.                                                            |

---

### 🧰 System Tables

| Entity               | 🔗 Relations | 🧠 Description                                                                 |
|:---------------------|:-------------|:-------------------------------------------------------------------------------|
| 🔑 **local_session** | —            | Local secure storage for encrypted session tokens (per device).                |
| 🗃️ **indexes**      | —            | Performance-optimized indices for heartbeat queries (timestamp, user_id, app). |

---

## 🧭 ER Model (Quick Visual)

```mermaid
erDiagram

    users ||--o{ team_members : ""
    team_members }o--|| teams : ""
    teams ||--o{ projects : ""
    projects ||--o{ tasks : ""
    tasks ||--o{ attachments : ""
    tasks ||--o{ time_entries : ""
    users ||--o{ heartbeats : ""
    users ||--o{ calendar_events : ""
    users ||--o{ events : ""
    users ||--o{ revisions : ""
    users ||--o{ local_session : ""
```

---

## 🪄 Design Notes

- Indexed high-volume tables: `heartbeats`, `time_entries`, `tasks`
- All timestamps are stored as UNIX epoch (ms) for cross-platform consistency
- Sync-safe — every entity can be tied into the **revision log** for offline merge
- Optimized for Supabase real-time mirroring (via UUID PKs and `updated_at` triggers)
