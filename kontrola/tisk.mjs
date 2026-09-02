/**
 * Rezervační list — co se na něj opravdu vytiskne.
 *
 * Vzniklo z chyby, kterou hlásil majitel: „nikdy se tam nezapíše správný
 * počet nocí". Tisk bral `reservation.nights_count`, jenže takový sloupec
 * v databázi není — vycházel `undefined`, výpočet z něj udělal jednu noc
 * a list tiskl „1 nocí" a cenu za jedinou noc, ať byl termín jakýkoli.
 */
import { pocetNociZTerminu, sklonuj, udajeProTisk } from '../src/utils/printReservationService.js';

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  if (JSON.stringify(skutecnost) !== JSON.stringify(ocekavani)) {
    chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`);
  }
};

// --- počet nocí se bere z termínu ------------------------------------
overit('3 noci', pocetNociZTerminu('2026-09-05', '2026-09-08'), 3);
overit('1 noc', pocetNociZTerminu('2026-09-05', '2026-09-06'), 1);
overit('přes přelom měsíce', pocetNociZTerminu('2026-09-28', '2026-10-03'), 5);
overit('přes Nový rok', pocetNociZTerminu('2026-12-30', '2027-01-02'), 3);
overit('bez termínu', pocetNociZTerminu(null, '2026-09-08'), 0);
// Letní čas: 25. 10. 2026 se v ČR posouvají hodiny. Kdyby se počítalo
// v místním čase, vyšlo by 2,04 dne a zaokrouhlením někam jinam.
overit('přes změnu času', pocetNociZTerminu('2026-10-24', '2026-10-26'), 2);

// --- skloňování po číslovce ------------------------------------------
overit('1 noc', sklonuj(1, 'noc', 'noci', 'nocí'), '1 noc');
overit('2 noci', sklonuj(2, 'noc', 'noci', 'nocí'), '2 noci');
overit('4 noci', sklonuj(4, 'noc', 'noci', 'nocí'), '4 noci');
overit('5 nocí', sklonuj(5, 'noc', 'noci', 'nocí'), '5 nocí');
overit('1 dospělý', sklonuj(1, 'dospělý', 'dospělí', 'dospělých'), '1 dospělý');
overit('3 dospělí', sklonuj(3, 'dospělý', 'dospělí', 'dospělých'), '3 dospělí');

// --- částky se berou z ULOŽENÉ rezervace, nepočítají se znovu --------
// Host dostal potvrzení na konkrétní částku; změna ceníku ji nesmí přepsat.
const REZERVACE = {
  date_from: '2026-09-05', date_to: '2026-09-08',
  adults_count: 2, children_count: 0,
  total_price: 5000, deposit_price: 1500, remaining_price: 3500,
  accommodation_price: 4800, addons_price: 200,
  has_half_board: true, half_board_count: 2,
  status: 'confirmed',
};
const CENIK_JINY = { nastaveni: { polopenze: 250, pes: 300, elektrokolo: 30, zaloha_procent: 50 } };
const u = udajeProTisk(REZERVACE, CENIK_JINY);

overit('noci z termínu, ne z chybějícího sloupce', u.noci, 3);
overit('popis nocí', u.popisNoci, '3 noci');
overit('celková cena z rezervace', u.celkem, 5000);
overit('záloha z rezervace', u.zaloha, 1500);
overit('doplatek z rezervace', u.doplatek, 3500);
// 1500 / 5000 = 30 %, přestože ceník má teď 50 %.
overit('procento zálohy z uložených částek', u.procentoZalohy, 30);
overit('procento doplatku', u.procentoDoplatku, 70);
overit('nepočítalo se znovu', u.zPolozek, false);
// Popisky příplatků se berou z ceníku, ne natvrdo z kódu.
overit('cena polopenze z ceníku', u.cenaPolopenze, 250);
overit('cena za psa z ceníku', u.cenaPes, 300);
overit('osob na polopenzi', u.polopenzeOsob, 2);

// Změna ceníku nesmí hnout uloženou rezervací.
const uJinak = udajeProTisk(REZERVACE, { nastaveni: { zaloha_procent: 10 } });
overit('změna ceníku nepřepíše zálohu', uJinak.zaloha, 1500);
overit('změna ceníku nepřepíše procento', uJinak.procentoZalohy, 30);

// --- starý záznam bez uložených částek se dopočítá -------------------
const STARA = {
  date_from: '2026-09-05', date_to: '2026-09-08',
  adults_count: 2, room_id: 'p6',
};
const CENIK = {
  sezony: [{ id: 'z', je_zakladni: true, nazev: 'Základní' }],
  ceny: [{ sezona_id: 'z', kategorie: 'standard', pocet_osob: 2, cena_za_osobu_noc: 800 }],
  cenyPokoj: [],
  nastaveni: { vikend_standard: 0, zaloha_procent: 30 },
};
const uStara = udajeProTisk(STARA, CENIK, { id: 'p6', type: 'standard' });
overit('starý záznam: dopočítáno', uStara.zPolozek, true);
overit('starý záznam: 3 noci × 2 osoby × 800', uStara.celkem, 4800);
overit('starý záznam: záloha 30 %', uStara.zaloha, 1440);

// --- jedna osoba a jedno dítě: skloňování v sestavě ------------------
const SAM = { date_from: '2026-09-05', date_to: '2026-09-06', adults_count: 1, children_count: 1, total_price: 1000, deposit_price: 300 };
const uSam = udajeProTisk(SAM, { nastaveni: {} });
overit('1 noc v popisu', uSam.popisNoci, '1 noc');
overit('1 dospělý v popisu', uSam.popisOsob, '1 dospělý');
overit('1 dítě v popisu', uSam.popisDeti, '1 dítě');
overit('doplatek se dopočítá, když chybí', uSam.doplatek, 700);

process.exit(chyb ? 1 : 0);
