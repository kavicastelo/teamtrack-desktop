import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { SUPABASE_CONFIG } from '../config/supabase.config';

export interface Message {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
}

@Injectable({
    providedIn: 'root'
})
export class SupabaseRealtimeService {
    private supabase: SupabaseClient;
    private channel: RealtimeChannel | null = null;
    private messagesSubject = new BehaviorSubject<Message[]>([]);
    public messages$: Observable<Message[]> = this.messagesSubject.asObservable();

    constructor() {
        this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    }

    public init(channelName: string = 'public-room', username: string) {
        // Get existing messages (optional: backend-free persistence is limited to current session or requires a DB)
        // For this "backend-free" realtime demo, we'll start empty or you could fetch persistent messages if you had a table.
        // Since request is "backend free" using "realtime", we focus on broadcast.

        this.channel = this.supabase.channel(channelName);

        this.channel
            .on('broadcast', { event: 'message' }, (payload) => {
                this.addMessage(payload['payload'] as Message);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`Subscribed to ${channelName}`);
                }
            });
    }

    public sendMessage(content: string, username: string) {
        if (!this.channel) return;

        const message: Message = {
            id: crypto.randomUUID(),
            sender: username,
            content: content,
            timestamp: new Date().toISOString()
        };

        // Broadcast the message to others
        this.channel.send({
            type: 'broadcast',
            event: 'message',
            payload: message
        });

        // Add to our own local list immediately
        this.addMessage(message);
    }

    private addMessage(message: Message) {
        const currentMessages = this.messagesSubject.value;
        this.messagesSubject.next([...currentMessages, message]);
    }

    public disconnect() {
        if (this.channel) {
            this.supabase.removeChannel(this.channel);
            this.channel = null;
        }
    }
}
