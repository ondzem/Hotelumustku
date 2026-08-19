/**
 * Kdy se smí buňka dne půlit.
 *
 * Vychází z konkrétního případu, na kterém se to rozbilo:
 *   blokace pokoje 1     21. → 25.   (končí 25. v 10:00)
 *   rezervace pokoje 3   24. → 26.   (běží celý 24. i 25.)
 *   rezervace pokoje 1   26. → 29.
 */
import { obsazenostPulek, pulkyDne } from '../src/utils/obsazenost.js';

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  if (JSON.stringify(skutecnost) !== JSON.stringify(ocekavani)) {
    chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`);
  }
};

const POKOJE = ['p1', 'p2', 'p3'];
const ZAZNAMY = [
  { room: 'p1', od: '2026-08-21', doo: '2026-08-25' },   // blokace „Uzávěrka recepce"
  { room: 'p3', od: '2026-08-24', doo: '2026-08-26' },   // rezervace Julius
  { room: 'p1', od: '2026-08-26', doo: '2026-08-29' },   // rezervace Ondřej Zeman
];

function stav(den) {
  const pulky = obsazenostPulek(POKOJE, {
    obsazeno: (id) => ZAZNAMY.some(z => z.room === id && den >= z.od && den < z.doo),
    zacina: (id) => ZAZNAMY.some(z => z.room === id && z.od === den),
    konci: (id) => ZAZNAMY.some(z => z.room === id && z.doo === den),
  });
  const { prijezdovy, odjezdovy } = pulkyDne(pulky);
  return { dop: pulky.dopoledne, odp: pulky.odpoledne, tvar: prijezdovy ? 'příjezdový' : (odjezdovy ? 'odjezdový' : 'celý') };
}

// 20. 8. — nikdo tu není.
overit('20. je prázdný', stav('2026-08-20'), { dop: 0, odp: 0, tvar: 'celý' });

// 21. 8. — blokace začíná. Dopoledne nikdo, odpoledne jeden pokoj.
overit('21. je příjezdový', stav('2026-08-21'), { dop: 0, odp: 1, tvar: 'příjezdový' });

// 22.–23. 8. — blokace běží celé dny.
overit('22. je celý', stav('2026-08-22'), { dop: 1, odp: 1, tvar: 'celý' });

// 24. 8. — blokace pokoje 1 běží dál A do pokoje 3 se přijíždí.
// Dopoledne tu tedy někdo JE, takže se nesmí půlit.
overit('24. je celý, ne příjezdový', stav('2026-08-24'), { dop: 1, odp: 2, tvar: 'celý' });

// 25. 8. — blokaci pokoje 1 v 10:00 končí, ale pokoj 3 je obsazený celý den.
// Tohle byl ten nahlášený případ: vycházel odjezdový, přestože dopoledne
// prázdno rozhodně nebylo.
overit('25. je celý, ne odjezdový', stav('2026-08-25'), { dop: 2, odp: 1, tvar: 'celý' });

// 26. 8. — pokoj 3 se v 10:00 uvolní, do pokoje 1 se v 15:00 nastěhuje
// další host. Obě půlky zabrané, buňka celá.
overit('26. je celý', stav('2026-08-26'), { dop: 1, odp: 1, tvar: 'celý' });

// 29. 8. — poslední pobyt končí a nic dalšího nenavazuje.
overit('29. je odjezdový', stav('2026-08-29'), { dop: 1, odp: 0, tvar: 'odjezdový' });
overit('30. je prázdný', stav('2026-08-30'), { dop: 0, odp: 0, tvar: 'celý' });

// Osamocený jednodenní pobyt v prázdném hotelu se půlí na obou koncích.
const SAM = [{ room: 'p1', od: '2026-09-10', doo: '2026-09-12' }];
const stavSam = (den) => {
  const p = obsazenostPulek(['p1', 'p2'], {
    obsazeno: (id) => SAM.some(z => z.room === id && den >= z.od && den < z.doo),
    zacina: (id) => SAM.some(z => z.room === id && z.od === den),
    konci: (id) => SAM.some(z => z.room === id && z.doo === den),
  });
  const { prijezdovy, odjezdovy } = pulkyDne(p);
  return prijezdovy ? 'příjezdový' : (odjezdovy ? 'odjezdový' : 'celý');
};
overit('samostatný pobyt — příjezd', stavSam('2026-09-10'), 'příjezdový');
overit('samostatný pobyt — prostřední noc', stavSam('2026-09-11'), 'celý');
overit('samostatný pobyt — odjezd', stavSam('2026-09-12'), 'odjezdový');

// Jeden pokoj: host odjíždí a týž den se do něj stěhuje další.
// Obě půlky zabrané, buňka celá — tohle dřív vycházelo jako příjezdový den.
const NAVAZUJE = [
  { room: 'p1', od: '2026-10-01', doo: '2026-10-05' },
  { room: 'p1', od: '2026-10-05', doo: '2026-10-08' },
];
const stavJeden = (den) => {
  const p = obsazenostPulek(['p1'], {
    obsazeno: (id) => NAVAZUJE.some(z => z.room === id && den >= z.od && den < z.doo),
    zacina: (id) => NAVAZUJE.some(z => z.room === id && z.od === den),
    konci: (id) => NAVAZUJE.some(z => z.room === id && z.doo === den),
  });
  const { prijezdovy, odjezdovy } = pulkyDne(p);
  return prijezdovy ? 'příjezdový' : (odjezdovy ? 'odjezdový' : 'celý');
};
overit('navazující pobyt v jednom pokoji', stavJeden('2026-10-05'), 'celý');
overit('navazující pobyt — konec', stavJeden('2026-10-08'), 'odjezdový');

process.exit(chyb ? 1 : 0);
