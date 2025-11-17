import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppLoadingComponent } from './app-loading.component';

describe('AppLoadingComponent', () => {
  let component: AppLoadingComponent;
  let fixture: ComponentFixture<AppLoadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLoadingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppLoadingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
