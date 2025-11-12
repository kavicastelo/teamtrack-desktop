# 🚀 Team-track — Local-First Work & Progress Tracker

> **Modern, backend-free, offline-first desktop app** for tracking projects, teams, and productivity — built with **Electron 30+, Angular 19+, SQLite + Drizzle, and Supabase**.

---

## 🧩 Overview
TeamPulse is a **local-first hybrid desktop app** that helps teams manage projects, tasks, and analytics **without relying on a central backend server**.

All data is stored locally in an **AES-encrypted SQLite database**, synced periodically with **Supabase** for collaboration, backup, and realtime updates.

### ✨ Key Highlights
- 🖥 **Backend-free**: 100% of logic runs locally (no central API backend)
- 🔄 **Local-first sync**: SQLite ↔ Supabase with conflict resolution
- 📡 **Realtime** presence, tasks, and events via Supabase Realtime
- 🔐 **Secure**: local AES-encrypted SQLite, Supabase Auth for cloud sync
- 📊 **Analytics**: local event logs + Supabase views + optional Metabase
- 🌐 **Offline-ready**: full offline mode with seamless sync when online
- 📅 **Google Calendar** integration (availability + work sync)
- 🧠 **Extensible modules**: Tasks, Teams, Projects, Time-Tracking, Analytics

---

## 🏗 Tech Stack

