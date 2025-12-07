import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IpcService } from './ipc.service';

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message?: string;
    data?: any;
    read: boolean;
    created_at: number;
    updated_at: number;
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private notificationsSubject = new BehaviorSubject<Notification[]>([]);
    public notifications$ = this.notificationsSubject.asObservable();

    private unreadCountSubject = new BehaviorSubject<number>(0);
    public unreadCount$ = this.unreadCountSubject.asObservable();

    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$ = this.loadingSubject.asObservable();

    private pollingInterval: any;

    constructor(private ipcService: IpcService) {
        this.startPolling();
    }

    startPolling() {
        this.loadNotifications();
        this.pollingInterval = setInterval(() => {
            this.loadNotifications(true);
        }, 30000); // Poll every 30 seconds
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
    }

    async loadNotifications(background = false) {
        if (!background) this.loadingSubject.next(true);
        try {
            // For now we get recent 50. Pagination can be added later if needed for full history.
            const notifications = await this.ipcService.getNotifications(50, 0);
            this.notificationsSubject.next(notifications);
            this.updateUnreadCount(notifications);
        } catch (e) {
            console.error('Failed to load notifications', e);
        } finally {
            if (!background) this.loadingSubject.next(false);
        }
    }

    private updateUnreadCount(notifications: Notification[]) {
        const unread = notifications.filter(n => !n.read).length;
        this.unreadCountSubject.next(unread);
    }

    async markAsRead(id: string) {
        try {
            // Optimistic update
            const current = this.notificationsSubject.value;
            const updated = current.map(n => n.id === id ? { ...n, read: true } : n);
            this.notificationsSubject.next(updated);
            this.updateUnreadCount(updated);

            await this.ipcService.markNotificationAsRead(id);
        } catch (e) {
            console.error('Failed to mark as read', e);
            this.loadNotifications(true); // Revert on error
        }
    }

    async markAllAsRead() {
        try {
            // Optimistic update
            const current = this.notificationsSubject.value;
            const updated = current.map(n => ({ ...n, read: true }));
            this.notificationsSubject.next(updated);
            this.updateUnreadCount(updated);

            await this.ipcService.markAllNotificationsAsRead();
        } catch (e) {
            console.error('Failed to mark all as read', e);
            this.loadNotifications(true);
        }
    }

    async delete(id: string) {
        try {
            // Optimistic update
            const current = this.notificationsSubject.value;
            const updated = current.filter(n => n.id !== id);
            this.notificationsSubject.next(updated);
            this.updateUnreadCount(updated);

            await this.ipcService.deleteNotification(id);
        } catch (e) {
            console.error('Failed to delete notification', e);
            this.loadNotifications(true);
        }
    }
}
