import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService, Notification } from '../../services/notification.service';
import { Observable } from 'rxjs';
@Component({
    selector: 'app-notification',
    standalone: true,
    imports: [
        CommonModule,
        MatMenuModule,
        MatIconModule,
        MatButtonModule,
        MatListModule,
        MatBadgeModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './notification.component.html',
    styleUrls: ['./notification.component.scss']
})
export class NotificationComponent implements OnInit {
    notifications$: Observable<Notification[]>;
    unreadCount$: Observable<number>;
    loading$: Observable<boolean>;

    constructor(private notificationService: NotificationService) {
        this.notifications$ = this.notificationService.notifications$;
        this.unreadCount$ = this.notificationService.unreadCount$;
        this.loading$ = this.notificationService.loading$;
    }

    ngOnInit() { }

    markAsRead(id: string, event: Event) {
        event.stopPropagation();
        this.notificationService.markAsRead(id);
    }

    markAllAsRead() {
        this.notificationService.markAllAsRead();
    }

    delete(id: string, event: Event) {
        event.stopPropagation();
        this.notificationService.delete(id);
    }

    formatData(data: any): string {
        if (!data) return '';
        return JSON.stringify(data); // Improve this based on actual notification data structure
    }
}
