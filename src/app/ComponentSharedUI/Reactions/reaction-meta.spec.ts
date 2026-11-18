import { REACTIONS, applyMyReaction, emptySummary, reactionOf } from './reaction-meta';

describe('reaction-meta', () => {
  it('offers the seven Facebook-style reactions, Care included', () => {
    expect(REACTIONS.map(r => r.label)).toEqual(['Like', 'Love', 'Care', 'Haha', 'Wow', 'Sad', 'Angry']);
    expect(reactionOf('Care')?.emoji).toBe('🤗');
    expect(reactionOf('Nope')).toBeUndefined();
    expect(reactionOf(null)).toBeUndefined();
  });

  describe('applyMyReaction (instant count updates)', () => {
    it('adds a first reaction to an empty summary', () => {
      const s = applyMyReaction(emptySummary(), 'Love');
      expect(s).toEqual({ total: 1, breakdown: [{ reaction: 'Love', count: 1 }], mine: 'Love' });
    });

    it('treats a missing summary like an empty one', () => {
      expect(applyMyReaction(undefined, 'Like').total).toBe(1);
      expect(applyMyReaction(null, null).total).toBe(0);
    });

    it('changing a reaction moves the vote instead of adding a second one', () => {
      const before = { total: 3, breakdown: [{ reaction: 'Like', count: 2 }, { reaction: 'Love', count: 1 }], mine: 'Like' };
      const after = applyMyReaction(before, 'Love');
      expect(after.total).toBe(3);                                            // still one vote per user
      expect(after.mine).toBe('Love');
      expect(after.breakdown).toEqual([{ reaction: 'Love', count: 2 }, { reaction: 'Like', count: 1 }]);
    });

    it('removing the reaction takes the vote away and drops an empty group', () => {
      const before = { total: 2, breakdown: [{ reaction: 'Wow', count: 1 }, { reaction: 'Sad', count: 1 }], mine: 'Wow' };
      const after = applyMyReaction(before, null);
      expect(after.total).toBe(1);
      expect(after.mine).toBeNull();
      expect(after.breakdown).toEqual([{ reaction: 'Sad', count: 1 }]);
    });

    it('keeps the breakdown sorted by popularity', () => {
      const before = { total: 3, breakdown: [{ reaction: 'Haha', count: 2 }, { reaction: 'Like', count: 1 }], mine: null };
      const after = applyMyReaction(before, 'Like');
      expect(after.breakdown[0]).toEqual({ reaction: 'Haha', count: 2 });
      expect(after.breakdown[1]).toEqual({ reaction: 'Like', count: 2 });
    });

    it('never modifies the summary it was given', () => {
      const before = { total: 1, breakdown: [{ reaction: 'Like', count: 1 }], mine: 'Like' };
      const snapshot = JSON.stringify(before);
      applyMyReaction(before, 'Love');
      expect(JSON.stringify(before)).toBe(snapshot);
    });
  });
});
