import { Component, Input, OnInit } from '@angular/core';
import { LanguageService } from '../services/language.service';

/** The language button: lists the languages the administrator activated. */
@Component({
  selector: 'app-translate',
  templateUrl: './translate.component.html',
  styleUrls: ['./translate.component.css']
})
export class TranslateComponent implements OnInit {
  /** true = a labelled drop-down (Account Settings) instead of the icon button */
  @Input() asSelect = false;

  constructor(public languages: LanguageService) { }

  ngOnInit(): void {
    // first one starts it; shown again later (after signing in or out) it decides again whose language applies
    if (this.languages.isStarted) {
      this.languages.resolve();
    } else {
      this.languages.init();
    }
  }

  setLanguage(code: string): void { this.languages.choose(code); }
}
