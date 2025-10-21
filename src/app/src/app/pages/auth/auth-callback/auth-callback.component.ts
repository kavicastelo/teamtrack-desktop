import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
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
  constructor(private router: Router, private snack: MatSnackBar) {}

  async ngOnInit() {
    const url = window.location.href;
    try {
      const session = await window.electronAPI.auth.handleCallback(url);
      if (session?.user) {
        this.snack.open('Signed in successfully', 'OK', { duration: 2000 });
        this.router.navigate(['/tasks'] as any).then();
      } else {
        throw new Error('No session received');
      }
    } catch (err: any) {
      console.error(err);
      this.snack.open(err?.message || 'Authentication failed', 'OK', { duration: 4000 });
      this.router.navigate(['/auth/login'] as any).then();
    }
  }
}
