import { describe, expect, it } from 'vitest';
import { NZD } from '../types/cash';
import { calculateDrop, shiftSummary, totalCents } from './cash';

const empty = () => Array(NZD.length).fill(0);

describe('cash reconciliation', () => {
  it('counts denomination quantities in integer cents', () => {
    const c=empty(); c[0]=3; c[3]=2; c[7]=1;
    expect(totalCents(c)).toBe(2230);
  });

  it('keeps all coins and drops notes to reach the allowed range', () => {
    const c=empty(); c[0]=7; c[7]=14; c[8]=10;
    const plan = calculateDrop(c)!;
    expect(plan).toMatchObject({dropCents:48000,remainingCents:30070,carryForwardCents:70});
    expect(plan.remaining[0]).toBe(7);
    expect(totalCents(plan.remaining)).toBe(plan.remainingCents);
    expect(totalCents(plan.removed)).toBe(plan.dropCents);
  });

  it('handles Shift 1 POS 1: $461.50 counted, $160 dropped, $301.50 remaining', () => {
    // Illustrative ORIGINAL denominations; the original quantities were not provided.
    // Coins: $1.50; notes: 2 x $50 + 3 x $20 + 30 x $10 = $460.
    const c=empty(); c[2]=1; c[3]=1; c[6]=30; c[7]=3; c[8]=2;
    const plan = calculateDrop(c)!;
    expect(totalCents(c)).toBe(46150);
    expect(plan.dropCents).toBe(16000);
    expect(plan.removed[8]).toBe(2);
    expect(plan.removed[7]).toBe(3);
    expect(plan.remainingCents).toBe(30150);
    expect(plan.carryForwardCents).toBe(150);
    expect(plan.remaining[2]).toBe(1);
    expect(plan.remaining[3]).toBe(1);
    expect(plan.remaining[6]).toBe(30);
    expect(plan.remaining[7]).toBe(0);
    expect(plan.remaining[8]).toBe(0);
    expect(plan.remaining.every((quantity, i) => quantity === c[i] - plan.removed[i])).toBe(true);
    expect(totalCents(plan.remaining)).toBe(30150);
    const summary = shiftSummary('Test Station', 'POS 1', 'Shift 1', c, plan);
    expect(summary).toContain('$50 x 2 = $100.00');
    expect(summary).toContain('$20 x 3 = $60.00');
    expect(summary).toContain('$10: 30 x $10.00 = $300.00');
    expect(summary).toContain('FINAL DRAWER TOTAL: $301.50');
    expect(summary).toContain('Carry forward: $1.50');
  });

  it('rejects insufficient drawer cash', () => {
    const c=empty(); c[7]=10; expect(calculateDrop(c)).toBeNull();
  });
  it('does not recommend a drop when no note combination fits', () => {
    const c=empty(); c[8]=6; c[4]=6; expect(calculateDrop(c)).toBeNull();
  });
  it('does not remove coins', () => {
    const c=empty(); c[4]=153; expect(calculateDrop(c)).toBeNull();
  });
});

describe('high-value drops', () => {
  it('supports a drop above $5,000 without a cap', () => {
    const c = empty(); c[9] = 60; c[7] = 15; c[3] = 3;
    const plan = calculateDrop(c)!;
    expect(plan.dropCents).toBe(600000);
    expect(plan.remainingCents).toBe(30300);
    expect(plan.removed[9]).toBe(60);
    expect(totalCents(plan.remaining) + totalCents(plan.removed)).toBe(totalCents(c));
  });
});
