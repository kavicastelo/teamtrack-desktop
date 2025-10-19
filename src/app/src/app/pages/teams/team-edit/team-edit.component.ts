import {Component, OnInit} from '@angular/core';
import { inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import {MatCardModule} from '@angular/material/card';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {CommonModule} from '@angular/common';
import {IpcService} from '../../../services/ipc.service';
import {MatIcon} from '@angular/material/icon';
import {MatOption, MatSelect} from '@angular/material/select';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef,
  MatTable
} from '@angular/material/table';
import {AuthService} from '../../../services/auth.service';

@Component({
  selector: 'app-team-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIcon,
    MatSelect,
    MatOption,
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatCell,
    MatHeaderCellDef,
    MatCellDef,
    MatHeaderRow,
    MatRow,
    MatHeaderRowDef,
    MatRowDef,
  ],
  templateUrl: './team-edit.component.html',
  styleUrls: ['./team-edit.component.scss'],
})
export class TeamEditComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private snack = inject(MatSnackBar);
  private ipc = inject(IpcService);
  public auth = inject(AuthService);

  form!: FormGroup;
  isLoading = signal(false);
  teamId: string | null = null;
  projectId: string | null = null;

  members = signal<any[]>([]);
  allUsers = signal<any[]>([]);

  async ngOnInit() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: [''],
    });

    this.teamId = this.route.snapshot.paramMap.get('teamId');
    this.projectId = this.route.snapshot.paramMap.get('projectId');

    await this.loadUsers();

    if (this.teamId) {
      await this.loadTeam();
      await this.loadMembers();
    }
  }

  async loadUsers() {
    try {
      const users = await this.auth.listUsers();
      this.allUsers.set(users || []);
      console.log(this.allUsers())
    } catch (err) {
      console.error(err);
      this.snack.open('Failed to load users', 'Dismiss', { duration: 3000 });
    }
  }

  async loadTeam() {
    this.isLoading.set(true);
    try {
      const teams = await this.ipc.listTeams(this.projectId);
      const team = teams.find((t: any) => t.id === this.teamId);
      if (team) this.form.patchValue(team);
    } catch (err) {
      this.snack.open('Failed to load team', 'Dismiss', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMembers() {
    try {
      const result = await this.ipc.rawQuery(
        `SELECT tm.*, u.full_name, u.email FROM team_members tm
         LEFT JOIN users u ON tm.user_id = u.id
         WHERE tm.team_id = ?`,
        [this.teamId]
      );
      this.members.set(result || []);
    } catch (err) {
      console.error(err);
    }
  }

  async save() {
    if (this.form.invalid) return;
    this.isLoading.set(true);

    const payload = {
      ...this.form.value,
      id: this.teamId,
      project_id: this.projectId,
    };

    try {
      if (this.teamId) {
        await this.ipc.updateTeam(payload);
        this.snack.open('Team updated', 'OK', { duration: 2000 });
      } else {
        const team = await this.ipc.createTeam(payload);
        this.teamId = team.id;
        this.snack.open('Team created', 'OK', { duration: 2000 });
      }
      await this.loadMembers();
    } catch (err) {
      console.error(err);
      this.snack.open('Error saving team', 'Dismiss', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  async addMember(userId: string, role: string) {
    if (!this.teamId) return this.snack.open('Save the team first', 'OK');
    try {
      const id = this.createUuidv4();
      const now = Date.now();
      await this.ipc.rawQuery(
        `INSERT INTO team_members (id, team_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?, ?)`,
        [id, this.teamId, userId, role, now]
      );
      await this.loadMembers();
      return; // add this return statement
    } catch (err) {
      console.error(err);
      this.snack.open('Failed to add member', 'Dismiss', { duration: 3000 });
    }
    return; // add this return statement
  }

  async removeMember(id: string) {
    try {
      await this.ipc.rawQuery(`DELETE FROM team_members WHERE id = ?`, [id]);
      await this.loadMembers();
      this.snack.open('Member removed', 'OK', { duration: 2000 });
    } catch (err) {
      console.error(err);
      this.snack.open('Failed to remove member', 'Dismiss', { duration: 3000 });
    }
  }

  createUuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
