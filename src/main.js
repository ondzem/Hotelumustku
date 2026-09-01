import './style.css';
import './booking.css';
import { BookingSystem } from './components/BookingSystem.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { getStoredRoomPrices, getStoredDisabledRooms, MOCK_ROOMS, saveContactMessage, getStoredNewsItems, getStoredReviews, saveStoredReview, formatGDPRName, getStoredCenik, fetchCenik, fetchRoomPrices } from './lib/supabaseClient.js';
import { cenaZaOsobuNoc, maxOsobNaPokoji } from './utils/cenik.js';
import { sendEmail, generateEmailContactNotification, generateEmailNewReviewNotification, RECEPCE_PRIJEMCE } from './utils/emailService.js';
import { initScrollReveal } from './utils/scrollReveal.js';
import { fotkyPokoje } from './utils/roomGalleries.js';

/**
 * Ošetří text, který se vkládá do HTML.
 *
 * Recenze, aktuality i jména autorů píšou lidé zvenčí a putují do stránky
 * přes `innerHTML`. Bez tohohle stačilo uložit recenzi s `<img src=x
 * onerror=...>` a kód se spustil každému návštěvníkovi — včetně recepčního
 * v administraci, takže by šlo ukrást přihlášení. Nikdy nevkládej cizí text
 * do šablony bez `esc()`.
 */
