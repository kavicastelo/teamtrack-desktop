import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'isBirthday', standalone: true})
export class IsBirthdayPipe implements PipeTransform {
  transform(e: any) {
    return e?.eventType === 'birthday';
  }
}

@Pipe({name: 'isRecurring', standalone: true})
export class IsRecurringPipe implements PipeTransform {
  transform(e: any) {
    return !!e?.recurringEventId;
  }
}

@Pipe({name: 'visibilityIcon', standalone: true})
export class VisibilityIconPipe implements PipeTransform {
  transform(e: any) {
    return e?.visibility === 'private' ? '🔒' : '🌐';
  }
}

@Pipe({name: 'allDay', standalone: true})
export class AllDayPipe implements PipeTransform {
  transform(e: any) {
    return !!e?.start?.date;
  }
}

@Pipe({name: 'creatorName', standalone: true})
export class CreatorNamePipe implements PipeTransform {
  transform(e: any) {
    return e?.organizer?.email || e?.creator?.email || '';
  }
}
