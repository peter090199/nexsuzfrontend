import { Component } from '@angular/core';

/**
 * The /message page. All of the messaging UI lives in <app-messenger-chat> and talks to the real API;
 * this wrapper deliberately holds no data (it used to hold hard-coded sample contacts and messages).
 */
@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent { }
