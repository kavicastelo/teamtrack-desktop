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
          <div *ngFor="let item of items" class="entry" matRipple>
            <div class="bullet"></div>
            <div class="line"></div>

            <div class="content">
              <div class="row">
                <div class="time">
                  {{ item.ts | date:'short' }}
                </div>

                <div class="kind" [ngClass]="item.kind.toLowerCase()">
                  {{ item.kind }}
                </div>
              </div>

              <div class="desc">
                {{ item.action || (item.payload?.title || item.payload) }}
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

    mat-card-title {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 10px;
      color: #ffffff;
    }

    .timeline {
      position: relative;
    }

    .entry {
      display: flex;
      position: relative;
      padding: 12px 0 12px 24px;
      transition: background .15s ease;
      cursor: pointer;
    }

    .entry:hover {
      background: rgba(255,255,255,0.04);
    }

    .bullet {
      position: absolute;
      left: 6px;
      top: 21px;
      width: 10px;
      height: 10px;
      background: #64b5f6;
      border-radius: 50%;
      z-index: 2;
      box-shadow: 0 0 4px #64b5f6;
    }

    .line {
      position: absolute;
      left: 10px;
      top: 0;
      width: 2px;
      height: 100%;
      background: rgba(255,255,255,.06);
      z-index: 1;
    }

    .content {
      flex: 1;
      margin-left: 16px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 2px;
    }

    .time {
      width: 140px;
      font-size: .8rem;
      color: #bdbdbd;
      white-space: nowrap;
    }

    .kind {
      font-size: .7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: .4px;
      background: #333;
      color: #ddd;
    }

    /* Optional color coding by kind */
    .kind.update {
      background: #3a3f55;
      color: #90caf9;
    }

    .kind.create {
      background: #35493f;
      color: #81c784;
    }

    .kind.delete {
      background: #4a2f33;
      color: #e57373;
    }

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
  userId: string = '';
  constructor(private svc: DashboardService, private auth: AuthService) {}
  async ngOnInit() {
    this.userId = this.auth.user()?.user?.id || 'user';
    this.items = await this.svc.getActivityTimeByUser(this.userId, 100);
  }
}
