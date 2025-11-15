import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskViewDialogComponent } from './task-view-dialog.component';

describe('TaskViewDialogComponent', () => {
  let component: TaskViewDialogComponent;
  let fixture: ComponentFixture<TaskViewDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskViewDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskViewDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
