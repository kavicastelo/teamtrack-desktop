import { Component, OnInit } from '@angular/core';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {DatePipe, NgClass, NgForOf, NgIf} from '@angular/common';
import {DashboardService} from '../../services/dashboard.service';
import {MatRipple} from '@angular/material/core';
import {AuthService} from '../../services/auth.service';

@Component({
  selector: 'app-my-work-widget',
  standalone: true,
  template: `
    <mat-card class="my-card">
      <mat-card-title>My Work</mat-card-title>
      <mat-card-content>

        <!-- TOP STATS -->
        <div class="stats-row">
          <div class="stat">
            <label>Due this week</label>
            <span class="value">{{ data?.dueWeekCount || 0 }}</span>
          </div>
          <div class="stat">
            <label>Overdue</label>
            <span class="value overdue">{{ data?.overdueCount || 0 }}</span>
          </div>
          <div class="stat">
            <label>Time tracked (min)</label>
            <span class="value">{{ data?.timeTrackedMin || 0 }}</span>
          </div>
        </div>

        <!-- TASK LIST -->
        <div class="tasks-list" *ngIf="data?.dueToday?.length">
          <div class="section-title">Due Today</div>

          <div *ngFor="let t of data?.dueToday" class="task-item" matRipple>

            <div class="chips">
              <span class="chip due-today">Today</span>
              <span class="chip deadline" [ngClass]="getDeadlineClass(t)">
            {{ getDeadlineText(t) }}
          </span>
              <span class="chip overdue" *ngIf="isOverdue(t)">Overdue</span>
            </div>

            <div class="title">{{ t.title }}</div>

            <div class="meta">
              {{ t.due_date ? (t.due_date | date: 'EEE, MMM d • HH:mm') : '' }}
            </div>
          </div>
        </div>

        <div class="empty" *ngIf="!data?.dueToday?.length">
          🎉 No tasks due today
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
    NgIf,
    MatRipple,
    NgClass
  ],
  styles: [`
    .my-card {
      background: #1f1f1f;
      color: #eaeaea;
      border-radius: 12px;
      padding-bottom: 10px;
    }

    .mat-mdc-card-content {
      max-height: 400px;
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 4px;
        height: 4px;
      }

      &::-webkit-scrollbar-track {
        background: #333;
      }

      &::-webkit-scrollbar-thumb {
        background: #444;
      }
    }

    .stats-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;

      .stat label {
        font-size: .75rem;
        opacity: .7;
        margin-right: .4rem;
      }

      .value {
        font-size: 1rem;
        font-weight: 500;
      }

      .value.overdue {
        color: #ff7979;
      }
    }

    /* SECTION TITLE */
    .section-title {
      font-size: .8rem;
      opacity: .7;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: .5px;
    }

    .tasks-list {
      border-top: 1px solid rgba(255,255,255,.06);
      padding-top: 10px;
    }

    /* TASK ITEM */
    .task-item {
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,.06);
      transition: background .15s, transform .15s;
      cursor: pointer;
    }

    .task-item:hover {
      background: rgba(255,255,255,.04);
      transform: translateX(2px);
    }

    .title {
      font-size: .95rem;
      font-weight: 500;
    }

    .meta {
      font-size: .75rem;
      opacity: .6;
      margin-top: 2px;
    }

    /* CHIPS */
    .chips {
      display: flex;
      gap: 6px;
      margin-bottom: 4px;
    }

    .chip {
      padding: 2px 8px;
      font-size: .7rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: .4px;
      font-weight: 500;
    }

    /* CHIP VARIANTS */
    .due-today {
      background: #ffcc66;
      color: #402c00;
    }

    .chip.overdue {
      background: #ff4b4b;
      color: white !important;
    }

    .chip-overdue {
      background: #ff4b4b;
    }

    .chip-critical {
      background: #ff965e;
    }

    .chip-soon {
      background: #4da3ff;
    }

    .chip-normal {
      background: #5a5a5a;
      color: #ddd;
    }

    .deadline {
      background: #333;
    }
  `]
})
export class MyWorkWidgetComponent implements OnInit {
  data: any;

  constructor(private svc: DashboardService, private auth: AuthService) {}

  async ngOnInit() {
    const user = await this.auth.user();
    if (!user) return;
    this.data = await this.svc.getMyWork(user.id);
  }

  isOverdue(task: any): boolean {
    if (!task.due_date) return false;
    return new Date(task.due_date).getTime() < Date.now();
  }

  getDeadlineText(task: any): string {
    if (!task.due_date) return "";

    const now = Date.now();
    const due = new Date(task.due_date).getTime();
    const diff = due - now;

    const mins = Math.round(diff / 60000);
    const hours = Math.round(diff / (60 * 60000));
    const days = Math.round(diff / (24 * 60 * 60000));

    if (this.isOverdue(task)) {
      const overdueDays = Math.abs(days);
      return overdueDays === 0
        ? "Overdue today"
        : `Overdue by ${overdueDays}d`;
    }

    if (mins < 60) return `In ${mins}m`;
    if (hours < 24) return `In ${hours}h`;
    if (days === 1) return "Tomorrow";

    return `In ${days}d`;
  }

  getDeadlineClass(task: any): string {
    if (this.isOverdue(task)) return "chip-overdue";

    const due = new Date(task.due_date).getTime();
    const now = Date.now();
    const diffDays = (due - now) / (24 * 60 * 60 * 1000);

    if (diffDays <= 1) return "chip-critical";
    if (diffDays <= 3) return "chip-soon";
    return "chip-normal";
  }
}
