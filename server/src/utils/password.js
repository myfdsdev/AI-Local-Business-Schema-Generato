import crypto from 'node:crypto';

/**
 * Generates a login password on the app's behalf, for flows where nobody else
 * can supply one (store provisioning, admin-access claims).
 *
 * Returned to the caller EXACTLY ONCE and never recoverable afterwards — only a
 * bcrypt hash is stored. Ambiguous characters (0/O, 1/l/I) are excluded because
 * a human reads this out of an email and retypes it. Always satisfies
 * passwordSchema: 10+ characters with at least one letter and one number.
 */
export function generatePassword() {
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const DIGITS = '23456789';
  const SYMBOLS = '!@#$%*?';
  const pool = LETTERS + DIGITS + SYMBOLS;

  const pick = (set) => set[crypto.randomInt(0, set.length)];
  // Seed one of each required class, then fill to length.
  const chars = [pick(LETTERS), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < 16) chars.push(pick(pool));

  // Fisher-Yates so the seeded characters aren't always in the first positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default { generatePassword };
