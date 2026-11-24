import { buildCountryDials, cleanPhone, countryLabel, splitPhone, tidyNational, withoutRepeatedDial } from './phone-split';

describe('phone-split: a country code and a phone number that match', () => {
  const countries = buildCountryDials(
    { PH: '63', US: '1', CA: '1', BS: '1-242', GB: '44', KZ: '7', RU: '7', IT: '39', AU: '61' },
    { PH: 'Philippines', US: 'United States', CA: 'Canada', BS: 'Bahamas', GB: 'United Kingdom', KZ: 'Kazakhstan', RU: 'Russia', IT: 'Italy', AU: 'Australia' }
  );
  const split = (raw: string, home?: string) => { const s = splitPhone(raw, countries, home); return [s.country?.iso ?? null, s.national]; };

  it('builds the country list: ISO, dial code (as given) and name, sorted, skipping entries with no code', () => {
    const list = buildCountryDials({ ZZ: '', PH: '63', BS: '1-242' }, { PH: 'Philippines' });
    expect(list.map(c => c.iso)).toEqual(['BS', 'PH']);
    expect(list.find(c => c.iso === 'PH')!.name).toBe('Philippines');
    expect(list.find(c => c.iso === 'BS')!.name).toBe('');
    expect(countryLabel(list[1])).toBe('PH (+63)');
    expect(countryLabel(list[0])).toBe('BS (+1-242)');
  });

  describe('cleanPhone', () => {
    it('keeps a leading + and the digits, whatever the separators', () => {
      expect(cleanPhone('+63 917 123 4567')).toBe('+639171234567');
      expect(cleanPhone('+63-917-123-4567')).toBe('+639171234567');
      expect(cleanPhone('(+63) 917 123 4567')).toBe('+639171234567');
      expect(cleanPhone('0917 123 4567')).toBe('09171234567');
      expect(cleanPhone('  (0917) 123.4567 ')).toBe('09171234567');
      expect(cleanPhone('')).toBe('');
      expect(cleanPhone(null)).toBe('');
    });
    it('reads 00 at the start as +', () => {
      expect(cleanPhone('0063 917 123 4567')).toBe('+639171234567');
      expect(cleanPhone('00 44 7911 123456')).toBe('+447911123456');
    });
  });

  describe('an international number (+…)', () => {
    it('gets the country that owns the code, and the number without it', () => {
      expect(split('+639171234567')).toEqual(['PH', '9171234567']);
      expect(split('+63 917 123 4567')).toEqual(['PH', '9171234567']);
      expect(split('+447911123456')).toEqual(['GB', '7911123456']);
      expect(split('+61412345678')).toEqual(['AU', '412345678']);
    });
    it('uses the longest matching code: 1-242 is the Bahamas, not a +1 country', () => {
      expect(split('+12425551234')).toEqual(['BS', '5551234']);
    });
    it('a code several countries share goes to the one the person lives in, otherwise the first by ISO', () => {
      expect(split('+14155552671')).toEqual(['CA', '4155552671']);
      expect(split('+14155552671', 'United States')).toEqual(['US', '4155552671']);
      expect(split('+77011234567')).toEqual(['KZ', '7011234567']);
      expect(split('+77011234567', 'russia')).toEqual(['RU', '7011234567']);       // the name is matched without case
    });
    it('drops a trunk 0 after the code, except for Italy where it is part of the number', () => {
      expect(split('+6309171234567')).toEqual(['PH', '9171234567']);
      expect(split('+390612345678')).toEqual(['IT', '0612345678']);
    });
    it('an unknown code leaves the digits and no country: the person picks the code', () => {
      expect(split('+99912345678')).toEqual([null, '99912345678']);
    });
  });

  describe('a local number (no +)', () => {
    it('belongs to the person\'s own country when it is known, and loses the trunk 0', () => {
      expect(split('09171234567', 'Philippines')).toEqual(['PH', '9171234567']);
      expect(split('0917 123 4567', 'Philippines')).toEqual(['PH', '9171234567']);
      expect(split('9171234567', 'Philippines')).toEqual(['PH', '9171234567']);
    });
    it('the code written without a + is recognised only when the number is long enough to contain it', () => {
      expect(split('639171234567', 'Philippines')).toEqual(['PH', '9171234567']);
      expect(split('77011234567', 'Kazakhstan')).toEqual(['KZ', '7011234567']);
      expect(split('7011234567', 'Kazakhstan')).toEqual(['KZ', '7011234567']);   // a real KZ number that only begins with 7
    });
    it('with no country known there is nothing to match: the digits stay, no country is guessed', () => {
      expect(split('09171234567')).toEqual([null, '09171234567']);
      expect(split('09171234567', 'Atlantis')).toEqual([null, '09171234567']);
    });
  });

  it('nothing in, nothing out', () => {
    expect(split('')).toEqual([null, '']);
    expect(split('   ')).toEqual([null, '']);
    expect(splitPhone(undefined, countries).national).toBe('');
  });

  describe('tidyNational and withoutRepeatedDial', () => {
    it('drops the trunk 0 once a code is known, but not without one and not for Italy', () => {
      expect(tidyNational('09171234567', '63')).toBe('9171234567');
      expect(tidyNational('009171234567', '63')).toBe('9171234567');
      expect(tidyNational('09171234567', '')).toBe('09171234567');
      expect(tidyNational('0612345678', '39')).toBe('0612345678');
      expect(tidyNational('0917 123-4567', '+63')).toBe('9171234567');
    });
    it('drops a repeated country code only from a long enough number', () => {
      expect(withoutRepeatedDial('639171234567', '63')).toBe('9171234567');
      expect(withoutRepeatedDial('9171234567', '63')).toBe('9171234567');
      expect(withoutRepeatedDial('7011234567', '7')).toBe('7011234567');         // 10 digits: a real number starting with 7
      expect(withoutRepeatedDial('77011234567', '7')).toBe('7011234567');
      expect(withoutRepeatedDial('639171234567', '')).toBe('639171234567');
      expect(withoutRepeatedDial('639171234567', '1-242')).toBe('639171234567');
    });
  });
});
