import { describe, expect, it } from 'vitest';
import { activityToBalance, computeBudget, grandTotals, newYear, parseNum } from './calculator';

describe('budget calculator', () => {
  it('parses numeric strings with commas and blanks safely', () => {
    expect(parseNum('12,345.6')).toBe(12345.6);
    expect(parseNum('')).toBe(0);
    expect(parseNum('abc')).toBe(0);
  });

  it('computes personnel, allowance, indirect cost, VAT and remaining budget', () => {
    const year = newYear('1차년도', {
      totalRaw: '110000',
      rateRaw: '26.09',
      allowanceRateRaw: '20',
      vat: false,
      basis: 'direct',
      internal: [
        { id: 1, name: '내부연구원A', base: '800', months: '9', counted: true },
        { id: 2, name: '내부연구원B', base: '2400', months: '9', counted: false },
      ],
      external: [],
      student: [{ id: 3, name: '학생연구원A', base: '2000', months: '9' }],
      activityRaw: '15000',
      materialRaw: '10000',
    });

    const c = computeBudget(year);
    expect(c.intCounted).toBe(7200);
    expect(c.intAll).toBe(28800);
    expect(c.stu).toBe(18000);
    expect(c.personnelCounted).toBe(25200);
    expect(c.personnelAll).toBe(46800);
    expect(c.allowance).toBe(9360);
    expect(c.direct).toBe(59560);
    expect(Math.round(c.indirect)).toBe(15539);
    expect(Math.round(c.required)).toBe(75099);
    expect(Math.round(c.diff)).toBe(34901);
  });

  it('supports total-research-cost basis with VAT', () => {
    const year = newYear('위탁', {
      totalRaw: '100000',
      rateRaw: '22',
      vat: true,
      basis: 'total',
      internal: [{ id: 1, name: 'A', base: '1000', months: '10', counted: true }],
      allowanceRateRaw: '20',
      activityRaw: '20000',
      materialRaw: '30000',
    });
    const c = computeBudget(year);
    expect(Math.round(c.direct)).toBe(62000);
    expect(Math.round(c.indirect)).toBe(17487);
    expect(Math.round(c.vatAmt)).toBe(7949);
    expect(Math.round(c.required)).toBe(87436);
  });

  it('computes activity budget needed to make the remaining balance zero', () => {
    const year = newYear('1차년도', {
      totalRaw: '110000',
      rateRaw: '26.09',
      allowanceRateRaw: '20',
      vat: false,
      basis: 'direct',
      internal: [{ id: 1, name: 'A', base: '800', months: '9', counted: true }],
      student: [{ id: 2, name: 'B', base: '2000', months: '9' }],
      materialRaw: '10000',
    });
    const activity = activityToBalance(year);
    const balanced = computeBudget({ ...year, activityRaw: String(activity) });
    expect(Math.abs(balanced.diff)).toBeLessThan(1);
  });

  it('aggregates multi-year totals', () => {
    const years = [
      newYear('1차년도', { totalRaw: '100', activityRaw: '50', rateRaw: '0' }),
      newYear('2차년도', { totalRaw: '200', activityRaw: '80', rateRaw: '0' }),
    ];
    expect(grandTotals(years)).toEqual({ required: 130, total: 300, diff: 170 });
  });
});
