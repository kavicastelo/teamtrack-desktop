export interface Task {
  id: string;
  title: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'review' | 'done' | string;
  assignee?: string;
  updated_at?: number; // epoch ms
}
