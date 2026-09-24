/**
 * Kalendář nad seznamem rezervací — co se v něm musí vykreslit a co
 * se má po klepnutí na den vyfiltrovat.
 *
 * Nejcitlivější je výlučné `date_to`: kdo ho vezme jako poslední noc,
 * ukáže hosta o den déle, a kdo ho zahodí úplně, ztratí ze seznamu
 * odjezdy — tedy pokoje, které se ten den uklízejí.
 */
import {
  mrizkaMesice, vztahKeDni, rezervaceNaDen, jeBlokovano, shrnutiDne, posunDen,
} from '../src/utils/kalendarRezervaci.js';

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  if (JSON.stringify(skutecnost) !== JSON.stringify(ocekavani)) {
    chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`);
  }
};

// --- posun dne --------------------------------------------------------
overit('přes konec měsíce', posunDen('2026-09-30', 1), '2026-10-01');
overit('přes Nový rok', posunDen('2026-12-31', 1), '2027-01-01');
overit('zpět přes začátek měsíce', posunDen('2026-09-01', -1), '2026-08-31');
// 25. 10. 2026 se v ČR mění čas. V místním čase by tenhle posun vyšel
// o hodinu jinam a mohl by spadnout na tentýž den.
overit('přes změnu času', posunDen('2026-10-24', 2), '2026-10-26');

// --- mřížka měsíce ----------------------------------------------------
const zari = mrizkaMesice(2026, 8);
overit('září začíná pondělím před prvním', zari[0].datum, '2026-08-31');
overit('první den v měsíci je druhá buňka', zari[1].datum, '2026-09-01');
overit('mřížka jsou celé týdny', zari.length % 7, 0);
overit('září má 30 vlastních dnů', zari.filter(d => d.vMesici).length, 30);
overit('poslední buňka je neděle po konci měsíce', zari[zari.length - 1].datum, '2026-10-04');
// Únor 2027 začíná pondělím a má 28 dní — přesně čtyři týdny. Mřížka
// tedy nesmí přilepit prázdný řádek navíc.
const unor = mrizkaMesice(2027, 1);
overit('únor 2027 je přesně čtyři týdny', unor.length, 28);
overit('únor 2027 začíná prvním', unor[0].datum, '2027-02-01');
// Přes Nový rok se musí správně dopočítat konec prosince.
const prosinec = mrizkaMesice(2026, 11);
overit('prosinec má 31 vlastních dnů', prosinec.filter(d => d.vMesici).length, 31);

// --- vztah rezervace ke dni ------------------------------------------
const POBYT = { date_from: '2026-09-24', date_to: '2026-09-27', status: 'confirmed' };
overit('den příjezdu', vztahKeDni(POBYT, '2026-09-24'), 'prijezd');
overit('den uprostřed', vztahKeDni(POBYT, '2026-09-25'), 'pobyt');
overit('poslední noc', vztahKeDni(POBYT, '2026-09-26'), 'pobyt');
overit('den odjezdu (date_to je výlučné)', vztahKeDni(POBYT, '2026-09-27'), 'odjezd');
overit('den po odjezdu', vztahKeDni(POBYT, '2026-09-28'), null);
overit('den před příjezdem', vztahKeDni(POBYT, '2026-09-23'), null);
overit('rezervace bez termínu', vztahKeDni({ date_from: null, date_to: null }, '2026-09-24'), null);

// --- filtr seznamu ----------------------------------------------------
const SEZNAM = [
  { code: 'A', date_from: '2026-09-26', date_to: '2026-09-28', status: 'pending_approval' },
  { code: 'B', date_from: '2026-09-20', date_to: '2026-09-26', status: 'confirmed' },   // ten den odjíždí
  { code: 'C', date_from: '2026-09-24', date_to: '2026-09-30', status: 'awaiting_deposit' },
  { code: 'D', date_from: '2026-10-01', date_to: '2026-10-03', status: 'confirmed' },
  { code: 'E', date_from: '2026-09-26', date_to: '2026-09-27', status: 'cancelled' },
];
overit('26. září: příjezd, odjezd, probíhající i storno',
  rezervaceNaDen(SEZNAM, '2026-09-26').map(r => r.code), ['A', 'B', 'C', 'E']);
overit('bez vybraného dne se nefiltruje', rezervaceNaDen(SEZNAM, null).length, 5);

// --- souhrn dne a tečky ----------------------------------------------
const s26 = shrnutiDne(SEZNAM, [], '2026-09-26');
overit('26.: jeden příjezd', s26.prijezdy, 1);
overit('26.: jeden probíhající', s26.pobyty, 1);
overit('26.: jeden odjezd', s26.odjezdy, 1);
overit('26.: obsazeno dva pokoje', s26.obsazeno, 2);
// Storno se do počtů nepromítá, ale tečku má — jinak by v seznamu
// vyjela rezervace, po které v kalendáři nebylo ani stopy.
overit('26.: tečky v pořadí semaforu', s26.tecky,
  ['pending_approval', 'awaiting_deposit', 'confirmed', 'cancelled']);

overit('26.: jedno storno stranou', s26.storna, 1);

const jenStorno = shrnutiDne([SEZNAM[4]], [], '2026-09-26');
overit('den jen se stornem není obsazený', jenStorno.obsazeno, 0);
overit('den jen se stornem má šedou tečku', jenStorno.tecky, ['cancelled']);

const prazdny = shrnutiDne(SEZNAM, [], '2026-09-10');
overit('den bez rezervací nemá tečky', prazdny.tecky, []);
overit('den bez rezervací je prázdný', prazdny.obsazeno, 0);

// Archiv obsazuje dál — pobyt proběhl, jen se uklidil ze seznamu.
const archiv = [{ date_from: '2026-09-26', date_to: '2026-09-28', status: 'confirmed', is_archived: true }];
overit('archivovaná rezervace se počítá', shrnutiDne(archiv, [], '2026-09-26').obsazeno, 1);

// --- blokace ----------------------------------------------------------
const BLOKACE = [{ date_from: '2026-09-10', date_to: '2026-09-13', room_id: 'p1' }];
overit('první den blokace', jeBlokovano(BLOKACE, '2026-09-10'), true);
overit('prostřední den blokace', jeBlokovano(BLOKACE, '2026-09-12'), true);
overit('date_to blokace už zavřené není', jeBlokovano(BLOKACE, '2026-09-13'), false);
overit('den před blokací', jeBlokovano(BLOKACE, '2026-09-09'), false);
overit('souhrn nese příznak blokace', shrnutiDne([], BLOKACE, '2026-09-11').blokovano, true);

process.exit(chyb ? 1 : 0);
