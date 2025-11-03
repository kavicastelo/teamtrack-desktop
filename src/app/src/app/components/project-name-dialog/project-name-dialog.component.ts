import {Component, Inject} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import {FormsModule} from '@angular/forms';
import {MatButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {IpcService} from '../../services/ipc.service';
import {NgForOf, NgIf} from '@angular/common';
import {MatOption, MatSelect} from '@angular/material/select';

@Component({
  selector: 'app-project-name-dialog',
  styleUrl: './project-name-dialog.component.scss',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatInput,
    MatFormField,
    MatLabel,
    MatOption,
    MatSelect,
    NgForOf
  ],
  template: `
    <h2 mat-dialog-title>New Project</h2>
    <mat-dialog-content>
      <mat-form-field appearance="fill" style="width: 100%;">
        <mat-label>Project name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="Enter name" />
      </mat-form-field>
      <mat-form-field appearance="fill" style="width: 100%;">
        <mat-label>Assign Main Team</mat-label>
        <mat-select [(ngModel)]="selectedTeam">
          <mat-option *ngFor="let team of teams" [value]="team">{{ team.name }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="fill" style="width: 100%;">
        <mat-label>Description</mat-label>
        <textarea matInput [(ngModel)]="description" rows="3"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="isUpdate?update():confirm()">{{isUpdate?'Update':'Create'}}</button>
    </mat-dialog-actions>
  `
})
export class ProjectNameDialogComponent {
  name = '';
  description = '';
  teams: any[] = [];
  selectedTeam: any;
  isUpdate = false;

  constructor(private dialogRef: MatDialogRef<ProjectNameDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: { project: any },
              private ipc: IpcService) {}

  async ngOnInit() {
    this.teams = await this.ipc.listTeams();
    if (this.data?.project) {
      this.isUpdate = true;
      this.name = this.data.project.name;
      this.description = this.data.project.description;
      this.selectedTeam = this.teams.find(t => t.id === this.data.project.team_id);
    }
  }

  confirm() {
    this.dialogRef.close({ name: this.name.trim(), description: this.description.trim(), team_id: this.selectedTeam?.id });
  }

  update() {
    this.dialogRef.close({ id: this.data.project.id, name: this.name.trim(), description: this.description.trim(), team_id: this.selectedTeam?.id });
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
