/**
 * CENÍK — určení ceny za osobu a noc
 *
 * Cena se skládá ze tří os:
 *   1. SEZÓNA        — podle data noci (zima / léto / základní / jednorázová)
 *   2. KATEGORIE     — standard / nadstandard / turistický, s možností
 *                      výjimky pro jeden konkrétní pokoj
 *   3. POČET OSOB    — čím víc lidí na pokoji, tím nižší cena za osobu;
 *                      ceník začíná u DVOU osob, sólo host platí cenu pro
 *                      dva plus příplatek za jednu osobu na pokoji
 *
 * Navíc víkendový příplatek (pátek, sobota, neděle), který se liší podle
 * kategorie pokoje a platí stejně pro všechny sezóny — nastavuje se na
 * obrazovce Příplatky (klíče vikend_standard / vikend_nadstandard).
 * Stejně tak příplatek za jednu osobu (solo_standard / solo_nadstandard),
 * Kč za noc: majitel ho chce ladit podle obsazenosti, ne přepisovat sloupec
 * v každém období zvlášť.
 *
 * Tenhle soubor je čistá matematika bez sítě a bez DOM, aby se dal
 * spolehlivě testovat.
 */

/** Nejvyšší počet osob, pro který má smysl držet sloupec v ceníku. */
export const MAX_OSOB_V_CENIKU = 4;

/**
 * Nejnižší počet osob, pro který ceník drží sloupec. Sloupec „1 osoba"
 * byl zrušen 2. 9. 2026 na přání majitele: sólo host platí cenu pro dva
 * plus příplatek za jednu osobu (viz `soloPriplatek`). Majitel tak mění
 * jedno číslo v Příplatcích a nemusí přepisovat sloupec v každém období.
 */
export const MIN_OSOB_V_CENIKU = 2;

/**
 * Záchranné ceny, když se ceník nestihne načíst nebo je databáze prázdná.
 * Opsáno z ceníku na umustku.cz platného od 1. 1. 2026.
 * Hodnoty jsou v Kč za OSOBU a NOC se snídaní.
 */
export const VYCHOZI_CENY = {
  standard:    { 2: 740, 3: 720, 4: 700 },
  nadstandard: { 2: 890, 3: 890, 4: 890 },
  turisticky:  { 2: 740, 3: 720, 4: 700 },
};

/**
 * Záchranný příplatek za jednu osobu na pokoji, Kč / NOC (ne za osobu —
 * osoba je jen jedna). Odvozeno ze starého ceníku: standard 890 vs 740,
 * nadstandard 1780 vs 890, kde sólo host platil celý pokoj.
 */
export const VYCHOZI_SOLO = { standard: 150, nadstandard: 890 };

/** Prázdný ceník — používá se, dokud se nenačtou data. */
export const PRAZDNY_CENIK = { sezony: [], ceny: [], cenyPokoj: [], nastaveni: {} };

/**
 * Záchranné víkendové příplatky (pá, so, ne), Kč / osoba / noc.
 * Opsáno z ceníku hotelu — turistický má stejné ceny jako standard,
 * proto sdílí i příplatek.
 */
export const VYCHOZI_VIKEND = { standard: 60, nadstandard: 100 };

/**
 * Vrátí 'MM-DD' z data ve tvaru 'YYYY-MM-DD'.
 */
function mesicDen(datumStr) {
  return String(datumStr).slice(5, 10);
}

/**
 * Spadá datum do rozsahu sezóny?
 *
 * U opakujících se sezón se porovnává jen měsíc a den, takže platí
 * každý rok. Rozsah smí přecházet přes Nový rok — zima 1. 11. → 15. 4.
 * se pozná podle toho, že začátek je později než konec.
 */
export function jeVSezone(datumStr, sezona) {
  if (!sezona) return false;
  if (sezona.je_zakladni) return true;
  if (!sezona.datum_od || !sezona.datum_do) return false;

  if (sezona.opakuje_se === false) {
    return datumStr >= sezona.datum_od && datumStr <= sezona.datum_do;
  }

  const md = mesicDen(datumStr);
  const od = String(sezona.datum_od).slice(-5);
  const doKdy = String(sezona.datum_do).slice(-5);

  if (od <= doKdy) return md >= od && md <= doKdy;
  return md >= od || md <= doKdy; // rozsah přes Nový rok
}