export function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Adresa obrázku z databáze — pustíme jen běžné a bezpečné tvary. */
export function escUrl(url) {
  const u = String(url == null ? '' : url).trim();
  if (/^(https?:\/\/|\/)[^\s"'<>]*$/i.test(u)) return esc(u);
  return '';
}

export function syncCustomRoomNamesToDOM() {
  const roomItems = document.querySelectorAll('.room-breakdown-item[data-room]');
  roomItems.forEach(item => {
    const roomId = item.dataset.room;
    const nameEl = item.querySelector('.room-breakdown-name strong');
    if (!nameEl || !roomId) return;
    const rmObj = MOCK_ROOMS.find(r => r.id === roomId);
    if (rmObj && rmObj.name) {
      nameEl.textContent = rmObj.name;
    }
  });
}
window.syncCustomRoomNamesToDOM = syncCustomRoomNamesToDOM;

/**
 * Doplní na kartách pokojů cenu „od …“.
 *
 * Bere se nejnižší cena za osobu a noc, tedy sloupec pro plně
 * obsazený pokoj — se snídaní. To odpovídá tomu, co host zaplatí,
 * když přijede v největším počtu, a je to zároveň nejnižší číslo,
 * jaké se ho může týkat.
 */
export function syncDynamicRoomPricesToDOM() {
  const cenik = getStoredCenik();
  const roomPrices = getStoredRoomPrices();
  const dnes = new Date().toISOString().split('T')[0];

  document.querySelectorAll('.room-breakdown-item[data-room]').forEach(item => {
    const roomId = item.dataset.room;
    const priceAmountEl = item.querySelector('.price-amount');
    if (!priceAmountEl || !roomId) return;

    const rmObj = MOCK_ROOMS.find(r => r.id === roomId);
    if (!rmObj) return;

    const ulozene = roomPrices.find(p => p.room_id === roomId) || {};
    const maxOsob = maxOsobNaPokoji({
      zakladni_luzka: ulozene.zakladni_luzka != null ? ulozene.zakladni_luzka : rmObj.capacity,
      max_pristylek: ulozene.max_pristylek != null ? ulozene.max_pristylek : rmObj.extraBeds,
    });

    // Projdi všechny možné počty osob a vezmi nejnižší cenu za osobu
    let nejnizsi = null;
    for (let osob = 1; osob <= maxOsob; osob++) {
      const c = cenaZaOsobuNoc({
        datumStr: dnes,
        roomId,
        kategorie: rmObj.type,
        pocetOsob: osob,
        cenik,
      });
      if (c > 0 && (nejnizsi === null || c < nejnizsi)) nejnizsi = c;
    }

    if (nejnizsi) {
      priceAmountEl.textContent = `od ${nejnizsi} Kč`;
    }
  });
}
window.syncDynamicRoomPricesToDOM = syncDynamicRoomPricesToDOM;

export function syncDisabledRoomsToDOM() {
  const disabledRooms = getStoredDisabledRooms();
  const roomItems = document.querySelectorAll('.room-breakdown-item[data-room]');
  roomItems.forEach(item => {
    const roomId = item.dataset.room;
    if (!roomId) return;

    const isRenovating = ['p1', 'p2', 'p3'].includes(roomId);
    const isDisabled = isRenovating || disabledRooms.some(d => d.room_id === roomId && d.is_disabled);
    const selectBtn = item.querySelector('.btn-room-reserve, .btn-choose-room');
    const priceWrap = item.querySelector('.room-drawer-price-wrap');

    if (priceWrap) {
      priceWrap.style.display = isDisabled ? 'none' : '';
    }

    if (selectBtn) {
      if (isDisabled) {
        selectBtn.classList.add('btn-room-disabled');
        selectBtn.setAttribute('disabled', 'true');
        selectBtn.style.background = '#ffffff';
        selectBtn.style.color = '#666660';
        selectBtn.style.cursor = 'not-allowed';
        selectBtn.style.pointerEvents = 'none';
        selectBtn.style.border = '1px solid #c8c6b9';
        selectBtn.innerHTML = `<span>Dočasně nedostupné</span>`;
      } else {
        selectBtn.classList.remove('btn-room-disabled');
        selectBtn.removeAttribute('disabled');
        selectBtn.style.background = '';
        selectBtn.style.color = '';
        selectBtn.style.cursor = '';
        selectBtn.style.pointerEvents = '';
        selectBtn.style.border = '';
        selectBtn.innerHTML = `<span>Zvolit pokoj</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
      }
    }
  });

  const roomSelect = document.getElementById('room-select');
  if (roomSelect) {
    Array.from(roomSelect.options).forEach(opt => {
      const isRenovating = ['p1', 'p2', 'p3'].includes(opt.value);
      const isDisabled = isRenovating || disabledRooms.some(d => d.room_id === opt.value && d.is_disabled);
      if (isDisabled) {
        opt.disabled = true;
        opt.style.color = '#999';
        opt.style.background = '#eee';
        if (!opt.textContent.includes('🔒')) {
          opt.textContent = opt.textContent + ' [🔒 Dočasně zablokováno]';
        }
      } else {
        opt.disabled = false;
        opt.style.color = '';
        opt.style.background = '';
        opt.textContent = opt.textContent.replace(' [🔒 Dočasně zablokováno]', '');
      }
    });
  }
}
window.syncDisabledRoomsToDOM = syncDisabledRoomsToDOM;

// Seznam fotek se přesunul do src/utils/roomGalleries.js, aby ho mohla
// používat i rezervace. Re-export drží zpětnou vazbu pro starší importy.
export { ROOM_GALLERIES } from './utils/roomGalleries.js';

export const renderRoomBreakdownItem = (roomId, defaultRoomName, priceType, priceAmount) => {
  const rmObj = MOCK_ROOMS.find(r => r.id === roomId);
  const roomName = (rmObj && rmObj.name) ? rmObj.name : defaultRoomName;
  const isRenovating = ['p1', 'p2', 'p3'].includes(roomId);
  const disabledRooms = getStoredDisabledRooms();
  const isDisabled = isRenovating || (rmObj && rmObj.isDisabled) || disabledRooms.some(d => d.room_id === roomId && d.is_disabled);

  const photos = fotkyPokoje(roomId);
  const slidesHtml = photos.map((src, idx) => `
    <div class="room-carousel-slide">
      <img src="${src}" alt="${roomName} - Náhled ${idx + 1}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/hezky pokoj 1.webp';">
    </div>
  `).join('');

  return `
    <div class="room-breakdown-item" data-room="${roomId}">
      <div class="room-breakdown-row">
        <span class="room-breakdown-name"><strong>${roomName}</strong> <span class="room-meal">(se snídaní)</span></span>
        <button class="btn-toggle-details" aria-expanded="false">
          <span class="toggle-text">Zobrazit podrobnosti</span>
          <svg class="toggle-arrow" width="12" height="7" viewBox="0 0 12 7" fill="none"><path d="M1 1L6 6L11 1" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div class="room-breakdown-drawer">
        <div class="drawer-inner">
          <div class="room-carousel-viewport">
            <div class="room-carousel-track">
              ${slidesHtml}
            </div>
          </div>

          <div class="drawer-footer-controls">
            <div class="drawer-arrows-wrap">
              <button class="btn-drawer-arrow btn-drawer-prev" aria-label="Předchozí fotka">
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="M7 1L2 6L7 11" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/></svg>
              </button>
              <button class="btn-drawer-arrow btn-drawer-next" aria-label="Další fotka">
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="M1 1L6 6L1 11" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/></svg>
              </button>
            </div>

            <div class="drawer-action-btns">
              <div class="room-drawer-price-wrap" data-price="${priceType}" ${isDisabled ? 'style="display: none;"' : ''}>
                <div class="price-main-block">
                  <span class="price-amount">od ${priceAmount} Kč</span>
                  <span class="price-suffix">/ noc</span>
                </div>
                <div class="price-sub-block">
                  <span class="price-detail">za osobu • cena dle počtu osob</span>
                </div>
              </div>
              <button class="btn btn-booking btn-room-reserve">Zvolit pokoj</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

/**
 * Rozbalení textu v sekci O nás na mobilu.
 *
 * Obsluha visí na dokumentu, ne na tlačítku: sekce se překresluje při
 * přechodu mezi stránkami uvnitř webu a na natvrdo navěšený posluchač
 * by se po překreslení ztratil. Proto se registruje jednou pro celý web.
 */
let onasNapojeno = false;
export function initOnasRozbaleni() {
  if (onasNapojeno) return;
  onasNapojeno = true;

  document.addEventListener('click', (e) => {
    const tlacitko = e.target && e.target.closest && e.target.closest('.contact-about-toggle');
    if (!tlacitko) return;
    e.preventDefault();

    const text = document.getElementById('contact-about-body');
    if (!text) return;

    const rozbaleno = !text.classList.contains('is-rozbaleno');
    text.classList.toggle('is-rozbaleno', rozbaleno);
    tlacitko.setAttribute('aria-expanded', rozbaleno ? 'true' : 'false');

    const popisek = tlacitko.querySelector('.contact-about-toggle-text');
    if (popisek) popisek.textContent = rozbaleno ? 'Přečíst méně' : 'Přečíst více';

    // Po sbalení se vrátit na začátek textu, jinak by uživatel zůstal
    // viset kus pod sekcí a nevěděl, kam obsah zmizel.
    if (!rozbaleno) {
      const sekce = document.querySelector('.contact-about-section');
      if (sekce) {
        const hlavicka = document.querySelector('.site-header');
        const odstup = hlavicka ? hlavicka.offsetHeight + 16 : 90;
        const y = sekce.getBoundingClientRect().top + window.pageYOffset - odstup;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }
  });
}

const getHeaderHTML = () => `
      <!-- Hlavička (Navigace a logo) -->
  <header class="site-header">
    <!-- Levá strana: Logo -->
    <a href="/" class="header-logo">
      <img src="/Logo/white-logo-orez.webp" alt="Hotel u Můstku Logo" loading="eager" fetchpriority="high">
    </a>

    <!-- Pravá strana: Odkazy a Tlačítko Rezervovat pobyt -->
    <div class="header-nav-right">
      <nav class="header-nav-links">
        <a href="/ubytovani" class="nav-link">Nabídka pokojů</a>
        <a href="/stravovani" class="nav-link">Stravování</a>
        <a href="/okoli" class="nav-link">Aktivity</a>
        <a href="/akce" class="nav-link">Skupinové akce</a>
        <a href="/aktuality" class="nav-link" id="nav-link-aktuality">Aktuality</a>
        <a href="/kontakt" class="nav-link">Kontakt</a>
      </nav>
      <a href="/#rezervace" class="btn btn-header-booking" id="header-booking-btn">Rezervovat pobyt</a>
    </div>

    <!-- Mobilní tlačítko menu (Hamburger) -->
    <button class="mobile-menu-btn" id="mobile-menu-toggle" aria-label="Otevřít menu">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </header>

  <!-- Mobilní navigace (Drawer Overlay) -->
  <div class="mobile-menu-overlay" id="mobile-menu-overlay">
    <button class="mobile-menu-close" id="mobile-menu-close" aria-label="Zavřít menu">&times;</button>
    <nav class="mobile-menu-nav">
      <a href="/ubytovani" class="mobile-nav-link">Nabídka pokojů</a>
      <a href="/stravovani" class="mobile-nav-link">Stravování</a>
      <a href="/okoli" class="mobile-nav-link">Aktivity</a>
      <a href="/akce" class="mobile-nav-link">Skupinové akce</a>
      <a href="/aktuality" class="mobile-nav-link" id="mobile-nav-link-aktuality">Aktuality</a>
      <a href="/kontakt" class="mobile-nav-link">Kontakt</a>
    </nav>
    <button class="btn btn-booking mobile-menu-booking" id="mobile-menu-booking">Rezervovat pobyt</button>

    <!-- Spodní přepínání Léto / Zima v mobilním menu -->
    <div class="mobile-season-toggle">
      <div class="control-item" aria-label="Přepnout na letní zobrazení">
        <img src="/Icons/sun_icon.webp" alt="" class="control-icon">
        <span>Léto</span>
      </div>
      <div class="control-item" aria-label="Přepnout na zimní zobrazení">
        <img src="/Icons/snowflake_icon.webp" alt="" class="control-icon">
        <span>Zima</span>
      </div>
    </div>
  </div>
`;

const getPromoHTML = () => `
  <!-- PROMO BANNER (SLEVA SEKCE 1:1 REPLIKA) -->
  <section class="promo-banner">
    <img src="/Decoration/Hory - dekorace.webp" alt="" class="promo-contour-img" aria-hidden="true" loading="lazy" decoding="async">
    <div class="promo-inner" data-anim="up">
      <div class="promo-content">
        <h2 class="promo-title">Jak získat nejvýhodnější pobyt?</h2>
        <p class="promo-desc">Rezervací přímo na tomto webu získáte slevu <strong>5%</strong> na celý pobyt. Ušetříte a zajistíte si nejvýhodnější ubytování v našem hotelu.</p>
      </div>
      <div class="promo-action">
        <button class="btn btn-promo" id="promo-booking-btn">Chci výhodné ubytování</button>
      </div>
    </div>
  </section>
`;

const getPanoramicHTML = () => `
  <!-- PANORAMATICKÝ NÁHLED (FOTKA ZAHRADY A TERASY POD BANNEREM) -->
  <section class="panoramic-section" id="galerie">
    <img src="/Uvodni stranka/Fotka Zahrady a Terasy.webp" alt="Zahrada a terasa Hotelu u Můstku" class="panoramic-img" loading="lazy" decoding="async" data-anim="fade">
  </section>
`;

const getServicesHTML = () => `
  <!-- SEKCE CO DALŠÍHO NABÍZÍME / UPSELL (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="services-section" id="sluzby">
    <div class="services-inner">
      <h2 class="services-title" data-anim="up">Co dalšího nabízíme?</h2>
      
      <div class="services-cards-wrap" data-anim-group>
        <!-- Karta 1: Stravování (Vlevo) -->
        <div class="service-card service-card-left" data-anim="up">
          <div class="service-img-wrap">
            <img src="/Uvodni stranka/stravovani.webp" alt="Stravování v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="service-card-body">
            <h3 class="service-card-title">Stravování</h3>
            <p class="service-card-desc">Skvělé ubytování v Jizerských horách a poctivé stravování k sobě neodmyslitelně patří. Po celém dni stráveném v přírodě na vás čeká vydatné domácí menu a posezení na terase přímo nad šumícím splavem.</p>
            <button class="btn btn-service-more" id="service-restaurant-btn">Zjistit více</button>
          </div>
        </div>

        <!-- Karta 2: Skupinové Akce (Vpravo - posunutá dolů) -->
        <div class="service-card service-card-right" data-anim="up">
          <div class="service-img-wrap">
            <img src="/Uvodni stranka/skupinove_akce_zelena_profesionalni_uprava.webp" alt="Skupinové akce v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="service-card-body">
            <h3 class="service-card-title">Skupinové Akce</h3>
            <p class="service-card-desc">Uspořádejte nezapomenutelnou oslavu, teambuilding, svatbu nebo sportovní soustředění v Jizerských horách s kompletním pronájmem hotelu pro 34 až 40 hostů a naprostým soukromím.</p>
            <button class="btn btn-service-more" id="service-events-btn">Zjistit více</button>
          </div>
        </div>
      </div>
    </div>
  </section>
`;

// Anonymizovaná databáze reálných recenzí hostů (GDPR compliant, bez odpovědí provozovatele)
const GUEST_REVIEWS = [
  {
    "date": "26. 07. 2026",
    "author": "Grizzly",
    "text": "Úžasně vstřícný personál, ochotný, usměvavý. Dlouho budeme vzpomínat na žampionovou polévku, kulajdu a domácí jogurt, který dělá paní majitelka."
  },
  {
    "date": "26. 06. 2026",
    "author": "Jitka",
    "text": "Strávili jsme tady s manželem nádherný víkend. Krásné prostředí, útulný hotel, výborná kuchyně, i když vaří jenom jedno menu. Úschovna kol, kde jsme si mohli elektrokola nabít, a co bylo super v těchto vedrech — pod terasou nádherný splav, kde jsme se mohli koupat. Posezení na zahrádce u dobrého piva bylo super. Určitě ještě přijedeme."
  },
  {
    "date": "13. 03. 2026",
    "author": "Zdeňka",
    "text": "V hotelu jsme byli moc spokojeni. Pokoj měl starší vybavení, ale byl udržovaný a čistý. Ocenili jsme balkónek, který měl krásný výhled na můstky a na říčku Bílá Desná. Snídaně byly dostatečné. Večeři, která zahrnovala polévku a hlavní jídlo, si bylo možné předem objednat. Dalším bonusem je poloha hotelu — Jizerská magistrála se nachází zhruba 2 km od ubytování."
  },
  {
    "date": "22. 01. 2026",
    "author": "Lucie",
    "text": "Hotel na klidném pěkném místě. Vybavení starší, ale vše plně funkční a čisté. Velmi příjemný personál. Snídaně dostačující, možnost objednání večeří (jednotné menu — polévka, hlavní chod). Byli jsme velmi spokojeni."
  },
  {
    "date": "24. 08. 2025",
    "author": "Lenka a Ruda",
    "text": "Děkujeme za příjemně strávenou dovolenou v útulných, velmi čistých pokojích. Majitelé jsou pohodoví a ochotní, velký výběr domácích produktů ve snídaňovém bufetu, večeře výborné za lidové ceny. Určitě doporučujeme všem, kdo stojí o dovolenou v hezkém, klidném prostředí. Stoprocentní spokojenost, vřele doporučujeme. Děkujeme."
  },
  {
    "date": "17. 08. 2025",
    "author": "Dana N.",
    "text": "Byli jsme jen na tři dny, ale naprostá spokojenost. Tak čistý pokoj jsme snad ještě nezažili, majitelé vstřícní a jídlo také nemělo chybu. Pokud pojedeme do těchto končin znovu, určitě se ubytujeme opět tady."
  },
  {
    "date": "08. 08. 2025",
    "author": "Roman K.",
    "text": "Spokojenost, doporučuji."
  },
  {
    "date": "08. 06. 2025",
    "author": "Antonín",
    "text": "Příjemné, klidné místo, dobré jídlo, přátelský personál, parkování u hotelu. Vzhledem k tomu, že je hotel starší, tak se mi vybavily příjemné vzpomínky na obdobná ubytování v 90. letech."
  },
  {
    "date": "18. 02. 2025",
    "author": "Adam",
    "text": "Pobyt se nám u vás moc líbil. Milý přístup, krásně čisto, výborné jídlo, pěkné okolí hotelu a večer jsme se nenudili (kulečník, fotbálek, stolní tenis). Děkujeme :-)"
  },
  {
    "date": "02. 02. 2025",
    "author": "Honza",
    "text": "V současné době můžu pochválit ceny, krásně čisto, příjemný personál, klidné místo. Vřele doporučuji."
  },
  {
    "date": "02. 01. 2025",
    "author": "Vojtěch",
    "text": "Hotel je ve velmi klidné části Desné daleko od veškerého ruchu, ale ne zase příliš daleko od centra, nádraží nebo přírody. Pokoj prostorný, postel i gauč vskutku pohodlné. U snídaně dostatečný výběr a možnost domluvit si za pár korun i svačinu s sebou. Dále byla možnost objednat večeři — tradiční česká kuchyně, která byla vynikající. Majitelé hotelu jsou velmi milí lidé a není problém vyřešit jakoukoliv situaci. Dále je možné zahrát si stolní fotbal nebo například kulečník."
  },
  {
    "date": "10. 09. 2024",
    "author": "Jirka",
    "text": "Pokud chcete dovolenou v klidném prostředí, tak vřele doporučuji. Na hotelu klid, v noci klid a okolí krásné a klidné. Výborné večeře, sice bez výběru, jedno menu, ale kvalita, se kterou se hned tak nesetkáte. Podotýkám česká kuchyně. Rádi se sem vrátíme."
  },
  {
    "date": "18. 06. 2024",
    "author": "Tomáš",
    "text": "Obrovská spokojenost, ceny stejné jako před třemi lety. Pořád krásně čisto, výborné jídlo a ochotný personál. Díky."
  },
  {
    "date": "05. 01. 2024",
    "author": "Zbyněk",
    "text": "Super místo, Silvestr neměl chybu. Perfektní jídlo, snídaně — velký výběr. V létě určitě přijedeme. Velice příjemný a ochotný personál. Určitě v létě přijedeme na kola."
  },
  {
    "date": "02. 10. 2023",
    "author": "Soňa",
    "text": "Krásné místo, útulný hotýlek, všude čisto, příjemní a milí majitelé, výhled přímo na můstky, snídaně výborná, zkrátka úžasný odpočinek v nádherném prostředí."
  },
  {
    "date": "11. 08. 2023",
    "author": "Jana a Zdeněk",
    "text": "Na dovolené jsme zde byli už počtvrté a opět stoprocentní spokojenost. Ochotní majitelé, výborná kuchyně, čisté pokoje a hlavně klid a pohoda. Děkujeme za příjemně strávenou dovolenou. Těšíme se na příště."
  },
  {
    "date": "01. 01. 2023",
    "author": "Kymličkovi",
    "text": "Příjemné klidné prostředí s chutnou domácí stravou a personálem ochotným vyhovět specifickým požadavkům. Pokoje útulné a všude čisto. Pobyt byl milým překvapením a můžeme jen doporučit."
  },
  {
    "date": "13. 08. 2022",
    "author": "Jana a Jirka",
    "text": "Jezdíme pravidelně každý rok už od roku 2015. Dovolená je každý rok lepší a lepší. Skvělá kuchyně, výborné snídaně s domácími jogurty a chlebem, všude čisto, klid a pohoda. Vřele doporučujeme a těšíme se na příští léto. Děkujeme za krásnou dovolenou."
  },
  {
    "date": "02. 09. 2021",
    "author": "Jana a Jirka",
    "text": "Tak jako každý rok, byl ten týden u Vás v hotelu úplný balzám na tělo i duši. Škoda jen, že to vždy tak rychle uteče. Děkujeme a už nyní se těšíme na příští rok."
  },
  {
    "date": "08. 01. 2020",
    "author": "Jana a Filip",
    "text": "Děkujeme za příjemný pobyt v útulném prostředí a skvělou domácí kuchyni. V létě přijedeme zase."
  },
  {
    "date": "27. 07. 2019",
    "author": "Jana a Jirka",
    "text": "Stále stejně super hotel v klidném prostředí s výbornou kuchyní. Užili jsme si to my i děti. Příští rok se chystáme znovu. Děkujeme za nádhernou dovolenou."
  },
  {
    "date": "24. 01. 2019",
    "author": "J. M.",
    "text": "Vše tak, jak má být. Stoprocentní spokojenost. Děkujeme."
  },
  {
    "date": "14. 08. 2018",
    "author": "Jana a Jirka",
    "text": "Už čtvrtý pobyt a je to čím dál tím lepší. Doporučujeme."
  },
  {
    "date": "29. 07. 2018",
    "author": "P. a R. T.",
    "text": "Děkujeme vám za příjemně strávenou dovolenou ve vašem klidném, čistém a útulném hotelu s výbornou kuchyní. Moc se nám u vás líbilo. Všem doporučujeme."
  },
  {
    "date": "10. 03. 2018",
    "author": "Jitka a Michal",
    "text": "Klid, čisto, pohodlí, snídaně i večeře super. Přestože se vaří jednotné jídlo, s takovou kvalitou se setkáváme málokde. Doporučujeme."
  },
  {
    "date": "28. 08. 2017",
    "author": "Jana a Jirka",
    "text": "Letos jsme se vrátili už potřetí a určitě ne naposledy. Vřele doporučujeme — dovolená tady nemá chybu. Děkujeme."
  },
  {
    "date": "19. 08. 2017",
    "author": "Aleš D. s rodinou",
    "text": "S velmi dobrým pocitem odjíždíme z týdenního pobytu v tomto hotelu s velice příjemným a čistým prostředím, výbornou kuchyní a úžasnými majiteli. Velké díky za příjemné prožití letní dovolené a někdy zase na shledanou v hotelu U Můstků."
  },
  {
    "date": "06. 03. 2017",
    "author": "Jiří Č.",
    "text": "Moc Vám děkujeme za příjemný pobyt, dobré ubytování, výbornou domácí kuchyni a moc příjemné majitele. Určitě všem doporučujeme."
  },
  {
    "date": "04. 02. 2017",
    "author": "Thomas (DE)",
    "text": "Einfach, praktisch, super nette Leute und preiswert, super Frühstück und wer wollte exzellentes Abendbrot."
  },
  {
    "date": "11. 09. 2016",
    "author": "Majkovi",
    "text": "Děkujeme za úžasný týdenní pobyt nejen v příjemném hotelu s úžasnými majiteli, ale také za krásná místa v okolí. Hotel U Můstků můžeme všem jen doporučit. Ještě jednou děkujeme."
  },
  {
    "date": "01. 09. 2016",
    "author": "Novákovi",
    "text": "Děkujeme majitelům hotelu za příjemně strávený pobyt a vše, co pro nás dělali. Ještě jednou vřelý dík. Všem vřele doporučujeme."
  },
  {
    "date": "31. 07. 2016",
    "author": "Jana a Jirka",
    "text": "Všem doporučujeme — pěkný hotel a hlavně úžasní majitelé a výborná kuchyně. Letos jsme byli už podruhé, vrátili jsme se po roce a bylo to snad ještě lepší než loni :-) Děkujeme za nádhernou dovolenou."
  },
  {
    "date": "27. 06. 2016",
    "author": "Volfovi",
    "text": "Krásný hotel v krásné krajině, možnost mnoha výletů a procházek, skvělá kuchyně a velice milí a ochotní majitelé. Dovolená se nám moc líbila, ani odjíždět se nám nechtělo. Určitě se ještě někdy vrátíme."
  },
  {
    "date": "08. 03. 2016",
    "author": "Sládkovi",
    "text": "V hotelu jsme strávili týden a vřele ho doporučujeme všem návštěvníkům — levné a skvěle připravené jídlo, velice příjemní a ochotní majitelé."
  },
  {
    "date": "28. 01. 2016",
    "author": "Antonín H.",
    "text": "Zdejší hotel hodnotíme s manželkou — za slušné peníze hodně muziky. Výborné ubytování, služby, kuchyně, čistota a slušní majitelé. Procestovali jsme toho hodně a tento hotel s klidem můžeme doporučit."
  },
  {
    "date": "11. 01. 2016",
    "author": "Milan",
    "text": "Silvestrovský pobyt super. Děkujeme za krásný vstup do nového roku 2016."
  },
  {
    "date": "15. 09. 2015",
    "author": "Kamila",
    "text": "Pobyt v hotelu se nám moc líbil. Na pokoji nám nic nechybělo — vše mají promyšleno do detailů. Jídlo bylo moc dobré. Majitelé jsou velmi příjemní a ochotní. Vhodné i pro rodinu s malými dětmi. Byli jsme moc spokojení. Doporučujeme!"
  },
  {
    "date": "07. 09. 2015",
    "author": "Jindra",
    "text": "V neděli jsme měli oslavu narozenin ve zdejším hotelu. Všichni jsme byli velice mile překvapeni kvalitou a chutí jídla, zároveň příjemným, přitom profesionálním personálem. Vřele doporučujeme."
  },
  {
    "date": "10. 08. 2015",
    "author": "Jana a Zdeněk",
    "text": "V sobotu jsme se vrátili z týdenní dovolené, vše bylo super! Včetně vynikajícího personálu (tímto jej zdravíme) a domácí kuchyně! Ještě jednou díky za příjemně strávený týden. Vřele všem doporučujeme!"
  },
  {
    "date": "10. 08. 2015",
    "author": "Venca a Barča",
    "text": "Naprosto bezchybný týden dovolené, vše už zde bylo napsáno, naše hodnocení: jednička s hvězdou. Vše super, doporučujeme."
  },
  {
    "date": "01. 08. 2015",
    "author": "Jana a Jirka",
    "text": "Příjemný hotel, výborná domácí kuchyně, domácí atmosféra. Dovolenou tady vřele všem doporučujeme. Nádherná dovolená — děkujeme a moc rádi se vrátíme."
  },
  {
    "date": "30. 07. 2015",
    "author": "Jirka a Jana",
    "text": "Klidné prostředí, pohoda. Doporučuji."
  },
  {
    "date": "24. 03. 2015",
    "author": "Erika B.",
    "text": "Příjemně strávený pobyt v hotelu, všem doporučuji a hlavně dobrá kuchyně. Pozdrav provozovatelům."
  },
  {
    "date": "24. 03. 2015",
    "author": "Eva N.",
    "text": "S rodinou jsme byli v hotelu U Můstků v Desné, prostě paráda. Domácí strava a příjemná obsluha, palec nahoru."
  },
  {
    "date": "19. 01. 2015",
    "author": "Pavel K.",
    "text": "Na začátku ledna jsme se s rodinou ubytovali v hotelu, kde jsme strávili pět dnů. Byli jsme spokojeni. Doporučuji."
  },
  {
    "date": "09. 09. 2014",
    "author": "Honza s přáteli",
    "text": "O prázdninách jsme navštívili s kamarády Jizerské hory a ubytování v hotelu U Můstků bylo super. Určitě pojedeme znovu i v zimě na lyže. Tímto pozdravuji provozovatele."
  },
  {
    "date": "24. 07. 2014",
    "author": "Michal a Jitka",
    "text": "Rodinný hotel v klidném prostředí, výborná domácí kuchyně a příjemní lidé... :-) Parádní dovolená."
  },
  {
    "date": "13. 07. 2014",
    "author": "Dana",
    "text": "S přítelem jsme strávili tři dny a byli jsme velice spokojeni."
  },
  {
    "date": "31. 05. 2014",
    "author": "Jana V.",
    "text": "Minulý týden jsme se s rodinou ubytovali v hotelu U Můstků a můžu jenom doporučit. Velice příjemní lidé, výborná domácí kuchyně. Všude čisto. Opravdu doporučuji."
  },
  {
    "date": "16. 04. 2014",
    "author": "Ilona M.",
    "text": "Přespali jsme sice jenom jednu noc a musím konstatovat, že jsme spokojeni s přístupem a hlavně nádherně čistě uklizenými pokoji. Snídaně formou bufetu bez sebemenších připomínek."
  },
  {
    "date": "15. 04. 2014",
    "author": "Jaroslav K.",
    "text": "Za profesionální přístup personálu a příjemné prostředí palec nahoru. Mohu všem jen doporučit. Zároveň si přeji, aby takto fungovala všechna podobná zařízení v Desné. Majitelům a personálu přeji plno slušných hostů a hodně elánu do jejich další práce."
  },
  {
    "date": "03. 04. 2014",
    "author": "Zbyněk V.",
    "text": "Krásné prostředí, příjemná obsluha a výborná domácí kuchyně. Také jsme měli možnost ochutnat domácí uzený bůček a různé dobroty z grilu. Můžu jenom doporučit."
  }
];

const getReviewsHTML = () => `
  <!-- SEKCE RECENZE (1:1 REPLIKA DLE SVG PŘEDLOHY + INTERAKTIVNÍ INFINITY SLIDER + NAPSAT RECENZI) -->
  <section class="reviews-section" id="recenze">
    <div class="reviews-inner">
      <h2 class="reviews-title" style="margin-bottom: 24px;" data-anim="up">Co o nás říkají sami hosté?</h2>
      
      <div class="reviews-slider-viewport" id="reviews-viewport" data-anim-group>
        <div class="reviews-slider-track" id="reviews-track">
          ${GUEST_REVIEWS.map(r => `
            <div class="review-card" data-anim="up">
              <img src="/Icons/google logo.webp" alt="Google Logo" class="review-google-icon" loading="lazy" decoding="async">
              <p class="review-quote">${esc(r.text)}</p>
              <div class="review-contour-bg">
                <img src="/Decoration/hory_contour.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">
              </div>
              <div class="review-footer">
                <span class="review-author-name">${esc(r.author || r.author_name)}</span>
                <span class="review-date">${r.date}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="reviews-nav-controls">
        <div class="reviews-nav-arrows">
          <button class="review-nav-btn" id="reviews-prev" aria-label="Předchozí recenze">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button class="review-nav-btn" id="reviews-next" aria-label="Další recenze">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>

        <button type="button" class="btn btn-add-review" id="btn-open-review-modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>Napsat recenzi</span>
        </button>
      </div>
    </div>
  </section>

`;

const getFeaturesHTML = () => `
  <!-- SEKCE VÝHODY HOTELU / VÍCE NEŽ JEN UBYTOVÁNÍ (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="features-section">
    <div class="features-inner">
      <h2 class="features-title" data-anim="up">Více než jen ubytování</h2>
      
      <div class="features-grid" data-anim-group>
        <!-- Horní řada (3 výhody) -->
        <div class="features-row">
          <!-- Výhoda 1 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikona - spolecenska herna.webp" alt="Vnitřní společenská herna" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Vnitřní společenská herna</strong> pro zábavu za každého počasí.
            </p>
          </div>

          <!-- Výhoda 2 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Otuzovani-u-splavu.webp" alt="Přírodní otužování u splavu" class="feature-icon-otuzovani" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Přírodní otužování u splavu</strong> pro dokonale svěží restart těla i mysli.
            </p>
          </div>

          <!-- Výhoda 3 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikona - venkovni posezeni.webp" alt="Relaxace na dřevěné terase" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Relaxace na dřevěné terase</strong> s uklidňujícím šuměním splavu řeky.
            </p>
          </div>
        </div>

        <!-- Horizontální dělicí čára -->
        <div class="features-divider"></div>

        <!-- Spodní řada (3 výhody) -->
        <div class="features-row">
          <!-- Výhoda 4 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikona - ohniste.webp" alt="Zahrada s ohništěm" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Zahrada s ohništěm</strong> a grilem pro příjemné večery.
            </p>
          </div>

          <!-- Výhoda 5 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikona - polopenze.webp" alt="Domácí polopenze" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Domácí polopenze</strong> s pestrou nabídkou kvalitních jídel.
            </p>
          </div>

          <!-- Výhoda 6 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikona - turistika a cyklistika.webp" alt="Turistické a cyklistické trasy" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Turistické a cyklistické trasy</strong> začínající přímo u hotelu.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
`;

const getSurroundingsHTML = (customClass = '') => `
  <!-- SEKCE AKTIVITY V OKOLÍ (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="surroundings-section ${customClass}" id="aktivity">
    <div class="surroundings-inner">
      <h2 class="surroundings-title" data-anim="up">Co vše můžete v okolí podniknout?</h2>
      
      <div class="surroundings-slider-viewport" id="surroundings-viewport">
        <div class="surroundings-cards-grid" id="surroundings-track" data-anim-group>
          <!-- Karta 1 -->
          <div class="surrounding-card" data-anim="up">
            <div class="surrounding-card-img-wrap">
              <img src="/Uvodni stranka/Rozhledna Stepanka.webp" alt="Rozhledna Štěpánka" loading="lazy" decoding="async">
            </div>
            <h3 class="surrounding-card-title">ROZHLEDNA ŠTĚPÁNKA</h3>
          </div>
          
          <!-- Karta 2 -->
          <div class="surrounding-card" data-anim="up">
            <div class="surrounding-card-img-wrap">
              <img src="/Uvodni stranka/Vodopady Jizerky.webp" alt="Vodopády na Černé Desné" loading="lazy" decoding="async">
            </div>
            <h3 class="surrounding-card-title">VODOPÁDY NA ČERNÉ DESNÉ</h3>
          </div>
          
          <!-- Karta 3 -->
          <div class="surrounding-card" data-anim="up">
            <div class="surrounding-card-img-wrap">
              <img src="/Uvodni stranka/Tanvaldsky spicak.webp" alt="Ski Areál Tanvaldský Špičák" loading="lazy" decoding="async">
            </div>
            <h3 class="surrounding-card-title">SKI AREÁL TANVALDSKÝ ŠPIČÁK</h3>
          </div>
          
          <!-- Karta 4 -->
          <div class="surrounding-card" data-anim="up">
            <div class="surrounding-card-img-wrap">
              <img src="/Uvodni stranka/Liberec zoo.webp" alt="ZOO Liberec" loading="lazy" decoding="async">
            </div>
            <h3 class="surrounding-card-title">ZOO LIBEREC</h3>
          </div>
        </div>
      </div>
      
      <div class="surroundings-footer">
        <div class="surroundings-nav-controls">
          <button class="surroundings-nav-btn" id="surroundings-prev" aria-label="Předchozí aktivity">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button class="surroundings-nav-btn" id="surroundings-next" aria-label="Další aktivity">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        
        <button class="btn btn-surroundings-more" id="surroundings-more-btn">Zobrazit všechny aktivity</button>
      </div>
    </div>
  </section>
`;

const getCtaHTML = () => `
  <!-- CTA SEKCE (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="cta-section">
    <div class="cta-overlay"></div>
    <div class="cta-inner">
      <h2 class="cta-title">Dopřejte si zasloužený<br>odpočinek v Jizerských horách</h2>
      <button class="btn btn-cta" id="cta-booking-btn">Rezervovat pobyt</button>
    </div>
  </section>
`;

const getFooterHTML = () => `
  <!-- PATIČKA (SITE FOOTER 1:1 REPLIKA) -->
  <footer class="site-footer" id="site-footer">
    <div class="footer-contour-bg">
      <img src="/Decoration/Dekorace footer.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
    </div>

    <div class="footer-inner">
      <div class="footer-mobile-logo">
        <img src="/Logo/white logo.webp" alt="Logo Hotelu U Můstků Desná" loading="lazy" decoding="async">
      </div>

      <div class="footer-columns-grid">
        <!-- Sloupec 1: Kontakty -->
        <div class="footer-col footer-col-contact">
          <div class="footer-contact-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            <a href="mailto:hotel@umustku.cz" class="footer-contact-link">hotel@umustku.cz</a>
          </div>
          <div class="footer-divider-line"></div>

          <div class="footer-contact-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            <a href="tel:+420777666273" class="footer-contact-link">+420 777 666 273</a>
          </div>
          <div class="footer-divider-line"></div>

          <div class="footer-contact-item footer-address-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <div class="footer-address-text">
              <span>Údolní 368</span>
              <span>468 61 Desná v Jizerských horách 1</span>
              <span class="footer-business-id">Lenka Bellingerová · IČ: 74349074 · plátce DPH</span>
            </div>
          </div>
        </div>

        <!-- Sloupec 2: Rychlé odkazy -->
        <div class="footer-col footer-col-links">
          <h3 class="footer-col-heading">Rychlé odkazy</h3>
          <ul class="footer-links-list">
            <li><a href="/ubytovani">Nabídka pokojů</a></li>
            <li><a href="/stravovani">Stravování</a></li>
            <li><a href="/akce">Akce</a></li>
            <li><a href="/okoli">Aktivity</a></li>
            <li><a href="/kontakt">Kontakt</a></li>
          </ul>
        </div>

        <!-- Sloupec 3: Právní doložky -->
        <div class="footer-col footer-col-legal">
          <h3 class="footer-col-heading">Právní doložky</h3>
          <ul class="footer-links-list">
            <li><a href="/gdpr">Ochrana osobních údajů (GDPR)</a></li>
            <li><a href="/podminky">Obchodní podmínky</a></li>
            <li><a href="/cookies" id="footer-cookie-settings-link">Používání cookies (Nastavení)</a></li>
          </ul>
        </div>
      </div>

      <!-- Spodní lišta -->
      <div class="footer-bottom-row">
        <div class="footer-copyright secret-admin-trigger" title="Vstup pro recepci" style="cursor: pointer;">© 2026 All Rights Reserved.</div>
        <div class="footer-logo-wrap btn-scroll-top" title="Zpět nahoru">
          <img src="/Logo/white logo.webp" alt="Logo Hotelu U Můstků Desná" loading="lazy" decoding="async">
        </div>
        <div class="footer-author">Vytvořil <a href="https://ozeman.cz" target="_blank" rel="noopener">ozeman.cz</a></div>
      </div>
    </div>
  </footer>

  <!-- LIGHTBOX MODAL PRO ZVĚTŠENÍ FOTEK POKOJŮ (PRO SENIORY) -->
  <div class="lightbox-modal" id="lightbox-modal" aria-hidden="true" role="dialog">
    <div class="lightbox-overlay" id="lightbox-overlay"></div>
    <div class="lightbox-content">
      <button class="lightbox-close-btn" id="lightbox-close" aria-label="Zavřít zobrazení fotky" title="Zavřít fotku (Esc)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <button class="lightbox-nav-btn lightbox-prev-btn" id="lightbox-prev" aria-label="Předchozí fotka">
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none"><path d="M10 2L2 10L10 18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>
      </button>

      <div class="lightbox-image-container">
        <img src="" alt="Zvětšený náhled pokoje" id="lightbox-img" class="lightbox-img">
      </div>

      <button class="lightbox-nav-btn lightbox-next-btn" id="lightbox-next" aria-label="Další fotka">
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none"><path d="M2 2L10 10L2 18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>
`;

// Render Funkce Pro Domovskou Stránku
const getHomePageHTML = () => {
  const isWinter = getInitialSeasonMode() === 'winter';

  const heroMedia = isWinter
    ? `<img class="hero-winter-img" src="/Zimni rezim/Zima - hotel.webp" alt="Hotel u Můstku v zimě" fetchpriority="high" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">`
    : `<picture style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
        <source media="(max-width: 767px)" srcset="/uvodni_hero_sekce_mobile.webp">
        <img class="hero-summer-poster" src="/uvodni_hero_sekce.webp" alt="Pohled na budovu Hotelu U Můstků se skokanskými můstky v pozadí" fetchpriority="high" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
      </picture>
      <video
        class="hero-video"
        muted
        loop
        playsinline
        preload="none"
        data-hero-video
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; background: transparent;"
      >
        <source data-src="/hotel_hero_video.mp4" type="video/mp4">
      </video>`;

  const aboutTopSrc = isWinter
    ? '/Zimni rezim/Zima - prijezdova fotka.webp'
    : '/Uvodni stranka/Vyhled z balkonu na skokanky.webp';

  const aboutBottomSrc = isWinter
    ? '/Zimni rezim/Zime - pohled zezadu.webp'
    : '/Uvodni stranka/Pohled na hotel ze z predni strany.webp';

  const panoramicSrc = isWinter
    ? '/Zimni rezim/Zima - zadni vchod.webp'
    : '/Uvodni stranka/Fotka Zahrady a Terasy.webp';

  const ctaStyle = isWinter
    ? "background: linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.45)), url('/Zimni rezim/tanvaldsky spicak.webp') center 20%/cover no-repeat;"
    : '';

  return `
  <!-- HERO SEKCE -->
  <section class="hero-section home-hero-section" id="uvod">
    ${heroMedia}
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <!-- Středový nadpis -->
      <h1 class="hero-title">Objevte klidné ubytování v Jizerských horách.</h1>

      <!-- Tlačítka akce -->
      <div class="hero-buttons">
        <button class="btn btn-booking" id="booking-btn">Rezervovat pobyt</button>
        <button class="btn btn-rooms" id="rooms-btn">Nabídka pokojů</button>
      </div>

      <!-- Spodní levé info (Léto / Zima) -->
      <div class="bottom-left-controls">
        <div class="control-item ${!isWinter ? 'is-active' : ''}" aria-label="Přepnout na letní zobrazení">
          <img src="/Icons/sun_icon.webp" alt="" class="control-icon">
          <span>Léto</span>
        </div>
        <div class="control-item ${isWinter ? 'is-active' : ''}" aria-label="Přepnout na zimní zobrazení">
          <img src="/Icons/snowflake_icon.webp" alt="" class="control-icon">
          <span>Zima</span>
        </div>
      </div>

      <!-- Spodní šipka dolů -->
      <div class="scroll-down-btn" id="scroll-btn">
        <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
        </svg>
      </div>
    </div>
  </section>

  <!-- SEKCE O NÁS / ZÁZEMÍ -->
  <section class="about-section" id="ubytovani">
    <div class="about-inner">
      <div class="about-content" data-anim="right">
        <h2 class="about-title" id="o-nas" data-anim="up">Klid Jizerských hor, do kterého se budete rádi vracet</h2>
        <div class="about-text" data-anim="up">
          <p>Hotel U Můstků najdete ukrytý v tichém údolí nad Desnou. Pod okny šumí splav Bílé Desné, z balkónů dohlédnete na skokanské můstky.</p>
          <p>Čeká vás poctivá domácí kuchyně a osobní přístup, díky kterému se tu budete cítit jako doma.</p>
        </div>
        <button class="btn btn-about" id="about-more-btn" data-anim="up">Nabídka pokojů</button>
      </div>
      
      <div class="about-img-top" data-anim="left">
        <img src="${aboutTopSrc}" alt="Vyhlídka ze skokanských můstků" loading="eager" fetchpriority="high">
      </div>

      <div class="about-img-bottom" data-anim="left">
        <img src="${aboutBottomSrc}" alt="Hotel u Můstku budova" loading="lazy" decoding="async">
      </div>

      <div class="about-shadow-decor">
        <img src="/Decoration/list_shadow.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

  ${getPromoHTML()}
  <section class="panoramic-section" id="galerie">
    <img src="${panoramicSrc}" alt="Zahrada a terasa Hotelu u Můstku" class="panoramic-img" loading="lazy" decoding="async">
  </section>
  ${getServicesHTML()}
  ${getReviewsHTML()}
  ${getFeaturesHTML()}
  ${getSurroundingsHTML('home-surroundings-section')}
  <section class="cta-section" ${ctaStyle ? `style="${ctaStyle}"` : ''}>
    <div class="cta-overlay"></div>
    <div class="cta-inner">
      <h2 class="cta-title">Dopřejte si zasloužený<br>odpočinek v Jizerských horách</h2>
      <button class="btn btn-cta" id="cta-booking-btn">Rezervovat pobyt</button>
    </div>
  </section>
  ${getFooterHTML()}
`;
};

// Render Funkce Pro Stránku "Nabídka Pokojů" (Ubytování)
// Render Funkce Pro Stránku "Nabídka Pokojů" (Ubytování)
const getRoomsPageHTML = () => `
  <!-- 1. HERO SEKCE POKOJŮ -->
  <section class="hero-section rooms-hero-section room-detail-hero" id="uvod-pokoje">
    <img class="hero-rooms-poster" src="/nabidka-pokoju.webp" alt="Nabídka pokojů Hotel u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <div class="room-detail-hero-center">
        <h1 class="hero-title room-detail-hero-title">
          <span class="desktop-title-text">Ubytování v Jizerských horách — pokoje hotelu U Můstků</span>
          <span class="mobile-tablet-title-text">Ubytování v Jizerských horách — pokoje hotelu U Můstků</span>
        </h1>
        <p class="room-detail-hero-subtitle">
          <span class="desktop-sub-text">Prohlédněte si nabídku našich pokojů a vyberte si ten správný pro pobyt v Jizerských horách.</span>
          <span class="mobile-sub-text">Vyberte si ten správný pokoj v Jizerských horách</span>
        </p>
        <button class="btn btn-booking room-detail-hero-btn" id="btn-show-rooms-offer">Zobrazit nabídku</button>
      </div>

      <!-- Spodní šipka dolů (pouze mobil) -->
      <div class="scroll-down-btn mobile-only-scroll-btn" id="scroll-btn-pokoje">
        <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
        </svg>
      </div>
    </div>
  </section>

  <!-- 2. DETAILY POKOJŮ (SPECS SEKCE - 14 POLOŽEK) -->
  <section class="room-specs-section" id="detaily-pokoju">
    <div class="room-specs-inner">
      <h2 class="room-specs-main-title" data-anim="up">Detaily Pokojů</h2>

      <div class="room-specs-grid">
        <!-- Levý sloupec: Seznam parametrů -->
        <div class="room-specs-content">
          <ul class="room-specs-list" data-anim-group>
            <!-- 1. Max. počet osob -->
            <li class="room-spec-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/group.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Max. počet osob:</strong> 4 dospělé osoby</span>
              </div>
            </li>

            <!-- 2. 2 postele -->
            <li class="room-spec-item spec-item-with-subtext" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/double-bed.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>2 postele</strong> v každém pokoji</span>
                <p class="spec-subtext">s možností až dvou přistýlek<br>a dětskou postýlkou na vyžádání</p>
              </div>
            </li>

            <!-- 3. Dětská postýlka -->
            <li class="room-spec-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/cot.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Možnost zapůjčení</strong> dětské postýlky</span>
              </div>
            </li>

            <!-- 4. Vytápění je ústřední -->
            <li class="room-spec-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/air.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Vytápění</strong> je ústřední</span>
              </div>
            </li>

            <!-- 5. Wi-Fi zdarma -->
            <li class="room-spec-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/wifi.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Wi-Fi</strong> zdarma</span>
              </div>
            </li>

            <!-- 6. Máte mazlíčka? -->
            <li class="room-spec-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/pawprint.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Máte mazlíčka?</strong> <a href="#vyhody-ubytovani" class="spec-link" id="link-pet-more">Zjistit více <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1L5 5L9 1"/></svg></a></span>
              </div>
            </li>

            <!-- EXTENZE DETAILŮ (Zobrazí se plynule po kliknutí na Přečíst více) -->
            <!-- 7. Vlastní koupelna -->
            <li class="room-spec-item spec-extra-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/bathroom.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Vlastní koupelna:</strong> WC a sprchový kout</span>
              </div>
            </li>

            <!-- 8. TV na pokoji -->
            <li class="room-spec-item spec-extra-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/television.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>TV</strong> na pokoji</span>
              </div>
            </li>

            <!-- 9. Nekuřácké prostředí -->
            <li class="room-spec-item spec-extra-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/no-smoking.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Nekuřácké</strong> prostředí</span>
              </div>
            </li>

            <!-- 10. Zakázkové povlečení -->
            <li class="room-spec-item spec-extra-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/folding.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Zakázkové</strong> povlečení</span>
              </div>
            </li>

            <!-- 11. Ručníky -->
            <li class="room-spec-item spec-extra-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/towel.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Ručníky</strong></span>
              </div>
            </li>

            <!-- 12. Minibar -->
            <li class="room-spec-item spec-extra-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/mini.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Minibar:</strong> chladnička</span>
              </div>
            </li>

            <!-- 13. Šatní skříň -->
            <li class="room-spec-item spec-extra-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/wardrobe.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Šatní skříň</strong> v předsíni</span>
              </div>
            </li>

            <!-- 14. Fén -->
            <li class="room-spec-item spec-extra-item" data-anim="up">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/hair-dryer.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Fén</strong> na vyžádání</span>
              </div>
            </li>
          </ul>

          <div class="room-specs-buttons">
            <button class="btn btn-booking btn-specs-primary" id="btn-specs-to-breakdown">Nabídka pokojů</button>
            <button class="btn btn-specs-secondary" id="btn-specs-more">Přečíst více</button>
          </div>
        </div>

        <!-- Pravý sloupec: Fotka pokoje -->
        <div class="room-specs-image-wrap" data-anim="right">
          <img src="/hezky pokoj 1.webp" alt="Detaily Pokojů v Hotelu u Můstku" loading="eager" fetchpriority="high" decoding="async">
        </div>
      </div>
    </div>
  </section>

  <!-- 3. PANORAMATICKÝ BANNER POKOJE -->
  <section class="room-banner-section">
    <div class="room-banner-overlay"></div>
    <div class="room-banner-inner" data-anim="fade">
      <p class="room-banner-text">Pokoje hotelu U Můstků nabízejí útulné a pohodlné ubytování.<br>Disponují vlastním balkónem či terasou s výhledem.</p>
    </div>
  </section>

  <!-- 4. ROZDĚLENÍ POKOJŮ (VŠECH 12 POKOJŮ VE 2 SKUPINÁCH) -->
  <section class="room-breakdown-section" id="rozdeleni-pokoju">
    <div class="room-breakdown-inner">
      <div class="room-breakdown-header">
        <h2 class="room-breakdown-title" data-anim="up">Rozdělení pokojů</h2>
        <button class="btn btn-booking btn-breakdown-cta">Rezervovat pobyt</button>
      </div>

      <div class="room-breakdown-list" data-anim-group>
        <!-- SKUPINA 1: POKOJE V PŘÍZEMÍ -->
        <h3 class="room-group-label" data-anim="up">Pokoje v přízemí</h3>
        ${renderRoomBreakdownItem('p3', 'Pokoj 1 - Turistický', 'standard', 700)}
        ${renderRoomBreakdownItem('p2', 'Pokoj 2 - Turistický', 'standard', 700)}
        ${renderRoomBreakdownItem('p1', 'Pokoj 3 - Turistický', 'standard', 700)}
        ${renderRoomBreakdownItem('pa', 'Pokoj 4 - Nadstandard - Mahagon', 'nadstandard', 890)}
        ${renderRoomBreakdownItem('p5', 'Pokoj 5 - Standard', 'standard', 700)}
        ${renderRoomBreakdownItem('p6', 'Pokoj 6 - Standard', 'standard', 700)}

        <!-- SKUPINA 2: POKOJE V PATŘE -->
        <h3 class="room-group-label" data-anim="up">Pokoje v patře</h3>
        ${renderRoomBreakdownItem('p7', 'Pokoj 7 - Standard', 'standard', 700)}
        ${renderRoomBreakdownItem('a1', 'Pokoj 8 - Nadstandard - Motýl', 'nadstandard', 890)}
        ${renderRoomBreakdownItem('zen', 'Pokoj 9 - Nadstandard - Zen', 'nadstandard', 890)}
        ${renderRoomBreakdownItem('p10', 'Pokoj 10 - Standard', 'standard', 700)}
        ${renderRoomBreakdownItem('p11', 'Pokoj 11 - Standard', 'standard', 700)}
        ${renderRoomBreakdownItem('p12', 'Pokoj 12 - Standard', 'standard', 700)}
      </div>

      <p class="room-breakdown-footer-note">Nejkratší pobyt jsou 2 noci. O svátcích (26. 12. – 2. 1.) přijímáme pobyty nejméně na 3 noci.</p>
    </div>
  </section>

  <!-- 5. RECENZE HOSTŮ -->
  ${getReviewsHTML()}

  <!-- 6. STRAVOVÁNÍ V HOTELU -->
  <section class="room-detail-dining-section">
    <div class="room-detail-dining-inner">
      <h2 class="room-detail-dining-title" data-anim="up">Jak je to se stravováním?</h2>

      <div class="services-cards-wrap" data-anim-group>
        <!-- Karta 1: Snídaně -->
        <div class="service-card service-card-left" data-anim="up">
          <div class="service-card-img-wrap" data-anim="left">
            <img src="/Uvodni stranka/stravovani.webp" alt="Snídaně v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="service-card-body" data-anim="right">
            <h3 class="service-card-title">Snídaně</h3>
            <div class="service-card-desc-wrap">
              <p class="service-card-desc">
                <span class="desktop-sub-text">Snídaně se podávají formou bohatého švédského stolu v naší útulné jídelně. Těšit se můžete na čerstvé pečivo, sýry, uzeniny, cereálie i teplý bufet — míchaná vejce a teplé uzeniny.</span>
                <span class="mobile-sub-text">V ceně ubytování se podává formou švédských stolů od 8:00 do 9:00 hod.</span>
              </p>
              <button class="btn btn-booking btn-dining-more desktop-dining-btn">Zjistit více o stravování</button>
            </div>
          </div>
        </div>

        <!-- Karta 2: Polopenze (Večeře) -->
        <div class="service-card service-card-right" data-anim="up">
          <div class="service-card-img-wrap" data-anim="left">
            <img src="/Polopenze vecere.webp" alt="Polopenze v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="service-card-body" data-anim="right">
            <h3 class="service-card-title">Polopenze (Večeře)</h3>
            <div class="service-card-desc-wrap">
              <p class="service-card-desc">
                <span class="desktop-sub-text">Domácí dvouchodové večeře (polévka a hlavní chod) připravované z poctivých surovin podle tradičních receptů české i mezinárodní kuchyně.</span>
                <span class="mobile-sub-text">+195 Kč / osoba / noc - ryze domácí česká kuchyně, jednotné 2chodové menu bez možnosti výběru, podávané od 18:00 do 18:30 hod.</span>
              </p>
              <button class="btn btn-booking btn-dining-more mobile-dining-btn">Zjistit více o stravování</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 7. VÝHODY UBYTOVÁNÍ U NÁS -->
  <section class="room-detail-features-section" id="vyhody-ubytovani">
    <div class="room-detail-features-inner">
      <h2 class="room-detail-features-title" data-anim="up">Výhody ubytování u nás</h2>

      <div class="room-features-cards-grid" data-anim-group>
        <div class="room-feature-card" data-anim="up">
          <div class="room-feature-img-wrap">
            <img src="/IMG_1458 1.webp" alt="Máte Mazlíčka?" loading="lazy" decoding="async">
          </div>
          <h3 class="room-feature-card-title">Máte Mazlíčka?</h3>
          <p class="room-feature-card-desc">
            <span class="desktop-sub-text">150 Kč / den hotel je i pro mazlíčky, nutné vodítko v areálu.</span>
            <span class="mobile-sub-text">150 Kč / den hotel je dog-friendly, nutné vodítko v areálu.</span>
          </p>
        </div>
        <div class="room-feature-card" data-anim="up">
          <div class="room-feature-img-wrap">
            <img src="/IMG_1437 1.webp" alt="Nabíjení Elektrokola" loading="lazy" decoding="async">
          </div>
          <h3 class="room-feature-card-title">Nabíjení Elektrokola</h3>
          <p class="room-feature-card-desc">
            <span class="desktop-sub-text">15 Kč / den - bezpečné dobíjení v uzamykatelné kolárně.</span>
            <span class="mobile-sub-text">15 Kč / den - dobíjení v kolárně pod zámkem.</span>
          </p>
        </div>
        <div class="room-feature-card" data-anim="up">
          <div class="room-feature-img-wrap">
            <img src="/desna_parkovani.webp" alt="Parkování" loading="lazy" decoding="async">
          </div>
          <h3 class="room-feature-card-title">Parkování</h3>
          <p class="room-feature-card-desc">
            <span class="desktop-sub-text">Zdarma v létě na vlastním parkovišti pod kamerami.</span>
            <span class="mobile-sub-text">Zdarma na vlastním parkovišti.</span>
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- 8. PODMÍNKY UBYTOVÁNÍ -->
  <section class="room-terms-section">
    <div class="room-terms-inner">
      <div class="room-terms-content-wrap">
        <!-- Levý blok: Storno podmínky (Tabulka) -->
        <div class="storno-table-container" data-anim-group>
          <!-- Řádek 1 -->
          <div class="storno-table-row" data-anim="up">
            <div class="storno-label-group">
              <span class="storno-time-label">Více než 3 dny před příjezdem:</span>
            </div>
            <div class="storno-fee-group">
              <span class="storno-fee-val">Zdarma</span>
              <span class="storno-fee-sub">bez storno poplatku</span>
            </div>
          </div>

          <!-- Řádek 2 -->
          <div class="storno-table-row" data-anim="up">
            <div class="storno-label-group">
              <span class="storno-time-label">Méně než 3 dny před příjezdem:</span>
              <span class="storno-time-sub">(nebo nedojezd)</span>
            </div>
            <div class="storno-fee-group">
              <span class="storno-fee-val">100 %</span>
              <span class="storno-fee-sub">z celkové ceny pobytu</span>
            </div>
          </div>
        </div>

        <!-- Pravý blok: Tlačítko & Check-in / Check-out -->
        <div class="room-terms-right-side">
          <button class="btn btn-booking btn-terms-cta" data-anim="up">Rezervovat pobyt</button>

          <div class="check-times-container" data-anim-group>
            <!-- Check-in -->
            <div class="check-time-item" data-anim="up">
              <div class="check-icon-wrap">
                <img src="/Icons/Ikony/arrival.png" alt="Příjezd (Check-in)" width="28" height="28">
              </div>
              <span class="check-text-label"><strong>Příjezd (Check-in):</strong> od 15:00 hod.</span>
            </div>

            <!-- Check-out -->
            <div class="check-time-item" data-anim="up">
              <div class="check-icon-wrap">
                <img src="/Icons/Ikony/tourist.png" alt="Odjezd (Check-out)" width="28" height="28">
              </div>
              <span class="check-text-label"><strong>Odjezd (Check-out):</strong> do 10:00 hod.</span>
            </div>
          </div>
        </div>
      </div>

      <p class="room-terms-footer-note">V případě nečekaných událostí se s námi spojte – po dohodě vám rádi flexibilně přesuneme termín pobytu na jindy.</p>
    </div>
  </section>

  <!-- 9. CTA SEKCE -->
  ${getCtaHTML()}

  <!-- 10. FOOTER -->
  ${getFooterHTML()}
`;



export function closePromoCodeModal() {
  const modalOverlay = document.getElementById('promo-code-modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
}

export function openPromoCodeModal() {
  let modalOverlay = document.getElementById('promo-code-modal-overlay');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'promo-code-modal-overlay';
    modalOverlay.className = 'promo-code-modal-overlay';
    document.body.appendChild(modalOverlay);
  }

  modalOverlay.innerHTML = `
    <div class="promo-code-modal-card">
      <button type="button" class="btn-close-promo-modal" style="position: absolute; top: 14px; right: 16px; background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
      
      <div class="promo-modal-title-wrap">
        <h3 class="promo-modal-title">Jak získat slevu 5 %?</h3>
        <p class="promo-modal-desc">
          Rezervací přímo na našem webu získáte slevu <strong>5 %</strong> na celý pobyt. Použijte níže uvedený slevový kód v rezervačním formuláři.
        </p>
      </div>

      <div class="promo-code-display-box">
        <div style="text-align: left;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #777; letter-spacing: 0.05em; margin-bottom: 2px;">Váš slevový kód:</div>
          <div class="promo-code-val">POBYT5</div>
        </div>
        <button type="button" class="btn-copy-promo-action">
          Zkopírovat kód
        </button>
      </div>

      <div style="border-top: 1px solid #e0dfd5; margin: 20px 0;"></div>

      <div class="promo-modal-actions">
        <button type="button" class="btn-promo-action-main btn-promo-goto-booking">
          Rezervovat pobyt
        </button>
        <button type="button" class="btn-promo-action-secondary btn-promo-goto-rooms">
          Nabídka pokojů
        </button>
      </div>
    </div>
  `;

  modalOverlay.style.display = 'flex';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');

  const btnClose = modalOverlay.querySelector('.btn-close-promo-modal');
  if (btnClose) {
    btnClose.addEventListener('click', closePromoCodeModal);
  }

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closePromoCodeModal();
  });

  const btnCopy = modalOverlay.querySelector('.btn-copy-promo-action');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText('POBYT5').then(() => {
        btnCopy.innerHTML = `Zkopírováno!`;
        btnCopy.style.background = '#4a5a24';
        btnCopy.style.color = '#ffffff';
        setTimeout(() => {
          btnCopy.innerHTML = `Zkopírovat kód`;
          btnCopy.style.background = '#ffffff';
          btnCopy.style.color = '#4a5a24';
        }, 2500);
      }).catch(err => {
        console.error('Clipboard copy failed:', err);
      });
    });
  }

  const btnGotoBooking = modalOverlay.querySelector('.btn-promo-goto-booking');
  if (btnGotoBooking) {
    btnGotoBooking.addEventListener('click', () => {
      closePromoCodeModal();
      window.location.hash = '#rezervace';
    });
  }

  const btnGotoRooms = modalOverlay.querySelector('.btn-promo-goto-rooms');
  if (btnGotoRooms) {
    btnGotoRooms.addEventListener('click', () => {
      closePromoCodeModal();
      window.location.hash = '#pokoje';
    });
  }
}
window.openPromoCodeModal = openPromoCodeModal;
window.closePromoCodeModal = closePromoCodeModal;

// Sezónní Režim (Léto / Zima) - Prioritní načítání aktivního režimu
export function getInitialSeasonMode() {
  const savedMode = localStorage.getItem('hotel_season_mode');
  if (savedMode === 'summer' || savedMode === 'winter') {
    return savedMode;
  }
  const month = new Date().getMonth(); // 0 = Jan, 3 = Apr, 9 = Oct, 10 = Nov
  if (month >= 3 && month <= 9) {
    return 'summer'; // Duben až Říjen
  }
  return 'winter'; // Listopad až Březen
}

/**
 * Spustí úvodní video, ale až když už nikomu nepřekáží.
 *
 * Má 4,7 MB. S atributem `autoplay` si ho prohlížeč stahoval hned při
 * načtení stránky (autoplay přebíjí `preload="none"`) a na mobilním
 * připojení tím zdržel dotazy do databáze — obsazenost v kalendáři pak
 * naskočila i po několika vteřinách. Proto:
 *   • na úzkých displejích a při úsporném nebo pomalém připojení se video
 *     nestahuje vůbec a zůstane úvodní fotka,
 *   • jinak se pouští až po dokončení načtení stránky.
 */
export function spustHeroVideo() {
  const video = document.querySelector('.hero-video[data-hero-video]');
  if (!video || video.dataset.spusteno === '1') return;

  const zdroj = video.querySelector('source[data-src]');
  if (!zdroj) {
    // Zdroj už je nastavený z dřívějška, stačí přehrát.
    video.play().catch(() => { });
    return;
  }

  const nastartuj = () => {
    if (video.dataset.spusteno === '1') return;

    // Rozhoduje se až tady, ne při volání funkce: při prvním průchodu ještě
    // nemusí být hotové rozvržení a innerWidth vrací 0, což by video vypnulo
    // i na velké obrazovce. Nula proto znamená „nevím“, ne mobil.
    const sirka = window.innerWidth || document.documentElement.clientWidth || 0;
    const sit = navigator.connection || {};
    const jeUzky = sirka > 0 && sirka < 768;

    // Odhad rychlosti se bere vážně jen na úzkém displeji. Chrome hlásí
    // hned po startu „3g“ i na optice, dokud si připojení nepřeměří —
    // a video se pak na počítači nepustilo vůbec. Majitel to popisoval
    // jako „dva dny po sobě se mi nenačetlo“. Opravdu pomalé připojení
    // (2g) a zapnutý úsporný režim video vypínají pořád.
    const opravduPomale = ['slow-2g', '2g'].includes(sit.effectiveType);
    const odhademPomale = sit.effectiveType === '3g';
    if (jeUzky || Boolean(sit.saveData) || opravduPomale) return;
    if (odhademPomale && sirka > 0 && sirka < 1024) return;

    video.dataset.spusteno = '1';
    zdroj.src = zdroj.dataset.src;
    zdroj.removeAttribute('data-src');
    video.load();
    video.play().catch(() => { });
  };

  // setTimeout, ne requestIdleCallback — na pozadí je rAF/idle zmrazený
  // a video by se pak nespustilo vůbec.
  if (document.readyState === 'complete') {
    setTimeout(nastartuj, 400);
  } else {
    window.addEventListener('load', () => setTimeout(nastartuj, 400), { once: true });
  }
}

let deferredPreloadTimer = null;

export function scheduleInactiveSeasonPreload(activeMode) {
  if (deferredPreloadTimer) {
    clearTimeout(deferredPreloadTimer);
    deferredPreloadTimer = null;
  }

  // Odložený background preload neaktivního režimu až za 4 sekundy po načtení primární stránky
  deferredPreloadTimer = setTimeout(() => {
    const inactiveImages = activeMode === 'summer' ? [
      '/Zimni rezim/Zima - hotel.webp',
      '/Zimni rezim/Zima - prijezdova fotka.webp',
      '/Zimni rezim/Zime - pohled zezadu.webp',
      '/Zimni rezim/Zima - zadni vchod.webp',
      '/Zimni rezim/tanvaldsky spicak.webp'
    ] : [
      '/Uvodni stranka/Vyhled z balkonu na skokanky.webp',
      '/Uvodni stranka/Pohled na hotel ze z predni strany.webp',
      '/Uvodni stranka/Fotka Zahrady a Terasy.webp'
    ];

    inactiveImages.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, 4000);
}

export function setSeasonMode(mode, savePreference = true) {
  if (savePreference) {
    localStorage.setItem('hotel_season_mode', mode);
  }

  window.currentSeasonMode = mode;

  if (mode === 'winter') {
    document.documentElement.classList.add('season-winter');
    document.documentElement.classList.remove('season-summer');
  } else {
    document.documentElement.classList.add('season-summer');
    document.documentElement.classList.remove('season-winter');
  }

  // Zrušení předchozího neaktivního načítání při manuálním přepnutí uživatele
  if (deferredPreloadTimer) {
    clearTimeout(deferredPreloadTimer);
    deferredPreloadTimer = null;
  }

  // 1. Změna Hero Sekce (STRIKTNĚ POUZE PRO ÚVODNÍ STRÁNKU #uvod)
  const homeHeroSection = document.querySelector('.hero-section#uvod, .home-hero-section');

  // Odstranění zbloudilých prvků videa a plákátů ze VŠECH podstránek
  document.querySelectorAll('.hero-section:not(#uvod) .hero-video, .hero-section:not(#uvod) .hero-summer-poster, .hero-section:not(#uvod) .hero-winter-img').forEach(el => el.remove());

  if (homeHeroSection) {
    let heroVideo = homeHeroSection.querySelector('.hero-video');
    let heroSummerPoster = homeHeroSection.querySelector('.hero-summer-poster');
    let heroWinterImg = homeHeroSection.querySelector('.hero-winter-img');

    if (mode === 'winter') {
      if (heroVideo) {
        heroVideo.pause();
        heroVideo.style.display = 'none';
      }
      if (heroSummerPoster) {
        heroSummerPoster.style.display = 'none';
      }
      if (!heroWinterImg) {
        heroWinterImg = document.createElement('img');
        heroWinterImg.className = 'hero-winter-img';
        heroWinterImg.alt = 'Hotel u Můstku v zimě';
        heroWinterImg.setAttribute('fetchpriority', 'high');
        heroWinterImg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;';
        heroWinterImg.src = '/Zimni rezim/Zima - hotel.webp';
        homeHeroSection.insertBefore(heroWinterImg, homeHeroSection.firstChild);
      } else {
        heroWinterImg.style.display = 'block';
      }
    } else {
      if (heroWinterImg) {
        heroWinterImg.style.display = 'none';
      }
      if (!heroSummerPoster) {
        heroSummerPoster = document.createElement('img');
        heroSummerPoster.className = 'hero-summer-poster';
        heroSummerPoster.alt = 'Hotel u Můstku';
        heroSummerPoster.setAttribute('fetchpriority', 'high');
        heroSummerPoster.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;';
        heroSummerPoster.src = '/uvodni_hero_sekce.webp';
        homeHeroSection.insertBefore(heroSummerPoster, homeHeroSection.firstChild);
      } else {
        heroSummerPoster.style.display = 'block';
      }
      if (!heroVideo) {
        heroVideo = document.createElement('video');
        heroVideo.className = 'hero-video';
        heroVideo.muted = true;
        heroVideo.loop = true;
        heroVideo.playsInline = true;
        heroVideo.preload = 'none';
        heroVideo.setAttribute('data-hero-video', '');
        heroVideo.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; background: transparent;';
        heroVideo.innerHTML = `
          <source data-src="/hotel_hero_video.mp4" type="video/mp4">
        `;
        homeHeroSection.insertBefore(heroVideo, homeHeroSection.firstChild);
      } else {
        heroVideo.style.display = 'block';
      }
      spustHeroVideo();
    }
  }

  // 2. Sekce Zázemí (O nás pouze na úvodní stránce, ať se nepřepisují fotky v sekci Celý hotel na /akce)
  const homeAboutSection = document.querySelector('.about-section:not(.events-about-section)');
  const aboutTopImg = homeAboutSection ? homeAboutSection.querySelector('.about-img-top img') : null;
  const aboutBottomImg = homeAboutSection ? homeAboutSection.querySelector('.about-img-bottom img') : null;
  if (aboutTopImg) {
    aboutTopImg.src = mode === 'winter'
      ? '/Zimni rezim/Zima - prijezdova fotka.webp'
      : '/Uvodni stranka/Vyhled z balkonu na skokanky.webp';
  }
  if (aboutBottomImg) {
    aboutBottomImg.src = mode === 'winter'
      ? '/Zimni rezim/Zime - pohled zezadu.webp'
      : '/Uvodni stranka/Pohled na hotel ze z predni strany.webp';
  }

  // 3. Panoramatická fotka pod sekcí Sleva (Jak získat nejvýhodnější pobyt)
  const panoramicImg = document.querySelector('.panoramic-section .panoramic-img');
  if (panoramicImg) {
    panoramicImg.src = mode === 'winter'
      ? '/rampouchy v zime.webp'
      : '/Uvodni stranka/Fotka Zahrady a Terasy.webp';
  }

  // 4. CTA Sekce
  const ctaSection = document.querySelector('.cta-section');
  if (ctaSection) {
    if (mode === 'winter') {
      ctaSection.style.backgroundImage = "linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.45)), url('/Zimni rezim/tanvaldsky spicak.webp')";
      ctaSection.style.backgroundPosition = 'center';
      ctaSection.style.backgroundSize = 'cover';
    } else {
      ctaSection.style.backgroundImage = '';
      ctaSection.style.backgroundPosition = '';
      ctaSection.style.backgroundSize = '';
    }
  }

  // 5. Aktualizace tlačítkového stavu (Léto / Zima)
  const controlItems = document.querySelectorAll('.bottom-left-controls .control-item, .mobile-season-toggle .control-item');
  controlItems.forEach((item) => {
    const text = item.textContent.trim().toLowerCase();
    if ((mode === 'summer' && text.includes('léto')) || (mode === 'winter' && text.includes('zima'))) {
      item.classList.add('is-active');
    } else {
      item.classList.remove('is-active');
    }
  });

  // Naplánování odloženého načtení neaktivního režimu
  scheduleInactiveSeasonPreload(mode);
}

window.getInitialSeasonMode = getInitialSeasonMode;
window.setSeasonMode = setSeasonMode;
window.scheduleInactiveSeasonPreload = scheduleInactiveSeasonPreload;

// Pomocná SPA navigace bez reloaded problikávání
export function navigateTo(targetUrl) {
  if (!targetUrl) return;
  const cleanUrl = targetUrl.replace(/\.html$/, '');
  const currentPathWithHash = window.location.pathname + window.location.search + window.location.hash;
  if (currentPathWithHash === cleanUrl) return;

  history.pushState(null, '', cleanUrl);
  route(false);

  // Nová stránka musí začít nahoře.
  //
  // Prohlížeč to sám neudělá — tohle není načtení stránky, ale pushState
  // uvnitř téže. Kdo si prohlédl patičku a klikl v ní na Akce nebo
  // Aktivity, zůstal na nové stránce zase dole v patičce. Na mobilu je
  // patička přes několik obrazovek, takže to vypadalo, že se odkaz vůbec
  // neprovedl.
  //
  // S kotvou v adrese se nic nepřepisuje — tam si cíl řídí odrolování sám
  // (odrolujNaSekci), a skok nahoru by mu ho vzal.
  if (!cleanUrl.includes('#')) {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    // Podruhé po vykreslení: obrázky a písma teprve dorovnávají výšku
    // dokumentu a prohlížeč umí scroll mezitím ještě posunout.
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }
}
window.navigateTo = navigateTo;

const initStickyHeader = () => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  // Ochrana proti dvojímu navěšení při překreslení stránky
  if (header.dataset.stickyInit === '1') return;
  header.dataset.stickyInit = '1';

  const heroSel = '.hero-section, .rooms-hero-section, .room-detail-hero,' +
    '.contact-hero-section, .activities-hero-section,' +
    '.dining-hero-section, .news-hero-section, .booking-hero-section';

  let lastY = window.scrollY;
  let ticking = false;

  const prepocitat = () => {
    ticking = false;
    const y = window.scrollY;
    const hero = document.querySelector(heroSel);
    const navH = header.offsetHeight;

    // BÍLÝ STAV: přepnout v polovině hero sekce (40 % výšky)
    const prah = hero ? hero.offsetHeight * 0.4 : 0;
    const podHerem = !hero || y > prah;
    header.classList.toggle('is-solid', podHerem);

    // SKRÝVÁNÍ: jen když je otevřené mobilní menu, nikdy neskrývat
    const menuOtevrene = document.querySelector('.mobile-menu-overlay.is-active');
    if (menuOtevrene) {
      header.classList.remove('is-hidden');
      lastY = y;
      return;
    }

    const rozdil = y - lastY;
    if (Math.abs(rozdil) > 6) {            // práh proti chvění
      if (rozdil > 0 && y > 200) header.classList.add('is-hidden');
      else header.classList.remove('is-hidden');
      lastY = y;
    }
    if (y < 10) header.classList.remove('is-hidden');   // nahoře vždy vidět
  };

  const naScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(prepocitat);
    }
  };

  window.addEventListener('scroll', naScroll, { passive: true });
  window.addEventListener('resize', naScroll, { passive: true });
  prepocitat();   // nastavit správný stav hned po načtení
};

// Šipka dolů v hero sekci → cílová sekce pod ní.
// Klíč je id šipky, hodnota je id sekce, kam se má odrolovat.
const SIPKY_DOLU = {
  'scroll-btn': 'ubytovani',
  'scroll-btn-pokoje': 'detaily-pokoju',
  'scroll-btn-stravovani': 'snidane',
  'scroll-btn-activities': 'aktivity-v-hotelu',
  'scroll-btn-category': 'seznam-aktivit',
  'scroll-btn-events': 'celay-hotel',
  'scroll-btn-aktuality': 'seznam-aktualit',
  'scroll-btn-kontakt': 'kontaktní-udaje',
};

const initSipkyDolu = () => {
  Object.keys(SIPKY_DOLU).forEach((idSipky) => {
    const sipka = document.getElementById(idSipky);
    if (!sipka) return;

    // Ochrana proti dvojímu navěšení při překreslení stránky
    if (sipka.dataset.sipkaInit === '1') return;
    sipka.dataset.sipkaInit = '1';

    // Je to <div>, ne <button> — doplníme přístupnost z kódu,
    // ať se nemusí sahat do jedenácti HTML souborů
    sipka.setAttribute('role', 'button');
    sipka.setAttribute('tabindex', '0');
    sipka.setAttribute('aria-label', 'Přejít na obsah stránky');

    const skoc = (e) => {
      if (e) e.preventDefault();
      const cil = document.getElementById(SIPKY_DOLU[idSipky]);
      if (!cil) return;

      // Lepící hlavička má 88–110 px a zakryla by nadpis sekce,
      // proto scrollujeme s odstupem, ne přes scrollIntoView.
      const hlavicka = document.querySelector('.site-header');
      const odstup = hlavicka ? hlavicka.offsetHeight + 12 : 100;
      const y = cil.getBoundingClientRect().top + window.pageYOffset - odstup;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    };

    sipka.addEventListener('click', skoc);
    sipka.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') skoc(e);
    });
  });
};

// Inicializace událostí a interaktivity po vykreslení
const initInteractivity = () => {
  // Aplikace sezónního režimu (Léto / Zima)
  const currentMode = getInitialSeasonMode();
  setSeasonMode(currentMode, false);
  scheduleInactiveSeasonPreload(currentMode);
  initProgressiveLazyLoading();
  initCategoryHoverPreload();
  initStickyHeader();
  initSipkyDolu();
  initScrollReveal();

  const closeMobileMenu = () => {
    const mobileOverlay = document.getElementById('mobile-menu-overlay');
    if (mobileOverlay) mobileOverlay.classList.remove('is-active');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
  };

  const openMobileMenu = () => {
    const mobileOverlay = document.getElementById('mobile-menu-overlay');
    if (mobileOverlay) mobileOverlay.classList.add('is-active');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
  };

  const seasonControls = document.querySelectorAll('.bottom-left-controls .control-item, .mobile-season-toggle .control-item');
  seasonControls.forEach(control => {
    control.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = control.textContent.trim().toLowerCase();
      const newMode = text.includes('zima') ? 'winter' : 'summer';
      setSeasonMode(newMode, true);
      closeMobileMenu();
    });
  });

  // Mobile Hamburger Drawer (Robust & Fail-safe)
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileClose = document.getElementById('mobile-menu-close');
  const mobileOverlay = document.getElementById('mobile-menu-overlay');

  if (mobileToggle && mobileOverlay) {
    mobileToggle.onclick = (e) => {
      e.stopPropagation();
      openMobileMenu();
    };
  }

  if (mobileClose) {
    mobileClose.onclick = (e) => {
      e.stopPropagation();
      closeMobileMenu();
    };
  }

  if (mobileOverlay) {
    // Close when clicking outside content (on backdrop)
    mobileOverlay.onclick = (e) => {
      if (e.target === mobileOverlay) {
        closeMobileMenu();
      }
    };

    // Close when clicking ANY link, button, or item inside mobile overlay
    mobileOverlay.querySelectorAll('a, button:not(#mobile-menu-close), .control-item').forEach(item => {
      item.onclick = () => {
        closeMobileMenu();
      };
    });
  }

  // Safety fallback: Esc key closes mobile menu & restores scroll
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
    }
  });

  // FAQ accordion se váže na dokument, a to JEDNOU ZA CELOU NÁVŠTĚVU.
  //
  // Dřív se posluchač připínal přímo na tlačítka. Jenže initInteractivity()
  // běží po každém přechodu, a na předrenderované stránce se DOM nevyměňuje,
  // takže na témže tlačítku skončily dva posluchače — klik otázku otevřel
  // a hned zase zavřel. Na produkci to bylo vidět víc než v dev serveru,
  // protože tam se statické HTML servíruje vždycky.
  if (!window.__faqNavazano) {
    window.__faqNavazano = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.faq-question-btn');
      if (!btn) return;
      e.preventDefault();
      const item = btn.closest('.faq-item');
      if (!item) return;
      const jeOtevrena = item.classList.contains('is-open');

      document.querySelectorAll('.faq-item.is-open').forEach(jina => {
        if (jina === item) return;
        jina.classList.remove('is-open');
        const jinyBtn = jina.querySelector('.faq-question-btn');
        if (jinyBtn) jinyBtn.setAttribute('aria-expanded', 'false');
      });

      item.classList.toggle('is-open', !jeOtevrena);
      btn.setAttribute('aria-expanded', String(!jeOtevrena));
    });
  }

  // Hero Video Handling (HomePage)
  const heroVideo = document.querySelector('.hero-video');
  const heroSection = document.querySelector('.hero-section#uvod, .home-hero-section');

  if (heroVideo) {
    heroVideo.playbackRate = 0.85;
    heroVideo.play().catch(() => { });

    let isHeroInView = true;

    if ('IntersectionObserver' in window && heroSection) {
      const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isHeroInView = entry.isIntersecting;
          if (isHeroInView && !document.hidden) {
            heroVideo.playbackRate = 0.85;
            heroVideo.play().catch(() => { });
          } else {
            heroVideo.pause();
          }
        });
      }, { threshold: 0.05 });
      videoObserver.observe(heroSection);
    }

    // Page Visibility API - automatické pozastavení při překliku do jiné aplikace nebo záložky
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        heroVideo.pause();
      } else if (isHeroInView) {
        heroVideo.playbackRate = 0.85;
        heroVideo.play().catch(() => { });
      }
    });
  }

  // Reviews Slider (Původní 100% funkční nekonečný slider)
  const reviewsTrack = document.getElementById('reviews-track');
  const reviewsViewport = document.getElementById('reviews-viewport');
  const prevBtn = document.getElementById('reviews-prev');
  const nextBtn = document.getElementById('reviews-next');

  if (reviewsTrack && reviewsViewport && !reviewsTrack.dataset.initialized) {
    reviewsTrack.dataset.initialized = 'true';

    // Populate approved reviews from storage
    (async () => {
      try {
        const stored = await getStoredReviews();
        const approved = (stored || []).filter(r => r.status === 'approved');
        if (approved.length > 0) {
          reviewsTrack.innerHTML = approved.map(r => `
            <div class="review-card" data-anim="up">
              <img src="/Icons/google logo.webp" alt="Google Logo" class="review-google-icon" loading="lazy" decoding="async">
              <p class="review-quote">${esc(r.text)}</p>
              <div class="review-contour-bg">
                <img src="/Decoration/hory_contour.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">
              </div>
              <div class="review-footer">
                <span class="review-author-name">${esc(r.author_name || r.full_name)}</span>
                <span class="review-date">${r.date || ''}</span>
              </div>
            </div>
          `).join('');
        }
      } catch (err) {
        console.warn('Could not load dynamic reviews:', err);
      }

      const originalCards = Array.from(reviewsTrack.children);
      const totalOriginal = originalCards.length;

      originalCards.forEach(card => {
        const cloneEnd = card.cloneNode(true);
        reviewsTrack.appendChild(cloneEnd);
      });
      originalCards.forEach(card => {
        const cloneStart = card.cloneNode(true);
        reviewsTrack.insertBefore(cloneStart, reviewsTrack.firstChild);
      });

      initScrollReveal();

      const allCards = Array.from(reviewsTrack.children);
      let currentIndex = totalOriginal;

      const getCardStep = () => {
        const firstCard = allCards[0];
        const cardWidth = firstCard ? firstCard.offsetWidth : 380;
        const style = window.getComputedStyle(reviewsTrack);
        const gap = parseFloat(style.gap) || 24;
        return cardWidth + gap;
      };

      const updatePosition = (animated = true) => {
        const step = getCardStep();
        if (animated) {
          reviewsTrack.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
        } else {
          reviewsTrack.style.transition = 'none';
        }
        reviewsTrack.style.transform = `translateX(-${currentIndex * step}px)`;
      };

      const syncReviewCardsHeight = () => {
        allCards.forEach(c => c.style.height = 'auto');
        let maxHeight = 0;
        allCards.forEach(c => {
          if (c.offsetHeight > maxHeight) maxHeight = c.offsetHeight;
        });
        if (maxHeight > 0) {
          const finalHeight = maxHeight + 28;
          allCards.forEach(c => c.style.height = `${finalHeight}px`);
        }
      };

      syncReviewCardsHeight();
      updatePosition(false);

      window.addEventListener('resize', () => {
        syncReviewCardsHeight();
        updatePosition(false);
      });

      const checkBoundary = () => {
        if (currentIndex >= totalOriginal * 2) {
          currentIndex = totalOriginal;
          updatePosition(false);
        } else if (currentIndex < totalOriginal) {
          currentIndex = totalOriginal * 2 - 1;
          updatePosition(false);
        }
      };

      reviewsTrack.addEventListener('transitionend', checkBoundary);

      if (nextBtn) nextBtn.addEventListener('click', () => { currentIndex++; updatePosition(true); });
      if (prevBtn) prevBtn.addEventListener('click', () => { currentIndex--; updatePosition(true); });

      let startX = 0;
      let startY = 0;
      let isDragging = false;

      reviewsViewport.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = true;
      }, { passive: true });

      reviewsViewport.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const deltaX = startX - e.changedTouches[0].clientX;
        const deltaY = startY - e.changedTouches[0].clientY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
          if (deltaX > 0) {
            currentIndex++;
          } else {
            currentIndex--;
          }
          updatePosition(true);
        }
      }, { passive: true });

      reviewsViewport.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startY = e.clientY;
        isDragging = true;
      });

      reviewsViewport.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const deltaX = startX - e.clientX;
        const deltaY = startY - e.clientY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
          if (deltaX > 0) {
            currentIndex++;
          } else {
            currentIndex--;
          }
          updatePosition(true);
        }
      });

      reviewsViewport.addEventListener('mouseleave', () => {
        isDragging = false;
      });
    })();
  }

  // REVIEW MODAL & FORM HANDLERS (AUTOMATIC INJECTION & DELEGATION)
  // Clean up any duplicate modal overlays if present
  const allOverlays = document.querySelectorAll('#add-review-modal-overlay, .review-modal-overlay');
  allOverlays.forEach((el, idx) => {
    if (idx > 0) el.remove();
  });

  let modalOverlay = document.getElementById('add-review-modal-overlay');

  // If modal overlay is missing from DOM on any page, dynamically inject it into body
  if (!modalOverlay) {
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = `
      <div class="review-modal-overlay" id="add-review-modal-overlay" aria-hidden="true">
        <div class="review-modal-card">
          <div class="review-modal-header">
            <h3 class="review-modal-title">Přidat novou recenzi</h3>
            <button type="button" class="review-modal-close" id="btn-close-review-modal" aria-label="Zavřít">&times;</button>
          </div>

          <form id="add-review-form" class="review-modal-form" novalidate>
            <div class="review-modal-body">
              <!-- O schvalování recepcí se hostovi schválně nepíše. Kontrola
                   slouží jen na vulgarity a spam, ale zmínka o schvalování
                   budí dojem, že si hotel vybírá jen pochvalné recenze. -->
              <p class="review-modal-subtitle">
                Vaše zkušenost pomůže ostatním hostům při výběru ubytování. Napište klidně i to, co se vám nelíbilo — pomůže nám to zlepšit se.
              </p>

              <div id="review-modal-alert-area"></div>

              <div style="display:none;" aria-hidden="true">
                <input type="text" id="hp-review-field" tabindex="-1" autocomplete="off">
              </div>

              <div class="form-field" id="field-wrap-review-name">
                <label for="review-fullname-input" class="form-label">Jméno a Příjmení <span class="required" style="color: #c62828;">*</span></label>
                <input type="text" id="review-fullname-input" class="form-input" placeholder="např. Jan Novák" required>
                <small class="form-hint" style="font-size: 12.5px; color: #666660; margin-top: 5px; display: block;">
                  🔒 <strong>Ochrana soukromí (GDPR):</strong> Vaše příjmení bude po odeslání automaticky zkráceno na počáteční písmeno (např. <em>Jan N.</em>).
                </small>
              </div>

              <div class="form-field" id="field-wrap-review-text" style="margin-top: 16px;">
                <label for="review-text-input" class="form-label">Text vaší recenze <span class="required" style="color: #c62828;">*</span></label>
                <textarea id="review-text-input" class="form-textarea" rows="4" maxlength="500" placeholder="Napište, jak se vám u nás líbilo, jak vám chutnala snídaně či jak hodnotíte čistotu a personál..." required></textarea>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 12.5px; color: #666660;">
                  <span id="review-text-hint">Minimálně 15 znaků, maximálně 500 znaků (cca 80 slov).</span>
                  <span id="review-text-count" style="font-weight: 600;">0 / 500</span>
                </div>
              </div>
            </div>

            <div class="review-modal-footer">
              <button type="button" class="btn btn-specs-secondary" id="btn-cancel-review-modal">Zrušit</button>
              <button type="submit" class="btn btn-booking-submit" id="btn-submit-review">
                <span>Odeslat recenzi →</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modalContainer.firstElementChild);
    modalOverlay = document.getElementById('add-review-modal-overlay');
  }

  // Ensure button exists inside .reviews-nav-controls on any page
  const navControls = document.querySelector('.reviews-nav-controls');
  if (navControls && !navControls.querySelector('#btn-open-review-modal')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-add-review';
    btn.id = 'btn-open-review-modal';
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
      </svg>
      <span>Napsat recenzi</span>
    `;
    navControls.appendChild(btn);
  }

  const closeModalBtn = document.getElementById('btn-close-review-modal');
  const cancelModalBtn = document.getElementById('btn-cancel-review-modal');
  const reviewForm = document.getElementById('add-review-form');
  const reviewTextInput = document.getElementById('review-text-input');
  const reviewTextCount = document.getElementById('review-text-count');

  if (reviewTextInput && reviewTextCount) {
    reviewTextInput.addEventListener('input', () => {
      const len = reviewTextInput.value.length;
      reviewTextCount.textContent = `${len} / 500`;
      if (len > 500) {
        reviewTextCount.style.color = '#c62828';
      } else if (len < 15 && len > 0) {
        reviewTextCount.style.color = '#d84315';
      } else {
        reviewTextCount.style.color = '#4A5A24';
      }
    });
  }

  const toggleReviewModal = (show) => {
    const activeOverlay = document.getElementById('add-review-modal-overlay');
    if (!activeOverlay) return;
    if (show) {
      activeOverlay.classList.add('is-open');
      activeOverlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    } else {
      activeOverlay.classList.remove('is-open');
      activeOverlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (reviewForm) reviewForm.reset();
      if (reviewTextCount) {
        reviewTextCount.textContent = '0 / 500';
        reviewTextCount.style.color = '#666660';
      }
      const alertArea = document.getElementById('review-modal-alert-area');
      if (alertArea) alertArea.innerHTML = '';
      // Po zavření se poděkování uklidí a formulář se zase odkryje,
      // ať jde napsat další recenzi bez obnovení stránky.
      if (reviewForm) {
        reviewForm.querySelectorAll('.review-success-wrapper').forEach(el => el.remove());
        const telo = reviewForm.querySelector('.review-modal-body');
        const pata = reviewForm.querySelector('.review-modal-footer');
        if (telo) telo.hidden = false;
        if (pata) pata.hidden = false;
      }
      const submitBtn = document.getElementById('btn-submit-review');
      if (submitBtn) {
        submitBtn.disabled = false;
        delete submitBtn.dataset.hasSubmitted;
        submitBtn.style.opacity = '';
        submitBtn.style.cursor = '';
        submitBtn.innerHTML = '<span>Odeslat recenzi →</span>';
      }
      if (reviewForm) {
        reviewForm.dataset.isSubmitting = 'false';
      }
    }
  };

  // Delegate click for opening modal on any page/button — attached ONLY ONCE
  if (!window._reviewModalClickListening) {
    window._reviewModalClickListening = true;
    document.body.addEventListener('click', (e) => {
      const trigger = e.target.closest('#btn-open-review-modal, .btn-add-review');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        toggleReviewModal(true);
      }
    });
  }

  if (closeModalBtn) closeModalBtn.onclick = () => toggleReviewModal(false);
  if (cancelModalBtn) cancelModalBtn.onclick = () => toggleReviewModal(false);
  if (modalOverlay) {
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) toggleReviewModal(false);
    };
  }

  if (reviewForm && !reviewForm.dataset.submitInit) {
    reviewForm.dataset.submitInit = '1';
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertArea = document.getElementById('review-modal-alert-area');
      const submitBtn = document.getElementById('btn-submit-review');

      // Tlačítko ve stavu "Napsat novou recenzi" → resetovat formulář a zprávy pro novou recenzi
      if (submitBtn && submitBtn.dataset.hasSubmitted === 'true') {
        delete submitBtn.dataset.hasSubmitted;
        if (reviewForm) reviewForm.reset();
        if (reviewTextCount) {
          reviewTextCount.textContent = '0 / 500';
          reviewTextCount.style.color = '#666660';
        }
        if (alertArea) alertArea.innerHTML = '';
        submitBtn.innerHTML = '<span>Odeslat recenzi →</span>';
        reviewForm.dataset.isSubmitting = 'false';
        const nameInput = document.getElementById('review-fullname-input');
        if (nameInput) nameInput.focus();
        return;
      }

      if (reviewForm.dataset.isSubmitting === 'true') return;
      reviewForm.dataset.isSubmitting = 'true';

      const hpField = document.getElementById('hp-review-field');
      if (hpField && hpField.value) {
        reviewForm.dataset.isSubmitting = 'false';
        return; // Anti-spam
      }

      const nameInput = document.getElementById('review-fullname-input');
      const textInput = document.getElementById('review-text-input');

      const fullName = (nameInput ? nameInput.value : '').trim();
      const text = (textInput ? textInput.value : '').trim();

      if (!fullName || !text) {
        if (alertArea) {
          alertArea.innerHTML = `
            <div style="background-color: #fbe9e7; color: #c62828; padding: 12px 16px; border-radius: 4px; font-size: 14px; margin-bottom: 16px;">
              ⚠️ Prosíme vyplňte vaše jméno a text recenze.
            </div>
          `;
        }
        reviewForm.dataset.isSubmitting = 'false';
        return;
      }

      if (text.length < 15) {
        if (alertArea) {
          alertArea.innerHTML = `
            <div style="background-color: #fbe9e7; color: #c62828; padding: 12px 16px; border-radius: 4px; font-size: 14px; margin-bottom: 16px;">
              ⚠️ Text recenze musí mít alespoň 15 znaků.
            </div>
          `;
        }
        reviewForm.dataset.isSubmitting = 'false';
        return;
      }

      if (text.length > 500) {
        if (alertArea) {
          alertArea.innerHTML = `
            <div style="background-color: #fbe9e7; color: #c62828; padding: 12px 16px; border-radius: 4px; font-size: 14px; margin-bottom: 16px;">
              ⚠️ Text recenze je příliš dlouhý. Maximální povolená délka je 500 znaků (cca 80 slov).
            </div>
          `;
        }
        reviewForm.dataset.isSubmitting = 'false';
        return;
      }

      const gdprName = formatGDPRName(fullName);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.75';
        submitBtn.style.cursor = 'wait';
        submitBtn.innerHTML = `
          <svg style="animation: review-spin 0.8s linear infinite; width: 16px; height: 16px; margin-right: 8px; vertical-align: middle; display: inline-block;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <span>Odesílám recenzi...</span>
        `;
      }

      const reviewRecord = {
        full_name: fullName,
        author_name: gdprName,
        text: text,
        status: 'pending_approval'
      };

      try {
        await saveStoredReview(reviewRecord);
      } catch (saveErr) {
        console.error('Error saving review to store/DB:', saveErr);
      }

      // Upozornění na novou recenzi — zatím na soukromou adresu majitele.
      try {
        const emailTemplate = generateEmailNewReviewNotification({
          review: { ...reviewRecord, date: new Date().toLocaleDateString('cs-CZ') }
        });
        await sendEmail({
          to: RECEPCE_PRIJEMCE,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          type: 'new_review_notification'
        });
      } catch (err) {
        console.warn('E-mail notification failed:', err);
      }

      // Místo proužku s hláškou se okno promění v poděkování s dokreslovaným
      // zaškrtnutím — stejně jako u kontaktního formuláře. Pole se jen skryjí,
      // nemažou: kdyby se formulář přepsal, přišel by o navěšenou obsluhu
      // a po zavření okna už by nešel použít podruhé.
      const telo = reviewForm.querySelector('.review-modal-body');
      const pata = reviewForm.querySelector('.review-modal-footer');
      if (telo) telo.hidden = true;
      if (pata) pata.hidden = true;

      reviewForm.insertAdjacentHTML('beforeend', `
        <div class="review-success-wrapper">
          <div class="success-checkmark-circle">
            <svg class="checkmark-svg" viewBox="0 0 52 52" aria-hidden="true">
              <circle class="checkmark-circle-path" cx="26" cy="26" r="23" fill="none" stroke="#5c6748" stroke-width="2.5" />
              <path class="checkmark-check-path" fill="none" stroke="#5c6748" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>
          <h3 class="success-title">Děkujeme za vaši recenzi!</h3>
          <p class="success-desc">Vaše hodnocení pod jménem <strong>${gdprName}</strong> jsme v pořádku přijali. Moc si vaší zpětné vazby vážíme — pomůže ostatním hostům i nám.</p>
          <div class="success-action-wrap">
            <button type="button" id="btn-close-review-success" class="btn btn-booking-submit">Zavřít</button>
          </div>
        </div>
      `);

      const zavrit = document.getElementById('btn-close-review-success');
      if (zavrit) zavrit.addEventListener('click', () => toggleReviewModal(false));

      reviewForm.dataset.isSubmitting = 'false';
    });
  }


  // Univerzální Plynulý Slider Logic (Pro Okolí & Aktivity na všech zařízeních)
  const setupSlider = (trackId, viewportId, prevBtnId, nextBtnId) => {
    const track = document.getElementById(trackId);
    const viewport = document.getElementById(viewportId);
    const prevBtn = document.getElementById(prevBtnId);
    const nextBtn = document.getElementById(nextBtnId);

    if (!track || !viewport) return;

    const getCardStep = () => {
      const firstCard = track.children[0];
      if (!firstCard) return 300;
      const cardWidth = firstCard.offsetWidth;
      const style = window.getComputedStyle(track);
      const gap = parseFloat(style.gap) || 24;
      return cardWidth + gap;
    };

    const getMaxScroll = () => {
      return Math.max(0, viewport.scrollWidth - viewport.offsetWidth);
    };

    const updateBtnState = () => {
      const scrollLeft = viewport.scrollLeft;
      const maxScroll = getMaxScroll();
      if (prevBtn) {
        prevBtn.style.opacity = scrollLeft <= 5 ? '0.4' : '1';
        prevBtn.style.cursor = scrollLeft <= 5 ? 'default' : 'pointer';
      }
      if (nextBtn) {
        nextBtn.style.opacity = scrollLeft >= maxScroll - 10 ? '0.4' : '1';
        nextBtn.style.cursor = scrollLeft >= maxScroll - 10 ? 'default' : 'pointer';
      }
    };

    viewport.addEventListener('scroll', updateBtnState, { passive: true });
    window.addEventListener('resize', updateBtnState, { passive: true });
    updateBtnState();

    const handleNext = (e) => {
      if (e) e.preventDefault();
      const step = getCardStep();
      viewport.scrollBy({ left: step, behavior: 'smooth' });
    };

    const handlePrev = (e) => {
      if (e) e.preventDefault();
      const step = getCardStep();
      viewport.scrollBy({ left: -step, behavior: 'smooth' });
    };

    if (nextBtn) nextBtn.addEventListener('click', handleNext);
    if (prevBtn) prevBtn.addEventListener('click', handlePrev);

    // Mouse Drag (Volné plynulé přetahování myší bez tvrdých skoků)
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    viewport.addEventListener('mousedown', (e) => {
      isDown = true;
      viewport.classList.add('is-dragging');
      startX = e.pageX - viewport.offsetLeft;
      scrollLeft = viewport.scrollLeft;
    });

    viewport.addEventListener('mouseleave', () => {
      isDown = false;
      viewport.classList.remove('is-dragging');
    });

    viewport.addEventListener('mouseup', () => {
      isDown = false;
      viewport.classList.remove('is-dragging');
    });

    viewport.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - viewport.offsetLeft;
      const walk = (x - startX) * 1.5;
      viewport.scrollLeft = scrollLeft - walk;
    });
  };

  // Aktivace sliderů napříč celým webem
  setupSlider('surroundings-track', 'surroundings-viewport', 'surroundings-prev', 'surroundings-next');
  setupSlider('hotel-activities-track', 'hotel-activities-viewport', 'hotel-activities-prev', 'hotel-activities-next');
  setupSlider('surroundings-activities-track', 'surroundings-activities-viewport', 'surroundings-activities-prev', 'surroundings-activities-next');

  // Button clicks
  const roomsBtn = document.getElementById('rooms-btn');
  if (roomsBtn) {
    roomsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/ubytovani');
    });
  }

  const aboutMoreBtn = document.getElementById('about-more-btn');
  if (aboutMoreBtn) {
    aboutMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/ubytovani');
    });
  }

  const btnShowRoomsOffer = document.getElementById('btn-show-rooms-offer');
  if (btnShowRoomsOffer) {
    btnShowRoomsOffer.addEventListener('click', (e) => {
      e.preventDefault();
      const roomsSec = document.getElementById('rozdeleni-pokoju') || document.querySelector('.room-breakdown-section');
      if (roomsSec) {
        roomsSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Akordeon rozbalování & Carousel pro Rozdělení pokojů
  const roomBreakdownItems = document.querySelectorAll('.room-breakdown-item');
  roomBreakdownItems.forEach(item => {
    const rowHeader = item.querySelector('.room-breakdown-row');
    const toggleBtn = item.querySelector('.btn-toggle-details');
    const toggleText = item.querySelector('.toggle-text');
    const viewport = item.querySelector('.room-carousel-viewport');
    const prevBtn = item.querySelector('.btn-drawer-prev');
    const nextBtn = item.querySelector('.btn-drawer-next');

    const handleToggle = (e) => {
      e.preventDefault();
      const isOpen = item.classList.contains('is-open');

      // Zavřít ostatní akordeony (pouze 1 otevřený najednou)
      roomBreakdownItems.forEach(otherItem => {
        if (otherItem !== item && otherItem.classList.contains('is-open')) {
          otherItem.classList.remove('is-open');
          const otherBtn = otherItem.querySelector('.btn-toggle-details');
          const otherText = otherItem.querySelector('.toggle-text');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          if (otherText) otherText.textContent = 'Zobrazit podrobnosti';
        }
      });

      // Přepnout současný
      if (isOpen) {
        item.classList.remove('is-open');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        if (toggleText) toggleText.textContent = 'Zobrazit podrobnosti';
      } else {
        item.classList.add('is-open');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        if (toggleText) toggleText.textContent = 'Skrýt podrobnosti';

        // Plynulé vycentrování otevřeného pokoje do středu obrazovky
        setTimeout(() => {
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      }
    };

    if (rowHeader) {
      rowHeader.addEventListener('click', handleToggle);
    }

    // Carousel navigace (Infinity loop)
    if (viewport) {
      const getSlideStep = () => {
        const slide = viewport.querySelector('.room-carousel-slide');
        return slide ? (slide.offsetWidth + 24) : 564;
      };

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const step = getSlideStep();
          const maxScroll = viewport.scrollWidth - viewport.clientWidth;
          if (viewport.scrollLeft >= maxScroll - 15) {
            viewport.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            viewport.scrollBy({ left: step, behavior: 'smooth' });
          }
        });
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const step = getSlideStep();
          const maxScroll = viewport.scrollWidth - viewport.clientWidth;
          if (viewport.scrollLeft <= 15) {
            viewport.scrollTo({ left: maxScroll, behavior: 'smooth' });
          } else {
            viewport.scrollBy({ left: -step, behavior: 'smooth' });
          }
        });
      }

      let isDown = false;
      let startX;
      let scrollLeft;

      viewport.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - viewport.offsetLeft;
        scrollLeft = viewport.scrollLeft;
      });
      viewport.addEventListener('mouseleave', () => { isDown = false; });
      viewport.addEventListener('mouseup', () => { isDown = false; });
      viewport.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - viewport.offsetLeft;
        const walk = (x - startX) * 1.8;
        viewport.scrollLeft = scrollLeft - walk;
      });
    }
  });

  // Automatické rozbalení pokoje — id z URL (?open=) nebo z paměti
  const otevritZUrl = (() => {
    const h = window.location.hash;
    if (!h.includes('?')) return null;
    return new URLSearchParams(h.split('?')[1]).get('open');
  })();

  const targetRoomId = otevritZUrl || window.pendingAutoOpenRoom;

  if (targetRoomId) {
    window.pendingAutoOpenRoom = null;
    requestAnimationFrame(() => {
      const targetItem = document.querySelector(`.room-breakdown-item[data-room="${targetRoomId}"]`);
      if (!targetItem) return;

      // Cílový pokoj musí být vidět okamžitě, nečekat na animaci
      const skupinaCile = targetItem.closest('[data-anim-group]');
      if (skupinaCile) {
        skupinaCile.classList.add('anim-group-done');
        skupinaCile.querySelectorAll('[data-anim]').forEach((n) => {
          n.style.transitionDelay = '0s';
          n.classList.add('is-in');
        });
      }
      targetItem.classList.add('is-in');

      const toggleBtn = targetItem.querySelector('.btn-toggle-details');
      const toggleText = targetItem.querySelector('.toggle-text');

      targetItem.classList.add('is-open');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      if (toggleText) toggleText.textContent = 'Skrýt podrobnosti';

      const yOffset = -90;
      const y = targetItem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });

      // Uklidit parametr z adresy, ať při obnovení stránky nestraší
      if (otevritZUrl) {
        history.replaceState(null, '', '/ubytovani#rozdeleni-pokoju');
      }
    });
  }

  const btnSpecsMore = document.getElementById('btn-specs-more');
  const specsContent = document.querySelector('.room-specs-content');

  if (btnSpecsMore && specsContent) {
    btnSpecsMore.addEventListener('click', (e) => {
      e.preventDefault();
      const isExpanded = specsContent.classList.contains('is-expanded');
      if (isExpanded) {
        specsContent.classList.remove('is-expanded');
        btnSpecsMore.textContent = 'Přečíst více';
      } else {
        specsContent.classList.add('is-expanded');
        btnSpecsMore.textContent = 'Skrýt detaily';
      }
    });
  }

  const linkPetMore = document.getElementById('link-pet-more');
  if (linkPetMore) {
    linkPetMore.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSec = document.getElementById('vyhody-ubytovani');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  const btnSpecsRooms = document.getElementById('btn-specs-rooms');
  if (btnSpecsRooms) {
    btnSpecsRooms.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSec = document.getElementById('detaily-pokoju');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.location.hash = '#detaily-pokoju';
      }
    });
  }

  const btnSpecsToBreakdown = document.getElementById('btn-specs-to-breakdown');
  if (btnSpecsToBreakdown) {
    btnSpecsToBreakdown.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSec = document.getElementById('rozdeleni-pokoju');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigateTo('/ubytovani#rozdeleni-pokoju');
      }
    });
  }

  // Kliknutí na logo ve futru přesune na vrchol stránky
  const scrollTopBtns = document.querySelectorAll('.btn-scroll-top, .footer-logo-wrap, .footer-mobile-logo');
  scrollTopBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Lightbox Modal pro zvětšení fotek (Senior-friendly)
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxOverlay = document.getElementById('lightbox-overlay');
  const lightboxPrev = document.getElementById('lightbox-prev');
  const lightboxNext = document.getElementById('lightbox-next');

  let currentPhotosList = [];
  let currentPhotoIndex = 0;

  const updateLightboxContent = () => {
    if (!lightboxImg || currentPhotosList.length === 0) return;
    const item = currentPhotosList[currentPhotoIndex];
    if (typeof item === 'string') {
      lightboxImg.src = item;
      lightboxImg.alt = 'Zvětšený náhled fotky pokoje';
    } else {
      lightboxImg.src = item.src;
      lightboxImg.alt = item.alt || 'Zvětšený náhled fotky pokoje';
    }
  };

  const openLightbox = (photos, startIndex) => {
    currentPhotosList = photos;
    currentPhotoIndex = startIndex;
    if (lightboxImg && currentPhotosList.length > 0) {
      updateLightboxContent();
      lightboxModal.classList.add('is-active');
      lightboxModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  };

  const closeLightbox = () => {
    if (lightboxModal) {
      lightboxModal.classList.remove('is-active');
      lightboxModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  };

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxOverlay) lightboxOverlay.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxModal && lightboxModal.classList.contains('is-active')) {
      closeLightbox();
    }
  });

  if (lightboxNext) {
    lightboxNext.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentPhotosList.length === 0) return;
      currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotosList.length;
      updateLightboxContent();
    });
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentPhotosList.length === 0) return;
      currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotosList.length) % currentPhotosList.length;
      updateLightboxContent();
    });
  }

  // Kliknutí na jakoukoliv fotku pokoje otevře Lightbox
  const roomSlideImgs = document.querySelectorAll('.room-carousel-slide img, .room-specs-image-wrap img');
  roomSlideImgs.forEach((img) => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      const track = img.closest('.room-carousel-track');
      if (track) {
        const allImgsInTrack = Array.from(track.querySelectorAll('img')).map(i => ({
          src: i.src,
          alt: i.alt || i.getAttribute('alt') || 'Detailní náhled fotky pokoje'
        }));
        const clickedIdx = allImgsInTrack.findIndex(item => item.src === img.src);
        openLightbox(allImgsInTrack, clickedIdx !== -1 ? clickedIdx : 0);
      } else {
        openLightbox([{
          src: img.src,
          alt: img.alt || img.getAttribute('alt') || 'Detailní náhled fotky pokoje'
        }], 0);
      }
    });
  });

  const serviceRestaurantBtn = document.getElementById('service-restaurant-btn');
  if (serviceRestaurantBtn) {
    serviceRestaurantBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/stravovani');
    });
  }

  const serviceEventsBtn = document.getElementById('service-events-btn');
  if (serviceEventsBtn) {
    serviceEventsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/akce');
    });
  }

  const diningEventsCtaBtn = document.getElementById('dining-events-cta-btn');
  if (diningEventsCtaBtn) {
    diningEventsCtaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/akce');
    });
  }

  const eventsInquiryBtn = document.getElementById('btn-events-inquiry');
  if (eventsInquiryBtn) {
    eventsInquiryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/kontakt#form-sekce');
    });
  }

  const eventsAboutCtaBtn = document.getElementById('events-about-cta-btn');
  if (eventsAboutCtaBtn) {
    eventsAboutCtaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/kontakt#form-sekce');
    });
  }

  const surroundingsMoreBtn = document.getElementById('surroundings-more-btn');
  if (surroundingsMoreBtn) {
    surroundingsMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/okoli');
    });
  }

  // Explicitní obsluha prokliku na detailní stránky kategorií v Sekci 3
  const categoryExploreBtns = document.querySelectorAll('.btn-category-explore, .surrounding-card-link-wrapper');
  categoryExploreBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const href = btn.getAttribute('href') || '';
      if (href.includes('turistika')) navigateTo('/okoli/turistika');
      else if (href.includes('cyklistika')) navigateTo('/okoli/cyklistika');
      else if (href.includes('zima')) navigateTo('/okoli/zima');
      else if (href.includes('autem')) navigateTo('/okoli/vylety-autem');
      else if (href.startsWith('/')) navigateTo(href.replace(/\.html$/, ''));
      else if (href.startsWith('#')) {
        const clean = href.replace('#', '');
        if (clean === 'turistika') navigateTo('/okoli/turistika');
        else if (clean === 'cyklistika') navigateTo('/okoli/cyklistika');
        else if (clean === 'zimni-vylety' || clean === 'zima') navigateTo('/okoli/zima');
        else if (clean === 'vylety-autem' || clean === 'autem') navigateTo('/okoli/vylety-autem');
      }
    });
  });

  const diningBtns = document.querySelectorAll('.btn-dining-more');
  diningBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/stravovani');
    });
  });

  const promoBtns = document.querySelectorAll('.btn-promo, #promo-booking-btn');
  promoBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openPromoCodeModal();
    });
  });

  const bookingBtns = document.querySelectorAll('.btn-booking, .btn-cta, .btn-room-reserve, .btn-breakdown-cta, .btn-terms-cta, .mobile-menu-booking');
  bookingBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (
        btn.id === 'btn-goto-prizemi' ||
        btn.id === 'btn-goto-vyhled' ||
        btn.id === 'btn-specs-rooms' ||
        btn.id === 'btn-specs-to-breakdown' ||
        btn.id === 'btn-show-rooms-offer' ||
        btn.id === 'rooms-btn' ||
        btn.id === 'about-more-btn' ||
        btn.id === 'surroundings-more-btn' ||
        btn.id === 'service-restaurant-btn' ||
        btn.id === 'service-events-btn' ||
        btn.classList.contains('btn-promo') ||
        btn.id === 'promo-booking-btn' ||
        btn.classList.contains('btn-dining-more')
      ) return;

      e.preventDefault();

      // Zavřít mobilní menu drawer pokud bylo otevřené
      const mobileOverlay = document.getElementById('mobile-menu-overlay');
      if (mobileOverlay) {
        mobileOverlay.classList.remove('is-active');
      }

      const roomItem = btn.closest('.room-breakdown-item');
      const roomId = roomItem ? roomItem.dataset.room : '';
      const targetHash = roomId ? `#rezervace?room=${roomId}&pickdates=1` : '#rezervace';

      if (window.location.hash === targetHash) {
        route(false);
      } else {
        window.location.hash = targetHash;
      }

      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      });
    });
  });

  // Tajné secret tlačítko pro rychlý přechod do recepčního adminu z paty webu
  const secretAdminTriggers = document.querySelectorAll('.secret-admin-trigger, .footer-copyright');
  secretAdminTriggers.forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/admin';
    });
  });

  // Progresivní Lazy Loading obrázků s předešitím o 600px
  initProgressiveLazyLoading();
};

