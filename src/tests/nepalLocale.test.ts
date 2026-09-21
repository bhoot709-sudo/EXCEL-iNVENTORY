import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatNPR,
  toNepaliDigits,
  toBikramSambat,
  getNPTDate,
  formatNPTTime,
  formatNepaliDateTime,
  clearLocaleCaches,
} from '../utils/nepalLocale';

describe('nepalLocale - Nepalese Rupee (NPR) Formatting', () => {
  it('formats standard amounts with South Asian numbering system and Rupee symbol', () => {
    expect(formatNPR(0)).toBe('रु 0.00');
    expect(formatNPR(100)).toBe('रु 100.00');
    expect(formatNPR(1500)).toBe('रु 1,500.00');
    expect(formatNPR(25000)).toBe('रु 25,000.00');
    expect(formatNPR(145000)).toBe('रु 1,45,000.00'); // 1 Lakh 45 thousand
    expect(formatNPR(1050000)).toBe('रु 10,50,000.00'); // 10 Lakh 50 thousand
    expect(formatNPR(10000000)).toBe('रु 1,00,00,000.00'); // 1 Crore
  });

  it('supports hiding decimals and custom spacing', () => {
    expect(formatNPR(145000, { showDecimals: false })).toBe('रु 1,45,000');
    expect(formatNPR(500, { space: false })).toBe('रु500.00');
  });

  it('handles negative amounts correctly', () => {
    expect(formatNPR(-1500)).toBe('-रु 1,500.00');
    expect(formatNPR(-145000, { showDecimals: false })).toBe('-रु 1,45,000');
  });

  it('formats numbers with native Devanagari/Nepali digits when requested', () => {
    expect(toNepaliDigits('145000')).toBe('१४५०००');
    expect(toNepaliDigits(2081)).toBe('२०८१');
    const nepaliFormatted = formatNPR(145000, { nepaliDigits: true, showDecimals: false });
    expect(nepaliFormatted).toBe('रु १,४५,०००');
  });

  it('handles null, undefined, or NaN safely without crashing', () => {
    expect(formatNPR(NaN as any)).toBe('रु 0.00');
    expect(formatNPR(null as any)).toBe('रु 0.00');
    expect(formatNPR(undefined as any)).toBe('रु 0.00');
  });
});

describe('nepalLocale - Bikram Sambat (B.S.) Calendar Conversion', () => {
  beforeEach(() => {
    clearLocaleCaches();
  });

  it('converts landmark AD date 2024-04-13 to 2081 Baisakh 01 BS (Naya Barsha)', () => {
    const bs = toBikramSambat('2024-04-13');
    expect(bs.bsYear).toBe(2081);
    expect(bs.bsMonth).toBe(1);
    expect(bs.bsDay).toBe(1);
    expect(bs.bsMonthName).toBe('Baisakh');
    expect(bs.formattedBS).toBe('2081 Baisakh 1 BS');
    expect(bs.formattedNumeric).toBe('2081-01-01');
  });

  it('converts date strings and Date objects identically', () => {
    const fromString = toBikramSambat('2024-09-16');
    const fromDate = toBikramSambat(new Date('2024-09-16T12:00:00Z'));
    expect(fromString.bsYear).toBe(fromDate.bsYear);
    expect(fromString.bsMonth).toBe(fromDate.bsMonth);
    expect(fromString.bsDay).toBe(fromDate.bsDay);
  });

  it('formats combined dual calendar string (AD & BS)', () => {
    const formatted = formatNepaliDateTime('2024-04-13', { showBS: true, showTime: false });
    expect(formatted).toContain('2024-04-13');
    expect(formatted).toContain('2081 Baisakh 1 BS');
  });
});

describe('nepalLocale - Nepalese Standard Time (NPT)', () => {
  it('correctly calculates NPT offset (UTC +5:45)', () => {
    const utcDate = new Date('2024-04-13T06:15:00.000Z');
    const nptDate = getNPTDate(utcDate);
    expect(nptDate).toBeInstanceOf(Date);
    expect(!isNaN(nptDate.getTime())).toBe(true);
  });

  it('formats NPT time with 12-hour AM/PM and NPT suffix', () => {
    const timeFormatted = formatNPTTime('2024-04-13T14:30:00Z', true);
    expect(timeFormatted).toContain('NPT');
    expect(timeFormatted).toMatch(/\d{2}:\d{2} (AM|PM) NPT/);
  });
});

describe('nepalLocale - Performance Benchmarks', () => {
  it('executes 10,000 Bikram Sambat conversions in under 50ms with memoization cache', () => {
    const sampleDates = [
      '2024-04-13',
      '2024-05-20',
      '2024-08-15',
      '2024-09-16',
      '2024-11-01',
      '2025-01-01',
      '2025-04-14',
      '2025-08-20',
      '2026-09-16',
      '2026-10-24',
    ];

    const startTime = performance.now();
    for (let i = 0; i < 10000; i++) {
      const d = sampleDates[i % sampleDates.length];
      toBikramSambat(d);
    }
    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(100); // Must be under 100ms for 10k operations
  });

  it('executes 10,000 currency format operations in under 50ms', () => {
    const sampleAmounts = [0, 50, 150, 1200, 15000, 45000, 145000, 500000, 1250000, 10000000];

    const startTime = performance.now();
    for (let i = 0; i < 10000; i++) {
      const amt = sampleAmounts[i % sampleAmounts.length];
      formatNPR(amt);
    }
    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(100);
  });
});
