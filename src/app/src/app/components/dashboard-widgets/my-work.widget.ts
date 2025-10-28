import { Component, OnInit } from '@angular/core';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
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

        <div class="tasks-list" *ngIf="data?.dueToday?.length">
          <div class="section-title">Due Today</div>
          <div *ngFor="let t of data?.dueToday" class="task-item" matRipple>
            <div class="title">{{ t.title }}</div>
            <div class="meta">
              {{ t.due_date ? (t.due_date | date: 'short') : '' }}
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
    MatRipple
  ],
  styles: [`
    .my-card {
      background: #1f1f1f;
      color: #eaeaea;
      border-radius: 12px;
    }

    mat-card-title {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 12px;
      color: #fff;
    }

    .stats-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 14px;
    }

    .stat label {
      display: block;
      font-size: .75rem;
      opacity: .7;
      margin-bottom: 4px;
    }

    .value {
      font-size: 1rem;
      font-weight: 500;
      color: #e2e2e2;
    }

    .overdue {
      color: #ff7a7a;
    }

    .section-title {
      font-size: .85rem;
      opacity: .8;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: .5px;
    }

    .tasks-list {
      border-top: 1px solid rgba(255, 255, 255, .06);
      padding-top: 10px;
    }

    .task-item {
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, .05);
      transition: background .15s, transform .15s;
      cursor: pointer;
    }

    .task-item:hover {
      background: rgba(255, 255, 255, .05);
      transform: translateX(2px);
    }

    .title {
      font-size: .95rem;
      font-weight: 500;
    }

    .meta {
      font-size: .75rem;
      color: #909090;
      margin-top: 2px;
    }

    .empty {
      padding: 12px 0;
      font-size: .85rem;
      opacity: .75;
      text-align: center;
    }
  `]
})
export class MyWorkWidgetComponent implements OnInit {
  data: any;
  constructor(private svc: DashboardService, private auth: AuthService) {}
  async ngOnInit() {
    this.auth.user$.subscribe(async (user) => {
      const userId = user?.user?.id;
      this.data = await this.svc.getMyWork(userId);
    });
  }
}