// Funkce pro dynamický lazy loading s velkou rezervou 600px
const initProgressiveLazyLoading = () => {
  const lazyImages = document.querySelectorAll('img[loading="lazy"]:not(.observer-active)');
  if ('IntersectionObserver' in window) {
    const imgObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.classList.add('img-loaded');
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '600px 0px' });

    lazyImages.forEach(img => {
      img.classList.add('observer-active');
      if (img.complete) {
        img.classList.add('img-loaded');
      } else {
        imgObserver.observe(img);
      }
    });
  } else {
    lazyImages.forEach(img => img.classList.add('img-loaded'));
  }
};

// Preload Funkce Pro Obrázky v Kategoriích (Instantní načítání fotek aktivit)
const preloadedCategories = new Set();
const preloadCategoryImages = (catId) => {
  if (!catId || preloadedCategories.has(catId)) return;
  const cat = CATEGORIES_DATA[catId];
  if (!cat) return;
  preloadedCategories.add(catId);

  // Preload Hero img — na telefonu tu užší, ať se nestahují obě.
  // Rozhoduje stejná hranice jako <source media> v šabloně (767 px).
  if (cat.heroImg) {
    const jeUzky = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    const heroImg = new Image();
    heroImg.src = (jeUzky && cat.heroImgMobil) ? cat.heroImgMobil : cat.heroImg;
  }

  // Preload vícenásobných položek asynchronně s lehkým rozestupem pro plynulost
  if (cat.items && Array.isArray(cat.items)) {
    cat.items.forEach((item, index) => {
      setTimeout(() => {
        if (item.img) {
          const img = new Image();
          img.src = item.img;
        }
      }, index * 30);
    });
  }
};

