import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {AuthService} from '../../../services/auth.service';
import {IpcService} from '../../../services/ipc.service';

@Component({
  selector: 'app-auth-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatSnackBarModule,
    MatIconModule
  ],
  template: `
    <div class="auth-root dark-theme">
      <mat-card class="card">
        <h1 class="title">Complete your registration</h1>

        <div *ngIf="!hasInvite">
          <p class="muted">No invite detected. If you were invited, open the invite email in the app so it can open this screen automatically.</p>
          <div class="actions">
            <button mat-flat-button color="primary" (click)="openDownload()">Download app</button>
            <button mat-stroked-button (click)="goToLogin()">Go to sign in</button>
          </div>
        </div>

        <div *ngIf="hasInvite">
          <form [formGroup]="profileForm" (ngSubmit)="completeRegistration()">
            <mat-form-field appearance="fill" class="full">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" />
            </mat-form-field>

            <mat-form-field appearance="fill" class="full">
              <mat-label>Full name</mat-label>
              <input matInput formControlName="full_name" required />
              <mat-error *ngIf="profileForm.controls['full_name'].hasError('required')">Full name required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="fill" class="full">
              <mat-label>Timezone (optional)</mat-label>
              <input matInput formControlName="timezone" placeholder="e.g. Asia/Colombo" />
            </mat-form-field>

            <button mat-flat-button color="primary" class="full" [disabled]="profileForm.invalid || saving">
              {{ saving ? 'Saving...' : 'Complete registration' }}
            </button>
          </form>
        </div>

        <div *ngIf="error" class="error">{{ error }}</div>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display:block; height:100%; }
    .auth-root { height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { width:480px; padding:24px; border-radius:12px; background: linear-gradient(180deg, #111, #0b0b0b); color:#eaeaea; box-shadow: 0 8px 30px rgba(0,0,0,0.7); }
    .title { margin:0 0 16px 0; color:#fff; font-weight:600; }
    .muted { color:#bdbdbd; margin-bottom:12px; }
    .actions { display:flex; gap:8px; }
    .full { width:100%; margin-top:8px; display:block; }
    .error { color:#ff8a80; margin-top:12px; }
    .mat-form-field-appearance-fill .mat-form-field-flex { background: rgba(255,255,255,0.02); }
  `]
})
export class AuthRegisterComponent implements OnInit, OnDestroy {
  profileForm: any;

  hasInvite = false;
  saving = false;
  error: string | null = null;
  session: any = null;
  private sub?: Subscription;

  constructor(private fb: FormBuilder, private snack: MatSnackBar, private router: Router, private ipc: IpcService, private auth: AuthService) {
    this.profileForm = this.fb.group({
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      full_name: ['', Validators.required],
      timezone: ['']
    });
  }

  ngOnInit(): void {
    // Listen for deep link events from main process (preload exposed onDeepLink)
    // When the invite link opens the app, main should emit 'deep-link' and preload forwards it
    try {
      this.ipc.onDeepLink(async (url: string) => {
        console.log('Received deep link:', url);
        await this.handleInviteUrl(url);
      }).then();
    } catch (err) {
      // If preload isn't available or user opened directly, no deep link will arrive.
      console.warn('onDeepLink not available or preload not loaded', err);
    }

    // Also attempt to restore session if a session was previously stored
    this.attemptRestore().then();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async attemptRestore() {
    try {
      const session = await this.auth.restoreSession();
      if (session) {
        // there may still be an invite flow requiring handleCallback, but if already logged in we can prefill
        this.session = session;
        this.profileForm.patchValue({ email: session.user?.email ?? '' });
      }
    } catch (err) {
      console.debug('No session restored', err);
    }
  }

  async handleInviteUrl(url: string) {
    this.error = null;
    try {
      // Hand-off to main auth handler to exchange code / token
      const session = await this.auth.handleCallback(url);
      if (!session || !session.user) {
        this.error = 'Could not complete invite link. Invalid invite.';
        return;
      }
      this.session = session;
      this.profileForm.patchValue({ email: session.user.email });
      this.hasInvite = true;
      this.snack.open('Invite accepted — please complete your profile', 'OK', { duration: 3000 });
    } catch (err: any) {
      console.error('handleInviteUrl error', err);
      this.error = err?.message || 'Failed to process invite';
    }
  }

  async completeRegistration() {
    if (!this.session || !this.session.user) {
      this.error = 'No invite/session found. Open the invite email in the app.';
      return;
    }
    if (this.profileForm.invalid) return;
    this.saving = true;
    this.error = null;
    try {
      const payload = {
        id: this.session.user.id,
        email: this.session.user.email,
        full_name: this.profileForm.value.full_name,
        timezone: this.profileForm.value.timezone || null,
        updated_at: Date.now()
      };
      await this.auth.updateProfile(payload);
      this.snack.open('Profile updated. Redirecting to app...', 'OK', { duration: 2000 });
      // navigate to main app route; adjust to your route
      await this.router.navigate(['/tasks'] as any);
    } catch (err: any) {
      console.error('updateProfile failed', err);
      this.error = err?.message || 'Failed to update profile';
    } finally {
      this.saving = false;
    }
  }

  openDownload() {
    window.open('https://your-app-download-page.example.com', '_blank');
  }

  goToLogin() {
    this.router.navigate(['/auth/login'] as any).then();
  }
}
