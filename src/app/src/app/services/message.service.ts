import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { IpcService } from './ipc.service';
import { UiMessage } from '../models/ui-message.model';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private messages: UiMessage[] = [];
  private messageSubject = new BehaviorSubject<UiMessage[]>([]);
  messages$ = this.messageSubject.asObservable();
  private defaultTimeout = 3000;

  constructor(private ipc: IpcService) {
    this.listenToElectronMessages();
  }

  private listenToElectronMessages() {
    this.ipc.messageEvents$.subscribe((event) => {
      const { type, record } = event;
      if (!record?.message) return;
      this.push(type, record.message);
    });
  }

  push(type: UiMessage['type'], text: string) {
    const id = uuidv4();
    const msg: UiMessage = { id, type, text, createdAt: Date.now() };
    this.messages.push(msg);
    this.messageSubject.next([...this.messages]);

    // Auto-remove after timeout
    setTimeout(() => this.remove(id), this.defaultTimeout);
  }

  remove(id: string) {
    this.messages = this.messages.filter((m) => m.id !== id);
    this.messageSubject.next([...this.messages]);
  }
}
