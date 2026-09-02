/**
 * Půlené dny v kalendáři.
 *
 * Každá polovina dne má VLASTNÍ stav ('plno' / 'castecne' / 'volno')
 * a teprve z dvojice vzniká třída buňky. Vychází to ze dvou případů,
 * na kterých se to postupně rozbilo:
 *
 *   1) blokace pokoje 1     21. → 25.   (končí 25. v 10:00)
 *      rezervace pokoje 3   24. → 26.   (běží celý 24. i 25.)
 *      → 25. se nesmí půlit, dopoledne hotel prázdný není
 *
 *   2) konec blokace u JEDNOHO pokoje: `date_to` už obsazený den není,
 *      takže se barva půlky brala z celého dne a vyšla oranžová —
 *      jako by šlo o cizí pokoj. Má být červená, do 10:00 tam někdo je.
 */
import { obsazenostPulek, stavPulky, tridaPulek } from '../src/utils/obsazenost.js';

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  if (JSON.stringify(skutecnost) !== JSON.stringify(ocekavani)) {
    chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`);
  }
};

/** Postaví z pár záznamů dotazovadlo na jeden den. */
const dotazy = (zaznamy, den) => ({
  obsazeno: (id) => zaznamy.some(z => z.room === id && den >= z.od && den < z.doo),
  zacina: (id) => zaznamy.some(z => z.room === id && z.od === den),
  konci: (id) => zaznamy.some(z => z.room === id && z.doo === den),
});

/**
 * Třída buňky tak, jak ji počítají všechny tři kalendáře:
 * vybraný pokoj (nebo celý hotel) proti obsazenosti celého hotelu.
 */
function trida(zaznamy, vsechnyPokoje, den, roomId = null) {
  const cb = dotazy(zaznamy, den);
  const vybrane = roomId ? [roomId] : vsechnyPokoje;
  const v = obsazenostPulek(vybrane, cb);
  const h = roomId ? obsazenostPulek(vsechnyPokoje, cb) : v;
  return tridaPulek(
    stavPulky(v.dopoledne, v.celkem, h.dopoledne),
    stavPulky(v.odpoledne, v.celkem, h.odpoledne));
}

// ---------------------------------------------------------------------
// 1) Pohled na CELÝ HOTEL — půlí se jen tehdy, když je půlka opravdu prázdná
// ---------------------------------------------------------------------
const POKOJE = ['p1', 'p2', 'p3'];
const ZAZNAMY = [
  { room: 'p1', od: '2026-08-21', doo: '2026-08-25' },   // blokace „Uzávěrka recepce"
  { room: 'p3', od: '2026-08-24', doo: '2026-08-26' },   // rezervace Julius
  { room: 'p1', od: '2026-08-26', doo: '2026-08-29' },   // rezervace Ondřej Zeman
];
const hotel = (den) => trida(ZAZNAMY, POKOJE, den);

overit('20. je prázdný', hotel('2026-08-20'), '');
overit('21. je příjezdový', hotel('2026-08-21'), 'pulka-volno-castecne');
overit('22. je celý', hotel('2026-08-22'), 'is-partial');
// Blokace pokoje 1 běží dál A do pokoje 3 se přijíždí — dopoledne někdo je.
overit('24. je celý, ne příjezdový', hotel('2026-08-24'), 'is-partial');
// Blokace pokoje 1 v 10:00 končí, ale pokoj 3 je obsazený celý den.
overit('25. je celý, ne odjezdový', hotel('2026-08-25'), 'is-partial');
// Pokoj 3 se v 10:00 uvolní, do pokoje 1 se v 15:00 stěhuje další host.
overit('26. je celý', hotel('2026-08-26'), 'is-partial');
overit('29. je odjezdový', hotel('2026-08-29'), 'pulka-castecne-volno');
overit('30. je prázdný', hotel('2026-08-30'), '');

// Osamocený pobyt v prázdném hotelu se půlí na obou koncích.
const SAM = [{ room: 'p1', od: '2026-09-10', doo: '2026-09-12' }];
overit('samostatný pobyt — příjezd', trida(SAM, ['p1', 'p2'], '2026-09-10'), 'pulka-volno-castecne');
overit('samostatný pobyt — prostřední noc', trida(SAM, ['p1', 'p2'], '2026-09-11'), 'is-partial');
overit('samostatný pobyt — odjezd', trida(SAM, ['p1', 'p2'], '2026-09-12'), 'pulka-castecne-volno');

// ---------------------------------------------------------------------
// 2) Pohled na JEDEN POKOJ — začátek i KONEC blokace musí být červený
// ---------------------------------------------------------------------
const BLOKACE = [{ room: 'pa', od: '2026-09-14', doo: '2026-09-29' }];
const POKOJE2 = ['pa', 'p5', 'p6'];
const jeden = (den) => trida(BLOKACE, POKOJE2, den, 'pa');

overit('13. — den před blokací je volný', jeden('2026-09-13'), '');
overit('14. — blokace začíná odpoledne', jeden('2026-09-14'), 'pulka-volno-plno');
overit('20. — uprostřed blokace je celý červený', jeden('2026-09-20'), 'is-full');
// Tohle byla ta nahlášená chyba: konec blokace vycházel oranžově.
overit('29. — blokace končí dopoledne, ČERVENÁ nahoře', jeden('2026-09-29'), 'pulka-plno-volno');
overit('30. — po blokaci je volno', jeden('2026-09-30'), '');

// Konec blokace v pokoji, kde je zároveň obsazený jiný pokoj:
// dopoledne červená (tenhle pokoj), odpoledne oranžová (cizí pokoj).
const SOUBEH = [
  { room: 'pa', od: '2026-09-14', doo: '2026-09-29' },
  { room: 'p5', od: '2026-09-28', doo: '2026-09-30' },
];
overit('29. — konec blokace a cizí pokoj obsazený',
  trida(SOUBEH, POKOJE2, '2026-09-29', 'pa'), 'pulka-plno-castecne');

// Jeden pokoj: host odjíždí a týž den se do něj stěhuje další — celá buňka.
const NAVAZUJE = [
  { room: 'p1', od: '2026-10-01', doo: '2026-10-05' },
  { room: 'p1', od: '2026-10-05', doo: '2026-10-08' },
];
overit('navazující pobyt v jednom pokoji je celý', trida(NAVAZUJE, ['p1'], '2026-10-05', 'p1'), 'is-full');

process.exit(chyb ? 1 : 0);
