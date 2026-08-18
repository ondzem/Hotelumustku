/**
 * SPRÁVA CENÍKU V ADMINISTRACI
 *
 * Vykreslení a obsluha okna "Ceník". Bydlí ve vlastním souboru, aby
 * AdminDashboard.js nenarostl o dalších tisíc řádků.
 *
 * Všechny funkce dostávají `ad` — živou instanci AdminDashboard.
 * Používají z ní: ad.container, ad.cenik, ad.roomPrices, ad.render(),
 * ad.showAdminToast().
 *
 * PROČ PRŮVODCE A NE JEDNA DLOUHÁ STRÁNKA
 * Okno používá recepční, který s počítačem nepracuje denně. Dřívější
 * podoba ukazovala všech šest částí najednou — přes třicet políček a
 * pět různých tlačítek "Uložit". Kdo změnil cenu a stiskl špatné
 * tlačítko, o změnu tiše přišel.
 *
 * Proto se okno chová jako průvodce: na jedné obrazovce je vždy jedna
 * úloha a k ní jedno jediné tlačítko, které uloží všechno, co je na ní
 * vidět. Cesta vede přes rozcestník, takže první, co uživatel řeší,
 * není tabulka čísel, ale otázka "co chci změnit".
 *
 * Termín období a jeho ceny bydlí schválně na JEDNÉ obrazovce. Dřív byly
 * zvlášť a uživatel musel překlikávat mezi dvěma místy, která o té samé
 * věci mluvila jinými slovy.
 *
 * Obrazovky (ad.cenikKrok):
 *   rozcestnik     — co chci upravit
 *   ceny-sezona    — krok 1/2: které období (a založení nového)
 *   ceny-tabulka   — krok 2/2: termín + ceny + výjimky, jedno uložení
 *   priplatky      — polopenze, pes, kolo, záloha
 *   pokoje         — názvy, lůžka, přistýlky
 */

import { MOCK_ROOMS, isSupabaseConfigured, supabase, saveStoredCenik, saveStoredCustomRoomName } from '../lib/supabaseClient.js';
import { MAX_OSOB_V_CENIKU, jeVSezone, vikendovyPriplatek, VYCHOZI_CENY } from '../utils/cenik.js';

const KATEGORIE = [
  { klic: 'standard', nazev: 'Standard' },
  { klic: 'nadstandard', nazev: 'Nadstandard', pozn: 'Mahagon, Motýl, Zen' },
  { klic: 'turisticky', nazev: 'Turistický' },
];

const SLOUPCE_OSOB = Array.from({ length: MAX_OSOB_V_CENIKU }, (_, i) => i + 1);

/** 2. pádem se skloňuje datum: "1. listopadu". */
const MESICE = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

/** 1. pádem se nabízí ve výběru: "listopad". */
const MESICE_1P = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

// ---------------------------------------------------------------------
//  SPOLEČNÉ STYLY
//
//  Velikosti jsou schválně větší, než je na webu zvykem. Okno používá
//  člověk, kterému drobné písmo a nízká políčka dělají potíže.
// ---------------------------------------------------------------------

const S = {
  input: 'width: 100%; height: 46px; font-size: 16px; font-weight: 700; padding: 0 11px; border-radius: 5px; border: 1.5px solid #c9c8bd; box-sizing: border-box; background: #fff; color: #1c1c19;',
  inputCislo: 'width: 100%; height: 46px; font-size: 16px; font-weight: 700; text-align: right; padding: 0 10px; border-radius: 5px; border: 1.5px solid #c9c8bd; box-sizing: border-box; background: #fff; color: #1c1c19;',
  popisek: 'display: block; font-size: 13px; font-weight: 700; color: #55554e; margin-bottom: 6px;',
  btnHlavni: 'height: 50px; padding: 0 26px; font-size: 15.5px; font-weight: 800; border-radius: 3px; border: none; background: #697947; color: #fff; cursor: pointer;',
  btnVedlejsi: 'height: 46px; padding: 0 18px; font-size: 14.5px; font-weight: 700; border-radius: 3px; border: 1.5px solid #c9c8bd; background: #fff; color: #1c1c19; cursor: pointer;',
  btnZpet: 'height: 40px; padding: 0 4px; font-size: 14.5px; font-weight: 700; border: none; background: none; color: #697947; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;',
  napoveda: 'margin: 0 0 18px 0; font-size: 14px; color: #6b6b60; line-height: 1.6;',
  blok: 'background: #fff; border: 1.5px solid #e0dfd5; border-radius: 8px; padding: 18px 20px; margin-bottom: 16px;',
};

