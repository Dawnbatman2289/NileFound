/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PII Detection Utility for NileFound
 * Prevents students from posting matric numbers, phone numbers, or email addresses
 * in public item titles or descriptions.
 */

// Matches Nigerian matriculation numbers like 23/0481, 24/ENG/0192, 22/LAW/1203, 2023/10293
const MATRIC_REGEX = /\b(?:\d{2}|\d{4})\/(?:[A-Za-z]{2,5}\/)?\d{2,6}\b/i;

// Matches Nigerian phone numbers: 080..., 070..., 090..., 081..., +234..., 234...
const NIGERIAN_PHONE_REGEX = /(?:\+?234[\s.-]?[789][01]\d|0[789][01]\d)[\s.-]?\d{3}[\s.-]?\d{4}\b/;

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

  // Check for matric number
  const matricMatch = text.match(MATRIC_REGEX);
  if (matricMatch) {
    return {
      hasPii: true,
      type: 'matric',
      matchedText: matricMatch[0],
      errorMessage: 'Remove the matric number. Identity details must stay private.'
    };
  }

  // Check for phone number
  const phoneMatch = text.match(NIGERIAN_PHONE_REGEX);
  if (phoneMatch) {
    return {
      hasPii: true,
      type: 'phone',
      matchedText: phoneMatch[0],
      errorMessage: 'Remove the phone number. Contact only happens after your claim is approved.'
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
