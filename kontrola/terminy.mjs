// Kontrola zvláštních období v roce. Čistá matematika, bez prohlížeče.
import {
  jeSvatecniDen, jeSilvestr, jeMimoProvoz, zasahujeDoSvatku, zahrnujeSilvestr,
  zasahujeMimoProvoz, minimumNoci, popisNoci, popisRozsahu,
  mesicZasahujeMimoProvoz, mesicZasahujeSvatky, vRozsahuMM_DD,
  SVATKY, MIMO_PROVOZ, MIN_NOCI,
} from '../src/utils/terminy.js';

let chyb = 0;
const ok = (podminka, popis) => {
  if (!podminka) { chyb++; console.error('  ✗', popis); } else { console.log('  ✓', popis); }
};

console.log('\nSvátky přecházejí přes Nový rok');
{
  ok(jeSvatecniDen('2026-12-26'), '26. 12. je první sváteční den');
  ok(jeSvatecniDen('2026-12-31'), '31. 12. je ve svátcích');
  ok(jeSvatecniDen('2027-01-01'), '1. 1. je ve svátcích');
  ok(jeSvatecniDen('2027-01-02'), '2. 1. je poslední sváteční den');
  ok(!jeSvatecniDen('2027-01-03'), '3. 1. už sváteční není');
  ok(!jeSvatecniDen('2026-12-25'), '25. 12. ještě sváteční není');
  // Bez obráceného testu by rozsah 12-26 → 01-02 vyšel prázdný.
  ok(vRozsahuMM_DD('12-31', '12-26', '01-02'), 'rozsah přes Nový rok drží');
  ok(!vRozsahuMM_DD('06-15', '12-26', '01-02'), 'léto do svátků nespadá');
}

console.log('\nPlatí každý rok, ne jen letos');
{
  ok(jeSvatecniDen('2030-12-28') && jeSvatecniDen('2019-12-28'), 'sváteční den v jiných letech');
  ok(jeMimoProvoz('2031-11-11') && jeMimoProvoz('2020-11-11'), 'mimo provoz v jiných letech');
}

console.log('\nMinimum nocí');
{
  ok(minimumNoci('2026-07-15') === MIN_NOCI, `mimo svátky ${MIN_NOCI} noci`);
  ok(minimumNoci('2026-12-27') === SVATKY.minNoci, `ve svátcích ${SVATKY.minNoci} noci`);
  ok(minimumNoci('2027-01-01') === SVATKY.minNoci, 'na Nový rok tři noci');
  ok(minimumNoci('2026-12-25') === MIN_NOCI, '25. 12. je ještě běžný den');
  ok(minimumNoci('') === MIN_NOCI, 'prázdné datum nespadne');
}

console.log('\nProchází se NOCI, ne krajní dny');
{
  // Pobyt 24. → 27. 12.: noci 24., 25., 26. — poslední je sváteční.
  ok(zasahujeDoSvatku('2026-12-24', '2026-12-27'), 'pobyt zasahující koncem');
  // Pobyt 23. → 26. 12.: noci 23., 24., 25. — den odjezdu se nepřespává.
  ok(!zasahujeDoSvatku('2026-12-23', '2026-12-26'), 'den odjezdu se nepočítá');
  ok(zahrnujeSilvestr('2026-12-30', '2027-01-02'), 'pobyt přes Silvestr');
  ok(!zahrnujeSilvestr('2026-12-28', '2026-12-31'), 'odjezd 31. 12. Silvestr nezahrnuje');
  ok(zahrnujeSilvestr('2026-12-31', '2027-01-01'), 'příjezd 31. 12. Silvestr zahrnuje');
}

console.log('\nZimní přestávka');
{
  ok(jeMimoProvoz('2026-10-05'), '5. 10. je první zavřený den');
  ok(jeMimoProvoz('2026-12-25'), '25. 12. je poslední zavřený den');
  ok(!jeMimoProvoz('2026-10-04'), '4. 10. je ještě otevřeno');
  ok(!jeMimoProvoz('2026-12-26'), '26. 12. už zavřeno není — navazují svátky');
  ok(zasahujeMimoProvoz('2026-11-10', '2026-11-12'), 'listopadový pobyt spadá do přestávky');
  ok(!zasahujeMimoProvoz('2026-08-10', '2026-08-12'), 'srpnový pobyt ne');
}

console.log('\nObě období na sebe navazují a nepřekrývají se');
{
  const kolize = [];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 31; d++) {
      const den = `2026-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (new Date(den).getDate() !== d) continue;   // neexistující datum
      if (jeMimoProvoz(den) && jeSvatecniDen(den)) kolize.push(den);
    }
  }
  ok(kolize.length === 0, 'žádný den není zároveň zavřený i sváteční' + (kolize.length ? ` (${kolize[0]})` : ''));
}

console.log('\nUpozornění podle zobrazeného měsíce');
{
  ok(mesicZasahujeMimoProvoz(2026, 10) && mesicZasahujeMimoProvoz(2026, 11) && mesicZasahujeMimoProvoz(2026, 12),
     'říjen, listopad i prosinec hlásí přestávku');
  ok(!mesicZasahujeMimoProvoz(2026, 9) && !mesicZasahujeMimoProvoz(2026, 1),
     'září ani leden přestávku nehlásí');
  ok(mesicZasahujeSvatky(2026, 12) && mesicZasahujeSvatky(2026, 1), 'prosinec i leden hlásí svátky');
  ok(!mesicZasahujeSvatky(2026, 6), 'červen svátky nehlásí');
}

console.log('\nPopisky');
{
  ok(popisNoci(1) === '1 noc' && popisNoci(2) === '2 noci' && popisNoci(5) === '5 nocí', 'skloňování nocí');
  ok(popisRozsahu(SVATKY) === '26. 12. – 2. 1.', 'rozsah svátků: ' + popisRozsahu(SVATKY));
  ok(popisRozsahu(MIMO_PROVOZ) === '5. 10. – 25. 12.', 'rozsah přestávky: ' + popisRozsahu(MIMO_PROVOZ));
}

console.log(chyb === 0 ? '\nTermíny: vše v pořádku\n' : `\nTermíny: ${chyb} chyb\n`);
process.exit(chyb === 0 ? 0 : 1);
