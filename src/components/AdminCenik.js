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
 * Okno má pět částí, seřazených tak, jak o cenách přemýšlí recepce:
 *   1. Sezóna    — které období právě upravuju
 *   2. Ceny      — tabulka kategorie × počet osob
 *   3. Výjimky   — jednotlivý pokoj jinak než zbytek kategorie
 *   4. Příplatky — polopenze, pes, kolo, parkování, záloha
 *   5. Náhled    — kolik to reálně vyjde
 */

import { MOCK_ROOMS, isSupabaseConfigured, supabase, saveStoredCenik, saveStoredCustomRoomName } from '../lib/supabaseClient.js';
import { calculateReservationPrice, formatCzechPrice } from '../utils/pricing.js';
import { MAX_OSOB_V_CENIKU, maxOsobNaPokoji, najdiSezonu } from '../utils/cenik.js';

const KATEGORIE = [
  { klic: 'standard', nazev: 'Standard' },
  { klic: 'nadstandard', nazev: 'Nadstandard (Mahagon, Motýl, Zen)' },
  { klic: 'turisticky', nazev: 'Turistický' },
];

const SLOUPCE_OSOB = Array.from({ length: MAX_OSOB_V_CENIKU }, (_, i) => i + 1);

const MESICE = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

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

function escapuj(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Vybraná sezóna, s návratem k základní. */
function aktivniSezona(ad) {
  const sezony = (ad.cenik && ad.cenik.sezony) || [];
  if (sezony.length === 0) return null;
  return sezony.find(s => s.id === ad.cenikSezonaId)
      || sezony.find(s => s.je_zakladni)
      || sezony[0];
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

// ---------------------------------------------------------------------
//  VYKRESLENÍ
// ---------------------------------------------------------------------

export function renderCenikModal(ad) {
  const cenik = ad.cenik || { sezony: [], ceny: [], cenyPokoj: [], nastaveni: {} };
  const sezony = cenik.sezony || [];
  const sezona = aktivniSezona(ad);

  if (sezony.length === 0) {
    return oknoBezDat();
  }

  const jeZakladni = Boolean(sezona && sezona.je_zakladni);

  return `
    <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-prices">
      <div class="admin-confirm-modal admin-block-modal cenik-modal" style="max-width: 780px; padding: 0 24px 24px 24px;">
        <div class="admin-modal-header-sticky">
          <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">💰 Ceník</h3>
          <button type="button" class="btn-close-prices-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
        </div>

        <p class="admin-modal-desc" style="margin: 14px 0 16px 0; font-size: 13.5px; color: #55554e; line-height: 1.55;">
          Cena je vždy <strong>za osobu a noc</strong> a s počtem lidí na pokoji klesá.
          Systém u každé noci sám pozná, do které sezóny spadá a jestli je víkend.
        </p>

        ${sekceSezony(ad, sezony, sezona, jeZakladni)}
        ${sekceCeny(ad, sezona, jeZakladni)}
        ${sekceVyjimky(ad, sezona)}
        ${sekcePriplatky(ad, cenik)}
        ${sekceLuzka(ad)}
        ${sekceNahled(ad)}
      </div>
    </div>
  `;
}

function oknoBezDat() {
  return `
    <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-prices">
      <div class="admin-confirm-modal admin-block-modal" style="max-width: 560px; padding: 0 24px 24px 24px;">
        <div class="admin-modal-header-sticky">
          <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">💰 Ceník</h3>
          <button type="button" class="btn-close-prices-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
        </div>
        <div style="margin-top: 18px; background: #fff8e6; border: 1px solid #f0dca8; border-radius: 8px; padding: 16px 18px; font-size: 13.5px; color: #6b5a20; line-height: 1.6;">
          <strong>Ceník ještě není v databázi založený.</strong><br><br>
          Otevři v Supabase <strong>SQL Editor</strong>, vlož obsah souboru
          <strong>supabase-cenik.sql</strong> z projektu a spusť ho.
          Založí tabulky a rovnou je naplní cenami podle stávajícího ceníku hotelu.<br><br>
          Než to proběhne, rezervace počítá podle výchozích cen
          (standard 890 / 740 / 720 / 700 Kč za osobu a noc), takže web funguje dál.
        </div>
      </div>
    </div>
  `;
}

function sekceSezony(ad, sezony, sezona, jeZakladni) {
  const serazene = [...sezony].sort((a, b) => {
    if (a.je_zakladni !== b.je_zakladni) return a.je_zakladni ? -1 : 1;
    return String(a.nazev).localeCompare(String(b.nazev), 'cs');
  });

  return `
    <div class="cenik-blok" style="background: #f7f6f1; border: 1px solid #e0dfd5; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
        <strong style="font-size: 13.5px; color: #1c1c19;">1 · Kterou sezónu upravuji</strong>
        <button type="button" class="btn btn-specs-secondary btn-cenik-nova-sezona" style="height: 32px; padding: 0 12px; font-size: 12.5px; font-weight: 700; border-radius: 1px;">+ Přidat sezónu</button>
      </div>

      <select class="form-input cenik-vyber-sezony" style="width: 100%; height: 40px; font-size: 14px; font-weight: 700; padding: 0 10px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box; background: #fff;">
        ${serazene.map(s => `
          <option value="${s.id}" ${sezona && s.id === sezona.id ? 'selected' : ''}>
            ${escapuj(s.nazev)}${s.je_zakladni ? ' — platí celý rok' : ` (${popisDatumu(s.datum_od, s.opakuje_se)} – ${popisDatumu(s.datum_do, s.opakuje_se)})`}
          </option>
        `).join('')}
      </select>

      ${!sezona ? '' : `
        <div style="display: grid; grid-template-columns: ${jeZakladni ? '1fr' : '1fr 1fr'}; gap: 10px; margin-top: 12px;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #55554e; margin-bottom: 4px;">Název sezóny</label>
            <input type="text" class="form-input cenik-sezona-nazev" value="${escapuj(sezona.nazev)}" ${jeZakladni ? 'disabled' : ''}
                   style="width: 100%; height: 36px; font-size: 13.5px; padding: 0 9px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box; ${jeZakladni ? 'background:#eee;color:#888;' : ''}">
          </div>
          ${jeZakladni ? '' : `
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #55554e; margin-bottom: 4px;">Přednost před jinými sezónami</label>
              <input type="number" class="form-input cenik-sezona-priorita" value="${Number(sezona.priorita) || 0}"
                     style="width: 100%; height: 36px; font-size: 13.5px; padding: 0 9px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
            </div>
          `}
        </div>

        ${jeZakladni ? '' : `
          <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; margin-top: 10px;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #55554e; margin-bottom: 4px;">Od</label>
              <input type="${sezona.opakuje_se === false ? 'date' : 'text'}" class="form-input cenik-sezona-od" value="${escapuj(sezona.datum_od || '')}"
                     placeholder="MM-DD, např. 11-01"
                     style="width: 100%; height: 36px; font-size: 13.5px; padding: 0 9px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #55554e; margin-bottom: 4px;">Do (včetně)</label>
              <input type="${sezona.opakuje_se === false ? 'date' : 'text'}" class="form-input cenik-sezona-do" value="${escapuj(sezona.datum_do || '')}"
                     placeholder="MM-DD, např. 04-15"
                     style="width: 100%; height: 36px; font-size: 13.5px; padding: 0 9px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
            </div>
            <label style="display: flex; align-items: center; gap: 6px; height: 36px; font-size: 12.5px; font-weight: 600; color: #1c1c19; white-space: nowrap;">
              <input type="checkbox" class="cenik-sezona-opakuje" ${sezona.opakuje_se !== false ? 'checked' : ''}>
              Každý rok
            </label>
          </div>
          <p style="margin: 8px 0 0 0; font-size: 11.5px; color: #7a7a70; line-height: 1.5;">
            Když je zaškrtnuté „Každý rok“, píše se jen měsíc a den (<strong>11-01</strong>).
            Rozsah smí přecházet přes Nový rok. Bez zaškrtnutí zadej celé datum včetně roku.
          </p>
        `}

        <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #d8d7cc;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #4a5a24; margin-bottom: 4px;">🏔️ Víkendový příplatek (pátek, sobota, neděle)</label>
            <div style="display: flex; align-items: center; gap: 6px;">
              <input type="number" class="form-input cenik-vikend-priplatek" value="${Number(sezona.vikendovy_priplatek) || 0}"
                     style="width: 110px; height: 36px; font-size: 13.5px; font-weight: 700; text-align: right; padding-right: 8px; border-radius: 4px; border: 1px solid #ccc;">
              <span style="font-size: 12.5px; font-weight: 600; color: #777;">Kč / osoba / noc</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            ${jeZakladni ? '' : `
              <button type="button" class="btn btn-specs-secondary btn-cenik-smazat-sezonu" style="height: 36px; padding: 0 14px; font-size: 12.5px; font-weight: 700; border-radius: 1px; color: #c53030; border-color: #e8b4b4;">Smazat sezónu</button>
            `}
            <button type="button" class="btn btn-specs-secondary btn-cenik-ulozit-sezonu" style="height: 36px; padding: 0 16px; font-size: 12.5px; font-weight: 700; border-radius: 1px;">Uložit sezónu</button>
          </div>
        </div>
      `}
    </div>
  `;
}

function sekceCeny(ad, sezona, jeZakladni) {
  if (!sezona) return '';

  return `
    <div class="cenik-blok" style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px;">
      <strong style="display: block; font-size: 13.5px; color: #1c1c19; margin-bottom: 4px;">2 · Ceny za osobu a noc</strong>
      <p style="margin: 0 0 12px 0; font-size: 12px; color: #7a7a70; line-height: 1.5;">
        ${jeZakladni
          ? 'Základní ceník platí všude, kam nezasahuje jiná sezóna.'
          : 'Prázdné políčko znamená <strong>použij základní ceník</strong>. Vyplň jen to, co se v této sezóně liší.'}
      </p>

      <div style="overflow-x: auto;">
        <table class="cenik-tabulka" style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 460px;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 6px 8px; font-size: 11.5px; font-weight: 700; color: #55554e; border-bottom: 1px solid #e0dfd5;">Kategorie</th>
              ${SLOUPCE_OSOB.map(n => `
                <th style="text-align: center; padding: 6px 8px; font-size: 11.5px; font-weight: 700; color: #55554e; border-bottom: 1px solid #e0dfd5; white-space: nowrap;">
                  ${n} ${n === 1 ? 'osoba' : n < 5 ? 'osoby' : 'osob'}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${KATEGORIE.map(k => `
              <tr>
                <td style="padding: 6px 8px; font-weight: 700; color: #1c1c19; border-bottom: 1px solid #f0efe8;">${k.nazev}</td>
                ${SLOUPCE_OSOB.map(n => `
                  <td style="padding: 5px 4px; border-bottom: 1px solid #f0efe8;">
                    <input type="number" class="form-input cenik-cena-input"
                           data-kategorie="${k.klic}" data-osob="${n}"
                           value="${hodnotaKategorie(ad, sezona.id, k.klic, n)}"
                           placeholder="${jeZakladni ? '—' : 'dědí'}"
                           style="width: 100%; min-width: 74px; height: 34px; font-size: 13px; font-weight: 700; text-align: right; padding-right: 7px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
        <button type="button" class="btn btn-specs-secondary btn-cenik-ulozit-ceny" style="height: 36px; padding: 0 18px; font-size: 13px; font-weight: 700; border-radius: 1px;">Uložit ceny</button>
      </div>
    </div>
  `;
}

function sekceVyjimky(ad, sezona) {
  if (!sezona) return '';
  const pocet = pocetVyjimek(ad, sezona.id);
  const otevreno = Boolean(ad.cenikVyjimkyOtevrene);

  return `
    <div class="cenik-blok" style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px;">
      <button type="button" class="btn-cenik-prepnout-vyjimky" style="width: 100%; background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left;">
        <strong style="font-size: 13.5px; color: #1c1c19;">
          3 · Výjimky pro jednotlivé pokoje
          ${pocet > 0 ? `<span style="background:#e67e22;color:#fff;border-radius:99px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:6px;">${pocet}</span>` : ''}
        </strong>
        <span style="font-size: 15px; color: #7a7a70;">${otevreno ? '▴' : '▾'}</span>
      </button>

      ${!otevreno ? `
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #7a7a70; line-height: 1.5;">
          Nepovinné. Použij, když má jeden pokoj stát jinak než zbytek své kategorie.
        </p>
      ` : `
        <p style="margin: 10px 0 12px 0; font-size: 12px; color: #7a7a70; line-height: 1.5;">
          Prázdné políčko = pokoj se řídí cenou své kategorie. Vyplněné číslo ji přebije.
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 4px;">
          ${MOCK_ROOMS.map(rm => `
            <div style="display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(${MAX_OSOB_V_CENIKU}, minmax(0, 1fr)); gap: 6px; align-items: center;">
              <div style="font-size: 12px; font-weight: 700; color: #1c1c19; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapuj(rm.name)}">${escapuj(rm.name)}</div>
              ${SLOUPCE_OSOB.map(n => `
                <input type="number" class="form-input cenik-vyjimka-input"
                       data-roomid="${rm.id}" data-osob="${n}"
                       value="${hodnotaPokoje(ad, sezona.id, rm.id, n)}"
                       placeholder="${n} os."
                       style="width: 100%; min-width: 0; height: 32px; font-size: 12.5px; font-weight: 700; text-align: right; padding-right: 6px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
              `).join('')}
            </div>
          `).join('')}
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
          <button type="button" class="btn btn-specs-secondary btn-cenik-ulozit-vyjimky" style="height: 36px; padding: 0 18px; font-size: 13px; font-weight: 700; border-radius: 1px;">Uložit výjimky</button>
        </div>
      `}
    </div>
  `;
}

function sekcePriplatky(ad, cenik) {
  const radky = (cenik.nastaveniRadky && cenik.nastaveniRadky.length > 0)
    ? [...cenik.nastaveniRadky].sort((a, b) => (a.poradi || 0) - (b.poradi || 0))
    : Object.entries(cenik.nastaveni || {}).map(([klic, hodnota]) => ({ klic, hodnota, popis: klic, jednotka: '' }));

  if (radky.length === 0) return '';

  return `
    <div class="cenik-blok" style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px;">
      <strong style="display: block; font-size: 13.5px; color: #1c1c19; margin-bottom: 4px;">4 · Příplatky a poplatky</strong>
      <p style="margin: 0 0 12px 0; font-size: 12px; color: #7a7a70; line-height: 1.5;">
        Platí pro všechny sezóny stejně.
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${radky.map(r => `
          <div style="display: grid; grid-template-columns: minmax(0, 1fr) 96px minmax(0, 116px); gap: 10px; align-items: center;">
            <span style="font-size: 12.5px; font-weight: 600; color: #1c1c19;">${escapuj(r.popis || r.klic)}</span>
            <input type="number" class="form-input cenik-nastaveni-input" data-klic="${escapuj(r.klic)}" value="${Number(r.hodnota) || 0}"
                   style="width: 100%; height: 34px; font-size: 13px; font-weight: 700; text-align: right; padding-right: 7px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
            <span style="font-size: 11.5px; color: #7a7a70;">${escapuj(r.jednotka || '')}</span>
          </div>
        `).join('')}
      </div>
      <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
        <button type="button" class="btn btn-specs-secondary btn-cenik-ulozit-nastaveni" style="height: 36px; padding: 0 18px; font-size: 13px; font-weight: 700; border-radius: 1px;">Uložit příplatky</button>
      </div>
    </div>
  `;
}

function sekceLuzka(ad) {
  const otevreno = Boolean(ad.cenikLuzkaOtevrena);

  return `
    <div class="cenik-blok" style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px;">
      <button type="button" class="btn-cenik-prepnout-luzka" style="width: 100%; background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left;">
        <strong style="font-size: 13.5px; color: #1c1c19;">5 · Pokoje — název, lůžka a přistýlky</strong>
        <span style="font-size: 15px; color: #7a7a70;">${otevreno ? '▴' : '▾'}</span>
      </button>

      ${!otevreno ? `
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #7a7a70; line-height: 1.5;">
          Název pokoje, jak ho uvidí host, a kolik osob jde u pokoje v rezervaci vybrat —
          tím se určí i který sloupec ceníku se použije.
        </p>
      ` : `
        <div style="margin: 10px 0 12px 0; background: #fff8e6; border: 1px solid #f0dca8; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #6b5a20; line-height: 1.55;">
          <strong>Zkontroluj u každého pokoje.</strong> Výchozí hodnoty jsou převzaté ze starých dat webu,
          kde měly všechny pokoje dvě lůžka. Host neuvidí víc osob, než kolik je tady nastaveno.
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 4px;">
          ${MOCK_ROOMS.map(rm => {
            const p = (ad.roomPrices || []).find(x => x.room_id === rm.id) || {};
            const luzka = p.zakladni_luzka != null ? p.zakladni_luzka : (rm.capacity || 2);
            const pristylky = p.max_pristylek != null ? p.max_pristylek : (rm.extraBeds || 0);
            return `
              <div style="display: grid; grid-template-columns: minmax(0, 1.5fr) 82px 82px auto; gap: 8px; align-items: center;">
                <input type="text" class="form-input cenik-nazev-input" data-roomid="${rm.id}" value="${escapuj(rm.name)}"
                       title="Název pokoje, jak ho uvidí host"
                       style="width: 100%; min-width: 0; height: 32px; font-size: 12px; font-weight: 700; padding: 0 7px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
                <input type="number" min="1" max="8" class="form-input cenik-luzka-input" data-roomid="${rm.id}" value="${luzka}"
                       title="Stálá lůžka"
                       style="width: 100%; height: 32px; font-size: 12.5px; font-weight: 700; text-align: right; padding-right: 6px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
                <input type="number" min="0" max="4" class="form-input cenik-pristylky-input" data-roomid="${rm.id}" value="${pristylky}"
                       title="Přistýlky navíc"
                       style="width: 100%; height: 32px; font-size: 12.5px; font-weight: 700; text-align: right; padding-right: 6px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
                <span class="cenik-max-osob" data-roomid="${rm.id}" style="font-size: 11.5px; font-weight: 700; color: #4a5a24; white-space: nowrap;">= ${Number(luzka) + Number(pristylky)} os.</span>
              </div>
            `;
          }).join('')}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px;">
          <span style="font-size: 11px; color: #7a7a70;">Sloupce: název · stálá lůžka · přistýlky.</span>
          <button type="button" class="btn btn-specs-secondary btn-cenik-ulozit-luzka" style="height: 36px; padding: 0 18px; font-size: 13px; font-weight: 700; border-radius: 1px;">Uložit pokoje</button>
        </div>
      `}
    </div>
  `;
}

function sekceNahled(ad) {
  const n = ad.cenikNahled || {};
  const dnes = new Date().toISOString().split('T')[0];

  return `
    <div class="cenik-blok" style="background: #f2f5ec; border: 1px solid #d3ddc2; border-radius: 8px; padding: 14px 16px;">
      <strong style="display: block; font-size: 13.5px; color: #1c1c19; margin-bottom: 4px;">6 · Zkouška — kolik to vyjde</strong>
      <p style="margin: 0 0 12px 0; font-size: 12px; color: #55603f; line-height: 1.5;">
        Spočítá se ze stejného ceníku, jaký uvidí host. Nic se tím neukládá.
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 8px;">
        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #55554e; margin-bottom: 4px;">Příjezd</label>
          <input type="date" class="form-input cenik-nahled-od" value="${escapuj(n.od || dnes)}"
                 style="width: 100%; height: 34px; font-size: 12.5px; padding: 0 7px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #55554e; margin-bottom: 4px;">Počet nocí</label>
          <input type="number" min="1" max="30" class="form-input cenik-nahled-noci" value="${Number(n.noci) || 2}"
                 style="width: 100%; height: 34px; font-size: 12.5px; font-weight: 700; text-align: right; padding-right: 7px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #55554e; margin-bottom: 4px;">Pokoj</label>
          <select class="form-input cenik-nahled-pokoj" style="width: 100%; height: 34px; font-size: 12.5px; padding: 0 6px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box; background: #fff;">
            ${MOCK_ROOMS.map(rm => `<option value="${rm.id}" ${n.roomId === rm.id ? 'selected' : ''}>${escapuj(rm.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #55554e; margin-bottom: 4px;">Osob</label>
          <input type="number" min="1" max="8" class="form-input cenik-nahled-osob" value="${Number(n.osob) || 2}"
                 style="width: 100%; height: 34px; font-size: 12.5px; font-weight: 700; text-align: right; padding-right: 7px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
        </div>
      </div>

      <div class="cenik-nahled-vysledek" style="margin-top: 12px;">
        ${vykresliVysledekNahledu(ad)}
      </div>
    </div>
  `;
}

/** Spočítá a vypíše zkušební cenu. Volá se i po každé změně vstupu. */
export function vykresliVysledekNahledu(ad) {
  const n = ad.cenikNahled || {};
  const dnes = new Date().toISOString().split('T')[0];
  const od = n.od || dnes;
  const noci = Math.max(1, Number(n.noci) || 2);
  const roomId = n.roomId || (MOCK_ROOMS[0] && MOCK_ROOMS[0].id);
  const pokoj = MOCK_ROOMS.find(r => r.id === roomId) || MOCK_ROOMS[0];
  if (!pokoj) return '';

  const cenoveUdaje = (ad.roomPrices || []).find(x => x.room_id === pokoj.id) || {};
  const maxOsob = maxOsobNaPokoji({
    zakladni_luzka: cenoveUdaje.zakladni_luzka != null ? cenoveUdaje.zakladni_luzka : pokoj.capacity,
    max_pristylek: cenoveUdaje.max_pristylek != null ? cenoveUdaje.max_pristylek : pokoj.extraBeds,
  });
  const osob = Math.max(1, Number(n.osob) || 2);
  const prekrocenaKapacita = osob > maxOsob;

  const [r, m, d] = od.split('-').map(Number);
  const doDt = new Date(Date.UTC(r, m - 1, d));
  doDt.setUTCDate(doDt.getUTCDate() + noci);
  const doStr = doDt.toISOString().split('T')[0];

  const cenik = ad.cenik || {};
  const p = calculateReservationPrice({
    roomType: pokoj.type,
    roomId: pokoj.id,
    nights: noci,
    persons: osob,
    dateFrom: od,
    dateTo: doStr,
    cenik,
    nastaveni: cenik.nastaveni,
  });

  const sezona = najdiSezonu(od, cenik.sezony || []);

  return `
    ${prekrocenaKapacita ? `
      <div style="background: #fdecea; border: 1px solid #f5c2bd; border-radius: 6px; padding: 8px 11px; font-size: 12px; color: #a33; margin-bottom: 8px;">
        Tenhle pokoj má podle nastavení místo jen pro ${maxOsob} ${maxOsob === 1 ? 'osobu' : maxOsob < 5 ? 'osoby' : 'osob'} — host by víc nevybral.
      </div>
    ` : ''}
    <div style="background: #ffffff; border: 1px solid #d3ddc2; border-radius: 6px; padding: 12px 14px;">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
        <span style="font-size: 12.5px; color: #55554e;">Ubytování</span>
        <strong style="font-size: 19px; font-weight: 800; color: #1c1c19;">${formatCzechPrice(p.accommodationPrice)}</strong>
      </div>
      <div style="margin-top: 6px; font-size: 11.5px; color: #7a7a70; line-height: 1.6;">
        ${escapuj(p.nightBreakdownLabel)}<br>
        Sezóna: <strong>${escapuj(sezona ? sezona.nazev : 'Základní ceník')}</strong>
        ${p.singleNightSurchargeTotal > 0 ? `<br>Příplatek za pobyt na 1 noc: <strong>+${formatCzechPrice(p.singleNightSurchargeTotal)}</strong>` : ''}
      </div>
      <div style="margin-top: 10px; padding-top: 9px; border-top: 1px dashed #e0dfd5; display: flex; align-items: baseline; justify-content: space-between; gap: 10px;">
        <span style="font-size: 12px; color: #55554e;">Záloha ${p.depositPercentage} %</span>
        <strong style="font-size: 13.5px; color: #4a5a24;">${formatCzechPrice(p.depositPriceTotal)}</strong>
      </div>
    </div>
  `;
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

/** Po uložení znovu načte ceník, aby administrace i web viděly totéž. */
async function obnovCenik(ad) {
  const { fetchCenik } = await import('../lib/supabaseClient.js');
  ad.cenik = await fetchCenik();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cenik-zmenen', { detail: ad.cenik }));
  }
}

export function bindCenikModal(ad) {
  const c = ad.container;
  if (!c || !ad.showPricesModal) return;

  const zavri = c.querySelector('.btn-close-prices-modal');
  if (zavri) {
    zavri.addEventListener('click', () => {
      ad.showPricesModal = false;
      ad.render();
    });
  }

  const prekryv = c.querySelector('.admin-modal-overlay-prices');
  if (prekryv) {
    prekryv.addEventListener('click', (e) => {
      if (e.target === prekryv) {
        ad.showPricesModal = false;
        ad.render();
      }
    });
  }

  // --- výběr sezóny ---
  const vyber = c.querySelector('.cenik-vyber-sezony');
  if (vyber) {
    vyber.addEventListener('change', (e) => {
      ad.cenikSezonaId = e.target.value;
      ad.render();
    });
  }

  // --- rozbalovací části ---
  const prepniVyjimky = c.querySelector('.btn-cenik-prepnout-vyjimky');
  if (prepniVyjimky) {
    prepniVyjimky.addEventListener('click', () => {
      ad.cenikVyjimkyOtevrene = !ad.cenikVyjimkyOtevrene;
      ad.render();
    });
  }

  const prepniLuzka = c.querySelector('.btn-cenik-prepnout-luzka');
  if (prepniLuzka) {
    prepniLuzka.addEventListener('click', () => {
      ad.cenikLuzkaOtevrena = !ad.cenikLuzkaOtevrena;
      ad.render();
    });
  }

  // --- nová sezóna ---
  const nova = c.querySelector('.btn-cenik-nova-sezona');
  if (nova) {
    nova.addEventListener('click', async () => {
      const nazev = window.prompt('Název nové sezóny (např. Vánoce, Jarní prázdniny):', '');
      if (!nazev || !nazev.trim()) return;

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
          ad.showAdminToast(`⚠️ Sezónu se nepodařilo založit: ${error.message}`);
          return;
        }
        if (data && data[0]) ad.cenikSezonaId = data[0].id;
      }

      await obnovCenik(ad);
      ad.showAdminToast(`Sezóna „${radek.nazev}“ založena. Nastav jí datum a ceny.`);
      ad.render();
    });
  }

  // --- uložení sezóny ---
  const ulozSezonu = c.querySelector('.btn-cenik-ulozit-sezonu');
  if (ulozSezonu) {
    ulozSezonu.addEventListener('click', async () => {
      const sezona = aktivniSezona(ad);
      if (!sezona) return;

      const nazevEl = c.querySelector('.cenik-sezona-nazev');
      const odEl = c.querySelector('.cenik-sezona-od');
      const doEl = c.querySelector('.cenik-sezona-do');
      const opakEl = c.querySelector('.cenik-sezona-opakuje');
      const prioEl = c.querySelector('.cenik-sezona-priorita');
      const vikendEl = c.querySelector('.cenik-vikend-priplatek');

      const radek = {
        id: sezona.id,
        vikendovy_priplatek: Math.max(0, Number(vikendEl && vikendEl.value) || 0),
        updated_at: new Date().toISOString(),
      };

      if (!sezona.je_zakladni) {
        const nazev = nazevEl ? String(nazevEl.value).trim() : '';
        if (!nazev) {
          ad.showAdminToast('⚠️ Sezóna musí mít název.');
          return;
        }
        const opakuje = opakEl ? opakEl.checked : true;
        const od = odEl ? String(odEl.value).trim() : '';
        const doKdy = doEl ? String(doEl.value).trim() : '';

        const vzor = opakuje ? /^\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
        if (!vzor.test(od) || !vzor.test(doKdy)) {
          ad.showAdminToast(opakuje
            ? '⚠️ U opakující se sezóny piš datum ve tvaru MM-DD, například 11-01.'
            : '⚠️ U jednorázové sezóny piš celé datum ve tvaru RRRR-MM-DD.');
          return;
        }

        radek.nazev = nazev;
        radek.datum_od = od;
        radek.datum_do = doKdy;
        radek.opakuje_se = opakuje;
        radek.priorita = Number(prioEl && prioEl.value) || 0;
      }

      const v = await ulozDoTabulky(ad, 'cenik_sezony', [radek], 'id');
      await obnovCenik(ad);
      ad.showAdminToast(v.ok ? 'Sezóna uložena.' : `⚠️ ${v.zprava}`);
      ad.render();
    });
  }

  // --- smazání sezóny ---
  const smazSezonu = c.querySelector('.btn-cenik-smazat-sezonu');
  if (smazSezonu) {
    smazSezonu.addEventListener('click', async () => {
      const sezona = aktivniSezona(ad);
      if (!sezona || sezona.je_zakladni) return;
      if (!window.confirm(`Opravdu smazat sezónu „${sezona.nazev}“ i s jejími cenami?`)) return;

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('cenik_sezony').delete().eq('id', sezona.id);
        if (error) {
          ad.showAdminToast(`⚠️ Smazání selhalo: ${error.message}`);
          return;
        }
      }
      ad.cenikSezonaId = null;
      await obnovCenik(ad);
      ad.showAdminToast('Sezóna smazána.');
      ad.render();
    });
  }

  // --- uložení cen kategorií ---
  const ulozCeny = c.querySelector('.btn-cenik-ulozit-ceny');
  if (ulozCeny) {
    ulozCeny.addEventListener('click', async () => {
      const sezona = aktivniSezona(ad);
      if (!sezona) return;

      const radky = [];
      c.querySelectorAll('.cenik-cena-input').forEach(inp => {
        const cistá = String(inp.value).trim();
        radky.push({
          sezona_id: sezona.id,
          kategorie: inp.dataset.kategorie,
          pocet_osob: Number(inp.dataset.osob),
          cena_za_osobu_noc: cistá === '' ? null : Math.max(0, Number(cistá) || 0),
          updated_at: new Date().toISOString(),
        });
      });

      const v = await ulozDoTabulky(ad, 'cenik_ceny', radky, 'sezona_id,kategorie,pocet_osob');
      await obnovCenik(ad);
      ad.showAdminToast(v.ok ? 'Ceny uloženy.' : `⚠️ ${v.zprava}`);
      ad.render();
    });
  }

  // --- uložení výjimek pro pokoje ---
  const ulozVyjimky = c.querySelector('.btn-cenik-ulozit-vyjimky');
  if (ulozVyjimky) {
    ulozVyjimky.addEventListener('click', async () => {
      const sezona = aktivniSezona(ad);
      if (!sezona) return;

      const radky = [];
      c.querySelectorAll('.cenik-vyjimka-input').forEach(inp => {
        const cistá = String(inp.value).trim();
        radky.push({
          sezona_id: sezona.id,
          room_id: inp.dataset.roomid,
          pocet_osob: Number(inp.dataset.osob),
          cena_za_osobu_noc: cistá === '' ? null : Math.max(0, Number(cistá) || 0),
          updated_at: new Date().toISOString(),
        });
      });

      const v = await ulozDoTabulky(ad, 'cenik_ceny_pokoj', radky, 'sezona_id,room_id,pocet_osob');
      await obnovCenik(ad);
      ad.showAdminToast(v.ok ? 'Výjimky uloženy.' : `⚠️ ${v.zprava}`);
      ad.render();
    });
  }

  // --- uložení příplatků ---
  const ulozNastaveni = c.querySelector('.btn-cenik-ulozit-nastaveni');
  if (ulozNastaveni) {
    ulozNastaveni.addEventListener('click', async () => {
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
    });
  }

  // --- lůžka: živý přepočet maxima ---
  const prepocitejMax = (roomId) => {
    const l = c.querySelector(`.cenik-luzka-input[data-roomid="${roomId}"]`);
    const p = c.querySelector(`.cenik-pristylky-input[data-roomid="${roomId}"]`);
    const cil = c.querySelector(`.cenik-max-osob[data-roomid="${roomId}"]`);
    if (!l || !p || !cil) return;
    const celkem = Math.max(1, (Number(l.value) || 0) + (Number(p.value) || 0));
    cil.textContent = `= ${celkem} os.`;
  };
  c.querySelectorAll('.cenik-luzka-input, .cenik-pristylky-input').forEach(inp => {
    inp.addEventListener('input', () => prepocitejMax(inp.dataset.roomid));
  });

  // --- uložení lůžek ---
  const ulozLuzka = c.querySelector('.btn-cenik-ulozit-luzka');
  if (ulozLuzka) {
    ulozLuzka.addEventListener('click', async () => {
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

      const v = await ulozDoTabulky(ad, 'room_prices', radky, 'room_id');

      // Promítni i do paměti, ať se náhled i rezervace chovají hned správně
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
    });
  }

  // --- náhled: přepočet bez překreslení celého okna ---
  const prepocitejNahled = () => {
    const od = c.querySelector('.cenik-nahled-od');
    const noci = c.querySelector('.cenik-nahled-noci');
    const pokoj = c.querySelector('.cenik-nahled-pokoj');
    const osob = c.querySelector('.cenik-nahled-osob');
    ad.cenikNahled = {
      od: od ? od.value : '',
      noci: noci ? noci.value : 2,
      roomId: pokoj ? pokoj.value : null,
      osob: osob ? osob.value : 2,
    };
    const cil = c.querySelector('.cenik-nahled-vysledek');
    if (cil) cil.innerHTML = vykresliVysledekNahledu(ad);
  };

  ['.cenik-nahled-od', '.cenik-nahled-noci', '.cenik-nahled-pokoj', '.cenik-nahled-osob'].forEach(sel => {
    const el = c.querySelector(sel);
    if (el) {
      el.addEventListener('input', prepocitejNahled);
      el.addEventListener('change', prepocitejNahled);
    }
  });
}
