import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

/**
 * Pop-up around the shared comment section. Every page that used the old pop-up
 * (profile, client feeds, ...) now gets the same reactions, replies, edit and delete.
 * data = the post object (posts_uuid) or the uuid itself.
 */
@Component({
  selector: 'app-comment-modal-ui',
  templateUrl: './comment-modal-ui.component.html',
  styleUrls: ['./comment-modal-ui.component.css']
})
export class CommentModalUIComponent {
  postUuid = '';
  total = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<CommentModalUIComponent>
  ) {
    this.postUuid = typeof data === 'string' ? data : (data?.posts_uuid || data?.post_uuidOrUind || '');
    this.total = data?.comments_count ?? 0;
  }

  close(): void {
    this.dialogRef.close(this.total);
  }
}
