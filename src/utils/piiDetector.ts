/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PII Detection Utility for NileFound
 * Prevents students from posting matric numbers, phone numbers, or email addresses
 * in public item titles or descriptions.
 */

// Matches Nigerian matriculation numbers (e.g. 23/0481, 24/ENG/0192, 2023/10293) and 9-digit student IDs (e.g. 201203045)
const MATRIC_REGEX = /\b(?:\d{2}|\d{4})\/(?:[A-Za-z]{2,5}\/)?\d{2,6}\b|\b\d{9}\b/i;

// Matches Nigerian phone numbers: 08031234567, +2348031234567, 2348031234567, or spaced/dashed variants
const NIGERIAN_PHONE_REGEX =
  /(?:\+?234|0)[789][01]\d{8}\b|(?:\+?234[\s.-]?[789][01]\d|0[789][01]\d)[\s.-]?\d{3}[\s.-]?\d{4}\b/;

// Matches standard email addresses
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

export interface PiiCheckResult {
  hasPii: boolean;
  type?: 'matric' | 'phone' | 'email';
  matchedText?: string;
  errorMessage?: string;
}

/**
 * Checks a string for sensitive personal identifiable information (PII).
 * Returns whether PII was detected and a plain error message.
 */
export function detectPii(text: string): PiiCheckResult {
  if (!text) return { hasPii: false };

  // Check phone numbers first so 11-digit/13-digit numbers are categorized accurately
  const phoneMatch = text.match(NIGERIAN_PHONE_REGEX);
  if (phoneMatch) {
    return {
      hasPii: true,
      type: 'phone',
      matchedText: phoneMatch[0],
      errorMessage: 'Remove the phone number. Contact only happens after your claim is approved.'
    };
  }

  // Check for matric number (slash format or 9-digit student ID)
  const matricMatch = text.match(MATRIC_REGEX);
  if (matricMatch) {
    return {
      hasPii: true,
      type: 'matric',
      matchedText: matricMatch[0],
      errorMessage: 'Remove the matric number. Identity details must stay private.'
    };
  }

  // Check for email address
  const emailMatch = text.match(EMAIL_REGEX);
  if (emailMatch) {
    return {
      hasPii: true,
      type: 'email',
      matchedText: emailMatch[0],
      errorMessage: 'Remove the email address. Contact only happens after your claim is approved.'
    };
  }

  return { hasPii: false };
}