// Pre-warming fotek při najetí nebo dotyku na karty kategorií
const initCategoryHoverPreload = () => {
  document.querySelectorAll('a[href^="#turistik"], a[href^="#cykl"], a[href^="#zimn"], a[href^="#aut"], .activity-card-link').forEach(link => {
    const handler = () => {
      const href = link.getAttribute('href') || '';
      let catId = href.replace('#', '');
      if (catId.includes('turistik')) catId = 'turistika';
      else if (catId.includes('cykl')) catId = 'cyklistika';
      else if (catId.includes('zimn')) catId = 'zimni-vylety';
      else if (catId.includes('aut')) catId = 'vylety-autem';
      if (CATEGORIES_DATA[catId]) {
        preloadCategoryImages(catId);
      }
    };
    link.addEventListener('mouseenter', handler, { once: true });
    link.addEventListener('touchstart', handler, { passive: true, once: true });
  });
};

// Preload Funkce Pro Hero Obrázky (Zrychlení prvního vykreslení)
const preloadHeroImages = (pageKey) => {
  const isMobile = window.innerWidth <= 768;
  if (pageKey === 'dining') {
    const src = '/Uvodni stranka/stravovani.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'events') {
    const src = '/akce/hero_akce.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'activities') {
    const src = isMobile ? '/Aktivity v hotelu/vyhled na krajinu mobil.webp' : '/Aktivity v hotelu/vyhled na krajinu desktop.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'rooms') {
    const src = '/nabidka-pokoju.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'contact') {
    const src = '/kontakt/vyhled-na-mustky.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'news') {
    const src = '/Fotky Aktivit/Aktulity hero sekce.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'gdpr' || pageKey === 'cookies' || pageKey === 'podminky') {
    const src = '/uvodni_hero_sekce.webp';
    const img = new Image();
    img.src = src;
  }
};

// Render Funkce Pro Samostatnou Stránku "Stravování"
const getStravovaniPageHTML = () => `
  <div class="dining-page">

  <!-- 1. HERO SEKCE STRAVOVÁNÍ (1:1 DLE NABÍDKA POKOJŮ HERO SEKCE) -->
  <section class="hero-section dining-hero-section room-detail-hero" id="uvod-stravovani">
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <div class="room-detail-hero-center">
        <h1 class="hero-title room-detail-hero-title">
          <span>Poctivá domácí kuchyně pouze pro naše hosty.</span>
        </h1>
        <p class="room-detail-hero-subtitle">
          <span>Skvělé ubytování v Jizerských horách a poctivé stravování k sobě neodmyslitelně patří.</span>
        </p>

        <div class="dining-hero-buttons-wrap">
          <a href="#snidane" class="btn btn-dining-read-more room-detail-hero-btn" id="btn-dining-read-more">Přečíst více</a>
        </div>
      </div>

      <!-- Spodní šipka dolů -->
      <div class="scroll-down-btn" id="scroll-btn-stravovani">
        <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
        </svg>
      </div>
    </div>
  </section>

  <!-- 2. SNÍDANĚ FORUMU ŠVÉDSKÉHO STOLU -->
  <section class="dining-feature-section dining-buffet-section" id="snidane">
    <div class="dining-feature-inner">
      <div class="dining-section-header" data-anim="right">
        <h2 class="dining-section-title">Snídaně formou švédského stolu</h2>
        <p class="dining-section-lead">
          Běžně podáváme snídaně formou švédských stolů v rozmezí od 8:00 do 9:00 hod. ranních.<br>Těšit se můžete na čerstvé pečivo, sýry, uzeniny, cereálie i teplý bufet — míchaná vejce a teplé uzeniny.
        </p>
      </div>

      <div class="dining-single-img-wrap" data-anim="left">
        <img src="/stravovani/snidane.webp" alt="Snídaně formou švédského stolu" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

  <!-- 3. VEČEŘE FORUMU POLOPENZE -->
  <section class="dining-feature-section dining-dinner-section" id="vecere">
    <div class="dining-feature-inner">
      <div class="dining-section-header" data-anim="left">
        <h2 class="dining-section-title">Večeře formou polopenze</h2>
        <p class="dining-section-lead">
          Užijte si poctivou českou domácí kuchyni formou dvouchodového týdenního menu — polévka a hlavní jídlo, které pro vás vaříme z čerstvých sezónních surovin. Máte-li zdravotní omezení nebo držíte dietu, domluvte se s námi předem a podle možností vám vyjdeme vstříc. Jelikož nejsme veřejná restaurace, večeře podáváme ubytovaným hostům společně od 18:00 do 18:30 hodin.
        </p>
      </div>

      <div class="dining-single-img-wrap" data-anim="right">
        <img src="/stravovani/vecere.webp" alt="Večeře formou polopenze" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

  <!-- 4. PANORAMA KRB RESTAURACE -->
  <section class="dining-fireplace-section" id="krb-restaurace">
    <div class="dining-fireplace-img-wrap" data-anim="up">
      <img src="/stravovani/krb_restaurace.webp" alt="Restaurace s krbem v Hotelu u Můstku" loading="lazy" decoding="async">
    </div>
  </section>

  <!-- 5. LETNÍ RESTAURAČNÍ ZAHRÁDKA NAD SPLAVEM -->
  <section class="dining-terrace-section" id="teraska">
    <div class="dining-terrace-inner">
      <div class="dining-2col-layout">
        <!-- Levý sloupec: Informace s ikonami -->
        <div class="dining-2col-content" data-anim="up">
          <h2 class="dining-col-title">Letní restaurační zahrádka nad splavem</h2>

          <div class="dining-info-list">
            <div class="dining-info-item">
              <h3 class="dining-info-heading">
                <img src="/Icons/Ikony/clock.png" alt="" class="dining-inline-icon">
                <span>Provozní doba:</span>
              </h3>
              <p class="dining-info-desc">Květen – Září (otevřeno pro hotelové hosty i projíždějící cyklisty a pěší turisty).</p>
            </div>

            <div class="dining-info-item">
              <h3 class="dining-info-heading">
                <img src="/Icons/Ikony/beer.png" alt="" class="dining-inline-icon">
                <span>Co je na čepu?</span>
              </h3>
              <p class="dining-info-desc">Točené pivo Bernard 11° (při větším počtu osob je po předchozí domluvě možné zařídit jakékoliv pivo).</p>
            </div>

            <div class="dining-info-item">
              <h3 class="dining-info-heading">
                <img src="/Icons/Ikony/view.png" alt="" class="dining-inline-icon">
                <span>Výhled na skokanské můstky</span>
              </h3>
              <p class="dining-info-desc">Přímo od stolu s chlazeným pivem můžete sledovat tréninky skokanů na protilehlých můstcích.</p>
            </div>
          </div>
        </div>

        <!-- Pravý sloupec: Fotka terásky -->
        <div class="dining-2col-image" data-anim="up">
          <img src="/stravovani/zahradka.webp" alt="Letní restaurační zahrádka nad splavem" loading="lazy" decoding="async">
        </div>
      </div>
    </div>
  </section>

  <!-- 6. VENKOVNÍ GRILOVÁNÍ A UZENÍ -->
  <section class="dining-grill-section" id="grilovani">
    <div class="dining-grill-inner">
      <div class="dining-2col-layout dining-2col-reversed">
        <!-- Levý sloupec: Fotka ohniště -->
        <div class="dining-2col-image" data-anim="up">
          <img src="/stravovani/ohniste.webp" alt="Venkovní grilování a uzení" loading="lazy" decoding="async">
        </div>

        <!-- Pravý sloupec: Text a ikony -->
        <div class="dining-2col-content" data-anim="up">
          <h2 class="dining-col-title">Venkovní grilování a uzení</h2>
          <p class="dining-col-lead">Pro milovníky venkovního posezení jsme v areálu zahrady u splavu vybudovali zázemí pro letní relaxaci.</p>

          <div class="dining-info-list">
            <div class="dining-info-item">
              <h3 class="dining-info-heading">
                <img src="/Icons/Ikony/smoker.png" alt="" class="dining-inline-icon">
                <span>Venkovní grilování</span>
              </h3>
              <p class="dining-info-desc">Po předchozí domluvě je pro ubytované hosty možné zařídit grilování či využít gril pro vlastní speciality.</p>
            </div>

            <div class="dining-info-item">
              <h3 class="dining-info-heading">
                <img src="/Icons/Ikony/campfire.png" alt="" class="dining-inline-icon">
                <span>Kamenné ohniště</span>
              </h3>
              <p class="dining-info-desc">Ohniště nad splavem pro klasické táboráky a večerní posezení na zahradě.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 7. RODINNÉ OSLAVY, SVATBY ČI FIREMNÍ AKCE -->
  <section class="dining-events-banner-section" id="oslavy-akce">
    <img src="/Decoration/Hory - dekorace.webp" alt="" class="dining-events-contour-img" aria-hidden="true" loading="lazy" decoding="async">
    <div class="dining-events-inner" data-anim="fade">
      <div class="dining-events-content">
        <h2 class="dining-events-title">Rodinné oslavy, svatby či firemní akce?</h2>
        <p class="dining-events-p1">Plánujete skupinovou akci?</p>
        <p class="dining-events-p2">Rádi pro vás po předchozí dohodě zajistíme kompletní pohoštění i ubytování pro skupiny do 34 osob. Rauty pořádáme v restauraci a salonku s kapacitou kolem 50 osob.</p>
        <p class="dining-events-p3">Postaráme se o rodinnou atmosféru a hladký průběh vaší akce v klidném údolí Jizerských hor.</p>
      </div>
      <div class="dining-events-action">
        <a href="/akce" class="btn btn-about btn-events-cta" id="dining-events-cta-btn">Zjistit více</a>
      </div>
    </div>
  </section>

  <!-- 8. REUSED SEKTION: OKOLÍ -->
  ${getSurroundingsHTML()}

  <!-- 9. REUSED SEKTION: RECENZE -->
  

  ${getReviewsHTML()}

  <!-- 10. REUSED SEKTION: CTA BANNER -->
  <section class="cta-section">
    <div class="cta-overlay"></div>
    <div class="cta-inner">
      <h2 class="cta-title">Dopřejte si zasloužený<br>odpočinek v Jizerských horách</h2>
      <button class="btn btn-booking btn-cta">Rezervovat pobyt</button>
    </div>
  </section>

  <!-- 11. REUSED SEKTION: FOOTER -->
  ${getFooterHTML()}
  </div>
`;

// Render Funkce Pro Samostatnou Stránku "Skupinové Akce"
const getEventsPageHTML = () => `
  <div class="events-page">

  <!-- 1. HERO SEKCE SKUPINOVÉ AKCE -->
  <section class="hero-section events-hero-section room-detail-hero" id="uvod-akce">
    <img class="hero-events-poster" src="/akce/hero_akce.webp" alt="Skupinové akce v Hotelu u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <div class="room-detail-hero-center">
        <h1 class="hero-title room-detail-hero-title">
          <span class="events-title-desktop">Skupinové akce</span>
          <span class="events-title-mobile">Prohlédněte si nabídku našich skupinových akcí</span>
        </h1>
        <p class="room-detail-hero-subtitle">
          <span>Uspořádejte nezapomenutelnou společenskou akci nebo sportovní soustředění v Jizerských horách — s kompletním pronájmem hotelu pro 34 až 40 hostů včetně stravování. Skokanské můstky a křišťálově čistý splav máte jako bonus přímo u budovy.</span>
        </p>

        <div class="events-hero-buttons-wrap">
          <a href="#celay-hotel" class="btn btn-events-read-more room-detail-hero-btn" id="btn-events-read-more">Přečíst více</a>
          <a href="/kontakt#form-sekce" class="btn btn-events-inquiry" id="btn-events-inquiry">Nezávazná poptávka</a>
        </div>
      </div>

      <!-- Spodní šipka dolů -->
      <div class="scroll-down-btn" id="scroll-btn-events">
        <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
        </svg>
      </div>
    </div>
  </section>

  <!-- 2. CELÝ HOTEL JEN PRO VÁS A VAŠE HOSTY (1:1 Identická kopie sekce Zázemí z úvodní stránky) -->
  <section class="about-section events-about-section" id="celay-hotel">
    <div class="about-inner">
      <div class="about-content" data-anim="up">
        <h2 class="about-title">Celý hotel jen pro vás a vaše hosty</h2>
        <div class="about-text">
          <p>Plánujete skupinovou akci? Po předchozí dohodě pro vás zajistíme kompletní pronájem celého hotelu — ubytování, společenské prostory i pohoštění na jednom místě.</p>
          <p>Postaráme se o rodinnou atmosféru a hladký průběh celé akce v klidném údolí Jizerských hor, stranou ruchu a s naprostým soukromím pro skupiny až do 34 osob.</p>
        </div>
        <a href="/kontakt#form-sekce" class="btn btn-about btn-events-about-cta" id="events-about-cta-btn">Nezávazně poptat termín</a>
      </div>
      
      <div class="about-img-top" data-anim="left">
        <img src="/akce/zahradka.webp" alt="Restaurační zahrádka u řeky Desné" loading="lazy" decoding="async">
      </div>

      <div class="about-img-bottom" data-anim="left">
        <img src="/akce/restaurace.webp" alt="Restaurace a interiér Hotelu u Můstku" loading="lazy" decoding="async">
      </div>

      <div class="about-shadow-decor">
        <img src="/Decoration/list_shadow.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

  <!-- 3. JAKÉ AKCE U NÁS MŮŽETE NAPLÁNOVAT? -->
  <section class="events-types-section" id="typy-akci">
    <div class="events-types-inner">
      <h2 class="events-types-title" data-anim="up">Jaké akce u nás můžete naplánovat?</h2>

      <div class="events-types-grid" data-anim-group>
        <!-- Kartička 1: Svatby -->
        <div class="events-type-card" data-anim="up">
          <div class="events-type-img-wrap">
            <img src="/akce/svatby.webp" alt="Svatby v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="events-type-card-content">
            <h3 class="events-type-card-title">Svatby</h3>
            <p class="events-type-card-desc">Obřad i hostina v krásném prostředí hor. Celý hotel jen pro vás a vaše svatební hosty s ubytováním přímo na místě.</p>
          </div>
        </div>

        <!-- Kartička 2: Firemní Akce -->
        <div class="events-type-card" data-anim="up">
          <div class="events-type-img-wrap">
            <img src="/akce/firemni_akce.webp" alt="Firemní akce a teambuilding" loading="lazy" decoding="async">
          </div>
          <div class="events-type-card-content">
            <h3 class="events-type-card-title">Firemní Akce</h3>
            <p class="events-type-card-desc">Zázemí pro školení, porady i teambuilding s aktivitami v přírodě, společenskou hernou a posezením na terase.</p>
          </div>
        </div>

        <!-- Kartička 3: Rodinné Oslavy -->
        <div class="events-type-card" data-anim="up">
          <div class="events-type-img-wrap">
            <img src="/rodinne oslavy.webp" alt="Rodinné oslavy a jubilea" loading="lazy" decoding="async">
          </div>
          <div class="events-type-card-content">
            <h3 class="events-type-card-title">Rodinné Oslavy</h3>
            <p class="events-type-card-desc">Narozeniny, výročí nebo setkání rodiny pod jednou střechou — s domácí kuchyní, rauty a soukromím pro všechny.</p>
          </div>
        </div>

        <!-- Kartička 4: Klubová Soustředění -->
        <div class="events-type-card" data-anim="up">
          <div class="events-type-img-wrap">
            <img src="/akce/soustredeni.webp" alt="Klubová a sportovní soustředění" loading="lazy" decoding="async">
          </div>
          <div class="events-type-card-content">
            <h3 class="events-type-card-title">Klubová Soustředění</h3>
            <p class="events-type-card-desc">Zázemí pro sportovní týmy i zájmové kluby s uzamykatelnou kolárnou, lyžárnou a stravou na míru.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 4. CO PRO VAŠI AKCI ZAŘÍDÍME (1:1 DLE SEKCE VÍCE NEŽ JEN UBYTOVÁNÍ) -->
  <section class="features-section events-features-section" id="zaridime">
    <div class="features-inner">
      <h2 class="features-title" data-anim="up">Co pro vaši akci zařídíme</h2>
      
      <div class="features-grid" data-anim-group>
        <!-- Horní řada (3 položky) -->
        <div class="features-row">
          <!-- Položka 1 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikony/Kuchařská ilustrace s transparentním pozadím.webp" alt="Pohoštění na míru" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Pohoštění na míru:</strong> domácí kuchyně z čerstvých surovin.
            </p>
          </div>

          <!-- Položka 2 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikony/Autobus se zavazadly na transparentním pozadí.webp" alt="Zajistíme dopravu" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Zajistíme dopravu:</strong> mikrobusem či autobusem pro celou vaši skupinu.
            </p>
          </div>

          <!-- Položka 3 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikony/parking-monitoring-illustration-transparent.webp" alt="Parkování pod dohledem kamerového záznamu" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Parkování:</strong> pod dohledem kamerového záznamu.
            </p>
          </div>
        </div>

        <!-- Horizontální dělicí čára -->
        <div class="features-divider"></div>

        <!-- Spodní řada (3 položky) -->
        <div class="features-row">
          <!-- Položka 4 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikona - spolecenska herna.webp" alt="Společenská místnost" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Společenská místnost</strong> pro zábavu i vzdělávání za jakéhokoliv počasí.
            </p>
          </div>

          <!-- Položka 5 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikona - ohniste.webp" alt="Posezení u ohniště" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Posezení u ohniště:</strong> zahradní grill & udírna pro vaši akci.
            </p>
          </div>

          <!-- Položka 6 -->
          <div class="feature-item" data-anim="up">
            <div class="feature-icon">
              <img src="/Icons/Ikony/Výsledný obrázek s transparentním pozadím.webp" alt="Živá hudba" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Živá hudba:</strong> venkovní párty a zábava pod širým nebem.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 5. REUSED SEKCE: RECENZE -->
  ${getReviewsHTML()}

  <!-- 6. REUSED SEKCE: CTA BANNER -->
  

  
  

  
  
  
  
  
  

  ${getCtaHTML()}

  <!-- 7. REUSED SEKCE: FOOTER -->
  ${getFooterHTML()}
  </div>
`;

// Render Funkce Pro Stránku "Aktivity" (1:1 DLE SVG PŘEDLOHY OKOLÍ HOTELU)
const getActivitiesPageHTML = () => `
  <div class="activities-page">
    <!-- 1. HERO SEKCE AKTIVITY -->
    <section class="hero-section activities-hero-section room-detail-hero" id="uvod-aktivity">
      <picture style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
        <source media="(max-width: 767px)" srcset="/Aktivity%20v%20hotelu/vyhled%20na%20krajinu%20mobil.webp">
        <img class="hero-activities-poster" src="/Aktivity v hotelu/vyhled na krajinu desktop.webp" alt="Jaké aktivity nabízíme v Hotelu u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; filter: brightness(0.85);">
      </picture>
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        ${getHeaderHTML()}

        <div class="room-detail-hero-center">
          <h1 class="hero-title room-detail-hero-title">
            <span>Jaké aktivity nabízíme?</span>
          </h1>
          <p class="room-detail-hero-subtitle">
            <span>Objevte nejkrásnější trasy Jizerských hor přímo od dveří našeho hotelu nebo prozkoumejte, co nabízí náš hotel.</span>
          </p>

          <div class="activities-hero-buttons-wrap">
            <a href="#aktivity-v-hotelu" class="btn btn-activities-hero btn-activities-hotel" id="btn-activities-hotel">Aktivity v hotelu</a>
            <a href="/okoli#aktivity-v-okoli" class="btn btn-activities-hero btn-activities-surroundings" id="btn-activities-surroundings">Aktivity v okolí</a>
          </div>
        </div>

        <!-- Spodní šipka dolů -->
        <div class="scroll-down-btn" id="scroll-btn-activities">
          <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
          </svg>
        </div>
      </div>
    </section>

    <!-- 2. AKTIVITY V NAŠEM HOTELU -->
    <section class="hotel-activities-section surroundings-section" id="aktivity-v-hotelu">
      <div class="hotel-activities-inner surroundings-inner">
        <h2 class="hotel-activities-title surroundings-title" data-anim="up">Aktivity v našem hotelu</h2>

        <div class="surroundings-slider-viewport" id="hotel-activities-viewport">
          <div class="surroundings-cards-grid" id="hotel-activities-track" data-anim-group>
            <!-- Karta 1: Otužování U Splavu -->
            <div class="hotel-activity-card hotel-activity-card-otuzovani surrounding-card" data-anim="up">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/otuzovani.webp" alt="Otužování U Splavu" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Otužování U Splavu</h3>
            </div>

            <!-- Karta 2: Kulečník -->
            <div class="hotel-activity-card hotel-activity-card-kulecnik surrounding-card" data-anim="up">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/Aktivity v hotelu/kulecnik.webp" alt="Kulečník v Hotelu u Můstku" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Kulečník</h3>
            </div>

            <!-- Karta 3: Fotbálek -->
            <div class="hotel-activity-card hotel-activity-card-fotbalek surrounding-card" data-anim="up">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/Aktivity v hotelu/fotbalek.webp" alt="Stolní fotbálek" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Fotbálek</h3>
            </div>

            <!-- Karta 4: Šipky -->
            <div class="hotel-activity-card hotel-activity-card-sipky surrounding-card" data-anim="up">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/Aktivity v hotelu/sipky.webp" alt="Elektronické šipky" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Šipky</h3>
            </div>

            <!-- Karta 5: Ping Pong -->
            <div class="hotel-activity-card hotel-activity-card-pingpong surrounding-card" data-anim="up">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/ping pong.webp" alt="Stolní tenis - Ping Pong" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Ping Pong</h3>
            </div>

            <!-- Karta 6: Společenská Místnost -->
            <div class="hotel-activity-card hotel-activity-card-spolecenska surrounding-card" data-anim="up">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/Aktivity v hotelu/spolecenska mistnost.webp" alt="Společenská místnost" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Společenská Místnost</h3>
            </div>
          </div>
        </div>

        <div class="surroundings-footer hotel-activities-footer">
          <div class="surroundings-nav-controls">
            <button class="surroundings-nav-btn" id="hotel-activities-prev" aria-label="Předchozí aktivity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="surroundings-nav-btn" id="hotel-activities-next" aria-label="Další aktivity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. AKTIVITY V OKOLÍ HOTELU -->
    <section class="surroundings-activities-section surroundings-section" id="aktivity-v-okoli">
      <div class="surroundings-activities-inner surroundings-inner">
        <h2 class="surroundings-activities-title surroundings-title" data-anim="up">Aktivity v okolí hotelu</h2>

        <div class="surroundings-slider-viewport" id="surroundings-activities-viewport">
          <div class="surroundings-cards-grid" id="surroundings-activities-track" data-anim-group>
            <!-- Karta 1: Turistika -->
            <div class="surrounding-activity-card surrounding-card" data-anim="up">
              <a href="#turistika" class="surrounding-card-link-wrapper">
                <div class="surrounding-activity-img-wrap surrounding-card-img-wrap">
                  <img src="/Aktivity v hotelu/turistika.webp" alt="Turistika v Jizerských horách" loading="lazy" decoding="async">
                </div>
              </a>
              <div class="surrounding-activity-card-footer">
                <h3 class="surrounding-activity-card-title surrounding-card-title">Turistika</h3>
                <a href="#turistika" class="surrounding-activity-link btn-category-explore">Prohlédnout aktivity &rsaquo;</a>
              </div>
            </div>

            <!-- Karta 2: Cyklistika -->
            <div class="surrounding-activity-card surrounding-card" data-anim="up">
              <a href="#cyklistika" class="surrounding-card-link-wrapper">
                <div class="surrounding-activity-img-wrap surrounding-card-img-wrap">
                  <img src="/Aktivity v hotelu/cyklistika.webp" alt="Cyklistika a cyklotrasy" loading="lazy" decoding="async">
                </div>
              </a>
              <div class="surrounding-activity-card-footer">
                <h3 class="surrounding-activity-card-title surrounding-card-title">Cyklistika</h3>
                <a href="#cyklistika" class="surrounding-activity-link btn-category-explore">Prohlédnout aktivity &rsaquo;</a>
              </div>
            </div>

            <!-- Karta 3: Zimní výlety -->
            <div class="surrounding-activity-card surrounding-card" data-anim="up">
              <a href="#zimni-vylety" class="surrounding-card-link-wrapper">
                <div class="surrounding-activity-img-wrap surrounding-card-img-wrap">
                  <img src="/Aktivity v hotelu/zimni vylety.webp" alt="Zimní výlety a běžkování" loading="lazy" decoding="async">
                </div>
              </a>
              <div class="surrounding-activity-card-footer">
                <h3 class="surrounding-activity-card-title surrounding-card-title">Zimní výlety</h3>
                <a href="#zimni-vylety" class="surrounding-activity-link btn-category-explore">Prohlédnout aktivity &rsaquo;</a>
              </div>
            </div>

            <!-- Karta 4: Výlety autem -->
            <div class="surrounding-activity-card surrounding-card" data-anim="up">
              <a href="#vylety-autem" class="surrounding-card-link-wrapper">
                <div class="surrounding-activity-img-wrap surrounding-card-img-wrap">
                  <img src="/Aktivity v hotelu/vylety autem.webp" alt="Výlety autem po okolí" loading="lazy" decoding="async">
                </div>
              </a>
              <div class="surrounding-activity-card-footer">
                <h3 class="surrounding-activity-card-title surrounding-card-title">Výlety autem</h3>
                <a href="#vylety-autem" class="surrounding-activity-link btn-category-explore">Prohlédnout aktivity &rsaquo;</a>
              </div>
            </div>
          </div>
        </div>

        <div class="surroundings-footer surroundings-activities-footer">
          <div class="surroundings-nav-controls">
            <button class="surroundings-nav-btn" id="surroundings-activities-prev" aria-label="Předchozí aktivity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="surroundings-nav-btn" id="surroundings-activities-next" aria-label="Další aktivity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. ČASTO KLADENÉ DOTAZY (FAQ) -->
    <section class="activities-faq-section" id="faq">
      <div class="activities-faq-inner">
        <h2 class="activities-faq-title" data-anim="up">Často kladené dotazy</h2>

        <div class="activities-faq-list" data-anim-group>
          <!-- FAQ Dotaz 1 -->
          <div class="faq-item" data-anim="up">
            <button class="faq-question-btn" aria-expanded="false">
              <span class="faq-question-text">Které výlety zvládneme bez velkého stoupání?</span>
              <span class="faq-action-text">Zobrazit odpověď <span class="faq-arrow">&rsaquo;</span></span>
            </button>
            <div class="faq-answer-content">
              <p>K Protržené přehradě se jde údolím Černé Desné s převýšením cca 300 m, dojdete tam pěšky přímo od hotelu. Kolem přehrady Souš vede zpevněný okruh bez převýšení. Rašeliniště Jizerky má dřevěné povalové chodníky. Řekněte nám, kolik chcete ujít, a doporučíme trasu na míru.</p>
            </div>
          </div>

          <!-- FAQ Dotaz 2 -->
          <div class="faq-item" data-anim="up">
            <button class="faq-question-btn" aria-expanded="false">
              <span class="faq-question-text">Kdy je nejlepší čas přijet?</span>
              <span class="faq-action-text">Zobrazit odpověď <span class="faq-arrow">&rsaquo;</span></span>
            </button>
            <div class="faq-answer-content">
              <p>Špatný termín tu prakticky neexistuje. V květnu až říjnu fungují rozhledny s restauracemi a bikepark, nejhezčí bývá září. Prosinec až březen patří lyžím. Listopad a duben jsou nejklidnější a nejlevnější — muzea, jeskyně i aquapark fungují celoročně.</p>
            </div>
          </div>

          <!-- FAQ Dotaz 3 -->
          <div class="faq-item" data-anim="up">
            <button class="faq-question-btn" aria-expanded="false">
              <span class="faq-question-text">Dá se do okolí vyrazit i vlakem?</span>
              <span class="faq-action-text">Zobrazit odpověď <span class="faq-arrow">&rsaquo;</span></span>
            </button>
            <div class="faq-answer-content">
              <p>Ano. Desná leží na trati z Tanvaldu do Harrachova a úsek přes Kořenov je ozubnicová dráha, jedna z mála v Evropě. Vlakem dojedete k Mumlavským vodopádům i do Jablonce k Muzeu skla. Jízdní řády vám vytiskneme na recepci.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    ${getCtaHTML()}

    <!-- 6. REUSED SEKCE: FOOTER -->
    ${getFooterHTML()}
  </div>
`;

