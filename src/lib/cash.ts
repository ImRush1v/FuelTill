import { NZD, type Count } from '../types/cash';

export const formatNZD = (cents: number) => new Intl.NumberFormat('en-NZ', {
  style: 'currency', currency: 'NZD'
}).format(cents / 100);

export function totalCents(counts: Count): number {
  return NZD.reduce((sum, d, i) => sum + d.cents * (counts[i] ?? 0), 0);
}

export type DropPlan = {
  removed: Count;
  remaining: Count;
  dropCents: number;
  remainingCents: number;
  carryForwardCents: number;
};

/**
 * All money is handled in integer cents. Coin quantities are never removed.
 * Finds the largest available banknote drop that leaves the drawer within
 * [target, target + tolerance]. Returns null if that is impossible.
 */
export function calculateDrop(counts: Count, targetCents = 30000, toleranceCents = 499): DropPlan | null {
  if (counts.length !== NZD.length || counts.some(n => !Number.isSafeInteger(n) || n < 0)) return null;
  if (!Number.isSafeInteger(targetCents) || targetCents < 0 ||
      !Number.isSafeInteger(toleranceCents) || toleranceCents < 0) return null;

  const total = totalCents(counts);
  if (!Number.isSafeInteger(total) || total < targetCents) return null;

  const maxDrop = total - targetCents;
  // Bounded knapsack in $5 units, using binary-split note batches.
  // Typed arrays avoid the old Map expansion and Math.max(...keys) limits.
  const noteIndices = [9, 8, 7, 6, 5];
  const unit = 500;
  const cap = Math.floor(maxDrop / unit);
  const reachable = new Uint8Array(cap + 1);
  const previous = new Int32Array(cap + 1);
  const usedIndex = new Int8Array(cap + 1);
  const usedQuantity = new Int32Array(cap + 1);
  reachable[0] = 1;
  let highest = 0;

  for (const i of noteIndices) {
    const noteUnits = NZD[i].cents / unit;
    let quantity = counts[i];
    let batch = 1;
    while (quantity > 0) {
      const take = Math.min(batch, quantity);
      const weight = take * noteUnits;
      for (let sum = Math.min(cap, highest + weight); sum >= weight; sum--) {
        if (!reachable[sum] && reachable[sum - weight]) {
          reachable[sum] = 1;
          previous[sum] = sum - weight;
          usedIndex[sum] = i;
          usedQuantity[sum] = take;
        }
      }
      highest = Math.min(cap, highest + weight);
      quantity -= take;
      batch *= 2;
    }
  }

  let best = cap;
  while (best > 0 && !reachable[best]) best--;
  const removed: Count = Array(NZD.length).fill(0);
  let cursor = best;
  while (cursor > 0) {
    const i = usedIndex[cursor];
    removed[i] += usedQuantity[cursor];
    cursor = previous[cursor];
  }
  const remaining = counts.map((quantity, i) => quantity - removed[i]);
  const dropCents = totalCents(removed);
  const remainingCents = totalCents(remaining);

  if (remainingCents > targetCents + toleranceCents) return null;
  if (dropCents !== best * unit || remainingCents + dropCents !== total) return null;
  if (remaining.some(n => n < 0)) return null;

  return {
    removed,
    remaining,
    dropCents,
    remainingCents,
    carryForwardCents: remainingCents - targetCents
  };
}

/** Plain text for pasting into a handover note or station reconciliation sheet. */
export function shiftSummary(
  station: string, register: string, shift: string, counts: Count, plan: DropPlan
): string {
  const lines = [
    `FuelTill — ${station} | ${register} | ${shift}`,
    `Total counted: ${formatNZD(totalCents(counts))}`,
    `Cash drop: ${formatNZD(plan.dropCents)}`,
    `Leave in drawer: ${formatNZD(plan.remainingCents)}`,
    `Carry forward: ${formatNZD(plan.carryForwardCents)}`,
    '',
    'NOTES TO REMOVE (CASH DROP)',
    ...NZD.flatMap((d, i) => plan.removed[i] > 0
      ? [`${d.label} x ${plan.removed[i]} = ${formatNZD(d.cents * plan.removed[i])}`] : []),
    `Cash drop total: ${formatNZD(plan.dropCents)}`,
    '',
    'FINAL DRAWER — WRITE THESE QUANTITIES ON THE SHEET',
    ...NZD.map((d, i) => `${d.label}: ${plan.remaining[i]} x ${formatNZD(d.cents)} = ${formatNZD(d.cents * plan.remaining[i])}`),
    `FINAL DRAWER TOTAL: ${formatNZD(plan.remainingCents)}`,
    '',
    'Verify against physical cash before completing the station reconciliation.'
  ];
  return lines.join('\n');
}
