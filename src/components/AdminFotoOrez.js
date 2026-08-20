/**
 * Ořez fotky aktuality na pevný poměr — přetažením nebo výběrem souboru.
 *
 * Proč vlastní soubor: v AdminDashboard.js na tohle bylo přes tři sta
 * řádků kreslení do canvasu se zoomem, které se navíc při každém
 * překreslení administrace navazovalo znovu. Tady je editor obyčejné
 * DOM, canvas se použije až na jediné místo, kde je opravdu potřeba —
 * na výrobu výsledného souboru.
 *
 * Celý smysl je JEDNA záruka: ať uživatel nahraje cokoli, ven vyleze
 * obrázek přesně CIL_SIRKA × CIL_VYSKA. Karty aktualit pak nikde
 * neposkakují. Vynucuje se to při vykreslování do canvasu (viz
 * `vyrobBlob`), ne v ovládání — na to by se spolehnout nedalo.
 */

/** Jediné místo, kde je určený výstupní formát. Změna tady mění všechno. */
export const CIL_SIRKA = 1280;
export const CIL_VYSKA = 720;
const POMER = CIL_SIRKA / CIL_VYSKA;

/**
 * Nejmenší povolený výřez, v pixelech ORIGINÁLU.
 *
 * Výstup je vždycky 1280 px široký, takže z menšího výřezu by vznikla
 * rozmazanina. U malé předlohy se minimum srazí na její šířku — jinak by
 * u fotky užší než minimum nešlo hýbat rámečkem vůbec.
 */
const MIN_VYREZ = 320;

const POVOLENE_TYPY = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BAJTU = 5 * 1024 * 1024;

/** Prázdný stav editoru. */
export function prazdnyOrez() {
  return {
    src: null,          // adresa vybrané fotky (objektová, viz zpracujSoubor)
    objektURL: null,    // tatáž adresa; drží se zvlášť kvůli uvolnění
    prirozene: null,    // { w, h } skutečné rozlišení souboru
    vyrez: null,        // { x, y, w, h } — VŽDY v pixelech originálu
    nahrava: false,
    chyba: ''
  };
}

const omez = (h, min, max) => Math.min(max, Math.max(min, h));

/**
 * Největší obdélník cílového poměru, který se do fotky vejde, vycentrovaný.
 * Používá se při otevření a pod tlačítkem „Celá fotka".
 */
export function vychoziVyrez(sirka, vyska) {
  let w = sirka;
  let h = sirka / POMER;
  if (h > vyska) {
    h = vyska;
    w = vyska * POMER;
  }
  return { x: (sirka - w) / 2, y: (vyska - h) / 2, w, h };
}

/**
 * Načte vybraný soubor a otevře editor.
 *
 * Bere jen první obrázek — aktualita má jednu fotku, a kdyby se jich
 * zpracovávalo víc za sebou, uživatel by ořezával fotky, ze kterých se
 * stejně uloží poslední.
 */
export function zpracujSoubor(ad, soubor) {
  if (!soubor) return;

  if (!POVOLENE_TYPY.includes(soubor.type)) {
    ad.showAdminToast('⚠️ Fotka musí být JPEG, PNG nebo WebP.');
    return;
  }
  // Limit hlídá i koš v Supabase (5 MB). Kdyby se čekalo až na jeho
  // odpověď, uživatel by zbytečně prošel celým ořezem a teprve pak
  // by se dozvěděl, že je fotka velká.
  if (soubor.size > MAX_BAJTU) {
    ad.showAdminToast('⚠️ Fotka je větší než 5 MB. Zmenšete ji prosím a zkuste to znovu.');
    return;
  }

  // Objektová adresa, ne data URL. Čtyřmegabajtová fotka se jako base64
  // rozroste na 5,4 MB textu, který se navíc při KAŽDÉM překreslení
  // administrace znovu vkládá do innerHTML a znovu dekóduje — na tom
  // stálo ono „hrozně dlouho se to nahrávalo". Objektová adresa je jen
  // odkaz do paměti, vytvoří se okamžitě a nic se nekopíruje.
  if (ad.orez && ad.orez.objektURL) URL.revokeObjectURL(ad.orez.objektURL);
  ad.orez = prazdnyOrez();
  ad.orez.objektURL = URL.createObjectURL(soubor);
  ad.orez.src = ad.orez.objektURL;
  ad.showCropModal = true;
  ad.render();
}

// ---------------------------------------------------------------- vykreslení

