import { Component, OnInit } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {NgForOf} from '@angular/common';
import {MatRipple} from '@angular/material/core';

@Component({
  selector: 'app-heatmap-widget',
  standalone: true,
  template: `
    <mat-card class="heatmap-card">
      <mat-card-title>Project Heatmap</mat-card-title>
      <mat-card-content>
        <div class="grid">
          <div *ngFor="let p of projects" class="project" matRipple>
            <div class="header">
              <div class="name">{{ p.project_name }}</div>
              <div class="counts">
                <span class="open">Open: {{ p.open_count }}</span>
                <span class="divider">•</span>
                <span class="overdue">Overdue: {{ p.overdue_count }}</span>
              </div>
            </div>

            <div class="bar">
              <div
                [style.width.%]="heatPct(p)"
                [class.low]="heatPct(p) < 30"
                [class.medium]="heatPct(p) >= 30 && heatPct(p) < 60"
                [class.high]="heatPct(p) >= 60"
                class="fill">
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
    MatRipple
  ],
  styles: [`
    :host {
      display: block;
    }

    .heatmap-card {
      background: #1e1e1e;
      color: #eaeaea;
      border-radius: 12px;
      padding-bottom: 8px;
    }

    mat-card-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 12px;
      color: #ffffff;
    }

    .grid {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .project {
      background: #2a2a2a;
      padding: 10px 14px;
      border-radius: 8px;
      transition: transform .15s ease, background .2s;
      cursor: pointer;
    }

    .project:hover {
      background: #323232;
      transform: translateY(-2px);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .name {
      font-size: .95rem;
      font-weight: 500;
      color: #e9e9e9;
    }

    .counts {
      font-size: .8rem;
      color: #bfbfbf;
    }

    .divider {
      margin: 0 4px;
      opacity: .5;
    }

    .overdue {
      color: #ff7a7a;
      font-weight: 600;
    }

    .bar {
      background: #151515;
      height: 10px;
      border-radius: 6px;
      margin-top: 8px;
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
  `]
})
export class HeatmapWidgetComponent implements OnInit {
  projects: any[] = [];
  constructor(private svc: DashboardService) {}
  async ngOnInit() {
    this.projects = await this.svc.getProjectHeatmap(30);
  }
  heatPct(p: any) {
    const total = p.open_count + p.overdue_count || 1;
    return Math.min(100, Math.round((p.overdue_count / total) * 100));
  }
}
