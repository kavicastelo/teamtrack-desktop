import {Component, Input, OnChanges, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import {IpcService} from '../../../services/ipc.service';
import {MatTooltip} from '@angular/material/tooltip';

@Component({
  selector: 'app-user-activity-heatmap',
  standalone: true,
  imports: [CommonModule, MatTooltip],
  templateUrl: './user-activity-heatmap.component.html',
  styleUrls: ['./user-activity-heatmap.component.scss']
})
export class UserActivityHeatmapComponent implements OnInit, OnChanges {
  @Input() userId?: string; // optional, if omitted aggregate across all users
  @Input() days = 7;
  @Input() perUserGrid = false;

  data: any = { totalsByHour: {}, weekdayHourGrid: undefined, max: 0, since: 0 };
  loading = true;

  // for grid rendering
  hours = Array.from({ length: 24 }, (_, i) => i);
  weekdays = [
    { id: '0', name: 'Sun' },
    { id: '1', name: 'Mon' },
    { id: '2', name: 'Tue' },
    { id: '3', name: 'Wed' },
    { id: '4', name: 'Thu' },
    { id: '5', name: 'Fri' },
    { id: '6', name: 'Sat' },
  ];

  constructor(private svc: IpcService) {}

  async ngOnInit() {
    await this.load();
  }

  async ngOnChanges() {
    await this.load();
  }

  async load() {
    this.loading = true;
    try {
      this.data = await this.svc.userActivityHeatMap(this.userId, this.days, this.perUserGrid);
    } catch (err) {
      console.error('Heatmap load error', err);
      this.data = { totalsByHour: {}, weekdayHourGrid: undefined, max: 0, since: Date.now() };
    } finally {
      this.loading = false;
    }
  }

  // returns opacity 0..1 based on value / max
  opacityFor(value: number) {
    if (!this.data || !this.data.max) return 0.06;
    const v = (value || 0) / this.data.max;
    return Math.min(1, Math.max(0.05, v * 0.95));
  }

  // human-friendly tooltip
  tooltipFor(weekday: string, hour: number) {
    const count = this.data.weekdayHourGrid?.[weekday]?.[hour] || 0;
    return `${this.weekdays[parseInt(weekday, 10)].name} ${hour}:00 — ${count} events`;
  }
}
