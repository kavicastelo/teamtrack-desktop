import {Component, Input, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {NgForOf, NgIf} from '@angular/common';
import {MatDialog} from '@angular/material/dialog';
import {TeamNameDialogComponent} from '../../../components/team-name-dialog/team-name-dialog.component';
import {Router} from '@angular/router';
import {MatCheckbox} from "@angular/material/checkbox";
import {FormsModule} from '@angular/forms';
import {TeamMemberService} from '../../../services/team-member.service';
import {AuthService} from '../../../services/auth.service';
import {Task} from '../../../models/task.model';
import {TeamViewDialogComponent} from '../../../components/team-view-dialog/team-view-dialog.component';

@Component({
  selector: 'app-team-list',
  imports: [
    NgForOf,
    MatCheckbox,
    FormsModule,
    NgIf
  ],
  templateUrl: './team-list.component.html',
  styleUrl: './team-list.component.scss',
  standalone: true
})
export class TeamListComponent implements OnInit {
  @Input() projectId: string | null = null;

  teams: any[] = [];
  filteredTeams: any[] = [];
  teamMembers: any[] = [];

  onlymeCheck = false;
  user: any;

  constructor(
    private ipc: IpcService,
    private tm: TeamMemberService,
    private auth: AuthService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  async ngOnInit() {
    this.user = await this.auth.user();
    await this.listAllTeams(this.projectId);
  }

  async listAllTeams(projectId?: string | null) {
    this.teams = await this.ipc.listTeams(projectId);
    this.teamMembers = await this.tm.listTeamMembers(null);

    // ─────────────────────────────
    // MAP TEAM MEMBERS TO TEAMS
    // ─────────────────────────────
    this.teams = this.teams.map(team => {
      const members = this.teamMembers.filter(m => m.team_id === team.id);

      return {
        ...team,
        memberList: members,
        memberCount: members.length,
        isMine: members.some(m => m.user_id === this.user?.id)
      };
    });

    this.filterTeams();
  }

  filterTeams() {
    if (!this.onlymeCheck) {
      this.filteredTeams = [...this.teams];
      return;
    }

    this.filteredTeams = this.teams.filter(t => t.isMine);
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
      await this.listAllTeams(this.projectId);
    }
  }

  editTeam(t: any) {
    this.router.navigate([`/team/${this.projectId}/teams/${t.id}/edit`]).then();
  }

  async deleteTeam(t: any) {
    if (confirm('Delete this team?')) {
      await this.ipc.deleteTeam(t.id);
      await this.listAllTeams(this.projectId);
    }
  }

  openTeamDetail(team: any) {
    const ref = this.dialog.open(TeamViewDialogComponent, {
      width: '500px',
      data: { team }
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        // refresh
      }
    });
  }
}
