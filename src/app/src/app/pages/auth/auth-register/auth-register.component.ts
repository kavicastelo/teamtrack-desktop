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
import { AuthService } from '../../../services/auth.service';

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
    <div class="auth-root dark-theme" *ngIf="!checking">
      <mat-card class="card">
        <h1 class="title">Complete your registration</h1>

        <ng-container *ngIf="!profileComplete; else alreadyComplete">
          <form [formGroup]="profileForm" (ngSubmit)="completeRegistration()">
            <mat-form-field appearance="fill" class="full">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" />
            </mat-form-field>

            <mat-form-field appearance="fill" class="full">
              <mat-label>Full name</mat-label>
              <input matInput formControlName="full_name" required />
              <mat-error *ngIf="profileForm.controls['full_name'].hasError('required')">
                Full name required
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="fill" class="full">
              <mat-label>Timezone (optional)</mat-label>
              <input matInput formControlName="timezone" placeholder="e.g. Asia/Colombo" />
            </mat-form-field>

            <button mat-flat-button color="primary" class="full" [disabled]="profileForm.invalid || saving">
              {{ saving ? 'Saving...' : 'Complete registration' }}
            </button>
          </form>
        </ng-container>

        <ng-template #alreadyComplete>
          <p class="muted">Your profile is already complete. Redirecting...</p>
        </ng-template>

        <div *ngIf="error" class="error">{{ error }}</div>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display:block; height:100%; }
    .auth-root { height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { width:480px; padding:24px; border-radius:12px; background: linear-gradient(180deg, #111, #0b0b0b); color:#eaeaea; box-shadow: 0 8px 30px rgba(0,0,0,0.7); }
    .title { margin:0 0 16px 0; color:#fff; font-weight:600; }
    .muted { color:#bdbdbd; margin-top:12px; }
    .full { width:100%; margin-top:8px; display:block; }
    .error { color:#ff8a80; margin-top:12px; }
  `]
})
export class AuthRegisterComponent implements OnInit, OnDestroy {
  session: any = null;
  saving = false;
  error: string | null = null;
  checking = true;
  profileComplete = false;

  profileForm: any;

  constructor(
    private fb: FormBuilder,
    private snack: MatSnackBar,
    private router: Router,
    private auth: AuthService
  ) {
    this.profileForm = this.fb.group({
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      full_name: ['', Validators.required],
      timezone: ['']
    });
  }

  async ngOnInit() {
    try {
      setTimeout(() => this.checking = false, 1000);
      this.session = await this.auth.getUser();
      if (!this.session || !this.session.user) {
        console.warn('[Register] No user session found — redirecting to login');
        // await this.router.navigate(['/auth/login']);
        return;
      }

      // Prefill email
      this.profileForm.patchValue({ email: this.session.user.email });

      // Check if profile already complete
      const profile = await this.auth.getUser(this.session.user.id);
      if (profile?.full_name) {
        this.profileComplete = true;
        // Delay just for UX
        setTimeout(() => this.router.navigate(['/tasks']), 800);
      }

    } catch (err) {
      console.error('[Register] init error', err);
      this.error = 'Failed to load session.';
    } finally {
      this.checking = false;
    }
  }

  ngOnDestroy() {}

  async completeRegistration() {
    if (!this.session?.user) {
      this.error = 'No session found.';
      return;
    }
    if (this.profileForm.invalid) return;

    this.saving = true;
    try {
      const payload = {
        id: this.session.user.id,
        email: this.session.user.email,
        full_name: this.profileForm.value.full_name,
        timezone: this.profileForm.value.timezone || null
      };

      await this.auth.updateProfile(payload);
      this.snack.open('Profile updated successfully!', 'OK', { duration: 2000 });
      await this.router.navigate(['/tasks']);
    } catch (err: any) {
      console.error('[Register] updateProfile failed', err);
      this.error = err?.message || 'Failed to update profile';
    } finally {
      this.saving = false;
    }
  }
}
