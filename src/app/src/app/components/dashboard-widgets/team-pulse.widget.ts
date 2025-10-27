import { Component, OnInit } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {NgForOf} from '@angular/common';
import {BaseChartDirective} from 'ng2-charts';
import {DashboardService} from '../../services/dashboard.service';
import {MatRipple} from '@angular/material/core';

@Component({
  selector: 'app-team-pulse-widget',
  standalone: true,
  template: `
    <mat-card class="pulse-card">
      <mat-card-title>Team Pulse</mat-card-title>
      <mat-card-content>

        <div class="online">
          <div *ngFor="let u of online" class="user" matRipple>
            <div class="status-dot"></div>
            <div class="user-label">{{ u.user_id }}</div>
          </div>
        </div>

        <div class="chart-wrap">
          <canvas baseChart
                  [data]="chartData"
                  [options]="chartOptions"
                  [type]="'bar'">
          </canvas>
        </div>

      </mat-card-content>
    </mat-card>
  `,
  imports: [
    MatCard,
    MatCardTitle,
    MatCardContent,
    NgForOf,
    BaseChartDirective,
    MatRipple
  ],
  styles: [`
    .pulse-card {
      background: #1f1f1f;
      color: #eaeaea;
      border-radius: 12px;
    }

    mat-card-title {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 12px;
      color: #ffffff;
    }

    .online {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .user {
      display: flex;
      gap: 6px;
      align-items: center;
      background: #2a2a2a;
      padding: 2px 10px;
      border-radius: 14px;
      transition: background .15s ease;
      cursor: pointer;
      font-size: .8rem;
    }

    .user:hover {
      background: #323232;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      min-width: 8px;
      border-radius: 50%;
      background: #5edc74;
      box-shadow: 0 0 6px #44cc60;
    }

    .chart-wrap {
      height: 175px;
      padding: 4px;
      border-top: 1px solid rgba(255,255,255,.06);
    }

    .user-label {
      white-space: nowrap;
    }
  `]
})
export class TeamPulseWidgetComponent implements OnInit {
  online: any[] = [];
  chartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [{ data: [], label: 'Completed' }]};
  chartOptions = { responsive: true, maintainAspectRatio: false };

  constructor(private svc: DashboardService) {}
  async ngOnInit() {
    const teamId = ''; // resolve current user's team or select in UI
    const r = await this.svc.getTeamPulse(teamId);
    this.online = r.online || [];
    const throughput = r.throughput || [];
    this.chartData.labels = throughput.map((x:any) => x.day);
    this.chartData.datasets[0].data = throughput.map((x:any) => x.completed);
  }
}
