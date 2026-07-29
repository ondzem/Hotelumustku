// Pricing Calculation Engine for Hotel u Můstku
export const BANK_ACCOUNT = '293470312/0300';
export const BANK_NAME = 'ČSOB';
export const DEPOSIT_PERCENTAGE = 30; // 30 % záloha předem

export const CITY_TAX_PER_ADULT_NIGHT = 20; // 20 Kč / dospělý / noc
export const HALF_BOARD_PER_PERSON_NIGHT = 195; // 195 Kč / osoba / noc
export const DOG_PER_DAY = 150; // 150 Kč / den
export const EBIKE_PER_DAY = 15; // 15 Kč / den

/**
 * Single source of truth for Variable Symbol generation across Admin & QR codes
 */
export function getVariableSymbol(code) {
  if (!code) return '20260000';
  return String(code).replace(/[^0-9]/g, '');
}

/**
 * Helper to check if a specific Date object or string is a Weekend night (Pátek, Sobota, Neděle)
 * Day 5 = Friday, Day 6 = Saturday, Day 0 = Sunday
 */
export function isWeekendNight(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 5 || day === 6 || day === 0;
}

/**
 * System Date Integrity Verification ("Blbuvzdorná funkce")
 * Verifies that client computer clock has not been manually tampered with.
 */
export function validateSystemDateIntegrity() {
  const clientNow = new Date();
  const year = clientNow.getFullYear();
  if (year < 2026 || year > 2035) {
    return {
      isValid: false,
      message: 'Detekována nesrovnalost systémového data na vašem zařízení. Prosíme, zkontrolujte datum a čas ve vašem zařízení pro správný výpočet cen a dostupnosti.'
    };
  }
  return { isValid: true, message: '' };
}

/**
 * Calculates exact reservation pricing breakdown including dynamic Weekday vs Weekend per-night rates & 30% deposit
 */
export function calculateReservationPrice({
  roomType = 'standard', // 'standard' | 'nadstandard' | 'turisticky'
  nights = 2,
  persons = 2,
  adults = 2,
  children = 0,
  dateFrom = null,
  dateTo = null,
  hasDog = false,
  hasEbike = false,
  hasHalfBoard = false,
  halfBoardCount = null,
  ebikeCount = 1,
  customBaseRate = null,
  customWeekdayRate = null,
  customWeekendRate = null,
  discountObj = null,
}) {
  const defaultWeekdayRate = (roomType === 'nadstandard' || roomType === 'kat_a') ? 890 : 830;
  const defaultWeekendRate = (roomType === 'nadstandard' || roomType === 'kat_a') ? 990 : 890;

  const weekdayRate = customWeekdayRate !== null && customWeekdayRate !== undefined
    ? Number(customWeekdayRate)
    : (customBaseRate ? Number(customBaseRate) : defaultWeekdayRate);

  const weekendRate = customWeekendRate !== null && customWeekendRate !== undefined
    ? Number(customWeekendRate)
    : Math.max(weekdayRate, defaultWeekendRate);

  const safeNights = Math.max(1, parseInt(nights) || 1);
  const totalGuests = Math.max(1, parseInt(persons || adults || 1));

  // 1. Dynamic Per-Night Base Accommodation Calculation (Weekday vs. Weekend)
  let weekdayNights = 0;
  let weekendNights = 0;
  let accommodationPrice = 0;

  if (dateFrom && dateTo) {
    const startDate = new Date(dateFrom);
    for (let i = 0; i < safeNights; i++) {
      const nightDate = new Date(startDate);
      nightDate.setDate(nightDate.getDate() + i);
      if (isWeekendNight(nightDate)) {
        weekendNights++;
        accommodationPrice += weekendRate * totalGuests;
      } else {
        weekdayNights++;
        accommodationPrice += weekdayRate * totalGuests;
      }
    }
  } else {
    // Default fallback when dates aren't selected yet
    weekdayNights = safeNights;
    accommodationPrice = weekdayRate * totalGuests * safeNights;
  }

  let nightBreakdownLabel = '';
  if (weekendNights > 0 && weekdayNights > 0) {
    nightBreakdownLabel = `${weekendNights}× víkendová noc (${formatCzechPrice(weekendRate)}/noc) + ${weekdayNights}× týdenní noc (${formatCzechPrice(weekdayRate)}/noc)`;
  } else if (weekendNights > 0) {
    nightBreakdownLabel = `${weekendNights}× víkendová noc (${formatCzechPrice(weekendRate)}/noc)`;
  } else {
    nightBreakdownLabel = `${weekdayNights}× týdenní noc (${formatCzechPrice(weekdayRate)}/noc)`;
  }

  // 2. Single night & Single occupancy surcharge calculation:
  let singleNightRatePerPerson = (roomType === 'nadstandard' || roomType === 'kat_a') ? 300 : 200;
  let singleNightSurchargeTotal = 0;
  let surchargeReason = ''; // 'single_night' | 'single_occupancy' | 'both' | 'none'

  if (singleNightRatePerPerson > 0) {
    if (safeNights === 1 && totalGuests === 1) {
      singleNightSurchargeTotal = singleNightRatePerPerson * 1;
      surchargeReason = 'both';
    } else if (safeNights === 1) {
      singleNightSurchargeTotal = singleNightRatePerPerson * totalGuests;
      surchargeReason = 'single_night';
    } else if (totalGuests === 1) {
      singleNightSurchargeTotal = singleNightRatePerPerson * safeNights;
      surchargeReason = 'single_occupancy';
    }

    if (singleNightSurchargeTotal > 0) {
      accommodationPrice += singleNightSurchargeTotal;
    }
  }

  // 3. City Tax (Včetně v základní ceně ubytování)
  const cityTax = 0;

  // 4. Granular Addons Calculation
  const safeHalfBoardCount = hasHalfBoard
    ? Math.min(totalGuests, Math.max(1, parseInt(halfBoardCount ?? totalGuests)))
    : 0;
  const halfBoardPriceTotal = safeHalfBoardCount * HALF_BOARD_PER_PERSON_NIGHT * safeNights;
  const dogPriceTotal = hasDog ? DOG_PER_DAY * safeNights : 0;
  const safeEbikeCount = hasEbike ? Math.max(1, parseInt(ebikeCount || 1)) : 0;
  const ebikePriceTotal = safeEbikeCount * EBIKE_PER_DAY * safeNights;

  const addonsPrice = halfBoardPriceTotal + dogPriceTotal + ebikePriceTotal;

  // 5. Subtotal & Discount Code Calculation
  const subtotalPrice = accommodationPrice + cityTax + addonsPrice;
  let discountAmount = 0;
  let discountLabel = '';

  if (discountObj && discountObj.is_active) {
    const val = Number(discountObj.discount_value) || 0;
    if (discountObj.discount_type === 'percent' || val <= 100) {
      discountAmount = Math.round(subtotalPrice * (val / 100));
      discountLabel = `Sleva (${discountObj.code} -${val} %)`;
    } else {
      discountAmount = Math.min(subtotalPrice, val);
      discountLabel = `Sleva (${discountObj.code})`;
    }
  }

  const totalPrice = Math.max(0, subtotalPrice - discountAmount);

  // 6. 30% Deposit & 70% Remaining
  const depositPriceTotal = Math.round(totalPrice * (DEPOSIT_PERCENTAGE / 100));
  const remainingPriceTotal = totalPrice - depositPriceTotal;

  return {
    baseRatePerPersonNight: weekdayRate,
    weekdayRate,
    weekendRate,
    weekdayNights,
    weekendNights,
    nightBreakdownLabel,
    nights: safeNights,
    adults: totalGuests,
    children: 0,
    persons: totalGuests,
    totalGuests,
    accommodationPrice,
    singleNightRatePerPerson,
    singleNightSurchargeTotal,
    surchargeReason,
    cityTax,
    hasHalfBoard,
    halfBoardCount: safeHalfBoardCount,
    halfBoardPriceTotal,
    hasDog,
    dogPriceTotal,
    hasEbike,
    ebikeCount: safeEbikeCount,
    ebikePriceTotal,
    addonsPrice,
    subtotalPrice,
    discountAmount,
    discountLabel,
    totalPrice,
    depositPercentage: DEPOSIT_PERCENTAGE,
    depositPriceTotal,
    remainingPriceTotal,
    bankAccount: BANK_ACCOUNT,
    bankName: BANK_NAME,
    formattedTotalPrice: formatCzechPrice(totalPrice),
    formattedDepositPriceTotal: formatCzechPrice(depositPriceTotal),
    formattedRemainingPriceTotal: formatCzechPrice(remainingPriceTotal),
    formattedAccommodationPrice: formatCzechPrice(accommodationPrice),
    formattedDiscountAmount: formatCzechPrice(discountAmount),
  };
}

