import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatTableModule } from '@angular/material/table';
import {IpcService} from '../../../services/ipc.service';
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartOptions} from 'chart.js';
import {
  UserActivityHeatmapComponent
} from '../../../components/dashboard-widgets/user-activity-heatmap/user-activity-heatmap.component';
import {AppUsageComponent} from '../../../components/dashboard-widgets/app-usage/app-usage.component';
import {AuthService} from '../../../services/auth.service';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {FormsModule} from '@angular/forms';
import {MatOption, MatSelect} from '@angular/material/select';
import {MatButton} from '@angular/material/button';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatGridListModule, MatTableModule, BaseChartDirective,
    UserActivityHeatmapComponent, AppUsageComponent, MatFormField, MatLabel, MatSelect, MatOption, FormsModule, MatButton],
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss']
})
export class AnalyticsDashboardComponent implements OnInit {
  private ipc = inject(IpcService);
  private auth = inject(AuthService);
  loading = signal(true);

  orgSummary: any = {};
  topPerformers: any[] = [];
  throughput: any[] = [];
  teamUtilization: any[] = [];
  projectLoad: any[] = [];
  focusHeatmap: any[] = [];

  @ViewChild('throughputChart') throughputChart?: BaseChartDirective;
  @ViewChild('teamChart') teamChart?: BaseChartDirective;
  @ViewChild('projectChart') projectChart?: BaseChartDirective;

  // Initialize chart configs empty
  lineChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  barChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  stackedBarChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };

  users: any[] = [];
  selectedUserId: any;

  private animationBase = {
    duration: 800,
    easing: 'easeOutQuart'
  };

  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    animation: {
      duration: this.animationBase.duration,
      easing: "easeOutQuart",
    },
    plugins: { legend: { labels: { color: '#eee' } } },
    scales: { x: { ticks: { color: '#aaa' } }, y: { ticks: { color: '#aaa' } } }
  };
  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    animation: {
      duration: this.animationBase.duration,
      easing: "easeOutQuart",
    },
    plugins: { legend: { labels: { color: '#eee' } } },
    scales: { x: { ticks: { color: '#aaa' } }, y: { ticks: { color: '#aaa' } } }
  };
  stackedBarChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    animation: {
      duration: this.animationBase.duration,
      easing: "easeOutQuart",
    },
    plugins: { legend: { labels: { color: '#eee' } } },
    scales: {
      x: { stacked: true, ticks: { color: '#aaa' } },
      y: { stacked: true, ticks: { color: '#aaa' } }
    }
  };

  async ngOnInit() {
    await this.loadData();
    await this.loadUsers();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const [
        orgSummary,
        throughput,
        topPerformers,
        teamUtilization,
        projectLoad,
        focusHeatmap
      ] = await Promise.all([
        this.ipc.orgSummary(),
        this.ipc.taskThroughPut(),
        this.ipc.topPerformance(),
        this.ipc.teamUtilization(),
        this.ipc.projectLoad(),
        this.ipc.focusHeatmap()
      ]);

      this.orgSummary = orgSummary;
      this.throughput = throughput;
      this.topPerformers = topPerformers;
      this.teamUtilization = teamUtilization;
      this.projectLoad = projectLoad;
      this.focusHeatmap = focusHeatmap;

      // Build chart data dynamically AFTER data is fetched
      this.populateCharts();

    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      this.loading.set(false);
    }
  }

  populateCharts() {
    // Throughput (line)
    this.lineChartData = {
      labels: this.throughput.map(d => d.day),
      datasets: [{
        data: this.throughput.map(d => d.completed),
        label: 'Tasks Completed',
        fill: true,
        borderColor: '#90caf9',
        backgroundColor: 'rgba(144,202,249,0.1)',
        tension: 0.3
      }]
    };
    this.throughputChart?.update('active');

    // Team utilization (bar)
    this.barChartData = {
      labels: this.teamUtilization.map(d => d.team_name),
      datasets: [{
        data: this.teamUtilization.map(d => d.utilization_pct),
        label: 'Utilization %',
        backgroundColor: '#81c784'
      }]
    };
    this.teamChart?.update('active');

    // Project load (stacked)
    this.stackedBarChartData = {
      labels: this.projectLoad.map(d => d.project_name),
      datasets: [
        { data: this.projectLoad.map(d => d.open_count), label: 'Open', backgroundColor: '#ffb74d' },
        { data: this.projectLoad.map(d => d.done_count), label: 'Done', backgroundColor: '#81c784' },
        { data: this.projectLoad.map(d => d.overdue_count), label: 'Overdue', backgroundColor: '#e57373' }
      ]
    };
    this.projectChart?.update('active');
  }

  async loadUsers() {
    this.users = await this.auth.listLocalUsers();
  }

  async forceRefreshSummaries() {
    await this.ipc.forceRefreshSummaries();
    await this.loadData();
  }
}
