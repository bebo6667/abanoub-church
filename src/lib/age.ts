/** Age helpers — العمر يُحسب تلقائيًا من تاريخ الميلاد مقارنةً بتاريخ اليوم. */

export function computeAge(dob?: string | null, at: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = at.getFullYear() - d.getFullYear();
  const m = at.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** العمر المحسوب من تاريخ الميلاد، وإلا العمر المُدخل يدويًا. */
export function effectiveAge(dob?: string | null, fallback?: number | null): number | null {
  return computeAge(dob) ?? fallback ?? null;
}

/** العمر الذي سيبلغه صاحب تاريخ الميلاد في عيد ميلاده بهذا الشهر/السنة. */
export function turningAge(dob: string, year: number): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const age = year - d.getFullYear();
  return age > 0 && age < 130 ? age : null;
}

export function birthMonth(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  return Number.isNaN(d.getTime()) ? null : d.getMonth() + 1;
}

export function birthDay(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  return Number.isNaN(d.getTime()) ? null : d.getDate();
}

export const MONTH_NAMES_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function formatBirthDate(dob: string): string {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return dob;
  return `${d.getDate()} ${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`;
}
