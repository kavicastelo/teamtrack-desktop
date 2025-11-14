import {Component, OnChanges, OnInit} from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {NgClass, NgForOf, NgIf} from '@angular/common';
import {MatOption, MatRipple} from '@angular/material/core';
import {IpcService} from '../../services/ipc.service';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatSelect} from '@angular/material/select';
import {FormsModule} from '@angular/forms';
import {AuthService} from '../../services/auth.service';

@Component({
  selector: 'app-heatmap-widget',
  standalone: true,
  template: `
    <mat-card class="heatmap-card">
      <mat-card-title>Project Heatmap</mat-card-title>

      <!-- TEAM SELECTOR -->
      <mat-form-field appearance="fill" class="team-select">
        <mat-label>Select Team</mat-label>
        <mat-select (selectionChange)="onTeamChange($event.value)">
          <mat-option [value]="null">All Teams</mat-option>
          <mat-option *ngFor="let t of teams" [value]="t.id">
            {{ t.name }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-card-content>

        <div class="grid">
          <div *ngFor="let p of projects" class="project" matRipple>

            <!-- HEADER -->
            <div class="header">
              <div class="name-row">
                <span class="name">{{ p.project_name }}</span>

                <span class="chip team-chip" *ngIf="p.team_name">
              {{ p.team_name }}
            </span>
              </div>

              <div class="chip heat-badge" [ngClass]="heatBadgeClass(p)">
                {{ heatPct(p) }}%
              </div>
            </div>

            <!-- STATUS CHIPS -->
            <div class="chips">
          <span class="chip overdue-chip" *ngIf="p.overdue_count > 0">
            🔥 {{ p.overdue_count }} overdue
          </span>

              <span class="chip spike-chip" *ngIf="p.week_spike">
            ⚡ Spike
          </span>

              <span class="chip stable-chip" *ngIf="!p.overdue_count && !p.week_spike">
            🟢 Stable
          </span>
            </div>

            <!-- COUNTS -->
            <div class="counts">
              <span class="open">Open: {{ p.open_count }}</span>
              <span class="divider">•</span>
              <span class="overdue">Overdue: {{ p.overdue_count }}</span>
            </div>

            <!-- WEEKLY HEATLINE -->
            <div class="week-line">
              <div
                *ngFor="let d of p.activity_heat"
                class="day"
                [style.opacity]="d / 10"
                [class.hot]="d >= 7"
                [class.warm]="d >= 4 && d < 7"
                [class.cool]="d < 4"
              ></div>
            </div>

            <!-- MAIN HEAT BAR -->
            <div class="bar">
              <div
                class="fill"
                [style.width.%]="heatPct(p)"
                [ngClass]="{
              low: heatPct(p) < 30,
              medium: heatPct(p) >= 30 && heatPct(p) < 60,
              high: heatPct(p) >= 60
            }"
              ></div>
            </div>

          </div>
          <div *ngIf="!projects.length || projects.length === 0">
            <div class="no-projects">No projects found</div>
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
    MatRipple,
    MatFormField,
    MatSelect,
    MatOption,
    FormsModule,
    MatLabel,
    NgClass,
    NgIf
  ],
  styles: [`
    .heatmap-card {
      background: #1e1e1e;
      color: #eaeaea;
      border-radius: 12px;
    }

    .team-select {
      width: 100%;
      margin-bottom: 12px;
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

    /* GRID */
    .grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* PROJECT BOX */
    .project {
      background: #262626;
      padding: 14px 16px;
      border-radius: 10px;
      transition: 0.2s;
      cursor: pointer;
    }

    .project:hover {
      background: #303030;
      transform: translateY(-2px);
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
    }

    .name-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .name {
      font-size: 1rem;
      font-weight: 500;
    }

    /* CHIPS */
    .chip {
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      letter-spacing: .2px;
      text-transform: uppercase;
      white-space: nowrap;
      font-weight: 600;
    }

    .team-chip {
      background: #333;
      color: #b3daf7;
    }

    .overdue-chip {
      background: #ff4b4b22;
      color: #ff7d7d;
    }

    .spike-chip {
      background: #ffc13b22;
      color: #ffc13b;
    }

    .stable-chip {
      background: #2b633422;
      color: #7affb0;
    }

    .chips {
      display: flex;
      gap: 6px;
      margin: 8px 0 4px;
    }

    /* HEAT BADGE */
    .heat-badge {
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .heat-badge.low {
      background: #355f93;
      color: #bcdcff;
    }

    .heat-badge.medium {
      background: #8a6a14;
      color: #ffe8a9;
    }

    .heat-badge.high {
      background: #7a1d1d;
      color: #ffb9b9;
    }

    /* COUNTS */
    .counts {
      font-size: .8rem;
      color: #bfbfbf;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .divider {
      opacity: .3;
    }

    .overdue {
      color: #ff7a7a;
    }

    /* WEEK ACTIVITY STRIP */
    .week-line {
      display: flex;
      gap: 3px;
      margin: 8px 0;
    }

    .day {
      width: 12px;
      height: 8px;
      border-radius: 3px;
      background: #ffffff33;
    }

    .day.cool {
      background: #4e4e4e;
    }

    .day.warm {
      background: #ffad4d;
    }

    .day.hot {
      background: #ff5a5a;
    }

    /* MAIN HEAT BAR */
    .bar {
      background: #151515;
      height: 10px;
      border-radius: 6px;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      border-radius: 6px;
      transition: width .3s ease;
    }

    .low {
      background: #42a5f5;
    }

    .medium {
      background: #ffca28;
    }

    .high {
      background: #ef5350;
    }

    .no-projects {
      text-align: center;
      margin-top: 16px;
      color: #b0b0b0;
      font-size: .9rem;
    }
  `]
})
export class HeatmapWidgetComponent implements OnInit {
  user?: any;
  projects: any[] = [];
  teams: any[] = [];
  constructor(private svc: DashboardService, private ipc: IpcService, private auth: AuthService) {}
  async ngOnInit() {
    this.user = await this.auth.user();
    this.teams = await this.ipc.userTeams(this.user?.id);
    this.projects = await this.svc.getProjectHeatmap(30);
  }
  async onTeamChange(event: any) {
    this.projects = await this.svc.getProjectHeatmap(30, event);
  }
  heatPct(p: any) {
    const open = p.open_count || 0;
    const overdue = p.overdue_count || 0;
    const completed = p.completed_recent || 0;

    // tunable weights
    const W_OVERDUE = 2.5;
    const W_OPEN = 1;
    const W_DONE = -0.5;

    let score = overdue * W_OVERDUE + open * W_OPEN + completed * W_DONE;

    score = Math.max(0, Math.min(100, score));

    return Math.round(score);
  }
  heatBadgeClass(p: any) {
    const pct = this.heatPct(p);
    if (pct >= 60) return "high";
    if (pct >= 30) return "medium";
    return "low";
  }
}