export function renderOrezModal(ad) {
  const o = ad.orez;
  if (!ad.showCropModal || !o || !o.src) return '';

  return `
    <div class="admin-modal-overlay orez-overlay" style="z-index: 10050;">
      <div class="orez-okno">
        <div class="orez-hlavicka">
          <h3 class="admin-modal-title orez-nadpis">Ořez fotografie (16:9)</h3>
          <button type="button" class="orez-zavrit btn-orez-zrusit" aria-label="Zavřít">&times;</button>
        </div>

        <p class="orez-napoveda">
          Táhněte za rámeček nebo za body na jeho okraji. Uloží se přesně to, co je uvnitř — vždy ve stejné velikosti ${CIL_SIRKA} × ${CIL_VYSKA} px.
        </p>

        <div class="orez-plocha" id="orez-plocha">
          <img id="orez-obrazek" src="${o.src}" alt="" draggable="false">
          <div class="orez-stin" data-stin="nahore"></div>
          <div class="orez-stin" data-stin="dole"></div>
          <div class="orez-stin" data-stin="vlevo"></div>
          <div class="orez-stin" data-stin="vpravo"></div>
          <div class="orez-ramecek" id="orez-ramecek" data-uchyt="posun">
            <span class="orez-uchyt orez-uchyt-nw" data-uchyt="nw"></span>
            <span class="orez-uchyt orez-uchyt-ne" data-uchyt="ne"></span>
            <span class="orez-uchyt orez-uchyt-sw" data-uchyt="sw"></span>
            <span class="orez-uchyt orez-uchyt-se" data-uchyt="se"></span>
            <span class="orez-uchyt orez-uchyt-n" data-uchyt="n"></span>
            <span class="orez-uchyt orez-uchyt-s" data-uchyt="s"></span>
            <span class="orez-uchyt orez-uchyt-w" data-uchyt="w"></span>
            <span class="orez-uchyt orez-uchyt-e" data-uchyt="e"></span>
          </div>
        </div>

        <div class="orez-patka">
          <button type="button" class="orez-btn-jemny" id="btn-orez-cela">Celá fotka</button>
          <div class="orez-patka-vpravo">
            <button type="button" class="orez-btn-jemny btn-orez-zrusit">Zrušit</button>
            <button type="button" class="orez-btn-hlavni btn-orez-potvrdit">Oříznout a nahrát</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------ ovládání

/**
 * Naváže ovládání editoru.
 *
 * Během tažení se NEPŘEKRESLUJE administrace — mění se rovnou styly
 * rámečku. Překreslení by při každém pohybu myši zahodilo prvek, na
 * kterém tažení začalo, a výběr by se roztrhal.
 */
export function bindOrezModal(ad) {
  const korenNahrani = ad.container.querySelector('#orez-vstup-oblast');
  const vstupSouboru = ad.container.querySelector('#news-photo-file-input');

  if (vstupSouboru && !vstupSouboru.dataset.navazano) {
    vstupSouboru.dataset.navazano = '1';
    vstupSouboru.addEventListener('change', (e) => {
      zpracujSoubor(ad, e.target.files && e.target.files[0]);
      // Bez vynulování by se tentýž soubor podruhé nevybral — prohlížeč
      // by neposlal událost change, protože hodnota se nezměnila.
      e.target.value = '';
    });
  }

  if (korenNahrani && !korenNahrani.dataset.navazano) {
    korenNahrani.dataset.navazano = '1';
    korenNahrani.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-news-photo')) return;
      if (vstupSouboru) vstupSouboru.click();
    });
    ['dragenter', 'dragover'].forEach(u => korenNahrani.addEventListener(u, (e) => {
      e.preventDefault();
      korenNahrani.classList.add('je-nad');
    }));
    ['dragleave', 'drop'].forEach(u => korenNahrani.addEventListener(u, (e) => {
      e.preventDefault();
      if (u === 'dragleave' && korenNahrani.contains(e.relatedTarget)) return;
      korenNahrani.classList.remove('je-nad');
    }));
    korenNahrani.addEventListener('drop', (e) => {
      const soubory = e.dataTransfer && e.dataTransfer.files;
      if (soubory && soubory.length) zpracujSoubor(ad, soubory[0]);
    });
  }

  const plocha = ad.container.querySelector('#orez-plocha');
  const obrazek = ad.container.querySelector('#orez-obrazek');
  const ramecek = ad.container.querySelector('#orez-ramecek');
  if (!plocha || !obrazek || !ramecek || !ad.orez) return;

  const o = ad.orez;

  /** Poměr mezi zobrazenými a skutečnými pixely. Počítá se pokaždé znovu. */
  const merítko = () => (o.prirozene ? obrazek.clientWidth / o.prirozene.w : 1);

  function prekresliRamecek() {
    if (!o.vyrez) return;
    const m = merítko();
    const l = o.vyrez.x * m;
    const t = o.vyrez.y * m;
    const w = o.vyrez.w * m;
    const h = o.vyrez.h * m;
    // Souřadnice obrázku uvnitř plochy — obrázek je vycentrovaný,
    // takže levý horní roh není nutně [0,0].
    const ox = obrazek.offsetLeft;
    const oy = obrazek.offsetTop;

    ramecek.style.left = `${ox + l}px`;
    ramecek.style.top = `${oy + t}px`;
    ramecek.style.width = `${w}px`;
    ramecek.style.height = `${h}px`;

    const iw = obrazek.clientWidth;
    const ih = obrazek.clientHeight;
    const stin = (jmeno, styl) => {
      const el = plocha.querySelector(`.orez-stin[data-stin="${jmeno}"]`);
      if (el) Object.assign(el.style, styl);
    };
    stin('nahore', { left: `${ox}px`, top: `${oy}px`, width: `${iw}px`, height: `${t}px` });
    stin('dole', { left: `${ox}px`, top: `${oy + t + h}px`, width: `${iw}px`, height: `${Math.max(0, ih - t - h)}px` });
    stin('vlevo', { left: `${ox}px`, top: `${oy + t}px`, width: `${l}px`, height: `${h}px` });
    stin('vpravo', { left: `${ox + l + w}px`, top: `${oy + t}px`, width: `${Math.max(0, iw - l - w)}px`, height: `${h}px` });
  }

  function pripravVyrez() {
    o.prirozene = { w: obrazek.naturalWidth, h: obrazek.naturalHeight };
    if (!o.vyrez) o.vyrez = vychoziVyrez(o.prirozene.w, o.prirozene.h);
    ramecek.style.visibility = 'visible';
    prekresliRamecek();
  }

  if (obrazek.complete && obrazek.naturalWidth) pripravVyrez();
  else obrazek.addEventListener('load', pripravVyrez, { once: true });

  // Změna velikosti okna mění zobrazené měřítko, výřez v originálu ale ne.
  const naZmenuOkna = () => prekresliRamecek();
  window.addEventListener('resize', naZmenuOkna);
  ad._orezUklid = () => window.removeEventListener('resize', naZmenuOkna);

  let tah = null;

  plocha.addEventListener('pointerdown', (e) => {
    const cil = e.target.closest('[data-uchyt]');
    if (!cil || !o.vyrez) return;
    e.preventDefault();
    tah = {
      uchyt: cil.dataset.uchyt,
      x: e.clientX,
      y: e.clientY,
      start: { ...o.vyrez }
    };
    // Posluchače na okně, ne na prvku: rychlý tah mimo rámeček by jinak
    // gesto přerušil uprostřed.
    window.addEventListener('pointermove', naPohyb);
    window.addEventListener('pointerup', naKonec);
  });

  function naPohyb(e) {
    if (!tah || !o.prirozene) return;
    const m = merítko();
    const dx = (e.clientX - tah.x) / m;   // zobrazené → skutečné pixely
    const dy = (e.clientY - tah.y) / m;
    const N = o.prirozene;
    const s = tah.start;

    if (tah.uchyt === 'posun') {
      o.vyrez.x = omez(s.x + dx, 0, N.w - s.w);
      o.vyrez.y = omez(s.y + dy, 0, N.h - s.h);
      prekresliRamecek();
      return;
    }

    // Poměr je zamčený, takže volná je vždycky jen JEDNA míra. Šířka se
    // spočítá, výška se z ní odvodí. Kdyby se braly obě z myši, ořez by
    // na krajích fotky přestal držet poměr.
    const znakX = tah.uchyt.includes('e') ? 1 : -1;
    const znakY = tah.uchyt.includes('s') ? 1 : -1;
    let w;

    if (tah.uchyt === 'e' || tah.uchyt === 'w') {
      w = s.w + dx * znakX;
    } else if (tah.uchyt === 'n' || tah.uchyt === 's') {
      w = (s.h + dy * znakY) * POMER;
    } else {
      // Roh: rozhoduje ten směr, kterým uživatel táhne výrazněji.
      // Svislý posun se musí přepočítat na šířku (× POMER), jinak by
      // u širokého poměru vodorovný tah vždycky přebil svislý.
      w = Math.abs(dx) > Math.abs(dy * POMER)
        ? s.w + dx * znakX
        : (s.h + dy * znakY) * POMER;
    }

    let h = w / POMER;
    let x = tah.uchyt.includes('w') ? s.x + s.w - w : s.x;
    let y = tah.uchyt.includes('n') ? s.y + s.h - h : s.y;
    // Postranní úchyty rostou na kolmé ose na obě strany, aby rámeček
    // zůstal opticky přisátý k té hraně, za kterou se táhne.
    if (tah.uchyt === 'n' || tah.uchyt === 's') x = s.x + (s.w - w) / 2;
    if (tah.uchyt === 'w' || tah.uchyt === 'e') y = s.y + (s.h - h) / 2;

    // Ořezávání v tomto pořadí — a po každé změně šířky znovu dopočítat
    // výšku. Nezávislé ořezání obou měr je klasická chyba: na okraji
    // fotky by se poměr rozjel.
    const minSirka = Math.min(MIN_VYREZ, N.w);
    w = Math.max(minSirka, w);
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { y = 0; }
    if (x + w > N.w) w = N.w - x;
    h = w / POMER;
    if (y + h > N.h) { h = N.h - y; w = h * POMER; }

    // Radši jeden zahozený pohyb myši (nikdo si ho nevšimne) než
    // zdegenerovaný nebo převrácený rámeček.
    if (w < minSirka - 0.5 || h < minSirka / POMER - 0.5) return;

    o.vyrez = { x, y, w, h };
    prekresliRamecek();
  }

  function naKonec() {
    tah = null;
    window.removeEventListener('pointermove', naPohyb);
    window.removeEventListener('pointerup', naKonec);
  }

  const btnCela = ad.container.querySelector('#btn-orez-cela');
  if (btnCela) btnCela.addEventListener('click', () => {
    if (!o.prirozene) return;
    o.vyrez = vychoziVyrez(o.prirozene.w, o.prirozene.h);
    prekresliRamecek();
  });

  ad.container.querySelectorAll('.btn-orez-zrusit').forEach(btn => {
    btn.addEventListener('click', () => zavriOrez(ad));
  });

  const btnPotvrdit = ad.container.querySelector('.btn-orez-potvrdit');
  if (btnPotvrdit) btnPotvrdit.addEventListener('click', () => potvrdOrez(ad, obrazek, btnPotvrdit));
}

export function zavriOrez(ad) {
  if (ad._orezUklid) { ad._orezUklid(); ad._orezUklid = null; }
  // Objektová adresa drží soubor v paměti, dokud se neuvolní. Bez tohohle
  // by po pár ořezech ležely v paměti megabajty fotek, které už nikdo nevidí.
  if (ad.orez && ad.orez.objektURL) URL.revokeObjectURL(ad.orez.objektURL);
  ad.showCropModal = false;
  ad.orez = prazdnyOrez();
  ad.render();
}

/**
 * Vyrobí výsledný soubor.
 *
 * Zdrojový obdélník je výřez v pixelech originálu, cílový je konstanta —
 * proto je výstup pokaždé stejně velký, ať uživatel táhl kamkoli.
 */
function vyrobBlob(obrazek, vyrez) {
  return new Promise((hotovo) => {
    const platno = document.createElement('canvas');
    platno.width = CIL_SIRKA;
    platno.height = CIL_VYSKA;
    const ctx = platno.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(obrazek, vyrez.x, vyrez.y, vyrez.w, vyrez.h, 0, 0, CIL_SIRKA, CIL_VYSKA);
    // WebP místo JPEGu: při stejně vypadající kvalitě je zhruba o třetinu
    // menší, takže se rychleji nahraje i stahuje. Prohlížeč, který ho
    // neumí zakódovat, vrátí PNG — pozná se to podle typu a spadne se
    // zpátky na JPEG, jinak by se do koše nahrával několikamegový PNG.
    platno.toBlob((blob) => {
      if (blob && blob.type === 'image/webp') { hotovo(blob); return; }
      platno.toBlob(hotovo, 'image/jpeg', 0.86);
    }, 'image/webp', 0.85);
  });
}

async function potvrdOrez(ad, obrazek, btn) {
  const o = ad.orez;
  if (!o || !o.vyrez || o.nahrava) return;

  // Pojistka proti dvojímu odeslání — toBlob i nahrávání jsou asynchronní
  // a obsluha stihne kliknout několikrát.
  o.nahrava = true;
  btn.disabled = true;
  const puvodni = btn.textContent;
  btn.textContent = 'Nahrávám…';

  try {
    const blob = await vyrobBlob(obrazek, o.vyrez);
    if (!blob) throw new Error('Ořez se nepodařilo vyrobit.');

    const vysledek = await ad.nahrajFotkuAktuality(blob);
    if (vysledek && vysledek.success && vysledek.url) {
      ad.newsForm.image_url = vysledek.url;
      ad.showAdminToast('📷 Fotka byla oříznutá a nahraná.');
      zavriOrez(ad);
      return;
    }
    throw new Error((vysledek && vysledek.error && vysledek.error.message) || 'Nahrání selhalo.');
  } catch (err) {
    console.error('Ořez / nahrání fotky selhalo:', err);
    // Fotka se schválně NEUKLÁDÁ jako base64 do databáze. Dřív se to tak
    // dělalo a hlásil se úspěch: řádek měl stovky kilobajtů, stahoval ho
    // každý návštěvník a skutečná příčina zůstala skrytá.
    ad.showAdminToast(`⚠️ ${err.message || 'Fotku se nepodařilo nahrát.'} Zkuste to prosím znovu.`);
  } finally {
    o.nahrava = false;
    btn.disabled = false;
    btn.textContent = puvodni;
  }
}
