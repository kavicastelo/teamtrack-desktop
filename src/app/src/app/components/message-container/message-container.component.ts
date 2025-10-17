import {Component, OnDestroy, OnInit} from '@angular/core';
import {MessageService} from '../../services/message.service';
import {Subscription} from 'rxjs';
import {UiMessage} from '../../models/ui-message.model';
import {NgClass, NgForOf} from '@angular/common';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-message-container',
  imports: [
    NgForOf,
    NgClass,
    MatIcon
  ],
  templateUrl: './message-container.component.html',
  styleUrl: './message-container.component.scss',
  standalone: true
})
export class MessageContainerComponent implements OnInit, OnDestroy {
  messages: UiMessage[] = [];
  private sub?: Subscription;

  constructor(private messageService: MessageService) {}

  ngOnInit() {
    this.sub = this.messageService.messages$.subscribe(
      (msgs) => (this.messages = msgs)
    );
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  dismiss(id: string) {
    this.messageService.remove(id);
  }

  icon(type: string) {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }

  trackById(index: number, msg: any): string {
    return msg.id;
  }
}
