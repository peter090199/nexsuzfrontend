/**
 * Country code + phone number that belong together.
 *
 * The profile stores one string ("+639171234567", "09171234567", "+63 917 123 4567"); the Apply form has two fields, the country
 * (dial) code and the national number. These pure functions split the one into the two, so the code shown in the selector is the
 * code the number really has, and the number box never repeats it.
 */

export interface CountryDial {
  /** ISO 3166 alpha-2, e.g. "PH" */
  iso: string;
  /** the dial code as the country list gives it, e.g. "63", "1", "1-242" (no "+") */
  dial: string;
  /** the country name, e.g. "Philippines" (may be empty) */
  name: string;
}

export interface PhoneSplit {
  /** the country the number belongs to, or null when it can't be told (a local number and no country known) */
  country: CountryDial | null;
  /** the number without the country code and without a trunk "0": digits only */
  national: string;
}

/** "1-242" -> "1242" */
export function dialDigits(dial: string | null | undefined): string {
  return String(dial ?? '').replace(/\D/g, '');
}

/** the shape the country list API (country.io) returns: { phones: {ISO: dial}, names: {ISO: name} } */
export function buildCountryDials(phones: Record<string, any> | null | undefined, names: Record<string, string> | null | undefined): CountryDial[] {
  return Object.entries(phones || {})
    .map(([iso, dial]) => ({ iso, dial: String(dial), name: (names || {})[iso] || '' }))
    .filter(c => dialDigits(c.dial) !== '')
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

/** "PH (+63)": how a country appears in the code selector */
export function countryLabel(c: CountryDial): string { return `${c.iso} (+${c.dial})`; }

/** Keep a leading "+" and the digits: spaces, dashes, dots and brackets go; "00" at the start means "+". */
export function cleanPhone(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().replace(/^[^\d+]+/, '');        // "(+63) 917…" -> "+63) 917…"
  let digits = t.replace(/\D/g, '');
  const international = t.startsWith('+') || /^00\d/.test(t.replace(/[\s\-().]/g, ''));
  if (international && !t.startsWith('+')) { digits = digits.slice(2); }      // "00 63 917…" means "+63 917…"

  return international ? '+' + digits : digits;
}

/** A trunk "0" is dropped once the country is known (+63 917… not +63 0917…). Italy keeps it: its numbers really start with 0. */
export function tidyNational(national: string, dial: string | null | undefined): string {
  const digits = national.replace(/\D/g, '');
  const d = dialDigits(dial);
  if (!d || d === '39') { return digits; }

  return digits.replace(/^0+/, '');
}

/**
 * "639171234567" typed while country 63 is already chosen: the repeated code goes. The number must be long enough, so a real number that
 * only happens to begin with the code's digits (a +7 number starting with 7…) is left alone.
 */
export function withoutRepeatedDial(digits: string, dial: string | null | undefined): string {
  const d = dialDigits(dial);

  return d && digits.length >= 11 && digits.startsWith(d) && digits.length - d.length >= 9 ? digits.slice(d.length) : digits;
}

function pickCountry(candidates: CountryDial[], hintName?: string | null): CountryDial | null {
  if (!candidates.length) { return null; }
  const hint = (hintName || '').trim().toLowerCase();
  // several countries can share a code (+1, +7, +44): the one the person lives in wins, otherwise the first by ISO
  return (hint && candidates.find(c => c.name.toLowerCase() === hint)) || candidates[0];
}

/** Every country whose code is the longest prefix of these digits: "1242…" is the Bahamas (1-242), not a "+1" country. */
function countriesByPrefix(digits: string, countries: CountryDial[]): CountryDial[] {
  const matches = countries.filter(c => digits.startsWith(dialDigits(c.dial)));
  if (!matches.length) { return []; }
  const longest = Math.max(...matches.map(c => dialDigits(c.dial).length));

  return matches.filter(c => dialDigits(c.dial).length === longest);
}

/**
 * Split a stored phone number.
 *  - "+639171234567"   -> PH, "9171234567"          (an international number: the code is the longest matching one)
 *  - "09171234567"     -> PH, "9171234567"          (a local number: the country is the one named by `homeCountry`, if any)
 *  - "639171234567"    -> PH, "9171234567"          (code written without "+": only when the country is known and enough digits remain)
 *  - local number and no country known -> country null, digits kept as they are (the person picks the code)
 */
export function splitPhone(raw: string | null | undefined, countries: CountryDial[], homeCountry?: string | null): PhoneSplit {
  const cleaned = cleanPhone(raw);
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) { return { country: null, national: '' }; }

  if (cleaned.startsWith('+')) {
    const country = pickCountry(countriesByPrefix(digits, countries), homeCountry);
    if (country) { return { country, national: tidyNational(digits.slice(dialDigits(country.dial).length), country.dial) }; }

    return { country: null, national: digits };
  }

  const home = pickCountry(countries.filter(c => !!homeCountry && c.name.toLowerCase() === String(homeCountry).trim().toLowerCase()));
  if (!home) { return { country: null, national: digits }; }

  return { country: home, national: tidyNational(withoutRepeatedDial(digits, home.dial), home.dial) };
}
