import {Pipe} from '@angular/core';

@Pipe({
  name: 'numberConcat',
  standalone: true
})
export class NumberConcatPipe {
  transform(value: number, ...args: unknown[]): unknown {
    if (value > 1000) return `${(value / 1000).toFixed(1)}k`;
    if (value > 1000000) return `${(value / 1000000).toFixed(1)}M`;
    return value;
  }
}
