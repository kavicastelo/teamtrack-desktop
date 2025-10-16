import {Component, Inject, OnInit} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import {IpcService} from '../../services/ipc.service';
import {FormsModule} from '@angular/forms';
import {MatButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {NgForOf, NgIf} from '@angular/common';

@Component({
  selector: 'app-team-name-dialog',
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatInput,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    NgForOf,
    NgIf
  ],
  template: `
    <h2 mat-dialog-title>New Team</h2>
    <mat-dialog-content>
      <mat-form-field appearance="fill" style="width: 100%;">
        <mat-label>Team name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="Enter name" />
      </mat-form-field>
      <mat-form-field *ngIf="!projectId" appearance="fill" style="width: 100%;">
        <mat-label>Project</mat-label>
        <mat-select [(ngModel)]="selectedProject">
          <mat-option *ngFor="let project of projects" [value]="project">{{ project.name }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="fill" style="width: 100%;">
        <mat-label>Description</mat-label>
        <textarea matInput [(ngModel)]="description" rows="3"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="confirm()">Create</button>
    </mat-dialog-actions>
  `,
  styleUrl: './team-name-dialog.component.scss',
  standalone: true
})
export class TeamNameDialogComponent implements OnInit{
  name = '';
  description = '';
  projects: any[] = [];
  selectedProject: any = null;
  projectId: string | null = null;

  constructor(private dialogRef: MatDialogRef<TeamNameDialogComponent>, @Inject(MAT_DIALOG_DATA) data:any, private ipc: IpcService) {
    this.projectId = data?.projectId;
  }

  async ngOnInit() {
    this.projects = await this.ipc.listProjects();
  }

  confirm() {
    this.dialogRef.close({ project_id: this.projectId || this.selectedProject.id, name: this.name.trim(), description: this.description.trim() });
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