/**
 * Najde sezónu platnou pro dané datum.
 *
 * Pořadí přednosti:
 *   1. jednorázová sezóna (konkrétní rok — Vánoce, Silvestr)
 *   2. vyšší priorita
 *   3. základní sezóna jako poslední záchrana
 */
export function najdiSezonu(datumStr, sezony = []) {
  const kandidati = (sezony || []).filter(s => !s.je_zakladni && jeVSezone(datumStr, s));

  if (kandidati.length > 0) {
    kandidati.sort((a, b) => {
      const jednorazovaA = a.opakuje_se === false ? 1 : 0;
      const jednorazovaB = b.opakuje_se === false ? 1 : 0;
      if (jednorazovaA !== jednorazovaB) return jednorazovaB - jednorazovaA;
      const prioA = Number(a.priorita) || 0;
      const prioB = Number(b.priorita) || 0;
      if (prioA !== prioB) return prioB - prioA;
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    });
    return kandidati[0];
  }

  return (sezony || []).find(s => s.je_zakladni) || null;
}

/**
 * Ořízne počet osob na sloupec, který ceník opravdu má.
 * Víc lidí, než kolik je sloupců, platí cenu posledního sloupce;
 * jedna osoba platí sazbu pro dva (příplatek se přičítá zvlášť).
 */
function sloupecOsob(pocetOsob) {
  const n = Math.max(MIN_OSOB_V_CENIKU, parseInt(pocetOsob, 10) || MIN_OSOB_V_CENIKU);
  return Math.min(n, MAX_OSOB_V_CENIKU);
}

/**
 * Vyhledá jedno číslo v seznamu cen. Vrací null, když buňka není
 * vyplněná — volající pak sáhne o úroveň níž.
 */
function najdiCenu(seznam, filtr) {
  const zaznam = (seznam || []).find(filtr);
  if (!zaznam) return null;
  const c = Number(zaznam.cena_za_osobu_noc);
  return Number.isFinite(c) && c > 0 ? c : null;
}

/**
 * Vrátí cenu za osobu a noc pro jednu konkrétní noc.
 *
 * Hledá se odshora dolů, první vyplněná hodnota vyhrává:
 *   1. výjimka pro tenhle pokoj v nalezené sezóně
 *   2. cena kategorie v nalezené sezóně
 *   3. výjimka pro tenhle pokoj v základní sezóně
 *   4. cena kategorie v základní sezóně
 *   5. záchranná výchozí cena
 *
 * Díky tomu stačí u nové sezóny vyplnit jen to, co se liší.
 */
export function cenaZaOsobuNoc({
  datumStr,
  roomId = null,
  kategorie = 'standard',
  pocetOsob = 2,
  cenik = PRAZDNY_CENIK,
}) {
  const osob = sloupecOsob(pocetOsob);
  const sezony = cenik.sezony || [];
  const sezona = najdiSezonu(datumStr, sezony);
  const zakladni = sezony.find(s => s.je_zakladni) || null;

  const zkusSezonu = (sez) => {
    if (!sez) return null;
    if (roomId) {
      const vyjimka = najdiCenu(cenik.cenyPokoj,
        c => c.sezona_id === sez.id && c.room_id === roomId && Number(c.pocet_osob) === osob);
      if (vyjimka !== null) return vyjimka;
    }
    return najdiCenu(cenik.ceny,
      c => c.sezona_id === sez.id && c.kategorie === kategorie && Number(c.pocet_osob) === osob);
  };

  const zeSezony = zkusSezonu(sezona);
  if (zeSezony !== null) return zeSezony;

  if (zakladni && (!sezona || sezona.id !== zakladni.id)) {
    const zeZakladni = zkusSezonu(zakladni);
    if (zeZakladni !== null) return zeZakladni;
  }

  const tabulka = VYCHOZI_CENY[kategorie] || VYCHOZI_CENY.standard;
  return tabulka[osob] || tabulka[MAX_OSOB_V_CENIKU] || 0;
}

