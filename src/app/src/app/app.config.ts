import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {provideCharts, withDefaultRegisterables} from 'ng2-charts';
import {provideNativeDateAdapter} from '@angular/material/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes),
    provideCharts(withDefaultRegisterables()),
    provideNativeDateAdapter()
  ]
};
