
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/**
 * Parses a price string or number into a number, handling various pt-BR and en-US formats.
 * @param input The price string (e.g., "2.235,00", "22.35", "2,235.00") or number.
 * @returns The parsed number, or NaN if invalid.
 */
export function parsePriceToNumber(input?: string | number): number {
  if (input === undefined || input === null) return NaN;
  if (typeof input === 'number') return input;

  let s = String(input).trim();

  // Remove currency symbols/spaces, keeping only digits and separators
  s = s.replace(/[^\d.,]/g, '');

  if (!s) return NaN;

  // Case with both comma and dot: the LAST separator is decimal
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const lastSep = Math.max(lastComma, lastDot);
    const intPart = s.slice(0, lastSep).replace(/[^\d]/g, '');
    const decPart = s.slice(lastSep + 1).replace(/[^\d]/g, '');
    return Number(`${intPart}.${decPart}`);
  }

  // Only comma
  if (s.includes(',')) {
    const parts = s.split(',');
    // Comma as thousands separator (e.g., "2,235" -> 2235)
    if (parts.length > 2 || (parts[1]?.length === 3 && parts[0].length > 0 && !s.includes('.'))) {
       return Number(s.replace(/,/g, ''));
    }
    // Comma as decimal separator
    return Number(parts.join('.').replace(/\.(?=\d{3}(\.|$))/g, ''));
  }

  // Only dot
  if (s.includes('.')) {
    const parts = s.split('.');
    // If the last part has 3 digits and there are more than 1 dots, it's likely thousands separator
    if (parts.length > 2) {
        const dec = parts.pop()!;
        const int = parts.join('');
        return Number(`${int}.${dec}`);
    }
    // A single dot is treated as a decimal point
    return Number(s);
  }

  // Only digits
  return Number(s);
}

/**
 * Formats a number into a BRL currency string.
 * @param value The number to format.
 * @returns The formatted currency string (e.g., "R$ 1.234,56").
 */
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Legacy formatCurrency, kept for compatibility, but new code should use formatBRL
export function formatCurrency(value: number | null | undefined): string {
  return formatBRL(value);
}
