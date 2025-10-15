import {Component, Input, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {NgForOf} from '@angular/common';
import {MatDialog} from '@angular/material/dialog';
import {TeamNameDialogComponent} from './team-name-dialog/team-name-dialog.component';

@Component({
  selector: 'app-team-list',
  imports: [
    NgForOf
  ],
  templateUrl: './team-list.component.html',
  styleUrl: './team-list.component.scss',
  standalone: true
})
export class TeamListComponent implements OnInit {
  @Input() project: any;
  teams: any[] = [];

  constructor(private ipc: IpcService, private dialog: MatDialog) {}

  async ngOnInit() {
    if (this.project) this.teams = await this.ipc.listTeams(this.project.id);
  }
  async createTeam() {
    const dialogRef = this.dialog.open(TeamNameDialogComponent, {
      width: '400px',
      panelClass: 'dialog-dark-theme'
    });

    const result = await dialogRef.afterClosed().toPromise();
    if (result?.name) {
      await this.ipc.createTeam(result);
      this.teams = await this.ipc.listProjects();
    }
  }
  async editTeam(t: any) {
    const name = prompt("Edit team name:", t.name);
    if (name) {
      await this.ipc.updateTeam({ ...t, name });
      this.teams = await this.ipc.listTeams(this.project.id);
    }
  }
}