const renderNewsCardsHTML = (activeItems) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Návštěvníkovi patří datum vydání, ne poslední úpravy. `updated_at`
  // se mění při každé opravě překlepu a navíc s ním hýbe i přesouvání
  // aktualit v administraci — datum na webu by pak skákalo bez důvodu.
  const datumVydani = (item) => formatDate(item.created_at || item.updated_at);

  if (!activeItems || activeItems.length === 0) {
    return `
      <div class="news-empty-state" data-anim="up">
        <div class="news-empty-icon">📰</div>
        <h3 class="news-empty-title">Aktuálně nemáme žádné novinky</h3>
        <p class="news-empty-desc">Sledujte náš web pro nadcházející akce a sezónní oznámení.</p>
      </div>
    `;
  }

  return `
    <div class="news-cards-list" data-anim-group>
      ${activeItems.map((item, index) => {
    const hasImage = Boolean(item.image_url);
    // Escapuje se PŘED nahrazením konců řádků, jinak by se rozbilo i <br>.
    const formattedContent = esc(item.content || '').replace(/\n/g, '<br>');
    const isReverse = index % 2 === 1;

    if (hasImage) {
      return `
            <article class="news-card news-card-with-image ${isReverse ? 'news-card-reverse' : ''}" data-anim="up">
              <div class="news-card-content">
                <div class="news-card-date">🗓️ ${datumVydani(item)}</div>
                <h2 class="news-card-title">${esc(item.title)}</h2>
                <div class="news-card-text">${formattedContent}</div>
              </div>
              <div class="news-card-image-wrap">
                <img src="${escUrl(item.image_url)}" alt="${esc(item.title)}" class="news-card-image" loading="lazy" decoding="async"
                     onerror="window.aktualitaBezFotky && window.aktualitaBezFotky(this)">
              </div>
            </article>
          `;
    } else {
      return `
            <article class="news-card news-card-without-image" data-anim="up">
              <div class="news-card-centered-header">
                <div class="news-card-date">🗓️ ${datumVydani(item)}</div>
                <h2 class="news-card-title">${esc(item.title)}</h2>
              </div>
              <div class="news-card-text news-card-text-readable">${formattedContent}</div>
            </article>
          `;
    }
  }).join('')}
    </div>
  `;
};

/**
 * Nedostupná fotka aktuality — karta se přepne na textovou podobu.
 *
 * Fotky se ukládají do Supabase Storage a odkaz na ně žije v databázi.
 * Když soubor zmizí (přesun projektu, smazaný bucket), zůstal by po něm
 * na webu prázdný rámeček s ikonou rozbitého obrázku. Text aktuality je
 * to podstatné, takže ho radši ukážeme samotný.
 */
window.aktualitaBezFotky = (img) => {
  const karta = img.closest('.news-card');
  const obal = img.closest('.news-card-image-wrap');
  if (obal) obal.remove();
  if (karta) {
    karta.classList.remove('news-card-with-image', 'news-card-reverse');
    karta.classList.add('news-card-without-image');
  }
};

/**
 * Naplní seznam aktualit daty z databáze.
 *
 * Zdrojem je vždy tabulka `aktuality`, nikdy to, co je zapsané v HTML.
 * Když se načtení nepovede, zůstane na místě hláška o nedostupnosti —
 * radši to přiznáme, než abychom tvrdili „žádné novinky nemáme“, což
 * vypadá stejně jako prázdná databáze a nikdo si chyby nevšimne.
 */
export async function nactiAktualityDoStranky() {
  const container = document.getElementById('news-main-inner-container');
  if (!container) return;

  try {
    const vsechny = await getStoredNewsItems();
    const aktivni = (vsechny || []).filter(item => item.is_active);
    container.innerHTML = renderNewsCardsHTML(aktivni);
    initScrollReveal();
  } catch (err) {
    console.error('Načtení aktualit selhalo:', err);
    container.innerHTML = `
      <div class="news-empty-state">
        <div class="news-empty-icon">⚠️</div>
        <h3 class="news-empty-title">Aktuality se nepodařilo načíst</h3>
        <p class="news-empty-desc">Zkuste stránku prosím za chvíli obnovit.</p>
      </div>
    `;
  }
}

// Render Funkce Pro Stránku "Aktuality" (SYNCHRONNÍ INSTANTNÍ RENDERING HERO SEKCE)
const getNewsPageHTML = (allItems = []) => {
  const activeItems = (allItems || []).filter(item => item.is_active);

  return `
    <div class="news-page-wrapper">
      <!-- 1. HERO SEKCE AKTUALIT -->
      <section class="hero-section rooms-hero-section room-detail-hero news-hero-section" id="uvod-aktuality">
        <picture>
          <source media="(max-width: 767px)" srcset="/Fotky%20Aktivit/Aktulity%20hero%20sekce%20mobil.webp">
          <img class="hero-news-poster" src="/Fotky Aktivit/Aktulity hero sekce.webp" alt="Aktuality Hotel u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
        </picture>
        <div class="hero-overlay"></div>
        <div class="hero-inner">
          ${getHeaderHTML()}

          <div class="room-detail-hero-center news-hero-center">
            <h1 class="hero-title room-detail-hero-title">
              <span class="desktop-title-text">Aktuality a novinky z Hotelu U Můstků</span>
              <span class="mobile-tablet-title-text">Aktuality & Novinky</span>
            </h1>
            <p class="room-detail-hero-subtitle">
              <span class="desktop-sub-text">Sledujte nejnovější dění, chystané akce a důležitá oznámení z Hotelu u Můstku.</span>
              <span class="mobile-sub-text">Sledujte nejnovější dění a důležitá oznámení z Hotelu u Můstku.</span>
            </p>
            <button class="btn btn-news-hero-btn room-detail-hero-btn" id="btn-goto-news-list">Prohlédnout novinky</button>
          </div>

          <!-- Spodní odskrolovávací šipka (mobil + tablet) -->
          <div class="scroll-down-btn mobile-only-scroll-btn" id="scroll-btn-aktuality">
            <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
            </svg>
          </div>
        </div>
      </section>

      <!-- 2. HLAVNÍ SEKCE VÝPISU AKTUALIT -->
      <section class="news-main-section" id="seznam-aktualit">
        <div class="news-main-inner" id="news-main-inner-container">
          ${renderNewsCardsHTML(activeItems)}
        </div>
      </section>

      ${getCtaHTML()}
      ${getFooterHTML()}
    </div>
  `;
};

// Render Funkce Pro Admin a Rezervaci
export const getAdminPageHTML = () => `
  <section class="hero-section booking-hero-section admin-hero-section" id="uvod-admin">
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <div class="booking-hero-center">
        <h1 class="booking-hero-main-title">Recepční systém</h1>
        <p class="booking-hero-subtitle">Správa a přehled rezervací Hotelu u Můstku</p>
      </div>
    </div>
  </section>

  <main class="admin-page-main">
    <div id="admin-container"></div>
  </main>
  ${getFooterHTML()}
`;

export const getBookingPageHTML = () => `
  <div class="booking-page">
    <!-- HERO SEKCE REZERVAČNÍ STRÁNKY (ORIGINÁLNÍ 1:1 DLE STYLU BOOKING.CSS) -->
    <section class="booking-hero-section" id="uvod-rezervace">
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        ${getHeaderHTML()}

        <div class="booking-hero-center">
          <div class="booking-hero-center-group">
            <h1 class="booking-hero-main-title">Rezervace pobytu</h1>
            <p class="booking-hero-subtitle">Zvolte si termín, pokoj a doplňkové služby pro váš pobyt v Jizerských horách.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- HLAVNÍ OBSAH REZERVAČNÍHO SYSTÉMU -->
    <main class="booking-main-content">
      <div id="booking-container"></div>
    </main>

    ${getFooterHTML()}
  </div>
`;

// Render Funkce Pro Právní Stránky (GDPR & Cookies)
export const getGdprPageHTML = () => `
  <div class="legal-page">
    <!-- HERO SEKCE -->
    <section class="hero-section room-detail-hero" id="uvod-gdpr">
      <img src="/uvodni_hero_sekce.webp" alt="Hotel U Můstků - Ochrana osobních údajů" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; filter: brightness(0.88);">
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        ${getHeaderHTML()}

        <div class="room-detail-hero-center">
          <h1 class="hero-title room-detail-hero-title">
            <span>Ochrana osobních údajů (GDPR)</span>
          </h1>
          <p class="room-detail-hero-subtitle">
            <span>Informace o tom, jak nakládáme s vašimi osobními údaji při rezervaci ubytování a při používání našeho webu.</span>
          </p>
        </div>
      </div>
    </section>

    <!-- OBSAHOVÁ SEKCE -->
    <section class="legal-page-content-section">
      <div class="legal-page-inner">
            <div class="legal-article-card">
              <p class="legal-article-text" style="margin-bottom: 0;">Účinné od 1. srpna 2026. V těchto zásadách vám srozumitelně popisujeme, jaké údaje o vás zpracováváme, proč to děláme a jaká máte práva. Zpracování se řídí nařízením Evropského parlamentu a Rady (EU) 2016/679 (GDPR) a zákonem č. 110/2019 Sb., o zpracování osobních údajů.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">1. Kdo s vašimi údaji nakládá</h2>
              <p class="legal-article-text">Správcem osobních údajů je provozovatelka Hotelu U Můstků:</p>
              <p class="legal-article-text">
                <strong>Lenka Bellingerová</strong><br>
                IČ: 74349074, zapsána v živnostenském rejstříku (Živnostenský úřad Poděbrady)<br>
                Sídlo: Budovcova 1148/80, Poděbrady III, 290 01 Poděbrady<br>
                Provozovna, kam se na nás obracejte: Hotel U Můstků, Údolní 368, Desná v Jizerských horách 1, 468 61<br>
                Telefon: <a href="tel:+420777666273" style="color: #1c1c19; text-decoration: underline;">+420 777 666 273</a><br>
                E-mail: <a href="mailto:hotel@umustku.cz" style="color: #1c1c19; text-decoration: underline;">hotel@umustku.cz</a>
              </p>
              <p class="legal-article-text">Nemáme povinnost jmenovat pověřence pro ochranu osobních údajů. Se vším, co se týká vašich údajů, se proto obracejte přímo na nás na výše uvedený e-mail nebo telefon.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">2. Jaké údaje zpracováváme, proč a na jakém základě</h2>
              <p class="legal-article-text">Zpracováváme pouze údaje, které od vás dostaneme přímo — vyplněním formuláře, telefonicky, e-mailem nebo při příjezdu. Údaje o vás nikde nekupujeme ani je nezískáváme z jiných zdrojů.</p>

              <table class="legal-info-table">
                <thead>
                  <tr>
                    <th>Účel zpracování</th>
                    <th>Zpracovávané údaje</th>
                    <th>Právní základ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Rezervace a poskytnutí ubytování</strong></td>
                    <td>Jméno a příjmení, e-mail, telefon, adresa (ulice, město, PSČ, země), termín pobytu, typ pokoje, počet dospělých a dětí, doplňkové služby (polopenze, pes, dobíjení elektrokola), poznámka k rezervaci, celková cena a výše zálohy.</td>
                    <td>Plnění smlouvy o ubytování<br><span style="opacity: 0.75;">(čl. 6 odst. 1 písm. b) GDPR)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Zákonná evidence ubytovaných hostů</strong><br><span style="opacity: 0.75;">evidenční kniha, u cizinců domovní kniha</span></td>
                    <td>Jméno a příjmení, datum narození, adresa trvalého pobytu, číslo a typ dokladu totožnosti, doba ubytování, účel pobytu. U cizinců navíc státní občanství a číslo víza. Údaje se evidují o <strong>všech</strong> ubytovaných osobách, tedy i o spolucestujících a dětech.</td>
                    <td>Splnění právní povinnosti<br><span style="opacity: 0.75;">(čl. 6 odst. 1 písm. c) GDPR; zákon č. 565/1990 Sb., o místních poplatcích, a zákon č. 326/1999 Sb., o pobytu cizinců)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Vystavení dokladu a vedení účetnictví</strong></td>
                    <td>Jméno a příjmení, adresa, popis a cena poskytnutých služeb, údaje o platbě.</td>
                    <td>Splnění právní povinnosti<br><span style="opacity: 0.75;">(čl. 6 odst. 1 písm. c) GDPR; zákon č. 563/1991 Sb., o účetnictví, a daňové předpisy)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Odpověď na dotaz z kontaktního formuláře</strong></td>
                    <td>Jméno a příjmení, e-mail, telefon, obsah zprávy.</td>
                    <td>Provedení opatření před uzavřením smlouvy na vaši žádost, případně náš oprávněný zájem odpovědět vám<br><span style="opacity: 0.75;">(čl. 6 odst. 1 písm. b) a f) GDPR)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Zveřejnění vaší recenze</strong><br><span style="opacity: 0.75;">pokud nám ji sami napíšete</span></td>
                    <td>Jméno nebo jeho zkrácená podoba, text hodnocení, datum pobytu.</td>
                    <td>Váš souhlas, který můžete kdykoli odvolat<br><span style="opacity: 0.75;">(čl. 6 odst. 1 písm. a) GDPR)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Kamerový systém na parkovišti</strong></td>
                    <td>Obrazový záznam osob a vozidel v prostoru parkoviště. Zvuk se nezaznamenává.</td>
                    <td>Náš oprávněný zájem na ochraně majetku hostů i hotelu<br><span style="opacity: 0.75;">(čl. 6 odst. 1 písm. f) GDPR)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Zajištění základního chodu webu</strong></td>
                    <td>Nezbytné soubory cookies a údaj o vaší volbě v cookie liště, uložený ve vašem prohlížeči.</td>
                    <td>Náš oprávněný zájem na tom, aby web fungoval a pamatoval si vaše nastavení<br><span style="opacity: 0.75;">(čl. 6 odst. 1 písm. f) GDPR)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Měření návštěvnosti webu</strong></td>
                    <td>Anonymizovaná IP adresa, typ zařízení a prohlížeče, navštívené stránky, doba návštěvy, zdroj příchodu.</td>
                    <td>Váš souhlas udělený v cookie liště, který můžete kdykoli odvolat<br><span style="opacity: 0.75;">(čl. 6 odst. 1 písm. a) GDPR)</span></td>
                  </tr>
                </tbody>
              </table>

              <p class="legal-article-text" style="margin-top: 20px;"><strong>Údaje dětí.</strong> Pokud s vámi cestují děti, evidujeme o nich pouze údaje, které nám ukládá zákon o evidenci ubytovaných. Za správnost těchto údajů odpovídá jejich zákonný zástupce, který rezervaci provádí. Web ani rezervační formulář nejsou určeny k tomu, aby je vyplňovaly děti samostatně.</p>

              <p class="legal-article-text"><strong>Citlivé údaje nezpracováváme.</strong> Nesbíráme žádné údaje o zdravotním stavu, náboženském vyznání, politických názorech ani jiné zvláštní kategorie údajů podle čl. 9 GDPR. Prosíme, neuvádějte je ani do poznámky k rezervaci — pokud potřebujete sdělit něco citlivého, zavolejte nám.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">3. Musíte nám údaje poskytnout?</h2>
              <p class="legal-article-text">Záleží na tom, o které údaje jde:</p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Údaje pro rezervaci</strong> jsou smluvním požadavkem. Bez jména, kontaktu a termínu vám pobyt nemůžeme zajistit ani potvrdit.</li>
                <li><strong>Údaje do evidenční a domovní knihy</strong> jsou zákonným požadavkem. Bez nich vás nesmíme ubytovat — nejde o naše rozhodnutí, ukládá nám to zákon.</li>
                <li><strong>Souhlas s měřením návštěvnosti a se zveřejněním recenze</strong> je zcela dobrovolný. Když ho nedáte nebo ho odvoláte, nemá to na vaši rezervaci ani na pobyt žádný vliv.</li>
              </ul>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">4. Jak dlouho údaje uchováváme</h2>
              <p class="legal-article-text">Údaje držíme jen po nezbytně nutnou dobu. Po jejím uplynutí je mažeme nebo skartujeme.</p>
              <table class="legal-info-table">
                <thead>
                  <tr>
                    <th>Údaje</th>
                    <th>Doba uchování</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Rezervace a související komunikace</td>
                    <td>Po dobu pobytu a následně 4 roky od jeho skončení — kvůli možným nárokům z uzavřené smlouvy.</td>
                  </tr>
                  <tr>
                    <td>Evidenční kniha a domovní kniha</td>
                    <td>6 let od posledního zápisu, jak ukládá zákon.</td>
                  </tr>
                  <tr>
                    <td>Účetní a daňové doklady</td>
                    <td>Po dobu stanovenou účetními a daňovými předpisy, zpravidla 10 let od konce zdaňovacího období.</td>
                  </tr>
                  <tr>
                    <td>Dotazy z kontaktního formuláře</td>
                    <td>1 rok od vyřízení dotazu. Pokud z dotazu vznikne rezervace, řídí se dobou uchování rezervace.</td>
                  </tr>
                  <tr>
                    <td>Záznamy z kamerového systému</td>
                    <td>Nejdéle 7 dní, poté se automaticky přepisují. Déle jen tehdy, pokud by záznam zachytil protiprávní jednání a byl předán policii nebo pojišťovně.</td>
                  </tr>
                  <tr>
                    <td>Zveřejněné recenze</td>
                    <td>Do odvolání vašeho souhlasu.</td>
                  </tr>
                  <tr>
                    <td>Cookies a údaje z měření návštěvnosti</td>
                    <td>Podle jednotlivých souborů. Analytické cookies nejdéle 2 roky, nezbytné do jejich smazání ve vašem prohlížeči. Úplný přehled najdete v <a href="/cookies" style="color: #1c1c19; text-decoration: underline;">zásadách používání cookies</a>.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">5. Komu údaje předáváme</h2>
              <p class="legal-article-text">Vaše údaje nikdy neprodáváme a nepředáváme je nikomu pro reklamní účely. Předáváme je pouze těm, bez kterých bychom hotel nemohli provozovat, a orgánům, kterým to ukládá zákon.</p>

              <p class="legal-article-text" style="margin-bottom: 8px;"><strong>Technickým partnerům, kteří pro nás data zpracovávají:</strong></p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Supabase Inc.</strong> — zabezpečená databáze rezervací a zpráv. Data jsou uložena na serverech v Evropské unii (Frankfurt, Německo).</li>
                <li><strong>Resend, Inc.</strong> — rozesílání potvrzovacích e-mailů o rezervaci.</li>
                <li><strong>Netlify, Inc.</strong> — hosting a provoz těchto webových stránek.</li>
                <li><strong>Google Ireland Limited</strong> — měření návštěvnosti (Google Analytics). Pouze tehdy, pokud jste k tomu dali souhlas v cookie liště.</li>
              </ul>

              <p class="legal-article-text" style="margin-bottom: 8px;"><strong>Dalším příjemcům:</strong></p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li>Naší účetní, která zpracovává doklady a daňovou evidenci.</li>
                <li><strong>Cizinecké policii</strong> — u zahraničních hostů máme zákonnou povinnost oznámit ubytování do 3 dnů od jeho zahájení.</li>
                <li><strong>Městskému úřadu Desná</strong> — v souvislosti s odvodem místního poplatku z pobytu.</li>
                <li>Orgánům veřejné moci (finanční úřad, soud, policie), pokud nás o to požádají v mezích svých pravomocí.</li>
              </ul>
              <p class="legal-article-text">Se všemi technickými partnery máme uzavřené smlouvy o zpracování osobních údajů podle čl. 28 GDPR. Zavazují je zpracovávat data jen podle našich pokynů a zajistit jejich zabezpečení.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">6. Předávání údajů mimo Evropskou unii</h2>
              <p class="legal-article-text">Databáze s vašimi rezervacemi je uložena na serverech v Evropské unii, konkrétně ve Frankfurtu nad Mohanem.</p>
              <p class="legal-article-text">Někteří naši partneři jsou americké společnosti, a proto může v omezené míře docházet k předání údajů do Spojených států — například při odeslání potvrzovacího e-mailu nebo při technické podpoře. Toto předání je zajištěno <strong>rozhodnutím Evropské komise o odpovídající ochraně</strong> ze dne 10. července 2023 (rámec EU-U.S. Data Privacy Framework), případně standardními smluvními doložkami schválenými Evropskou komisí podle čl. 46 GDPR. Platnost tohoto rozhodnutí potvrdil Tribunál Soudního dvora Evropské unie v září 2025.</p>
              <p class="legal-article-text">Do jiných zemí mimo Evropskou unii vaše údaje nepředáváme.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">7. Jak vaše údaje chráníme</h2>
              <p class="legal-article-text">Přijali jsme technická i organizační opatření, aby se k vašim údajům nedostal nikdo nepovolaný:</p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li>Celý web běží na šifrovaném spojení HTTPS.</li>
                <li>Přístup do rezervačního systému má jen provozovatelka a pověřené osoby, každá s vlastním heslem.</li>
                <li>Listinnou evidenční knihu uchováváme v uzamčeném prostoru mimo dosah hostů.</li>
                <li>K záznamům z kamer má přístup pouze provozovatelka hotelu.</li>
                <li>Osoby, které s údaji přicházejí do styku, jsou vázány mlčenlivostí.</li>
              </ul>
              <p class="legal-article-text">Pokud by i přes tato opatření došlo k porušení zabezpečení, které by pro vás znamenalo vysoké riziko, budeme vás o tom bez zbytečného odkladu informovat a případ nahlásíme Úřadu pro ochranu osobních údajů do 72 hodin.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">8. Automatizované rozhodování neprovádíme</h2>
              <p class="legal-article-text">O ničem, co se vás týká, nerozhoduje počítač sám. Každou rezervaci posuzuje a schvaluje živý člověk. Neprovádíme profilování ani automatizované rozhodování ve smyslu čl. 22 GDPR.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">9. Jaká máte práva</h2>
              <p class="legal-article-text">Ve vztahu ke svým osobním údajům máte tato práva:</p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Právo na přístup</strong> — můžete se nás zeptat, jaké údaje o vás máme, a vyžádat si jejich kopii.</li>
                <li><strong>Právo na opravu</strong> — pokud jsou vaše údaje nepřesné nebo neúplné, opravíme je.</li>
                <li><strong>Právo na výmaz</strong>, kterému se říká „právo být zapomenut“ — smažeme údaje, které už nepotřebujeme. Netýká se údajů, které nám ukládá uchovávat zákon, typicky evidenční knihy a účetních dokladů.</li>
                <li><strong>Právo na omezení zpracování</strong> — dokud se nevyjasní vaše námitka nebo správnost údajů, budeme je pouze uchovávat a nic dalšího s nimi dělat nebudeme.</li>
                <li><strong>Právo na přenositelnost</strong> — údaje, které zpracováváme na základě smlouvy nebo souhlasu, vám vydáme ve strojově čitelném formátu, případně je předáme jinému správci.</li>
                <li><strong>Právo vznést námitku</strong> proti zpracování, které stavíme na oprávněném zájmu — tedy proti kamerovému systému nebo nezbytným cookies.</li>
                <li><strong>Právo odvolat souhlas</strong> — u měření návštěvnosti a u zveřejněné recenze kdykoli a bez udání důvodu. Odvolání nemá vliv na zákonnost zpracování před jeho odvoláním.</li>
                <li><strong>Právo podat stížnost u dozorového úřadu</strong>, pokud máte za to, že s vašimi údaji nakládáme špatně.</li>
              </ul>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">10. Jak svá práva uplatnit</h2>
              <p class="legal-article-text">Napište nám na <a href="mailto:hotel@umustku.cz" style="color: #1c1c19; text-decoration: underline;">hotel@umustku.cz</a>, zavolejte na <a href="tel:+420777666273" style="color: #1c1c19; text-decoration: underline;">+420 777 666 273</a> nebo nám pošlete dopis na adresu Údolní 368, Desná v Jizerských horách 1, 468 61.</p>
              <p class="legal-article-text">Vyřídíme to <strong>do jednoho měsíce</strong>. Pokud by šlo o složitější případ, můžeme lhůtu prodloužit nejvýše o další dva měsíce — vždy vás o tom předem uvědomíme. Vyřízení je zdarma. Zaplatit přiměřený poplatek můžeme požadovat jen u zjevně nedůvodných nebo opakovaných žádostí.</p>
              <p class="legal-article-text">Abychom údaje nevydali nesprávné osobě, můžeme vás požádat o ověření totožnosti.</p>
              <p class="legal-article-text" style="margin-bottom: 8px;"><strong>Stížnost můžete podat u dozorového úřadu:</strong></p>
              <p class="legal-article-text">
                Úřad pro ochranu osobních údajů<br>
                Pplk. Sochora 727/27, 170 00 Praha 7 – Holešovice<br>
                Telefon: +420 234 665 111<br>
                E-mail: <a href="mailto:posta@uoou.gov.cz" style="color: #1c1c19; text-decoration: underline;">posta@uoou.gov.cz</a><br>
                Web: <a href="https://uoou.gov.cz" target="_blank" rel="noopener" style="color: #1c1c19; text-decoration: underline;">uoou.gov.cz</a>
              </p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">11. Změny těchto zásad</h2>
              <p class="legal-article-text">Zásady můžeme čas od času upravit — třeba když začneme používat novou službu nebo se změní zákon. Aktuální znění najdete vždy na této stránce a nahoře je uvedeno datum účinnosti. Pokud půjde o podstatnou změnu, upozorníme na ni srozumitelně na webu.</p>
            </div>

      </div>
    </section>

    ${getCtaHTML()}
    ${getFooterHTML()}
  </div>
`;

export const getPodminkyPageHTML = () => `
  <div class="legal-page">
    <!-- HERO SEKCE -->
    <section class="hero-section room-detail-hero" id="uvod-podminky">
      <img src="/uvodni_hero_sekce.webp" alt="Hotel U Můstků - Obchodní podmínky" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; filter: brightness(0.88);">
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        ${getHeaderHTML()}

        <div class="room-detail-hero-center">
          <h1 class="hero-title room-detail-hero-title">
            <span>Obchodní podmínky a ubytovací řád</span>
          </h1>
          <p class="room-detail-hero-subtitle">
            <span>Podmínky rezervace, ceny, storno poplatky a pravidla pobytu v Hotelu U Můstků.</span>
          </p>
        </div>
      </div>
    </section>

    <!-- OBSAHOVÁ SEKCE -->
    <section class="legal-page-content-section">
      <div class="legal-page-inner">
            <div class="legal-article-card">
              <p class="legal-article-text" style="margin-bottom: 0;">Účinné od 1. srpna 2026. Tyto podmínky upravují vztah mezi vámi a Hotelem U Můstků při rezervaci a poskytnutí ubytování. Jsou nedílnou součástí smlouvy o ubytování, kterou spolu uzavíráme podle § 2326 a následujících zákona č. 89/2012 Sb., občanský zákoník. Zároveň jimi plníme informační povinnost podle § 1811 a § 1820 občanského zákoníku.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">1. Kdo vám ubytování poskytuje</h2>
              <p class="legal-article-text">
                <strong>Lenka Bellingerová</strong> — provozovatelka Hotelu U Můstků<br>
                IČ: 74349074, plátce DPH<br>
                Zapsána v živnostenském rejstříku (Živnostenský úřad Poděbrady), podniká od 1. 2. 2007<br>
                Sídlo: Budovcova 1148/80, Poděbrady III, 290 01 Poděbrady<br>
                Provozovna: Hotel U Můstků, Údolní 368, Desná v Jizerských horách 1, 468 61<br>
                Telefon: <a href="tel:+420777666273" style="color: #1c1c19; text-decoration: underline;">+420 777 666 273</a><br>
                E-mail: <a href="mailto:hotel@umustku.cz" style="color: #1c1c19; text-decoration: underline;">hotel@umustku.cz</a><br>
                Bankovní spojení: 293470312/0300 (ČSOB)
              </p>
              <p class="legal-article-text">Ubytovatel je plátcem DPH. <strong>Všechny ceny uvedené na webu i v tomto dokumentu jsou konečné a včetně DPH</strong> v zákonné sazbě. Daňové identifikační číslo uvádíme na vystavených daňových dokladech.</p>
              <p class="legal-article-text">V textu níže označujeme provozovatelku jako <strong>„ubytovatele“</strong> a vás jako <strong>„hosta“</strong>.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">2. Jak rezervace vzniká</h2>
              <p class="legal-article-text">Rezervace probíhá ve třech krocích. Teprve po posledním z nich je závazná.</p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Krok 1 — odešlete žádost.</strong> Vyplníte rezervační formulář na webu, zavoláte nebo napíšete e-mail. Obratem vám přijde e-mail s potvrzením, že jsme žádost přijali. <strong>Tento e-mail ještě není potvrzením rezervace</strong> — pouze vám sděluje, že se jí zabýváme.</li>
                <li><strong>Krok 2 — potvrdíme dostupnost a vyzveme k záloze.</strong> Ověříme, že je termín volný, a pošleme vám e-mail s pokyny k úhradě zálohy včetně QR kódu pro rychlou platbu.</li>
                <li><strong>Krok 3 — uhradíte zálohu.</strong> Jakmile záloha dorazí na náš účet, pošleme vám finální potvrzení. <strong>Tímto okamžikem je smlouva o ubytování uzavřena</strong> a pokoj je pro vás závazně blokován.</li>
              </ul>
              <p class="legal-article-text">Do odeslání finálního potvrzení si ubytovatel vyhrazuje právo rezervaci nepřijmout — například když je termín mezitím obsazen nebo když nelze ověřit vaše kontaktní údaje. V takovém případě vás bez zbytečného odkladu informujeme a případnou uhrazenou částku vám vrátíme v plné výši.</p>
              <p class="legal-article-text">Před odesláním formuláře si můžete zadané údaje zkontrolovat a opravit. Zjistíte-li v potvrzení chybu, ozvěte se nám — opravíme ji.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">3. Ceny a co je v nich zahrnuto</h2>
              <p class="legal-article-text">Ceny za ubytování jsou uvedeny za osobu a noc a jsou <strong>konečné včetně DPH</strong>. Snídaně formou švédského stolu, parkování u hotelu, Wi-Fi, využití společenské herny i <strong>místní poplatek z pobytu</strong> jsou v ceně zahrnuty.</p>

              <p class="legal-article-text"><strong>Jak se cena za ubytování určuje.</strong> Hotel nemá jedinou pevnou sazbu. Cena se počítá za každou noc zvlášť a závisí na třech věcech:</p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Termín pobytu</strong> — sazby se liší podle sezóny (zimní, letní, mezisezóna) a o víkendech může platit příplatek. Pobyt zasahující do dvou sezón se rozpočítá po jednotlivých nocích.</li>
                <li><strong>Kategorie pokoje</strong> — Standard, Nadstandard (A, A1, Zen) a Turistický pokoj mají odlišné sazby.</li>
                <li><strong>Počet osob na pokoji</strong> — cena za osobu klesá s počtem ubytovaných. Sazba pro jednoho hosta je nejvyšší, protože pokrývá celý pokoj; <strong>žádný další příplatek za samostatné obsazení se k ní už nepřičítá</strong>.</li>
              </ul>
              <p class="legal-article-text">Ubytování se snídaní začíná na <strong>700 Kč za osobu a noc</strong>. Přesnou cenu pro váš konkrétní termín, pokoj a počet osob <strong>spočítá rezervační formulář</strong> ještě před odesláním rezervace — uvidíte ji v rozpisu včetně všech příplatků a doplňkových služeb.</p>

              <p class="legal-article-text"><strong>Příplatky a doplňkové služby.</strong> Tyto položky se sezónou ani počtem osob nemění:</p>
              <table class="legal-info-table">
                <thead>
                  <tr>
                    <th>Položka</th>
                    <th>Cena</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Polopenze — večeře</td>
                    <td>+ 195 Kč / osoba / noc</td>
                  </tr>
                  <tr>
                    <td>Pes</td>
                    <td>150 Kč / den</td>
                  </tr>
                  <tr>
                    <td>Dobíjení elektrokola</td>
                    <td>15 Kč / kus / den</td>
                  </tr>
                  <tr>
                    <td>Zimní parkování<br><span style="opacity: 0.75;">1. 11. – 15. 4., volitelná služba</span></td>
                    <td>100 Kč / auto, jednorázově za pobyt</td>
                  </tr>
                  <tr>
                    <td>Parkování u hotelu se závorou a kamerovým systémem</td>
                    <td>Zdarma</td>
                  </tr>
                </tbody>
              </table>
              <p class="legal-article-text" style="margin-top: 16px;">Uvedené částky slouží k představě o struktuře ceny a platí k datu zveřejnění tohoto dokumentu. <strong>Závazná je vždy ta cena, kterou máte uvedenou ve finálním potvrzení rezervace.</strong> Ubytovatel může ceník do budoucna změnit, na již potvrzené rezervace to však nemá žádný vliv.</p>

              <p class="legal-article-text" style="margin-top: 16px;"><strong>Provoz mimo hlavní sezónu.</strong> V jarní a podzimní mezisezóně si dopřáváme kratší provozní přestávky na údržbu a odpočinek, takže hotel nemusí být otevřený každý termín a nabídka pokojů může být omezená. Rezervaci lze podat i na tato období — <strong>ubytovatel vám dostupnost potvrdí před výzvou k úhradě zálohy</strong>. Pokud termín nelze potvrdit, rezervace nevzniká a nic neplatíte.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">4. Platba</h2>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Záloha 30 %</strong> z celkové ceny pobytu je splatná do <strong>3 pracovních dnů</strong> od doručení výzvy k platbě. Uhradíte ji bankovním převodem nebo naskenováním QR kódu z e-mailu.</li>
                <li>Neuhradíte-li zálohu včas, rezervace zaniká a termín uvolňujeme dalším zájemcům. Ozvěte se nám prosím předem, pokud potřebujete více času — obvykle se domluvíme.</li>
                <li><strong>Doplatek</strong> uhradíte na místě při příjezdu nebo v průběhu pobytu, v hotovosti nebo převodem po dohodě.</li>
                <li>Ubytovatel nepoužívá žádnou online platební bránu. <strong>Platební kartu na webu nikdy nezadáváte</strong> a nikdy vás o její údaje e-mailem nežádáme.</li>
                <li>Doklad o zaplacení obdržíte při odjezdu nebo e-mailem.</li>
              </ul>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">5. Zrušení pobytu a storno poplatky</h2>
              <p class="legal-article-text">Zrušit pobyt můžete kdykoli — písemně e-mailem nebo telefonicky. Rozhodující je den, kdy nám oznámení dojde. Storno poplatek se počítá z celkové ceny pobytu. Zrušit pobyt zdarma můžete kdykoli více než 3 dny před příjezdem.</p>
              <table class="legal-info-table">
                <thead>
                  <tr>
                    <th>Kdy pobyt zrušíte</th>
                    <th>Storno poplatek</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Více než 3 dny před příjezdem</td>
                    <td><strong>Zdarma</strong> — zálohu vracíme v plné výši</td>
                  </tr>
                  <tr>
                    <td>Méně než 3 dny před příjezdem, nebo nedojezd</td>
                    <td>100 % z celkové ceny pobytu</td>
                  </tr>
                </tbody>
              </table>
              <p class="legal-article-text" style="margin-top: 16px;">Případný přeplatek vracíme na účet, ze kterého záloha přišla, nejpozději do 14 dnů od zrušení pobytu.</p>
              <p class="legal-article-text">Zkrátíte-li pobyt po příjezdu nebo odjedete-li dříve, cena za sjednané noci se nevrací.</p>
              <p class="legal-article-text"><strong>Flexibilní přesun termínu.</strong> Pokud do vašich plánů vstoupí nečekaná událost, ozvěte se nám. Po vzájemné dohodě vám rádi přesuneme pobyt na jiný vyhovující termín, aniž byste přišli o zaplacenou zálohu.</p>
              <p class="legal-article-text">Pokud by ubytovatel z vážných provozních důvodů nemohl pobyt poskytnout, nabídne vám náhradní termín nebo srovnatelné ubytování. Nepřijmete-li ani jedno, vrátíme vám celou uhrazenou částku do 14 dnů.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">6. Právo na odstoupení od smlouvy do 14 dnů se neuplatní</h2>
              <p class="legal-article-text">Na tuto informaci máme zákonnou povinnost vás upozornit, proto ji uvádíme zvlášť.</p>
              <p class="legal-article-text">U ubytování sjednaného na konkrétní termín <strong>nemáte právo odstoupit od smlouvy do 14 dnů</strong>, které jinak spotřebiteli u smluv uzavřených na dálku náleží. Vyplývá to z <strong>§ 1837 písm. j) občanského zákoníku</strong>, který z tohoto práva vyjímá smlouvy o ubytování, dopravě, stravování a využití volného času, má-li být plněno v určeném termínu.</p>
              <p class="legal-article-text">Důvodem je omezená kapacita ubytovacích zařízení — uvolněný pokoj už na poslední chvíli obvykle nelze znovu prodat.</p>
              <p class="legal-article-text">Zrušit pobyt samozřejmě můžete kdykoli, řídí se to však storno podmínkami v článku 5.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">7. Příjezd, odjezd a průběh pobytu</h2>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Příjezd (check-in):</strong> od 15:00. Přijedete-li dříve, rádi vám uschováme zavazadla.</li>
                <li><strong>Odjezd (check-out):</strong> do 10:00 v den odjezdu.</li>
                <li>Jiný čas příjezdu nebo odjezdu je možný po předchozí domluvě. Dejte nám prosím vědět, ať na vás počkáme.</li>
                <li>Při příjezdu předložíte <strong>doklad totožnosti</strong> všech ubytovaných osob. Bez něj vás nesmíme ubytovat — ukládá nám to zákon o místních poplatcích a u cizinců zákon o pobytu cizinců.</li>
                <li>Zapůjčené klíče vracíte při odjezdu. Za jejich ztrátu účtujeme náklady na výměnu zámku.</li>
              </ul>
              <p class="legal-article-text"><strong>Bezbariérovost:</strong> do budovy se vstupuje po schodech a hotel <strong>není bezbariérový</strong>. Pokud má někdo z vás sníženou pohyblivost, zavolejte nám prosím ještě před rezervací, ať společně posoudíme, zda je pro vás pobyt vhodný.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">8. Stravování</h2>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Snídaně</strong> formou švédského stolu podáváme od 8:00 do 9:00. Jsou v ceně ubytování.</li>
                <li><strong>Večeře</strong> podáváme od 18:00 do 18:30 hostům, kteří si objednali polopenzi. Jde o jednotné dvouchodové menu bez možnosti výběru z jídelního lístku.</li>
                <li>Hotel <strong>není veřejnou restaurací</strong> — vaříme výhradně pro ubytované hosty.</li>
                <li>Máte-li dietní omezení nebo alergii, dejte nám prosím vědět <strong>nejpozději 3 dny před příjezdem</strong>. Běžné úpravy včetně bezlepkové stravy zvládneme, ale potřebujeme čas na nákup surovin.</li>
                <li>Polopenzi lze doobjednat i na místě, pokud to kapacita kuchyně dovolí.</li>
              </ul>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">9. Pravidla pobytu</h2>
              <p class="legal-article-text">Tato pravidla platí pro všechny hosty. Jde o běžnou slušnost, díky které je pobyt příjemný pro každého.</p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Celý hotel je nekuřácký</strong>, včetně pokojů, balkónů a teras. Kouřit lze pouze ve vyhrazeném venkovním prostoru.</li>
                <li><strong>Noční klid</strong> platí od 22:00 do 7:00.</li>
                <li><strong>Psi jsou vítáni</strong> za poplatek 150 Kč za den. Musí být nahlášeni už při rezervaci a po hotelu se pohybovat pod vaším dohledem. Odpovídáte za škody, které způsobí, a za úklid po nich.</li>
                <li>Za děti odpovídají po celou dobu pobytu jejich zákonní zástupci. Týká se to i dětského koutku, zahrady a prostoru u splavu.</li>
                <li><strong>Řeka Bílá Desná a přírodní tůň</strong> nejsou hlídané koupaliště. Do vody vstupujete na vlastní nebezpečí.</li>
                <li>Návštěvy neubytovaných osob na pokojích jsou možné jen se souhlasem ubytovatele.</li>
                <li>Škodu na vybavení uhradíte ve výši nákladů na opravu nebo náhradu. Prosíme, nahlaste nám ji hned — řešíme to v klidu a bez dramat.</li>
                <li>Ubytovatel může ukončit pobyt bez náhrady, pokud host přes upozornění hrubě porušuje tato pravidla, obtěžuje ostatní hosty nebo poškozuje majetek.</li>
              </ul>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">10. Odpovědnost za vnesené věci</h2>
              <p class="legal-article-text">Za věci, které si do hotelu přinesete, odpovídá ubytovatel podle § 2945 a následujících občanského zákoníku.</p>
              <p class="legal-article-text">Za peníze, klenoty a jiné cennosti odpovídá ubytovatel jen do zákonem stanovené výše, pokud je nepřevzal do úschovy. <strong>Cennosti proto doporučujeme uložit u nás v recepci.</strong></p>
              <p class="legal-article-text">Škodu je nutné oznámit <strong>bez zbytečného odkladu, nejpozději do 15 dnů</strong> od chvíle, kdy jste se o ní dozvěděli. Později už nárok bohužel zaniká — plyne to přímo ze zákona.</p>
              <p class="legal-article-text">Parkoviště je vybavené závorou a kamerovým systémem. <strong>Nejde však o hlídané parkoviště</strong> ve smyslu smlouvy o úschově a ubytovatel neodpovídá za věci ponechané ve vozidle.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">11. Reklamace</h2>
              <p class="legal-article-text">Nejste-li s něčím spokojeni, řekněte nám to prosím <strong>hned na místě</strong>. Většinu věcí umíme vyřešit během chvíle — a je to výrazně lepší než zpětná reklamace, u které už nápravu poskytnout nemůžeme.</p>
              <p class="legal-article-text">Reklamaci můžete uplatnit i písemně na <a href="mailto:hotel@umustku.cz" style="color: #1c1c19; text-decoration: underline;">hotel@umustku.cz</a> nebo na adrese hotelu. Přijetí potvrdíme a vyřídíme ji <strong>nejpozději do 30 dnů</strong>, pokud se nedohodneme na delší lhůtě.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">12. Mimosoudní řešení spotřebitelských sporů</h2>
              <p class="legal-article-text">Pokud se nepodaří spor vyřešit přímo s námi, máte jako spotřebitel právo obrátit se na orgán mimosoudního řešení sporů. Tím je:</p>
              <p class="legal-article-text">
                <strong>Česká obchodní inspekce</strong><br>
                Ústřední inspektorát – oddělení ADR<br>
                Gorazdova 1969/24, 120 00 Praha 2<br>
                Web: <a href="https://adr.coi.cz" target="_blank" rel="noopener" style="color: #1c1c19; text-decoration: underline;">adr.coi.cz</a><br>
                E-mail: <a href="mailto:adr@coi.cz" style="color: #1c1c19; text-decoration: underline;">adr@coi.cz</a>
              </p>
              <p class="legal-article-text">Řízení je pro spotřebitele bezplatné a zahájit ho lze do 1 roku ode dne, kdy jste u nás uplatnili své právo poprvé.</p>
              <p class="legal-article-text">Dozor nad dodržováním předpisů na ochranu spotřebitele vykonává <strong>Česká obchodní inspekce</strong>, dozor v oblasti hygieny <strong>Krajská hygienická stanice Libereckého kraje</strong> a dozor nad živnostenským podnikáním příslušný <strong>živnostenský úřad</strong>.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">13. Ochrana osobních údajů</h2>
              <p class="legal-article-text">Jak nakládáme s vašimi údaji, podrobně popisujeme v <a href="/gdpr" style="color: #1c1c19; text-decoration: underline;">zásadách ochrany osobních údajů</a>. Najdete tam i to, jaké údaje o vás musíme ze zákona evidovat a jak dlouho.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">14. Závěrečná ustanovení</h2>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li>Smlouva se uzavírá v českém jazyce a řídí se právem České republiky. Tím nejsou dotčena práva, která vám jako spotřebiteli přiznávají předpisy státu vašeho obvyklého bydliště.</li>
                <li>Uzavřenou smlouvu i tyto podmínky archivujeme v elektronické podobě. Na požádání vám je zašleme.</li>
                <li>Ubytovatel může tyto podmínky měnit. Pro vaši rezervaci vždy platí znění účinné ke dni jejího uzavření a to vám také zasíláme v potvrzovacím e-mailu.</li>
                <li>Je-li některé ustanovení těchto podmínek neplatné, zůstávají ostatní v platnosti.</li>
                <li>Ustanovení odchylně sjednaná v písemné dohodě mají přednost před těmito podmínkami.</li>
              </ul>
            </div>

      </div>
    </section>

    ${getCtaHTML()}
    ${getFooterHTML()}
  </div>
`;

