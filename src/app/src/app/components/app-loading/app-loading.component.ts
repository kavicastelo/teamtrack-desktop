import {Component, Input} from '@angular/core';
import {NgIf} from '@angular/common';
import {MatProgressSpinner} from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading',
  imports: [
    NgIf,
    MatProgressSpinner
  ],
  templateUrl: './app-loading.component.html',
  styleUrl: './app-loading.component.scss',
  standalone: true
})
export class AppLoadingComponent {
  @Input() message: string = 'Loading...';
  @Input() visible: boolean = false;
}
