export interface UiMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
  createdAt: number;
}
