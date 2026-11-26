import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export function menuKey(label: string): string {
  return 'nav_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Translates a menu label that is stored in English (database menus, group titles). A label with no translation
 * key is shown as it is.
 */
@Pipe({ name: 'nxMenu', pure: false })
export class MenuLabelPipe implements PipeTransform {
  constructor(private translate: TranslateService) { }

  transform(label: string | null | undefined): string {
    if (!label) { return ''; }
    const key = menuKey(label);
    const text = this.translate.instant(key);

    return text === key ? label : text;
  }
}
