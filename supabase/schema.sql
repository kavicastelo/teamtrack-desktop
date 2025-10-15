-- Users (Supabase has its own auth.users; we mirror minimal profile)
create table profiles (
                          id uuid primary key references auth.users(id),
                          display_name text,
                          role text, -- 'CEO','tech-lead','dev','ux','finance'
                          team_id uuid
);

-- Teams
create table teams (
                       id uuid primary key default gen_random_uuid(),
                       name text not null,
                       description text,
                       metadata jsonb,
                       created_at timestamptz default now()
);

-- Projects
create table projects (
                          id uuid primary key default gen_random_uuid(),
                          team_id uuid references teams(id),
                          name text not null,
                          description text,
                          start_date date,
                          due_date date,
                          created_at timestamptz default now()
);

-- Tasks
create table tasks (
                       id uuid primary key default gen_random_uuid(),
                       project_id uuid references projects(id),
                       title text not null,
                       description text,
                       assignee uuid references profiles(id),
                       status text default 'todo', -- todo, in-progress, review, done
                       priority int default 3,
                       estimate_minutes int null,
                       due_date timestamptz null,
                       metadata jsonb,
                       updated_at timestamptz default now(),
                       created_at timestamptz default now()
);

-- Attachments metadata (actual files to Supabase storage)
create table attachments (
                             id uuid primary key default gen_random_uuid(),
                             task_id uuid references tasks(id),
                             file_path text,
                             uploaded_by uuid references profiles(id),
                             created_at timestamptz default now()
);

-- Events / audit log (append-only)
create table events (
                        id uuid primary key default gen_random_uuid(),
                        actor uuid references profiles(id),
                        action text not null,
                        object_type text,
                        object_id uuid,
                        payload jsonb,
                        created_at timestamptz default now()
);

-- Conflict resolution helper table: last_modified vector (from clients)
create table revisions (
                           id uuid primary key default gen_random_uuid(),
                           object_type text,
                           object_id uuid,
                           origin_id text, -- client id
                           seq bigint,     -- monotonic sequence per client
                           payload jsonb,
                           created_at timestamptz default now(),
                           synced int default 0
);
