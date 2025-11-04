import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import {TimeTrackingService} from '../../../services/time-tracking.service';
import {AuthService} from '../../../services/auth.service';
import {BaseChartDirective} from 'ng2-charts';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-time-tracking-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, BaseChartDirective, MatIcon],
  templateUrl: './time-tracking-dashboard.component.html',
  styleUrl: './time-tracking-dashboard.component.scss'
})
export class TimeTrackingDashboardComponent implements OnInit {
  heartbeats: any[] = [];
  aggregatedTime: any[] = [];
  dailyActivity: any[] = [];

  pieChartData: ChartData<'pie'> = { labels: [], datasets: [{ data: [] }] };
  pieChartOptions: ChartConfiguration<"pie" & "pie", Array<number>, unknown>["options"] = { responsive: true };

  lineChartData: ChartData<'line'> = { labels: [], datasets: [{ data: [], label: 'Daily Time (hours)' }] };
  lineChartOptions: ChartConfiguration<"line", Array<number>, unknown>['options'] = { responsive: true };

  displayedColumns: string[] = ['timestamp', 'app', 'title', 'duration_ms'];
  dataSource: any[] = [];

  currentUserId: string|null = '';

  private startDate: number;
  private endDate: number;

  constructor(private timeTrackingService: TimeTrackingService, private auth: AuthService) {
    const now = Date.now();
    this.endDate = now;
    this.startDate = now - 7 * 24 * 60 * 60 * 1000; // Last 7 days
  }

  async ngOnInit() {
    this.currentUserId = this.auth.user()?.user?.id || '';
    try {
      this.heartbeats = await this.timeTrackingService.getHeartbeats(this.currentUserId, this.startDate, this.endDate);
      this.dataSource = this.heartbeats.slice(0, 10); // Top 10 recent

      this.aggregatedTime = await this.timeTrackingService.getAggregatedTime(this.currentUserId, this.startDate, this.endDate);
      this.pieChartData.labels = this.aggregatedTime.map(item => `${item.app || 'Unknown'} (${item.platform})`);
      this.pieChartData.datasets[0].data = this.aggregatedTime.map(item => item.total_ms / 3600000); // ms to hours

      this.dailyActivity = await this.timeTrackingService.getDailyActivity(this.currentUserId, this.startDate, this.endDate);
      this.lineChartData.labels = this.dailyActivity.map(item => item.day);
      this.lineChartData.datasets[0].data = this.dailyActivity.map(item => item.total_ms / 3600000); // ms to hours
    } catch (error) {
      console.error('Error fetching time tracking data:', error);
    }

    this.pieChartOptions = {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#e0e0e0' },
        },
        tooltip: {
          backgroundColor: '#333',
          titleColor: '#fff',
          bodyColor: '#eee'
        }
      }
    };

    this.lineChartOptions = {
      responsive: true,
      scales: {
        x: {
          ticks: { color: '#bbb' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#bbb' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      },
      plugins: {
        legend: { labels: { color: '#e0e0e0' } },
        tooltip: {
          backgroundColor: '#333',
          titleColor: '#fff',
          bodyColor: '#eee'
        }
      }
    };

    this.pieChartData = {
      labels: this.aggregatedTime.map(item => `${item.app || 'Unknown'} (${item.platform})`),
      datasets: [
        {
          data: this.aggregatedTime.map(item => item.total_ms / 3600000),
          backgroundColor: this.generatePieColors(this.aggregatedTime.length),
          borderColor: '#1e1e1e',
          borderWidth: 2,
          hoverOffset: 10
        }
      ]
    };
  }

  formatDuration(ms: number): string {
    if (ms == null || isNaN(ms) || ms < 1000) return '0s';

    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (hours > 0) {
      // Show hours + minutes only
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      // Show minutes + seconds
      return `${minutes}m ${seconds}s`;
    } else {
      // Show seconds only
      return `${seconds}s`;
    }
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  private generatePieColors(count: number): string[] {
    const baseColors = [
      '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
      '#9C27B0', '#00BCD4', '#8BC34A', '#FFC107',
      '#F44336', '#03A9F4', '#CDDC39', '#FF5722',
      '#009688', '#673AB7', '#FFEB3B'
    ];

    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      // Reuse base colors if needed, slightly tweak brightness for variety
      const base = baseColors[i % baseColors.length];
      const adjusted = this.adjustColorBrightness(base, (i * 10) % 40 - 20);
      colors.push(adjusted);
    }
    return colors;
  }

  private adjustColorBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `rgb(${r}, ${g}, ${b})`;
  }
}
