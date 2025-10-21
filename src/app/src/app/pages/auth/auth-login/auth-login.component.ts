import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
  <div class="auth-root dark-theme">
    <mat-card class="card">
      <h1 class="title">Sign in</h1>

      <form [formGroup]="emailForm" (ngSubmit)="sendMagicLink()">
        <mat-form-field appearance="fill" class="full">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" required />
          <mat-error *ngIf="emailForm.controls['email'].hasError('required')">Email required</mat-error>
          <mat-error *ngIf="emailForm.controls['email'].hasError('email')">Enter a valid email</mat-error>
        </mat-form-field>

        <button mat-flat-button color="primary" class="full" [disabled]="emailForm.invalid || sending">
          {{ sending ? 'Sending...' : 'Send magic link' }}
        </button>
      </form>

      <div class="separator">OR</div>

      <button mat-stroked-button class="full google" (click)="signInWithGoogle()" [disabled]="googleStarted">
        <mat-icon>login</mat-icon>
        Sign in with Google
      </button>

      <div class="note">
        Invited? Click the invite link from your email to open the Register screen in the app.
      </div>

      <div class="footer">
        <a class="download" (click)="openDownloadPage()">Download app</a>
      </div>
    </mat-card>
  </div>
  `,
  styles: [`
    :host { display:block; height:100%; }
    .auth-root { height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { width:420px; padding:24px; border-radius:12px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); background: linear-gradient(180deg, rgba(20,20,20,0.95), rgba(10,10,10,0.9)); color: #eaeaea; }
    .title { margin: 0 0 12px 0; font-weight:600; font-size:22px; color:#fff; }
    .full { width:100%; margin-top:12px; display:block; }
    .separator { text-align:center; margin:16px 0; color:#9e9e9e; letter-spacing:2px; font-size:12px;}
    .google { margin-bottom:6px; }
    .note { margin-top:8px; font-size:13px; color:#bdbdbd; }
    .footer { margin-top:12px; text-align:center; }
    .download { color:#90caf9; cursor:pointer; text-decoration:underline; }
    .mat-form-field-appearance-fill .mat-form-field-flex { background: rgba(255,255,255,0.02); }
    button[mat-stroked-button] { border-color: rgba(255,255,255,0.08); color: #fff; }
  `]
})
export class AuthLoginComponent {
  sending = false;
  googleStarted = false;
  emailForm: any;

  constructor(private fb: FormBuilder, private snack: MatSnackBar, private auth: AuthService) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async sendMagicLink() {
    if (this.emailForm.invalid) return;
    this.sending = true;
    try {
      const email = this.emailForm.value.email;
      const res = await this.auth.signIn(email);
      this.snack.open(res?.message ?? 'Verification link sent', 'OK', { duration: 4000 });
    } catch (err: any) {
      console.error(err);
      this.snack.open(err?.message || 'Failed to send magic link', 'OK', { duration: 4000 });
    } finally {
      this.sending = false;
    }
  }

  async signInWithGoogle() {
    this.googleStarted = true;
    try {
      const url = await this.auth.signInWithGoogle();
      // main process / BrowserWindow should handle opening url; we just started OAuth
      // optionally we can open in a new window; leaving to main process
      this.snack.open('Google OAuth flow started', 'OK', { duration: 2000 });
    } catch (err: any) {
      console.error(err);
      this.snack.open(err?.message || 'Google sign in failed', 'OK', { duration: 4000 });
      this.googleStarted = false;
    }
  }

  openDownloadPage() {
    // fallback when user came to register without deep link — open public download page
    window.open('https://your-app-download-page.example.com', '_blank');
  }
}
