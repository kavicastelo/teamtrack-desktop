import {Component, OnDestroy, OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {IpcService} from './services/ipc.service';
import {AsyncPipe, NgClass, NgIf} from '@angular/common';
import {map, merge, Subject, takeUntil} from 'rxjs';

export interface SyncStatus {
  type: 'pull' | 'remoteUpdate';
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgClass, NgIf, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
  syncStatus$ = new Subject<any>();
  private destroy$ = new Subject<void>();

  constructor(private ipc: IpcService) {}

  ngOnInit() {
    // merge sync events (pull/remoteUpdate) with online/offline
    merge(
      this.ipc.syncEvents$.pipe(map((e) => ({ ...e, label: e.type }))),
      this.ipc.statusEvents$.pipe(
        map((e) => ({ type: 'status', online: e.online, label: e.online ? 'Online' : 'Offline' }))
      )
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => this.syncStatus$.next(s));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
