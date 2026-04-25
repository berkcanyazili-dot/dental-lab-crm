import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Advance `receivedDate` by `turnaroundDays` **business days**, automatically
 * skipping Saturdays (day 6) and Sundays (day 0).
 *
 * Examples:
 *   calculateDueDate(Friday, 1)  → Monday  (skips the weekend)
 *   calculateDueDate(Monday, 3)  → Thursday
 *   calculateDueDate(Thursday, 2)→ Monday  (skips Sat/Sun)
 */
export function calculateDueDate(receivedDate: Date, turnaroundDays: number): Date {
  const result = new Date(receivedDate);
  let remaining = Math.max(0, Math.floor(turnaroundDays));
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay(); // 0 = Sun, 6 = Sat
    if (dow !== 0 && dow !== 6) {
      remaining--;
    }
  }
  return result;
}
