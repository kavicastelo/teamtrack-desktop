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
import {MatProgressBar} from '@angular/material/progress-bar';
import {TruncatePipe} from '../../../components/pipes/TruncatePipe';
import {TruncateFilenamePipe} from '../../../components/pipes/TruncateFilenamePipe';
import {FileSizePipe} from '../../../components/pipes/FileSizePipe';

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
    DecimalPipe,
    MatProgressBar,
    TruncateFilenamePipe,
    FileSizePipe
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

  uploading = false;
  uploadProgress: number | null = null;
  uploadFileName: string | null = null;

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
    this.error = null;
    this.uploading = true;
    this.uploadProgress = null;
    this.uploadFileName = null;

    try {
      // Optionally show simulated progress (Supabase SDK doesn't report progress)
      const progressInterval = setInterval(() => {
        if (this.uploadProgress === null) this.uploadProgress = 0;
        else if (this.uploadProgress < 95) this.uploadProgress += Math.random() * 10;
      }, 300);

      const newFile = await this.ipc.uploadAttachment(this.task.id);
      clearInterval(progressInterval);

      this.uploadProgress = 100;
      this.uploadFileName = newFile?.filename;

      if (newFile) {
        this.attachments.push(newFile);
      }

      // Smooth finish delay
      await new Promise((res) => setTimeout(res, 500));
    } catch (e) {
      console.error(e);
      this.error = 'Failed to upload file';
    } finally {
      this.uploading = false;
      this.uploadProgress = null;
      this.uploadFileName = null;
    }
  }

  async openAttachment(att: any) {
    const payload = {
      supabasePath: att.supabase_path,
      userId: "user" //todo: add user id
    }
    await this.ipc.downloadAttachment(payload);
  }

  cancel() {
    this.dialogRef.close();
  }
}
