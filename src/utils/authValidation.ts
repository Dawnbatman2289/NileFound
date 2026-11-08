export function normalizeNileEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateNileEmail(email: string): boolean {
  return /^[^\s@]+@nileuniversity\.edu\.ng$/i.test(normalizeNileEmail(email));
}

export function validatePassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function isOtpCurrent(createdAt: number, now = Date.now(), ttlMs = 10 * 60 * 1000): boolean {
  return createdAt <= now && now - createdAt < ttlMs;
}

export function generateOtpCode(random: () => number = Math.random): string {
  return Math.floor(random() * 1_000_000).toString().padStart(6, '0');
}

export function validateOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
