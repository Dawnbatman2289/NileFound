/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Date formatting utility for NileFound
 * Enforces DD/MM/YYYY format across all campus views.
 */

export function formatDateDDMMYYYY(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '';

  try {
    if (typeof dateInput === 'string') {
      const dateOnly = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateOnly) {
        return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
      }
    }

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
    return parts;
  } catch {
    return String(dateInput);
  }
}

/**
 * Format relative time (e.g. "Just now", "5 min ago", "2 hr ago", "Yesterday", "3 days ago")
 */
export function formatRelativeTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '';
  try {
    const time = new Date(dateInput).getTime();
    if (isNaN(time)) return '';
    const now = Date.now();
    const diffSec = Math.floor((now - time) / 1000);

    if (diffSec < -60) return formatDateDDMMYYYY(dateInput);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 90) return '1 min ago';

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr === 1) return '1 hr ago';
    if (diffHr < 24) return `${diffHr} hr ago`;

    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return formatDateDDMMYYYY(dateInput);
  } catch {
    return '';
  }
}

/**
 * Returns today's calendar date (YYYY-MM-DD) in West Africa Time (Africa/Lagos).
 */
export function getTodayWatIsoDate(reference = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(reference);
  } catch {
    return reference.toISOString().split('T')[0];
  }
}
