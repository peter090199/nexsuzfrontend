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
export interface FeedItem {
  kind: 'message' | 'activity';
  unread: boolean;
  date: string;
  message?: any;
  activity?: ActivityItem;
}

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

  /** LinkedIn-style feed: messages + activity in one list, newest first, filtered by the pills on top */
  filter: 'all' | 'messages' | 'activity' = 'all';
  feed: FeedItem[] = [];

  setFilter(f: 'all' | 'messages' | 'activity'): void {
    this.filter = f;
    if (f === 'activity' && this.activityUnreadCount() > 0) {
      this.delivery.markActivityRead().subscribe({ error: () => this.delivery.refreshActivity() });
    }
  }

  visibleFeed(): FeedItem[] {
    return this.filter === 'all' ? this.feed : this.feed.filter(i => i.kind === (this.filter === 'messages' ? 'message' : 'activity'));
  }

  count(kind: 'message' | 'activity'): number { return this.feed.filter(i => i.kind === kind && i.unread).length; }

  private rebuild(): void {
    const msgs: FeedItem[] = [...this.notifications.map(n => ({ n, unread: true })), ...this.isRead.filter(n => n.is_read).map(n => ({ n, unread: false }))]
      .map(x => ({ kind: 'message' as const, unread: x.unread, date: x.n.created_at, message: x.n }));
    const acts: FeedItem[] = this.activity.map(a => ({ kind: 'activity' as const, unread: !!a.unread, date: a.created_at, activity: a }));
    this.feed = [...msgs, ...acts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /** click a notification: mark it read and go to where it came from */
  open(item: FeedItem): void {
    if (item.kind === 'activity') { this.openActivity(item.activity!); return; }
    const m = item.message;
    if (item.unread) { this.chatService.markMessagesAsRead(m.id).subscribe({ error: () => {} }); }
    this.dialogRef?.close();
    this.delivery.openConversation(m.sender_id);
  }

  loadActivity(markRead = false): void {
    this.activityLoading = true;
    this.activityError = false;
    this.delivery.fetchActivity().subscribe({
      next: res => {
        this.activity = Array.isArray(res?.data) ? res.data : [];
        this.activityLoading = false;
        this.rebuild();
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
      : a.type === 'job_application' ? ['/' + role + '/candidates']
      : a.type === 'job_interview' || a.type === 'job_status' || a.type === 'job_review' ? ['/' + role + '/applied-jobs']
      : a.type === 'friend_accept' && a.actor ? ['/' + role + '/profile', a.actor.code]
      : a.type === 'announcement' ? ['/' + role + '/home']                       // announcements are at the top of the Home feed
      : ['/' + role + '/profile'];                                  // reactions and comments are on your own posts
    this.dialogRef?.close();
    this.router.navigate(target);
  }

  activityIcon(a: ActivityItem): string {
    const icons: any = { announcement: 'campaign', friend_request: 'person_add', friend_accept: 'how_to_reg', reaction: 'thumb_up', comment: 'chat_bubble', job_application: 'work', job_interview: 'event', job_status: 'verified', job_review: 'rate_review' };
    return icons[a.type] || 'notifications';
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
     this.loadActivity();
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
        this.isRead = res.notifications; this.rebuild();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading notifications:', err); this.isLoading = false;
      }
    });
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.chatService.getNotifications().subscribe({
      next: (res) => {
        this.notifications = res.notifications; this.rebuild();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading notifications:', err); this.isLoading = false;
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
