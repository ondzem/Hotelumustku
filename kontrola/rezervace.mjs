/**
 * Kontrola pravidel kolem rezervace, která se v provozu už jednou rozešla.
 * Zase bez sítě a bez prohlížeče.
 */
import { maZaplacenouZalohu, procentoZalohy, calculateReservationPrice, formatCzechPrice }
  from '../src/utils/pricing.js';

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  if (JSON.stringify(skutecnost) !== JSON.stringify(ocekavani)) {
    chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`);
  }
};

// Storno: rozhoduje se, jestli hostu napsat „neplatil jste nic".
// Napsat to někomu, kdo zálohu poslal, je vzkaz, že o peníze přišel.
overit('žádost bez zálohy',
  maZaplacenouZalohu({ status: 'pending_approval', deposit_price: 1422 }), false);
overit('čeká na zálohu',
  maZaplacenouZalohu({ status: 'awaiting_deposit', deposit_price: 1422 }), false);
overit('potvrzená se zálohou',
  maZaplacenouZalohu({ status: 'confirmed', deposit_price: 1422 }), true);
overit('potvrzená s nulovou zálohou',
  maZaplacenouZalohu({ status: 'confirmed', deposit_price: 0 }), false);
overit('už stornovaná',
  maZaplacenouZalohu({ status: 'cancelled', deposit_price: 1422 }), false);

// Procento zálohy se u uložené rezervace dopočítá ze zapsaných částek.
// Kdyby se bralo z nastavení, změna z 30 na 40 % by zpětně přepsala
// popisky u starých rezervací.
overit('procento ze zapsaných částek',
  procentoZalohy({ total_price: 5000, deposit_price: 1500 }), 30);
overit('procento u starší rezervace se sazbou 40 %',
  procentoZalohy({ total_price: 5000, deposit_price: 2000 }), 40);

// date_to je vždy VÝLUČNÉ: den odjezdu se už nepočítá jako obsazený.
const obsazeno = (d, od, doo) => d >= od && d < doo;
overit('první noc je obsazená', obsazeno('2026-08-10', '2026-08-10', '2026-08-13'), true);
overit('poslední noc je obsazená', obsazeno('2026-08-12', '2026-08-10', '2026-08-13'), true);
overit('den odjezdu je volný', obsazeno('2026-08-13', '2026-08-10', '2026-08-13'), false);

// Pobyt: 2 noci, 2 dospělí, standardní pokoj, všední dny.
const p = calculateReservationPrice({
  roomType: 'standard', roomId: 'p1', nights: 2, persons: 2, adults: 2, children: 0,
  dateFrom: '2026-09-07', dateTo: '2026-09-09'   // pondělí → středa
});
overit('ubytování 740 × 2 osoby × 2 noci', p.accommodationPrice, 2960);
overit('záloha je 30 % z celku', p.depositPriceTotal, Math.round(p.totalPrice * 0.3));
overit('doplatek dorovná celek', p.depositPriceTotal + p.remainingPriceTotal, p.totalPrice);
overit('formát ceny', formatCzechPrice(2960), '2 960 Kč');

// Nenačtený ceník nesmí vynulovat zálohu ani příplatky. Volající předávají
// `cenik && cenik.nastaveni`, což je při nenačteném ceníku null — a
// `Number(null)` je nula, kterou by výpočet vzal jako platné nastavení.
const bezNastaveni = calculateReservationPrice({
  roomType: 'standard', roomId: 'p1', nights: 2, persons: 2, adults: 2,
  dateFrom: '2026-09-07', dateTo: '2026-09-09', nastaveni: null
});
overit('záloha při nenačteném ceníku (null)', bezNastaveni.depositPercentage, 30);
const bezNastaveni2 = calculateReservationPrice({
  roomType: 'standard', roomId: 'p1', nights: 2, persons: 2, adults: 2,
  dateFrom: '2026-09-07', dateTo: '2026-09-09', nastaveni: undefined
});
overit('záloha při nenačteném ceníku (undefined)', bezNastaveni2.depositPercentage, 30);
// Nula od admina je platná hodnota a musí se respektovat.
const nulovaZaloha = calculateReservationPrice({
  roomType: 'standard', roomId: 'p1', nights: 2, persons: 2, adults: 2,
  dateFrom: '2026-09-07', dateTo: '2026-09-09', nastaveni: { zaloha_procent: 0 }
});
overit('nula od admina se respektuje', nulovaZaloha.depositPercentage, 0);

process.exit(chyb ? 1 : 0);
