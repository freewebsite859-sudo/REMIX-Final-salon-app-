/**
 * Date of Birth (DOB) validation helpers.
 *
 * DOB is a MANDATORY field for customer sign-up: it powers the birthday
 * reward bonus (see `src/lib/engagement.ts`) and age-restricted services,
 * so the account cannot be created without it.
 *
 * All dates are handled as plain `YYYY-MM-DD` strings (the value produced by
 * `<input type="date" />`) to avoid timezone drift.
 */

export const MIN_SIGNUP_AGE = 13;
export const MAX_SIGNUP_AGE = 120;

/** Format a Date as `YYYY-MM-DD` (local time, no timezone shift). */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Latest date a user may pick (today minus the minimum sign-up age). */
export function maxDobInputValue(today: Date = new Date()): string {
  const d = new Date(today.getFullYear() - MIN_SIGNUP_AGE, today.getMonth(), today.getDate());
  return toDateInputValue(d);
}

/** Earliest date a user may pick (today minus the maximum sign-up age). */
export function minDobInputValue(today: Date = new Date()): string {
  const d = new Date(today.getFullYear() - MAX_SIGNUP_AGE, today.getMonth(), today.getDate());
  return toDateInputValue(d);
}

/** Completed years between `dob` and `on`. Returns null for unparseable input. */
export function calculateAge(dob: string, on: Date = new Date()): number | null {
  const parsed = parseDob(dob);
  if (!parsed) return null;
  let age = on.getFullYear() - parsed.getFullYear();
  const monthDiff = on.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
}

function parseDob(dob: string): Date | null {
  const value = (dob || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  return parsed;
}

/**
 * Validate a DOB string.
 *
 * @returns an error message to show the user, or `null` when the value is valid.
 */
export function validateDateOfBirth(
  dob: string | undefined | null,
  options: { required?: boolean; today?: Date } = {}
): string | null {
  const { required = true, today = new Date() } = options;
  const value = (dob || '').trim();

  if (!value) {
    return required ? 'Date of birth is required.' : null;
  }

  const parsed = parseDob(value);
  if (!parsed) {
    return 'Please enter a valid date of birth (YYYY-MM-DD).';
  }

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (parsed.getTime() > startOfToday.getTime()) {
    return 'Date of birth cannot be in the future.';
  }

  const age = calculateAge(value, today);
  if (age === null) {
    return 'Please enter a valid date of birth (YYYY-MM-DD).';
  }
  if (age < MIN_SIGNUP_AGE) {
    return `You must be at least ${MIN_SIGNUP_AGE} years old to create an account.`;
  }
  if (age > MAX_SIGNUP_AGE) {
    return 'Please enter a valid date of birth.';
  }

  return null;
}
