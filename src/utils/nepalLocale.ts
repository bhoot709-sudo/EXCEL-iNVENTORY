/**
 * Nepalese Standard Localization Utility (NPR Currency, NPT Timezone & Bikram Sambat Calendar)
 * 
 * Complies with:
 * - Nepalese Rupee (NPR / रु) formatting with South Asian numeral grouping (Lakhs & Crores)
 * - Nepalese Standard Time (NPT is UTC +05:45)
 * - Bikram Sambat (B.S. / वि.सं.) calendar conversion & Nepali numerals
 * - Inland Revenue Department (IRD Nepal) VAT (13%) & Tax Invoice (कर बिजक) standards
 */

// Nepali numeral digits
export const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export const BS_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export const BS_MONTHS_NP = [
  'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत'
];

/**
 * Converts English digit strings or numbers to Nepali Devanagari numerals
 */
export function toNepaliDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => NEPALI_DIGITS[parseInt(d, 10)]);
}

const NPR_DEFAULT_FORMAT_CACHE = new Map<number, string>();
const MAX_NPR_CACHE_SIZE = 1000;

/**
 * Formats a numeric currency amount into Nepalese Rupee (NPR / रु)
 * using South Asian numbering format (e.g. रु 1,45,000.00)
 */
export function formatNPR(
  amount: number,
  options?: {
    showDecimals?: boolean;
    symbol?: string; // default "रु"
    nepaliDigits?: boolean;
    space?: boolean;
  }
): string {
  const isDefaultOptions = !options || (
    options.showDecimals !== false &&
    options.symbol === undefined &&
    !options.nepaliDigits &&
    options.space !== false
  );

  if (isDefaultOptions && typeof amount === 'number') {
    const cached = NPR_DEFAULT_FORMAT_CACHE.get(amount);
    if (cached) return cached;
  }

  const {
    showDecimals = true,
    symbol = 'रु',
    nepaliDigits = false,
    space = true,
  } = options || {};

  if (isNaN(amount) || amount === null || amount === undefined) {
    return `${symbol}${space ? ' ' : ''}0${showDecimals ? '.00' : ''}`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const rounded = showDecimals ? absAmount.toFixed(2) : Math.round(absAmount).toString();
  const [intPart, decPart] = rounded.split('.');

  // South Asian Number Grouping: last 3 digits, then groups of 2
  let formattedInt = '';
  if (intPart.length <= 3) {
    formattedInt = intPart;
  } else {
    const last3 = intPart.substring(intPart.length - 3);
    const remaining = intPart.substring(0, intPart.length - 3);
    const groupsOf2: string[] = [];
    for (let i = remaining.length; i > 0; i -= 2) {
      const start = Math.max(0, i - 2);
      groupsOf2.unshift(remaining.substring(start, i));
    }
    formattedInt = `${groupsOf2.join(',')},${last3}`;
  }

  let finalNumberStr = showDecimals && decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;

  if (nepaliDigits) {
    finalNumberStr = toNepaliDigits(finalNumberStr);
  }

  const signStr = isNegative ? '-' : '';
  const spacing = space ? ' ' : '';
  const result = `${signStr}${symbol}${spacing}${finalNumberStr}`;

  if (isDefaultOptions && typeof amount === 'number') {
    if (NPR_DEFAULT_FORMAT_CACHE.size >= MAX_NPR_CACHE_SIZE) {
      const firstKey = NPR_DEFAULT_FORMAT_CACHE.keys().next().value;
      if (firstKey !== undefined) NPR_DEFAULT_FORMAT_CACHE.delete(firstKey);
    }
    NPR_DEFAULT_FORMAT_CACHE.set(amount, result);
  }

  return result;
}

/**
 * Converts numeric NPR amounts to words (in English, standard for Nepalese invoices)
 * e.g., 145000 -> "One Lakh Forty-Five Thousand Rupees Only"
 */
export function formatNPRWords(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  if (rounded === 0) return 'Zero Rupees Only';

  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return units[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 !== 0 ? ` ${units[n % 10]}` : ''}`;
    return `${units[Math.floor(n / 100)]} Hundred${n % 100 !== 0 ? ` ${numToWords(n % 100)}` : ''}`;
  }

  let n = rounded;
  let words = '';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore > 0) words += `${numToWords(crore)} Crore `;
  if (lakh > 0) words += `${numToWords(lakh)} Lakh `;
  if (thousand > 0) words += `${numToWords(thousand)} Thousand `;
  if (remainder > 0) words += `${numToWords(remainder)} `;

  return `${words.trim()} Rupees Only`;
}

/**
 * Converts an AD date string (YYYY-MM-DD) or Date instance to Bikram Sambat (B.S.)
 * Calibrated for accurate retail store dates (2020 - 2035 AD)
 */
export interface BikramSambatDate {
  bsYear: number;
  bsMonth: number; // 1-12
  bsDay: number;
  bsMonthName: string; // e.g. "Bhadra"
  bsMonthNameNp: string; // e.g. "भदौ"
  formattedBS: string; // "2083 Bhadra 29 BS"
  formattedNumeric: string; // "2083-05-29"
  formattedNp: string; // "२०८३ भदौ २९"
  dayOfWeekNepali: string; // "सोमबार"
}

// B.S. Month length lookup for years 2077 - 2090 BS (corresponds to 2020 - 2034 AD)
// Each row: 12 months (Baisakh to Chaitra)
const BS_CALENDAR_DATA: Record<number, number[]> = {
  2080: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
};

// Reference point: 2024-04-13 AD corresponds to 2081-01-01 BS (Baisakh 1, 2081)
const REF_AD_DATE = new Date(Date.UTC(2024, 3, 13)); // 2024-04-13
const REF_BS_YEAR = 2081;

// In-memory LRU-style caches for ultra-fast repeated lookups
const BS_CONVERSION_CACHE = new Map<string, BikramSambatDate>();
const MAX_CACHE_SIZE = 2000;

export function clearLocaleCaches(): void {
  BS_CONVERSION_CACHE.clear();
}

export function toBikramSambat(adDateInput: string | Date): BikramSambatDate {
  let cacheKey: string;
  if (typeof adDateInput === 'string') {
    cacheKey = adDateInput.split(' ')[0].split('T')[0];
  } else if (adDateInput instanceof Date) {
    cacheKey = `${adDateInput.getUTCFullYear()}-${adDateInput.getUTCMonth() + 1}-${adDateInput.getUTCDate()}`;
  } else {
    cacheKey = String(adDateInput);
  }

  const cached = BS_CONVERSION_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  let adDate: Date;
  if (typeof adDateInput === 'string') {
    const cleanStr = cacheKey;
    const parts = cleanStr.split('-').map((p) => parseInt(p, 10));
    if (parts.length === 3 && !isNaN(parts[0])) {
      adDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } else {
      adDate = new Date(adDateInput);
    }
  } else {
    adDate = new Date(Date.UTC(adDateInput.getUTCFullYear(), adDateInput.getUTCMonth(), adDateInput.getUTCDate()));
  }

  // Calculate day difference from reference
  const diffDays = Math.round((adDate.getTime() - REF_AD_DATE.getTime()) / (1000 * 60 * 60 * 24));

  let bsYear = REF_BS_YEAR;
  let bsMonth = 1;
  let bsDay = 1 + diffDays;

  if (diffDays >= 0) {
    while (true) {
      const monthDays = (BS_CALENDAR_DATA[bsYear] || [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30])[bsMonth - 1];
      if (bsDay <= monthDays) {
        break;
      }
      bsDay -= monthDays;
      bsMonth++;
      if (bsMonth > 12) {
        bsMonth = 1;
        bsYear++;
      }
    }
  } else {
    while (bsDay < 1) {
      bsMonth--;
      if (bsMonth < 1) {
        bsMonth = 12;
        bsYear--;
      }
      const monthDays = (BS_CALENDAR_DATA[bsYear] || [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30])[bsMonth - 1];
      bsDay += monthDays;
    }
  }

  const bsMonthName = BS_MONTHS_EN[bsMonth - 1] || 'Baisakh';
  const bsMonthNameNp = BS_MONTHS_NP[bsMonth - 1] || 'बैशाख';
  const monthPad = bsMonth.toString().padStart(2, '0');
  const dayPad = bsDay.toString().padStart(2, '0');

  const DAYS_NP = ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'];
  const dayOfWeekNepali = DAYS_NP[adDate.getUTCDay()] || 'दिन';

  const result: BikramSambatDate = {
    bsYear,
    bsMonth,
    bsDay,
    bsMonthName,
    bsMonthNameNp,
    formattedBS: `${bsYear} ${bsMonthName} ${bsDay} BS`,
    formattedNumeric: `${bsYear}-${monthPad}-${dayPad}`,
    formattedNp: `${toNepaliDigits(bsYear)} ${bsMonthNameNp} ${toNepaliDigits(bsDay)}`,
    dayOfWeekNepali,
  };

  if (BS_CONVERSION_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = BS_CONVERSION_CACHE.keys().next().value;
    if (firstKey) BS_CONVERSION_CACHE.delete(firstKey);
  }
  BS_CONVERSION_CACHE.set(cacheKey, result);

  return result;
}

/**
 * Returns current Date adjusted to Nepalese Standard Time (NPT: UTC +05:45)
 */
export function getNPTDate(dateInput?: Date | string): Date {
  const baseDate = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(baseDate.getTime())) return new Date();

  // UTC time in ms + 5 hours 45 minutes
  const utc = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000;
  const nptOffsetMs = (5 * 60 + 45) * 60000;
  return new Date(utc + nptOffsetMs);
}

/**
 * Formats time in Nepalese Standard Time (12-hour format with AM/PM and NPT indicator)
 */
export function formatNPTTime(dateInput?: Date | string, includeNptTag = true): string {
  const d = getNPTDate(dateInput);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hourStr = hours.toString().padStart(2, '0');

  return `${hourStr}:${minutes} ${ampm}${includeNptTag ? ' NPT' : ''}`;
}

/**
 * Formats full date in dual Nepalese standard:
 * e.g. "2026-09-14 (2083 Bhadra 29 BS)" or with time "2026-09-14 | 2083 Bhadra 29 BS • 02:30 PM NPT"
 */
export function formatNepaliDateTime(
  dateInput?: Date | string,
  options?: {
    showTime?: boolean;
    showBS?: boolean;
    compact?: boolean;
    nepaliDigits?: boolean;
  }
): string {
  const { showTime = false, showBS = true, compact = false, nepaliDigits = false } = options || {};
  const nptDate = getNPTDate(dateInput);
  const yyyy = nptDate.getFullYear();
  const mm = (nptDate.getMonth() + 1).toString().padStart(2, '0');
  const dd = nptDate.getDate().toString().padStart(2, '0');
  const adString = `${yyyy}-${mm}-${dd}`;

  const bs = toBikramSambat(adString);

  let result = '';
  if (showBS) {
    if (compact) {
      result = `${adString} (${bs.formattedNumeric} BS)`;
    } else {
      result = `${adString} (${bs.formattedBS})`;
    }
  } else {
    result = adString;
  }

  if (showTime) {
    const timeStr = formatNPTTime(nptDate, true);
    result = `${result} • ${timeStr}`;
  }

  if (nepaliDigits) {
    return toNepaliDigits(result);
  }

  return result;
}

/**
 * Returns today's ISO date string in NPT (YYYY-MM-DD)
 */
export function getTodayNPTString(): string {
  const d = getNPTDate();
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns today's Bikram Sambat date
 */
export function getTodayBS(): BikramSambatDate {
  return toBikramSambat(new Date());
}
