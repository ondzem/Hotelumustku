// Pricing Calculation Engine for Hotel u Můstku
export const CITY_TAX_PER_ADULT_NIGHT = 20; // 20 Kč / dospělý / noc
export const HALF_BOARD_PER_PERSON_NIGHT = 195; // 195 Kč / osoba / noc
export const DOG_PER_DAY = 150; // 150 Kč / den
export const EBIKE_PER_DAY = 15; // 15 Kč / den

/**
 * Calculates exact reservation pricing breakdown
 */
export function calculateReservationPrice({
  roomType = 'standard', // 'standard' | 'nadstandard' | 'turisticky'
  nights = 2,
  persons = 2,
  adults = 2,
  children = 0,
  hasDog = false,
  hasEbike = false,
  hasHalfBoard = false,
  halfBoardCount = null,
  ebikeCount = 1,
}) {
  const baseRatePerPersonNight = (roomType === 'nadstandard' || roomType === 'kat_a') ? 890 : 830;
  const safeNights = Math.max(1, parseInt(nights) || 1);
  const totalGuests = Math.max(1, parseInt(persons || adults || 1));

  // 1. Base accommodation (includes breakfast)
  let accommodationPrice = baseRatePerPersonNight * totalGuests * safeNights;

  // 2. Single night & Single occupancy surcharge calculation:
  // - Nadstandard (A, A1, Zen): +300 Kč / osoba / noc
  // - Standard i Turistické pokoje: +200 Kč / osoba / noc
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

  // Dog fee: 150 Kč / day for the ENTIRE ROOM (regardless of person count)
  const dogPriceTotal = hasDog ? DOG_PER_DAY * safeNights : 0;

  // E-bike fee: 15 Kč / day per e-bike
  const safeEbikeCount = hasEbike ? Math.max(1, parseInt(ebikeCount || 1)) : 0;
  const ebikePriceTotal = safeEbikeCount * EBIKE_PER_DAY * safeNights;

  const addonsPrice = halfBoardPriceTotal + dogPriceTotal + ebikePriceTotal;

  // 5. Total
  const totalPrice = accommodationPrice + cityTax + addonsPrice;

  return {
    baseRatePerPersonNight,
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
    totalPrice,
  };
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
