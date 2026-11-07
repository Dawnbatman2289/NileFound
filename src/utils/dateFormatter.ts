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
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      // In case dateInput is already a 'YYYY-MM-DD' string
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [year, month, day] = dateInput.split('-');
        return `${day}/${month}/${year}`;
      }
      return String(dateInput);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
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

