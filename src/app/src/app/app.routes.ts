import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/tasks', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'tasks', loadComponent: () => import('./pages/kanban/task-board/task-board.component').then(m => m.TaskBoardComponent) },
  { path: 'team', loadComponent: () => import('./pages/teams/team-list/team-list.component').then(m => m.TeamListComponent) },
  { path: 'users', loadComponent: () => import('./pages/teams/users-page/users-page.component').then(m => m.UsersPageComponent) },
  { path: 'projects', loadComponent: () => import('./pages/projects/project-list/project-list.component').then(m => m.ProjectListComponent) },
  { path: 'team/:projectId/teams/:teamId/edit', loadComponent: () => import('./pages/teams/team-edit/team-edit.component').then(m => m.TeamEditComponent) },
  { path: 'project/:id', loadComponent: () => import('./pages/projects/project-view/project-view.component').then(m => m.ProjectViewComponent) },
  { path: 'files', loadComponent: () => import('./pages/files/files-list/files-list.component').then(m => m.FilesListComponent) },
  { path: 'time-tracking', loadComponent: () => import('./pages/time-tracking/time-tracking-dashboard/time-tracking-dashboard.component').then(m => m.TimeTrackingDashboardComponent) },
  { path: 'analytics', loadComponent: () => import('./pages/analytics/analytics-dashboard/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent) },
  { path: 'auth/invite-complete', loadComponent: () => import('./components/invite-complete/invite-complete.component').then(m => m.InviteCompleteComponent) },
  { path: 'auth/register', loadComponent: () => import('./pages/auth/auth-register/auth-register.component').then(m => m.AuthRegisterComponent) },
  { path: 'auth/login', loadComponent: () => import('./pages/auth/auth-login/auth-login.component').then(m => m.AuthLoginComponent) },
  { path: 'auth/callback', loadComponent: () => import('./pages/auth/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent) },
  { path: 'settings', loadComponent: () => import('./pages/profile/profile-edit/profile-edit.component').then(m => m.ProfileEditComponent) },
  { path: '**', loadComponent: () => import('./pages/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent) },
];
