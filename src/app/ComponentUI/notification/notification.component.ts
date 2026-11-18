import { Component, OnInit } from '@angular/core';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { ChatService } from 'src/app/services/chat.service';
import { ChatPopupComponent } from '../messages/chat-popup/chat-popup.component';
import { EchoService } from 'src/app/services/echo.service';
import { AuthService } from 'src/app/services/auth.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Optional } from '@angular/core';
import { NotificationDeliveryService, ActivityItem } from 'src/app/services/notification-delivery.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css']
})
export class NotificationComponent implements OnInit {
  notifications: any[] = [];
  isRead: any[] = [];
  totalUnreadMessages = 0;
  notificationCount = 0;
  isLoading:boolean = true;


  /** friend requests, accepted requests, reactions and comments: filtered on the server by the user's preferences */
  activity: ActivityItem[] = [];
  activityLoading = false;
  activityError = false;

  constructor(private notifyService: NotificationsService, private chatService: ChatService,
    private dialog: MatDialog,private echoService:EchoService,private authservice:AuthService,
    private delivery: NotificationDeliveryService, private router: Router, private routines: SharedRoutinesService,
    @Optional() private dialogRef: MatDialogRef<NotificationComponent>
  ) {}

  /** the Activity tab opens: load it, and once the user has seen it, mark it read */
  onTab(label: string): void {
    if (label === 'Activity') { this.loadActivity(true); }
  }

  loadActivity(markRead = false): void {
    this.activityLoading = true;
    this.activityError = false;
    this.delivery.fetchActivity().subscribe({
      next: res => {
        this.activity = Array.isArray(res?.data) ? res.data : [];
        this.activityLoading = false;
        if (markRead && this.activityUnreadCount() > 0) {
          this.delivery.markActivityRead().subscribe({ error: () => this.delivery.refreshActivity() });
        }
      },
      error: () => { this.activityLoading = false; this.activityError = true; }
    });
  }

  activityUnreadCount(): number { return this.activity.filter(a => a.unread).length; }

  openActivity(a: ActivityItem): void {
    const role = this.routines.getRole();
    const target = a.type === 'friend_request' ? ['/' + role + '/network']
      : a.type === 'friend_accept' && a.actor ? ['/' + role + '/profile', a.actor.code]
      : ['/' + role + '/profile'];                                  // reactions and comments are on your own posts
    this.dialogRef?.close();
    this.router.navigate(target);
  }

  activityIcon(a: ActivityItem): string {
    return a.type === 'friend_request' ? 'person_add' : a.type === 'friend_accept' ? 'how_to_reg' : a.type === 'reaction' ? 'thumb_up' : 'chat_bubble';
  }

  ago(iso: string): string {
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) { return 'Just now'; }
    const m = Math.floor(s / 60); if (m < 60) { return m + ' min ago'; }
    const h = Math.floor(m / 60); if (h < 24) { return h + ' h ago'; }
    const d = Math.floor(h / 24); return d < 7 ? d + ' d ago' : new Date(iso).toLocaleDateString();
  }

  ngOnInit(): void {
     this.loadNotifications();
     this.loadIsRead();
  }
  panelOpenState = false;
  unreadNotifications() {
    return this.notifications.filter(n => !n.is_read);
  }
  
  readNotifications() {
    return this.isRead.filter(n => n.is_read);
  
  }

  loadIsRead(): void {
    this.isLoading = true;
    this.chatService.getIsRead().subscribe({
      next: (res) => {
        this.isRead = res.notifications;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading notifications:', err);
      }
    });
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.chatService.getNotifications().subscribe({
      next: (res) => {
        this.notifications = res.notifications;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading notifications:', err);
      }
    });
  }
  

  chatHistory: { [key: number]: any[] } = {};
  openChat(notif: any): void {
      this.updateReadStatus(notif.id); // ✅ Update backend
      
  }
  markAllAsRead(): void {
    this.isLoading = true;
    this.chatService.markMessagesAllRead().subscribe({
      next: (res) => {
        this.notifyService.toastrInfo(res.message);
        this.isLoading = false;
        this.loadNotifications();
        this.loadIsRead();
      },
      error: (error) => {
        console.error('Error marking messages as read', error);
      }
    });
  }


  markAllAsReadxx() {
   // this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.isLoading = true;
    this.chatService.markMessagesAllRead().subscribe({
      next: (res) => {
        this.notifyService.toastrInfo(res.message);
        this.loadNotifications();
        this.loadIsRead();
        this.isLoading = false;
      },
      error: (err) => console.error("❌ Error marking messages as read:", err),
    });
  }

  updateReadStatus(id: number): void {
    this.isLoading = true;
    this.chatService.markMessagesAsRead(id).subscribe({
      next: (res) => {
        this.totalUnreadMessages = this.notifications.length;
       // this.notifyService.toastrInfo(res.message);
        this.totalUnreadMessages--; 
        this.loadNotifications();
        this.loadIsRead();
        this.isLoading = false;
      },
      error: (err) => console.error("❌ Error marking messages as read:", err),
    });
  }
  
  closeNotifications(): void {
    this.notifications = [];
  }
}
