import { Component } from '@angular/core';
import {MyWorkWidgetComponent} from '../../../components/dashboard-widgets/my-work.widget';
import {TeamPulseWidgetComponent} from '../../../components/dashboard-widgets/team-pulse.widget';
import {TimelineWidgetComponent} from '../../../components/dashboard-widgets/timeline.widget';
import {HeatmapWidgetComponent} from '../../../components/dashboard-widgets/heatmap.widget';

@Component({
  selector: 'app-dashboard',
  imports: [
    MyWorkWidgetComponent,
    TeamPulseWidgetComponent,
    TimelineWidgetComponent,
    HeatmapWidgetComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  standalone: true
})
export class DashboardComponent {

}