| Layer           | Technology                                              |
|-----------------|---------------------------------------------------------|
| UI              | Angular 19 (standalone) + Angular Material (Dark theme) |
| Desktop Runtime | Electron 30+                                            |
| Database        | Local SQLite + [Drizzle ORM](https://orm.drizzle.team)  |
| Cloud Sync      | Supabase (Postgres + Realtime + Auth + Storage)         |
| Charts          | Chart.js + ng2-charts                                   |
| Local Security  | AES-256 encrypted SQLite file                           |
| Realtime        | Supabase Realtime (tasks, users, teams)                 |
| Analytics       | Supabase SQL views + Metabase (optional)                |

---

## 📂 Folder Structure

```text
teamtrack-desktop/
    ├── electron-builder.yml
    ├── package.json
    ├── tsconfig.electron.json
    ├── tsconfig.json
    ├── scripts/
    │   ├── decrypt-db.ts
    │   └── encrypt-db.ts
    ├── src/
    │   ├── app/
    │   │   ├── README.md
    │   │   ├── angular.json
    │   │   ├── package-lock.json
    │   │   ├── package.json
    │   │   ├── tsconfig.app.json
    │   │   ├── tsconfig.json
    │   │   ├── tsconfig.spec.json
    │   │   ├── .editorconfig
    │   │   ├── .gitignore
    │   │   ├── public/
    │   │   │   └── assets/
    │   │   └── src/
    │   │       ├── _index.scss
    │   │       ├── _redirects
    │   │       ├── index.html
    │   │       ├── main.ts
    │   │       ├── styles.scss
    │   │       ├── app/
    │   │       │   ├── app.component.html
    │   │       │   ├── app.component.scss
    │   │       │   ├── app.component.spec.ts
    │   │       │   ├── app.component.ts
    │   │       │   ├── app.config.ts
    │   │       │   ├── app.routes.ts
    │   │       │   ├── components/
    │   │       │   │   ├── dashboard-widgets/
    │   │       │   │   │   ├── heatmap.widget.ts
    │   │       │   │   │   ├── my-work.widget.ts
    │   │       │   │   │   ├── team-pulse.widget.ts
    │   │       │   │   │   ├── timeline.widget.ts
    │   │       │   │   │   ├── app-usage/
    │   │       │   │   │   │   ├── app-usage.component.html
    │   │       │   │   │   │   ├── app-usage.component.scss
    │   │       │   │   │   │   ├── app-usage.component.spec.ts
    │   │       │   │   │   │   └── app-usage.component.ts
    │   │       │   │   │   └── user-activity-heatmap/
    │   │       │   │   │       ├── user-activity-heatmap.component.html
    │   │       │   │   │       ├── user-activity-heatmap.component.scss
    │   │       │   │   │       ├── user-activity-heatmap.component.spec.ts
    │   │       │   │   │       └── user-activity-heatmap.component.ts
    │   │       │   │   ├── invite-complete/
    │   │       │   │   │   ├── invite-complete.component.html
    │   │       │   │   │   ├── invite-complete.component.scss
    │   │       │   │   │   ├── invite-complete.component.spec.ts
    │   │       │   │   │   └── invite-complete.component.ts
    │   │       │   │   ├── invite-user-dialog/
    │   │       │   │   │   ├── invite-user-dialog.component.html
    │   │       │   │   │   ├── invite-user-dialog.component.scss
    │   │       │   │   │   ├── invite-user-dialog.component.spec.ts
    │   │       │   │   │   └── invite-user-dialog.component.ts
    │   │       │   │   ├── message-container/
    │   │       │   │   │   ├── message-container.component.html
    │   │       │   │   │   ├── message-container.component.scss
    │   │       │   │   │   ├── message-container.component.spec.ts
    │   │       │   │   │   └── message-container.component.ts
    │   │       │   │   ├── pipes/
    │   │       │   │   │   ├── calendar-pipes.ts
    │   │       │   │   │   ├── FileSizePipe.ts
    │   │       │   │   │   ├── TruncateFilenamePipe.ts
    │   │       │   │   │   └── TruncatePipe.ts
    │   │       │   │   ├── project-name-dialog/
    │   │       │   │   │   ├── project-name-dialog.component.html
    │   │       │   │   │   ├── project-name-dialog.component.scss
    │   │       │   │   │   ├── project-name-dialog.component.spec.ts
    │   │       │   │   │   └── project-name-dialog.component.ts
    │   │       │   │   ├── task-detail-dialog/
    │   │       │   │   │   ├── task-detail-dialog.component.html
    │   │       │   │   │   ├── task-detail-dialog.component.scss
    │   │       │   │   │   ├── task-detail-dialog.component.spec.ts
    │   │       │   │   │   └── task-detail-dialog.component.ts
    │   │       │   │   └── team-name-dialog/
    │   │       │   │       ├── team-name-dialog.component.html
    │   │       │   │       ├── team-name-dialog.component.scss
    │   │       │   │       ├── team-name-dialog.component.spec.ts
    │   │       │   │       └── team-name-dialog.component.ts
    │   │       │   ├── models/
    │   │       │   │   ├── task.model.ts
    │   │       │   │   └── ui-message.model.ts
    │   │       │   ├── pages/
    │   │       │   │   ├── analytics/
    │   │       │   │   │   └── analytics-dashboard/
    │   │       │   │   │       ├── analytics-dashboard.component.html
    │   │       │   │   │       ├── analytics-dashboard.component.scss
    │   │       │   │   │       ├── analytics-dashboard.component.spec.ts
    │   │       │   │   │       └── analytics-dashboard.component.ts
    │   │       │   │   ├── auth/
    │   │       │   │   │   ├── auth-callback/
    │   │       │   │   │   │   ├── auth-callback.component.html
    │   │       │   │   │   │   ├── auth-callback.component.scss
    │   │       │   │   │   │   ├── auth-callback.component.spec.ts
    │   │       │   │   │   │   └── auth-callback.component.ts
    │   │       │   │   │   ├── auth-login/
    │   │       │   │   │   │   ├── auth-login.component.html
    │   │       │   │   │   │   ├── auth-login.component.scss
    │   │       │   │   │   │   ├── auth-login.component.spec.ts
    │   │       │   │   │   │   └── auth-login.component.ts
    │   │       │   │   │   └── auth-register/
    │   │       │   │   │       ├── auth-register.component.html
    │   │       │   │   │       ├── auth-register.component.scss
    │   │       │   │   │       ├── auth-register.component.spec.ts
    │   │       │   │   │       └── auth-register.component.ts
    │   │       │   │   ├── dashboard/
    │   │       │   │   │   └── dashboard/
    │   │       │   │   │       ├── dashboard.component.html
    │   │       │   │   │       ├── dashboard.component.scss
    │   │       │   │   │       ├── dashboard.component.spec.ts
    │   │       │   │   │       └── dashboard.component.ts
    │   │       │   │   ├── files/
    │   │       │   │   │   └── files-list/
    │   │       │   │   │       ├── files-list.component.html
    │   │       │   │   │       ├── files-list.component.scss
    │   │       │   │   │       ├── files-list.component.spec.ts
    │   │       │   │   │       └── files-list.component.ts
    │   │       │   │   ├── kanban/
    │   │       │   │   │   └── task-board/
    │   │       │   │   │       ├── task-board.component.html
    │   │       │   │   │       ├── task-board.component.scss
    │   │       │   │   │       ├── task-board.component.spec.ts
    │   │       │   │   │       └── task-board.component.ts
    │   │       │   │   ├── profile/
    │   │       │   │   │   ├── profile/
    │   │       │   │   │   │   ├── profile.component.html
    │   │       │   │   │   │   ├── profile.component.scss
    │   │       │   │   │   │   ├── profile.component.spec.ts
    │   │       │   │   │   │   └── profile.component.ts
    │   │       │   │   │   └── profile-edit/
    │   │       │   │   │       ├── profile-edit.component.html
    │   │       │   │   │       ├── profile-edit.component.scss
    │   │       │   │   │       ├── profile-edit.component.spec.ts
    │   │       │   │   │       └── profile-edit.component.ts
    │   │       │   │   ├── projects/
    │   │       │   │   │   ├── project-list/
    │   │       │   │   │   │   ├── project-list.component.html
    │   │       │   │   │   │   ├── project-list.component.scss
    │   │       │   │   │   │   ├── project-list.component.spec.ts
    │   │       │   │   │   │   └── project-list.component.ts
    │   │       │   │   │   └── project-view/
    │   │       │   │   │       ├── project-view.component.html
    │   │       │   │   │       ├── project-view.component.scss
    │   │       │   │   │       ├── project-view.component.spec.ts
    │   │       │   │   │       └── project-view.component.ts
    │   │       │   │   ├── teams/
    │   │       │   │   │   ├── team-edit/
    │   │       │   │   │   │   ├── team-edit.component.html
    │   │       │   │   │   │   ├── team-edit.component.scss
    │   │       │   │   │   │   ├── team-edit.component.spec.ts
    │   │       │   │   │   │   └── team-edit.component.ts
    │   │       │   │   │   ├── team-list/
    │   │       │   │   │   │   ├── team-list.component.html
    │   │       │   │   │   │   ├── team-list.component.scss
    │   │       │   │   │   │   ├── team-list.component.spec.ts
    │   │       │   │   │   │   └── team-list.component.ts
    │   │       │   │   │   └── users-page/
    │   │       │   │   │       ├── users-page.component.html
    │   │       │   │   │       ├── users-page.component.scss
    │   │       │   │   │       ├── users-page.component.spec.ts
    │   │       │   │   │       └── users-page.component.ts
    │   │       │   │   └── time-tracking/
    │   │       │   │       └── time-tracking-dashboard/
    │   │       │   │           ├── time-tracking-dashboard.component.html
    │   │       │   │           ├── time-tracking-dashboard.component.scss
    │   │       │   │           ├── time-tracking-dashboard.component.spec.ts
    │   │       │   │           └── time-tracking-dashboard.component.ts
    │   │       │   └── services/
    │   │       │       ├── auth.service.ts
    │   │       │       ├── dashboard.service.ts
    │   │       │       ├── drizzle-client.ts
    │   │       │       ├── ipc.service.ts
    │   │       │       ├── message.service.ts
    │   │       │       ├── team-member.service.ts
    │   │       │       └── time-tracking.service.ts
    │   │       └── styles/
    │   │           └── _theme-dark.scss
    │   ├── drizzle/
    │   │   └── shema.ts
    │   ├── electron/
    │   │   ├── electron-store.ts
    │   │   ├── main.ts
    │   │   ├── preload.ts
    │   │   ├── ipc/
    │   │   │   ├── google-calendar-ipc.ts
    │   │   │   ├── heartbeat-ips.ts
    │   │   │   ├── ipc-handlers.ts
    │   │   │   ├── metrics-ipc.ts
    │   │   │   └── register-admin-analytics-ipc.ts
    │   │   ├── services/
    │   │   │   ├── app-services.ts
    │   │   │   └── auth.service.ts
    │   │   ├── static/
    │   │   │   └── offline.html
    │   │   ├── utils/
    │   │   │   └── protocol.ts
    │   │   └── windows/
    │   │       └── main-window.ts
    │   └── node/
    │       ├── active-window-detector.ts
    │       ├── google-calendar-sync.service.ts
    │       ├── heartbeat.service.ts
    │       ├── idle-monitor.service.ts
    │       ├── local-collector-server.ts
    │       ├── supabase-sync.service.js
    │       ├── supabase-sync.service.ts
    │       └── db/
    │           ├── database.service.js
    │           ├── database.service.ts
    │           ├── db-init.js
    │           ├── db-init.ts
    │           ├── aggregators/
    │           │   └── heartbeat-summary-job.ts
    │           └── migrations/
    │               └── heartbeat-summary.migration.ts
    └── supabase/
        └── schema.sql
```

## ⚙️ Setup & Development

### 1️⃣ Prerequisites

Ensure you have the following installed:
- Node 18+
- npm 9+ or pnpm 8+
- SQLite 3
- Supabase account ([sign up](https://supabase.com/))
- Google Cloud app for OAuth

### 2️⃣ Clone & Install

```bash
git clone https://github.com/kavicastelo/teamtrack-desktop
cd teamtrack-desktop
npm install
```

### 3️⃣ Configure Supabase

Create a `.env` file at the root:

```text
ELECTRON_START_URL = start-url
SUPABASE_URL = https://xyzcompany.supabase.co
SUPABASE_ANON_KEY = your-anon-key
DB_KEY = your-db-encryption-key
SUPABASE_SERVICE_ROLE = your-supabase-service-role
LOCAL_ENCRYPT_KEY = your-local-encryption-key
JWT_SECRET_KEY = your-jwt-secret-key
NODE_ENV = development/production
GOOGLE_CLIENT_ID = your-google-client-id
GOOGLE_CLIENT_SECRET = your-google-client-secret
CALENDAR_SYNC_INTERVAL_MS = time-in-ms(60000)
APP_PROTOCOL_ENABLED = true/false
```

Then initialize your Supabase project:

```bash
npx supabase db push
```

and ensure tables `projects`, `tasks`, `teams`, `users`, `events`, etc. match the `ensureSchema()` structure inside `database.service.ts`.

### 4️⃣ Start in Development

Run Angular and Electron in parallel:

```bash
npm run serve:angular    # Start Angular dev server
npm run electron:start   # Start Electron app

-- OR --

npm run serve:angular    # Start Angular dev server
npm run build:electron     # Build Electron

(Terminal) electron dist/electron/main.js
```

Alternatively, use a combined watcher:

```bash
npm run serve:angular && npm run electron:dev
```

### 5️⃣ Build for Production

```bash
npm run pack  # Build and package Electron app(test in development)
npm run dist  # Build and package Electron app
```

Build output will be under dist/ (installers for Windows/macOS/Linux).

---

## 🔐 Security & Auth

- **Local storage:**
  - All user data and settings are stored locally in AES-256-encrypted SQLite (`local.db.enc`).
- **Supabase Auth:**
  - Provides JWT-based sign-in (email, Google, magic link).
- **IPC security:**
  - All database and sync operations happen in Electron main process; Angular UI communicates via `preload.ts` using secure, type-safe IPC channels — no keys or credentials exposed in the renderer.

---

## 🔄 Sync & Offline Behavior

| Mode                    | Description                                                                     |
|-------------------------|---------------------------------------------------------------------------------|
| **Offline**             | App runs entirely off local SQLite; all changes queued in `revisions` table     |
| **Online**              | Periodic or manual sync via `SupabaseSyncService`                               |
| **Realtime**            | Realtime presence, task updates, and attachments via Supabase Realtime channels |
| **Conflict resolution** | “Last-write-wins” with revision history stored locally                          |

---

## 📊 Analytics

### Built-in Analytics Modules

- **Dashboard Widgets**: My Tasks, Due Today, Overdue, Active Projects
- **Team Pulse**: Online presence + throughput over time
- **Super-User Analytics**:
  - User activity heatmaps
  - App usage distribution (via heartbeats)
  - Productivity timelines
  - Project heatmaps (open vs overdue tasks)

All analytics run locally; aggregated results sync to Supabase (Postgres views + optional Metabase dashboards).

---

## 🔧 Performance Tips

- The app includes a daily job that aggregates raw `heartbeats` into `heartbeat_summaries` (7× faster queries for analytics).
- Indexed columns:
  - `heartbeats(timestamp)`
  - `tasks(updated_at, status)`
  - `projects(owner_id)`
- IPC routes use cached results for up to **60 seconds** to minimize query load.

---

## 🧱 Extend & Customize

You can add modules easily by creating a new feature folder:

```bash
src/app/features/<your-module>/
```
and registering a new IPC channel under `electron/ipc/`.
For example:
- `time-tracking`
- `finance-reports`
- `client-invoices`
- `AI task summarization` (future)

---

## 📦 Deployment

To distribute installers:

```bash
npm run dist
```
This uses [electron-builder](https://www.electron.build/) and generates platform-specific packages (`.exe`, `.dmg`, `.AppImage`).

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit your changes
4. Push to your fork
5. Open a pull request 🚀

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ❤️ Acknowledgements

Built with:
- [Angular](https://angular.io/)
- [Angular Material](https://material.angular.io/)
- [Electron](https://electronjs.org/)
- [Supabase](https://supabase.com/)
- [Drizzle-ORM](https://orm.drizzle.team/)
- [Chart.js](https://www.chartjs.org/)
- [ng2-charts](https://github.com/valor-software/ng2-charts)
