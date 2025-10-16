import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/tasks', pathMatch: 'full' },
  { path: 'tasks', loadComponent: () => import('./pages/kanban/task-board/task-board.component').then(m => m.TaskBoardComponent) },
  { path: 'team', loadComponent: () => import('./pages/dashboard/team-list/team-list.component').then(m => m.TeamListComponent) },
  { path: 'projects', loadComponent: () => import('./pages/dashboard/project-list/project-list.component').then(m => m.ProjectListComponent) },
  { path: 'project/:id', loadComponent: () => import('./pages/dashboard/project-view/project-view.component').then(m => m.ProjectViewComponent) },
];
