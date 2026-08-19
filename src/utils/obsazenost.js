/**
 * Kdy se smí buňka dne půlit — jedno pravidlo pro všechny kalendáře.
 *
 * Úhlopříčka čte čas: levý horní roh je ráno, pravý dolní odpoledne.
 * Půlit se ale smí JEN tehdy, když je jedna polovina dne opravdu úplně
 * prázdná. Původní verze počítala jen příjezdy a odjezdy, a to lhalo,
 * jakmile se termíny překrývaly:
 *
 *   blokace pokoje 1     21. → 25.   (končí 25. v 10:00)
 *   rezervace pokoje 3   24. → 26.   (běží celý 25.)
 *
 * 25. srpna vycházel půlený, protože „někdo odjíždí a nikdo nepřijíždí".
 * Jenže pokoj 3 je ten den obsazený celý, takže hotel je částečně
 * obsazený i dopoledne i odpoledne a buňka má být celá. Stejně tak
 * 24. srpna: blokace pokoje 1 běží celý den, takže není co půlit,
 * i když do pokoje 3 zrovna někdo přijíždí.
 *
 * Rozhoduje proto obsazenost obou polovin, ne počty přestupů.
 */

/**
 * Spočítá, kolik pokojů je obsazeno dopoledne a kolik odpoledne.
 *
 * @param pokoje  pole identifikátorů prodejných pokojů
 * @param obsazeno(id)  je pokoj ten den obsazený? (platí `od <= den < do`,
 *                      tedy stav ODPOLEDNE — příjezd je od 15:00)
 * @param zacina(id)    začíná ten den pobyt nebo blokace? (`date_from`)
 * @param konci(id)     končí ten den pobyt nebo blokace? (`date_to`)
 */
export function obsazenostPulek(pokoje, { obsazeno, zacina, konci }) {
  let dopoledne = 0;
  let odpoledne = 0;

  for (const id of pokoje) {
    const jeObsazeny = Boolean(obsazeno(id));
    if (jeObsazeny) odpoledne++;

    // Dopoledne je pokoj zabraný, když v něm někdo přespal z minulé noci
    // (obsazený, ale nezačíná dnes), NEBO když z něj dnes někdo odjíždí
    // — do 10:00 tam pořád je, i když `date_to` už je výlučné.
    if ((jeObsazeny && !zacina(id)) || konci(id)) dopoledne++;
  }

  return { dopoledne, odpoledne, celkem: pokoje.length };
}

/**
 * Které půlce dne patří barva. Půlí se jen tehdy, když je druhá polovina
 * úplně prázdná — jinak by úhlopříčka tvrdila, že je půl dne volných,
 * přestože tam pořád někdo je.
 */
export function pulkyDne({ dopoledne, odpoledne }) {
  return {
    prijezdovy: dopoledne === 0 && odpoledne > 0,   // bílá nahoře, barva dole
    odjezdovy: dopoledne > 0 && odpoledne === 0,    // barva nahoře, bílá dole
  };
}
