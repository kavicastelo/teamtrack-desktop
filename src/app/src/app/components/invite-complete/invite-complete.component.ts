import {Component, inject, OnInit} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {AuthService} from '../../services/auth.service';
import {ActivatedRoute, Router} from '@angular/router';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {IpcService} from '../../services/ipc.service';

@Component({
  selector: 'app-invite-complete',
  standalone: true,
  template: `
    <div class="invite-complete">
      <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
      <p>Completing your invitation...</p>
    </div>`,
  styleUrls: ['./invite-complete.component.scss'],
  imports: [
    MatProgressSpinner
  ]
})
export class InviteCompleteComponent implements OnInit {
  constructor(private auth: AuthService, private ipc: IpcService, private router: Router) {}

  async ngOnInit() {
    await this.ipc.onDeepLink(async (url: string) => {
      console.log('Received deep link:', url);
      try {
        console.log('[InviteComplete] received deep link:', url);
        await this.auth.handleCallback(url);
        await this.router.navigate(['/register']);
      } catch (err) {
        console.error('Failed handling deep link', err);
      }
    });
  }
}
