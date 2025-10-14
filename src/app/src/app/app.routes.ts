import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/tasks', pathMatch: 'full' },
  { path: 'tasks', loadComponent: () => import('./pages/kanban/task-board/task-board.component').then(m => m.TaskBoardComponent) },
];
