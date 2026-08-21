// ---------------------------------------------------------------------
//  OKNO EXPORTU KONTAKTŮ A REZERVACÍ
//
//  Obsluha si vybere období, řekne, jestli chce adresář hostů nebo
//  soupis rezervací, a stáhne si tabulku. Veškerá matematika je
//  v src/utils/exportKontaktu.js, tady je jen ovládání a stažení.
//
//  Okno se otevírá OKAMŽITĚ a počty se dopočítají z dat, která už
//  administrace má — nečeká se na databázi.
// ---------------------------------------------------------------------

import {
  OBDOBI, PODLE_DATA, odectiDny, vyberRezervace, slucKontakty, pripravExport,
} from '../utils/exportKontaktu.js';

const escapuj = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Dnešek jako YYYY-MM-DD v místním čase (ne UTC — o půlnoci by to lhalo). */
function dnesStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Výchozí nastavení okna. */
export function prazdnyExport() {
  return {
    obdobi: 'rok',        // nejčastější případ: „komu jsme letos ubytovali"
    od: '',
    doo: '',
    podleData: 'vytvoreni',
    druh: 'kontakty',     // na newsletter, kvůli kterému to celé vzniklo
    zahrnoutArchiv: true, // archiv je jen odklizený pobyt, kontakt platí dál
    zahrnoutStorna: false,
  };
}

/**
 * Z voleb okna udělá konkrétní rozsah dat.
 *
 * Vrací prázdné řetězce pro „celou historii", protože vyberRezervace
 * bere prázdnou mez jako „bez omezení".
 */
export function rozsahZVoleb(v, dnes = dnesStr()) {
  if (v.obdobi === 'vse') return { od: '', doo: '' };
  if (v.obdobi === 'vlastni') return { od: v.od || '', doo: v.doo || '' };
  const polozka = OBDOBI.find(o => o.id === v.obdobi);
  const dnu = polozka && polozka.dnu ? polozka.dnu : 1;
  // „Posledních 7 dní" znamená včetně dneška, proto dnu - 1.
  return { od: odectiDny(dnes, dnu - 1), doo: dnes };
}

/** Volby ve tvaru, kterému rozumí vyberRezervace a pripravExport. */
function volbyProExport(v) {
  const { od, doo } = rozsahZVoleb(v);
  return {
    od, doo,
    podleData: v.podleData,
    zahrnoutArchiv: v.zahrnoutArchiv,
    zahrnoutStorna: v.zahrnoutStorna,
    druh: v.druh,
  };
}

const S = {
  blok: 'background: #fff; border: 1.5px solid #e0dfd5; border-radius: 8px; padding: 16px 18px; margin-bottom: 14px;',
  nadpis: 'display: block; font-size: 14px; font-weight: 800; color: #1c1c19; margin-bottom: 12px;',
  popisek: 'display: block; font-size: 12.5px; font-weight: 700; color: #55554e; margin-bottom: 5px;',
  datum: 'width: 100%; height: 42px; font-size: 14.5px; padding: 0 11px; border-radius: 5px; border: 1.5px solid #c9c8bd; box-sizing: border-box; background: #fff; color: #1c1c19;',
};

