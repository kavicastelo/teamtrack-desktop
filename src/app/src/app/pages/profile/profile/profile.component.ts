import {Component, Inject, Input, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {DatePipe, NgClass, NgForOf, NgIf, NgTemplateOutlet, SlicePipe} from '@angular/common';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {
  AllDayPipe, CreatorNamePipe,
  IsBirthdayPipe,
  IsRecurringPipe,
  VisibilityIconPipe
} from '../../../components/pipes/calendar-pipes';

@Component({
  selector: 'app-user-profile',
  imports: [
    NgIf,
    NgForOf,
    DatePipe,
    SlicePipe,
    IsBirthdayPipe,
    NgTemplateOutlet,
    NgClass,
    IsRecurringPipe,
    VisibilityIconPipe,
    AllDayPipe,
    CreatorNamePipe
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true
})
export class ProfileComponent implements OnInit {

  @Input() user: any;
  @Input() currentUserId!: string; // who is logged in

  isSelf = false;
  calendarStatus: any = null;
  events: any[] = [];
  loading = true;
  syncing = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { user: any, currentUserId: string },
              private dialogRef: MatDialogRef<ProfileComponent>,
              private profileSvc: IpcService) {
    this.user = data.user;
    this.currentUserId = data.currentUserId;
  }

  get modeViewOnly() { return !this.isSelf; }

  async ngOnInit() {
    this.isSelf = this.user.id === this.currentUserId;
    await this.loadCalendarStatus();
    await this.loadEvents();
    this.loading = false;
  }

  async loadCalendarStatus() {
    this.calendarStatus = await this.profileSvc.getCalendarStatus(this.user.id);
  }

  async loadEvents() {
    const payload = {
      calendarId: this.calendarStatus.calendar_id || null,
      userId: this.user.id || null
    }

    const ev = await this.profileSvc.getCalendarEvents(payload);
    let events = ev || [];

    // Remove recurring-expanded instances
    events = events.filter((e: any) => {
      return this.convertJson(e)
      // const raw = this.convertJson(e);
      // return !(raw?.recurringEventId && raw?.originalStartTime);
    });

    // Birthday normalizer
    const now = new Date();
    const currentYear = now.getFullYear();

    const birthdayMap = new Map<string, any>();
    const regularEvents: any[] = [];

    for (const e of events) {
      const raw = this.convertJson(e);

      // Identify birthdays
      if (raw?.birthdayProperties || raw?.summary?.toLowerCase().trim().includes('birthday')) {
        const original = new Date(e.start);

        // Construct this year's birthday
        const yearly = new Date(currentYear, original.getMonth(), original.getDate());
        if (yearly < now) {
          yearly.setFullYear(currentYear + 1); // already happened → next year
        }

        // Replace start/end fields in place
        e.start = yearly.getTime();
        e.end = yearly.getTime() + 24 * 60 * 59 * 1000;

        const key = raw?.recurringEventId || e.id;

        // Only store the *upcoming* birthday
        if (!birthdayMap.has(key) || e.start < birthdayMap.get(key).start) {
          birthdayMap.set(key, e);
        }
      } else {
        regularEvents.push(e);
      }
    }

    // Merge
    this.events = [...regularEvents, ...birthdayMap.values()];
  }

  async connect() {
    if (this.modeViewOnly) return;
    await this.profileSvc.connectCalendar(this.user.id);
  }

  async disconnect() {
    if (this.modeViewOnly) return;
    await this.profileSvc.disconnectCalendar(this.user.id);
    await this.loadCalendarStatus();
  }

  async syncNow() {
    if (this.modeViewOnly) return;
    this.syncing = true;
    await this.profileSvc.syncCalendar(this.user.id);
    await this.loadEvents();
    await this.loadCalendarStatus();
    this.syncing = false;
  }

  get upcoming() {
    const now = Date.now();
    return this.events
      .filter(e => e.end > now)
      .sort((a, b) => a.start - b.start)
      .slice(0, 8);
  }

  // range bars for timeline
  getTimelineDays() {
    const now = new Date();
    const days = [...Array(7)].map((_, i) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    );

    return days.map((d) => ({
      date: d,
      busy: this.events.some(e => {
        const s = new Date(e.start);
        const en = new Date(e.end);
        return (
          d >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) &&
          d <= new Date(en.getFullYear(), en.getMonth(), en.getDate())
        );
      })
    }));
  }

  getAttendees(e: any): any[] {
    return e?.attendees || [];
  }

  computeAgeTurning(e: any) {
    const y = Number(e.raw?.originalStartTime?.date?.slice(0,4));
    const now = new Date().getFullYear();
    return now - y + 1;
  }

  convertJson(ev:any): any {
    return JSON.parse(ev.raw || '{}');
  }

  protected readonly console = console;

  visibility(ev: any) {
    return JSON.parse(ev?.raw).visibility || 'public';
  }

  // generate initials like "JD"
  initials(a: any) {
    const name = a?.displayName || a?.email || a ||'?';

    const parts = name.split(/[@.\s+_-]+/).filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    return parts[0].slice(0, 2).toUpperCase();
  }

// deterministic background color based on email
  avatarColor(a: any) {
    const str = a?.email || a?.displayName || a || '?';
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 60%, 45%)`; // nice & dark-theme friendly
  }
}
