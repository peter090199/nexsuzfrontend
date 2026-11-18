/** The six reactions NEXSUZ offers (Laravel's App\Helpers\ReactionSummary::ALLOWED also still accepts the old "Care"). */
export interface ReactionDef {
  label: string;
  emoji: string;
  color: string;
}

export const REACTIONS: ReactionDef[] = [
  { label: 'Like', emoji: '👍', color: '#0a66c2' },
  { label: 'Love', emoji: '❤️', color: '#e0245e' },
  { label: 'Haha', emoji: '😂', color: '#d9951a' },
  { label: 'Wow', emoji: '😮', color: '#d9951a' },
  { label: 'Sad', emoji: '😢', color: '#d9951a' },
  { label: 'Angry', emoji: '😡', color: '#d4560b' },
];

/** Reactions saved before the picker was reduced to six: they must keep their face and colour. */
const LEGACY_REACTIONS: ReactionDef[] = [
  { label: 'Care', emoji: '🤗', color: '#d9951a' },
];

export function reactionOf(label?: string | null): ReactionDef | undefined {
  return REACTIONS.find(r => r.label === label) || LEGACY_REACTIONS.find(r => r.label === label);
}

export interface ReactionSummaryData {
  total: number;
  breakdown: { reaction: string; count: number }[];
  mine: string | null;
}

export const emptySummary = (): ReactionSummaryData => ({ total: 0, breakdown: [], mine: null });

/**
 * Recalculate a summary locally when the current user's reaction changes (null = removed),
 * so the counts move instantly; the server's own summary replaces it a moment later.
 * Pure function: the input is never modified.
 */
export function applyMyReaction(summary: ReactionSummaryData | null | undefined, next: string | null): ReactionSummaryData {
  const base = summary || emptySummary();
  const counts = new Map<string, number>(base.breakdown.map(b => [b.reaction, b.count] as [string, number]));

  if (base.mine) {
    const left = (counts.get(base.mine) || 0) - 1;
    left > 0 ? counts.set(base.mine, left) : counts.delete(base.mine);
  }
  if (next) {
    counts.set(next, (counts.get(next) || 0) + 1);
  }

  const breakdown = Array.from(counts.entries())
    .map(([reaction, count]) => ({ reaction, count }))
    .sort((a, b) => b.count - a.count);

  return { total: breakdown.reduce((n, b) => n + b.count, 0), breakdown, mine: next };
}
