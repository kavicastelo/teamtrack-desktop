import { Component, OnInit } from '@angular/core';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {DatePipe, NgClass, NgForOf} from '@angular/common';
import {DashboardService} from '../../services/dashboard.service';
import {MatRipple} from '@angular/material/core';
import {AuthService} from '../../services/auth.service';

@Component({
  selector: 'app-timeline-widget',
  standalone: true,
  template: `
    <mat-card class="timeline-card">
      <mat-card-title>Activity Timeline</mat-card-title>
      <mat-card-content>

        <div class="timeline">

          <div *ngFor="let group of grouped" class="day-group">

            <div class="date-label">{{ group.label }}</div>

            <div *ngFor="let item of group.items" class="entry" matRipple>

              <div class="icon" [ngClass]="item.kind">
                {{ iconFor(item) }}
              </div>

              <div class="line"></div>

              <div class="content">
                <div class="row">
                  <div class="time">
                    {{ item.ts | date:'shortTime' }}
                  </div>

                  <span class="kind-chip" [ngClass]="item.kind">
                {{ item.kind }}
              </span>
                </div>

                <div class="desc">
                  {{ describe(item) }}
                </div>
              </div>
            </div>

          </div>

        </div>

      </mat-card-content>
    </mat-card>
  `,
  imports: [
    MatCard,
    MatCardTitle,
    MatCardContent,
    NgForOf,
    DatePipe,
    NgClass,
    MatRipple
  ],
  styles: [`
    .timeline-card {
      background: #1f1f1f;
      color: #eaeaea;
      border-radius: 12px;
      overflow: hidden;
    }

    .date-label {
      font-size: .75rem;
      opacity: .6;
      margin: 12px 0 4px 6px;
      text-transform: uppercase;
      letter-spacing: .5px;
    }

    .entry {
      display: flex;
      position: relative;
      padding: 12px 0 12px 36px;
      transition: background .15s ease;
      cursor: pointer;
    }

    .entry:hover {
      background: rgba(255,255,255,0.04);
    }

    .icon {
      position: absolute;
      left: 10px;
      top: 18px;
      width: 22px;
      height: 22px;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .icon.event { background: #204a63; color: #8bd4ff; }
    .icon.revision { background: #3e2a57; color: #d4b4ff; }
    .icon.attachment { background: #204a45; color: #7ee6d8; }

    .line {
      position: absolute;
      left: 20px;
      top: 0;
      width: 2px;
      height: 100%;
      background: rgba(255,255,255,.06);
    }

    .content {
      flex: 1;
      margin-left: 4px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 2px;
    }

    .time {
      width: 80px;
      font-size: .75rem;
      color: #bdbdbd;
      white-space: nowrap;
    }

    .kind-chip {
      padding: 1px 8px;
      border-radius: 6px;
      font-size: .65rem;
      text-transform: uppercase;
      letter-spacing: .4px;
      opacity: .9;
      font-weight: 600;
    }

    .kind-chip.event { background: #223746; color: #8bd4ff; }
    .kind-chip.revision { background: #392c4f; color: #e1c4ff; }
    .kind-chip.attachment { background: #1e3d3b; color: #8ef1e5; }

    .desc {
      font-size: .85rem;
      color: #e0e0e0;
      opacity: .9;
      margin-top: 2px;
    }
  `]
})
export class TimelineWidgetComponent implements OnInit {
  items: any[] = [];
  grouped: any[] = [];
  userId: string = '';

  constructor(private svc: DashboardService, private auth: AuthService) {}

  async ngOnInit() {
    this.userId = this.auth.user()?.user?.id;
    this.items = await this.svc.getActivityTimeByUser(this.userId, 100);
    this.grouped = this.groupByDate(this.items);
  }

  iconFor(item: any) {
    switch (item.kind) {
      case 'event': return '⚡';
      case 'revision': return '📝';
      case 'attachment': return '📎';
      case 'delete': return '🗑️';
      case 'create': return '➕';
      case 'comment': return '💬';
      case 'status': return '🏷️';
      default: return '•';
    }
  }

  describe(item: any) {
    if (item.action)
      return item.action;

    if (item.payload?.title)
      return item.payload.title;

    if (typeof item.payload === 'string')
      return item.payload;

    return JSON.stringify(item.payload || '');
  }

  groupByDate(list: any[]) {
    const groups: { [date: string]: any[] } = {};

    // Sort newest → oldest
    list = [...list].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    for (const item of list) {
      const d = new Date(item.ts);
      const key = d.toDateString();
      groups[key] ||= [];
      groups[key].push(item);
    }

    return Object.keys(groups).map(k => ({
      label: this.prettyDate(k),
      items: groups[k]
    }));
  }

  prettyDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();

    const diff = (today.setHours(0,0,0,0) -
      d.setHours(0,0,0,0)) / 86400000;

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
