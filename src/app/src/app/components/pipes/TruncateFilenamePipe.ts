import {Pipe} from '@angular/core';

@Pipe({
  name: 'truncateFilename',
  standalone: true
})
export class TruncateFilenamePipe {
  transform(value: string, maxLength: number): string {
    let extension: string | undefined = value.split('.').pop();
    if (extension) {
      maxLength -= extension.length + 1;
    }
    if (value.length <= maxLength) {
      return value;
    }
    return value.substr(0, maxLength) + '...'+ extension;
  }
}
