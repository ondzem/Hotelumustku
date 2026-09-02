// Pricing Calculation Engine for Hotel u Můstku
import {
  rozpisNoci,
  cenaZaOsobuNoc,
  soloPriplatek,
  najdiSezonu,
  popisRozpisu,
  PRAZDNY_CENIK,
  VYCHOZI_SOLO,
} from './cenik.js';

export const BANK_ACCOUNT = '293470312/0300';
export const BANK_NAME = 'ČSOB';

/**
 * Výchozí hodnoty příplatků.
 *
 * Slouží jen jako záchrana, než se z databáze načte tabulka
 * cenik_nastaveni — tam si je majitel mění sám v administraci.
 * Čísla odpovídají ceníku na umustku.cz platnému od 1. 1. 2026.
 */
export const VYCHOZI_NASTAVENI = {
  polopenze: 195,        // Kč / osoba / noc
  pes: 150,              // Kč / noc
  elektrokolo: 15,       // Kč / kus / den
  zimni_parkovani: 100,  // Kč / auto / POBYT, ne za noc — viz výpočet níž
  // Příplatek za jednu osobu na pokoji, Kč / NOC. Městský poplatek tu
  // byl a je zrušený: je v ceně, majitel ho z Příplatků vyhodil 2. 9. 2026.
  solo_standard: VYCHOZI_SOLO.standard,
  solo_nadstandard: VYCHOZI_SOLO.nadstandard,
  zaloha_procent: 30,    // % z celkové ceny
};

/**
 * Procento zálohy u konkrétní, už uložené rezervace.
 *
 * Počítá se ze zapsaných částek, ne z aktuálního nastavení ceníku.
 * Kdyby se bralo nastavení, změna zálohy z 30 na 40 % by zpětně
 * přepsala popisky u všech starých rezervací a recepce by u nich četla
 * jiné procento, než jaké host doopravdy zaplatil.
 */
export function procentoZalohy(reservation) {
  const celkem = Number(reservation && reservation.total_price);
  const zaloha = Number(reservation && reservation.deposit_price);
  if (Number.isFinite(celkem) && celkem > 0 && Number.isFinite(zaloha) && zaloha > 0) {
    return Math.round((zaloha / celkem) * 100);
  }
  return VYCHOZI_NASTAVENI.zaloha_procent;
}

/**
 * Má už hotel od hosta peníze?
 *
 * Rozhoduje o tom, jestli se při stornu smí napsat „neplatili jste nic".
 * Stav `confirmed` nastavuje recepce teprve ve chvíli, kdy zálohu vidí
 * na účtu (tlačítko Potvrdit zálohu), a ručně zapsaná rezervace se
 * takhle označí jen tehdy, když ji obsluha vede jako závazně potvrzenou.
 * Nula v `deposit_price` znamená, že se nemá co vracet — třeba u pobytu
 * placeného až na místě.
 */
export function maZaplacenouZalohu(reservation) {
  if (!reservation || reservation.status !== 'confirmed') return false;
  return Number(reservation.deposit_price) > 0;
}

/** Vytáhne číslo z nastavení, s návratem k výchozí hodnotě. */
function nast(nastaveni, klic) {
  // Pozor na `Number(null)` — je to NULA, a nula je konečné číslo, takže
  // by se u chybějícího nastavení vydávala za platnou hodnotu. Volající
  // přitom předávají `cenik && cenik.nastaveni`, což je při nenačteném
  // ceníku přesně null: záloha by vyšla 0 % a všechny příplatky nula.
  // Nula OD ADMINA je naopak platná („bez příplatku") a musí projít.
  const surova = nastaveni ? nastaveni[klic] : undefined;
  if (surova === undefined || surova === null || surova === '') {
    return VYCHOZI_NASTAVENI[klic];
  }
  const v = Number(surova);
  return Number.isFinite(v) ? v : VYCHOZI_NASTAVENI[klic];
}

export const DEPOSIT_PERCENTAGE = VYCHOZI_NASTAVENI.zaloha_procent;
export const HALF_BOARD_PER_PERSON_NIGHT = VYCHOZI_NASTAVENI.polopenze;
export const DOG_PER_DAY = VYCHOZI_NASTAVENI.pes;
export const EBIKE_PER_DAY = VYCHOZI_NASTAVENI.elektrokolo;
export const WINTER_PARKING_PER_CAR = VYCHOZI_NASTAVENI.zimni_parkovani;

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
 * Helper to check if a reservation stay falls within the Winter Season (1. 11. - 15. 4.)
 * Jizerské hory (Desná) winter snow & maintenance period: Nov (11), Dec (12), Jan (1), Feb (2), Mar (3), and first half of Apr (4 <= 15)
 */
