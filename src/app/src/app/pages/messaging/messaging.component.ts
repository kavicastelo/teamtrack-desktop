import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseRealtimeService, Message } from '../../services/supabase-realtime.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-messaging',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './messaging.component.html',
    styleUrls: ['./messaging.component.scss']
})
export class MessagingComponent implements OnInit, OnDestroy {
    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

    messages: Message[] = [];
    newMessage: string = '';
    username: string = 'User-' + Math.floor(Math.random() * 1000); // Random username for demo
    private subscription: Subscription = new Subscription();

    constructor(private supabaseService: SupabaseRealtimeService) { }

    ngOnInit() {
        // Initialize connection
        this.supabaseService.init('teamtrack-global', this.username);

        // Subscribe to messages
        this.subscription.add(
            this.supabaseService.messages$.subscribe(msgs => {
                this.messages = msgs;
                this.scrollToBottom();
            })
        );
    }

    ngOnDestroy() {
        this.supabaseService.disconnect();
        this.subscription.unsubscribe();
    }

    sendMessage() {
        if (!this.newMessage.trim()) return;

        this.supabaseService.sendMessage(this.newMessage, this.username);
        this.newMessage = '';
        this.scrollToBottom();
    }

    scrollToBottom(): void {
        setTimeout(() => {
            try {
                this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
            } catch (err) { }
        }, 100);
    }
}
