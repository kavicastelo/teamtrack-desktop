import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamViewDialogComponent } from './team-view-dialog.component';

describe('TeamViewDialogComponent', () => {
  let component: TeamViewDialogComponent;
  let fixture: ComponentFixture<TeamViewDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamViewDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamViewDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
