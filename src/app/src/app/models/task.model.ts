export interface Task {
  id: string;
  project_id?: string;
  title: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'review' | 'done' | string;
  assignee?: string;
  updated_at?: number; // epoch ms
  created_at?: number;
}
