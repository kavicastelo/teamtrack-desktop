import {Component, Inject, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import {Task} from '../../../models/task.model';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {MatInput} from '@angular/material/input';
import {FormsModule} from '@angular/forms';
import {DatePipe, DecimalPipe, NgForOf, NgIf} from '@angular/common';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-task-detail-dialog',
  imports: [
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatSelect,
    MatInput,
    MatOption,
    MatLabel,
    FormsModule,
    MatDialogActions,
    NgIf,
    MatButton,
    DatePipe,
    MatIcon,
    NgForOf,
    DecimalPipe
  ],
  templateUrl: './task-detail-dialog.component.html',
  styleUrl: './task-detail-dialog.component.scss',
  standalone: true
})
export class TaskDetailDialogComponent implements OnInit {
  task: Task;
  saving = false;
  deleting = false;
  error: string | null = null;

  attachments: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { task: Task },
    private dialogRef: MatDialogRef<TaskDetailDialogComponent>,
    private ipc: IpcService
  ) {
    this.task = { ...data.task };
  }

  async ngOnInit() {
    this.attachments = await this.ipc.listAttachments(this.task.id);
  }

  async save() {
    this.saving = true;
    try {
      const updated = await this.ipc.updateTask(this.task);
      this.dialogRef.close(updated);
    } catch (e) {
      console.error(e);
      this.error = 'Failed to update task';
    } finally {
      this.saving = false;
    }
  }

  async delete() {
    this.deleting = true;
    try {
      const deleted = await this.ipc.deleteTask(this.task.id);
      this.dialogRef.close(deleted);
    } catch (e) {
      console.error(e);
      this.error = 'Failed to delete task';
    } finally {
      this.deleting = false;
    }
  }

  async uploadAttachment() {
    const newFile = await this.ipc.uploadAttachment(this.task.id);
    if (newFile) this.attachments.push(newFile);
  }

  async openAttachment(att: any) {
    await this.ipc.downloadAttachment(att.supabasePath);
  }

  cancel() {
    this.dialogRef.close();
  }
}
