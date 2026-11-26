import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// right-to-left languages: set before Angular starts, so Material reads the right direction
document.documentElement.dir = sessionStorage.getItem('nx-dir') === 'rtl' ? 'rtl' : 'ltr';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
