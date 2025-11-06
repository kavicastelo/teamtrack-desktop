import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserActivityHeatmapComponent } from './user-activity-heatmap.component';

describe('UserActivityHeatmapComponent', () => {
  let component: UserActivityHeatmapComponent;
  let fixture: ComponentFixture<UserActivityHeatmapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserActivityHeatmapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserActivityHeatmapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