/**
 * Víkendový příplatek pro kategorii pokoje (Kč / osoba / noc).
 *
 * Platí stejně pro všechny sezóny i základní ceník — je to vlastnost
 * pokoje, ne období, proto se nastavuje jedním číslem na kategorii
 * v Příplatcích. Turistický sdílí hodnotu se standardem, protože má
 * i stejné ceny. Nula od admina znamená „bez příplatku" a respektuje se.
 */
export function vikendovyPriplatek(kategorie = 'standard', cenik = PRAZDNY_CENIK) {
  const kat = kategorie === 'nadstandard' ? 'nadstandard' : 'standard';
  const p = Number(cenik.nastaveni && cenik.nastaveni['vikend_' + kat]);
  if (Number.isFinite(p) && p >= 0) return p;
  return VYCHOZI_VIKEND[kat];
}

/**
 * Příplatek za jednu osobu na pokoji (Kč / noc).
 *
 * Host, který přijede sám, platí sazbu pro DVĚ osoby (jednu) plus tento
 * příplatek — tak to majitel chce: „když je cena pro dvě osoby 2 000,
 * pro jednu nebude 1 000, ale 1 600". Nastavuje se v Příplatcích podle
 * kategorie pokoje; turistický sdílí hodnotu se standardem. Nula od
 * admina znamená „bez příplatku" — když je mrtvo, vezme i sólo hosta bez
 * přirážky.
 */
export function soloPriplatek(kategorie = 'standard', cenik = PRAZDNY_CENIK) {
  const kat = kategorie === 'nadstandard' ? 'nadstandard' : 'standard';
  const p = Number(cenik.nastaveni && cenik.nastaveni['solo_' + kat]);
  if (Number.isFinite(p) && p >= 0) return p;
  return VYCHOZI_SOLO[kat];
}

/**
 * Je období mezisezóna?
 *
 * Slouží JEN k textovému upozornění v rezervačním formuláři, že mimo
 * hlavní sezónu bývá nabídka užší. Nic neblokuje a na cenu nemá vliv.
 *
 * Skutečné zavírání provozu se dělá v administraci přes „Blokovat
 * termíny" (konkrétní pokoj a rozsah dnů) nebo „Blokování pokojů"
 * (pokoj mimo provoz). Záměrně sem nepřibyl vlastní přepínač — byla by
 * to třetí cesta, jak zavřít pobyt, a tři soupeřící mechanismy na jednu
 * věc jsou spolehlivý zdroj nedorozumění.
 *
 * Pozná se podle názvu období. Kdo mezisezónu přejmenuje tak, aby v ní
 * „mezisez" nebylo, přijde o upozornění — je to jen věta navíc, ne
 * ochrana proti přeplnění.
 */
export function maOmezenouDostupnost(sezona) {
  if (!sezona) return false;
  return /mezisez/i.test(String(sezona.nazev || ''));
}

/**
 * Období s omezenou dostupností, do kterých pobyt zasahuje.
 *
 * Prochází se po nocích, ne jen krajní dny — pobyt může přes takové
 * období jen přejet a host to má vědět i tak. Vrací názvy bez opakování
 * v pořadí, v jakém na ně pobyt narazí.
 */
