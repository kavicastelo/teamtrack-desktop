import { Component } from '@angular/core';
import {MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {FormsModule} from '@angular/forms';
import {MatButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {MatFormField, MatLabel} from '@angular/material/form-field';

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
    MatLabel
  ],
  template: `
    <h2 mat-dialog-title>New Project</h2>
    <mat-dialog-content>
      <mat-form-field appearance="fill" style="width: 100%;">
        <mat-label>Project name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="Enter name" />
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
  `
})
export class ProjectNameDialogComponent {
  name = '';
  description = '';

  constructor(private dialogRef: MatDialogRef<ProjectNameDialogComponent>) {}

  confirm() {
    this.dialogRef.close({ name: this.name.trim(), description: this.description.trim() });
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
