// ---------------------------------------------------------------------
//  POTVRZOVACÍ OKNO ADMINISTRACE
//
//  Náhrada za window.confirm(). Nativní dialog vypadá jako hlášení
//  prohlížeče, ne jako součást webu — obsluha nepozná, jestli mluví
//  hotel, nebo Chrome, a na mobilu ho systém navíc umí přebít vlastním
//  „Zabránit této stránce v otevírání dalších dialogů".
//
//  Okno se schválně věší přímo na <body>, ne do administrace: ta se
//  celá překresluje přes innerHTML, takže by dialog uprostřed čekání
//  na odpověď zmizel i s posluchači a slib by se nikdy nevyřídil.
// ---------------------------------------------------------------------

const escapuj = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Zeptá se obsluhy a počká na odpověď.
 *
 * @param {object} volby
 * @param {string} volby.nadpis     krátká otázka do titulku
 * @param {string} volby.text       vysvětlení; odstavce se oddělují \n\n
 * @param {string} [volby.potvrdit] popisek potvrzovacího tlačítka
 * @param {string} [volby.zrusit]   popisek zrušení
 * @param {boolean} [volby.nebezpecne] červené tlačítko místo zeleného
 * @returns {Promise<boolean>} true = obsluha potvrdila
 */
export function adminPotvrzeni({ nadpis, text, potvrdit = 'Pokračovat', zrusit = 'Zrušit', nebezpecne = false }) {
  return new Promise((odpovez) => {
    const prekryti = document.createElement('div');
    prekryti.className = 'admin-modal-overlay admin-potvrzeni-overlay';
    // Nad všemi okny administrace — ptá se vždycky na něco, co se v nich děje.
    prekryti.style.zIndex = '10200';

    const odstavce = String(text || '').split('\n\n')
      .map(o => `<p class="admin-potvrzeni-text">${escapuj(o).replace(/\n/g, '<br>')}</p>`)
      .join('');

    prekryti.innerHTML = `
      <div class="admin-confirm-modal admin-potvrzeni-okno" role="alertdialog" aria-modal="true">
        <h3 class="admin-modal-title admin-potvrzeni-nadpis">${escapuj(nadpis)}</h3>
        ${odstavce}
        <div class="admin-modal-actions admin-potvrzeni-tlacitka">
          <button type="button" class="btn-modal-cancel admin-potvrzeni-ne">${escapuj(zrusit)}</button>
          <button type="button" class="${nebezpecne ? 'btn-modal-danger' : 'btn-modal-confirm'} admin-potvrzeni-ano">${escapuj(potvrdit)}</button>
        </div>
      </div>
    `;

    let hotovo = false;
    const zavri = (vysledek) => {
      if (hotovo) return;
      hotovo = true;
      document.removeEventListener('keydown', naKlavesu, true);
      prekryti.remove();
      odpovez(vysledek);
    };

    // Escape zavírá, Enter potvrzuje — obsluha z nativního dialogu tohle zná.
    const naKlavesu = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); zavri(false); }
      if (e.key === 'Enter') { e.preventDefault(); zavri(true); }
    };

    prekryti.querySelector('.admin-potvrzeni-ne').addEventListener('click', () => zavri(false));
    prekryti.querySelector('.admin-potvrzeni-ano').addEventListener('click', () => zavri(true));
    prekryti.addEventListener('click', (e) => { if (e.target === prekryti) zavri(false); });
    document.addEventListener('keydown', naKlavesu, true);

    document.body.appendChild(prekryti);
    // Ostření až po vložení, jinak prohlížeč nemá co zaostřit.
    prekryti.querySelector('.admin-potvrzeni-ano').focus();
  });
}