export function renderExportModal(ad) {
  if (!ad.showExportModal) return '';
  const v = ad.exportVolby || prazdnyExport();
  const volby = volbyProExport(v);

  const vybrane = vyberRezervace(ad.reservations || [], volby);
  const kontaktu = slucKontakty(vybrane).length;
  const bezMailu = vybrane.filter(r => !String(r.guest_email || '').trim()).length;
  const { od, doo } = rozsahZVoleb(v);

  return `
    <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-export">
      <div class="admin-confirm-modal admin-block-modal" style="max-width: 640px; padding: 0 24px 24px 24px;">
        <div class="admin-modal-header-sticky">
          <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">📥 Export kontaktů a rezervací</h3>
          <button type="button" class="btn-close-export" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
        </div>

        <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
          Stáhne tabulku ve formátu CSV, který otevře Excel i Tabulky Google. Hodí se na rozesílání novinek nebo na přehled o tom, kdo u nás byl.
        </p>

        <div style="${S.blok}">
          <strong style="${S.nadpis}">Co stáhnout</strong>
          <div class="export-prepinac">
            <button type="button" class="export-volba ${v.druh === 'kontakty' ? 'je-vybrana' : ''}" data-druh="kontakty">
              <span class="export-volba-nazev">Adresář hostů</span>
              <span class="export-volba-popis">Jeden řádek na hosta. Opakované pobyty sečtené dohromady — na hromadnou poštu.</span>
            </button>
            <button type="button" class="export-volba ${v.druh === 'rezervace' ? 'je-vybrana' : ''}" data-druh="rezervace">
              <span class="export-volba-nazev">Soupis rezervací</span>
              <span class="export-volba-popis">Jeden řádek na rezervaci, včetně termínu, pokoje a částek.</span>
            </button>
          </div>
        </div>

        <div style="${S.blok}">
          <strong style="${S.nadpis}">Za jaké období</strong>
          <div class="export-obdobi">
            ${OBDOBI.map(o => `
              <button type="button" class="export-chip ${v.obdobi === o.id ? 'je-vybrany' : ''}" data-obdobi="${o.id}">${escapuj(o.popis)}</button>
            `).join('')}
          </div>

          ${v.obdobi === 'vlastni' ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px;" class="export-vlastni">
              <div>
                <label style="${S.popisek}">Od</label>
                <input type="date" class="export-pole" data-pole="od" value="${escapuj(v.od)}" style="${S.datum}">
              </div>
              <div>
                <label style="${S.popisek}">Do (včetně)</label>
                <input type="date" class="export-pole" data-pole="doo" value="${escapuj(v.doo)}" style="${S.datum}">
              </div>
            </div>
          ` : ''}

          <div style="margin-top: 14px;">
            <label style="${S.popisek}">Období se počítá podle</label>
            <div class="export-obdobi">
              ${Object.entries(PODLE_DATA).map(([id, p]) => `
                <button type="button" class="export-chip ${v.podleData === id ? 'je-vybrany' : ''}" data-podle="${id}">${escapuj(p.popis)}</button>
              `).join('')}
            </div>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b6b60; line-height: 1.45;">
              ${v.podleData === 'vytvoreni'
                ? 'Kdo si u nás v tomto období objednal — bez ohledu na to, kdy přijel.'
                : 'Kdo u nás v tomto období bydlel — bez ohledu na to, kdy si objednal.'}
            </p>
          </div>
        </div>

        <div style="${S.blok}">
          <strong style="${S.nadpis}">Co do výběru zahrnout</strong>
          <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: #1c1c19; cursor: pointer; margin-bottom: 10px;">
            <input type="checkbox" class="export-pole" data-pole="zahrnoutArchiv" ${v.zahrnoutArchiv ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #697947;">
            I rezervace z archivu
          </label>
          <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: #1c1c19; cursor: pointer;">
            <input type="checkbox" class="export-pole" data-pole="zahrnoutStorna" ${v.zahrnoutStorna ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #697947;">
            I stornované rezervace
          </label>
        </div>

        <div class="export-souhrn">
          <div class="export-souhrn-cislo">${v.druh === 'kontakty' ? kontaktu : vybrane.length}</div>
          <div class="export-souhrn-text">
            <strong>${v.druh === 'kontakty'
              ? (kontaktu === 1 ? 'kontakt' : (kontaktu < 5 ? 'kontakty' : 'kontaktů'))
              : (vybrane.length === 1 ? 'rezervace' : (vybrane.length < 5 ? 'rezervace' : 'rezervací'))} ve výběru</strong>
            <span>${od || doo ? `${escapuj(od || 'od začátku')} – ${escapuj(doo || 'dodnes')}` : 'celá historie'}${
              v.druh === 'kontakty' && vybrane.length !== kontaktu ? ` · z ${vybrane.length} rezervací` : ''}</span>
            ${bezMailu > 0 && v.druh === 'kontakty'
              ? `<span class="export-souhrn-pozn">${bezMailu} ${bezMailu === 1 ? 'rezervace nemá' : 'rezervací nemá'} e-mail — takoví hosté jsou v souboru s prázdným sloupcem.</span>`
              : ''}
          </div>
        </div>

        <p class="export-pravni">
          Soubor obsahuje osobní údaje hostů. Ukládejte ho jen tam, kam vidí hotel, a nesdílejte ho dál.
          Na obchodní sdělení vlastním zákazníkům máte právo, ale v každé zprávě musí být možnost odhlásit se z dalších.
        </p>

        <div class="admin-modal-actions export-akce">
          <button type="button" class="btn-modal-cancel btn-close-export">Zavřít</button>
          <button type="button" class="btn-modal-confirm btn-stahnout-export" ${(v.druh === 'kontakty' ? kontaktu : vybrane.length) === 0 ? 'disabled' : ''}>
            Stáhnout tabulku (CSV)
          </button>
        </div>
      </div>
    </div>
  `;
}

export function bindExportModal(ad) {
  if (!ad.showExportModal) return;

  const zavri = () => { ad.showExportModal = false; ad.render(); };
  ad.container.querySelectorAll('.btn-close-export').forEach(b => b.addEventListener('click', zavri));

  const prekryti = ad.container.querySelector('.admin-modal-overlay-export');
  if (prekryti) prekryti.addEventListener('click', (e) => { if (e.target === prekryti) zavri(); });

  ad.container.querySelectorAll('.export-volba').forEach(b => {
    b.addEventListener('click', () => { ad.exportVolby.druh = b.dataset.druh; ad.render(); });
  });

  ad.container.querySelectorAll('.export-chip[data-obdobi]').forEach(b => {
    b.addEventListener('click', () => {
      ad.exportVolby.obdobi = b.dataset.obdobi;
      // Vlastní rozsah se předvyplní posledním měsícem, ať obsluha
      // nekouká na dvě prázdná políčka a nemusí hádat, co se čeká.
      if (b.dataset.obdobi === 'vlastni' && !ad.exportVolby.od && !ad.exportVolby.doo) {
        const { od, doo } = rozsahZVoleb({ ...ad.exportVolby, obdobi: 'mesic' });
        ad.exportVolby.od = od;
        ad.exportVolby.doo = doo;
      }
      ad.render();
    });
  });

  ad.container.querySelectorAll('.export-chip[data-podle]').forEach(b => {
    b.addEventListener('click', () => { ad.exportVolby.podleData = b.dataset.podle; ad.render(); });
  });

  ad.container.querySelectorAll('.export-pole').forEach(el => {
    el.addEventListener('change', () => {
      ad.exportVolby[el.dataset.pole] = el.type === 'checkbox' ? el.checked : el.value;
      ad.render();
    });
  });

  const btn = ad.container.querySelector('.btn-stahnout-export');
  if (btn) {
    btn.addEventListener('click', () => {
      const { obsah, nazev, radku } = pripravExport(ad.reservations || [], volbyProExport(ad.exportVolby));
      if (radku === 0) return;
      stahniSoubor(obsah, nazev);
      ad.showAdminToast(`📥 Staženo ${radku} ${radku === 1 ? 'řádek' : (radku < 5 ? 'řádky' : 'řádků')} do souboru ${nazev}.`);
    });
  }
}

/**
 * Nabídne soubor ke stažení.
 *
 * Odkaz se musí na chvíli vložit do stránky — Safari na klepnutí do
 * odkazu, který v dokumentu není, nereaguje. Objektová adresa se uvolní
 * až po chvíli, protože stažení se z ní teprve rozbíhá.
 */
function stahniSoubor(obsah, nazev) {
  const blob = new Blob([obsah], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nazev;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
}
