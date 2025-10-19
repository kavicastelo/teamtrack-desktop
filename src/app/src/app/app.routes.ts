import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/tasks', pathMatch: 'full' },
  { path: 'tasks', loadComponent: () => import('./pages/kanban/task-board/task-board.component').then(m => m.TaskBoardComponent) },
  { path: 'team', loadComponent: () => import('./pages/teams/team-list/team-list.component').then(m => m.TeamListComponent) },
  { path: 'users', loadComponent: () => import('./pages/teams/users-page/users-page.component').then(m => m.UsersPageComponent) },
  { path: 'projects', loadComponent: () => import('./pages/projects/project-list/project-list.component').then(m => m.ProjectListComponent) },
  { path: 'projects/:projectId/teams/:teamId/edit', loadComponent: () => import('./pages/teams/team-edit/team-edit.component').then(m => m.TeamEditComponent) },
  { path: 'project/:id', loadComponent: () => import('./pages/projects/project-view/project-view.component').then(m => m.ProjectViewComponent) },
  { path: 'files', loadComponent: () => import('./pages/files/files-list/files-list.component').then(m => m.FilesListComponent) },
  { path: 'auth/invite-complete', loadComponent: () => import('./components/invite-complete/invite-complete.component').then(m => m.InviteCompleteComponent) },
  { path: 'register', loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent) },
];
