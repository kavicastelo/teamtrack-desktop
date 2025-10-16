import {Component, inject, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {IpcService} from '../../../services/ipc.service';
import {TaskBoardComponent} from '../../kanban/task-board/task-board.component';
import {TeamListComponent} from '../team-list/team-list.component';
import {DatePipe} from '@angular/common';

@Component({
  selector: 'app-project-view',
  imports: [
    TaskBoardComponent,
    TeamListComponent,
    DatePipe
  ],
  templateUrl: './project-view.component.html',
  styleUrl: './project-view.component.scss',
  standalone: true
})
export class ProjectViewComponent implements OnInit{

  private route = inject(ActivatedRoute);
  private ipc = inject(IpcService);
  project: any;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const projectId = params['id'];
      if (projectId) {
        this.loadProject(projectId).then();
      }
    });
  }

  async loadProject(projectId: string) {
    this.project = await this.ipc.listProjects(projectId).then();
    console.log("project", this.project);
  }
}