export const getCookiesPageHTML = () => `
  <div class="legal-page">
    <!-- HERO SEKCE -->
    <section class="hero-section room-detail-hero" id="uvod-cookies">
      <img src="/uvodni_hero_sekce.webp" alt="Hotel U Můstků - Cookies" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; filter: brightness(0.88);">
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        ${getHeaderHTML()}

        <div class="room-detail-hero-center">
          <h1 class="hero-title room-detail-hero-title">
            <span>Používání souborů cookies</span>
          </h1>
          <p class="room-detail-hero-subtitle">
            <span>Přehledné informace o tom, jaké cookies používáme a jak můžete kdykoliv upravit své nastavení.</span>
          </p>
        </div>
      </div>
    </section>

    <!-- OBSAHOVÁ SEKCE -->
    <section class="legal-page-content-section">
      <div class="legal-page-inner">
            <div class="legal-article-card">
              <p class="legal-article-text" style="margin-bottom: 0;">Účinné od 1. srpna 2026. Na této stránce najdete úplný seznam toho, co si náš web ukládá do vašeho zařízení, k čemu to slouží a jak dlouho to tam zůstane. Ukládání se řídí § 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích, a nařízením GDPR.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">1. Co to vlastně je</h2>
              <p class="legal-article-text">Cookies jsou malé soubory, které web uloží do vašeho prohlížeče. Díky nim si stránka pamatuje, co jste na ní udělali — třeba že jste už odpověděli na otázku ohledně cookies a nemusíme se vás ptát znovu při každém načtení.</p>
              <p class="legal-article-text">Náš web používá vedle klasických cookies také takzvané <strong>místní úložiště prohlížeče</strong> (localStorage). Funguje podobně, jen data zůstávají uložená ve vašem počítači nebo telefonu a neodesílají se s každým požadavkem na server. Z pohledu zákona i vašeho soukromí platí pro obojí stejná pravidla, a proto obojí najdete v přehledu níže.</p>
              <p class="legal-article-text"><strong>Bez vašeho souhlasu nespouštíme nic, co by nebylo nezbytné pro fungování webu.</strong> Měřicí kód Google Analytics se do stránky vůbec nenačte, dokud v cookie liště nepotvrdíte souhlas.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">2. Nezbytné soubory</h2>
              <p class="legal-article-text">Bez těchto souborů by web nefungoval správně. Neslouží ke sledování, nesbírají o vás žádné údaje pro reklamu a nepředáváme je nikomu dalšímu. Podle zákona k nim nepotřebujeme váš souhlas — proto je v cookie liště nelze vypnout.</p>
              <table class="legal-info-table">
                <thead>
                  <tr>
                    <th>Název</th>
                    <th>K čemu slouží</th>
                    <th>Doba uložení</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>hotel_cookie_consent_v1</strong></td>
                    <td>Pamatuje si vaši volbu v cookie liště, abychom se vás neptali znovu při každé návštěvě.</td>
                    <td>Do smazání v prohlížeči</td>
                  </tr>
                  <tr>
                    <td><strong>hotel_season_mode</strong></td>
                    <td>Pamatuje si, jestli si web prohlížíte v letním, nebo zimním zobrazení.</td>
                    <td>Do smazání v prohlížeči</td>
                  </tr>
                  <tr>
                    <td><strong>hotel_umustku_reservations_v1</strong></td>
                    <td>Uchová vaši rozpracovanou a odeslanou rezervaci, abyste si ji mohli znovu zobrazit a nemuseli ji vyplňovat znovu.</td>
                    <td>Do smazání v prohlížeči</td>
                  </tr>
                  <tr>
                    <td><strong>hotel_umustku_discount_codes_v1</strong><br><strong>hotel_umustku_used_discounts_v1</strong></td>
                    <td>Eviduje slevové kódy a to, které z nich už byly z tohoto zařízení uplatněny.</td>
                    <td>Do smazání v prohlížeči</td>
                  </tr>
                  <tr>
                    <td><strong>hotel_umustku_blocked_dates_v1</strong><br><strong>hotel_umustku_room_prices_v1</strong><br><strong>hotel_umustku_disabled_rooms_v1</strong></td>
                    <td>Ukládají obsazené termíny, ceník a dostupnost pokojů, aby se rezervační formulář načítal rychle a nemusel se pokaždé dotazovat serveru.</td>
                    <td>Do smazání v prohlížeči</td>
                  </tr>
                </tbody>
              </table>
              <p class="legal-article-text" style="margin-top: 16px;">Tyto údaje zpracováváme na základě našeho oprávněného zájmu na tom, aby web fungoval a pamatoval si vaše nastavení (čl. 6 odst. 1 písm. f) GDPR).</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">3. Analytické soubory</h2>
              <p class="legal-article-text">Používáme je jen tehdy, pokud nám k tomu dáte souhlas. Slouží k tomu, abychom věděli, které stránky lidi zajímají a kde se web chová špatně — třeba že se někde návštěvníci často zaseknou. <strong>Nesledujeme jednotlivé osoby a vaši IP adresu máme nastavenou tak, aby se anonymizovala.</strong></p>
              <table class="legal-info-table">
                <thead>
                  <tr>
                    <th>Název</th>
                    <th>Kdo jej ukládá</th>
                    <th>K čemu slouží</th>
                    <th>Doba uložení</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>_ga</strong></td>
                    <td>Google Analytics 4</td>
                    <td>Rozlišuje jednotlivé návštěvníky, aby se stejný člověk nepočítal opakovaně.</td>
                    <td>2 roky</td>
                  </tr>
                  <tr>
                    <td><strong>_ga_X62MWWL0FV</strong></td>
                    <td>Google Analytics 4</td>
                    <td>Udržuje stav návštěvy a měří, jak dlouho na webu zůstáváte.</td>
                    <td>2 roky</td>
                  </tr>
                </tbody>
              </table>
              <p class="legal-article-text" style="margin-top: 16px;">Poskytovatelem je <strong>Google Ireland Limited</strong>, Gordon House, Barrow Street, Dublin 4, Irsko. Údaje mohou být předány do Spojených států — takové předání je zajištěno rozhodnutím Evropské komise o odpovídající ochraně ze dne 10. července 2023 (rámec EU-U.S. Data Privacy Framework). Podrobnosti najdete v <a href="/gdpr" style="color: #1c1c19; text-decoration: underline;">zásadách ochrany osobních údajů</a>.</p>
              <p class="legal-article-text">Právním základem je váš souhlas (čl. 6 odst. 1 písm. a) GDPR), který můžete kdykoli odvolat tlačítkem na konci této stránky.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">4. Co na webu nenajdete</h2>
              <p class="legal-article-text">Pro pořádek uvádíme i to, co nepoužíváme:</p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Žádné reklamní ani marketingové cookies.</strong> Nesledujeme vás po internetu a nezobrazujeme vám cílenou reklamu.</li>
                <li><strong>Žádné sledovací pixely sociálních sítí</strong> — nemáme zde Facebook Pixel ani nic podobného.</li>
                <li><strong>Žádný prodej dat.</strong> Údaje o vaší návštěvě nikomu neprodáváme ani nepředáváme k reklamním účelům.</li>
              </ul>
              <p class="legal-article-text">Web načítá písma ze služby Google Fonts a úvodní video z úložiště Supabase. Při tomto načtení se přenáší vaše IP adresa, což je technicky nutné pro doručení obsahu. Žádné soubory se přitom do vašeho zařízení neukládají.</p>
            </div>

            <div class="legal-article-card">
              <h2 class="legal-article-title">5. Jak si cookies smazat v prohlížeči</h2>
              <p class="legal-article-text">Kromě tlačítka níže můžete uložené soubory kdykoli smazat přímo v nastavení svého prohlížeče. Postup se liší podle toho, co používáte:</p>
              <ul style="line-height: 1.7; color: #4a4a46; padding-left: 20px;">
                <li><strong>Chrome:</strong> Nastavení → Ochrana soukromí a zabezpečení → Vymazat údaje o prohlížení</li>
                <li><strong>Safari:</strong> Nastavení → Safari → Smazat historii a data webů</li>
                <li><strong>Firefox:</strong> Nastavení → Soukromí a zabezpečení → Cookies a data stránek → Vymazat data</li>
                <li><strong>Edge:</strong> Nastavení → Soubory cookie a oprávnění webu → Spravovat a odstranit soubory cookie</li>
              </ul>
              <p class="legal-article-text">Upozorňujeme, že po smazání nezbytných souborů se vás web znovu zeptá na souhlas s cookies a zapomene vaše nastavení zobrazení i rozpracovanou rezervaci.</p>
            </div>

            <div class="legal-article-card" style="text-align: center;">
              <h2 class="legal-article-title">6. Změna nastavení</h2>
              <p class="legal-article-text">Svou volbu můžete kdykoli změnit nebo souhlas odvolat. Odvolání nemá vliv na zákonnost zpracování, ke kterému došlo před ním. Klikněte na tlačítko a znovu se otevře okno s nastavením:</p>

              <div style="margin-top: 24px; display: flex; justify-content: center;">
                <button class="btn btn-cookie-modal-save" id="btn-open-cookie-settings-page">Změnit nastavení cookies</button>
              </div>
            </div>

      </div>
    </section>

    ${getCtaHTML()}
    ${getFooterHTML()}
  </div>
`;

// Render Funkce Pro Stránku "Kontakt"
const getContactPageHTML = () => `
  <div class="contact-page-wrapper">
    <!-- 1. HERO SEKCE KONTAKTU -->
    <section class="hero-section rooms-hero-section room-detail-hero contact-hero-section" id="uvod-kontakt">
      <img class="hero-contact-poster" src="/kontakt/vyhled-na-mustky.webp" alt="Kontakt Hotel u Můstku" fetchpriority="high" loading="eager" decoding="async" fetchpriority="high" loading="eager" decoding="async" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        ${getHeaderHTML()}

        <div class="room-detail-hero-center contact-hero-center">
          <h1 class="hero-title room-detail-hero-title">
            <span class="desktop-title-text">Kontakt a cesta k hotelu v Desné</span>
            <span class="mobile-tablet-title-text">Kontakt a cesta k hotelu v Desné</span>
          </h1>
          <p class="room-detail-hero-subtitle">
            <span class="desktop-sub-text">Vše na jednom místě — jak nás zastihnout, jak k nám dojedete a kde nás přesně najdete. Rádi vám se vším poradíme.</span>
            <span class="mobile-sub-text">Vše na jednom místě — jak nás zastihnout, jak k nám dojedete a kde nás přesně najdete. Rádi vám se vším poradíme.</span>
          </p>
          <button class="btn btn-contact-hero-btn room-detail-hero-btn" id="btn-goto-contact-form">Napište nám</button>
        </div>

        <!-- Spodní odskrolovávací šipka (mobil + tablet) -->
        <div class="scroll-down-btn mobile-only-scroll-btn" id="scroll-btn-kontakt">
          <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
          </svg>
        </div>
      </div>
    </section>

    <!-- 2. KONTAKTNÍ ÚDAJE A FORMULÁŘ NAPIŠTE NÁM -->
    <section class="contact-main-section" id="kontaktní-udaje">
      <div class="contact-main-inner">
        <!-- Levý sloupec: Kontakty -->
        <div class="contact-info-column">
          <div class="contact-info-list" data-anim-group>
            <!-- Item 1: Adresa -->
            <div class="contact-info-item" data-anim="up">
              <div class="contact-info-icon-wrap">
                <img src="/Icons/Ikony/location.png" alt="" class="contact-info-icon">
              </div>
              <div class="contact-info-text">
                <span class="contact-info-label">Adresa</span>
                <h3 class="contact-info-title">Údolní 368</h3>
                <p class="contact-info-sub">468 61 Desná v Jizerských horách 1</p>
              </div>
            </div>

            <!-- Item 2: Telefon -->
            <div class="contact-info-item" data-anim="up">
              <div class="contact-info-icon-wrap">
                <img src="/Icons/Ikony/phone-flip.png" alt="" class="contact-info-icon">
              </div>
              <div class="contact-info-text">
                <span class="contact-info-label">Telefon</span>
                <h3 class="contact-info-title"><a href="tel:+420777666273" class="contact-link">+420 777 666 273</a></h3>
                <p class="contact-info-sub">Lenka Bellingerová — majitelka</p>
              </div>
            </div>

            <!-- Item 3: E-mail -->
            <div class="contact-info-item" data-anim="up">
              <div class="contact-info-icon-wrap">
                <img src="/Icons/Ikony/envelope.png" alt="" class="contact-info-icon">
              </div>
              <div class="contact-info-text">
                <span class="contact-info-label">E-mail</span>
                <h3 class="contact-info-title"><a href="mailto:hotel@umustku.cz" class="contact-link">hotel@umustku.cz</a></h3>
                <p class="contact-info-sub">Odpovídáme zpravidla do 48 hodin</p>
              </div>
            </div>

            <!-- Item 4: Provoz -->
            <div class="contact-info-item" data-anim="up">
              <div class="contact-info-icon-wrap">
                <img src="/Icons/Ikony/clock.png" alt="" class="contact-info-icon">
              </div>
              <div class="contact-info-text">
                <span class="contact-info-label">Provoz</span>
                <h3 class="contact-info-title">Po–Ne : 8:00–20:00</h3>
                <p class="contact-info-sub">Pozdější příjezd po telefonické domluvě</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Pravý sloupec: Formulář -->
        <div class="contact-form-column" id="form-sekce" data-anim="right">
          <h2 class="contact-form-title">Napište nám</h2>
          <form id="contact-page-form" class="contact-form-element">
            <div class="contact-form-row">
              <div class="contact-form-group">
                <label for="contact-name" class="contact-form-label">Jméno *</label>
                <input type="text" id="contact-name" name="name" required class="contact-form-input">
              </div>
              <div class="contact-form-group">
                <label for="contact-surname" class="contact-form-label">Příjmení *</label>
                <input type="text" id="contact-surname" name="surname" required class="contact-form-input">
              </div>
            </div>

            <div class="contact-form-row">
              <div class="contact-form-group">
                <label for="contact-email" class="contact-form-label">E-mail *</label>
                <input type="email" id="contact-email" name="email" required class="contact-form-input">
              </div>
              <div class="contact-form-group">
                <label for="contact-phone" class="contact-form-label">Telefon</label>
                <input type="tel" id="contact-phone" name="phone" class="contact-form-input">
              </div>
            </div>

            <div class="contact-form-group contact-form-full">
              <label for="contact-message" class="contact-form-label">Zpráva</label>
              <textarea id="contact-message" name="message" rows="1" class="contact-form-textarea"></textarea>
            </div>

            <div class="contact-form-gdpr">
              <label class="contact-checkbox-label">
                <input type="checkbox" id="contact-gdpr-check" required>
                <span class="contact-checkbox-custom"></span>
                <span class="contact-checkbox-text">Beru na vědomí, že mé údaje použijete pouze k vyřízení tohoto dotazu, a seznámil/a jsem se se <a href="/gdpr" target="_blank" rel="noopener">zásadami ochrany osobních údajů</a>.</span>
              </label>
            </div>

            <div class="contact-form-submit-wrap">
              <button type="submit" class="btn btn-contact-submit">Odeslat zprávu</button>
            </div>
            <div id="contact-form-status" class="contact-form-status" style="display: none;"></div>
          </form>
        </div>
      </div>
    </section>

    <!-- 4. O NÁS -->
    <section class="contact-about-section" id="o-nas">
      <div class="contact-about-inner">
        <div class="contact-about-grid" data-anim-group>
          <!-- Fotka majitelů odsud byla odstraněna na přání majitele
               (21. 8. 2026). Sekce proto stojí jen na textu: nadpis
               vlevo, příběh vpravo — dvě poloviny se prázdným místem po
               fotce by vypadaly jako nedodělek. -->
          <div class="contact-about-uvod">
            <h2 class="contact-about-title" data-anim="up">Hory jsou pro nás poslání,<br>ne jen podnikání</h2>
            <p class="contact-about-podnadpis" data-anim="up">Desná v Jizerských horách</p>
          </div>

          <!-- Text -->
          <div class="contact-about-text">

            <!-- Na mobilu se odstavce sbalí a rozbaluje je tlačítko níž;
                 na větších obrazovkách je zkrácení vypnuté v CSS. -->
            <div class="contact-about-body" id="contact-about-body" data-anim="up">
              <p class="contact-about-p">
                Horský hotel u Můstků stojí v Desné v Jizerských horách, v údolí Bílé Desné a pár kroků od areálu skokanských můstků. Vedeme ho sami a osobně — bez anonymní recepce a bez pravidel vymyšlených někým v centrále. Hory jsou pro nás krásné, i když počasí tu umí být nevyzpytatelné, a naši práci bereme spíš jako poslání než jako způsob, jak zbohatnout.
              </p>
              <p class="contact-about-p">
                Chceme, aby se u nás hosté při odpočinku na horách cítili jako doma. Vaříme poctivou domácí kuchyni z čerstvých surovin, snídani podáváme formou bufetu a večer se dá posedět u krbu v hotelové restauraci. Podle počasí poradíme, kam se vydat, a když nemáte auto, odvoz pomůžeme zařídit.
              </p>
              <p class="contact-about-p">
                Největší odměnou je pro nás spokojený host, který se rád vrací — ať už je to sportovně založená rodina, parta cyklistů, turisté, nebo manželé, kteří u nás našli klid. Přijeďte pobýt, těšíme se na vás.
              </p>
            </div>

            <button type="button" class="contact-about-toggle" aria-expanded="false" aria-controls="contact-about-body">
              <span class="contact-about-toggle-text">Přečíst více</span>
              <svg class="contact-about-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. JAK SE K NÁM DOSTAT? -->
    <section class="contact-directions-section">
      <div class="contact-directions-inner">
        <h2 class="directions-main-title" data-anim="up">Jak se k nám dostat?</h2>

        <div class="directions-grid" data-anim-group>
          <!-- Levá část: Parkování -->
          <div class="directions-left-col" data-anim="up">
            <h3 class="directions-parking-title">Parkování v létě zdarma přímo u hotelu</h3>
            <p class="directions-parking-desc">
              Se závorou a kamerovým systémem, bez nutnosti rezervace místa.
              V zimě (1. 11. – 15. 4.) za jednorázový poplatek 100 Kč za auto bez ohledu na délku pobytu — přispívá na odhrnování sněhu a údržbu příjezdové cesty.
            </p>
          </div>

          <!-- Pravá část: Autem a Vlakem -->
          <div class="directions-right-col">
            <!-- Autem -->
            <div class="directions-mode-item" data-anim="up">
              <div class="directions-icon-wrap">
                <img src="/Icons/Ikony/car.png" alt="" class="directions-icon">
              </div>
              <div class="directions-mode-content">
                <h3 class="directions-mode-title">Autem</h3>
                <p class="directions-mode-desc">
                  Z Prahy (Černý Most) je to k hotelu pouhých 108 km — cca 75 minut předpisové jízdy (mimo Liberec). U hotelu na vás čeká bezplatné parkoviště se závorou a kamerovým systémem.
                </p>
              </div>
            </div>

            <!-- Vlakem -->
            <div class="directions-mode-item" data-anim="up">
              <div class="directions-icon-wrap">
                <img src="/Icons/Ikony/train.png" alt="" class="directions-icon">
              </div>
              <div class="directions-mode-content">
                <h3 class="directions-mode-title">Vlakem</h3>
                <p class="directions-mode-desc">
                  Vlaková zastávka v Desné je vzdálená 1,2 km od hotelu. V případě potřeby rádi zajistíme odvoz vašich zavazadel od vlaku přímo k hotelu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. SEKCE MAPA -->
    <section class="contact-map-section" id="mapa">
      <div class="contact-map-inner" data-anim="up">
        <div class="contact-map-wrapper">
          <iframe 
            src="https://maps.google.com/maps?q=Hotel%20u%20M%C5%AFstku%20Desn%C3%A1%20368&t=&z=15&ie=UTF8&iwloc=&output=embed" 
            class="contact-google-map-iframe"
            allowfullscreen="" 
            loading="lazy" 
            referrerpolicy="no-referrer-when-downgrade"
            title="Mapa Hotel u Můstku">
          </iframe>
          <a href="https://www.google.com/maps/dir/?api=1&destination=Hotel+u+M%C5%AFstku+Desn%C3%A1+368" target="_blank" rel="noopener noreferrer" class="btn-open-google-maps">
            Zobrazit celou mapu &rsaquo;
          </a>
        </div>
      </div>
    </section>

    <!-- 6. REUSED SEKCE: CTA BANNER -->
    

  ${getCtaHTML()}

    <!-- 7. REUSED SEKCE: FOOTER -->
    

  
  
  
  ${getFooterHTML()}
  </div>
`;

// Interaktivita Stránky Kontakt
const initContactPageInteractivity = () => {
  const currentHash = window.location.hash.toLowerCase();
  if (currentHash === '#form-sekce' || currentHash === '#napiste-nam' || currentHash === '#kontakt-form' || currentHash === '#poptavka') {
    requestAnimationFrame(() => {
      const formSec = document.getElementById('form-sekce') || document.getElementById('contact-page-form');
      if (!formSec) return;
      const hlavicka = document.querySelector('.site-header');
      const odstup = hlavicka ? hlavicka.offsetHeight + 12 : 100;
      const y = formSec.getBoundingClientRect().top + window.pageYOffset - odstup;
      window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
    });
  }

  const heroBtn = document.getElementById('btn-goto-contact-form');
  if (heroBtn) {
    heroBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const formSec = document.getElementById('form-sekce') || document.getElementById('contact-page-form');
      if (!formSec) return;
      const hlavicka = document.querySelector('.site-header');
      const odstup = hlavicka ? hlavicka.offsetHeight + 12 : 100;
      const y = formSec.getBoundingClientRect().top + window.pageYOffset - odstup;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    });
  }

  const contactForm = document.getElementById('contact-page-form');
  if (contactForm) {
    const nameInput = document.getElementById('contact-name');
    const surnameInput = document.getElementById('contact-surname');
    const emailInput = document.getElementById('contact-email');
    const requiredInputs = [nameInput, surnameInput, emailInput];

    const applyCzechCustomValidity = (inp) => {
      if (!inp) return;
      inp.setCustomValidity('');
      if (!inp.value.trim()) {
        inp.setCustomValidity('Vyplňte prosím toto pole.');
      } else if (inp.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inp.value.trim())) {
        inp.setCustomValidity('Zadejte prosím platnou e-mailovou adresu.');
      }
    };

    requiredInputs.forEach(inp => {
      if (!inp) return;
      inp.addEventListener('invalid', function () {
        if (this.validity.valueMissing) {
          this.setCustomValidity('Vyplňte prosím toto pole.');
        } else if (this.validity.typeMismatch || this.validity.patternMismatch) {
          this.setCustomValidity('Zadejte prosím platnou e-mailovou adresu.');
        }
      });

      inp.addEventListener('input', function () {
        this.setCustomValidity('');
        this.classList.remove('input-field-error');
      });
    });

    const gdprInput = document.getElementById('contact-gdpr-check');
    if (gdprInput) {
      gdprInput.addEventListener('invalid', function () {
        if (this.validity.valueMissing) {
          this.setCustomValidity('Zaškrtněte prosím toto pole, pokud chcete pokračovat.');
        }
      });
      gdprInput.addEventListener('change', function () {
        this.setCustomValidity('');
      });
    }

    if (contactForm && !contactForm.dataset.submitInit) {
      contactForm.dataset.submitInit = '1';
      contactForm.addEventListener('submit', async (e) => {
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const statusEl = document.getElementById('contact-form-status');

        // 1. Kontrola a zobrazení českého obláčku přímo u pole + plynulé odskrolování
        for (const inp of requiredInputs) {
          if (!inp) continue;
          applyCzechCustomValidity(inp);
          if (!inp.checkValidity()) {
            e.preventDefault();
            inp.classList.add('input-field-error');
            inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              inp.reportValidity();
              inp.focus();
            }, 250);
            return;
          }
        }

        if (gdprInput && !gdprInput.checked) {
          e.preventDefault();
          gdprInput.setCustomValidity('Zaškrtněte prosím toto pole, pokud chcete pokračovat.');
          gdprInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            gdprInput.reportValidity();
            gdprInput.focus();
          }, 250);
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#d93025';
            statusEl.style.marginTop = '16px';
            statusEl.style.fontWeight = '500';
            statusEl.innerHTML = '⚠️ Pro odeslání zprávy je nutné potvrdit souhlas se zpracováním osobních údajů.';
          }
          return;
        }

        e.preventDefault();

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.7';
          submitBtn.innerHTML = 'Odesílání...';
        }
        if (statusEl) {
          statusEl.style.display = 'none';
        }

        try {
          const name = (nameInput?.value || '').trim();
          const surname = (surnameInput?.value || '').trim();
          const email = (emailInput?.value || '').trim();
          const phone = (document.getElementById('contact-phone')?.value || '').trim();
          const message = (document.getElementById('contact-message')?.value || '').trim();

          const payload = { name, surname, email, phone, message };

          // 1. Uložení do Supabase databáze
          await saveContactMessage(payload);

          // 2. Upozornění pro recepci — zatím na soukromou adresu majitele
          const emailTemplate = generateEmailContactNotification(payload);
          sendEmail({
            to: RECEPCE_PRIJEMCE,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            type: 'contact_form_message'
          });

          // 3. UI úspěch s animovaným zaškrtávátkem a tlačítkem pro novou zprávu
          contactForm.innerHTML = `
          <div class="contact-success-wrapper">
            <div class="success-checkmark-circle">
              <svg class="checkmark-svg" viewBox="0 0 52 52">
                <circle class="checkmark-circle-path" cx="26" cy="26" r="23" fill="none" stroke="#5c6748" stroke-width="2.5" />
                <path class="checkmark-check-path" fill="none" stroke="#5c6748" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
            <h3 class="success-title">Děkujeme za vaši zprávu!</h3>
            <p class="success-desc">Vaši zprávu jsme v pořádku přijali. Náš tým se vám ozve zpět na e-mail <strong>${email}</strong> v co nejkratším čase.</p>
            <div class="success-action-wrap" style="margin-top: 32px;">
              <button type="button" id="btn-reset-contact-form" class="btn btn-contact-submit">Napsat další zprávu</button>
            </div>
          </div>
        `;

          const resetBtn = document.getElementById('btn-reset-contact-form');
          if (resetBtn) {
            resetBtn.addEventListener('click', () => {
              const formContainer = document.getElementById('form-sekce');
              if (formContainer) {
                formContainer.innerHTML = `
                <h2 class="contact-form-title">Napište nám</h2>
                <form id="contact-page-form" class="contact-form-element">
                  <div class="contact-form-row">
                    <div class="contact-form-group">
                      <label for="contact-name" class="contact-form-label">Jméno *</label>
                      <input type="text" id="contact-name" name="name" required class="contact-form-input">
                    </div>
                    <div class="contact-form-group">
                      <label for="contact-surname" class="contact-form-label">Příjmení *</label>
                      <input type="text" id="contact-surname" name="surname" required class="contact-form-input">
                    </div>
                  </div>

                  <div class="contact-form-row">
                    <div class="contact-form-group">
                      <label for="contact-email" class="contact-form-label">E-mail *</label>
                      <input type="email" id="contact-email" name="email" required class="contact-form-input">
                    </div>
                    <div class="contact-form-group">
                      <label for="contact-phone" class="contact-form-label">Telefon</label>
                      <input type="tel" id="contact-phone" name="phone" class="contact-form-input">
                    </div>
                  </div>

                  <div class="contact-form-group contact-form-full">
                    <label for="contact-message" class="contact-form-label">Zpráva</label>
                    <textarea id="contact-message" name="message" rows="1" class="contact-form-textarea"></textarea>
                  </div>

                  <div class="contact-form-gdpr">
                    <label class="contact-checkbox-label">
                      <input type="checkbox" id="contact-gdpr-check" required>
                      <span class="contact-checkbox-custom"></span>
                      <span class="contact-checkbox-text">Beru na vědomí, že mé údaje použijete pouze k vyřízení tohoto dotazu, a seznámil/a jsem se se <a href="/gdpr" target="_blank" rel="noopener">zásadami ochrany osobních údajů</a>.</span>
                    </label>
                  </div>

                  <div class="contact-form-submit-wrap">
                    <button type="submit" class="btn btn-contact-submit">Odeslat zprávu</button>
                  </div>
                  <div id="contact-form-status" class="contact-form-status" style="display: none;"></div>
                </form>
              `;
                initContactPageInteractivity();
              }
            });
          }
        } catch (err) {
          console.error('Chyba při odesílání kontaktního formuláře:', err);
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#d93025';
            statusEl.style.marginTop = '16px';
            statusEl.style.fontWeight = '500';
            statusEl.innerHTML = '❌ Omlouváme se, při odesílání došlo k chybě. Zkuste to prosím znovu.';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.innerHTML = 'Odeslat zprávu';
          }
        }
      });
    }
  }

  initContactMap();
};

