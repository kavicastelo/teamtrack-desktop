import {Component, Input, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {NgForOf} from '@angular/common';
import {MatDialog} from '@angular/material/dialog';
import {TeamNameDialogComponent} from '../../../components/team-name-dialog/team-name-dialog.component';
import {Router} from '@angular/router';

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
  @Input() projectId: string | null = null;
  teams: any[] = [];
  selectedProject: any = null;

  constructor(private ipc: IpcService, private dialog: MatDialog, private router: Router) {}

  async ngOnInit() {
    this.teams = await this.ipc.listTeams(this.projectId);
  }
  async createTeam() {
    const dialogRef = this.dialog.open(TeamNameDialogComponent, {
      width: '400px',
      panelClass: 'dialog-dark-theme',
      data: { projectId: this.projectId }
    });

    const result = await dialogRef.afterClosed().toPromise();
    if (result?.name) {
      await this.ipc.createTeam(result);
      this.teams = await this.ipc.listTeams(this.projectId);
    }
  }
  async editTeam(t: any) {
    if (t) {
      this.router.navigate([`/team/${this.projectId}/teams/${t.id}/edit`]).then();
    }
  }
  async deleteTeam(t: any) {
    if (t) {
      if (confirm('Are you sure you want to delete this team?')) {
        await this.ipc.deleteTeam(t.id);
        this.teams = await this.ipc.listTeams(this.projectId);
      }
    }
  }
}
