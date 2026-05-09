import { useMemo } from 'react';
import type { Transaction } from '@/types/budget';

/**
 * Derives a "consecutive-day tracking streak" from the user's transactions:
 * how many distinct calendar days IN A ROW (ending today or yesterday)
 * have at least one logged transaction. Yesterday is allowed as the most
 * recent day so the streak survives a single missed day's grace period
 * up until the next morning.
 */
export function useStreak(transactions: Transaction[]): number {
  return useMemo(() => {
    if (!transactions.length) return 0;

    // Build a Set of YYYY-MM-DD strings the user logged on.
    const days = new Set<string>();
    for (const t of transactions) {
      if (t.isRecurring) continue; // recurring rule rows aren't user activity
      // t.date is already YYYY-MM-DD per types.
      if (typeof t.date === 'string' && t.date.length >= 10) {
        days.add(t.date.slice(0, 10));
      }
    }
    if (!days.size) return 0;

    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Walk back day-by-day from "today or yesterday" while we have a hit.
    let cursor = new Date(today);
    if (!days.has(fmt(cursor))) {
      // No transaction today — allow one day of grace by starting from yesterday.
      cursor.setDate(cursor.getDate() - 1);
      if (!days.has(fmt(cursor))) return 0;
    }
    let streak = 0;
    while (days.has(fmt(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [transactions]);
}
