import {Component, NgZone, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import {CommonModule} from '@angular/common';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule],
  template: `
    <div class="callback-root">
      <mat-spinner diameter="50"></mat-spinner>
      <p>Completing sign-in...</p>
    </div>
  `,
  styles: [`
    .callback-root {
      height:100vh; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      background:#0c0c0c; color:#eaeaea;
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  constructor(private router: Router, private route: ActivatedRoute, private snack: MatSnackBar, private zone: NgZone) {}

  async ngOnInit() {
    const incomingUrl = this.route.snapshot.queryParamMap.get('url');
    const url = incomingUrl || window.location.href;

    try {
      const session = await window.electronAPI.auth.handleCallback(url);
      if (session?.user) {
        this.snack.open('Signed in successfully', 'OK', { duration: 2000 });
        if (session.user.user_metadata.full_name) {
          window.location.reload();
          await this.zone.run(() => this.router.navigate(['/tasks']));
          return;
        } else {
          await this.zone.run(() => this.router.navigate(['/auth/register']));
        }
      } else {
        throw new Error('No session received');
      }
    } catch (err: any) {
      console.error('[AuthCallback] error:', err);
      this.snack.open(err?.message || 'Authentication failed', 'OK', { duration: 4000 });
      await this.zone.run(() => this.router.navigate(['/auth/login']));
    }
  }
}
