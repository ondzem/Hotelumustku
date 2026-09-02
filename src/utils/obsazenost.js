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
 * Stav JEDNÉ poloviny dne: 'plno' | 'castecne' | 'volno'.
 *
 * Půlka musí znát svůj stav sama. Do 2. 9. 2026 se barva půlky brala
 * z celého dne, a to lhalo přesně na konci blokace: poslední den je
 * `date_to`, tedy den už obsazený NENÍ, takže buňka nebyla „plná" a
 * obsazené dopoledne se vykreslilo oranžově, jako by šlo o cizí pokoj.
 * Majitel to popsal tak, že „začátek blokace se půlí správně, konec ne".
 *
 * @param obsazenoVybrane  kolik pokojů z vybraných je v téhle půlce zabraných
 * @param celkemVybrane    kolik pokojů se sleduje (1 u konkrétního pokoje)
 * @param obsazenoHotel    kolik pokojů je zabraných v celém hotelu
 */
export function stavPulky(obsazenoVybrane, celkemVybrane, obsazenoHotel) {
  if (celkemVybrane > 0 && obsazenoVybrane >= celkemVybrane) return 'plno';
  if (obsazenoHotel > 0) return 'castecne';
  return 'volno';
}

/**
 * Třída pro buňku dne podle obou polovin.
 *
 * Když mají obě půlky tentýž stav, kreslí se celá buňka — půlit by
 * znamenalo tvrdit rozdíl, který tam není. Jinak vznikne úhlopříčka
 * `pulka-<dopoledne>-<odpoledne>`; levý horní roh je ráno, pravý dolní
 * odpoledne. Díky tomu umí buňka i kombinace, na které staré
 * dvě třídy (odjezdový / příjezdový den) nestačily — třeba obsazené
 * dopoledne (červená) a odpoledne obsazený jen cizí pokoj (oranžová).
 */
export function tridaPulek(dopoledne, odpoledne) {
  if (dopoledne === odpoledne) {
    if (dopoledne === 'plno') return 'is-full';
    if (dopoledne === 'castecne') return 'is-partial';
    return '';
  }
  return `pulka-${dopoledne}-${odpoledne}`;
}
