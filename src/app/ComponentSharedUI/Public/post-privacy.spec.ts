import { POST_PRIVACY, privacyOf } from './post-privacy';

describe('post-privacy', () => {
  it('offers Public, Friends and Private with the posts.status numbers Laravel enforces', () => {
    expect(POST_PRIVACY.map(p => [p.label, p.value])).toEqual([['Public', 1], ['Friends', 2], ['Private', 0]]);
  });

  it('gives each level its own icon', () => {
    expect(privacyOf(1).icon).toBe('public');
    expect(privacyOf(2).icon).toBe('group');
    expect(privacyOf(0).icon).toBe('lock');
  });

  it('accepts the number as a string (it comes back from the API / form that way)', () => {
    expect(privacyOf('2').label).toBe('Friends');
    expect(privacyOf('0').label).toBe('Private');
  });

  it('falls back to Public (the column default) for missing or unknown values', () => {
    expect(privacyOf(undefined).label).toBe('Public');
    expect(privacyOf(null).label).toBe('Public');
    expect(privacyOf(7).label).toBe('Public');
  });
});