// Inicializace Interaktivní Leaflet Mapy
const initContactMap = () => {
  const mapContainer = document.getElementById('contact-leaflet-map');
  if (!mapContainer) return;

  const loadLeaflet = (callback) => {
    if (window.L) {
      callback();
      return;
    }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = callback;
      document.head.appendChild(script);
    } else {
      const checkL = setInterval(() => {
        if (window.L) {
          clearInterval(checkL);
          callback();
        }
      }, 50);
    }
  };

  loadLeaflet(() => {
    if (mapContainer._leaflet_id) return;
    const lat = 50.7601;
    const lng = 15.3184;
    const map = window.L.map(mapContainer, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: false
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const customIcon = window.L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="map-pin-bubble">
          <img src="/Icons/Ikony/location.png" class="pin-icon" alt="">
          <span class="pin-title">Hotel u Můstku</span>
        </div>
      `,
      iconSize: [160, 48],
      iconAnchor: [80, 48]
    });

    const marker = window.L.marker([lat, lng], { icon: customIcon }).addTo(map);
    marker.bindPopup('<b>Hotel u Můstku</b><br>Údolní 368, Desná v Jizerských horách 1').openPopup();
  });
};

// Datové podklady pro 4 samostatné kategorie aktivit v okolí hotelu
const CATEGORIES_DATA = {
  'turistika': {
    title: 'Turistika',
    subtitle: 'Objevte nejkrásnější pěší trasy a přírodní skvosty Jizerských hor přímo od našeho hotelu.',
    heroImg: '/Fotky Aktivit/Turistika.webp',
    heroImgMobil: '/Fotky Aktivit/Turistika mobil.webp',
    items: [
      {
        id: 'riedlova-hrobka',
        title: 'Riedlova hrobka v Desné',
        subtitle: 'pár minut od hotelu | Desná',
        img: '/Fotky Aktivit/riedlova-hrobka-v-desne-4.webp',
        alt: 'Secesní Riedlova hrobka v Desné v Jizerských horách',
        desc: 'Hrobku si nechala postavit sklářská rodina Riedlů, která v Desné po generace určovala život celého kraje. Stavba z počátku dvacátého století je ukázkou secese s barevnými vitrážemi.\n\nStojí přímo v Desné, dojdete sem pěšky za pár minut. Je to zastávka na deset minut, ale stojí za to — takhle zachovalá secesní stavba není v okolí běžná.'
      },
      {
        id: 'protrzena-prehrada',
        title: 'Protržená přehrada na Bílé Desné',
        subtitle: '5 km od hotelu | Desná',
        img: '/Fotky Aktivit/protrzena-prehrada-na-bile-desne-5.webp',
        alt: 'Zbytky hráze protržené přehrady na Bílé Desné v Jizerských horách',
        desc: 'Přehrada se protrhla v září roku 1916, sotva rok po dokončení. Voda se během několika minut prohnala údolím a zaplavila Desnou. Zahynulo dvaašedesát lidí. Dodnes je to největší přehradní katastrofa v českých dějinách.\n\nZ hráze zůstala jen obrovská průrva a kamenné bloky v lese. Kolem vede naučná stezka s informačními cedulemi, kde si celý příběh přečtete. Cesta stoupá s převýšením zhruba 300 metrů, pěšky od hotelu počítejte asi hodinu a dvacet minut. Vhodné i pro pomalejší chůzi.'
      },
      {
        id: 'vodopady-cerne-desne',
        title: 'Vodopády Černé Desné',
        subtitle: '3,1 km od hotelu | Desná',
        img: '/Fotky Aktivit/vodopady-cerne-desne.jpg',
        alt: 'Kaskády vodopádů na říčce Černá Desná v lesním údolí',
        desc: 'Černá Desná se v lesním údolí přelévá přes balvany a vytváří řadu menších kaskád. Není to jeden velký vodopád, ale několik stupňů za sebou. V létě je tu příjemný chládek.\n\nÚdolím vede značená cesta podél vody. Terén je místy kamenitý, hodí se pevnější boty. Z hotelu je to nejbližší výlet za vodou hned po Bílé Desné, která teče přímo pod okny — dojdete sem i pěšky.'
      },
      {
        id: 'vyhlidka-spicka',
        title: 'Vyhlídka Špička na Malém Špičáku',
        subtitle: '4 km od hotelu | Tanvald',
        img: '/Fotky Aktivit/vyhlidka-spicka.webp',
        alt: 'Výhled ze skalní vyhlídky Špička na Malém Špičáku nad Tanvaldem',
        desc: 'Malý Špičák se zvedá nad Tanvaldem a na jeho vrcholu najdete skalní vyhlídku. Za dobrého počasí odsud dohlédnete na hřebeny Jizerských hor i na Krkonoše.\n\nVýstup je krátký, ale poslední úsek stoupá docela svižně. Pěšky od hotelu počítejte zhruba s hodinou a deseti minutami. Nahoře je lavička, kde se dá v klidu posedět. Nejlepší světlo bývá dopoledne.'
      },
      {
        id: 'vodni-nadrz-sous',
        title: 'Vodní nádrž Souš',
        subtitle: '4,1 km od hotelu | Desná',
        img: '/Fotky Aktivit/vodni-nadrz-sous-5.webp',
        alt: 'Vodní nádrž Souš obklopená lesy v Jizerských horách',
        desc: 'Souš leží v tichém údolí mezi lesy a zásobuje pitnou vodou celý Jablonecký region. Hladina se zrcadlí v okolních kopcích a bývá tu opravdové ticho — koupání ani lodě sem nepatří.\n\nKolem přehrady vede pohodlná cesta, po které se dá jít i s kočárkem. Celý okruh má asi šest kilometrů a nikde výrazně nestoupá. Pěšky od hotelu dorazíte za hodinu a deset minut, cesta stoupá. Dá se spojit s vodopády Černé Desné do delšího celodenního okruhu. Autem sem dojedete za čtvrt hodiny, parkoviště je u hráze.'
      },
      {
        id: 'rozhledna-svetly-vrch',
        title: 'Rozhledna Světlý vrch v Albrechticích',
        subtitle: '2,2 km od hotelu | Albrechtice',
        img: '/Fotky Aktivit/rozhledna-svetly-vrch.webp',
        alt: 'Kamenná rozhledna Světlý vrch nad Albrechticemi v Jizerských horách',
        desc: 'Rozhledna stojí na kopci nad Albrechticemi a nabízí kruhový výhled na okolní hřebeny. Za jasného dne je odsud vidět daleko do vnitrozemí.\n\nK rozhledně vede značená cesta lesem, pěšky od hotelu jde o zhruba čtyřicet minut. Výstup není strmý, jen mírně stoupá. Autem z hotelu je to zhruba čtvrt hodiny.'
      },
      {
        id: 'rozhledna-stepanka',
        title: 'Rozhledna Štěpánka',
        subtitle: '6,7 km od hotelu | Kořenov',
        img: '/Fotky Aktivit/rozhledna-stepanka-5.webp',
        alt: 'Kamenná rozhledna Štěpánka na kopci nad Kořenovem',
        desc: 'Štěpánka je nejstarší rozhlednou v Jizerských horách, stavěla se v polovině devatenáctého století a dokončena byla až o pár desítek let později. Kamenná věž stojí na vrcholu Hvězda nad Kořenovem.\n\nPěšky sem od hotelu dorazíte asi za dvě hodiny. Nahoru vede točité schodiště, po kterém vystoupáte na ochoz s výhledem na Jizerské hory i Krkonoše. Dole v Kořenově pod rozhlednou je restaurace. Autem z hotelu čtvrt hodiny, parkuje se kousek pod rozhlednou.'
      },
      {
        id: 'raseliniste-jizerky',
        title: 'Rašeliniště Jizerky',
        subtitle: '15 km od hotelu | Jizerka',
        img: '/Fotky Aktivit/raseliniste-jizerky-4.webp',
        alt: 'Dřevěné povalové chodníky vedoucí přes rašeliniště Jizerky',
        desc: 'Rašeliniště je jedno z nejcennějších míst v Jizerských horách. Rostou tu borovice kleč a rostliny, které jinde v Česku nepotkáte. Krajina působí trochu jako severská tundra.\n\nPřes mokřinu vedou dřevěné povalové chodníky, takže si neušpiníte boty a nikde se neboříte. Cesta je rovná a lemovaná cedulemi, které vysvětlují, co kolem sebe vidíte. Pěšky od hotelu je to náročný celodenní výlet zhruba na čtyři hodiny s výrazným převýšením. Autem dojedete na Jizerku asi za dvacet minut a odtud už jdete po rovině.'
      },
      {
        id: 'osada-jizerka',
        title: 'Osada Jizerka',
        subtitle: '10 km od hotelu | Jizerka',
        img: '/Fotky Aktivit/osada-jizerka-1.webp',
        alt: 'Roubené chalupy v horské osadě Jizerka obklopené loukami',
        desc: 'Jizerka je hrstka roubených chalup rozesetých v široké horské kotlině. Bývá tu naměřená nejnižší teplota v celé republice — v mrazivých nocích tu klesá hluboko pod nulu.\n\nKolem osady jsou louky a rašeliniště, procházky vedou po rovině. Je tu muzeum i pár míst, kde se dá najíst. Auto se nechává na parkovišti před osadou, dovnitř se chodí pěšky. Z hotelu je to asi dvacet minut jízdy autem, pěšky zhruba dvě hodiny a čtyřicet minut s převýšením.'
      }
    ]
  },
  'cyklistika': {
    title: 'Cyklistika',
    subtitle: 'Nekonečné kilometry cyklostezek, singltreky a horské hřebenovky pro začátečníky i náročné bikery.',
    heroImg: '/Fotky Aktivit/cyklistika.webp',
    heroImgMobil: '/Fotky Aktivit/cyklistika mobil.webp',
    items: [
      {
        id: 'cyklostezka-udolim-kamenice',
        title: 'Cyklotrasa údolím řeky Kamenice',
        subtitle: '5 km od hotelu | Tanvald',
        img: '/Fotky Aktivit/udoli-kamenice.webp',
        alt: 'Cyklotrasa vedoucí údolím řeky Kamenice v Jizerských horách',
        desc: 'Trasa sleduje řeku Kamenici a vede převážně z kopce. Je to jedna z nejpohodlnějších vyjížděk v okolí — jedete podél vody a nemusíte se nikam drát.\n\nHodí se i pro rodiny s dětmi. Zpátky se dá vyjet vlakem, který jezdí souběžně s údolím a kola bere. Nástup je kousek od hotelu.'
      },
      {
        id: 'bikepark-spicak',
        title: 'Bikepark Tanvaldský Špičák',
        subtitle: '3,8 km od hotelu | Tanvald',
        img: '/Fotky Aktivit/bikepark-tanvaldsky-spicak-4.webp',
        alt: 'Sjezdová trať bikeparku na Tanvaldském Špičáku',
        desc: 'V létě se ze sjezdovky stává bikepark. Nahoru vás vyveze lanovka i s kolem, dolů si vyberete trať podle toho, co si troufnete.\n\nTratě jsou rozdělené podle obtížnosti, od jednoduchých po skokanské. Kolo i chrániče se půjčují na místě, takže se nemusíte tahat s vlastní výbavou. Z hotelu jen osm minut autem.'
      },
      {
        id: 'cyklostezka-cimrmana',
        title: 'Cyklostezka Járy Cimrmana č. 3019',
        subtitle: 'přímo u hotelu | Desná',
        img: '/Fotky Aktivit/cyklostezka-jary-cimrmana-4.webp',
        alt: 'Značená cyklostezka Járy Cimrmana vedoucí krajinou Jizerských hor',
        desc: 'Trasa je pojmenovaná po slavném fiktivním géniovi, který podle legendy v tomhle kraji působil. Vede přes Kořenov a okolní osady, částečně po klidných silničkách.\n\nStoupání jsou mírná a rozložená, není tu žádný prudký kopec. Cestou míjíte kapličky, staré domy a několik hospod. Nástup je kousek od hotelu, není potřeba nikam převážet kola.'
      },
      {
        id: 'trasa-kolem-souse',
        title: 'Trasa kolem vodní nádrže Souš',
        subtitle: '8 km od hotelu | Souš',
        img: '/Fotky Aktivit/vodni-nadrz-sous-5.webp',
        alt: 'Asfaltová cyklistická cesta podél vodní nádrže Souš',
        desc: 'Kolem přehrady Souš vede asfaltová cesta bez aut. Trasa je rovinatá, takže se dá jet v klidu a povídat si — nikde se nedřete do kopce.\n\nOkruh má zhruba šest kilometrů, dá se jet i s dětmi. Cestou je několik míst s výhledem na hladinu. Do Souše se z hotelu dá dojet i na kole, ale je to do kopce — pohodlnější je dovézt kola autem.'
      },
      {
        id: 'stepanka-na-kole',
        title: 'Rozhledna Štěpánka na kole',
        subtitle: '9 km od hotelu | Kořenov',
        img: '/Fotky Aktivit/rozhledna-stepanka-5.webp',
        alt: 'Kamenná rozhledna Štěpánka jako cíl cyklistického výletu',
        desc: 'Ke Štěpánce se dá vyjet na kole po klidných silničkách přes Kořenov. Poslední kilometr před rozhlednou pořádně stoupá, tam už se většinou tlačí.\n\nNahoře necháte kolo dole a vystoupáte po schodech na ochoz. Vidět je odsud na Jizerské hory i na Krkonoše. Pod rozhlednou je restaurace, kde se dá doplnit energie na cestu zpátky.'
      },
      {
        id: 'jizerska-magistrala-cyklo',
        title: 'Jizerská magistrála pro cyklisty',
        subtitle: '7,5 km od hotelu | Souš',
        img: '/Fotky Aktivit/jizerska-magistrala-3.webp',
        alt: 'Široká lesní cesta Jizerské magistrály vhodná pro cyklisty',
        desc: 'Jizerská magistrála je v zimě slavná běžkařská síť. V létě se z těch samých cest stávají skvělé trasy pro kola — jsou široké, zpevněné a nejezdí po nich auta.\n\nNejsnazší nástup je na Souši, kde je parkoviště. Odtud dojedete na Smědavu a poskládáte si okruh podle toho, kolik máte sil. Značení je přehledné, na rozcestích jsou mapy. Kdo má rád delší a náročnější trasy, může vyjet až na Jizerku a cestou zpět sjet od Protržené přehrady přímo k hotelu.'
      },
      {
        id: 'cerna-studnice-na-kole',
        title: 'Rozhledna Černá Studnice na kole',
        subtitle: '14 km od hotelu | Jablonec nad Nisou',
        img: '/Fotky Aktivit/rozhledna-cerna-studnice.webp',
        alt: 'Kamenná rozhledna Černá Studnice s horskou chatou',
        desc: 'Černá Studnice je výrazný vrch nad Jabloncem s kamennou rozhlednou z konce devatenáctého století. Výjezd na kole je poctivé stoupání, ale cesta je celou dobu zpevněná.\n\nNahoře je vedle rozhledny chata s kuchyní, takže se dá dát oběd a pak si užít výhled. Za jasného počasí je vidět až na Ještěd. Sjezd zpátky je rychlý a příjemný.'
      },
      {
        id: 'hrebenova-cyklotrasa-smedava',
        title: 'Hřebenová cyklotrasa na Smědavu',
        subtitle: '15 km od hotelu | Smědava',
        img: '/chata smedava.webp',
        alt: 'Horská chata Smědava na hřebeni Jizerských hor',
        desc: 'Trasa vede po hřebeni Jizerských hor a patří k náročnějším. Stoupání je delší, ale odměnou jsou otevřené výhledy do krajiny na obě strany.\n\nNa Smědavě stojí horská chata, kde se dá najíst a odpočinout před cestou zpátky. Je to klasický cíl jizerskohorských cyklistů. Počítejte s celým dnem a s tím, že je potřeba nějaká kondice. Pohodlnější varianta: dojeďte autem s koly přímo na Smědavu, je to asi dvacet minut, a pak už jezděte po náhorní plošině bez velkých převýšení.'
      },
      {
        id: 'singltrek-pod-smrkem',
        title: 'Singltrek pod Smrkem',
        subtitle: '35 km od hotelu | Nové Město pod Smrkem',
        img: '/Fotky Aktivit/singltrek-pod-smrkem-4.webp',
        alt: 'Úzká lesní stezka pro horská kola v areálu Singltrek pod Smrkem',
        desc: 'Singltrek je síť úzkých stezek, které se stavěly výhradně pro kola. Vedou lesem, kopírují terén a nikde se nekříží se silnicí. Celkem je jich tu přes osmdesát kilometrů.\n\nPokud pojedete celou cestu na kole, je to výlet pro fajnšmekry — dvě až tři velká stoupání a kolem osmdesáti kilometrů, při kterých přejedete Jizerské hory tam i zpět. Kdo dojede autem na nástupní stanici, ušetří půl dne a hodně sil. Trasy jsou barevně rozlišené jako sjezdovky, od zelené pro začátečníky po černou. Zelené a modré okruhy zvládne i běžný cyklista. Kolo se dá půjčit na místě. Autem z hotelu asi padesát minut.'
      }
    ]
  },
  'zimni-vylety': {
    title: 'Výlety v zimě',
    subtitle: 'Zimní pohádka v Jizerských horách — špičkové ski areály, upravované běžecké stopy i rodinná zábava.',
    heroImg: '/Fotky Aktivit/Zimni vylety.webp',
    heroImgMobil: '/Fotky Aktivit/Zimni vylety mobil.webp',
    items: [
      {
        id: 'skiareal-tanvaldsky-spicak',
        title: 'Skiareál Jizerky – Tanvaldský Špičák',
        subtitle: '4,5 km od hotelu · 8 minut autem',
        img: '/Fotky Aktivit/tanvaldsky-spicak-zima.webp',
        alt: 'Zasněžená sjezdovka a lanovka ve skiareálu Tanvaldský Špičák',
        desc: 'Tanvaldský Špičák je nejbližší větší středisko od hotelu — jste tam za deset minut autem. Sjezdovky pokrývají všechny obtížnosti od modrých po černé.\n\nNahoru vede lanovka, na svazích se uměle zasněžuje, takže sezona bývá dlouhá. Několik sjezdovek je osvětlených pro večerní lyžování. Půjčovna i lyžařská škola jsou přímo v areálu.'
      },
      {
        id: 'ski-cerna-ricka',
        title: 'Ski areál Černá Říčka v Desné',
        subtitle: '5,3 km od hotelu · 8 minut autem',
        img: '/Fotky Aktivit/ski-areal-cerna-ricka.webp',
        alt: 'Zasněžená sjezdovka ski areálu Černá Říčka v Desné',
        desc: 'Černá Říčka je malý rodinný areál přímo v Desné. Není to velké středisko s davy lidí — spíš klidné místo, kde se dá v pohodě lyžovat.\n\nPrávě proto se hodí pro začátečníky a děti. Fronty u vleku bývají krátké a nikdo vás nikam netlačí. Je to nejbližší lyžování od hotelu, dojedete sem za pár minut.'
      },
      {
        id: 'ski-u-capa-prichovice',
        title: 'Ski areál U Čápa v Příchovicích',
        subtitle: '6,7 km od hotelu · 13 minut autem',
        img: '/skiareal-u-capa-prichovice-enhanced.webp',
        alt: 'Sjezdovka lyžařského areálu U Čápa v Příchovicích v Jizerských horách',
        desc: 'Areál U Čápa leží v Příchovicích nad Kořenovem, tedy kousek za hotelem. Je to menší jizerskohorské středisko, kam se jezdí spíš za klidným lyžováním než za velkým provozem.\n\nSvahy jsou přehledné a hodí se pro rodiny i pro lyžaře, kteří se zrovna rozjíždějí. Autem jste tam za necelou čtvrthodinu, takže se dá vyrazit i jen na půl dne.'
      },
      {
        id: 'ski-rejdice',
        title: 'Ski areál Rejdice',
        subtitle: '10 km od hotelu · 16 minut autem',
        img: '/skiareal rejdice.webp',
        alt: 'Zasněžený lyžařský areál Rejdice v Jizerských horách',
        desc: 'Rejdice jsou malý areál na okraji Jizerských hor u Kořenova. Patří k té klidnější kategorii středisek, kde se nestojí dlouhé fronty.\n\nJe to dobrá volba na den, kdy nechcete řešit dav a parkování. Z hotelu je to zhruba čtvrt hodiny jízdy autem.'
      },
      {
        id: 'ski-harrachov',
        title: 'Ski areál Harrachov',
        subtitle: '17 km od hotelu · 21 minut autem',
        img: '/skiareal harrachov.webp',
        alt: 'Sjezdovky a skokanské můstky v lyžařském areálu Harrachov',
        desc: 'Harrachov je jedno z nejznámějších středisek v Krkonoších a od hotelu je to jen přes kopec. Kromě sjezdovek jsou tu i slavné skokanské můstky, které stojí za prohlídku i mimo závody.\n\nStředisko je větší než okolní jizerskohorské areály, takže si vyberou začátečníci i zkušenější lyžaři. Autem jste tam zhruba za dvacet minut.'
      },
      {
        id: 'ski-rokytnice-nad-jizerou',
        title: 'Ski areál Rokytnice nad Jizerou',
        subtitle: '22 km od hotelu · 30 minut autem',
        img: '/skiareal-rokytnice-nad-jizerou-enhanced.webp',
        alt: 'Rozlehlé sjezdovky lyžařského areálu Rokytnice nad Jizerou v Krkonoších',
        desc: 'Rokytnice nad Jizerou patří k největším krkonošským střediskům a nabízí nejdelší sjezdy v dosahu hotelu. Převýšení je tu poctivé, takže si přijdou na své i náročnější lyžaři.\n\nJe to nejvzdálenější z areálů, které od nás doporučujeme, ale rozsahem to vynahradí. Počítejte s půlhodinou jízdy autem a spíš celodenním výletem.'
      },
      {
        id: 'muzeum-skla-bizuterie',
        title: 'Muzeum skla a bižuterie v Jablonci nad Nisou',
        subtitle: '16 km od hotelu · 24 minut autem',
        img: '/Fotky Aktivit/muzeum-skla-jablonec.webp',
        alt: 'Expozice historického skla a bižuterie v jabloneckém muzeu',
        desc: 'Když je venku plískanice, tohle je dobrá volba. V teple si projdete jednu z největších sbírek skla a bižuterie na světě.\n\nNejhezčí bývá zimní expozice vánočních ozdob — ukazuje, jak se tady po generace vyráběly skleněné baňky. Prohlídka zabere hodinu a půl a není vyčerpávající. Autem z hotelu asi půl hodiny.'
      },
      {
        id: 'jizerska-magistrala-bezky',
        title: 'Jizerská magistrála pro běžkaře',
        subtitle: '12 km od hotelu · 18 minut autem',
        img: '/Fotky Aktivit/jizerska-magistrala-zima.webp',
        alt: 'Upravená běžkařská stopa Jizerské magistrály v zasněženém lese',
        desc: 'Jizerská magistrála je nejznámější běžkařská síť u nás. Přes sto sedmdesát kilometrů tratí, které se pravidelně upravují rolbou.\n\nTrasy vedou lesem po hřebenech a jsou rozdělené podle náročnosti — najdete tu rovinaté okruhy i dlouhé náročné přejezdy. Nejsnazší nástup je v Bedřichově, kde je velké parkoviště a půjčovna. Aktuální stav stop se dá zjistit online.'
      },
      {
        id: 'aquapark-babylon',
        title: 'Aquapark a wellness centrum Babylon Liberec',
        subtitle: '27 km od hotelu · 37 minut autem',
        img: '/Fotky Aktivit/aquapark-babylon-liberec-1.webp',
        alt: 'Vnitřní bazén aquaparku Babylon v Liberci',
        desc: 'Krytý aquapark s bazény, tobogány a vířivkami. Vedle je wellness s několika druhy saun a odpočívárnou.\n\nPo dni na běžkách nebo na sjezdovce je to přesně to, co potřebujete. Všechno je uvnitř, takže na počasí nezáleží. Aquapark je součástí komplexu Babylon, kde jsou i restaurace. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'dinopark-liberec-zima',
        title: 'Dinopark Liberec',
        subtitle: '26 km od hotelu · 40 minut autem',
        img: '/Fotky Aktivit/dinopark-liberec.webp',
        objectPosition: '25% center',
        alt: 'Model dinosaura v životní velikosti v Dinoparku Liberec',
        desc: 'Dinopark je klasika pro výlet s dětmi nebo vnoučaty. Modely dinosaurů v životní velikosti, některé pohyblivé, doplněné naučnými cedulemi.\n\nSoučástí je kino s filmem o pravěku a hřiště, kde si děti mohou zkusit vykopávat kosti. Program na dvě až tři hodiny. Před návštěvou si ověřte otevírací dobu — v zimních měsících bývá omezená.'
      },
      {
        id: 'iqlandia-liberec-zima',
        title: 'iQlandia Liberec',
        subtitle: '27 km od hotelu · 37 minut autem',
        img: '/Fotky Aktivit/iqlandia-liberec.webp',
        objectPosition: '65% center',
        alt: 'Interaktivní exponáty ve vědeckém centru iQlandia v Liberci',
        desc: 'Když je venku zima a mokro, iQlandia je jistota. Vědecké centrum, kde si všechno můžete osahat a vyzkoušet — vesmír, lidské tělo, živly, optické klamy.\n\nPřes pět set exponátů na čtyřech patrech, k tomu planetárium s projekcí na kupoli. Během dne se konají vědecké show s pokusy. Snadno tu strávíte půl dne, aniž byste vytáhli paty z tepla.'
      },
      {
        id: 'zoo-botanicka-zima',
        title: 'Zoo a botanická zahrada Liberec',
        subtitle: '26 km od hotelu · 40 minut autem',
        img: '/Fotky Aktivit/zoo-liberec.webp',
        alt: 'Zvířata ve výběhu liberecké zoologické zahrady',
        desc: 'V zimě je v zoo klid a žádné fronty. Některým zvířatům chladné počasí naopak svědčí — sněžní levharti, sobi nebo vlci jsou v zimě nejaktivnější.\n\nKousek od zoo je botanická zahrada s vyhřívanými skleníky, kde se dá mezi procházkami ohřát. Ideální kombinace: hodina venku u zvířat, hodina v teple mezi tropickými rostlinami.'
      },
      {
        id: 'funpark-babylon-zima',
        title: 'Funpark a Lunapark Babylon v Liberci',
        subtitle: '27 km od hotelu · 37 minut autem',
        img: '/Fotky Aktivit/funpark-babylon-liberec-1.webp',
        objectPosition: 'left center',
        alt: 'Vnitřní zábavní park Babylon v Liberci s atrakcemi',
        desc: 'Celý zábavní komplex je pod střechou, takže mráz ani déšť nevadí. Lunapark má klasické kolotoče a atrakce, Funpark je určený menším dětem.\n\nVe stejné budově je aquapark, wellness a několik restaurací, takže se dá naplánovat celý den na jednom místě. Parkování je přímo u budovy. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'jested-zima',
        title: 'Ještěd v zimě',
        subtitle: '31 km od hotelu · 42 minut autem',
        img: '/Fotky Aktivit/jested-zima.webp',
        alt: 'Zasněžený vrchol Ještědu s vysílačem nad Libercem',
        desc: 'V zimě se Ještěd mění na lyžařské středisko. Sjezdovky vedou přímo z vrcholu a patří k nejdelším v severních Čechách.\n\nI když nelyžujete, stojí za to vyjet lanovkou nahoru. Zasněžený vrchol s tou zvláštní kuželovitou věží je působivý pohled a nahoře je teplá restaurace s výhledem. Autem z hotelu asi tři čtvrtě hodiny.'
      }
    ]
  },
  'vylety-autem': {
    title: 'Výlety autem',
    subtitle: 'Pohodlné výlety za kulturou, zábavou a památkami v širším okolí Jizerských hor a Severních Čech.',
    heroImg: '/Fotky Aktivit/vylety autem.webp',
    heroImgMobil: '/Fotky Aktivit/vylety autem mobil.webp',
    items: [
      {
        id: 'rozhledna-bramberk',
        title: 'Rozhledna Bramberk s restaurací',
        subtitle: '17 km od hotelu · 25 minut autem',
        img: '/Fotky Aktivit/rozhledna-bramberk-4.webp',
        alt: 'Kamenná rozhledna Bramberk obklopená lesem',
        desc: 'Bramberk stojí nad Lučany nad Nisou a patří k nejstarším rozhlednám v okolí. Kamenná věž vyrůstá přímo z lesa a nahoře je ochoz s kruhovým výhledem.\n\nU paty rozhledny je restaurace, takže se dá výlet spojit s obědem. Parkuje se kousek pod vrcholem, poslední úsek se jde pěšky asi deset minut. Nenáročné, vhodné i pro pomalejší chůzi.'
      },
      {
        id: 'bobova-draha-janov',
        title: 'Bobová dráha Janov nad Nisou',
        subtitle: '16 km od hotelu · 25 minut autem',
        img: '/Fotky Aktivit/bobova-draha-janov.jpg',
        alt: 'Bob na kolejnici bobové dráhy v Janově nad Nisou',
        desc: 'Dráha měří devět set metrů a má dvaadvacet zatáček. Zvláštností je karusel, ve kterém se bob otočí o celou zatáčku a půl.\n\nVozík má brzdu, takže si rychlost řídíte sami — dá se to sjet svižně i pomalu. Boby jsou pro jednoho nebo dva lidi, takže menší dítě může jet s vámi. V areálu je restaurace s terasou a dětský koutek. Otevřeno bývá celoročně.'
      },
      {
        id: 'rozhledna-kralovka',
        title: 'Rozhledna Královka s restaurací',
        subtitle: '19 km od hotelu · 30 minut autem',
        img: '/Fotky Aktivit/rozhledna-kralovka-5.webp',
        alt: 'Kamenná rozhledna Královka s restaurací nad Janovem nad Nisou',
        desc: 'Královka stojí nad Janovem nad Nisou a je jednou z nejdostupnějších rozhleden v okolí. Od parkoviště je to jen kousek po rovině.\n\nZ ochozu vidíte na hřebeny Jizerských hor, Ještěd i na Jablonec. Hned u rozhledny je restaurace s terasou. Ideální na krátký výlet, když nechcete strávit celý den chůzí.'
      },
      {
        id: 'muzeum-skla-auto',
        title: 'Muzeum skla a bižuterie v Jablonci nad Nisou',
        subtitle: '16 km od hotelu · 24 minut autem',
        img: '/Fotky Aktivit/muzeum-skla-jablonec.webp',
        alt: 'Expozice skleněných a bižuterních výrobků v jabloneckém muzeu',
        desc: 'Muzeum ukazuje historii řemesla, které tenhle kraj po staletí živilo. Sbírka skla a bižuterie patří k nejrozsáhlejším na světě.\n\nUvidíte lustry, vánoční ozdoby, korálky i sklo z různých období. Expozice jsou přehledně uspořádané a nejsou vyčerpávající — projdete je za hodinu a půl. Vhodné za každého počasí. Autem z hotelu asi půl hodiny.'
      },
      {
        id: 'koupaliste-dolina',
        title: 'Koupaliště Dolina s restaurací v Bedřichově',
        subtitle: '20 km od hotelu · 30 minut autem',
        img: '/Fotky Aktivit/koupaliste-dolina.webp',
        alt: 'Přírodní koupaliště Dolina v Bedřichově s dřevěnou budovou restaurace',
        desc: 'Dolina je přírodní koupaliště v Bedřichově, obklopené lesem. Voda je horská, takže i v největším vedru osvěží.\n\nU koupaliště je restaurace s terasou a posezením, dá se tu strávit celé odpoledne. Areál je udržovaný a klidný, není to velký aquapark, ale příjemné místo na pohodový den. Autem z hotelu asi půl hodiny.'
      },
      {
        id: 'cerna-studnice-auto',
        title: 'Rozhledna Černá Studnice s chatou',
        subtitle: '14 km od hotelu · 23 minut autem',
        img: '/Fotky Aktivit/rozhledna-cerna-studnice.webp',
        alt: 'Kamenná rozhledna Černá Studnice s horskou chatou nad Jabloncem',
        desc: 'Rozhledna z konce devatenáctého století stojí na skalnatém vrcholu nad Jabloncem. Je postavená z hrubého kamene a působí spíš jako středověká věž.\n\nZ ochozu je za jasného počasí vidět na Ještěd, Jizerské hory i do vnitrozemí. Hned vedle je horská chata s kuchyní, kde se dá naobědvat. Parkoviště je kousek pod vrcholem, pěšky asi patnáct minut.'
      },
      {
        id: 'bozkovske-jeskyne',
        title: 'Bozkovské dolomitové jeskyně',
        subtitle: '21 km od hotelu · 30 minut autem',
        img: '/Fotky Aktivit/bozkovske-jeskyne.webp',
        alt: 'Podzemní jezero v Bozkovských dolomitových jeskyních',
        desc: 'Bozkovské jeskyně jsou jediné zpřístupněné jeskyně v severních Čechách. Objevily se náhodou při hledání vody v padesátých letech.\n\nProhlídka trvá zhruba čtyřicet minut a vede vás průvodce. Hlavní zajímavostí je podzemní jezero, největší svého druhu v Česku. Uvnitř je stále kolem devíti stupňů, vezměte si bundu. Vstupenky se doporučuje rezervovat předem.'
      },
      {
        id: 'obri-sud-libverda',
        title: 'Výletní restaurace Obří sud v Lázních Libverda',
        subtitle: '29 km od hotelu · 42 minut autem',
        img: '/Fotky Aktivit/obri-sud-libverda.webp',
        objectPosition: 'left center',
        alt: 'Dřevěná výletní restaurace Obří sud u Lázní Libverda',
        desc: 'Restaurace je opravdu postavená do tvaru obrovského dřevěného sudu. Vznika ve třicátých letech jako výletní atrakce a slouží dodnes.\n\nUvnitř je klasická česká kuchyně, venku terasa s výhledem do kraje. Je to místo, kam se jezdí spíš pro tu kuriozitu a atmosféru než pro jídlo samotné — ale najíst se tu dá dobře. Nedaleko jsou Lázně Libverda a Hejnice.'
      },
      {
        id: 'zamek-sychrov',
        title: 'Státní zámek Sychrov',
        subtitle: '34 km od hotelu · 42 minut autem',
        img: '/Fotky Aktivit/zamek-sychrov-5.webp',
        alt: 'Novogotický zámek Sychrov s parkem',
        desc: 'Sychrov je novogotický zámek, který po generace patřil francouzskému rodu Rohanů. Interiéry jsou dochované v původním stavu — dřevěné obklady, portréty, knihovna.\n\nProhlídky vede průvodce a trvají zhruba hodinu. Kolem zámku je rozsáhlý anglický park s rybníkem a starými stromy, kterým se dá projít i bez vstupenky. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'zamek-frydlant',
        title: 'Státní zámek Frýdlant',
        subtitle: '35 km od hotelu · 50 minut autem',
        img: '/zamek frydlant.webp',
        alt: 'Hrad a zámek Frýdlant v Libereckém kraji',
        desc: 'Frýdlant je ojedinělá dvojice — středověký hrad a renesanční zámek stojí těsně vedle sebe na jedné skále nad městem. Právě proto se mu říká hrad a zámek Frýdlant a patří k nejnavštěvovanějším památkám Libereckého kraje.\n\nProhlídkové okruhy vedou hradním jádrem i zámeckými interiéry, k vidění jsou zbrojnice, historické kuchyně i zařízené pokoje. Je to nejvzdálenější z našich tipů na výlet autem, počítejte se zhruba padesáti minutami cesty a spíš celým dnem.'
      },
      {
        id: 'dinopark-auto',
        title: 'Dinopark Liberec',
        subtitle: '26 km od hotelu · 40 minut autem',
        img: '/Fotky Aktivit/dinopark-liberec.webp',
        objectPosition: '25% center',
        alt: 'Model dinosaura v životní velikosti v Dinoparku Liberec',
        desc: 'V parku jsou rozestavěné modely dinosaurů v životní velikosti. Některé se hýbou a vydávají zvuky, což na děti udělá dojem.\n\nKromě modelů je tu kino s filmem o pravěku, paleontologické hřiště, kde se dá hrabat v písku, a naučné cedule. Cesta parkem je zpevněná a dá se projít bez námahy. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'zoo-liberec-auto',
        title: 'Zoo Liberec',
        subtitle: '26 km od hotelu · 40 minut autem',
        img: '/Fotky Aktivit/zoo-liberec.webp',
        alt: 'Výběh se zvířaty v liberecké zoologické zahrady',
        desc: 'Liberecká zoo je nejstarší zoologická zahrada v Česku, funguje od roku 1904. Žije tu kolem sto sedmdesáti druhů zvířat ze všech světadílů.\n\nNa rozdíl od velkých zahrad se dá projít pohodlně za dvě až tři hodiny, aniž byste se uchodili. K nejoblíbenějším patří pandy červené, lachtani a levharti sněžní. V areálu je občerstvení i místa na odpočinek.'
      },
      {
        id: 'iqlandia-auto',
        title: 'iQlandia Liberec',
        subtitle: '27 km od hotelu · 37 minut autem',
        img: '/Fotky Aktivit/iqlandia-liberec.webp',
        objectPosition: '65% center',
        alt: 'Interaktivní exponáty ve vědeckém centru iQlandia v Liberci',
        desc: 'iQlandia je vědecké centrum, kde si všechno můžete osahat a vyzkoušet. Na čtyřech patrech je přes pět set exponátů rozdělených do jedenácti expozic — vesmír, lidské tělo, živly, smysly.\n\nSoučástí je planetárium s projekcí na kupoli. Během dne probíhají vědecké show, kde se předvádějí pokusy. Je to nejlepší program na deštivý den. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'funpark-babylon-auto',
        title: 'Funpark a Lunapark Babylon v Liberci',
        subtitle: '27 km od hotelu · 37 minut autem',
        img: '/Fotky Aktivit/funpark-babylon-liberec-1.webp',
        objectPosition: 'left center',
        alt: 'Vnitřní zábavní park Babylon v Liberci s atrakcemi',
        desc: 'Babylon je velký zábavní komplex v centrum Liberce. Lunapark nabízí klasické kolotoče a atrakce, Funpark je spíš pro menší děti — prolézačky, skluzavky a herní zóny.\n\nVšechno je pod střechou, takže na počasí vůbec nezáleží. V areálu je i aquapark a několik restaurací, dá se tu strávit celý den. Parkování je přímo u budovy.'
      },
      {
        id: 'jested-auto',
        title: 'Ještěd v Liberci',
        subtitle: '31 km od hotelu · 42 minut autem',
        img: '/Fotky Aktivit/jested-2.webp',
        alt: 'Silueta vysílače a hotelu Ještěd nad Libercem',
        desc: 'Ještěd je nejznámější stavba severních Čech — kuželovitá věž, která plynule navazuje na tvar kopce. Je to zároveň vysílač i hotel s restaurací a architektonicky patří k tomu nejlepšímu, co u nás vzniklo.\n\nNahoru se dá vyjet lanovkou z Horního Hanychova, což je nejpohodlnější varianta. Za jasného počasí je z vrcholu vidět do Německa i do Polska. Autem z hotelu asi tři čtvrtě hodiny.'
      },
      {
        id: 'mumlavske-vodopady',
        title: 'Mumlavské vodopády v Harrachově',
        subtitle: '16 km od hotelu · 19 minut autem',
        img: '/Fotky Aktivit/mumlavske-vodopady-3.webp',
        alt: 'Mumlavské vodopády v Harrachově padající přes skalní stupeň',
        desc: 'Řeka Mumlava se tu přelévá přes skalní stupeň vysoký deset metrů a rozstřikuje se do širokého vějíře. Po jarním tání nebo po vydatném dešti je to působivá podívaná.\n\nK vodopádu vede z Harrachova široká lesní cesta, dlouhá zhruba dva kilometry, bez prudkého stoupání. Kousek nad vodopádem stojí restaurace, kde se dá dát oběd. Autem z hotelu asi dvacet minut.'
      },
      {
        id: 'lanovy-park-bedrichov',
        title: 'Lanový park Bedřichov',
        subtitle: '20 km od hotelu · 28 minut autem',
        img: '/Fotky Aktivit/lanovy-park-bedrichov.jpg',
        alt: 'Lanové překážky mezi stromy v lanovém parku v Bedřichově',
        desc: 'Mezi stromy jsou natažené lanové překážky v několika výškových úrovních. Trasy jsou rozdělené podle náročnosti, takže si vybere i menší dítě i dospělý, který si chce vyzkoušet něco náročnějšího.\n\nO bezpečnost se stará obsluha a každý dostane jistící postroj. Nemusíte být sportovec — jde spíš o odvahu než o sílu. Autem z hotelu asi půl hodiny, ideální program na půl dne.'
      }
    ]
  }
};

/**
 * Vzdálenost cíle od hotelu v kilometrech, vytažená z popisku
 * („3,1 km od hotelu | Desná", „26 km od hotelu · 40 minut autem").
 *
 * Popisky bez čísla — „přímo u hotelu", „pár minut od hotelu" — jsou
 * ty úplně nejbližší, proto nula.
 */
function vzdalenostOdHotelu(polozka) {
  const popis = String((polozka && polozka.subtitle) || '');
  const nalez = popis.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  if (!nalez) return 0;
  const km = parseFloat(nalez[1].replace(',', '.'));
  return Number.isFinite(km) ? km : 0;
}

// Karty v kategoriích se řadí od nejbližšího cíle po nejvzdálenější — host
// tak nahoře najde, kam dojde pěšky, a teprve dole celodenní výlety autem.
// Řadí se tady, ne ručně v datech, aby nově dopsaný cíl skočil sám na
// správné místo. Statické stránky okoli-*.html musí mít stejné pořadí.
Object.values(CATEGORIES_DATA).forEach((kategorie) => {
  if (Array.isArray(kategorie.items)) {
    kategorie.items.sort((a, b) => vzdalenostOdHotelu(a) - vzdalenostOdHotelu(b));
  }
});

// Generování HTML pro detailní stránky jednotlivých kategorií
const getCategoryPageHTML = (catId) => {
  const cat = CATEGORIES_DATA[catId] || CATEGORIES_DATA['turistika'];

  const cardsHTML = cat.items.map((item, idx) => `
    <div class="category-destination-card" data-category="${catId}" data-id="${item.id}">
      <div class="category-destination-img-wrap">
        <img src="${item.img}" alt="${item.alt || item.title}" loading="${idx < 4 ? 'eager' : 'lazy'}" decoding="async"${idx < 4 ? ' fetchpriority="high"' : ''}${item.objectPosition ? ` style="object-position: ${item.objectPosition};"` : ''} class="${idx < 4 ? 'img-loaded' : ''}" onload="this.classList.add('img-loaded')">
      </div>
      <div class="category-destination-footer">
        <h3 class="category-destination-title">${item.title}</h3>
        <button class="btn-destination-detail" data-category="${catId}" data-id="${item.id}">Zjistit více &rsaquo;</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="category-detail-page">
      <!-- HERO SEKCE KATEGORIE -->
      <section class="hero-section category-hero-section room-detail-hero" id="uvod-kategorie">
        <!-- Na telefon jde užší varianta; musí to sedět se statickou
             stránkou okoli-*.html, jinak se po prokliku zevnitř webu
             stáhne jiná fotka než při přímém načtení. -->
        <picture>
          ${cat.heroImgMobil ? `<source media="(max-width: 767px)" srcset="${encodeURI(cat.heroImgMobil)}">` : ''}
          <img class="hero-category-poster hero-category-poster-${catId}" src="${cat.heroImg}" alt="${cat.title} - Hotel u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
        </picture>
        <div class="hero-overlay"></div>
        <div class="hero-inner">
          ${getHeaderHTML()}

          <div class="room-detail-hero-center">
            <h1 class="hero-title room-detail-hero-title">
              <span>${cat.title} v okolí hotelu</span>
            </h1>
            <p class="room-detail-hero-subtitle">
              <span>${cat.subtitle}</span>
            </p>

            <div class="category-hero-buttons-wrap">
              <a href="/okoli#aktivity-v-okoli" class="btn btn-activities-hero btn-activities-hotel">‹ Zpět na přehled aktivit</a>
            </div>
          </div>

          <div class="scroll-down-btn" id="scroll-btn-category">
            <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
            </svg>
          </div>
        </div>
      </section>

      <!-- SEZNAM AKTIVIT V KATEGORII (MŘÍŽKA 4 SLOUPCE) -->
      <section class="category-destinations-section" id="seznam-aktivit">
        <div class="category-destinations-inner">
          <div class="category-destinations-header">
            <h2 class="category-destinations-main-title">${cat.title}</h2>
            <p class="category-destinations-count">Nalezeno ${cat.items.length} skvělých cílů v okolí</p>
          </div>

          <div class="category-destinations-grid">
            ${cardsHTML}
          </div>
        </div>
      </section>

      <!-- SPOLČNÁ CTA A FOOTER -->
      ${getCtaHTML()}
      ${getFooterHTML()}

      <!-- POPUP MODAL PRO DETAIL AKTIVITY -->
      <div class="destination-modal-overlay" id="destination-modal">
        <div class="destination-modal-backdrop" id="destination-modal-backdrop"></div>
        <div class="destination-modal-container">
          <button class="destination-modal-close" id="destination-modal-close" aria-label="Zavřít detail">&times;</button>
          
          <div class="destination-modal-header">
            <span class="destination-modal-badge" id="destination-modal-cat-badge">Kategorie</span>
            <h3 class="destination-modal-title" id="destination-modal-title">Název aktivity</h3>
          </div>

          <div class="destination-modal-body" id="destination-modal-body">
            <div id="destination-modal-desc">Detailní popis aktivity a tipy na výlet...</div>
          </div>

          <div class="destination-modal-footer">
            <button class="btn btn-activities-hero btn-activities-hotel" id="destination-modal-btn-close">‹ Zpět na výběr aktivit</button>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Inicializace interaktivity pro pop-up modal detailu aktivity
const initDestinationModal = () => {
  const modal = document.getElementById('destination-modal');
  if (!modal) return;

  const backdrop = document.getElementById('destination-modal-backdrop');
  const closeBtn = document.getElementById('destination-modal-close');
  const btnModalClose = document.getElementById('destination-modal-btn-close');

  const titleEl = document.getElementById('destination-modal-title');
  const descEl = document.getElementById('destination-modal-desc');
  const imgEl = document.getElementById('destination-modal-img');
  const badgeEl = document.getElementById('destination-modal-cat-badge');

  const closeModal = () => {
    modal.classList.remove('is-active');
    document.body.style.overflow = '';
  };

  if (backdrop) backdrop.addEventListener('click', closeModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (btnModalClose) btnModalClose.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-active')) {
      closeModal();
    }
  });

  // Globální handler pro boční záložku a pop-up modal oznámení

  // Global Delegation for FAQ Accordion (Full Area Clickable)
  document.addEventListener('click', (e) => {
    const faqItem = e.target && e.target.closest('.faq-item');
    if (faqItem) {
      const answerContent = e.target.closest('.faq-answer-content');
      if (!answerContent) {
        e.preventDefault();
        const isOpen = faqItem.classList.contains('is-open');
        const btn = faqItem.querySelector('.faq-question-btn');

        document.querySelectorAll('.faq-item.is-open').forEach(otherItem => {
          if (otherItem !== faqItem) {
            otherItem.classList.remove('is-open');
            const otherBtn = otherItem.querySelector('.faq-question-btn');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          }
        });

        if (isOpen) {
          faqItem.classList.remove('is-open');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        } else {
          faqItem.classList.add('is-open');
          if (btn) btn.setAttribute('aria-expanded', 'true');
        }
      }
    }
  });


  document.querySelectorAll('.category-destination-card, .btn-destination-detail').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = el.closest('.category-destination-card');
      if (!card) return;

      const catId = card.getAttribute('data-category');
      const itemId = card.getAttribute('data-id');

      const cat = CATEGORIES_DATA[catId];
      if (!cat) return;

      const item = cat.items.find(i => i.id === itemId);
      if (!item) return;

      if (titleEl) titleEl.textContent = item.title;
      if (descEl) {
        const paragraphs = (item.desc || '').split('\n\n');
        descEl.innerHTML = paragraphs.map(p => `<p class="destination-modal-desc-p" style="margin: 0 0 14px 0; font-size: 15.5px; line-height: 1.65; color: #444440;">${p.replace(/\n/g, '<br>')}</p>`).join('');
      }
      if (badgeEl) badgeEl.textContent = item.subtitle || cat.title;

      modal.classList.add('is-active');
      document.body.style.overflow = 'hidden';
    });
  });
};

