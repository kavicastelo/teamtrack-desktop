import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectNameDialogComponent } from './project-name-dialog.component';

describe('ProjectNameDialogComponent', () => {
  let component: ProjectNameDialogComponent;
  let fixture: ComponentFixture<ProjectNameDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectNameDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectNameDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
