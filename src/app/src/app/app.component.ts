import {Component, effect, OnDestroy, OnInit, ViewChild} from '@angular/core';
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
import {ProfileComponent} from './pages/profile/profile/profile.component';
import {MatDialog} from '@angular/material/dialog';

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
  isAdmin = false;

  constructor(
    private ipc: IpcService,
    private router: Router,
    private auth: AuthService,
    private dialog: MatDialog
  ) {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    effect(() => {
      const session = this.auth.session();
      const user = this.auth.user();

      setTimeout(() => {
        if (!session && !window.location.href.includes('auth/callback')) {
          this.router.navigate(['/auth/login']).then();
          return;
        } else {
          this.router.navigate(['/tasks']).then();
          return;
        }
      }, 800);

      if (user) {
        this.userProfile = user;
        this.adminCheck().then();
      }
    });
  }

  // ────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────
  async ngOnInit() {
    this.initSyncStatus();
    this.trackCurrentRoute();
    this.listenForPresence();

    await this.ipc.onDeepLink((url: string) => {
      this.handleDeepLink(url);
    });

    // Initialize auth state
    await this.auth.init();
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

  async logout() {
    try {
      await this.auth.signOut();
      this.userProfile = null;
      await this.router.navigate(['/auth/login']);
    } catch (err) {
      console.error('Logout failed', err);
    }
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

  // ────────────────────────────────
  // AUTH
  // ────────────────────────────────
  private async adminCheck() {
    this.isAdmin = this.userProfile.role === 'admin';

    if (this.isAdmin) {
      localStorage.setItem('isAdmin', this.isAdmin.toString());
    } else {
      localStorage.removeItem('isAdmin');
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

  // ────────────────────────────────
  // OPEN PROFILE
  // ────────────────────────────────
  openUserProfile() {
    const user = {
      id: this.userProfile.id,
      full_name: this.userProfile.full_name,
      email: this.userProfile.email,
      role: this.userProfile.role,
      avatar_url: this.userProfile.avatar_url
    }
    const ref = this.dialog.open(ProfileComponent, {
      width: '500px',
      data: { user: user, currentUserId: this.userProfile.id }
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        // refresh
      }
    });
  }
}
