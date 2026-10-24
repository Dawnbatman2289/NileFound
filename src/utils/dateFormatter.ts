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
