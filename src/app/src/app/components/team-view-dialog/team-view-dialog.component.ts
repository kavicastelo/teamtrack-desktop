import {Component, Inject} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {IpcService} from '../../services/ipc.service';
import {TeamMemberService} from '../../services/team-member.service';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
import {MAT_DIALOG_DATA, MatDialog, MatDialogClose, MatDialogRef} from '@angular/material/dialog';
import {MatButton} from '@angular/material/button';
import {TaskDetailDialogComponent} from '../task-detail-dialog/task-detail-dialog.component';

@Component({
  selector: 'app-team-view-dialog',
  imports: [
    NgIf,
    NgForOf,
    DatePipe,
    MatButton,
    MatDialogClose
  ],
  templateUrl: './team-view-dialog.component.html',
  styleUrl: './team-view-dialog.component.scss',
  standalone: true
})
export class TeamViewDialogComponent {
  teamId!: string;
  projectId!: string;

  team: any = null;
  members: any[] = [];
  tasks: any[] = [];

  loading = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { team: any },
    private dialogRef: MatDialogRef<TeamViewDialogComponent>,
    private route: ActivatedRoute,
    private ipc: IpcService,
    private tm: TeamMemberService,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  async ngOnInit() {
    this.teamId = this.data.team.id!;
    this.projectId = this.data.team.project_id!;
    console.log('teamId', this.teamId);
    console.log('projectId', this.projectId);

    await this.loadTeam();
  }

  async loadTeam() {
    try {
      this.team = await this.ipc.getTeam(this.teamId);
      this.members = await this.tm.listTeamMembers(this.teamId);

      await this.loadTasks();

    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  async loadTasks() {
    this.tasks = await this.ipc.listTasksByTeamId(this.teamId);
  }

  editTeam() {
    this.router.navigate([`/team/${this.projectId}/teams/${this.teamId}/edit`]).then();
  }

  // Edit Task Method
  editTask(task: any) {
    const ref = this.dialog.open(TaskDetailDialogComponent, {
      width: '650px',
      data: { task: task },
      panelClass: 'dialog-dark-theme'
    });

    ref.afterClosed().subscribe(updated => {
      if (updated) {
        task = updated;
        this.ngOnInit().then();
      }
    });
  }

// Delete Task Method
  async deleteTask(task: any) {
    const confirmDelete = confirm('Are you sure you want to delete this task?');
    if (confirmDelete) {
      try {
        await this.ipc.deleteTask(task.id);
        await this.loadTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  }
}