export function isWinterSeason(dateFromInput, dateToInput) {
  const checkDate = dateFromInput ? new Date(dateFromInput) : new Date();
  if (isNaN(checkDate.getTime())) return false;
  const month = checkDate.getMonth() + 1; // 1-12
  const day = checkDate.getDate();
  if (month === 11 || month === 12 || month === 1 || month === 2 || month === 3) {
    return true;
  }
  if (month === 4 && day <= 15) {
    return true;
  }
  return false;
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
 * Spočítá kompletní rozpis ceny rezervace.
 *
 * Ubytování se počítá po jednotlivých nocích: každá noc si sama najde
 * svou sezónu a cenu podle kategorie pokoje a počtu osob. Díky tomu
 * pobyt přes přelom sezón vyjde správně bez zvláštní obsluhy.
 *
 * Cena je vždy ZA OSOBU A NOC a s počtem lidí na pokoji klesá —
 * tak, jak to má hotel ve svém ceníku.
 */
export function calculateReservationPrice({
  roomType = 'standard', // 'standard' | 'nadstandard' | 'turisticky'
  roomId = null,
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
  hasWinterParking = false,
  parkingCarsCount = 1,
  cenik = PRAZDNY_CENIK,
  nastaveni = null,
  discountObj = null,
}) {
  const safeNights = Math.max(1, parseInt(nights) || 1);
  const totalGuests = Math.max(1, parseInt(persons || adults || 1));
  const kategorie = (roomType === 'kat_a') ? 'nadstandard' : roomType;

  // 1. Ubytování po nocích — každá noc podle své sezóny
  let noci = rozpisNoci({
    dateFrom,
    nights: safeNights,
    roomId,
    kategorie,
    pocetOsob: totalGuests,
    cenik,
  });

  // Termín ještě není vybraný — ukaž alespoň orientační cenu
  // podle dnešního data, ať formulář nesvítí nulami.
  if (noci.length === 0) {
    const dnes = new Date().toISOString().split('T')[0];
    const sazba = cenaZaOsobuNoc({ datumStr: dnes, roomId, kategorie, pocetOsob: totalGuests, cenik });
    const solo = totalGuests === 1 ? soloPriplatek(kategorie, cenik) : 0;
    noci = Array.from({ length: safeNights }, () => ({
      datum: dnes,
      jeVikend: false,
      sezonaNazev: 'Základní ceník',
      cenaZaOsobu: sazba,
      zakladniCenaZaOsobu: sazba,
      vikendovyPriplatek: 0,
      soloPriplatek: solo,
      cenaZaNoc: sazba * totalGuests + solo,
    }));
  }

  // Příplatek za jednu osobu na pokoji se vede zvlášť, aby ho host viděl
  // jako vlastní řádek — majitel chce, aby „skočil" do rozpisu ve chvíli,
  // kdy host sníží počet osob na jednu. Do ceny ubytování (a do databáze)
  // se ale započítává, protože je to cena pokoje, ne doplňková služba.
  const soloPriplatekCelkem = noci.reduce((s, n) => s + (n.soloPriplatek || 0), 0);
  const soloPriplatekZaNoc = noci[0] ? (noci[0].soloPriplatek || 0) : 0;
  const ubytovaniBezPriplatku = noci.reduce((s, n) => s + n.cenaZaNoc, 0) - soloPriplatekCelkem;
  let accommodationPrice = ubytovaniBezPriplatku + soloPriplatekCelkem;

  const weekendNights = noci.filter(n => n.jeVikend).length;
  const weekdayNights = noci.length - weekendNights;
  const prvniVsedni = noci.find(n => !n.jeVikend);
  const prvniVikend = noci.find(n => n.jeVikend);
  const weekdayRate = prvniVsedni ? prvniVsedni.cenaZaOsobu : (noci[0] ? noci[0].cenaZaOsobu : 0);
  const weekendRate = prvniVikend ? prvniVikend.cenaZaOsobu : weekdayRate;

  const nightBreakdownLabel = popisRozpisu(noci, formatCzechPrice);
  const sezonaAktualni = najdiSezonu(noci[0] ? noci[0].datum : (dateFrom || ''), cenik.sezony || []);

  // 2. Příplatek za jednu noc tu není a nemá být.
  //
  //    Hotel jednonoční pobyty nepřijímá — rezervační formulář vyžaduje
  //    minimálně dvě noci, takže příplatek by stejně nikdy nenastal.
  //
  //    Příplatek za jednu osobu je už uvnitř `noci` (rozpisNoci), tady se
  //    nepřičítá podruhé.

  // 3. Městský poplatek je v ceně a z Příplatků zmizel. Sloupec `city_tax`
  //    v databázi zůstal, proto se posílá nula — ne undefined, jinak by
  //    staré rozpisy v administraci sčítaly NaN.
  const cityTax = 0;

  // 4. Doplňkové služby
  const isWinter = isWinterSeason(dateFrom, dateTo);
  const safeHalfBoardCount = hasHalfBoard
    ? Math.min(totalGuests, Math.max(1, parseInt(halfBoardCount ?? totalGuests)))
    : totalGuests;
  const halfBoardPriceTotal = hasHalfBoard
    ? safeHalfBoardCount * nast(nastaveni, 'polopenze') * safeNights
    : 0;
  const dogPriceTotal = hasDog ? nast(nastaveni, 'pes') * safeNights : 0;
  const safeEbikeCount = hasEbike ? Math.max(1, parseInt(ebikeCount || 1)) : 1;
  const ebikePriceTotal = hasEbike ? safeEbikeCount * nast(nastaveni, 'elektrokolo') * safeNights : 0;

  const safeParkingCarsCount = (isWinter && hasWinterParking)
    ? Math.max(1, parseInt(parkingCarsCount || 1))
    : 1;
  // Zimní parkování je JEDNORÁZOVÉ za celý pobyt, ne za noc. Majitel to
  // tak chce od 22. 8. 2026: je to příspěvek na zimní údržbu příjezdové
  // cesty, a ta se nedělá znovu každou noc. Nenásobit počtem nocí —
  // u týdenního pobytu by z toho vyšlo sedminásobek.
  const winterParkingPriceTotal = (isWinter && hasWinterParking)
    ? safeParkingCarsCount * nast(nastaveni, 'zimni_parkovani')
    : 0;

  const addonsPrice = halfBoardPriceTotal + dogPriceTotal + ebikePriceTotal + winterParkingPriceTotal;

  // 5. Mezisoučet a sleva (sleva se počítá výhradně z ceny ubytování)
  const subtotalPrice = accommodationPrice + cityTax + addonsPrice;
  let discountAmount = 0;
  let discountLabel = '';

  if (discountObj && discountObj.is_active) {
    const val = Number(discountObj.discount_value) || 0;
    if (discountObj.discount_type === 'percent' || val <= 100) {
      discountAmount = Math.round(accommodationPrice * (val / 100));
      discountLabel = `Sleva na pokoj (${discountObj.code} -${val} %)`;
    } else {
      discountAmount = Math.min(accommodationPrice, val);
      discountLabel = `Sleva na pokoj (${discountObj.code} -${formatCzechPrice(val)})`;
    }
  }

  const totalPrice = Math.max(0, subtotalPrice - discountAmount);

  // 6. Záloha předem a doplatek
  const depositPercentage = nast(nastaveni, 'zaloha_procent');
  const depositPriceTotal = Math.round(totalPrice * (depositPercentage / 100));
  const remainingPriceTotal = totalPrice - depositPriceTotal;

  return {
    // nové údaje z ceníku
    noci,
    sezonaNazev: sezonaAktualni ? sezonaAktualni.nazev : 'Základní ceník',
    cenaZaOsobuNoc: weekdayRate,
    ubytovaniBezPriplatku,
    soloPriplatekZaNoc,
    soloPriplatekCelkem,
    formattedUbytovaniBezPriplatku: formatCzechPrice(ubytovaniBezPriplatku),
    formattedSoloPriplatekCelkem: formatCzechPrice(soloPriplatekCelkem),

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
    cityTax,
    hasHalfBoard,
    halfBoardCount: safeHalfBoardCount,
    halfBoardPriceTotal,
    hasDog,
    dogPriceTotal,
    hasEbike,
    ebikeCount: safeEbikeCount,
    ebikePriceTotal,
    isWinterSeason: isWinter,
    hasWinterParking: isWinter && hasWinterParking,
    parkingCarsCount: safeParkingCarsCount,
    winterParkingPriceTotal,
    addonsPrice,
    subtotalPrice,
    discountAmount,
    discountLabel,
    totalPrice,
    depositPercentage,
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
