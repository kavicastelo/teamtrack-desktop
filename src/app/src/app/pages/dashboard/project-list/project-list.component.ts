import {Component, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {NgForOf} from '@angular/common';
import {ProjectNameDialogComponent} from './project-name-dialog/project-name-dialog.component';
import {MatDialog} from '@angular/material/dialog';

@Component({
  selector: 'app-project-list',
  imports: [
    NgForOf
  ],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
  standalone: true
})
export class ProjectListComponent implements OnInit{
  projects: any[] = [];

  constructor(private ipc: IpcService, private dialog: MatDialog) {}

  async ngOnInit() {
    this.projects = await this.ipc.listProjects();
  }

  async createProject() {
    const dialogRef = this.dialog.open(ProjectNameDialogComponent, {
      width: '400px',
      panelClass: 'dialog-dark-theme'
    });

    const result = await dialogRef.afterClosed().toPromise();
    if (result?.name) {
      await this.ipc.createProject(result);
      this.projects = await this.ipc.listProjects();
    }
  }

  selectProject(p: any) {
    console.log('Selected:', p);
  }
}
