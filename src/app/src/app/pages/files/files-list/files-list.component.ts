import {Component, inject, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {MatToolbar} from '@angular/material/toolbar';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatCard} from '@angular/material/card';
import {DecimalPipe, NgForOf, NgIf} from '@angular/common';
import {MatRipple} from '@angular/material/core';
import {TruncateFilenamePipe} from '../../../components/pipes/TruncateFilenamePipe';
import {MatProgressBar} from '@angular/material/progress-bar';
import {FileSizePipe} from '../../../components/pipes/FileSizePipe';
import {AuthService} from '../../../services/auth.service';

@Component({
  selector: 'app-files-list',
  imports: [
    MatToolbar,
    MatIconButton,
    MatIcon,
    MatCard,
    NgForOf,
    MatRipple,
    NgIf,
    DecimalPipe,
    TruncateFilenamePipe,
    MatProgressBar,
    FileSizePipe
  ],
  templateUrl: './files-list.component.html',
  styleUrl: './files-list.component.scss',
  standalone: true
})
export class FilesListComponent implements OnInit {
  private ipc = inject(IpcService);
  private auth = inject(AuthService);
  files: any[] = [];

  uploading = false;
  uploadProgress: number | null = null;
  uploadFileName: string | null = null;
  error: string | null = null;

  currentUserId: any

  async ngOnInit() {
    await this.loadFiles();
    const user = this.auth.user()
    this.currentUserId = user?.user?.id
  }

  async loadFiles() {
    this.files = await this.ipc.listAttachments(null);
  }

  refreshFiles() {
    this.loadFiles().then();
  }

  async createFile() {
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

      const payload = {
        taskId: 'ALL_ACCESSIBLE',
        uploaded_by: this.currentUserId,
      }
      const newFile = await this.ipc.uploadAttachment(payload);
      clearInterval(progressInterval);

      this.uploadProgress = 100;
      this.uploadFileName = newFile?.filename;

      if (newFile) {
        this.files.push(newFile);
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

  async openFile(file: any) {
    const payload = {
      supabasePath: file.supabase_path,
      userId: this.currentUserId,
      id: file.id
    }
    await this.ipc.openAttachment(payload);
  }

  async downloadFile(file: any) {
    const payload = {
      supabasePath: file.supabase_path,
      userId: this.currentUserId,
      id: file.id
    }
    await this.ipc.downloadAttachment(payload);
  }

  getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'picture_as_pdf';
      case 'doc':
      case 'docx': return 'description';
      case 'xls':
      case 'xlsx': return 'table_chart';
      case 'png':
      case 'jpg':
      case 'jpeg': return 'image';
      case 'json':
      case 'ts':
      case 'js':
      case 'html': return 'code';
      default: return 'insert_drive_file';
    }
  }
}
