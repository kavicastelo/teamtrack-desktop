import {Component, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
import {ProjectNameDialogComponent} from '../../../components/project-name-dialog/project-name-dialog.component';
import {MatDialog} from '@angular/material/dialog';
import {Router} from '@angular/router';
import {AuthService} from '../../../services/auth.service';
import {MatOption, MatRipple} from '@angular/material/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatSelect} from '@angular/material/select';

@Component({
  selector: 'app-project-list',
  imports: [
    NgForOf,
    NgIf,
    DatePipe,
    MatRipple,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption
  ],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
  standalone: true
})
export class ProjectListComponent implements OnInit{
  projects: any[] = [];
  filteredProjects: any[] = [];
  users: any[] = [];
  teams: any[] = [];
  user: any;

  constructor(
    private ipc: IpcService,
    private auth: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  async ngOnInit() {
    this.user = await this.auth.user();
    this.projects = await this.ipc.listProjects();
    this.users = await this.auth.listUsers();
    this.teams = await this.ipc.listTeams();
    this.filteredProjects = this.projects;
  }

  loadAssignee(id: string | null): string {
    if (!id) return "Unassigned";
    const u = this.users.find(u => u.id === id);
    return u?.full_name || u?.email || id;
  }

  getTeamName(id: string | null): string {
    if (!id) return "No Team";
    return this.teams.find(t => t.id === id)?.name || "Unknown Team";
  }

  async copyId(id: string) {
    await navigator.clipboard.writeText(id);
    this.snack.open('ID copied to clipboard', 'OK', { duration: 2000 });
  }

  selectProject(p: any) {
    this.router.navigate([`/project/${p.id}`]).then();
  }

  async createProject() {
    const ref = this.dialog.open(ProjectNameDialogComponent, {
      width: "400px",
      panelClass: "dialog-dark-theme"
    });

    const result = await ref.afterClosed().toPromise();
    if (!result?.name) return;
    result.owner_id = this.user.id;

    await this.ipc.createProject(result);
    this.projects = await this.ipc.listProjects();
  }

  async editProject(p: any) {
    const ref = this.dialog.open(ProjectNameDialogComponent, {
      width: "400px",
      panelClass: "dialog-dark-theme",
      data: { project: p }
    });

    const result = await ref.afterClosed().toPromise();
    if (!result?.name) return;

    await this.ipc.updateProject(result);
    this.projects = await this.ipc.listProjects();
  }

  async deleteProject(p: any) {
    if (!confirm("Delete this project?")) return;
    await this.ipc.deleteProject(p.id);
    this.projects = await this.ipc.listProjects();
  }

  filterProjects(teamId: any) {
    if (!teamId) this.filteredProjects = this.projects;
    else this.filteredProjects = this.projects.filter(p => p.team_id === teamId);
  }
}
