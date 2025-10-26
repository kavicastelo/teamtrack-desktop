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
    MatDivider
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
  busySlots: { start: number; end: number }[] = [];
  freeSlots: { start: number; end: number }[] = [];

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
      available_times: ['']
    });
  }

  async ngOnInit() {
    const session = await this.auth.restoreSession();

    if (!session?.user) return;

    this.user = session.user;
    this.patchProfile(session.user);

    // Optionally load saved availability from supabase
    await this.loadRemoteProfile();

    await this.loadCalendarStatus();

    if (this.calendarConnected) {
      await this.loadCalendarEvents();
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  patchProfile(user: any) {
    this.avatarUrl = user.user_metadata?.avatar_url || '';
    this.profileForm.patchValue({
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      timezone: user.user_metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }

  async loadRemoteProfile() {
    const profile = await this.auth.getUser(this.user.id);
    if (!profile) return;

    this.profileForm.patchValue(profile);
  }

  async save() {
    if (this.profileForm.invalid || !this.user) return;

    this.saving = true;
    const payload = {
      id: this.user.id,
      email: this.user.email,
      avatar_url: this.avatarUrl,
      calendar_sync_enabled: this.profileForm.value.calendar_sync_enabled ? 1 : 0,
      ...this.profileForm.getRawValue(),
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
    // optional simple algorithm: just show busy events
    this.busySlots = this.calendarEvents
      .map(ev => ({
        start: ev.start,
        end: ev.end
      }));
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