function escapuj(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** '11-01' → '1. listopadu', '2026-12-24' → '24. prosince 2026' */
function popisDatumu(hodnota, opakujeSe) {
  if (!hodnota) return '—';
  const casti = String(hodnota).split('-');
  if (opakujeSe !== false && casti.length === 2) {
    return `${parseInt(casti[1], 10)}. ${MESICE[parseInt(casti[0], 10) - 1] || ''}`;
  }
  if (casti.length === 3) {
    return `${parseInt(casti[2], 10)}. ${MESICE[parseInt(casti[1], 10) - 1] || ''} ${casti[0]}`;
  }
  return hodnota;
}

/** '11-01' i '2026-11-01' → { den, mesic, rok }. Rok je null u opakujících se. */
function rozlozDatum(hodnota) {
  const casti = String(hodnota || '').split('-').filter(Boolean);
  if (casti.length === 3) {
    return { rok: Number(casti[0]), mesic: Number(casti[1]), den: Number(casti[2]) };
  }
  if (casti.length === 2) {
    return { rok: null, mesic: Number(casti[0]), den: Number(casti[1]) };
  }
  return { rok: null, mesic: 1, den: 1 };
}

/** Opačný směr — z výběrů zpět na text pro databázi. */
function slozDatum(den, mesic, rok) {
  const dd = String(Math.max(1, Math.min(31, Number(den) || 1))).padStart(2, '0');
  const mm = String(Math.max(1, Math.min(12, Number(mesic) || 1))).padStart(2, '0');
  return rok ? `${rok}-${mm}-${dd}` : `${mm}-${dd}`;
}

/** Vybraná sezóna, s návratem k základní. */
function aktivniSezona(ad) {
  const sezony = (ad.cenik && ad.cenik.sezony) || [];
  if (sezony.length === 0) return null;
  return sezony.find(s => s.id === ad.cenikSezonaId)
      || sezony.find(s => s.je_zakladni)
      || sezony[0];
}

function zakladniSezona(ad) {
  return ((ad.cenik && ad.cenik.sezony) || []).find(s => s.je_zakladni) || null;
}

/** Sezóny seřazené tak, že základní je vždy první. */
function serazeneSezony(ad) {
  return [...((ad.cenik && ad.cenik.sezony) || [])].sort((a, b) => {
    if (a.je_zakladni !== b.je_zakladni) return a.je_zakladni ? -1 : 1;
    return String(a.nazev).localeCompare(String(b.nazev), 'cs');
  });
}

/** Hodnota buňky pro kategorii, nebo prázdno, když se dědí. */
function hodnotaKategorie(ad, sezonaId, kategorie, osob) {
  const z = ((ad.cenik && ad.cenik.ceny) || []).find(
    c => c.sezona_id === sezonaId && c.kategorie === kategorie && Number(c.pocet_osob) === osob);
  return z && z.cena_za_osobu_noc != null ? z.cena_za_osobu_noc : '';
}

/** Hodnota buňky pro konkrétní pokoj (výjimka). */
function hodnotaPokoje(ad, sezonaId, roomId, osob) {
  const z = ((ad.cenik && ad.cenik.cenyPokoj) || []).find(
    c => c.sezona_id === sezonaId && c.room_id === roomId && Number(c.pocet_osob) === osob);
  return z && z.cena_za_osobu_noc != null ? z.cena_za_osobu_noc : '';
}

/** Kolik výjimek má sezóna nastavených. */
function pocetVyjimek(ad, sezonaId) {
  return ((ad.cenik && ad.cenik.cenyPokoj) || [])
    .filter(c => c.sezona_id === sezonaId && c.cena_za_osobu_noc != null).length;
}

/** Kolik cen má sezóna vyplněných — do popisku na rozcestníku. */
function pocetCen(ad, sezonaId) {
  return ((ad.cenik && ad.cenik.ceny) || [])
    .filter(c => c.sezona_id === sezonaId && c.cena_za_osobu_noc != null).length;
}

/**
 * S kterými dalšími obdobími se tohle překrývá?
 *
 * Priorita má smysl jen při překryvu, jinak je to políčko navíc, kterému
 * obsluha nemá důvod rozumět. Proto se ukazuje, teprve když překryv
 * opravdu nastane.
 *
 * Rozsahy jsou MM-DD a smí přecházet přes Nový rok, takže se neporovnávají
 * hranice — projde se celý rok po dnech a hledá se den, na který sedí obě
 * období. Rok 2028 je schválně přestupný, ať se otestuje i 29. února.
 */
function prekryvajiciObdobi(ad, sezona) {
  if (!sezona || sezona.je_zakladni) return [];
  const ostatni = ((ad.cenik && ad.cenik.sezony) || [])
    .filter(s => !s.je_zakladni && s.id !== sezona.id);
  if (ostatni.length === 0) return [];

  const nalezene = [];
  const den = new Date(Date.UTC(2028, 0, 1));
  for (let i = 0; i < 366; i++) {
    const datumStr = den.toISOString().split('T')[0];
    if (jeVSezone(datumStr, sezona)) {
      ostatni.forEach(s => {
        if (jeVSezone(datumStr, s) && !nalezene.includes(s.nazev)) nalezene.push(s.nazev);
      });
    }
    den.setUTCDate(den.getUTCDate() + 1);
  }
  return nalezene;
}

function skloňujOsoby(n) {
  return n === 1 ? 'osoba' : n < 5 ? 'osoby' : 'osob';
}

// ---------------------------------------------------------------------
//  STAVEBNÍ PRVKY
// ---------------------------------------------------------------------

/**
 * Obal každé obrazovky. Drží hlavičku, tlačítko zpět a spodní lištu
 * s jediným ukládacím tlačítkem — aby bylo vždy na stejném místě.
 */
function obrazovka({ titul, krokovnik = '', napoveda = '', zpet = null, obsah, akce = '' }) {
  return `
    <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-prices">
      <div class="admin-confirm-modal admin-block-modal cenik-modal"
           style="max-width: 860px; padding: 0; max-height: min(90dvh, 900px); display: flex; flex-direction: column; overflow: hidden;">
        <!-- Jen boční padding: svislý si drží .admin-modal-header-sticky, aby
             hlavička seděla stejně jako u Slevových kódů i na mobilu. -->
        <div class="admin-modal-header-sticky" style="flex-shrink: 0; padding-left: 26px; padding-right: 26px;">
          <h3 class="admin-modal-title" style="margin: 0; font-size: 19px; font-weight: 800; color: #1c1c19;">💰 Ceník</h3>
          <button type="button" class="btn-close-prices-modal" title="Zavřít"
                  style="background: none; border: none; font-size: 30px; cursor: pointer; color: #777; line-height: 1; padding: 4px 10px;">&times;</button>
        </div>

        <div class="cenik-obsah" style="flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0 26px 20px 26px;">
          ${zpet ? `
            <button type="button" class="btn-cenik-zpet" data-cenik-krok="${zpet.krok}" style="${S.btnZpet} margin-top: 12px;">
              <span style="font-size: 17px;">‹</span> ${escapuj(zpet.popis)}
            </button>
          ` : '<div style="height: 12px;"></div>'}

          ${krokovnik ? `<div style="margin-top: 6px; font-size: 13px; font-weight: 800; color: #697947; letter-spacing: 0.02em;">${krokovnik}</div>` : ''}

          <h4 style="margin: ${krokovnik ? '6px' : '10px'} 0 8px 0; font-size: 21px; font-weight: 800; color: #1c1c19; line-height: 1.3;">${titul}</h4>
          ${napoveda ? `<p style="${S.napoveda}">${napoveda}</p>` : ''}

          ${obsah}
        </div>

        ${akce ? `
          <div class="cenik-listaakci" style="flex-shrink: 0; background: #fff; padding: 14px 26px; border-top: 1.5px solid #e0dfd5; display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
            ${akce}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Vlastní potvrzovací okno místo window.confirm / window.prompt.
 *
 * Nativní dialog prohlížeče vypadá jako systémová chyba („localhost:5173
 * says…“), na každém prohlížeči jinak a nedá se stylovat. Pro obsluhu,
 * která si u počítače není jistá, je to zbytečné leknutí. Používá se
 * proto stejný vzhled jako u mazání rezervace ve zbytku administrace.
 */
function dialogHtml(d) {
  if (!d) return '';
  return `
    <div class="admin-modal-overlay cenik-dialog-overlay" style="z-index: 12000;">
      <div class="admin-confirm-modal cenik-dialog" style="max-width: 460px;">
        <h3 class="admin-modal-title">${escapuj(d.nadpis)}</h3>
        <p class="admin-modal-desc">${d.popis}</p>
        ${d.prompt ? `
          <input type="text" class="form-input cenik-dialog-vstup" value="${escapuj(d.vychozi || '')}"
                 placeholder="${escapuj(d.placeholder || '')}" style="${S.input} margin-bottom: 4px;">
        ` : ''}
        <div class="admin-modal-actions">
          <button type="button" class="btn-modal-cancel cenik-dialog-zrusit">Zrušit</button>
          <button type="button" class="${d.nebezpecne ? 'btn-modal-danger' : 'btn-modal-cancel'} cenik-dialog-potvrdit"
                  ${d.nebezpecne ? '' : `style="background: #697947; color: #fff; border-color: #697947;"`}>${escapuj(d.potvrdText || 'Pokračovat')}</button>
        </div>
      </div>
    </div>
  `;
}

/** Otevře dialog a počká, co uživatel zvolí. */
function zeptejSe(ad, nastaveni) {
  return new Promise(resolve => {
    ad.cenikDialog = nastaveni;
    ad.cenikDialogResolve = resolve;
    ad.render();
  });
}

/** Velké tlačítko-karta na rozcestníku a při výběru sezóny. */
function kartaVolby({ krok, sezonaId = '', ikona, titul, popis, znacka = '' }) {
  return `
    <button type="button" class="cenik-karta" data-cenik-krok="${krok}" ${sezonaId ? `data-sezona-id="${escapuj(sezonaId)}"` : ''}
            style="width: 100%; display: flex; align-items: center; gap: 16px; text-align: left; background: #fff; border: 1.5px solid #e0dfd5; border-radius: 8px; padding: 18px 20px; margin-bottom: 12px; cursor: pointer;">
      <span style="font-size: 27px; line-height: 1; flex-shrink: 0;">${ikona}</span>
      <span style="flex: 1; min-width: 0;">
        <span style="display: block; font-size: 17px; font-weight: 800; color: #1c1c19; margin-bottom: 3px;">${escapuj(titul)}</span>
        <span style="display: block; font-size: 14px; color: #6b6b60; line-height: 1.5;">${popis}</span>
      </span>
      ${znacka ? `<span style="flex-shrink: 0; font-size: 12.5px; font-weight: 800; color: #697947; background: #eef1e6; border-radius: 99px; padding: 5px 11px; white-space: nowrap;">${znacka}</span>` : ''}
      <span style="flex-shrink: 0; font-size: 23px; color: #b5b4a8;">›</span>
    </button>
  `;
}

// ---------------------------------------------------------------------
//  OBRAZOVKY
// ---------------------------------------------------------------------

function oknoNacita() {
  return obrazovka({
    titul: 'Načítám ceník…',
    obsah: `
      <div style="${S.blok} display: flex; align-items: center; gap: 14px; color: #6b6b60; font-size: 15px;">
        <span style="width: 22px; height: 22px; border: 3px solid #e0dfd5; border-top-color: #697947; border-radius: 50%; display: inline-block; animation: cenik-otaceni 0.8s linear infinite;"></span>
        Chvilku strpení, načítají se ceny z databáze.
      </div>
      <style>@keyframes cenik-otaceni { to { transform: rotate(360deg); } }</style>
    `,
  });
}

function oknoBezDat() {
  return obrazovka({
    titul: 'Ceník ještě není založený',
    obsah: `
      <div style="background: #fff8e6; border: 1.5px solid #f0dca8; border-radius: 8px; padding: 18px 20px; font-size: 15px; color: #6b5a20; line-height: 1.65;">
        Tabulky ceníku zatím v databázi nejsou.<br><br>
        Otevři v Supabase <strong>SQL Editor</strong>, vlož obsah souboru
        <strong>supabase-cenik.sql</strong> z projektu a spusť ho.
        Založí tabulky a rovnou je naplní cenami podle stávajícího ceníku hotelu.<br><br>
        Než to proběhne, rezervace počítá podle výchozích cen
        (Standard 890 / 740 / 720 / 700 Kč za osobu a noc), takže web funguje dál.
      </div>
    `,
  });
}

function obrazovkaRozcestnik(ad) {
  return obrazovka({
    titul: 'Co chcete upravit?',
    napoveda: 'Vyberte jednu věc. Na další obrazovce už budete měnit jen ji — nic jiného se vám do cesty neplete.',
    obsah: `
      ${kartaVolby({
        krok: 'ceny-sezona',
        ikona: '💰',
        titul: 'Ceny a období',
        popis: 'Kolik stojí nocleh a kdy které ceny platí. Zima, léto, Vánoce — vše na jednom místě.',
      })}
      ${kartaVolby({
        krok: 'priplatky',
        ikona: '➕',
        titul: 'Příplatky a poplatky',
        popis: 'Víkendový příplatek, polopenze, pes, dobíjení elektrokola, zimní parkování, výše zálohy.',
      })}
      ${kartaVolby({
        krok: 'pokoje',
        ikona: '🛏️',
        titul: 'Pokoje',
        popis: 'Název pokoje, počet stálých lůžek a přistýlek.',
      })}
    `,
  });
}

function obrazovkaCenySezona(ad) {
  const sezony = serazeneSezony(ad);

  return obrazovka({
    krokovnik: 'KROK 1 ZE 2',
    titul: 'Které období chcete upravit?',
    napoveda: 'Základní ceník platí všude, kam nesahá žádné jiné období. Ostatní období ho přebijí jen v těch dnech, na které sedí. Na další obrazovce nastavíte jak termín, tak ceny.',
    zpet: { krok: 'rozcestnik', popis: 'Zpět na výběr' },
    obsah: `
      ${sezony.map(s => {
        const vyplneno = pocetCen(ad, s.id);
        const vyjimky = pocetVyjimek(ad, s.id);
        const popis = s.je_zakladni
          ? 'Platí celý rok, všude, kde neplatí jiné období.'
          : `Platí ${popisDatumu(s.datum_od, s.opakuje_se)} – ${popisDatumu(s.datum_do, s.opakuje_se)}${s.opakuje_se !== false ? ', každý rok' : ''}.`;
        const detail = vyplneno === 0
          ? '<span style="color:#96958a;">Zatím bez vlastních cen — bere se základní ceník.</span>'
          : `Vyplněno ${vyplneno} ${vyplneno === 1 ? 'cena' : vyplneno < 5 ? 'ceny' : 'cen'}${vyjimky > 0 ? `, ${vyjimky} výjimek pro pokoje` : ''}.`;
        return kartaVolby({
          krok: 'ceny-tabulka',
          sezonaId: s.id,
          ikona: s.je_zakladni ? '📋' : '📅',
          titul: s.nazev,
          popis: `${popis}<br>${detail}`,
          znacka: '',
        });
      }).join('')}

      <button type="button" class="btn-cenik-nova-sezona"
              style="width: 100%; background: #f7f6f1; border: 1.5px dashed #c9c8bd; border-radius: 8px; padding: 18px 20px; cursor: pointer; font-size: 15.5px; font-weight: 800; color: #697947;">
        + Přidat nové období
      </button>
    `,
  });
}

function obrazovkaCenyTabulka(ad) {
  const sezona = aktivniSezona(ad);
  if (!sezona) return obrazovkaCenySezona(ad);

  const jeZakladni = Boolean(sezona.je_zakladni);
  const zakladni = zakladniSezona(ad);
  const vyjimky = pocetVyjimek(ad, sezona.id);
  const otevreno = Boolean(ad.cenikVyjimkyOtevrene);
  const prekryv = prekryvajiciObdobi(ad, sezona);
  const opakuje = sezona.opakuje_se !== false;
  const od = rozlozDatum(sezona.datum_od);
  const doKdy = rozlozDatum(sezona.datum_do);
  const letos = new Date().getFullYear();
  const roky = [letos, letos + 1, letos + 2];

  /**
   * Výběr data jako den + měsíc (+ rok u jednorázového období).
   *
   * Rok se vykresluje VŽDY a jen se skrývá. Kdyby se přidával až po
   * odškrtnutí „Opakuje se každý rok“, muselo by se překreslit celé okno
   * (a přišlo by se o rozepsané ceny), nebo by pole chybělo úplně —
   * uložení by pak zapsalo jednorázové období bez roku a systém by
   * takový termín nikdy netrefil.
   */
  const vyberDatumu = (predpona, hodnota, popis) => `
    <div>
      <label style="${S.popisek}">${popis}</label>
      <div style="display: grid; grid-template-columns: 82px minmax(0, 1fr) auto; gap: 8px;">
        <select class="form-input cenik-${predpona}-den" aria-label="Den" style="${S.input} padding: 0 6px;">
          ${Array.from({ length: 31 }, (_, i) => i + 1).map(d =>
            `<option value="${d}" ${d === hodnota.den ? 'selected' : ''}>${d}.</option>`).join('')}
        </select>
        <select class="form-input cenik-${predpona}-mesic" aria-label="Měsíc" style="${S.input} padding: 0 6px;">
          ${MESICE_1P.map((m, i) =>
            `<option value="${i + 1}" ${(i + 1) === hodnota.mesic ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <select class="form-input cenik-rok cenik-${predpona}-rok" aria-label="Rok"
                style="${S.input} padding: 0 6px; width: 96px; display: ${opakuje ? 'none' : 'block'};">
          ${roky.map(r => `<option value="${r}" ${r === (hodnota.rok || letos) ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
  `;

  /**
   * Cena, která pro tuhle buňku platí právě teď.
   *
   * Ukazuje se šedě v prázdném políčku. Musí to být opravdová částka,
   * ne pomlčka ani vzorové číslo — recepční pak vidí, kolik se dnes
   * účtuje, a stačí to přepsat. Postupuje se stejným pořadím jako
   * ve výpočtu: sezóna → základní ceník → výchozí ceník v cenik.js.
   */
  const zastupnaHodnota = (kategorie, osob) => {
    if (!jeZakladni && zakladni) {
      const z = hodnotaKategorie(ad, zakladni.id, kategorie, osob);
      if (z !== '') return String(z);
    }
    const tabulka = VYCHOZI_CENY[kategorie] || VYCHOZI_CENY.standard;
    const vychozi = tabulka[osob] || tabulka[MAX_OSOB_V_CENIKU];
    return vychozi ? String(vychozi) : '—';
  };

  /**
   * Co pokoj stojí teď, když pro něj výjimka není.
   *
   * Slouží jako zástupný text v políčku výjimky. Dřív tam svítilo
   * „1 os.“ / „2 osoby“, což vypadalo, jako by se do políčka měl psát
   * počet lidí — a ne cena. Číslo tam splní obojí: ukáže, že se čeká
   * částka, a rovnou i jakou částku pokoj má bez výjimky.
   */
  const cenaKategoriePokoje = (kategorie, osob) => {
    const vSezone = hodnotaKategorie(ad, sezona.id, kategorie, osob);
    if (vSezone !== '') return String(vSezone);
    if (zakladni) {
      const zeZakladni = hodnotaKategorie(ad, zakladni.id, kategorie, osob);
      if (zeZakladni !== '') return String(zeZakladni);
    }
    const tabulka = VYCHOZI_CENY[kategorie] || VYCHOZI_CENY.standard;
    const vychozi = tabulka[osob] || tabulka[MAX_OSOB_V_CENIKU];
    return vychozi ? String(vychozi) : '—';
  };

  return obrazovka({
    krokovnik: 'KROK 2 ZE 2',
    titul: escapuj(sezona.nazev),
    napoveda: jeZakladni
      ? 'Vyplňte, kolik stojí <strong>jedna osoba na jednu noc</strong>. Čím víc lidí na pokoji, tím nižší cena za osobu — proto ta čísla klesají zleva doprava. <strong>Šedé číslo v prázdném políčku je cena, která platí teď</strong> — přepište ji svou částkou, nebo políčko nechte prázdné a zůstane v platnosti.'
      : 'Nahoře nastavíte, kdy období platí, dole kolik v něm stojí nocleh. Vyplňte jen ceny, které se <strong>liší od základního ceníku</strong>. <strong>Šedé číslo v prázdném políčku je cena, která platí teď</strong> — přepište ji svou částkou, nebo políčko nechte prázdné a zůstane v platnosti.',
    zpet: { krok: 'ceny-sezona', popis: 'Zpět na výběr období' },
    obsah: `
      <div style="${S.blok}">
        <strong style="display: block; font-size: 16px; font-weight: 800; color: #1c1c19; margin-bottom: 14px;">Kdy období platí</strong>

        ${jeZakladni ? `
          <p style="margin: 0 0 4px 0; font-size: 14.5px; color: #6b6b60; line-height: 1.6;">
            Základní ceník platí <strong>celý rok</strong> všude, kam nesahá jiné období. Termín se u něj nenastavuje.
          </p>
        ` : `
          <div style="margin-bottom: 18px;">
            <label style="${S.popisek}" for="cenik-nazev-sezony">Jak se období jmenuje</label>
            <input type="text" id="cenik-nazev-sezony" class="form-input cenik-sezona-nazev" value="${escapuj(sezona.nazev)}"
                   placeholder="například Zimní sezóna" style="${S.input}">
          </div>

          <label style="display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; color: #1c1c19; margin-bottom: 16px; cursor: pointer;">
            <input type="checkbox" class="cenik-sezona-opakuje" ${opakuje ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
            Opakuje se každý rok
          </label>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
            ${vyberDatumu('sezona-od', od, 'Platí od')}
            ${vyberDatumu('sezona-do', doKdy, 'Platí do (včetně)')}
          </div>

          <p style="margin: 12px 0 0 0; font-size: 13.5px; color: #96958a; line-height: 1.55;">
            Období smí přecházet přes Nový rok — třeba od 1. listopadu do 15. dubna.
          </p>
        `}

        ${jeZakladni || prekryv.length === 0 ? '' : `
          <div style="margin-top: 20px; padding-top: 18px; border-top: 1.5px dashed #e0dfd5;">
            <label style="${S.popisek}" for="cenik-priorita">Přednost před ${prekryv.length === 1 ? 'obdobím' : 'obdobími'} ${escapuj(prekryv.join(', '))}</label>
            <input type="number" id="cenik-priorita" class="form-input cenik-sezona-priorita" value="${Number(sezona.priorita) || 0}"
                   style="${S.inputCislo} max-width: 150px;">
            <p style="margin: 8px 0 0 0; font-size: 13.5px; color: #96958a; line-height: 1.55;">
              Toto období se kryje s ${prekryv.length === 1 ? 'obdobím' : 'obdobími'} <strong>${escapuj(prekryv.join(', '))}</strong>.
              Ve dnech, kdy platí obojí, vyhraje to s vyšším číslem.
            </p>
          </div>
        `}
      </div>

      <div style="${S.blok}">
        <strong style="display: block; font-size: 16px; font-weight: 800; color: #1c1c19; margin-bottom: 14px;">Ceny za osobu a noc</strong>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; min-width: 520px;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 0 10px 10px 0; font-size: 13px; font-weight: 700; color: #55554e;">Kategorie pokoje</th>
                ${SLOUPCE_OSOB.map(n => `
                  <th style="text-align: center; padding: 0 5px 10px 5px; font-size: 13px; font-weight: 700; color: #55554e; white-space: nowrap;">
                    ${n} ${skloňujOsoby(n)}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${KATEGORIE.map(k => `
                <tr>
                  <td style="padding: 5px 10px 5px 0; vertical-align: middle;">
                    <span style="display: block; font-size: 15.5px; font-weight: 800; color: #1c1c19;">${k.nazev}</span>
                    ${k.pozn ? `<span style="display: block; font-size: 12.5px; color: #96958a;">${k.pozn}</span>` : ''}
                  </td>
                  ${SLOUPCE_OSOB.map(n => `
                    <td style="padding: 5px 4px;">
                      <input type="number" inputmode="numeric" min="0" step="10" class="form-input cenik-cena-input"
                             data-kategorie="${k.klic}" data-osob="${n}"
                             value="${hodnotaKategorie(ad, sezona.id, k.klic, n)}"
                             placeholder="${zastupnaHodnota(k.klic, n)}"
                             aria-label="${k.nazev}, ${n} ${skloňujOsoby(n)}"
                             style="${S.inputCislo} min-width: 86px;">
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p style="margin: 12px 0 0 0; font-size: 13.5px; color: #96958a;">Všechna čísla jsou v korunách za osobu a noc, se snídaní.</p>
      </div>

      <div style="${S.blok} padding-top: 14px; padding-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
        <span style="flex: 1; min-width: 240px; font-size: 13.5px; color: #6b6b60; line-height: 1.6;">
          O víkendu (pátek, sobota, neděle) se k cenám automaticky připočítává příplatek:
          <strong style="color: #1c1c19;">standard a turistický +${vikendovyPriplatek('standard', ad.cenik)} Kč</strong>,
          <strong style="color: #1c1c19;">nadstandard +${vikendovyPriplatek('nadstandard', ad.cenik)} Kč</strong>
          za osobu a noc. Platí stejně pro všechna období.
        </span>
        <button type="button" data-cenik-krok="priplatky" data-cenik-cil="vikend_standard" style="${S.btnVedlejsi} flex-shrink: 0;">Změnit příplatek</button>
      </div>

      <div style="${S.blok} padding-top: 14px; padding-bottom: ${otevreno ? '18px' : '14px'};">
        <button type="button" class="btn-cenik-prepnout-vyjimky"
                style="width: 100%; background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left;">
          <span>
            <span style="display: block; font-size: 15.5px; font-weight: 800; color: #1c1c19;">
              Má některý pokoj stát jinak?
              ${vyjimky > 0 ? `<span style="background:#697947;color:#fff;border-radius:99px;padding:2px 9px;font-size:12.5px;font-weight:800;margin-left:7px;">${vyjimky}</span>` : ''}
            </span>
            <span style="display: block; font-size: 13.5px; color: #96958a; margin-top: 3px;">Nepovinné. Otevřete, jen když chcete jednomu pokoji dát jinou cenu než zbytku jeho kategorie.</span>
          </span>
          <span class="cenik-sipka" style="font-size: 19px; color: #7a7a70; flex-shrink: 0;">${otevreno ? '▴' : '▾'}</span>
        </button>

        <div class="cenik-vyjimky-obsah" style="display: ${otevreno ? 'block' : 'none'};">
          <p style="margin: 16px 0 12px 0; font-size: 13.5px; color: #6b6b60; line-height: 1.6;">
            Do políček se píše <strong>cena v korunách za osobu a noc</strong>, stejně jako v tabulce nahoře.
            Prázdné políčko znamená, že se pokoj řídí cenou své kategorie.
          </p>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; min-width: 520px;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 0 10px 8px 0; font-size: 13px; font-weight: 700; color: #55554e;">Pokoj</th>
                  ${SLOUPCE_OSOB.map(n => `
                    <th style="text-align: center; padding: 0 4px 8px 4px; font-size: 13px; font-weight: 700; color: #55554e; white-space: nowrap;">
                      ${n} ${skloňujOsoby(n)}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${MOCK_ROOMS.map(rm => `
                  <tr>
                    <td style="padding: 4px 10px 4px 0; font-size: 13.5px; font-weight: 700; color: #1c1c19; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapuj(rm.name)}">${escapuj(rm.name)}</td>
                    ${SLOUPCE_OSOB.map(n => `
                      <td style="padding: 4px 3px;">
                        <input type="number" inputmode="numeric" min="0" step="10" class="form-input cenik-vyjimka-input"
                               data-roomid="${rm.id}" data-osob="${n}"
                               value="${hodnotaPokoje(ad, sezona.id, rm.id, n)}"
                               placeholder="${cenaKategoriePokoje(rm.type, n)}"
                               aria-label="${escapuj(rm.name)}, cena za osobu a noc při ${n} ${skloňujOsoby(n)}"
                               style="${S.inputCislo} height: 40px; font-size: 14px; min-width: 74px;">
                      </td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    akce: `
      ${jeZakladni ? '' : `<button type="button" class="btn-cenik-smazat-sezonu" style="${S.btnVedlejsi} color: #c53030; border-color: #e8b4b4;">Smazat období</button>`}
      <button type="button" class="btn-cenik-ulozit-ceny" style="${S.btnHlavni}">Uložit</button>
    `,
  });
}

function obrazovkaPriplatky(ad) {
  const cenik = ad.cenik || {};
  const radky = (cenik.nastaveniRadky && cenik.nastaveniRadky.length > 0)
    ? [...cenik.nastaveniRadky].sort((a, b) => (a.poradi || 0) - (b.poradi || 0))
    : Object.entries(cenik.nastaveni || {}).map(([klic, hodnota]) => ({ klic, hodnota, popis: klic, jednotka: '' }));

  return obrazovka({
    titul: 'Příplatky a poplatky',
    napoveda: 'Tyto částky platí stejně pro všechna období — nezávisí na sezóně ani na počtu osob.',
    zpet: { krok: 'rozcestnik', popis: 'Zpět na výběr' },
    obsah: radky.length === 0 ? `
      <div style="${S.blok} color: #6b6b60; font-size: 15px;">Zatím tu nejsou žádné příplatky k nastavení.</div>
    ` : `
      <div style="${S.blok}">
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${radky.map(r => `
            <div class="cenik-radek-nastaveni" data-radek-klic="${escapuj(r.klic)}"
                 style="display: grid; grid-template-columns: minmax(0, 1fr) 130px minmax(0, 130px); gap: 14px; align-items: center; border-radius: 6px; transition: background-color 0.4s ease;">
              <label style="font-size: 15.5px; font-weight: 700; color: #1c1c19;" for="priplatek-${escapuj(r.klic)}">${escapuj(r.popis || r.klic)}</label>
              <input type="number" inputmode="numeric" min="0" id="priplatek-${escapuj(r.klic)}"
                     class="form-input cenik-nastaveni-input" data-klic="${escapuj(r.klic)}" value="${Number(r.hodnota) || 0}"
                     style="${S.inputCislo}">
              <span style="font-size: 13.5px; color: #6b6b60;">${escapuj(r.jednotka || '')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `,
    akce: radky.length === 0 ? '' : `
      <button type="button" class="btn-cenik-ulozit-nastaveni" style="${S.btnHlavni}">Uložit příplatky</button>
    `,
  });
}

function obrazovkaPokoje(ad) {
  return obrazovka({
    titul: 'Pokoje',
    napoveda: 'Název uvidí host na webu. Počet lůžek a přistýlek určuje, kolik osob si host u pokoje může vybrat — a tím i který sloupec ceníku se použije.',
    zpet: { krok: 'rozcestnik', popis: 'Zpět na výběr' },
    obsah: `
      <div style="background: #fff8e6; border: 1.5px solid #f0dca8; border-radius: 8px; padding: 14px 16px; font-size: 14px; color: #6b5a20; line-height: 1.6; margin-bottom: 16px;">
        <strong>Zkontrolujte u každého pokoje.</strong> Výchozí hodnoty jsou převzaté ze starých dat webu, kde měly všechny pokoje dvě lůžka.
      </div>

      <div style="${S.blok}">
        <div class="cenik-pokoj-hlavicka">
          <span>Název pokoje</span>
          <span style="text-align: right;">Lůžka</span>
          <span style="text-align: right;">Přistýlky</span>
          <span style="text-align: right;">Celkem</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${MOCK_ROOMS.map(rm => {
            const p = (ad.roomPrices || []).find(x => x.room_id === rm.id) || {};
            const luzka = p.zakladni_luzka != null ? p.zakladni_luzka : (rm.capacity || 2);
            const pristylky = p.max_pristylek != null ? p.max_pristylek : (rm.extraBeds || 0);
            return `
              <div class="cenik-pokoj-radek">
                <input type="text" class="form-input cenik-nazev-input" data-roomid="${rm.id}" value="${escapuj(rm.name)}"
                       aria-label="Název pokoje" style="${S.input} height: 42px; font-size: 14.5px; min-width: 0;">
                <label class="cenik-pole-luzka">
                  <span class="cenik-pole-popisek">Lůžka</span>
                  <input type="number" min="1" max="8" class="form-input cenik-luzka-input" data-roomid="${rm.id}" value="${luzka}"
                         aria-label="Stálá lůžka" style="${S.inputCislo} height: 42px; font-size: 15px;">
                </label>
                <label class="cenik-pole-pristylky">
                  <span class="cenik-pole-popisek">Přistýlky</span>
                  <input type="number" min="0" max="4" class="form-input cenik-pristylky-input" data-roomid="${rm.id}" value="${pristylky}"
                         aria-label="Přistýlky" style="${S.inputCislo} height: 42px; font-size: 15px;">
                </label>
                <span class="cenik-max-osob" data-roomid="${rm.id}">${Number(luzka) + Number(pristylky)} os.</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `,
    akce: `
      <button type="button" class="btn-cenik-ulozit-luzka" style="${S.btnHlavni}">Uložit pokoje</button>
    `,
  });
}

// ---------------------------------------------------------------------
//  ROZCESTNÍK VYKRESLENÍ
// ---------------------------------------------------------------------

export function renderCenikModal(ad) {
  const cenik = ad.cenik || { sezony: [], ceny: [], cenyPokoj: [], nastaveni: {} };

  // Okno se otevírá okamžitě, data dorazí až za chvíli. Bez tohohle by
  // se při první návštěvě (prázdná záloha v prohlížeči) na okamžik
  // ukázala hláška, že ceník vůbec není založený.
  if ((cenik.sezony || []).length === 0 && ad.cenikNacita) return oknoNacita() + dialogHtml(ad.cenikDialog);
  if ((cenik.sezony || []).length === 0) return oknoBezDat() + dialogHtml(ad.cenikDialog);

  return obrazovkaPodleKroku(ad) + dialogHtml(ad.cenikDialog);
}

function obrazovkaPodleKroku(ad) {
  switch (ad.cenikKrok) {
    case 'ceny-sezona': return obrazovkaCenySezona(ad);
    case 'ceny-tabulka': return obrazovkaCenyTabulka(ad);
    case 'priplatky': return obrazovkaPriplatky(ad);
    case 'pokoje': return obrazovkaPokoje(ad);
    default: return obrazovkaRozcestnik(ad);
  }
}

// ---------------------------------------------------------------------
//  OBSLUHA
// ---------------------------------------------------------------------

/** Uloží řádky do Supabase a zároveň do zálohy v prohlížeči. */
async function ulozDoTabulky(ad, tabulka, radky, konflikt) {
  if (radky.length === 0) return { ok: true };
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, zprava: 'Databáze není připojená, změna se uložila jen v tomto prohlížeči.' };
  }
  try {
    const { error } = await supabase.from(tabulka).upsert(radky, { onConflict: konflikt });
    if (error) return { ok: false, zprava: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, zprava: err && err.message };
  }
}

/**
 * Uloží pokoje do tabulky room_prices.
 *
 * Upsert tu použít nejde. Tabulka drží ještě sloupce ze starého cenového
 * modelu — base_price, weekday_price, weekend_price — a base_price je
 * NOT NULL bez výchozí hodnoty. PostgREST posílá upsert jako
 * INSERT ... ON CONFLICT, takže Postgres kontroluje povinné sloupce i u
 * řádku, který ve skutečnosti jen aktualizujeme, a zápis skončí chybou
 * 23502 (null value in column "base_price"). Ceník o starých cenách nic
 * neví a posílat je nemá proč.
 *
 * Proto se existující řádek mění přes update, který se povinných sloupců
 * vůbec nedotkne, a insert se použije jen pro pokoj, který v tabulce
 * ještě není — tam se staré sloupce dopíšou z MOCK_ROOMS.
 */
async function ulozPokoje(ad, radky) {
  if (radky.length === 0) return { ok: true };
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, zprava: 'Databáze není připojená, změna se uložila jen v tomto prohlížeči.' };
  }
  try {
    for (const r of radky) {
      const uzJeVTabulce = (ad.roomPrices || []).some(x => x.room_id === r.room_id);

      if (uzJeVTabulce) {
        const { error } = await supabase.from('room_prices').update(r).eq('room_id', r.room_id);
        if (error) return { ok: false, zprava: error.message };
        continue;
      }

      const rm = MOCK_ROOMS.find(x => x.id === r.room_id) || {};
      const zaklad = rm.basePrice != null ? rm.basePrice : 0;
      const { error } = await supabase.from('room_prices').insert([{
        ...r,
        base_price: zaklad,
        weekday_price: rm.weekdayPrice != null ? rm.weekdayPrice : zaklad,
        weekend_price: rm.weekendPrice != null ? rm.weekendPrice : zaklad,
      }]);
      if (error) return { ok: false, zprava: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, zprava: err && err.message };
  }
}

/** Po uložení znovu načte ceník, aby administrace i web viděly totéž. */
async function obnovCenik(ad) {
  const { fetchCenik } = await import('../lib/supabaseClient.js');
  ad.cenik = await fetchCenik();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cenik-zmenen', { detail: ad.cenik }));
  }
}

/**
 * Zamkne tlačítko po dobu ukládání.
 *
 * Bez toho stihne netrpělivý uživatel kliknout třikrát a odešle tři
 * zápisy za sebou — okno se mezitím překreslí a poslední odpověď přebije
 * tu předchozí.
 */
async function sTlacitkem(el, popisBehem, prace) {
  if (!el) return prace();
  const puvodni = el.textContent;
  el.disabled = true;
  el.style.opacity = '0.65';
  el.textContent = popisBehem;
  try {
    return await prace();
  } finally {
    el.disabled = false;
    el.style.opacity = '';
    el.textContent = puvodni;
  }
}

export function bindCenikModal(ad) {
  const c = ad.container;
  if (!c || !ad.showPricesModal) return;

  // --- hlídání neuložených změn ---
  //
  // Obsluha vyplní číslo, klikne "Zpět" a změna je pryč bez jediného
  // slova. Pro člověka, který si není jistý, jestli počítači rozumí, je
  // to nejhorší možná zpětná vazba — příště si netroufne vůbec.
  // Každá úprava políčka proto zvedne příznak a odchod se zeptá.
  ad.cenikZmeneno = false;
  const obsah = c.querySelector('.cenik-obsah');
  if (obsah) {
    obsah.addEventListener('input', () => { ad.cenikZmeneno = true; });
    obsah.addEventListener('change', () => { ad.cenikZmeneno = true; });
  }

  // --- doskočení na řádek, ze kterého se sem obsluha proklikla ---
  //
  // Cíl se krátce podbarví, jinak by nebylo poznat, na které z osmi
  // stejně vypadajících polí se má obsluha dívat. Vybarvení se po
  // chvíli samo vrátí, aby na obrazovce nezůstalo trvale.
  if (ad.cenikCil && obsah) {
    const cil = obsah.querySelector(`[data-radek-klic="${ad.cenikCil}"]`);
    ad.cenikCil = null;
    if (cil) {
      // Až po dokreslení — hned po vykreslení nemá okno spočítanou výšku
      // a scrollIntoView by neudělal nic. Schválně setTimeout a ne
      // requestAnimationFrame: ten se v záložce na pozadí vůbec nespustí.
      setTimeout(() => {
        // Skok, ne plynulé rolování — animace se v záložce na pozadí
        // zmrazí a obsluha by přistála nahoře, kde příplatek není vidět.
        cil.scrollIntoView({ block: 'center' });
        cil.style.backgroundColor = '#eef1e6';
        setTimeout(() => { cil.style.backgroundColor = ''; }, 2600);
        const pole = cil.querySelector('input');
        if (pole) pole.focus({ preventScroll: true });
      }, 0);
    }
  }

  // --- vlastní dialog ---
  const zavriDialog = (vysledek) => {
    const hotovo = ad.cenikDialogResolve;
    ad.cenikDialog = null;
    ad.cenikDialogResolve = null;
    ad.render();
    if (hotovo) hotovo(vysledek);
  };

  const dialog = c.querySelector('.cenik-dialog-overlay');
  if (dialog) {
    const vstup = dialog.querySelector('.cenik-dialog-vstup');
    if (vstup) {
      vstup.focus();
      vstup.select();
      vstup.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); zavriDialog(String(vstup.value).trim() || null); }
        if (e.key === 'Escape') { e.preventDefault(); zavriDialog(null); }
      });
    }
    dialog.querySelector('.cenik-dialog-zrusit').addEventListener('click', () => zavriDialog(vstup ? null : false));
    dialog.querySelector('.cenik-dialog-potvrdit').addEventListener('click', () => {
      zavriDialog(vstup ? (String(vstup.value).trim() || null) : true);
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) zavriDialog(vstup ? null : false);
    });
  }

  const smiOdejit = async () => {
    if (!ad.cenikZmeneno) return true;
    return zeptejSe(ad, {
      nadpis: 'Neuložené změny',
      popis: 'Máte rozepsané změny, které se ještě neuložily. Pokud teď odejdete, přijdete o ně.',
      potvrdText: 'Odejít bez uložení',
      nebezpecne: true,
    });
  };

  const zavriOkno = async () => {
    if (!(await smiOdejit())) return;
    ad.showPricesModal = false;
    ad.cenikKrok = 'rozcestnik';
    ad.cenikVyjimkyOtevrene = false;
    ad.cenikZmeneno = false;
    ad.render();
  };

  const zavri = c.querySelector('.btn-close-prices-modal');
  if (zavri) zavri.addEventListener('click', zavriOkno);

  const prekryv = c.querySelector('.admin-modal-overlay-prices');
  if (prekryv) {
    prekryv.addEventListener('click', (e) => {
      if (e.target === prekryv) zavriOkno();
    });
  }

  // --- přechody mezi obrazovkami ---
  // Karty i tlačítko zpět nesou data-cenik-krok, takže stačí jedna obsluha.
  c.querySelectorAll('[data-cenik-krok]').forEach(el => {
    el.addEventListener('click', () => {
      if (!smiOdejit()) return;
      const sezonaId = el.dataset.sezonaId;
      if (sezonaId) ad.cenikSezonaId = sezonaId;
      ad.cenikKrok = el.dataset.cenikKrok;
      // Odkaz může mířit na konkrétní řádek uvnitř další obrazovky —
      // bez toho by obsluha přistála nahoře a hledala, kam se dostala.
      ad.cenikCil = el.dataset.cenikCil || null;
      ad.cenikZmeneno = false;
      ad.render();
    });
  });

  // Zvýraznění karty pod myší — bez CSS souboru to jinak nejde.
  c.querySelectorAll('.cenik-karta').forEach(el => {
    el.addEventListener('mouseenter', () => {
      el.style.borderColor = '#697947';
      el.style.background = '#fbfbf8';
    });
    el.addEventListener('mouseleave', () => {
      el.style.borderColor = '#e0dfd5';
      el.style.background = '#fff';
    });
  });

  // --- přepínač „Opakuje se každý rok" ---
  // Jen ukáže/skryje výběr roku. Překreslovat kvůli tomu celé okno by
  // smazalo rozepsané ceny pod ním.
  const opakEl = c.querySelector('.cenik-sezona-opakuje');
  if (opakEl) {
    opakEl.addEventListener('change', () => {
      c.querySelectorAll('.cenik-rok').forEach(el => {
        el.style.display = opakEl.checked ? 'none' : 'block';
      });
    });
  }

  // --- rozbalení výjimek ---
  //
  // Přepíná se přímo v DOM, ne přes ad.render(). Překreslení celého okna
  // ho odrolovalo zpátky nahoru, takže uživatel po kliknutí nevěděl, kam
  // zmizel obsah, který právě otevřel.
  const prepniVyjimky = c.querySelector('.btn-cenik-prepnout-vyjimky');
  if (prepniVyjimky) {
    prepniVyjimky.addEventListener('click', () => {
      const obsah = c.querySelector('.cenik-vyjimky-obsah');
      // Šipka má vlastní třídu schválně. Selektor 'span:last-child'
      // tu dřív trefil popisek pod nadpisem — je taky posledním
      // potomkem svého rodiče a v pořadí dokumentu je dřív — a přepsal
      // jeho text šipkou, takže popisek po prvním kliknutí zmizel.
      const sipka = prepniVyjimky.querySelector('.cenik-sipka');
      if (!obsah) return;
      const otevrit = obsah.style.display === 'none';
      obsah.style.display = otevrit ? 'block' : 'none';
      if (sipka) sipka.textContent = otevrit ? '▴' : '▾';
      ad.cenikVyjimkyOtevrene = otevrit;
      if (otevrit) obsah.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  // --- nové období ---
  const nova = c.querySelector('.btn-cenik-nova-sezona');
  if (nova) {
    nova.addEventListener('click', async () => {
      const nazev = await zeptejSe(ad, {
        nadpis: 'Nové období',
        popis: 'Jak se má nové období jmenovat? Termín a ceny mu nastavíte hned na další obrazovce.',
        prompt: true,
        placeholder: 'například Vánoce nebo Jarní prázdniny',
        potvrdText: 'Založit období',
      });
      if (!nazev || !String(nazev).trim()) return;

      const radek = {
        nazev: nazev.trim(),
        datum_od: '01-01',
        datum_do: '01-07',
        opakuje_se: true,
        je_zakladni: false,
        vikendovy_priplatek: 0,
        priorita: 20,
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('cenik_sezony').insert([radek]).select();
        if (error) {
          ad.showAdminToast(`⚠️ Období se nepodařilo založit: ${error.message}`);
          return;
        }
        if (data && data[0]) ad.cenikSezonaId = data[0].id;
      }

      await obnovCenik(ad);
      // Rovnou do detailu — jinak by uživatel musel hledat, kde se nastaví termín.
      ad.cenikKrok = 'ceny-tabulka';
      ad.showAdminToast(`Období „${radek.nazev}“ založeno. Nastavte mu termín a ceny.`);
      ad.render();
    });
  }

  /**
   * Posbírá z obrazovky nastavení období.
   *
   * Vrací null a upozorní obsluhu, když chybí název — volající pak
   * nesmí uložit ani ceny, ať se změny nerozejdou napůl.
   */
  const sestavObdobi = (sezona) => {
    const radek = {
      id: sezona.id,
      // Víkendový příplatek se přesunul do Příplatků (podle kategorie pokoje),
      // starý sloupec u sezóny se jen zachovává, aby ho uložení nevynulovalo.
      vikendovy_priplatek: Math.max(0, Number(sezona.vikendovy_priplatek) || 0),
      updated_at: new Date().toISOString(),
    };

    if (sezona.je_zakladni) return radek;

    const nazevEl = c.querySelector('.cenik-sezona-nazev');
    const opakEl = c.querySelector('.cenik-sezona-opakuje');
    const prioEl = c.querySelector('.cenik-sezona-priorita');

    const nazev = nazevEl ? String(nazevEl.value).trim() : '';
    if (!nazev) {
      ad.showAdminToast('⚠️ Období musí mít název.');
      return null;
    }

    const opakuje = opakEl ? opakEl.checked : true;
    const cti = (predpona) => {
      const den = c.querySelector(`.cenik-${predpona}-den`);
      const mesic = c.querySelector(`.cenik-${predpona}-mesic`);
      const rok = c.querySelector(`.cenik-${predpona}-rok`);
      return slozDatum(den && den.value, mesic && mesic.value, opakuje ? null : (rok && rok.value));
    };

    radek.nazev = nazev;
    radek.datum_od = cti('sezona-od');
    radek.datum_do = cti('sezona-do');
    radek.opakuje_se = opakuje;

    // Pole priority se ukazuje jen při překryvu období. Když na
    // obrazovce není, musí se poslat dosavadní hodnota — jinak by
    // uložení názvu potichu srazilo prioritu na nulu.
    radek.priorita = prioEl
      ? (Number(prioEl.value) || 0)
      : (Number(sezona.priorita) || 0);

    return radek;
  };

  // --- smazání období ---
  const smazSezonu = c.querySelector('.btn-cenik-smazat-sezonu');
  if (smazSezonu) {
    smazSezonu.addEventListener('click', async () => {
      const sezona = aktivniSezona(ad);
      if (!sezona || sezona.je_zakladni) return;
      const potvrzeno = await zeptejSe(ad, {
        nadpis: 'Smazat období',
        popis: `Opravdu smazat období <strong>${escapuj(sezona.nazev)}</strong> i se všemi jeho cenami? Tohle už nejde vrátit zpět. Základní ceník ani ostatní období se nezmění.`,
        potvrdText: 'Smazat období',
        nebezpecne: true,
      });
      if (!potvrzeno) return;

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('cenik_sezony').delete().eq('id', sezona.id);
        if (error) {
          ad.showAdminToast(`⚠️ Smazání selhalo: ${error.message}`);
          return;
        }
      }
      ad.cenikSezonaId = null;
      await obnovCenik(ad);
      ad.cenikKrok = 'ceny-sezona';
      ad.showAdminToast('Období smazáno.');
      ad.render();
    });
  }

  // --- uložení celé obrazovky období ---
  // Jedno tlačítko ukládá termín období, tabulku kategorií i výjimky pro
  // pokoje. Všechno je na téže obrazovce, takže víc tlačítek by znamenalo
  // jen možnost uložit půlku a o druhou přijít.
  const ulozCeny = c.querySelector('.btn-cenik-ulozit-ceny');
  if (ulozCeny) {
    ulozCeny.addEventListener('click', () => sTlacitkem(ulozCeny, 'Ukládám…', async () => {
      const sezona = aktivniSezona(ad);
      if (!sezona) return;
      const kdy = new Date().toISOString();

      const obdobi = sestavObdobi(sezona);
      if (!obdobi) return;

      const ceny = [];
      c.querySelectorAll('.cenik-cena-input').forEach(inp => {
        const cista = String(inp.value).trim();
        ceny.push({
          sezona_id: sezona.id,
          kategorie: inp.dataset.kategorie,
          pocet_osob: Number(inp.dataset.osob),
          cena_za_osobu_noc: cista === '' ? null : Math.max(0, Number(cista) || 0),
          updated_at: kdy,
        });
      });

      const vyjimky = [];
      c.querySelectorAll('.cenik-vyjimka-input').forEach(inp => {
        const cista = String(inp.value).trim();
        vyjimky.push({
          sezona_id: sezona.id,
          room_id: inp.dataset.roomid,
          pocet_osob: Number(inp.dataset.osob),
          cena_za_osobu_noc: cista === '' ? null : Math.max(0, Number(cista) || 0),
          updated_at: kdy,
        });
      });

      const v0 = await ulozDoTabulky(ad, 'cenik_sezony', [obdobi], 'id');
      const v1 = await ulozDoTabulky(ad, 'cenik_ceny', ceny, 'sezona_id,kategorie,pocet_osob');
      const v2 = vyjimky.length > 0
        ? await ulozDoTabulky(ad, 'cenik_ceny_pokoj', vyjimky, 'sezona_id,room_id,pocet_osob')
        : { ok: true };

      await obnovCenik(ad);
      const chyba = !v0.ok ? v0.zprava : (!v1.ok ? v1.zprava : (!v2.ok ? v2.zprava : null));
      ad.showAdminToast(chyba ? `⚠️ ${chyba}` : `Období „${obdobi.nazev || sezona.nazev}“ uloženo.`);
      ad.render();
    }));
  }

  // --- uložení příplatků ---
  const ulozNastaveni = c.querySelector('.btn-cenik-ulozit-nastaveni');
  if (ulozNastaveni) {
    ulozNastaveni.addEventListener('click', () => sTlacitkem(ulozNastaveni, 'Ukládám…', async () => {
      const radky = [];
      c.querySelectorAll('.cenik-nastaveni-input').forEach(inp => {
        radky.push({
          klic: inp.dataset.klic,
          hodnota: Math.max(0, Number(inp.value) || 0),
          updated_at: new Date().toISOString(),
        });
      });

      const v = await ulozDoTabulky(ad, 'cenik_nastaveni', radky, 'klic');
      await obnovCenik(ad);
      ad.showAdminToast(v.ok ? 'Příplatky uloženy.' : `⚠️ ${v.zprava}`);
      ad.render();
    }));
  }

  // --- pokoje: živý přepočet maxima ---
  const prepocitejMax = (roomId) => {
    const l = c.querySelector(`.cenik-luzka-input[data-roomid="${roomId}"]`);
    const p = c.querySelector(`.cenik-pristylky-input[data-roomid="${roomId}"]`);
    const cil = c.querySelector(`.cenik-max-osob[data-roomid="${roomId}"]`);
    if (!l || !p || !cil) return;
    const celkem = Math.max(1, (Number(l.value) || 0) + (Number(p.value) || 0));
    cil.textContent = `${celkem} os.`;
  };
  c.querySelectorAll('.cenik-luzka-input, .cenik-pristylky-input').forEach(inp => {
    inp.addEventListener('input', () => prepocitejMax(inp.dataset.roomid));
  });

  // --- uložení pokojů ---
  const ulozLuzka = c.querySelector('.btn-cenik-ulozit-luzka');
  if (ulozLuzka) {
    ulozLuzka.addEventListener('click', () => sTlacitkem(ulozLuzka, 'Ukládám…', async () => {
      const radky = [];
      c.querySelectorAll('.cenik-luzka-input').forEach(inp => {
        const roomId = inp.dataset.roomid;
        const pristylkyEl = c.querySelector(`.cenik-pristylky-input[data-roomid="${roomId}"]`);
        const nazevEl = c.querySelector(`.cenik-nazev-input[data-roomid="${roomId}"]`);
        const rm = MOCK_ROOMS.find(r => r.id === roomId);
        const nazev = nazevEl ? String(nazevEl.value).trim() : '';
        radky.push({
          room_id: roomId,
          room_name: nazev || (rm ? rm.name : ''),
          zakladni_luzka: Math.max(1, Number(inp.value) || 1),
          max_pristylek: Math.max(0, Number(pristylkyEl && pristylkyEl.value) || 0),
          updated_at: new Date().toISOString(),
        });
      });

      const v = await ulozPokoje(ad, radky);

      // Promítni i do paměti, ať se zkouška i rezervace chovají hned správně
      radky.forEach(r => {
        const idx = (ad.roomPrices || []).findIndex(x => x.room_id === r.room_id);
        if (idx >= 0) ad.roomPrices[idx] = { ...ad.roomPrices[idx], ...r };
        else ad.roomPrices.push(r);
        const rm = MOCK_ROOMS.find(x => x.id === r.room_id);
        if (rm) {
          rm.zakladniLuzka = r.zakladni_luzka;
          rm.maxPristylek = r.max_pristylek;
          if (r.room_name) rm.name = r.room_name;
        }
        if (r.room_name) {
          saveStoredCustomRoomName({ room_id: r.room_id, room_name: r.room_name, name: r.room_name });
        }
      });
      saveStoredCenik({ ...(ad.cenik || {}) });

      // Promítni nové názvy i do stránek webu, které jsou právě otevřené
      if (typeof window !== 'undefined' && typeof window.syncCustomRoomNamesToDOM === 'function') {
        window.syncCustomRoomNamesToDOM();
      }

      ad.showAdminToast(v.ok ? 'Pokoje uloženy.' : `⚠️ ${v.zprava}`);
      ad.render();
    }));
  }

}
