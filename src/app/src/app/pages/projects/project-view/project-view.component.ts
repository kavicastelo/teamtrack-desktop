import {Component, inject, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {IpcService} from '../../../services/ipc.service';
import {TaskBoardComponent} from '../../kanban/task-board/task-board.component';
import {TeamListComponent} from '../../teams/team-list/team-list.component';
import {DatePipe, NgIf} from '@angular/common';

@Component({
  selector: 'app-project-view',
  imports: [
    TaskBoardComponent,
    TeamListComponent,
    DatePipe,
    NgIf
  ],
  templateUrl: './project-view.component.html',
  styleUrl: './project-view.component.scss',
  standalone: true
})
export class ProjectViewComponent implements OnInit{

  private route = inject(ActivatedRoute);
  private ipc = inject(IpcService);
  project: any;
  loading = true;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const projectId = params['id'];
      if (projectId) {
        this.loadProject(projectId).then();
      }
    });
  }

  async loadProject(projectId: string) {
    await this.ipc.listProjects(projectId).then(p => {
      this.project = p[0];
      this.loading = false;
    });
  }
}
