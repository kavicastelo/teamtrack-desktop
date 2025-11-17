import {Component, Inject, OnInit} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions, MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import {Task} from '../../models/task.model';
import {IpcService} from '../../services/ipc.service';
import {AuthService} from '../../services/auth.service';
import {TaskDetailDialogComponent} from '../task-detail-dialog/task-detail-dialog.component';
import {DatePipe, NgForOf, NgIf, TitleCasePipe} from '@angular/common';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

@Component({
  selector: 'app-task-view-dialog',
  imports: [
    MatDialogActions,
    MatIcon,
    NgForOf,
    NgIf,
    MatDialogContent,
    MatDialogTitle,
    MatIconButton,
    TitleCasePipe,
    DatePipe,
    MatButton,
    MatDialogClose
  ],
  templateUrl: './task-view-dialog.component.html',
  styleUrl: './task-view-dialog.component.scss',
  standalone: true
})
export class TaskViewDialogComponent implements OnInit{
  task: Task;
  attachments: any[] = [];
  assignee: any;
  users: any[] = [];
  sanitizedDescription: SafeHtml = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { task: Task },
    private dialogRef: MatDialogRef<TaskViewDialogComponent>,
    private dialog: MatDialog,
    private ipc: IpcService,
    private auth: AuthService,
    private sanitizer: DomSanitizer
  ) {
    this.task = data.task;
  }

  async ngOnInit() {
    this.attachments = await this.ipc.listAttachments(this.task.id);
    this.users = await this.auth.listUsers();
    this.assignee = this.users.find(u => u.id === this.task.assignee);

    if (this.task.description) {
      const processedDescription = this.convertUrlsToLinks(this.task.description);
      this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(processedDescription);
    }
  }

  priorityLabel(p: number|undefined) {
    return p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low';
  }

  openEdit() {
    const ref = this.dialog.open(TaskDetailDialogComponent, {
      width: '650px',
      data: { task: this.task },
      panelClass: 'dialog-dark-theme'
    });

    ref.afterClosed().subscribe(updated => {
      if (updated.id) {
        this.task = updated;
        this.ngOnInit().then();
      } else {
        this.dialogRef.close();
      }
    });
  }

  openAttachment(att: any) {
    const payload = {
      supabasePath: att.supabase_path,
      userId: "user",
      id: att.id
    };
    this.ipc.downloadAttachment(payload).then();
  }

  /**
   * Convert plain text URLs into clickable anchor (<a>) tags.
   * @param text The description text
   * @returns The transformed text with clickable URLs
   */
  convertUrlsToLinks(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => {
      return `<a href="${url}" target="_blank" class="link">${url}</a>`;
    });
  }

  cancel() {
    this.dialogRef.close(this.task);
  }
}
