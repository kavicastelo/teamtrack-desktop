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
import {ProfileComponent} from '../../profile/profile/profile.component';
import {IpcService} from '../../../services/ipc.service';

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
    <!-- Avatar -->
    <ng-container matColumnDef="avatar">
      <th mat-header-cell *matHeaderCellDef></th>
      <td mat-cell *matCellDef="let u" (click)="openUserProfile(u)">
        <div class="avatar-wrapper">
          <img
            *ngIf="u.avatar_url; else initialsAvatar"
            [src]="u.avatar_url"
            alt="{{ u.full_name }}"
            class="avatar-img"
          />
          <ng-template #initialsAvatar>
            <div
              class="avatar-fallback"
              [style.background]="avatarColor(u)"
            >
              {{ initials(u) }}
            </div>
          </ng-template>
        </div>
      </td>
    </ng-container>

    <!-- Email-->
    <ng-container matColumnDef="email">
      <th mat-header-cell *matHeaderCellDef>Email</th>
      <td mat-cell *matCellDef="let u" (click)="openUserProfile(u)">{{ u.email }}</td>
    </ng-container>

    <!-- Role -->
    <ng-container matColumnDef="role">
      <th mat-header-cell *matHeaderCellDef>Role</th>
      <td mat-cell *matCellDef="let u">
        <mat-select [(ngModel)]="u.role" (ngModelChange)="changeRole(u)" [disabled]="currentUser.role !== 'admin'">
          <mat-option value="admin">Admin</mat-option>
          <mat-option value="member">Member</mat-option>
          <mat-option value="viewer">Viewer</mat-option>
        </mat-select>
      </td>
    </ng-container>

    <!-- Team -->
    <ng-container matColumnDef="team">
      <th mat-header-cell *matHeaderCellDef>Teams</th>
      <td mat-cell *matCellDef="let u">
        <div class="teams-cell" *ngIf="u.teams?.length; else noTeams">
          <span class="team-chip" *ngFor="let t of u.teams">{{ t }}</span>
        </div>
        <ng-template #noTeams>-</ng-template>
      </td>
    </ng-container>

    <!-- Actions -->
    <ng-container matColumnDef="actions">
      <th mat-header-cell *matHeaderCellDef>Actions</th>
      <td mat-cell *matCellDef="let u">
        <button mat-icon-button color="warn" (click)="remove(u)" title="Remove user" [disabled]="currentUser.role !== 'admin'">
          <mat-icon>delete</mat-icon>
        </button>
      </td>
    </ng-container>

    <tr mat-header-row *matHeaderRowDef="columns"></tr>
    <tr mat-row *matRowDef="let row; columns: columns;"></tr>
  </table>
  `,
  styles: [`
    :host {
      display: block;
      padding: 16px;
      color: #e0e0e0;
      background-color: #121212;

      .users-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 500;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
      }

      .users-table {
        width: 100%;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 6px;
        overflow: hidden;

        .avatar-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          min-width: 36px;
          border-radius: 50%;
          overflow: hidden;
          margin-right: 8px;

          .avatar-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
          }

          .avatar-fallback {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            color: #fff;
            font-weight: 600;
            font-size: 0.8rem;
            text-transform: uppercase;
            user-select: none;
          }
        }

        th {
          font-weight: 600;
          color: #bdbdbd;
          background: rgba(255, 255, 255, 0.05);
        }

        td {
          color: #e0e0e0;
        }

        tr:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .teams-cell {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;

          .team-chip {
            background: rgba(63, 81, 181, 0.2); // light indigo tone
            border: 1px solid rgba(63, 81, 181, 0.4);
            color: #bbdefb;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            line-height: 1.4;
            cursor: default;
            transition: background 0.2s;

            &:hover {
              background: rgba(63, 81, 181, 0.35);
            }
          }
        }

        button[mat-icon-button] {
          color: #f44336;

          &:disabled {
            color: rgba(255, 255, 255, 0.3);
          }

          &:hover:not(:disabled) {
            background-color: rgba(244, 67, 54, 0.15);
          }
        }
      }
    }
  `]
})
export class UsersPageComponent implements OnInit {
  authService = inject(AuthService);
  ipc = inject(IpcService);
  dialog = inject(MatDialog);
  snack = inject(MatSnackBar);
  currentUser: any;
  currentSession: any;

  users: any[] = [];
  columns = ['avatar', 'email', 'role', 'team', 'actions'];

  checking = true;

  async ngOnInit() {
    this.currentSession = await this.authService.session();
    this.currentUser = await this.authService.user();
    if (!this.currentUser) return;
    await this.refresh();
  }

  async refresh() {
    try {
      const list = await this.authService.listLocalUsers();
      if (!list || list.length === 0) {
        this.users = [];
        return;
      }

      // Fetch teams for all users concurrently
      const usersWithTeams = await Promise.all(
        list.map(async (user: any) => {
          try {
            const teams = await this.ipc.userTeams(user.id);
            return { ...user, teams: teams.name ?? [] };
          } catch (err) {
            console.warn(`Failed to load teams for user ${user.id}:`, err);
            return { ...user, teams: [] };
          }
        })
      );

      this.users = usersWithTeams;
    } catch (err: any) {
      console.error(err);
      this.snack.open(
        'Failed to load users: ' + (err.message ?? err),
        'Close',
        { duration: 4000 }
      );
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

  openUserProfile(user: any) {
    const ref = this.dialog.open(ProfileComponent, {
      width: '500px',
      data: { user: user, currentUserId: this.currentUser.id }
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        // refresh
      }
    });
  }

  initials(a: any) {
    const name = a?.full_name || a?.email || a || '?';
    const parts = name.split(/[@.\s+_-]+/).filter(Boolean);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }

  avatarColor(a: any) {
    const str = a?.email || a?.full_name || a || '?';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 45%)`;
  }
}
