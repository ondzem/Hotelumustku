// Pricing Calculation Engine for Hotel u Můstku
export const CITY_TAX_PER_ADULT_NIGHT = 20; // 20 Kč / dospělý / noc
export const SINGLE_NIGHT_SURCHARGE = 200; // 200 Kč / osoba při pobytu na 1 noc
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
}) {
  const baseRatePerPersonNight = (roomType === 'nadstandard' || roomType === 'kat_a') ? 890 : 830;
  const safeNights = Math.max(1, parseInt(nights) || 1);
  const totalGuests = Math.max(1, parseInt(persons || adults || 1));

  // 1. Base accommodation (includes breakfast)
  let accommodationPrice = baseRatePerPersonNight * totalGuests * safeNights;

  // 2. Single night surcharge (+200 Kč / person)
  let singleNightSurchargeTotal = 0;
  if (safeNights === 1) {
    singleNightSurchargeTotal = SINGLE_NIGHT_SURCHARGE * totalGuests;
    accommodationPrice += singleNightSurchargeTotal;
  }

  // 3. City Tax (20 Kč / person / night)
  const cityTax = CITY_TAX_PER_ADULT_NIGHT * totalGuests * safeNights;

  // 4. Addons
  let addonsPrice = 0;
  if (hasHalfBoard) {
    addonsPrice += HALF_BOARD_PER_PERSON_NIGHT * totalGuests * safeNights;
  }
  if (hasDog) {
    addonsPrice += DOG_PER_DAY * safeNights;
  }
  if (hasEbike) {
    addonsPrice += EBIKE_PER_DAY * safeNights;
  }

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
    singleNightSurchargeTotal,
    cityTax,
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
