export function normalizeNileEmail(email: string): string {
  return email.trim().toLowerCase();
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
