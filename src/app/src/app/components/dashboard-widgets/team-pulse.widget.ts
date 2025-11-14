import { Component, OnInit } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {NgClass, NgForOf, NgIf} from '@angular/common';
import {BaseChartDirective} from 'ng2-charts';
import {DashboardService} from '../../services/dashboard.service';
import {MatOption, MatRipple} from '@angular/material/core';
import {IpcService} from '../../services/ipc.service';
import {FormsModule} from '@angular/forms';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatSelect} from '@angular/material/select';
import {AuthService} from '../../services/auth.service';

@Component({
  selector: 'app-team-pulse-widget',
  standalone: true,
  template: `
    <mat-card class="pulse-card">

      <mat-card-title>Team Pulse</mat-card-title>

      <mat-card-content>

        <!-- TEAM SELECT -->
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Team</mat-label>
          <mat-select [(ngModel)]="teamId" (selectionChange)="onTeamChange($event.value)">
            <mat-option *ngFor="let t of teams" [value]="t.id">
              {{ t.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- TEAM SENTIMENT -->
        <div class="sentiment" *ngIf="sentiment">
      <span class="chip" [class]="'chip ' + sentiment.class">
        {{ sentiment.icon }} {{ sentiment.label }}
      </span>
        </div>

        <!-- ONLINE USERS -->
        <div class="online">
          <div *ngFor="let u of online" class="user" matRipple>
            <div class="avatar">{{ initials(u.user_id) }}</div>

            <div class="presence" [ngClass]="presenceClass(u.last_seen)"></div>

            <div class="info">
              <div class="name">{{ getUsername(u.user_id) }}</div>
              <div class="active-text">{{ lastSeen(u.last_seen) }}</div>
            </div>
          </div>
        </div>

        <!-- THROUGHPUT CHART -->
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
    MatRipple,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    FormsModule,
    NgClass,
    NgIf
  ],
  styles: [`
    .pulse-card {
      background: #1f1f1f;
      color: #eaeaea;
      border-radius: 12px;
    }

    .sentiment {
      margin-bottom: 10px;
    }

    .chip {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      display: inline-block;
      font-weight: 600;
    }

    .chip.busy {
      background: #662727;
      color: #ff9b9b;
    }

    .chip.flow {
      background: #4d3a11;
      color: #ffd86b;
    }

    .chip.healthy {
      background: #204f2b;
      color: #81f7b1;
    }

    .chip.quiet {
      background: #2e2e2e;
      color: #b9b9b9;
    }

    /* USER STATUS LIST */
    .online {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 14px;
    }

    .user {
      display: flex;
      gap: 10px;
      align-items: center;
      background: #2a2a2a;
      padding: 6px 10px;
      border-radius: 10px;
      position: relative;
    }

    .avatar {
      background: #3a3a3a;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: .8rem;
      color: #fff;
    }

    .info {
      display: flex;
      flex-direction: column;
    }

    .name {
      font-size: 0.85rem;
    }

    .active-text {
      font-size: 0.7rem;
      opacity: .6;
    }

    /* PRESENCE DOT */
    .presence {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      position: absolute;
      left: 26px;
      bottom: 2px;
      border: 2px solid #1f1f1f;
    }

    .presence.online {
      background: #5edc74;
    }

    .presence.idle {
      background: #e6d44c;
    }

    .presence.offline {
      background: #666;
    }

    /* CHART */
    .chart-wrap {
      height: 200px;
      padding: 4px;
      border-top: 1px solid rgba(255, 255, 255, .06);
    }

    .w-100 {
      width: 100%;
    }
  `]
})
export class TeamPulseWidgetComponent implements OnInit {
  online: any[] = [];
  teams: any[] = [];
  users: any[] = [];
  teamId = '';

  sentiment: { label: string; icon: string; class: string } | null = null;

  chartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      { data: [], label: 'Completed', backgroundColor: '#5edc74' },
      { data: [], label: 'Created', backgroundColor: '#42a5f5' }
    ]
  };

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: {}, y: { beginAtZero: true } }
  };

  constructor(
    private svc: DashboardService,
    private ipc: IpcService,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    this.teams = await this.ipc.listTeams();
    this.users = await this.auth.listLocalUsers();
  }

  async onTeamChange(id: string) {
    this.teamId = id;
    await this.getTeamPulse(id);
  }

  async getTeamPulse(id: string) {
    if (!id) return;

    const r = await this.svc.getTeamPulse(id);
    const throughput = r.throughput || [];

    this.online = r.online || [];
    console.log(this.online)

    // Chart
    this.chartData = {
      labels: throughput.map((x:any) => x.day),
      datasets: [
        { data: throughput.map((x:any) => x.completed), label: 'Completed', backgroundColor: '#5edc74' },
        { data: throughput.map((x:any) => x.created), label: 'Created', backgroundColor: '#42a5f5' }
      ]
    };

    // Sentiment
    this.sentiment = this.getSentiment(throughput);
  }

  /** Determine team pulse sentiment */
  getSentiment(days: any[]) {
    if (!days.length) return null;

    const last = days[days.length - 1];

    if (last.completed > last.created * 1.5)
      return { label: 'Healthy', icon: '🟢', class: 'healthy' };

    if (last.created > last.completed * 1.5)
      return { label: 'Busy', icon: '🔥', class: 'busy' };

    if (last.completed > last.created)
      return { label: 'High Flow', icon: '⚡', class: 'flow' };

    return { label: 'Quiet', icon: '💤', class: 'quiet' };
  }

  /** Helpers */
  getUsername(id: string) {
    return this.users.find(u => u.id === id)?.full_name || id;
  }

  initials(id: string) {
    const u = this.users.find(u => u.id === id);
    if (!u) return '?';
    return (u.full_name || u.username || '?')
      .split(' ')
      .map((x:any) => x[0])
      .join('')
      .toUpperCase();
  }

  /** Presence classification */
  presenceClass(lastActive: number) {
    const minutes = (Date.now() - lastActive) / 1000 / 60;

    if (minutes < 3) return 'online';
    if (minutes < 10) return 'idle';
    return 'offline';
  }

  lastSeen(ts: number) {
    const min = Math.floor((Date.now() - ts) / 1000 / 60);
    if (min < 2) return 'Online';
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
  }
}
