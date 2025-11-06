import {Component, Input, OnChanges, OnInit, ViewChild} from '@angular/core';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import {IpcService} from '../../../services/ipc.service';

@Component({
  selector: 'app-usage-chart',
  standalone: true,
  imports: [CommonModule, MatCardModule, BaseChartDirective],
  templateUrl: './app-usage.component.html',
  styleUrls: ['./app-usage.component.scss']
})
export class AppUsageComponent implements OnInit, OnChanges {
  @Input() days = 7;
  @Input() limit = 10;
  @Input() userId?: string;

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  data: any[] = [];
  barData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [{ data: [], label: 'Minutes', backgroundColor: '#90caf9' }]};
  barOptions: ChartOptions<'bar'> = { responsive: true, plugins: { legend: { labels: { color: '#eee' } } }, scales: { x: { ticks: { color: '#aaa' } }, y: { ticks: { color: '#aaa' } } } };

  constructor(private svc: IpcService) {}

  async ngOnInit() {
    await this.load();
  }

  async ngOnChanges() {
    await this.load();
  }

  async load() {
    try {
      this.data = await this.svc.appUsage(this.days, this.limit, this.userId);
      this.barData.labels = this.data.map(d => d.app);
      this.barData.datasets[0].data = this.data.map(d => d.minutes);
      setTimeout(() => this.chart?.update(), 50);
    } catch (err) {
      console.error('App usage load failed', err);
    }
  }
}
