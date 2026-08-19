/**
 * Kontrola matematiky ceníku. Běží v Node, bez prohlížeče a bez sítě —
 * `src/utils/cenik.js` je schválně čistý modul, takže jde protestovat sám.
 */
import { cenaZaOsobuNoc, vikendovyPriplatek, VYCHOZI_CENY, najdiSezonu, jeVSezone, maxOsobNaPokoji }
  from '../src/utils/cenik.js';

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  const sedi = JSON.stringify(skutecnost) === JSON.stringify(ocekavani);
  if (!sedi) { chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`); }
};

// Ceník hotelu — cena za OSOBU a noc, klesá s počtem lidí na pokoji.
overit('standard 1 osoba', cenaZaOsobuNoc({ kategorie: 'standard', pocetOsob: 1 }), 890);
overit('standard 2 osoby', cenaZaOsobuNoc({ kategorie: 'standard', pocetOsob: 2 }), 740);
overit('standard 3 osoby', cenaZaOsobuNoc({ kategorie: 'standard', pocetOsob: 3 }), 720);
overit('standard 4 osoby', cenaZaOsobuNoc({ kategorie: 'standard', pocetOsob: 4 }), 700);
// U nadstandardu není 1780 chyba: sólo host platí celý pokoj.
overit('nadstandard 1 osoba', cenaZaOsobuNoc({ kategorie: 'nadstandard', pocetOsob: 1 }), 1780);
overit('nadstandard 2 osoby', cenaZaOsobuNoc({ kategorie: 'nadstandard', pocetOsob: 2 }), 890);
overit('turistický = standard', VYCHOZI_CENY.turisticky, VYCHOZI_CENY.standard);

// Víkendový příplatek se řídí kategorií pokoje, ne sezónou.
overit('víkend standard', vikendovyPriplatek('standard'), 60);
overit('víkend nadstandard', vikendovyPriplatek('nadstandard'), 100);
overit('víkend turistický = standard', vikendovyPriplatek('turisticky'), 60);
// Nula od admina znamená „bez příplatku" a musí se respektovat.
overit('víkend 0 se respektuje',
  vikendovyPriplatek('standard', { nastaveni: { vikend_standard: 0 } }), 0);

// Sezóna s datem MM-DD platí každý rok a smí přecházet přes Nový rok.
const zima = { datum_od: '11-01', datum_do: '04-15', nazev: 'Zima' };
overit('zima platí v prosinci', jeVSezone('2026-12-20', zima), true);
overit('zima platí v lednu', jeVSezone('2027-01-10', zima), true);
overit('zima neplatí v červnu', jeVSezone('2026-06-10', zima), false);

// Jednorázová sezóna s celým datem má přednost před opakující se.
const silvestr = { datum_od: '2026-12-27', datum_do: '2027-01-03', nazev: 'Silvestr', opakuje_se: false };
overit('jednorázová sezóna vyhrává',
  (najdiSezonu('2026-12-30', [zima, silvestr]) || {}).nazev, 'Silvestr');

// Kapacity pokojů: všude dvě stálá lůžka, liší se jen přistýlky.
overit('pokoj bez přistýlky', maxOsobNaPokoji({ zakladni_luzka: 2, max_pristylek: 0 }), 2);
overit('pokoj s 1 přistýlkou', maxOsobNaPokoji({ zakladni_luzka: 2, max_pristylek: 1 }), 3);
overit('pokoj s 2 přistýlkami', maxOsobNaPokoji({ zakladni_luzka: 2, max_pristylek: 2 }), 4);

// Pořadí hledání ceny: výjimka pro konkrétní pokoj přebije cenu kategorie.
const cenikSVyjimkou = {
  sezony: [{ id: 'z', je_zakladni: true, nazev: 'Základní' }],
  ceny: [{ sezona_id: 'z', kategorie: 'standard', pocet_osob: 2, cena_za_osobu_noc: 800 }],
  cenyPokoj: [{ sezona_id: 'z', room_id: 'p1', pocet_osob: 2, cena_za_osobu_noc: 999 }],
  nastaveni: {}
};
overit('cena kategorie ze základní sezóny',
  cenaZaOsobuNoc({ datumStr: '2026-07-01', kategorie: 'standard', pocetOsob: 2, cenik: cenikSVyjimkou }), 800);
overit('výjimka pro pokoj přebije kategorii',
  cenaZaOsobuNoc({ datumStr: '2026-07-01', roomId: 'p1', kategorie: 'standard', pocetOsob: 2, cenik: cenikSVyjimkou }), 999);

// Prázdná buňka v sezóně znamená „použij základní ceník".
const cenikSPrazdnouSezonou = {
  sezony: [
    { id: 'z', je_zakladni: true, nazev: 'Základní' },
    { id: 'l', datum_od: '06-01', datum_do: '09-30', nazev: 'Léto' }
  ],
  ceny: [{ sezona_id: 'z', kategorie: 'standard', pocet_osob: 2, cena_za_osobu_noc: 800 }],
  cenyPokoj: [], nastaveni: {}
};
overit('prázdná buňka spadne na základní ceník',
  cenaZaOsobuNoc({ datumStr: '2026-07-01', kategorie: 'standard', pocetOsob: 2, cenik: cenikSPrazdnouSezonou }), 800);

process.exit(chyb ? 1 : 0);