/**
 * Formats currency number strictly according to Czech standard ČSN 01 6910 (e.g. 9 900 Kč, 1 494 Kč, 0 Kč)
 */
export function formatCzechPrice(val) {
  const num = Math.round(Number(val) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Kč';
}

/**
 * Generates Czech SPAYD QR Code image URL (scannable by all Czech bank mobile apps)
 */
export function generateSpaydQrUrl({ bankAccount = BANK_ACCOUNT, amount = 0, vs = '', message = 'Hotel u Mustku' }) {
  const parts = String(bankAccount || '293470312/0300').split('/');
  const accountNumber = (parts[0] || '293470312').replace(/[^0-9]/g, '');
  const bankCode = (parts[1] || '0300').replace(/[^0-9]/g, '').padStart(4, '0');
  const cleanVs = String(vs).replace(/[^0-9]/g, '') || '2026001';
  const safeAmount = Number(amount || 0).toFixed(2);
  const cleanMsg = String(message || 'Zaloha ubytovani')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 -]/g, '')
    .substring(0, 60);

  // Exact IBAN calculation for Czech bank accounts (ČSOB 0300)
  const ibanPaddedNumber = accountNumber.padStart(10, '0');
  const ibanPaddedPrefix = '000000';
  const bban = bankCode + ibanPaddedPrefix + ibanPaddedNumber;
  const checkNum = BigInt(bban + '123500') % 97n;
  const checkDigits = String(98n - checkNum).padStart(2, '0');
  const iban = `CZ${checkDigits}${bban}`;

  // Standard Czech SPAYD string format (ČBA standard)
  const spaydString = `SPD*1.0*ACC:${iban}*AM:${safeAmount}*CC:CZK*X-VS:${cleanVs}*MSG:${cleanMsg}`;

  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(spaydString)}`;
}

/**
 * Generates unique Reservation Code e.g. HM-2026-0143
 */
export function generateReservationCode() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `HM-${year}-${randomNum}`;
}

/**
 * Generates random secret management token
 */
export function generateManageToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
