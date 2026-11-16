export function normalizeNileEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateNileEmail(email: string): boolean {
  return /^[^\s@]+@nileuniversity\.edu\.ng$/i.test(normalizeNileEmail(email));
}

export function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeNileEmail(email));
}

export function validatePassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function validateFullName(name: string): boolean {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(name.trim())
    && name.trim().length >= 2
    && name.trim().length <= 100;
}

export function isCampusAccountAllowed(params: {
  email?: string | null;
  emailVerified?: boolean;
  isMasterAdmin?: boolean;
  isDelegatedAdmin?: boolean;
}): boolean {
  if (!params.email || !params.emailVerified) return false;
  if (params.isMasterAdmin || params.isDelegatedAdmin) return true;
  return validateNileEmail(params.email);
}
