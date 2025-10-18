import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteUserDialogComponent } from './invite-user-dialog.component';

describe('InviteUserDialogComponent', () => {
  let component: InviteUserDialogComponent;
  let fixture: ComponentFixture<InviteUserDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteUserDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InviteUserDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
