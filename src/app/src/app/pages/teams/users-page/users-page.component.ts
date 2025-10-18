import {Component, inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {MatIconModule} from '@angular/material/icon';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import {MatMenuModule} from '@angular/material/menu';
import {MatSelectModule} from '@angular/material/select';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {AuthService} from '../../../services/auth.service';
import {InviteUserDialogComponent} from '../../../components/invite-user-dialog/invite-user-dialog.component';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule,
    MatSelectModule,
    FormsModule
  ],
  template: `
  <div class="users-header">
    <h1>Users</h1>
    <div class="header-actions">
      <button mat-flat-button color="primary" (click)="openInvite()">Invite user</button>
      <button mat-stroked-button (click)="refresh()">Refresh</button>
    </div>
  </div>

  <table mat-table [dataSource]="users" class="mat-elevation-z2 users-table">
    <!-- Email-->
    <ng-container matColumnDef="email">
      <th mat-header-cell *matHeaderCellDef>Email</th>
      <td mat-cell *matCellDef="let u">{{ u.email }}</td>
    </ng-container>

    <!-- Role -->
    <ng-container matColumnDef="role">
      <th mat-header-cell *matHeaderCellDef>Role</th>
      <td mat-cell *matCellDef="let u">
        <mat-select [(ngModel)]="u.role" (ngModelChange)="changeRole(u)">
          <mat-option value="admin">Admin</mat-option>
          <mat-option value="member">Member</mat-option>
          <mat-option value="viewer">Viewer</mat-option>
        </mat-select>
      </td>
    </ng-container>

    <!-- Team -->
    <ng-container matColumnDef="team">
      <th mat-header-cell *matHeaderCellDef>Team</th>
      <td mat-cell *matCellDef="let u">{{ u.team_id || '-' }}</td>
    </ng-container>

    <!-- Actions -->
    <ng-container matColumnDef="actions">
      <th mat-header-cell *matHeaderCellDef>Actions</th>
      <td mat-cell *matCellDef="let u">
        <button mat-icon-button color="warn" (click)="remove(u)" title="Remove user">
          <mat-icon>delete</mat-icon>
        </button>
      </td>
    </ng-container>

    <tr mat-header-row *matHeaderRowDef="columns"></tr>
    <tr mat-row *matRowDef="let row; columns: columns;"></tr>
  </table>
  `,
  styles: [`
    :host { display:block; padding: 16px; color: #e0e0e0; }
    .users-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .users-table { width:100%; background: rgba(255,255,255,0.03); }
    .header-actions { display:flex; gap:8px; align-items:center; }
  `]
})
export class UsersPageComponent implements OnInit {
  authService = inject(AuthService);
  dialog = inject(MatDialog);
  snack = inject(MatSnackBar);

  users: any[] = [];
  columns = ['email', 'role', 'team', 'actions'];

  async ngOnInit() {
    await this.refresh();
  }

  async refresh() {
    try {
      const list = await this.authService.listUsers();
      this.users = list ?? [];
    } catch (err: any) {
      console.error(err);
      this.snack.open('Failed to load users: ' + (err.message ?? err), 'Close', { duration: 4000 });
    }
  }

  openInvite() {
    const ref = this.dialog.open(InviteUserDialogComponent, { restoreFocus: true });
    ref.afterClosed().subscribe(async (payload) => {
      if (!payload) return;
      try {
        await this.authService.inviteUser(payload);
        this.snack.open('Invitation sent', 'Close', { duration: 3000 });
        await this.refresh();
      } catch (err: any) {
        console.error(err);
        this.snack.open('Failed to invite: ' + (err.message ?? err), 'Close', { duration: 5000 });
      }
    });
  }

  async changeRole(user: any) {
    try {
      await this.authService.updateUserRole({ userId: user.id, role: user.role });
      this.snack.open('Role updated', 'Close', { duration: 2000 });
      await this.refresh();
    } catch (err: any) {
      console.error(err);
      this.snack.open('Failed to update role: ' + (err.message ?? err), 'Close', { duration: 4000 });
    }
  }

  async remove(user: any) {
    if (!confirm(`Remove ${user.email} from app? This deletes profile and team membership.`)) return;
    try {
      await this.authService.removeUser({ userId: user.id, hardDelete: false });
      this.snack.open('User removed', 'Close', { duration: 3000 });
      await this.refresh();
    } catch (err: any) {
      console.error(err);
      this.snack.open('Failed to remove user: ' + (err.message ?? err), 'Close', { duration: 4000 });
    }
  }
}