export function obdobiSOmezenouDostupnosti(dateFrom, nights, cenik = PRAZDNY_CENIK) {
  const pocetNoci = Math.max(1, parseInt(nights, 10) || 1);
  if (!dateFrom) return [];

  const [r, m, d] = String(dateFrom).split('-').map(Number);
  if (!r || !m || !d) return [];

  const nalezene = [];
  for (let i = 0; i < pocetNoci; i++) {
    const dt = new Date(Date.UTC(r, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + i);
    const sezona = najdiSezonu(dt.toISOString().split('T')[0], cenik.sezony || []);
    if (sezona && maOmezenouDostupnost(sezona) && !nalezene.includes(sezona.nazev)) {
      nalezene.push(sezona.nazev);
    }
  }
  return nalezene;
}

/**
 * Kolik osob se vejde na pokoj — stálá lůžka plus přistýlky.
 */
export function maxOsobNaPokoji(pokoj) {
  if (!pokoj) return 2;
  const luzka = Number(pokoj.zakladni_luzka ?? pokoj.zakladniLuzka ?? pokoj.capacity ?? 2);
  const pristylky = Number(pokoj.max_pristylek ?? pokoj.maxPristylek ?? pokoj.extraBeds ?? 0);
  const celkem = (Number.isFinite(luzka) ? luzka : 2) + (Number.isFinite(pristylky) ? pristylky : 0);
  return Math.max(1, celkem);
}

/**
 * Rozpis cen po nocích pro celý pobyt.
 *
 * Vrací pole, kde každá položka je jedna noc — díky tomu se pobyt
 * přes přelom sezón spočítá sám a v rekapitulaci jde ukázat,
 * proč cena vyšla právě takhle.
 */
export function rozpisNoci({
  dateFrom,
  nights,
  roomId = null,
  kategorie = 'standard',
  pocetOsob = 2,
  cenik = PRAZDNY_CENIK,
}) {
  const pocetNoci = Math.max(1, parseInt(nights, 10) || 1);
  const noci = [];
  if (!dateFrom) return noci;

  const [r, m, d] = String(dateFrom).split('-').map(Number);
  if (!r || !m || !d) return noci;

  const osob = Math.max(1, parseInt(pocetOsob, 10) || 1);
  // Sólo host: sazba pro dva + příplatek za noc. Příplatek je za NOC, ne
  // za osobu — osoba je jen jedna, takže se nenásobí.
  const solo = osob === 1 ? soloPriplatek(kategorie, cenik) : 0;

  for (let i = 0; i < pocetNoci; i++) {
    const dt = new Date(Date.UTC(r, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + i);
    const datumStr = dt.toISOString().split('T')[0];
    const denVTydnu = dt.getUTCDay(); // 0 = neděle
    const jeVikend = denVTydnu === 5 || denVTydnu === 6 || denVTydnu === 0;

    const zaklad = cenaZaOsobuNoc({ datumStr, roomId, kategorie, pocetOsob, cenik });
    const priplatek = jeVikend ? vikendovyPriplatek(kategorie, cenik) : 0;
    const sezona = najdiSezonu(datumStr, cenik.sezony || []);

    noci.push({
      datum: datumStr,
      jeVikend,
      sezonaId: sezona ? sezona.id : null,
      sezonaNazev: sezona ? sezona.nazev : 'Základní ceník',
      cenaZaOsobu: zaklad + priplatek,
      zakladniCenaZaOsobu: zaklad,
      vikendovyPriplatek: priplatek,
      soloPriplatek: solo,
      cenaZaNoc: (zaklad + priplatek) * osob + solo,
    });
  }

  return noci;
}

/**
 * Krátký popis rozpisu do rekapitulace, např.
 * "2× víkendová noc (950 Kč/os) + 1× všední noc (890 Kč/os)".
 * Seskupuje noci se stejnou cenou, aby popis nenarostl u dlouhých pobytů.
 */
export function popisRozpisu(noci, formatuj = (v) => `${v} Kč`) {
  if (!noci || noci.length === 0) return '';

  const skupiny = new Map();
  for (const noc of noci) {
    const klic = `${noc.jeVikend ? 'v' : 't'}|${noc.cenaZaOsobu}|${noc.sezonaNazev}`;
    const s = skupiny.get(klic) || { pocet: 0, jeVikend: noc.jeVikend, cena: noc.cenaZaOsobu, sezona: noc.sezonaNazev };
    s.pocet += 1;
    skupiny.set(klic, s);
  }

  const viceSezon = new Set(noci.map(n => n.sezonaNazev)).size > 1;

  return [...skupiny.values()]
    .map(s => {
      const typ = s.jeVikend ? 'víkendová noc' : 'všední noc';
      const sezona = viceSezon ? ` – ${s.sezona}` : '';
      return `${s.pocet}× ${typ} (${formatuj(s.cena)}/os${sezona})`;
    })
    .join(' + ');
}
