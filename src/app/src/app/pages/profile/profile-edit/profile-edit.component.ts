import {
  Component, OnInit, OnDestroy
} from '@angular/core';
import {
  FormBuilder, Validators, ReactiveFormsModule
} from '@angular/forms';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { IpcService } from '../../../services/ipc.service';
import { AuthService } from '../../../services/auth.service';
import {MatDivider} from '@angular/material/divider';
import {MatTooltip} from '@angular/material/tooltip';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatDivider,
    MatTooltip
  ],
  templateUrl: './profile-edit.component.html',
  styleUrls: ['./profile-edit.component.scss']
})
export class ProfileEditComponent implements OnInit, OnDestroy {
  avatarUrl = '';
  saving = false;
  user: any = null;
  sub?: Subscription;
  profileForm: any;

  calendarConnected = false;
  calendarId: string | null = null;
  calendarEvents: any[] = [];
  busySlots: { start: number; end: number; startOffset: number; durationPercent: number }[] = [];
  freeSlots: { start: number; end: number; startOffset: number; durationPercent: number }[] = [];

  checking = true;

  teams: any[] = [];

  constructor(
    private fb: FormBuilder,
    private ipc: IpcService,
    private auth: AuthService,
    private snack: MatSnackBar
  ) {
    this.profileForm = this.fb.group({
      email: [{ value: '', disabled: true }],
      full_name: ['', Validators.required],
      timezone: [''],
      calendar_sync_enabled: [false],
      google_calendar_id: [''],
      available_times: [''],
      weekly_capacity_hours: [0, [Validators.min(0), Validators.max(168)]],
    });
  }

  async ngOnInit() {
    this.user = await this.auth.user();
    setTimeout(() => this.checking = false, 1000);
    if (!this.user) return;
    this.patchProfile(this.user);

    await this.loadTeams();

    await this.loadCalendarStatus();

    if (this.calendarConnected) {
      await this.loadCalendarEvents();
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  patchProfile(user: any) {
    this.avatarUrl = user?.avatar_url || '';
    this.profileForm.patchValue({
      email: user.email,
      full_name: user?.full_name || '',
      timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekly_capacity_hours: user?.weekly_capacity_hours || 0
    });
  }

  async save() {
    if (this.profileForm.invalid || !this.user) return;

    this.saving = true;
    const payload = {
      id: this.user.id,
      email: this.user.email,
      avatar_url: this.avatarUrl,
      ...this.profileForm.getRawValue(),
      calendar_sync_enabled: this.profileForm.value.calendar_sync_enabled ? 1 : 0,
    };

    try {
      await this.auth.updateProfile(payload);
      this.snack.open('Profile updated', 'OK', { duration: 2000 });
    } catch (err: any) {
      this.snack.open(err.message || 'Update failed', 'OK', { duration: 2000 });
    } finally {
      this.saving = false;
    }
  }

  async loadTeams() {
    this.teams = await this.ipc.userTeams(this.user.id);
  }

  selectDefaultTeam(teamId: string) {
    const payload = {
      ...this.user,
      default_team_id: teamId
    }
    this.auth.updateDefaultTeam(payload).then(async () => {
      setTimeout(async () => {
        this.user = await this.auth.getUser(this.user.id);
      }, 1000)
      this.snack.open('Default team updated', 'OK', {duration: 2000});
    });
  }

  async loadCalendarStatus() {
    const status = await this.ipc.getCalendarStatus(this.user.id || null);
    this.calendarConnected = status.connected;
    this.calendarId = status.calendar_id || null;
    this.profileForm.patchValue({
      calendar_sync_enabled: status.sync_enabled
    });
  }

  async connectCalendar() {
    await this.ipc.connectCalendar(this.user.id || null).then(() => {
      this.calendarConnected = true;
      setTimeout(() => this.loadCalendarStatus(), 1000);
    });
    this.snack.open('Please complete the Google login in your browser', 'OK', { duration: 4000 });
  }

  async disconnectCalendar() {
    await this.ipc.disconnectCalendar().then(() => {
      this.calendarConnected = false;
      this.loadCalendarStatus();
    });
    this.snack.open('Disconnected from Google Calendar', 'OK', { duration: 2000 });
  }

  async loadCalendarEvents() {
    const payload = {
      calendarId: this.calendarId || null,
      userId: this.user.id || null
    }
    const events = await this.ipc.getCalendarEvents(payload);
    this.calendarEvents = events;
    this.computeFreeSlots();
  }

  computeFreeSlots() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const startMs = dayStart.getTime();
    const endMs = startMs + 7 * 24 * 60 * 60 * 1000;

    this.busySlots = this.calendarEvents.map(ev => {
      const s = ev.start - startMs;
      const e = ev.end - startMs;

      return {
        start: ev.start,
        end: ev.end,
        startOffset: (s / (endMs - startMs)) * 100,
        durationPercent: ((e - s) / (endMs - startMs)) * 100
      };
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  changeAvatar() {
    this.snack.open('Custom avatars coming soon 👀', 'OK', { duration: 2000 });
  }
}
