export function normalizeNileEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'ayomide2289@gmail.com';

export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return normalizeNileEmail(email) === BOOTSTRAPPED_ADMIN_EMAIL;
}

export function validateNileEmail(email: string): boolean {
  return /^[^\s@]+@nileuniversity\.edu\.ng$/i.test(normalizeNileEmail(email));
}

export function validatePassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function validateFullName(name: string): boolean {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(name.trim())
    && name.trim().length >= 2
    && name.trim().length <= 100;
}
