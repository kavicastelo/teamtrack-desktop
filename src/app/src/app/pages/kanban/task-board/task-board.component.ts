import {Component, OnDestroy, OnInit} from '@angular/core';
import {IpcService} from '../../../services/ipc.service';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
import {Task} from '../../../models/task.model';

@Component({
  selector: 'app-task-board',
  imports: [
    NgForOf,
    CdkDropList,
    CdkDrag,
    NgIf,
    DatePipe,
    CdkDropListGroup
  ],
  templateUrl: './task-board.component.html',
  styleUrl: './task-board.component.scss',
  standalone: true
})
export class TaskBoardComponent implements OnInit, OnDestroy {
  columns = [
    { id: 'todo', title: 'To do', tasks: [] as Task[] },
    { id: 'in-progress', title: 'In Progress', tasks: [] as Task[] },
    { id: 'review', title: 'Review', tasks: [] as Task[] },
    { id: 'done', title: 'Done', tasks: [] as Task[] }
  ];

  loading = false;
  error: string | null = null;
  // unsubscribe function returned by preload's onRemoteUpdate
  private unsubRemote: (() => void) | null = null;

  constructor(private ipc: IpcService) {}

  ngOnInit(): void {
    this.loadTasks().then();

    // subscribe to realtime remote updates forwarded by Electron main
    this.unsubRemote = this.ipc.onRemoteUpdate((payload: any) => {
      try {
        // payload shape: { table, record } per main -> syncService emit
        if (payload?.table === 'tasks' && payload.record) {
          this.applyRemoteTask(payload.record);
        }
      } catch (err) {
        console.warn('remote update apply failed', err);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.unsubRemote) {
      this.unsubRemote();
      this.unsubRemote = null;
    }
  }

  async loadTasks() {
    this.loading = true;
    this.error = null;
    try {
      const rows: Task[] = await this.ipc.listTasks();
      this.populateColumns(rows || []);
    } catch (err: any) {
      console.error('loadTasks failed', err);
      this.error = err?.message || 'Failed to load tasks';
    } finally {
      this.loading = false;
    }
  }

  populateColumns(tasks: Task[]) {
    for (const c of this.columns) c.tasks = [];
    for (const t of tasks) {
      const status = t.status || 'todo';
      const col = this.columns.find(c => c.id === status) || this.columns[0];
      col.tasks.push(t);
    }
  }

  async createQuickTask(input: HTMLInputElement) {
    const title = (input.value || '').trim();
    if (!title) return;
    try {
      // optimistic local id-less entry while waiting for DB
      const created = await this.ipc.createTask({ title, status: 'todo' });
      // insert at top of todo column
      const todo = this.columns.find(c => c.id === 'todo')!;
      todo.tasks.unshift(created);
      input.value = '';
    } catch (err) {
      console.error('createTask failed', err);
      this.error = 'Failed to create task';
    }
  }

  // apply remote upsert into local UI columns (idempotent)
  applyRemoteTask(rec: any) {
    const t: Task = {
      id: rec.id,
      title: rec.title,
      description: rec.description,
      status: rec.status || 'todo',
      assignee: rec.assignee,
      updated_at: rec.updated_at ? Date.parse(rec.updated_at) : Date.now()
    };

    // remove existing copies
    for (const col of this.columns) {
      const idx = col.tasks.findIndex(x => x.id === t.id);
      if (idx >= 0) col.tasks.splice(idx, 1);
    }

    // insert into target column top
    const target = this.columns.find(c => c.id === t.status) || this.columns[0];
    // keep newest first
    target.tasks.unshift(t);
  }

  // Drag & drop handler with optimistic update + IPC update
  async drop(event: CdkDragDrop<Task[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    // save references for rollback
    const prevList = event.previousContainer.data;
    const nextList = event.container.data;
    const task = prevList[event.previousIndex] as Task;
    const newStatus = (event.container.id as string) || 'todo';

    // optimistic UI move
    transferArrayItem(prevList, nextList, event.previousIndex, event.currentIndex);

    try {
      // call update via IPC
      await this.ipc.updateTask({ id: task.id, status: newStatus });
      // success — local DB will be updated and sync service will propagate remotely
    } catch (err) {
      console.error('updateTask failed, rolling back', err);
      // rollback the optimistic change
      transferArrayItem(nextList, prevList, event.currentIndex, event.previousIndex);
      this.error = 'Failed to update task';
    }
  }

  // basic helper to format date
  formatDate(ts?: number) {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  }

  // Manual refresh helper
  refresh() {
    this.loadTasks().then();
  }
}
