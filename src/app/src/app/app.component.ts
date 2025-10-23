import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {IpcService} from './services/ipc.service';
import {AsyncPipe, NgClass, NgIf} from '@angular/common';
import {filter, map, merge, Subject, takeUntil} from 'rxjs';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatToolbar} from '@angular/material/toolbar';
import {MatListItem, MatNavList} from '@angular/material/list';
import {MatTooltip} from '@angular/material/tooltip';
import {MessageContainerComponent} from './components/message-container/message-container.component';
import {AuthService} from './services/auth.service';

export interface SyncStatus {
  type: 'pull' | 'remoteUpdate';
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgClass, NgIf, AsyncPipe, MatIcon, MatIconButton, MatMenu, MatMenuItem, RouterLink, MatMenuTrigger, MatSidenavContent, MatToolbar, MatSidenavContainer, MatNavList, MatListItem, RouterLinkActive, MatSidenav, MatTooltip, MessageContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') drawer!: MatSidenav;

  syncStatus$ = new Subject<any>();
  private destroy$ = new Subject<void>();
  currentSectionTitle = 'Dashboard';
  userProfile: any;

  constructor(
    private ipc: IpcService,
    private router: Router,
    private auth: AuthService
  ) {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
  }

  // ────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────
  async ngOnInit() {
    this.initSyncStatus();
    this.trackCurrentRoute();
    this.loadUserProfile().then();
    this.listenForPresence();

    // 👇 Listen for deep-link events from Electron
    await this.ipc.onDeepLink((url: string) => {
      this.handleDeepLink(url);
    });

    this.initAuth().then();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ────────────────────────────────
  // SYNC / CONNECTION STATUS
  // ────────────────────────────────
  private initSyncStatus() {
    merge(
      this.ipc.syncEvents$.pipe(
        map((e) => ({
          ...e,
          label: e.type === 'pull' ? 'Pulling updates...' : 'Remote update detected'
        }))
      ),
      this.ipc.statusEvents$.pipe(
        map((e) => ({
          type: 'status',
          online: e.online,
          label: e.online ? 'Online' : 'Offline'
        }))
      )
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => this.syncStatus$.next(s));
  }

  // ────────────────────────────────
  // ROUTING / SECTION TITLES
  // ────────────────────────────────
  private trackCurrentRoute() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        const url = event.urlAfterRedirects;
        this.currentSectionTitle = this.mapRouteToTitle(url);
      });
  }

  private mapRouteToTitle(url: string): string {
    if (url.includes('dashboard')) return '🧮 Dashboard';
    if (url.includes('projects')) return '📂 Projects';
    if (url.includes('project')) return '📂 Project View';
    if (url.includes('tasks')) return '📋 Tasks';
    if (url.includes('users')) return '👥 Users';
    if (url.includes('time-tracking')) return '⌛ Time Tracking';
    if (url.includes('files')) return '📃 Files';
    if (url.includes('team')) return '🧙‍♂️ Team';
    if (url.includes('analytics')) return '📈 Analytics';
    if (url.includes('settings')) return '⚙️ Settings';
    return 'TeamTrack';
  }

  // ────────────────────────────────
  // USER / SESSION MANAGEMENT
  // ────────────────────────────────
  async loadUserProfile() {
    // try {
    //   const { data, error } = await this.ipc.getUserProfile();
    //   if (error) throw error;
    //   this.userProfile = data;
    // } catch (err) {
    //   console.error('Failed to load profile', err);
    // }
  }

  async logout() {
    // try {
    //   await this.ipc.signOut();
    //   await this.router.navigate(['/login']);
    // } catch (err) {
    //   console.error('Logout failed', err);
    // }
  }

  // ────────────────────────────────
  // PRESENCE / REALTIME SYNC
  // ────────────────────────────────
  private listenForPresence() {
    // this.ipc.presenceEvents$
    //   ?.pipe(takeUntil(this.destroy$))
    //   .subscribe((presence) => {
    //     console.log('Presence update:', presence);
    //     // TODO: update UI / show who’s online
    //   });
  }

  // ────────────────────────────────
  // UTILITIES / HELPERS
  // ────────────────────────────────
  toggleDrawer() {
    this.drawer.toggle().then();
  }

  private async initAuth() {
    const user = await this.auth.restoreSession();
    this.userProfile = user;
    if (!user && !window.location.href.includes('auth/callback')) {
      await this.router.navigate(['/auth/login']);
    }
  }

  // 👇 Process the incoming deep link
  private async handleDeepLink(url: string) {
    if (url.startsWith('myapp://auth/callback')) {
      // Redirect Angular router to the callback route
      await this.router.navigate(['/auth/callback'], { queryParams: { url } });
    }
  }

  // ────────────────────────────────
  // CLOUD SYNC
  // ────────────────────────────────
  pullOrigin() {
    this.ipc.pullRemoteUpdates().then();
  }
}
