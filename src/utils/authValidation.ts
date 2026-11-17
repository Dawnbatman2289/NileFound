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

export function resolveDisplayName(displayName?: string | null, email?: string | null): string {
  const cleanDisplay = (displayName || '').trim();
  if (cleanDisplay.length >= 2) {
    const firstToken = cleanDisplay.split(/\s+/)[0] || cleanDisplay;
    if (firstToken.length >= 2) return firstToken.slice(0, 100);
    return cleanDisplay.slice(0, 100);
  }
  const localPart = (email || '').trim().split('@')[0] || '';
  if (localPart.length >= 2) return localPart.slice(0, 100);
  return 'Campus User';
}

export interface TokenRefreshableUser {
  emailVerified: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult?: (forceRefresh?: boolean) => Promise<{ claims?: Record<string, unknown> }>;
}

/**
 * After reload() marks emailVerified = true, Firebase Auth's cached JWT can still
 * carry email_verified: false for up to an hour unless force-refreshed.
 */
export async function ensureFreshVerifiedIdToken(fbUser: TokenRefreshableUser): Promise<string> {
  if (fbUser.emailVerified && typeof fbUser.getIdTokenResult === 'function') {
    const result = await fbUser.getIdTokenResult(false);
    if (result?.claims?.email_verified !== true) {
      return fbUser.getIdToken(true);
    }
    return fbUser.getIdToken(false);
  }
  return fbUser.getIdToken(Boolean(fbUser.emailVerified));
}