/**
 * Dosadí do hero fotky variantu podle šířky okna.
 *
 * `<picture>` vložené přes `innerHTML` prohlížeč nevyhodnotí — obrázek
 * si vezme adresu z `src` a `<source media>` ignoruje, protože se
 * o rodiči dozví až po tom, co začal načítat. Na statické stránce to
 * funguje (tam HTML parsuje rovnou), při přechodu uvnitř webu ne, takže
 * telefon dostal desktopovou fotku o půl megabajtu.
 *
 * Nekopíruje se tu žádné pravidlo navíc: bere se přesně to, co je
 * napsané v `media` u `<source>`, takže statická stránka i šablona
 * vyberou totéž.
 */
function srovnejHeroPodleSirky() {
  document.querySelectorAll('picture > img').forEach(img => {
    const zdroje = [...img.parentElement.querySelectorAll('source[media][srcset]')];
    const sedici = zdroje.find(z => window.matchMedia(z.media).matches);
    const chtena = sedici ? sedici.srcset.trim().split(/\s+/)[0] : img.dataset.hero;
    if (!chtena) return;
    // Původní adresa se schová, aby se šlo vrátit, když se okno rozšíří.
    if (!img.dataset.hero) img.dataset.hero = img.getAttribute('src');
    if (img.getAttribute('src') !== chtena) img.setAttribute('src', chtena);
  });
}

// Při otočení telefonu nebo změně okna se musí vybrat znovu — jinak by
// na širokém displeji zůstala viset mobilní fotka roztažená do šířky.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', srovnejHeroPodleSirky, { passive: true });
}

const app = document.querySelector('#app');
let currentViewKey = null;

/**
 * Odroluje na sekci a drží se jí, i když se stránka pod rukama ještě sype.
 *
 * Původně to byl jediný `requestAnimationFrame`. Na mobilu se ale fotky
 * dotahují postupně, takže sekce po doskočení odplula jinam a vypadalo to,
 * že tlačítko nefunguje (hlášeno u „Aktivity v okolí"). Pozice se proto
 * přepočítá ještě několikrát a naposledy po `load`, kdy má dokument
 * konečnou výšku. Jakmile uživatel sám zaroluje, přestaneme mu do toho mluvit.
 */
const odrolujNaSekci = (selektor) => {
  let zrus = false;
  const prestat = () => { zrus = true; };
  window.addEventListener('wheel', prestat, { once: true, passive: true });
  window.addEventListener('touchstart', prestat, { once: true, passive: true });

  const skoc = () => {
    if (zrus) return;
    const cil = document.querySelector(selektor);
    if (!cil) return;
    const hlavicka = document.querySelector('.site-header');
    const odstup = hlavicka ? hlavicka.offsetHeight + 12 : 100;
    const y = cil.getBoundingClientRect().top + window.pageYOffset - odstup;
    window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
  };

  requestAnimationFrame(skoc);
  [80, 250, 600, 1200].forEach(ms => setTimeout(skoc, ms));
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => setTimeout(skoc, 60), { once: true });
  }
};

const route = (isInitial = false) => {
  // Ensure page scrolling is unlocked on every navigation/route change
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.classList.remove('modal-open');
  document.documentElement.classList.remove('modal-open');
  const activeOverlay = document.getElementById('mobile-menu-overlay');
  if (activeOverlay) activeOverlay.classList.remove('is-active');

  // Ensure saved season mode is maintained
  const savedSeason = getInitialSeasonMode();
  setSeasonMode(savedSeason, false);

  const hash = window.location.hash || '';
  let cleanHash = hash.split('?')[0];
  try {
    cleanHash = decodeURIComponent(cleanHash).toLowerCase();
  } catch (e) { }

  const knownHomeHashes = [
    '', '#', '#domu', '#uvod', '#o-nas', '#zazemi', '#sleva', '#promo',
    '#recenze', '#hodnoceni'
  ];

  const knownNewsHashes = [
    '#aktuality', '#novinky', '#banner-detail', '#zpravy', '#oznameni'
  ];

  const knownContactHashes = [
    '#kontakt', '#kontakt-stranka', '#kde-nas-najdete', '#napiste-nam'
  ];

  const knownActivitiesHashes = [
    '#aktivity', '#okoli', '#aktivity-stranka', '#aktivity-v-hotelu',
    '#aktivity-v-okoli', '#faq'
  ];

  const knownCategoryHashes = [
    '#turistika',
    '#cyklistika',
    '#zimni-vylety', '#zimni', '#zimní-výlety', '#zimní-vylety', '#vylety-v-zime',
    '#vylety-autem', '#autem', '#výlety-autem'
  ];

  const knownDiningHashes = [
    '#sluzby', '#stravovani', '#stravovani-stranka', '#restaurace',
    '#snidane', '#vecere', '#krb-restaurace', '#teraska', '#grilovani'
  ];

  const knownEventsHashes = [
    '#akce', '#skupinove-akce', '#skupinove-akce-stranka', '#akce-stranka', '#oslavy-akce',
    '#celay-hotel', '#typy-akci', '#zaridime'
  ];

  let pageKey = 'home';
  const pathName = window.location.pathname.toLowerCase().replace(/\/$/, '');

  // 1. SPECIFICKÉ SUB-VIEW HASHE (přehodnocení nad obecnou pathname pro #prizemi, #vyhled, #turistika atd.)
  if (cleanHash === '#prizemi' || cleanHash === '#pokoj-prizemi' || cleanHash === '#pokoje-prizemi' || cleanHash === '#pokoj-v-prizemi' || cleanHash === '#prizemi-detail' || cleanHash === '#vyhled' || cleanHash === '#pokoj-vyhled' || cleanHash === '#pokoje-vyhled' || cleanHash === '#pokoj-s-vyhledem' || cleanHash === '#vyhled-detail') {
    if (pathName !== '/ubytovani' && pathName !== '/ubytovani.html') {
      window.location.replace('/ubytovani#rozdeleni-pokoju');
      return;
    }
    pageKey = 'rooms';
  } else if (cleanHash.startsWith('#rezervace')) {
    pageKey = 'booking';
  } else if (cleanHash.startsWith('#admin')) {
    pageKey = 'admin';
  } else if (knownCategoryHashes.includes(cleanHash) || cleanHash.includes('turistik') || cleanHash.includes('cykl') || cleanHash.includes('zimn') || cleanHash.includes('autem')) {
    pageKey = 'category-detail';
  }
  // 2. PATHNAME KONTROLA (podle čisté URL adresy v adresním řádku)
  else if (pathName === '/prizemi' || pathName === '/vyhled') {
    window.location.replace('/ubytovani#rozdeleni-pokoju');
    return;
  } else if (pathName === '/ubytovani' || pathName === '/ubytovani.html' || pathName === '/pokoje') {
    pageKey = 'rooms';
  } else if (pathName === '/stravovani' || pathName === '/stravovani.html' || pathName === '/gastronomie') {
    pageKey = 'dining';
  } else if (pathName === '/akce' || pathName === '/akce.html' || pathName === '/skupinove-akce') {
    pageKey = 'events';
    // Adresy bez „.html" tu chyběly, přestože přesně takhle je servíruje
    // Netlify. Stránka se sice vykreslila ze statického HTML, ale žádná
    // obsluha se na ni nenapojila — tlačítko „Zjistit více" nedělalo nic.
  } else if (pathName === '/okoli-turistika' || pathName === '/okoli-turistika.html' || pathName === '/okoli/turistika'
    || pathName === '/okoli-cyklistika' || pathName === '/okoli-cyklistika.html' || pathName === '/okoli/cyklistika'
    || pathName === '/okoli-zima' || pathName === '/okoli-zima.html' || pathName === '/okoli/zima'
    || pathName === '/okoli-vylety-autem' || pathName === '/okoli-vylety-autem.html' || pathName === '/okoli/vylety-autem') {
    pageKey = 'category-detail';
  } else if (pathName === '/okoli' || pathName === '/okoli.html' || pathName === '/aktivity' || pathName === '/vylety') {
    pageKey = 'activities';
  } else if (pathName === '/aktuality' || pathName === '/aktuality.html' || pathName === '/novinky') {
    pageKey = 'news';
  } else if (pathName === '/kontakt' || pathName === '/kontakt.html') {
    pageKey = 'contact';
  } else if (pathName === '/admin' || pathName === '/admin.html' || pathName === '/recepce') {
    pageKey = 'admin';
  } else if (pathName === '/rezervace' || pathName === '/booking') {
    pageKey = 'booking';
  } else if (pathName === '/prizemi') {
    pageKey = 'ground';
  } else if (pathName === '/vyhled') {
    pageKey = 'view';
  } else if (pathName === '/gdpr' || pathName === '/gdpr.html') {
    pageKey = 'gdpr';
  } else if (pathName === '/cookies' || pathName === '/cookies.html') {
    pageKey = 'cookies';
  } else if (pathName === '/podminky' || pathName === '/podminky.html') {
    pageKey = 'podminky';
  }
  // 3. DOKONČENÍ SEKCIONÁLNÍCH HASHŮ
  else if (knownNewsHashes.includes(cleanHash) || cleanHash.includes('aktualit') || cleanHash.includes('novink')) {
    pageKey = 'news';
  } else if (knownContactHashes.includes(cleanHash) || cleanHash.includes('kontakt')) {
    pageKey = 'contact';
  } else if (knownActivitiesHashes.includes(cleanHash)) {
    pageKey = 'activities';
  } else if (knownEventsHashes.includes(cleanHash)) {
    pageKey = 'events';
  } else if (knownDiningHashes.includes(cleanHash)) {
    pageKey = 'dining';
  } else if (cleanHash.startsWith('#pokoje') || cleanHash === '#nabidka-pokoju') {
    pageKey = 'rooms';
  } else if (cleanHash === '#404' || cleanHash === '#error') {
    pageKey = '404';
  } else if (knownHomeHashes.includes(cleanHash)) {
    pageKey = 'home';
  } else if (cleanHash.length > 1) {
    pageKey = '404';
  } else {
    pageKey = 'home';
  }

  const isNewPage = currentViewKey !== pageKey;
  currentViewKey = pageKey;

  if (pageKey === 'rooms' || pageKey === 'dining' || pageKey === 'events' || pageKey === 'activities' || pageKey === 'category-detail' || pageKey === 'contact' || pageKey === 'news' || pageKey === 'gdpr' || pageKey === 'cookies' || pageKey === 'podminky') {
    preloadHeroImages(pageKey);
  }

  // Ověření, zda domovský HTML v #app odpovídá cílové stránce pageKey
  let isPreRenderedMatch = false;
  if (isInitial && app && app.children && app.children.length > 0) {
    if (pageKey === 'home' && app.querySelector('.hero-section:not(.news-hero-section):not(.contact-hero-section):not(.dining-hero-section):not(.events-hero-section):not(.activities-hero-section):not(.rooms-hero-section)')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'category-detail' && app.querySelector('.surrounding-detail-hero, .category-detail-section, .category-hero-section')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'rooms' && app.querySelector('.rooms-hero-section, #sekce-pokoje')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'dining' && app.querySelector('.dining-hero-section, #sekce-stravovani')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'events' && app.querySelector('.events-hero-section, #sekce-akce')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'activities' && app.querySelector('.activities-hero-section, #sekce-aktivity')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'contact' && app.querySelector('.contact-hero-section, #sekce-kontakt')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'news' && app.querySelector('.news-hero-section, #seznam-aktualit')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'gdpr' && app.querySelector('#uvod-gdpr')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'cookies' && app.querySelector('#uvod-cookies')) {
      isPreRenderedMatch = true;
    } else if (pageKey === 'podminky' && app.querySelector('#uvod-podminky')) {
      isPreRenderedMatch = true;
    }
  }

  if (pageKey === 'booking') {
    app.innerHTML = getBookingPageHTML();
    initInteractivity();
    const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
    const roomId = urlParams.get('room') || '';
    const openCal = urlParams.get('pickdates') === '1';
    new BookingSystem('booking-container').init(roomId, openCal);
  } else if (pageKey === 'admin') {
    app.innerHTML = getAdminPageHTML();
    initInteractivity();
    new AdminDashboard('admin-container').init();
  } else if (pageKey === 'gdpr') {
    if (!isPreRenderedMatch) app.innerHTML = getGdprPageHTML();
    initInteractivity();
  } else if (pageKey === 'cookies') {
    if (!isPreRenderedMatch) app.innerHTML = getCookiesPageHTML();
    initInteractivity();
  } else if (pageKey === 'podminky') {
    if (!isPreRenderedMatch) app.innerHTML = getPodminkyPageHTML();
    initInteractivity();
  } else if (pageKey === 'news') {
    if (!isPreRenderedMatch) {
      app.innerHTML = getNewsPageHTML([]);
      initInteractivity();
    }

    const btnGoto = document.getElementById('btn-goto-news-list');
    if (btnGoto) {
      btnGoto.addEventListener('click', () => {
        const listSec = document.getElementById('seznam-aktualit');
        if (listSec) listSec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Seznam se načítá VŽDY, i když stránka přišla předrenderovaná ze
    // statického HTML. Dřív se načítal jen při přechodu uvnitř webu,
    // takže po obnovení stránky zůstaly viset aktuality zapsané v HTML —
    // včetně těch, které už byly v administraci smazané.
    nactiAktualityDoStranky();
  } else if (pageKey === 'category-detail') {
    let catId = cleanHash.replace('#', '');
    if (!catId || catId === 'category-detail') {
      if (pathName.includes('turistik')) catId = 'turistika';
      else if (pathName.includes('cykl')) catId = 'cyklistika';
      else if (pathName.includes('zima')) catId = 'zimni-vylety';
      else if (pathName.includes('aut')) catId = 'vylety-autem';
    }
    if (catId.includes('turistik')) catId = 'turistika';
    else if (catId.includes('cykl')) catId = 'cyklistika';
    else if (catId.includes('zimn') || catId.includes('zima')) catId = 'zimni-vylety';
    else if (catId.includes('aut')) catId = 'vylety-autem';
    else catId = 'turistika';

    preloadCategoryImages(catId);
    if (!isPreRenderedMatch) {
      app.innerHTML = getCategoryPageHTML(catId);
    }
    initDestinationModal();
  } else if (pageKey === 'activities') {
    if (!isPreRenderedMatch) app.innerHTML = getActivitiesPageHTML();
  } else if (pageKey === 'events') {
    if (!isPreRenderedMatch) app.innerHTML = getEventsPageHTML();
  } else if (pageKey === 'dining') {
    if (!isPreRenderedMatch) app.innerHTML = getStravovaniPageHTML();
  } else if (pageKey === 'rooms') {
    if (!isPreRenderedMatch) app.innerHTML = getRoomsPageHTML();
  } else if (pageKey === 'contact') {
    if (!isPreRenderedMatch) app.innerHTML = getContactPageHTML();
    initContactPageInteractivity();
  } else if (pageKey === '404') {
    app.innerHTML = get404PageHTML();
  } else {
    if (!isPreRenderedMatch) app.innerHTML = getHomePageHTML();
  }

  // Přesun na vrchol při běžné navigaci na NOVOU stránku nebo na kontakt / aktuality
  const isSectionHashOnDining = pageKey === 'dining' && ['#snidane', '#vecere', '#krb-restaurace', '#teraska', '#grilovani', '#oslavy-akce'].includes(cleanHash);
  const isContactFormHash = pageKey === 'contact' && ['#form-sekce', '#napiste-nam', '#kontakt-form', '#poptavka'].includes(cleanHash);
  const isActivitiesSectionHash = pageKey === 'activities' && ['#aktivity-v-hotelu', '#aktivity-v-okoli'].includes(cleanHash);
  if (!isContactFormHash && !isActivitiesSectionHash && (pageKey === 'booking' || pageKey === 'contact' || pageKey === 'news' || (!isInitial && isNewPage && !window.pendingAutoOpenRoom && hash !== '#pokoje-nabidka' && !isSectionHashOnDining))) {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  initInteractivity();
  srovnejHeroPodleSirky();
  syncCustomRoomNamesToDOM();
  syncDynamicRoomPricesToDOM();
  syncDisabledRoomsToDOM();
  spustHeroVideo();

  // Ceník i pokoje se načtou na pozadí; než dorazí, ukážou se data
  // z minulé návštěvy, případně výchozí ceník ze souboru cenik.js —
  // karty pokojů tak nikdy neblikají prázdnou cenou.
  //
  // Pokoje musí doběhnout taky, ne jen ceník: nesou názvy a počty lůžek,
  // a z lůžek se počítá, který sloupec ceníku je ten nejlevnější „od".
  Promise.all([fetchCenik(), fetchRoomPrices()])
    .then(() => {
      syncCustomRoomNamesToDOM();
      syncDynamicRoomPricesToDOM();
    })
    .catch(() => {});

  // Automatické odskrolování na sekci Nabídka pokojů při přechodu z tlačítka Nabídka pokojů
  if (pageKey === 'rooms' && hash === '#pokoje-nabidka') {
    odrolujNaSekci('.rooms-list-section');
  }

  // Automatické odskrolování na podsekci na stránce Stravování
  if (isSectionHashOnDining) {
    odrolujNaSekci(cleanHash);
  }

  // Automatické odskrolování na sekce na stránce Aktivity (#aktivity-v-hotelu / #aktivity-v-okoli)
  if (isActivitiesSectionHash) {
    odrolujNaSekci(cleanHash);
  }

  // Odstranění třídy is-route-loading po dokončení vykreslení cesty
  document.documentElement.classList.remove('is-route-loading');
};

// Globální obsluha prokliků na odkazy a kategorie
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href) return;

  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('tel:') || href.startsWith('mailto:') || link.hasAttribute('download') || link.target === '_blank') return;

  // Real HTML files / path links -> SPA plynulá navigace bez probliknutí
  if (href.startsWith('/') && !href.startsWith('/#')) {
    e.preventDefault();
    navigateTo(href);
    return;
  }

  // Handle hash links
  if (href.startsWith('#')) {
    const clean = href.split('?')[0].toLowerCase();

    if (clean === '#turistika' || clean === '#turistika-stranka') {
      e.preventDefault();
      navigateTo('/okoli/turistika');
      return;
    }
    if (clean === '#cyklistika' || clean === '#cyklistika-stranka') {
      e.preventDefault();
      navigateTo('/okoli/cyklistika');
      return;
    }
    if (clean === '#zimni-vylety' || clean === '#zimni' || clean === '#zima') {
      e.preventDefault();
      navigateTo('/okoli/zima');
      return;
    }
    if (clean === '#vylety-autem' || clean === '#autem') {
      e.preventDefault();
      navigateTo('/okoli/vylety-autem');
      return;
    }
    if (clean === '#pokoje' || clean === '#nabidka-pokoju') {
      e.preventDefault();
      navigateTo('/ubytovani');
      return;
    }
    if (clean === '#stravovani' || clean === '#sluzby') {
      e.preventDefault();
      navigateTo('/stravovani');
      return;
    }
    if (clean === '#akce') {
      e.preventDefault();
      navigateTo('/akce');
      return;
    }
    if (clean === '#aktivity' || clean === '#okoli') {
      e.preventDefault();
      navigateTo('/okoli');
      return;
    }
    if (clean === '#kontakt') {
      e.preventDefault();
      navigateTo('/kontakt');
      return;
    }
    if (clean === '#aktuality') {
      e.preventDefault();
      navigateTo('/aktuality');
      return;
    }
    if (clean === '#pokoj-prizemi' || clean === '#pokoje-prizemi' || clean === '#prizemi' || clean === '#pokoj-vyhled' || clean === '#pokoje-vyhled' || clean === '#vyhled') {
      e.preventDefault();
      navigateTo('/ubytovani#rozdeleni-pokoju');
      return;
    }

    // In-page section scrolling anchors (like #snidane, #vecere, #pokoje-nabidka, #aktivity-v-hotelu)
    const targetEl = document.querySelector(clean);
    if (targetEl) {
      e.preventDefault();
      window.location.hash = clean;
      targetEl.scrollIntoView({ behavior: 'smooth' });
    }
  }
});

/* =====================================================================
   COOKIE CONSENT SYSTEM (SENIOR FRIENDLY & GDPR COMPLIANT)
   ===================================================================== */
const COOKIE_CONSENT_KEY = 'hotel_cookie_consent_v1';

const getStoredConsent = () => {
  try {
    const val = localStorage.getItem(COOKIE_CONSENT_KEY);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    return null;
  }
};

const saveStoredConsent = (analyticsAllowed) => {
  try {
    const data = {
      analytics: !!analyticsAllowed,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data));
    return data;
  } catch (e) {
    return { analytics: !!analyticsAllowed };
  }
};

const initGA4 = () => {
  if (window.ga4Initialized) return;
  window.ga4Initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-X62MWWL0FV';
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-X62MWWL0FV', { anonymize_ip: true });
};

/**
 * Microsoft Clarity — teplotní mapy a nahrávky sezení.
 * Spouští se STEJNĚ jako GA4, tedy až po souhlasu s analytickými cookies.
 * Bez souhlasu se skript vůbec nenačte.
 */
const initClarity = () => {
  if (window.clarityInitialized) return;
  window.clarityInitialized = true;

  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', 'xx0xccp00j');
};

const initCookieManager = () => {
  const currentConsent = getStoredConsent();

  // If consent already given and analytics allowed, start GA4
  if (currentConsent && currentConsent.analytics) {
    initGA4();
    initClarity();
  }

  // Ensure Banner DOM elements exist
  if (!document.getElementById('cookie-banner-wrap')) {
    const bannerHTML = `
      <div class="cookie-banner-wrap${currentConsent ? ' is-hidden' : ''}" id="cookie-banner-wrap" aria-label="Nastavení cookies">
        <div class="cookie-banner-inner">
          <div class="cookie-banner-content">
            <h3 class="cookie-banner-title">Respektujeme vaše soukromí</h3>
            <p class="cookie-banner-desc">Používáme sušenky (cookies), aby náš web správně fungoval a věděli jsme, jak se vám u nás líbí. Žádné údaje neprodáváme ani na nich nevyděláváme.</p>
          </div>
          <div class="cookie-banner-actions">
            <button class="btn-cookie-accept" id="btn-cookie-accept-all">Přijmout vše</button>
            <button class="btn-cookie-reject" id="btn-cookie-reject-all">Odmítnout</button>
            <button class="btn-cookie-settings-link" id="btn-cookie-open-modal">Nastavení</button>
          </div>
        </div>
      </div>

      <div class="cookie-modal-overlay" id="cookie-modal-overlay" role="dialog" aria-modal="true">
        <div class="cookie-modal-container">
          <div class="cookie-modal-header">
            <div>
              <h3 class="cookie-modal-title">Nastavení cookies</h3>
              <p class="cookie-modal-subtitle">Vyberte si, které soubory cookies nám dovolíte používat.</p>
            </div>
            <button class="cookie-modal-close" id="btn-cookie-modal-close" aria-label="Zavřít okno">&times;</button>
          </div>

          <div class="cookie-modal-body">
            <div class="cookie-option-card">
              <div class="cookie-option-header">
                <span class="cookie-option-name">Technické (Nutné) cookies</span>
                <span class="cookie-badge-necessary">Vždy povolené</span>
              </div>
              <p class="cookie-option-desc">Tyto cookies jsou nezbytné pro správné fungování webu, odeslání rezervačního formuláře a zapamatování vašeho nastavení soukromí. Nelze je vypnout.</p>
            </div>

            <div class="cookie-option-card">
              <div class="cookie-option-header">
                <span class="cookie-option-name">Analytické cookies (Google Analytics)</span>
                <label class="cookie-switch">
                  <input type="checkbox" id="cookie-toggle-analytics"${(currentConsent && currentConsent.analytics) || !currentConsent ? ' checked' : ''}>
                  <span class="cookie-slider"></span>
                </label>
              </div>
              <p class="cookie-option-desc">Pomáhají nám anonymně měřit návštěvnost webu (kolik lidí nás navštívilo a které stránky si prohlížejí), abychom mohli web neustále vylepšovat.</p>
            </div>
          </div>

          <div class="cookie-modal-footer">
            <button class="btn-cookie-accept" id="btn-cookie-save-settings">Uložit moje nastavení</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', bannerHTML);
  }

  const bannerWrap = document.getElementById('cookie-banner-wrap');
  const modalOverlay = document.getElementById('cookie-modal-overlay');

  const btnAcceptAll = document.getElementById('btn-cookie-accept-all');
  const btnRejectAll = document.getElementById('btn-cookie-reject-all');
  const btnOpenModal = document.getElementById('btn-cookie-open-modal');
  const btnCloseModal = document.getElementById('btn-cookie-modal-close');
  const btnSaveSettings = document.getElementById('btn-cookie-save-settings');
  const toggleAnalytics = document.getElementById('cookie-toggle-analytics');

  const hideBanner = () => {
    if (bannerWrap) bannerWrap.classList.add('is-hidden');
  };

  const openModal = () => {
    if (modalOverlay) modalOverlay.classList.add('is-active');
  };

  const closeModal = () => {
    if (modalOverlay) modalOverlay.classList.remove('is-active');
  };

  if (btnAcceptAll) {
    btnAcceptAll.addEventListener('click', () => {
      saveStoredConsent(true);
      initGA4();
      initClarity();
      hideBanner();
      closeModal();
    });
  }

  if (btnRejectAll) {
    btnRejectAll.addEventListener('click', () => {
      saveStoredConsent(false);
      hideBanner();
      closeModal();
    });
  }

  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
      openModal();
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      closeModal();
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      const isAnalyticsChecked = toggleAnalytics ? toggleAnalytics.checked : false;
      saveStoredConsent(isAnalyticsChecked);
      if (isAnalyticsChecked) { initGA4(); initClarity(); }
      hideBanner();
      closeModal();
    });
  }

  // Globální obsluha otevření nastavení cookies odkudkoliv
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('#footer-cookie-settings-link, #btn-open-cookie-settings-page, .btn-open-cookie-settings');
    if (trigger) {
      e.preventDefault();
      openModal();
    }
  });
};

window.addEventListener('popstate', () => route(false));
window.addEventListener('hashchange', () => route(false));

// Prohlížeč si po každé stránce pamatuje, kam byla odrolovaná, a při
// návratu na ni scroll obnoví. Jenže stránky tady jsou samostatné .html
// soubory, takže klik v navigaci je plné načtení — a kdo si dřív prohlédl
// patičku, přistál na nové stránce rovnou dole v patičce místo v hero
// sekci. Obnovu proto řídíme sami: bez kotvy vždycky nahoru.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Immediate render on initial load without waiting for Supabase
route(true);

// Bez kotvy v adrese začíná každá stránka nahoře. Musí to proběhnout
// i po `load` — obrázky a písma dorovnají výšku dokumentu a prohlížeč
// by jinak stihl scroll vrátit ještě po nás.
const naVrchol = () => {
  if (window.location.hash) return;
  window.scrollTo(0, 0);
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
};
naVrchol();
window.addEventListener('load', () => {
  naVrchol();
  requestAnimationFrame(naVrchol);
}, { once: true });
initCookieManager();

initOnasRozbaleni();

window.addEventListener('load', () => {
  const v = document.querySelector('[data-hero-video]');
  if (v) {
    const c = navigator.connection;
    if (!(c && (c.saveData || /2g/.test(c.effectiveType || '')))) {
      v.preload = 'auto';
      v.load();
      v.play().catch(() => { });
    }
  }
});
