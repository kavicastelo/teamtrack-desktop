import {Component, inject} from '@angular/core';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatButtonModule} from '@angular/material/button';
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {IpcService} from '../../services/ipc.service';

@Component({
  selector: 'app-invite-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  template: `
  <h2 mat-dialog-title>Invite user</h2>
  <form [formGroup]="form" (ngSubmit)="submit()" class="invite-form">
    <mat-form-field appearance="fill" class="full">
      <mat-label>Email</mat-label>
      <input matInput placeholder="user@example.com" formControlName="email" />
      <mat-error *ngIf="form.get('email')?.invalid">Enter a valid email</mat-error>
    </mat-form-field>

    <mat-form-field appearance="fill" class="full">
      <mat-label>Role</mat-label>
      <mat-select formControlName="role">
        <mat-option value="member">Member</mat-option>
        <mat-option value="admin">Admin</mat-option>
        <mat-option value="viewer">Viewer</mat-option>
      </mat-select>
    </mat-form-field>

    <mat-form-field appearance="fill" class="full">
      <mat-label>Team (optional)</mat-label>
      <mat-select formControlName="teamId">
        <mat-option value="">None</mat-option>
        <mat-option *ngFor="let team of teams" [value]="team.id">{{ team.name }}</mat-option>
      </mat-select>
    </mat-form-field>

    <div class="actions">
      <button mat-stroked-button type="button" (click)="close()">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || submitting">
        {{ submitting ? 'Inviting…' : 'Invite' }}
      </button>
    </div>
  </form>
  `,
  styles: [`
    .invite-form { display:flex; flex-direction:column; gap:12px; min-width:320px; padding: 8px; }
    .full { width:100%; }
    .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:6px; }
  `]
})
export class InviteUserDialogComponent {
  dialogRef = inject(MatDialogRef<InviteUserDialogComponent>);
  private ipc = inject(IpcService);
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    role: new FormControl('member', [Validators.required]),
    teamId: new FormControl('')
  });
  submitting = false;
  teams: any[] = [];

  async ngOnInit() {
    this.teams = await this.ipc.listTeams();
  }

  close() {
    this.dialogRef.close(null);
  }

  async submit() {
    if (this.form.invalid) return;
    this.submitting = true;
    this.dialogRef.close(this.form.value);
  }
}
