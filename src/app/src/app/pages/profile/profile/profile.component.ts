import {Component, Inject, Input, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

@Component({
  selector: 'app-user-profile',
  imports: [
    NgIf,
    NgForOf,
    DatePipe
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
    this.events = ev || [];
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
    return days.map((d, i) => ({
      date: d,
      busy: this.events.some(e => {
        const s = new Date(e.start).getDate();
        return d.getDate() === s;
      })
    }));
  }
}
