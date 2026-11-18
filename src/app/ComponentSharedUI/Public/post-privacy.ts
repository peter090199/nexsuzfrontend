/**
 * Post privacy, one definition for the composer, the feeds and the profile.
 * The numbers are the existing posts.status values; Laravel enforces them (App\Helpers\PostVisibility).
 */
export interface PostPrivacy {
  value: number;
  label: string;
  icon: string;
  hint: string;
}

export const POST_PRIVACY: PostPrivacy[] = [
  { value: 1, label: 'Public',  icon: 'public', hint: 'Everyone can see and react' },
  { value: 2, label: 'Friends', icon: 'group',  hint: 'Only your accepted connections can see and react' },
  { value: 0, label: 'Private', icon: 'lock',   hint: 'Only you can see this post' },
];

/** Meta for a posts.status value; anything unknown is shown as Public (the column default). */
export function privacyOf(status: any): PostPrivacy {
  if (status === null || status === undefined || status === '') { return POST_PRIVACY[0]; }
  return POST_PRIVACY.find(p => p.value === Number(status)) || POST_PRIVACY[0];
}
