import './style.css';
import './booking.css';
import { BookingSystem } from './components/BookingSystem.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { getStoredRoomPrices, getStoredDisabledRooms, MOCK_ROOMS, saveContactMessage, getStoredNewsItems } from './lib/supabaseClient.js';
import { sendEmail, generateEmailContactNotification } from './utils/emailService.js';

export function syncDynamicRoomPricesToDOM() {
  const roomPrices = getStoredRoomPrices();
  const roomItems = document.querySelectorAll('.room-breakdown-item[data-room]');
  roomItems.forEach(item => {
    const roomId = item.dataset.room;
    const priceAmountEl = item.querySelector('.price-amount');
    if (!priceAmountEl || !roomId) return;

    const customP = roomPrices.find(p => p.room_id === roomId);
    let priceVal = null;
    if (customP && (customP.weekday_price || customP.base_price)) {
      priceVal = customP.weekday_price || customP.base_price;
    } else {
      const rmObj = MOCK_ROOMS.find(r => r.id === roomId);
      if (rmObj && (rmObj.weekdayPrice || rmObj.basePrice)) priceVal = rmObj.weekdayPrice || rmObj.basePrice;
    }
    if (priceVal) {
      priceAmountEl.textContent = `od ${priceVal} Kč`;
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

export const ROOM_GALLERIES = {
  p1: ['/hezky pokoj 1.webp'],
  p2: ['/hezky pokoj 1.webp'],
  p3: ['/balkony 1 copy.webp'],
  pa: [
    '/pokoje/mahagon/1.webp',
    '/pokoje/mahagon/2.webp',
    '/pokoje/mahagon/3.webp',
    '/pokoje/mahagon/4.webp',
    '/pokoje/mahagon/5.webp',
    '/pokoje/mahagon/7.webp',
    '/pokoje/mahagon/8.webp'
  ],
  p5: [
    '/pokoje/p5/1.webp',
    '/pokoje/p5/2.webp',
    '/pokoje/p5/3.webp',
    '/pokoje/p5/4.webp',
    '/pokoje/p5/5.webp',
    '/pokoje/p5/6.webp',
    '/pokoje/p5/7.webp',
    '/pokoje/p5/8.webp'
  ],
  p6: [
    '/hezky pokoj 1.webp'
  ],
  p7: [
    '/pokoje/p7/1.webp',
    '/pokoje/p7/2.webp',
    '/pokoje/p7/3.webp',
    '/pokoje/p7/4.webp',
    '/pokoje/p7/5.png',
    '/pokoje/p7/6.webp',
    '/pokoje/p7/7.webp',
    '/pokoje/p7/8.webp',
    '/pokoje/p7/9.webp',
    '/pokoje/p7/10.webp'
  ],
  a1: [
    '/pokoje/motyl/1.webp',
    '/pokoje/motyl/2.webp',
    '/pokoje/motyl/3.webp',
    '/pokoje/motyl/4.webp',
    '/pokoje/motyl/5.webp',
    '/pokoje/motyl/6.webp',
    '/pokoje/motyl/7.webp'
  ],
  zen: [
    '/pokoje/zen/1.webp',
    '/pokoje/zen/2.webp',
    '/pokoje/zen/3.webp',
    '/pokoje/zen/4.webp',
    '/pokoje/zen/5.webp',
    '/pokoje/zen/6.webp',
    '/pokoje/zen/7.webp'
  ],
  p10: [
    '/pokoje/p10/1.webp',
    '/pokoje/p10/2.webp',
    '/pokoje/p10/3.webp',
    '/pokoje/p10/4.webp',
    '/pokoje/p10/6.webp',
    '/pokoje/p10/7.webp',
    '/pokoje/p10/8.webp',
    '/pokoje/p10/9.webp'
  ],
  p11: [
    '/pokoje/p11/1.webp',
    '/pokoje/p11/2.webp',
    '/pokoje/p11/3.webp',
    '/pokoje/p11/4.webp',
    '/pokoje/p11/5.webp',
    '/pokoje/p11/7.webp',
    '/pokoje/p11/8.webp',
    '/pokoje/p11/9.webp',
    '/pokoje/p11/10.webp'
  ],
  p12: [
    '/pokoje/p12/1.webp',
    '/pokoje/p12/2.webp',
    '/pokoje/p12/3.webp',
    '/pokoje/p12/4.webp',
    '/pokoje/p12/5.webp',
    '/pokoje/p12/6.webp',
    '/pokoje/p12/8.webp',
    '/pokoje/p12/9.webp',
    '/pokoje/p12/10.webp',
    '/pokoje/p12/11.webp'
  ]
};

export const renderRoomBreakdownItem = (roomId, roomName, priceType, priceAmount) => {
  const photos = ROOM_GALLERIES[roomId] || ['/hezky pokoj 1.webp'];
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
              <div class="room-drawer-price-wrap" data-price="${priceType}">
                <div class="price-main-block">
                  <span class="price-amount">${priceAmount} Kč</span>
                  <span class="price-suffix">/ noc</span>
                </div>
                <div class="price-sub-block">
                  <span class="price-detail">za osobu • včetně snídaně</span>
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

// Správa a načtení oznamovacího banneru v liště nad navbarem
let activeBannerCache = null;

export async function refreshActiveBanner() {
  try {
    const items = await getStoredNewsItems();
    activeBannerCache = (items || []).find(item => item.is_active && item.is_banner) || null;
  } catch (err) {
    activeBannerCache = null;
  }
}

export function getTopAnnouncementBarHTML() {
  if (!activeBannerCache) return '';
  
  const text = activeBannerCache.banner_text || activeBannerCache.title || '';
  const dateStr = activeBannerCache.updated_at || activeBannerCache.created_at;
  let formattedDate = '';
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  const imageHTML = activeBannerCache.image_url 
    ? `<div class="announcement-modal-image"><img src="${activeBannerCache.image_url}" alt="${activeBannerCache.title || ''}" loading="lazy"></div>`
    : '';

  const paragraphs = (activeBannerCache.content || '').split('\n\n').filter(Boolean);
  const contentHTML = paragraphs.length > 0 
    ? paragraphs.map(p => `<p class="announcement-modal-p">${p.replace(/\n/g, '<br>')}</p>`).join('')
    : `<p class="announcement-modal-p">${text}</p>`;

  return `
    <!-- POP-UP MODAL PRO DETAIL OZNÁMENÍ -->
    <div class="announcement-detail-modal" id="announcement-detail-modal" aria-hidden="true" role="dialog">
      <div class="announcement-modal-overlay" id="announcement-modal-overlay"></div>
      <div class="announcement-modal-content">
        <button class="announcement-modal-close" id="btn-close-announcement-modal" aria-label="Zavřít detail oznámení">&times;</button>
        ${imageHTML}
        <div class="announcement-modal-body">
          <div class="announcement-modal-header">
            <span class="announcement-modal-badge-tag">AKTUÁLNÍ OZNÁMENÍ</span>
            ${formattedDate ? `<span class="announcement-modal-date">${formattedDate}</span>` : ''}
          </div>
          <h2 class="announcement-modal-title">${activeBannerCache.title || text}</h2>
          <div class="announcement-modal-text">
            ${contentHTML}
          </div>
        </div>
      </div>
    </div>
  `;
}

const getHeaderHTML = () => `
  <!-- Hlavička (Navigace a logo) -->
  <header class="site-header">
    <div class="nav-left">
      <a href="/ubytovani" class="nav-link">Nabídka pokojů</a>
      <a href="/stravovani" class="nav-link">Stravování</a>
      <a href="/okoli" class="nav-link">Aktivity</a>
    </div>
    
    <a href="/" class="header-logo">
      <img src="/Logo/white logo.webp" alt="Hotel u Můstku Logo" loading="eager" fetchpriority="high">
    </a>
    
    <div class="nav-right">
      <a href="/akce" class="nav-link">Skupinové akce</a>
      <a href="/aktuality" class="nav-link" id="nav-link-aktuality">Aktuality</a>
      <a href="/kontakt" class="nav-link">Kontakt</a>
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
      <div class="control-item">
        <img src="/Icons/sun_icon.png" alt="Slunce" class="control-icon">
        <span>Léto</span>
      </div>
      <div class="control-item">
        <img src="/Icons/snowflake_icon.png" alt="Vločka" class="control-icon">
        <span>Zima</span>
      </div>
    </div>
  </div>
`;

const getPromoHTML = () => `
  <!-- PROMO BANNER (SLEVA SEKCE 1:1 REPLIKA) -->
  <section class="promo-banner">
    <img src="/Decoration/Hory - dekorace.webp" alt="" class="promo-contour-img" aria-hidden="true" loading="lazy" decoding="async">
    <div class="promo-inner">
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
    <img src="/Uvodni stranka/Fotka Zahrady a Terasy.webp" alt="Zahrada a terasa Hotelu u Můstku" class="panoramic-img" loading="lazy" decoding="async">
  </section>
`;

const getServicesHTML = () => `
  <!-- SEKCE CO DALŠÍHO NABÍZÍME / UPSELL (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="services-section" id="sluzby">
    <div class="services-inner">
      <h2 class="services-title">Co dalšího nabízíme?</h2>
      
      <div class="services-cards-wrap">
        <!-- Karta 1: Stravování (Vlevo) -->
        <div class="service-card service-card-left">
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
        <div class="service-card service-card-right">
          <div class="service-img-wrap">
            <img src="/Uvodni stranka/skupinove_akce_zelena_profesionalni_uprava.webp" alt="Skupinové akce v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="service-card-body">
            <h3 class="service-card-title">Skupinové Akce</h3>
            <p class="service-card-desc">Uspořádejte nezapomenutelnou oslavu, teambuilding nebo svatbu v Jizerských horách s kompletním pronájmem hotelu pro 42 hostů a naprostým soukromím.</p>
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
    date: "26. 06. 2026",
    author: "Jitka",
    text: "Strávili jsme tady s manželem nádherný víkend. Krásné prostředí, útulný hotel, výborná kuchyně, i když vaří jenom jedno menu. Úschovna kol, kde jsme si mohli elektrokola nabít, a co bylo super v těchto vedrech — pod terasou nádherný splav, kde jsme se mohli koupat. Posezení na zahrádce u dobrého piva bylo super. Určitě ještě přijedeme."
  },
  {
    date: "24. 08. 2025",
    author: "Lenka a Ruda",
    text: "Děkujeme za příjemně strávenou dovolenou v útulných, velmi čistých pokojích. Majitelé jsou pohodoví a ochotní, velký výběr domácích produktů ve snídaňovém bufetu, večeře výborné za lidové ceny. Určitě doporučujeme všem, kdo stojí o dovolenou v hezkém, klidném prostředí. Stoprocentní spokojenost, vřele doporučujeme. Děkujeme."
  },
  {
    date: "17. 08. 2025",
    author: "Dana N.",
    text: "Byli jsme jen na tři dny, ale naprostá spokojenost. Tak čistý pokoj jsme snad ještě nezažili, majitelé vstřícní a jídlo také nemělo chybu. Pokud pojedeme do těchto končin znovu, určitě se ubytujeme opět tady."
  },
  {
    date: "08. 08. 2025",
    author: "Roman K.",
    text: "Spokojenost, doporučuji."
  },
  {
    date: "18. 02. 2025",
    author: "Adam",
    text: "Pobyt se nám u vás moc líbil. Milý přístup, krásně čisto, výborné jídlo, pěkné okolí hotelu a večer jsme se nenudili (kulečník, fotbálek, stolní tenis). Děkujeme :-)"
  },
  {
    date: "02. 02. 2025",
    author: "Honza",
    text: "V současné době můžu pochválit ceny, krásně čisto, příjemný personál, klidné místo. Vřele doporučuji."
  },
  {
    date: "10. 09. 2024",
    author: "Jirka",
    text: "Pokud chcete dovolenou v klidném prostředí, tak vřele doporučuji. Na hotelu klid, v noci klid a okolí krásné a klidné. Výborné večeře, sice bez výběru, jedno menu, ale kvalita, se kterou se hned tak nesetkáte. Podotýkám česká kuchyně. Rádi se sem vrátíme."
  },
  {
    date: "18. 06. 2024",
    author: "Tomáš",
    text: "Vrátili jsme se po třech letech a můžu říct, že jsem opět mile překvapen. Ceny pořád stejné, výborná kuchyně a pokoje bez sebemenší špíny, prostě super. Díky."
  },
  {
    date: "18. 06. 2024",
    author: "Tomáš",
    text: "Obrovská spokojenost, ceny stejné jako před třemi lety. Pořád krásně čisto, výborné jídlo a ochotný personál. Díky."
  },
  {
    date: "05. 01. 2024",
    author: "Zbyněk",
    text: "Super místo, Silvestr neměl chybu. Perfektní jídlo, snídaně — velký výběr. V létě určitě přijedeme. Velice příjemný a ochotný personál. Určitě v létě přijedeme na kola."
  },
  {
    date: "11. 08. 2023",
    author: "Jana a Zdeněk",
    text: "Na dovolené jsme zde byli už počtvrté a opět stoprocentní spokojenost. Ochotní majitelé, výborná kuchyně, čisté pokoje a hlavně klid a pohoda. Děkujeme za příjemně strávenou dovolenou. Těšíme se na příště."
  },
  {
    date: "01. 01. 2023",
    author: "Kymličkovi",
    text: "Příjemné klidné prostředí s chutnou domácí stravou a personálem ochotným vyhovět specifickým požadavkům. Pokoje útulné a všude čisto. Pobyt byl milým překvapením a můžeme jen doporučit."
  },
  {
    date: "13. 08. 2022",
    author: "Jana a Jirka",
    text: "Jezdíme pravidelně každý rok už od roku 2015. Dovolená je každý rok lepší a lepší. Skvělá kuchyně, výborné snídaně s domácími jogurty a chlebem, všude čisto, klid a pohoda. Vřele doporučujeme a těšíme se na příští léto. Děkujeme za krásnou dovolenou."
  },
  {
    date: "02. 09. 2021",
    author: "Jana a Jirka",
    text: "Tak jako každý rok, byl ten týden u Vás v hotelu úplný balzám na tělo i duši. Škoda jen, že to vždy tak rychle uteče. Děkujeme a už nyní se těšíme na příští rok."
  },
  {
    date: "08. 01. 2020",
    author: "Jana a Filip",
    text: "Děkujeme za příjemný pobyt v útulném prostředí a skvělou domácí kuchyni. V létě přijedeme zase."
  },
  {
    date: "27. 07. 2019",
    author: "Jana a Jirka",
    text: "Stále stejně super hotel v klidném prostředí s výbornou kuchyní. Užili jsme si to my i děti. Příští rok se chystáme znovu. Děkujeme za nádhernou dovolenou."
  },
  {
    date: "24. 01. 2019",
    author: "J. M.",
    text: "Vše tak, jak má být. Stoprocentní spokojenost. Děkujeme."
  },
  {
    date: "14. 08. 2018",
    author: "Jana a Jirka",
    text: "Už čtvrtý pobyt a je to čím dál tím lepší. Doporučujeme."
  },
  {
    date: "29. 07. 2018",
    author: "P. a R. T.",
    text: "Děkujeme vám za příjemně strávenou dovolenou ve vašem klidném, čistém a útulném hotelu s výbornou kuchyní. Moc se nám u vás líbilo. Všem doporučujeme."
  },
  {
    date: "10. 03. 2018",
    author: "Jitka a Michal",
    text: "Klid, čisto, pohodlí, snídaně i večeře super. Přestože se vaří jednotné jídlo, s takovou kvalitou se setkáváme málokde. Doporučujeme."
  },
  {
    date: "28. 08. 2017",
    author: "Jana a Jirka",
    text: "Letos jsme se vrátili už potřetí a určitě ne naposledy. Vřele doporučujeme — dovolená tady nemá chybu. Děkujeme."
  },
  {
    date: "19. 08. 2017",
    author: "Aleš D. s rodinou",
    text: "S velmi dobrým pocitem odjíždíme z týdenního pobytu v tomto hotelu s velice příjemným a čistým prostředím, výbornou kuchyní a úžasnými majiteli. Velké díky za příjemné prožití letní dovolené a někdy zase na shledanou v hotelu U Můstků."
  },
  {
    date: "06. 03. 2017",
    author: "Jiří Č.",
    text: "Moc Vám děkujeme za příjemný pobyt, dobré ubytování, výbornou domácí kuchyni a moc příjemné majitele. Určitě všem doporučujeme."
  },
  {
    date: "04. 02. 2017",
    author: "Thomas (DE)",
    text: "Einfach, praktisch, super nette Leute und preiswert, super Frühstück und wer wollte exzellentes Abendbrot."
  },
  {
    date: "11. 09. 2016",
    author: "Majkovi",
    text: "Děkujeme za úžasný týdenní pobyt nejen v příjemném hotelu s úžasnými majiteli, ale také za krásná místa v okolí. Hotel U Můstků můžeme všem jen doporučit. Ještě jednou děkujeme."
  },
  {
    date: "01. 09. 2016",
    author: "Novákovi",
    text: "Děkujeme majitelům hotelu za příjemně strávený pobyt a vše, co pro nás dělali. Ještě jednou vřelý dík. Všem vřele doporučujeme."
  },
  {
    date: "31. 07. 2016",
    author: "Jana a Jirka",
    text: "Všem doporučujeme — pěkný hotel a hlavně úžasní majitelé a výborná kuchyně. Letos jsme byli už podruhé, vrátili jsme se po roce a bylo to snad ještě lepší než loni :-) Děkujeme za nádhernou dovolenou."
  },
  {
    date: "27. 06. 2016",
    author: "Volfovi",
    text: "Krásný hotel v krásné krajině, možnost mnoha výletů a procházek, skvělá kuchyně a velice milí a ochotní majitelé. Dovolená se nám moc líbila, ani odjíždět se nám nechtělo. Určitě se ještě někdy vrátíme."
  },
  {
    date: "08. 03. 2016",
    author: "Sládkovi",
    text: "V hotelu jsme strávili týden a vřele ho doporučujeme všem návštěvníkům — levné a skvěle připravené jídlo, velice příjemní a ochotní majitelé."
  },
  {
    date: "28. 01. 2016",
    author: "Antonín H.",
    text: "Zdejší hotel hodnotíme s manželkou — za slušné peníze hodně muziky. Výborné ubytování, služby, kuchyně, čistota a slušní majitelé. Procestovali jsme toho hodně a tento hotel s klidem můžeme doporučit."
  },
  {
    date: "11. 01. 2016",
    author: "Milan",
    text: "Silvestrovský pobyt super. Děkujeme za krásný vstup do nového roku 2016."
  },
  {
    date: "15. 09. 2015",
    author: "Kamila",
    text: "Pobyt v hotelu se nám moc líbil. Na pokoji nám nic nechybělo — vše mají promyšleno do detailů. Jídlo bylo moc dobré. Majitelé jsou velmi příjemní a ochotní. Vhodné i pro rodinu s malými dětmi. Byli jsme moc spokojení. Doporučujeme!"
  },
  {
    date: "07. 09. 2015",
    author: "Jindra",
    text: "V neděli jsme měli oslavu narozenin ve zdejším hotelu. Všichni jsme byli velice mile překvapeni kvalitou a chutí jídla, zároveň příjemným, přitom profesionálním personálem. Vřele doporučujeme."
  },
  {
    date: "10. 08. 2015",
    author: "Jana a Zdeněk",
    text: "V sobotu jsme se vrátili z týdenní dovolené, vše bylo super! Včetně vynikajícího personálu (tímto jej zdravíme) a domácí kuchyně! Ještě jednou díky za příjemně strávený týden. Vřele všem doporučujeme!"
  },
  {
    date: "10. 08. 2015",
    author: "Venca a Barča",
    text: "Naprosto bezchybný týden dovolené, vše už zde bylo napsáno, naše hodnocení: jednička s hvězdou. Vše super, doporučujeme."
  },
  {
    date: "01. 08. 2015",
    author: "Jana a Jirka",
    text: "Příjemný hotel, výborná domácí kuchyně, domácí atmosféra. Dovolenou tady vřele všem doporučujeme. Nádherná dovolená — děkujeme a moc rádi se vrátíme."
  },
  {
    date: "30. 07. 2015",
    author: "Jirka a Jana",
    text: "Klidné prostředí, pohoda. Doporučuji."
  },
  {
    date: "24. 03. 2015",
    author: "Erika B.",
    text: "Příjemně strávený pobyt v hotelu, všem doporučuji a hlavně dobrá kuchyně. Pozdrav provozovatelům."
  },
  {
    date: "24. 03. 2015",
    author: "Eva N.",
    text: "S rodinou jsme byli v hotelu U Můstků v Desné, prostě paráda. Domácí strava a příjemná obsluha, palec nahoru."
  },
  {
    date: "19. 01. 2015",
    author: "Pavel K.",
    text: "Na začátku ledna jsme se s rodinou ubytovali v hotelu, kde jsme strávili pět dnů. Byli jsme spokojeni. Doporučuji."
  },
  {
    date: "09. 09. 2014",
    author: "Honza s přáteli",
    text: "O prázdninách jsme navštívili s kamarády Jizerské hory a ubytování v hotelu U Můstků bylo super. Určitě pojedeme znovu i v zimě na lyže. Tímto pozdravuji provozovatele."
  },
  {
    date: "24. 07. 2014",
    author: "Michal a Jitka",
    text: "Rodinný hotel v klidném prostředí, výborná domácí kuchyně a příjemní lidé... :-) Parádní dovolená."
  },
  {
    date: "13. 07. 2014",
    author: "Dana",
    text: "S přítelem jsme strávili tři dny a byli jsme velice spokojeni."
  },
  {
    date: "31. 05. 2014",
    author: "Jana V.",
    text: "Minulý týden jsme se s rodinou ubytovali v hotelu U Můstků a můžu jenom doporučit. Velice příjemní lidé, výborná domácí kuchyně. Všude čisto. Opravdu doporučuji."
  },
  {
    date: "16. 04. 2014",
    author: "Ilona M.",
    text: "Přespali jsme sice jenom jednu noc a musím konstatovat, že jsme spokojeni s přístupem a hlavně nádherně čistě uklizenými pokoji. Snídaně formou bufetu bez sebemenších připomínek."
  },
  {
    date: "15. 04. 2014",
    author: "Jaroslav K.",
    text: "Za profesionální přístup personálu a příjemné prostředí palec nahoru. Mohu všem jen doporučit. Zároveň si přeji, aby takto fungovala všechna podobná zařízení v Desné. Majitelům a personálu přeji plno slušných hostů a hodně elánu do jejich další práce."
  },
  {
    date: "03. 04. 2014",
    author: "Zbyněk V.",
    text: "Krásné prostředí, příjemná obsluha a výborná domácí kuchyně. Také jsme měli možnost ochutnat domácí uzený bůček a různé dobroty z grilu. Můžu jenom doporučit."
  }
];

const getReviewsHTML = () => `
  <!-- SEKCE RECENZE (1:1 REPLIKA DLE SVG PŘEDLOHY + INTERAKTIVNÍ INFINITY SLIDER) -->
  <section class="reviews-section" id="recenze">
    <div class="reviews-inner">
      <h2 class="reviews-title">Co o nás říkají sami hosté?</h2>
      
      <div class="reviews-slider-viewport" id="reviews-viewport">
        <div class="reviews-slider-track" id="reviews-track">
          ${GUEST_REVIEWS.map(r => `
            <div class="review-card">
              <img src="/Icons/google logo.webp" alt="Google Logo" class="review-google-icon" loading="lazy" decoding="async">
              <p class="review-quote">${r.text}</p>
              <div class="review-contour-bg">
                <img src="/Decoration/hory_contour.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">
              </div>
              <div class="review-footer">
                <span class="review-author-name">${r.author}</span>
                <span class="review-date">${r.date}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="reviews-nav-controls">
        <button class="review-nav-btn" id="reviews-prev" aria-label="Předchozí recenze">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button class="review-nav-btn" id="reviews-next" aria-label="Další recenze">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </div>
  </section>
`;

const getFeaturesHTML = () => `
  <!-- SEKCE VÝHODY HOTELU / VÍCE NEŽ JEN UBYTOVÁNÍ (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="features-section">
    <div class="features-inner">
      <h2 class="features-title">Více než jen ubytování</h2>
      
      <div class="features-grid">
        <!-- Horní řada (3 výhody) -->
        <div class="features-row">
          <!-- Výhoda 1 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikona - spolecenska herna.webp" alt="Vnitřní společenská herna" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Vnitřní společenská herna</strong> pro zábavu za každého počasí.
            </p>
          </div>

          <!-- Výhoda 2 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Otuzovani-u-splavu.webp" alt="Přírodní otužování u splavu" class="feature-icon-otuzovani" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Přírodní otužování u splavu</strong> pro dokonale svěží restart těla i mysli.
            </p>
          </div>

          <!-- Výhoda 3 -->
          <div class="feature-item">
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
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikona - ohniste.webp" alt="Zahrada s ohništěm" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Zahrada s ohništěm</strong> a grilem pro příjemné večery.
            </p>
          </div>

          <!-- Výhoda 5 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikona - polopenze.webp" alt="Domácí polopenze" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Domácí polopenze</strong> s pestrou nabídkou kvalitních jídel.
            </p>
          </div>

          <!-- Výhoda 6 -->
          <div class="feature-item">
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
      <h2 class="surroundings-title">Co vše můžete v okolí podniknout?</h2>
      
      <div class="surroundings-slider-viewport" id="surroundings-viewport">
        <div class="surroundings-cards-grid" id="surroundings-track">
          <!-- Karta 1 -->
          <div class="surrounding-card">
            <div class="surrounding-card-img-wrap">
              <img src="/Uvodni stranka/Rozhledna Stepanka.webp" alt="Rozhledna Štěpánka" loading="lazy" decoding="async">
            </div>
            <h3 class="surrounding-card-title">ROZHLEDNA ŠTĚPÁNKA</h3>
          </div>
          
          <!-- Karta 2 -->
          <div class="surrounding-card">
            <div class="surrounding-card-img-wrap">
              <img src="/Uvodni stranka/Vodopady Jizerky.webp" alt="Vodopády na Černé Desné" loading="lazy" decoding="async">
            </div>
            <h3 class="surrounding-card-title">VODOPÁDY NA ČERNÉ DESNÉ</h3>
          </div>
          
          <!-- Karta 3 -->
          <div class="surrounding-card">
            <div class="surrounding-card-img-wrap">
              <img src="/Uvodni stranka/Tanvaldsky spicak.webp" alt="Ski Areál Tanvaldský Špičák" loading="lazy" decoding="async">
            </div>
            <h3 class="surrounding-card-title">SKI AREÁL TANVALDSKÝ ŠPIČÁK</h3>
          </div>
          
          <!-- Karta 4 -->
          <div class="surrounding-card">
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
        <img src="/Logo/white logo.webp" alt="Hotel U Můstku" loading="lazy" decoding="async">
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
            </div>
          </div>
        </div>

        <!-- Sloupec 2: Rychlé odkazy -->
        <div class="footer-col footer-col-links">
          <h3 class="footer-col-heading">Rychlé odkazy</h3>
          <ul class="footer-links-list">
            <li><a href="#pokoje">Nabídka pokojů</a></li>
            <li><a href="#stravovani">Stravování</a></li>
            <li><a href="#oslavy-akce">Akce</a></li>
            <li><a href="#aktivity">Aktivity</a></li>
            <li><a href="#kontakt">Kontakt</a></li>
          </ul>
        </div>

        <!-- Sloupec 3: Právní doložky -->
        <div class="footer-col footer-col-legal">
          <h3 class="footer-col-heading">Právní doložky</h3>
          <ul class="footer-links-list">
            <li><a href="#">Ochrana osobních údajů (GDPR)</a></li>
            <li><a href="#">Používání cookies (Nastavení)</a></li>
          </ul>
        </div>
      </div>

      <!-- Spodní lišta -->
      <div class="footer-bottom-row">
        <div class="footer-copyright secret-admin-trigger" title="Vstup pro recepci" style="cursor: pointer;">© 2026 All Rights Reserved.</div>
        <div class="footer-logo-wrap btn-scroll-top" title="Zpět nahoru">
          <img src="/Logo/white logo.webp" alt="Hotel U Můstku" loading="lazy" decoding="async">
        </div>
        <div class="footer-author">Vytvořil <a href="https://ozeman.cz" target="_blank" rel="noopener">ozeman.cz</a></div>
      </div>
    </div>
  </footer>
  ${getTopAnnouncementBarHTML()}

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
    : `<img class="hero-summer-poster" src="/uvodni_hero_sekce.webp" alt="Hotel u Můstku" fetchpriority="high" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
       <video 
        class="hero-video" 
        autoplay 
        muted 
        loop 
        playsinline 
        preload="auto" 
        poster="/uvodni_hero_sekce.webp"
        fetchpriority="high"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; background: transparent;"
      >
        <source src="https://jpvnvjcktpxyxrvsdukm.supabase.co/storage/v1/object/public/hotel-videos/hero_final_v5.mp4" type="video/mp4">
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
  <section class="hero-section" id="uvod">
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
        <div class="control-item ${!isWinter ? 'is-active' : ''}">
          <img src="/Icons/sun_icon.png" alt="Slunce" class="control-icon">
          <span>Léto</span>
        </div>
        <div class="control-item ${isWinter ? 'is-active' : ''}">
          <img src="/Icons/snowflake_icon.png" alt="Vločka" class="control-icon">
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
      <div class="about-content">
        <h2 class="about-title" id="o-nas">Zázemí, do kterého se budete rádi vracet.</h2>
        <div class="about-text">
          <p>Náš hotel najdete ukrytý v tichém lesním údolí, stranou ruchu měst. Čeká vás komfortní ubytování, poctivá domácí kuchyně a osobní přístup, díky kterému se tu budete cítit jako doma.</p>
          <p>Ať už přijedete za odpočinkem, nebo za výlety po okolních horách, o pohodlný pobyt se postaráme za vás.</p>
        </div>
        <button class="btn btn-about" id="about-more-btn">Nabídka pokojů</button>
      </div>
      
      <div class="about-img-top">
        <img src="${aboutTopSrc}" alt="Vyhlídka ze skokanských můstků" loading="eager" fetchpriority="high">
      </div>

      <div class="about-img-bottom">
        <img src="${aboutBottomSrc}" alt="Hotel u Můstku budova" loading="lazy" decoding="async">
      </div>

      <div class="about-shadow-decor">
        <img src="/Decoration/list_shadow.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
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
const getRoomsPageHTML = () => `
  <!-- 1. HERO SEKCE POKOJŮ -->
  <section class="hero-section rooms-hero-section room-detail-hero" id="uvod-pokoje">
    <img class="hero-rooms-poster" src="/nabidka-pokoju.webp" alt="Nabídka pokojů Hotel u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <div class="room-detail-hero-center">
        <h1 class="hero-title room-detail-hero-title">
          <span class="desktop-title-text">Nabídka pokojů</span>
          <span class="mobile-tablet-title-text">Prohlédněte si nabídku pokojů</span>
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

  <!-- SEKCE NABÍDKA POKOJŮ (SEZNAM POKOJŮ) -->
  <section class="rooms-list-section">
    <div class="rooms-list-inner">
      <!-- Card 1: Pokoje přízemí -->
      <div class="room-card">
        <div class="room-card-image-wrap">
          <img src="/balkony 1 copy.webp" alt="Pokoje přízemí" loading="lazy" decoding="async">
        </div>
        <div class="room-card-content">
          <h2 class="room-card-title">Pokoje přízemí</h2>
          <p class="room-card-desc">Útulně a moderně zařízené pokoje s výhledem do zeleně. Tyto pokoje se nacházejí v přízemí hotelu, a nabízejí tak přímý a snadný přístup na venkovní terasu a k hlavnímu parkovišti.</p>
          <div class="room-card-buttons">
            <button class="btn btn-booking btn-room-primary" id="btn-goto-prizemi">Prohlédnout nabídku</button>
          </div>
        </div>
      </div>

      <!-- Card 2: Pokoje s výhledem -->
      <div class="room-card">
        <div class="room-card-content">
          <h2 class="room-card-title">Pokoje s výhledem</h2>
          <p class="room-card-desc">Prostor a soukromí s vlastní prostornou terasou a výhledem na celé údolí. Tyto pokoje se nacházejí v patře hotelu a disponují vlastní koupelnou, balónem a nádherným výhledem.</p>
          <div class="room-card-buttons">
            <button class="btn btn-booking btn-room-primary" id="btn-goto-vyhled">Prohlédnout nabídku</button>
          </div>
        </div>
        <div class="room-card-image-wrap">
          <img src="/vyhled 1.webp" alt="Pokoje s výhledem" loading="lazy" decoding="async">
        </div>
      </div>
    </div>
  </section>

  ${getPromoHTML()}
  ${getPanoramicHTML()}
  ${getServicesHTML()}
  ${getReviewsHTML()}
  ${getFeaturesHTML()}
  ${getSurroundingsHTML('rooms-surroundings-section')}
  ${getCtaHTML()}
  ${getFooterHTML()}
`;

// Render Funkce Pro Stránku "Rezervace"
const getBookingPageHTML = () => `
  <section class="hero-section booking-hero-section" id="uvod-rezervace">
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <div class="booking-hero-center">
        <h1 class="booking-hero-main-title">Rezervace ubytování</h1>
        <p class="booking-hero-subtitle">Hotel u Můstku — Desná v Jizerských horách</p>
      </div>
    </div>
  </section>

  <main class="booking-page-main">
    <div id="booking-container" class="booking-section-wrapper"></div>
  </main>
  ${getFooterHTML()}
`;

// Render Funkce Pro Recepční Admin Panel
const getAdminPageHTML = () => `
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

// Render Funkce Pro 404 Error Stránku (Čistá samostatná obrazovka bez navbaru a footeru)
const get404PageHTML = () => `
  <main class="error-standalone-wrapper">
    <div class="error-content-container">
      <div class="error-code-badge">404</div>
      <h1 class="error-title">Požadovaná stránka neexistuje</h1>
      <p class="error-desc">
        Omlouváme se, ale adresa, kterou jste zadali, na našem webu neexistuje, byla přesunuta nebo změněna.
      </p>
      <div class="error-actions-group">
        <a href="#domu" class="btn btn-booking-submit btn-go-home">Zpět na hlavní stránku</a>
      </div>
    </div>
  </main>
`;

// Render Funkce Pro Stránku "Pokoje přízemí" (Detail pokoje)
const getRoomGroundFloorHTML = () => `
  <!-- 1. HERO SEKCE DETAILU POKOJE -->
  <section class="hero-section rooms-hero-section room-detail-hero" id="uvod-prizemi">
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <div class="room-detail-hero-center">
        <h1 class="hero-title room-detail-hero-title">
          <span class="desktop-title-text">Pokoje v přízemí</span>
          <span class="mobile-tablet-title-text">Vyberte si svůj pokoj v přízemí</span>
        </h1>
        <p class="room-detail-hero-subtitle">
          <span class="desktop-sub-text">Útulně a moderně zařízené pokoje v přízemí hotelu s výhledem do zeleně a přímým přístupem na venkovní terasu a parkoviště.</span>
          <span class="mobile-sub-text">Objevte zázemí se 100% bezbariérovým přístupem</span>
        </p>
        <button class="btn btn-booking room-detail-hero-btn" id="btn-specs-rooms">Zjistit detaily</button>
      </div>

      <!-- Spodní šipka dolů (mobil + tablet) -->
      <div class="scroll-down-btn mobile-only-scroll-btn" id="scroll-btn-prizemi">
        <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
        </svg>
      </div>
    </div>
  </section>

  <!-- 2. DETAILY POKOJŮ (SPECS SEKCE) -->
  <section class="room-specs-section" id="detaily-pokoju">
    <div class="room-specs-inner">
      <h2 class="room-specs-main-title">Detaily Pokojů</h2>

      <div class="room-specs-grid">
        <!-- Levý sloupec: Seznam parametrů -->
        <div class="room-specs-content">
          <ul class="room-specs-list">
            <!-- 1. Max. počet osob -->
            <li class="room-spec-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/group.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Max. počet osob:</strong> 4 dospělé osoby</span>
              </div>
            </li>

            <!-- 2. 2 postele -->
            <li class="room-spec-item spec-item-with-subtext">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/double-bed.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>2 postele</strong> v každém pokoji</span>
                <p class="spec-subtext">s možností až dvou přistýlek<br>a dětskou postýlkou na vyžádání</p>
              </div>
            </li>

            <!-- 3. Dětská postýlka -->
            <li class="room-spec-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/cot.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Možnost zapůjčení</strong> dětské postýlky</span>
              </div>
            </li>

            <!-- 4. Vytápění je ústřední -->
            <li class="room-spec-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/air.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Vytápění</strong> je ústřední</span>
              </div>
            </li>

            <!-- 5. Wi-Fi zdarma -->
            <li class="room-spec-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/wifi.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Wi-Fi</strong> zdarma</span>
              </div>
            </li>

            <!-- 6. Máte mazlíčka? -->
            <li class="room-spec-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/pawprint.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Máte mazlíčka?</strong> <a href="#vyhody-ubytovani" class="spec-link" id="link-pet-more">Zjistit více <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1L5 5L9 1"/></svg></a></span>
              </div>
            </li>

            <!-- EXTENZE DETAILŮ (Zobrazí se plynule po kliknutí na Přečíst více) -->
            <!-- Vlastní koupelna -->
            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/bathroom.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Vlastní koupelna:</strong> WC a sprchový kout</span>
              </div>
            </li>

            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/television.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>TV</strong> na pokoji</span>
              </div>
            </li>

            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/no-smoking.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Nekuřácké</strong> prostředí</span>
              </div>
            </li>

            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/folding.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Zakázkové</strong> povlečení</span>
              </div>
            </li>

            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/towel.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Ručníky</strong></span>
              </div>
            </li>

            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/mini.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Minibar:</strong> chladnička</span>
              </div>
            </li>

            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/wardrobe.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Šatní skříň</strong> v předsíni</span>
              </div>
            </li>

            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/hair-dryer.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Fén</strong> na vyžádání</span>
              </div>
            </li>
          </ul>

          <div class="room-specs-buttons">
            <button class="btn btn-booking btn-specs-primary" id="btn-specs-rooms">Nabídka pokojů</button>
            <button class="btn btn-specs-secondary" id="btn-specs-more">Přečíst více</button>
          </div>
        </div>

        <!-- Pravý sloupec: Fotka pokoje -->
        <div class="room-specs-image-wrap">
          <img src="/hezky pokoj 1.webp" alt="Detaily Pokojů v Přízemí" loading="eager" fetchpriority="high" decoding="async">
        </div>
      </div>
    </div>
  </section>

  <!-- 3. PANORAMATICKÝ BANNER POKOJE (1:1 REPLIKA DLE PŘEDLOHY) -->
  <section class="room-banner-section">
    <div class="room-banner-overlay"></div>
    <div class="room-banner-inner">
      <p class="room-banner-text">Pokoje Standard v přízemí hotelu jsou navrženy pro maximální pohodlí bez překážek.<br>Díky přístupu zcela bez schodů jsou ideální volbou pro rodiny s kočárky i seniory.</p>
    </div>
  </section>

  <!-- 4. ROZDĚLENÍ POKOJŮ (1:1 REPLIKA DLE SVG PŘEDLOHY S AKORDEONEM) -->
  <section class="room-breakdown-section" id="rozdeleni-pokoju">
    <div class="room-breakdown-inner">
      <div class="room-breakdown-header">
        <h2 class="room-breakdown-title">Rozdělení pokojů</h2>
        <button class="btn btn-booking btn-breakdown-cta">Rezervovat pobyt</button>
      </div>

      <div class="room-breakdown-list">
        <!-- Pokoj 1: Standard P1 -->
        ${renderRoomBreakdownItem('p6', 'Pokoj Standard P1', 'standard', 830)}

        <!-- Pokoj 2: Standard P2 -->
        ${renderRoomBreakdownItem('p5', 'Pokoj Standard P2', 'standard', 830)}

        <!-- Pokoj 3: Nadstandard Mahagon -->
        ${renderRoomBreakdownItem('pa', 'Pokoj Nadstandard Mahagon', 'nadstandard', 890)}

        <!-- Pokoj 4: Turistický P4 (v rekonstrukci) -->
        <div class="room-breakdown-item" data-room="p3">
          <div class="room-breakdown-row">
            <span class="room-breakdown-name"><strong>Pokoj Turistický P4</strong> <span class="room-meal">(se snídaní)</span></span>
            <button class="btn-toggle-details" aria-expanded="false">
              <span class="toggle-text">Zobrazit podrobnosti</span>
              <svg class="toggle-arrow" width="12" height="7" viewBox="0 0 12 7" fill="none"><path d="M1 1L6 6L11 1" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
          </div>

          <div class="room-breakdown-drawer">
            <div class="drawer-inner">
              <div class="renovation-notice-box" style="padding: 24px 0 20px 0; text-align: left;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                  <span style="font-size: 22px;">🔨</span>
                  <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #1c1c19;">Probíhá rekonstrukce pokoje</h4>
                </div>
                <p style="margin: 0; font-size: 13.5px; color: #666660; line-height: 1.5; max-width: 580px;">
                  V tomto pokoji v současnosti probíhá renovace. Pokoj je dočasně nedostupný pro rezervace. Prosíme, vyberte si jiný volný pokoj z naší nabídky.
                </p>
              </div>

              <div class="drawer-footer-controls" style="justify-content: flex-end;">
                <div class="drawer-action-btns">
                  <button class="btn btn-booking btn-room-reserve btn-room-disabled" disabled><span>Dočasně nedostupné</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pokoj 5: Turistický P5 (v rekonstrukci) -->
        <div class="room-breakdown-item" data-room="p2">
          <div class="room-breakdown-row">
            <span class="room-breakdown-name"><strong>Pokoj Turistický P5</strong> <span class="room-meal">(se snídaní)</span></span>
            <button class="btn-toggle-details" aria-expanded="false">
              <span class="toggle-text">Zobrazit podrobnosti</span>
              <svg class="toggle-arrow" width="12" height="7" viewBox="0 0 12 7" fill="none"><path d="M1 1L6 6L11 1" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
          </div>

          <div class="room-breakdown-drawer">
            <div class="drawer-inner">
              <div class="renovation-notice-box" style="padding: 24px 0 20px 0; text-align: left;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                  <span style="font-size: 22px;">🔨</span>
                  <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #1c1c19;">Probíhá rekonstrukce pokoje</h4>
                </div>
                <p style="margin: 0; font-size: 13.5px; color: #666660; line-height: 1.5; max-width: 580px;">
                  V tomto pokoji v současnosti probíhá renovace. Pokoj je dočasně nedostupný pro rezervace. Prosíme, vyberte si jiný volný pokoj z naší nabídky.
                </p>
              </div>

              <div class="drawer-footer-controls" style="justify-content: flex-end;">
                <div class="drawer-action-btns">
                  <button class="btn btn-booking btn-room-reserve btn-room-disabled" disabled><span>Dočasně nedostupné</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pokoj 6: Turistický P6 (v rekonstrukci) -->
        <div class="room-breakdown-item" data-room="p1">
          <div class="room-breakdown-row">
            <span class="room-breakdown-name"><strong>Pokoj Turistický P6</strong> <span class="room-meal">(se snídaní)</span></span>
            <button class="btn-toggle-details" aria-expanded="false">
              <span class="toggle-text">Zobrazit podrobnosti</span>
              <svg class="toggle-arrow" width="12" height="7" viewBox="0 0 12 7" fill="none"><path d="M1 1L6 6L11 1" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
          </div>

          <div class="room-breakdown-drawer">
            <div class="drawer-inner">
              <div class="renovation-notice-box" style="padding: 24px 0 20px 0; text-align: left;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                  <span style="font-size: 22px;">🔨</span>
                  <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #1c1c19;">Probíhá rekonstrukce pokoje</h4>
                </div>
                <p style="margin: 0; font-size: 13.5px; color: #666660; line-height: 1.5; max-width: 580px;">
                  V tomto pokoji v současnosti probíhá renovace. Pokoj je dočasně nedostupný pro rezervace. Prosíme, vyberte si jiný volný pokoj z naší nabídky.
                </p>
              </div>

              <div class="drawer-footer-controls" style="justify-content: flex-end;">
                <div class="drawer-action-btns">
                  <button class="btn btn-booking btn-room-reserve btn-room-disabled" disabled><span>Dočasně nedostupné</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="room-breakdown-footer-note">Pobyt na 1 noc: Příplatek +200 Kč / osoba / noc k základní ceně.</p>
    </div>
  </section>

  <!-- 5. RECENZE HOSTŮ -->
  ${getReviewsHTML()}

  <!-- 6. STRAVOVÁNÍ V HOTELU -->
  <section class="room-detail-dining-section">
    <div class="room-detail-dining-inner">
      <h2 class="room-detail-dining-title">Jak je to se stravováním?</h2>

      <div class="services-cards-wrap">
        <!-- Karta 1: Snídaně -->
        <div class="service-card service-card-left">
          <div class="service-card-img-wrap">
            <img src="/Uvodni stranka/stravovani.webp" alt="Snídaně v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="service-card-body">
            <h3 class="service-card-title">Snídaně</h3>
            <div class="service-card-desc-wrap">
              <p class="service-card-desc">
                <span class="desktop-sub-text">Snídaně se podávají formou bohatého švédského stolu v naší útulné jídelně. Těšit se můžete na čerstvé pečivo, sýry, uzeniny, cereálie i teplé pokrmy.</span>
                <span class="mobile-sub-text">V ceně ubytování se podává formou švédských stolů od 8:00 do 9:00 hod.</span>
              </p>
              <button class="btn btn-booking btn-dining-more desktop-dining-btn">Zjistit více o stravování</button>
            </div>
          </div>
        </div>

        <!-- Karta 2: Polopenze (Večeře) -->
        <div class="service-card service-card-right">
          <div class="service-card-img-wrap">
            <img src="/Polopenze vecere.webp" alt="Polopenze v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="service-card-body">
            <h3 class="service-card-title">Polopenze (Večeře)</h3>
            <div class="service-card-desc-wrap">
              <p class="service-card-desc">
                <span class="desktop-sub-text">Domácí dvouchodové večeře (polévka a hlavní chod) připravované z poctivých surovin podle tradičních receptů české i mezinárodní kuchyně.</span>
                <span class="mobile-sub-text">+195 Kč / osoba / den - ryze domácí česká kuchyně, jednotné 2chodové menu podávané v 18:00 hod.</span>
              </p>
              <button class="btn btn-booking btn-dining-more mobile-dining-btn">Zjistit více o stravování</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 7. VÝHODY UBYTOVÁNÍ U NÁS (1:1 REPLIKA DLE PŘEDLOHY) -->
  <section class="room-detail-features-section" id="vyhody-ubytovani">
    <div class="room-detail-features-inner">
      <h2 class="room-detail-features-title">Výhody ubytování u nás</h2>

      <div class="room-features-cards-grid">
        <!-- Karta 1: Máte Mazlíčka? -->
        <div class="room-feature-card">
          <div class="room-feature-img-wrap">
            <img src="/IMG_1458 1.webp" alt="Máte Mazlíčka?" loading="lazy" decoding="async">
          </div>
          <h3 class="room-feature-card-title">Máte Mazlíčka?</h3>
          <p class="room-feature-card-desc">
            <span class="desktop-sub-text">150 Kč / den hotel je i pro mazlíčky, nutné vodítko v areálu.</span>
            <span class="mobile-sub-text">150 Kč / den hotel je dog-friendly, nutné vodítko v areálu.</span>
          </p>
        </div>

        <!-- Karta 2: Nabíjení Elektrokola -->
        <div class="room-feature-card">
          <div class="room-feature-img-wrap">
            <img src="/IMG_1437 1.webp" alt="Nabíjení Elektrokola" loading="lazy" decoding="async">
          </div>
          <h3 class="room-feature-card-title">Nabíjení Elektrokola</h3>
          <p class="room-feature-card-desc">
            <span class="desktop-sub-text">15 Kč / den - bezpečné dobíjení v uzamykatelné kolárně.</span>
            <span class="mobile-sub-text">15 Kč / den - bezpečné dobíjení v uzamykatelné kolárně.</span>
          </p>
        </div>

        <!-- Karta 3: Parkování -->
        <div class="room-feature-card">
          <div class="room-feature-img-wrap">
            <img src="/desna_parkovani.webp" alt="Parkování" loading="lazy" decoding="async">
          </div>
          <h3 class="room-feature-card-title">Parkování</h3>
          <p class="room-feature-card-desc">
            <span class="desktop-sub-text">Zdarma na vlastním parkovišti pod kamerami.</span>
            <span class="mobile-sub-text">Zdarma na vlastním oploceném parkovišti se závorou pod kamerami.</span>
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- 8. PODMÍNKY UBYTOVÁNÍ (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="room-terms-section" id="podminky-ubytovani">
    <div class="room-terms-inner">
      <h2 class="room-terms-main-title">Podmínky ubytování</h2>

      <div class="room-terms-content-wrap">
        <!-- Levý blok: Storno podmínky (Tabulka) -->
        <div class="storno-table-container">
          <!-- Řádek 1 -->
          <div class="storno-table-row">
            <div class="storno-label-group">
              <span class="storno-time-label">Více než 3 dny před příjezdem:</span>
            </div>
            <div class="storno-fee-group">
              <span class="storno-fee-val">Zdarma</span>
              <span class="storno-fee-sub">bez storno poplatku</span>
            </div>
          </div>

          <!-- Řádek 2 -->
          <div class="storno-table-row">
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
          <button class="btn btn-booking btn-terms-cta">Rezervovat pobyt</button>

          <div class="check-times-container">
            <!-- Check-in -->
            <div class="check-time-item">
              <div class="check-icon-wrap">
                <img src="/Icons/Ikony/arrival.png" alt="Příjezd (Check-in)" width="28" height="28">
              </div>
              <span class="check-text-label"><strong>Příjezd (Check-in):</strong> od 15:00 hod.</span>
            </div>

            <!-- Check-out -->
            <div class="check-time-item">
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

// Render Funkce Pro Stránku "Pokoje s výhledem" (Detail pokoje s výhledem - 1:1 Kopie)
const getRoomViewFloorHTML = () => {
  let html = getRoomGroundFloorHTML();

  // 1. Změna Hero sekce (ID a třída pro fotky na pozadí)
  html = html.replace('id="uvod-prizemi"', 'id="uvod-vyhled"');
  html = html.replace('id="scroll-btn-prizemi"', 'id="scroll-btn-vyhled"');
  html = html.replace(
    'class="hero-section rooms-hero-section room-detail-hero"',
    'class="hero-section rooms-hero-section room-detail-hero room-view-hero"'
  );

  // 2. Změna H1 nadpisu v Hero sekci
  html = html.replace(
    '<span class="desktop-title-text">Pokoje v přízemí</span>',
    '<span class="desktop-title-text">Pokoje s výhledem</span>'
  );
  html = html.replace(
    '<span class="mobile-tablet-title-text">Vyberte si svůj pokoj v přízemí</span>',
    '<span class="mobile-tablet-title-text">Vyberte si svůj pokoj s výhledem</span>'
  );

  // 3. Náhrada Wi-Fi zdarma v hlavním seznamu za 1. patro s výhledem
  const oldWifiItem = `<!-- 5. Wi-Fi zdarma -->
            <li class="room-spec-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/wifi.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Wi-Fi</strong> zdarma</span>
              </div>
            </li>`;

  const newViewFloorItem = `<!-- 5. 1. patro s výhledem -->
            <li class="room-spec-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/balcony.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>1. patro</strong> s výhledem</span>
              </div>
            </li>`;

  html = html.replace(oldWifiItem, newViewFloorItem);

  // 4. Přidání Wi-Fi zdarma do rozbalovací nabídky (Přečíst více) hned pod Vlastní koupelna
  const bathroomExtraItem = `<!-- Vlastní koupelna -->
            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/bathroom.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Vlastní koupelna:</strong> WC a sprchový kout</span>
              </div>
            </li>`;

  const bathroomWithWifiExtraItem = `${bathroomExtraItem}

            <!-- Wi-Fi zdarma (Přesunuto do rozbalovací nabídky pro Pokoje s výhledem) -->
            <li class="room-spec-item spec-extra-item">
              <div class="spec-icon-wrap">
                <img src="/Icons/Ikony/wifi.png" alt="" class="spec-icon-img">
              </div>
              <div class="spec-text-wrap">
                <span class="spec-label"><strong>Wi-Fi</strong> zdarma</span>
              </div>
            </li>`;

  html = html.replace(bathroomExtraItem, bathroomWithWifiExtraItem);

  // 5. Výhody / Detaily pokojů fotka (desna_41.webp)
  html = html.replace('/hezky pokoj 1.webp', '/desna_41.webp');
  html = html.replace('alt="Detaily Pokojů v Přízemí"', 'alt="Detaily Pokojů s Výhledem" class="img-desna-41"');

  // 6. Panoramatický banner fotka na pozadí a text
  const oldBannerText = `Pokoje Standard v přízemí hotelu jsou navrženy pro maximální pohodlí bez překážek.<br>Díky přístupu zcela bez schodů jsou ideální volbou pro rodiny s kočárky i seniory.`;
  const newBannerText = `Nově zrekonstruovaný pokoj v prvním patře s dřevěným alpským balkónem.<br>Užijte si jedinečný výhled na můstky a uklidňující šumění splavu Bílé Desné přímo pod okny.`;

  html = html.replace(oldBannerText, newBannerText);
  html = html.replace('class="room-banner-section"', 'class="room-banner-section room-view-banner"');

  // 7. Rozdělení pokojů – Názvy a ceny pokojů pro Pokoje s výhledem
  const listStart = html.indexOf('<div class="room-breakdown-list">');
  const listEnd = html.indexOf('<p class="room-breakdown-footer-note">');

  if (listStart !== -1 && listEnd !== -1) {
    const viewRoomsHtml = `
      <div class="room-breakdown-list">
        ${renderRoomBreakdownItem('p7', 'Pokoj Standard P7', 'standard', 830)}
        ${renderRoomBreakdownItem('a1', 'Pokoj Nadstandard Motýl', 'nadstandard', 890)}
        ${renderRoomBreakdownItem('zen', 'Pokoj Nadstandard Zen', 'nadstandard', 890)}
        ${renderRoomBreakdownItem('p10', 'Pokoj Standard P10', 'standard', 830)}
        ${renderRoomBreakdownItem('p11', 'Pokoj Standard P11', 'standard', 830)}
        ${renderRoomBreakdownItem('p12', 'Pokoj Standard P12', 'standard', 830)}
      </div>
    `;
    html = html.substring(0, listStart) + viewRoomsHtml + html.substring(listEnd);
  }

  return html;
};

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

  // Zrušení předchozího neaktivního načítání při manuálním přepnutí uživatele
  if (deferredPreloadTimer) {
    clearTimeout(deferredPreloadTimer);
    deferredPreloadTimer = null;
  }

  // 1. Změna Hero Sekce
  let heroVideo = document.querySelector('.hero-video');
  let heroSummerPoster = document.querySelector('.hero-summer-poster');
  let heroWinterImg = document.querySelector('.hero-winter-img');
  const heroSection = document.querySelector('.hero-section');

  if (heroSection) {
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
        heroSection.insertBefore(heroWinterImg, heroSection.firstChild);
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
        heroSection.insertBefore(heroSummerPoster, heroSection.firstChild);
      } else {
        heroSummerPoster.style.display = 'block';
      }
      if (!heroVideo) {
        heroVideo = document.createElement('video');
        heroVideo.className = 'hero-video';
        heroVideo.autoplay = true;
        heroVideo.muted = true;
        heroVideo.loop = true;
        heroVideo.playsInline = true;
        heroVideo.setAttribute('fetchpriority', 'high');
        heroVideo.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; background: transparent;';
        heroVideo.innerHTML = `
          <source src="https://jpvnvjcktpxyxrvsdukm.supabase.co/storage/v1/object/public/hotel-videos/hero_final_v5.mp4" type="video/mp4">
        `;
        heroSection.insertBefore(heroVideo, heroSection.firstChild);
      } else {
        heroVideo.style.display = 'block';
        heroVideo.play().catch(() => {});
      }
    }
  }

  // 2. Sekce Zázemí (O nás)
  const aboutTopImg = document.querySelector('.about-img-top img');
  const aboutBottomImg = document.querySelector('.about-img-bottom img');
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
      ? '/Zimni rezim/Zima - zadni vchod.webp'
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

// Inicializace událostí a interaktivity po vykreslení
const initInteractivity = () => {
  // Aplikace sezónního režimu (Léto / Zima)
  const currentMode = getInitialSeasonMode();
  scheduleInactiveSeasonPreload(currentMode);
  initProgressiveLazyLoading();
  initCategoryHoverPreload();

  const seasonControls = document.querySelectorAll('.bottom-left-controls .control-item, .mobile-season-toggle .control-item');
  seasonControls.forEach(control => {
    control.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = control.textContent.trim().toLowerCase();
      const newMode = text.includes('zima') ? 'winter' : 'summer';
      setSeasonMode(newMode, true);
      const mobileOverlay = document.getElementById('mobile-menu-overlay');
      if (mobileOverlay) {
        mobileOverlay.classList.remove('is-active');
      }
    });
  });

  // Mobile Hamburger Drawer
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileClose = document.getElementById('mobile-menu-close');
  const mobileOverlay = document.getElementById('mobile-menu-overlay');

  if (mobileToggle && mobileOverlay) {
    mobileToggle.addEventListener('click', () => {
      mobileOverlay.classList.add('is-active');
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    });
  }

  if (mobileClose && mobileOverlay) {
    mobileClose.addEventListener('click', () => {
      mobileOverlay.classList.remove('is-active');
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    });
  }

  // Links navigation inside mobile overlay
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileOverlay) mobileOverlay.classList.remove('is-active');
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    });
  });

  // Interaktivita FAQ Accordionu na stránce Aktivity
  const faqQuestionBtns = document.querySelectorAll('.faq-question-btn');
  faqQuestionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const item = btn.closest('.faq-item');
      if (!item) return;
      const isOpen = item.classList.contains('is-open');

      document.querySelectorAll('.faq-item.is-open').forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('is-open');
          const otherBtn = otherItem.querySelector('.faq-question-btn');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      if (isOpen) {
        item.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Hero Video Handling (HomePage)
  const heroVideo = document.querySelector('.hero-video');
  const heroSection = document.querySelector('.hero-section');

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

    const allCards = Array.from(reviewsTrack.children);
    let currentIndex = totalOriginal;

    const getCardStep = () => {
      const firstCard = allCards[0];
      const cardWidth = firstCard.offsetWidth;
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
      window.location.href = '/ubytovani.html';
    });
  }

  const aboutMoreBtn = document.getElementById('about-more-btn');
  if (aboutMoreBtn) {
    aboutMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/ubytovani.html';
    });
  }

  const btnGotoPrizemi = document.getElementById('btn-goto-prizemi');
  if (btnGotoPrizemi) {
    btnGotoPrizemi.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#prizemi';
      route(false);
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    });
  }

  const btnShowRoomsOffer = document.getElementById('btn-show-rooms-offer');
  if (btnShowRoomsOffer) {
    btnShowRoomsOffer.addEventListener('click', (e) => {
      e.preventDefault();
      const roomsSec = document.querySelector('.rooms-list-section');
      if (roomsSec) {
        roomsSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  const btnGotoVyhled = document.getElementById('btn-goto-vyhled');
  if (btnGotoVyhled) {
    btnGotoVyhled.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#vyhled';
      route(false);
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
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

  // Automatické rozbalení pokoje při přechodu z rezervačního formuláře ("Zobrazit pokoj")
  if (window.pendingAutoOpenRoom) {
    const targetRoomId = window.pendingAutoOpenRoom;
    window.pendingAutoOpenRoom = null;
    requestAnimationFrame(() => {
      const targetItem = document.querySelector(`.room-breakdown-item[data-room="${targetRoomId}"]`);
      if (targetItem) {
        const toggleBtn = targetItem.querySelector('.btn-toggle-details');
        const toggleText = targetItem.querySelector('.toggle-text');
        
        targetItem.classList.add('is-open');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        if (toggleText) toggleText.textContent = 'Skrýt podrobnosti';

        const yOffset = -90;
        const y = targetItem.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
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

  const scrollBtnStravovani = document.getElementById('scroll-btn-stravovani');
  if (scrollBtnStravovani) {
    scrollBtnStravovani.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSec = document.getElementById('snidane');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  const scrollBtnEvents = document.getElementById('scroll-btn-events');
  if (scrollBtnEvents) {
    scrollBtnEvents.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSec = document.getElementById('celay-hotel');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
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

  const openLightbox = (photos, startIndex) => {
    currentPhotosList = photos;
    currentPhotoIndex = startIndex;
    if (lightboxImg && currentPhotosList.length > 0) {
      lightboxImg.src = currentPhotosList[currentPhotoIndex];
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
      if (lightboxImg) lightboxImg.src = currentPhotosList[currentPhotoIndex];
    });
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentPhotosList.length === 0) return;
      currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotosList.length) % currentPhotosList.length;
      if (lightboxImg) lightboxImg.src = currentPhotosList[currentPhotoIndex];
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
        const allImgsInTrack = Array.from(track.querySelectorAll('img')).map(i => i.src);
        const clickedIdx = allImgsInTrack.indexOf(img.src);
        openLightbox(allImgsInTrack, clickedIdx !== -1 ? clickedIdx : 0);
      } else {
        openLightbox([img.src], 0);
      }
    });
  });

  const serviceRestaurantBtn = document.getElementById('service-restaurant-btn');
  if (serviceRestaurantBtn) {
    serviceRestaurantBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/stravovani.html';
    });
  }

  const serviceEventsBtn = document.getElementById('service-events-btn');
  if (serviceEventsBtn) {
    serviceEventsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/akce.html';
    });
  }

  const surroundingsMoreBtn = document.getElementById('surroundings-more-btn');
  if (surroundingsMoreBtn) {
    surroundingsMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/okoli.html';
    });
  }

  // Explicitní obsluha prokliku na detailní stránky kategorií v Sekci 3
  const categoryExploreBtns = document.querySelectorAll('.btn-category-explore, .surrounding-card-link-wrapper');
  categoryExploreBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const href = btn.getAttribute('href') || '';
      if (href.includes('turistika')) window.location.href = '/okoli-turistika.html';
      else if (href.includes('cyklistika')) window.location.href = '/okoli-cyklistika.html';
      else if (href.includes('zima')) window.location.href = '/okoli-zima.html';
      else if (href.includes('autem')) window.location.href = '/okoli-vylety-autem.html';
      else if (href.startsWith('/')) window.location.href = href;
      else if (href.startsWith('#')) {
        const clean = href.replace('#', '');
        if (clean === 'turistika') window.location.href = '/okoli-turistika.html';
        else if (clean === 'cyklistika') window.location.href = '/okoli-cyklistika.html';
        else if (clean === 'zimni-vylety' || clean === 'zima') window.location.href = '/okoli-zima.html';
        else if (clean === 'vylety-autem' || clean === 'autem') window.location.href = '/okoli-vylety-autem.html';
      }
    });
  });

  const diningBtns = document.querySelectorAll('.btn-dining-more');
  diningBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/stravovani.html';
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
      const targetHash = roomId ? `#rezervace?room=${roomId}` : '#rezervace';

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
      window.location.hash = '#admin';
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

  // Preload Hero img
  if (cat.heroImg) {
    const heroImg = new Image();
    heroImg.src = cat.heroImg;
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

// Preload Všech Kategorií na pozadí v době nečinnosti prohlížeče
const preloadAllCategoriesBackground = () => {
  const doPreload = () => {
    Object.keys(CATEGORIES_DATA).forEach((catId) => preloadCategoryImages(catId));
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(doPreload, { timeout: 2000 });
  } else {
    setTimeout(doPreload, 1000);
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
  if (pageKey === 'ground') {
    const src = isMobile ? '/mobile_hero_prizemi.webp' : '/balkony 1 copy.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'view') {
    const src = isMobile ? '/mobile_vyhled.webp' : '/vyhled.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'dining') {
    const src = isMobile ? '/mobile_fotka_z_okna.webp' : '/stravovani 1.webp';
    const img = new Image();
    img.src = src;
  } else if (pageKey === 'contact') {
    const src = '/kontakt/vyhled-na-mustky.webp';
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
      <div class="dining-section-header">
        <h2 class="dining-section-title">Snídaně formou švédského stolu</h2>
        <p class="dining-section-lead">
          Běžně podáváme snídaně formou švédských stolů v rozmezí od 8:00 do 9:00 hod. ranních.<br>Těšit se můžete na čerstvé pečivo, sýry, uzeniny, cereálie i teplé pokrmy.
        </p>
      </div>

      <div class="dining-single-img-wrap">
        <img src="/stravovani/snidane.webp" alt="Snídaně formou švédského stolu" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

  <!-- 3. VEČEŘE FORUMU POLOPENZE -->
  <section class="dining-feature-section dining-dinner-section" id="vecere">
    <div class="dining-feature-inner">
      <div class="dining-section-header">
        <h2 class="dining-section-title">Večeře formou polopenze</h2>
        <p class="dining-section-lead">
          Užijte si poctivou českou kuchyni formou dvouchodového menu, které pro vás vaříme z čerstvých sezónních surovin.
        </p>
      </div>

      <div class="dining-single-img-wrap">
        <img src="/stravovani/vecere.webp" alt="Večeře formou polopenze" loading="lazy" decoding="async">
      </div>

      <div class="dining-bottom-notice">
        <p class="dining-bottom-notice-text">
          Jelikož nejsme veřejná restaurace, večeře podáváme ubytovaným hostům společně v 18:00 hodin. Při pozdním návratu z výletu či túry vám jídlo po předchozí domluvě rádi uchováme a ohřejeme.
        </p>
      </div>
    </div>
  </section>

  <!-- 4. PANORAMA KRB RESTAURACE -->
  <section class="dining-fireplace-section" id="krb-restaurace">
    <div class="dining-fireplace-img-wrap">
      <img src="/stravovani/krb_restaurace.webp" alt="Restaurace s krbem v Hotelu u Můstku" loading="lazy" decoding="async">
    </div>
  </section>

  <!-- 5. LETNÍ RESTAURAČNÍ ZAHRÁDKA NAD SPLAVEM -->
  <section class="dining-terrace-section" id="teraska">
    <div class="dining-terrace-inner">
      <div class="dining-2col-layout">
        <!-- Levý sloupec: Informace s ikonami -->
        <div class="dining-2col-content">
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
              <p class="dining-info-desc">Točené pivo Bernard 10°, Polotmavý ležák Bernard 11°, Prémiový Pilsner Urquell 12°.</p>
            </div>

            <div class="dining-info-item">
              <h3 class="dining-info-heading">
                <img src="/Icons/Ikony/view.png" alt="" class="dining-inline-icon">
                <span>Výhled na skokanské můstky</span>
              </h3>
              <p class="dining-info-desc">Přímo od stolu s chlazeným pivem můžete sledovat tréninky skokanů na protilehlých můstcích.</p>
            </div>

            <div class="dining-info-item">
              <h3 class="dining-info-heading">
                <img src="/Icons/Ikony/children.png" alt="" class="dining-inline-icon">
                <span>Zábava pro děti</span>
              </h3>
              <p class="dining-info-desc">Děti se mohou bezpečně vyřádit na naší trampolíně, kterou máte po celou dobu pod dohledem přímo od stolu naší terasy.</p>
            </div>
          </div>
        </div>

        <!-- Pravý sloupec: Fotka terásky -->
        <div class="dining-2col-image">
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
        <div class="dining-2col-image">
          <img src="/stravovani/ohniste.webp" alt="Venkovní grilování a uzení" loading="lazy" decoding="async">
        </div>

        <!-- Pravý sloupec: Text a ikony -->
        <div class="dining-2col-content">
          <h2 class="dining-col-title">Venkovní grilování a uzení</h2>
          <p class="dining-col-lead">Pro milovníky venkovního posezení jsme v areálu zahrady u splavu vybudovali zázemí pro letní relaxaci.</p>

          <div class="dining-info-list">
            <div class="dining-info-item">
              <h3 class="dining-info-heading">
                <img src="/Icons/Ikony/smoker.png" alt="" class="dining-inline-icon">
                <span>Nová venkovní udírna:</span>
              </h3>
              <p class="dining-info-desc">Zbudovaná pro uzení chutných klobásek a dalších specialit.</p>
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
    <div class="dining-events-inner">
      <div class="dining-events-content">
        <h2 class="dining-events-title">Rodinné oslavy, svatby či firemní akce?</h2>
        <p class="dining-events-p1">Plánujete skupinovou akci?</p>
        <p class="dining-events-p2">Rádi pro vás po předchozí dohodě zajistíme kompletní pohoštění, rauty i ubytování pro skupiny do 40 osob.</p>
        <p class="dining-events-p3">Postaráme se o rodinnou atmosféru a hladký průběh vaší akce v klidném údolí Jizerských hor.</p>
      </div>
      <div class="dining-events-action">
        <a href="#kontakt" class="btn btn-about btn-events-cta" id="dining-events-cta-btn">Zjistit více</a>
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
          <span>Uspořádejte nezapomenutelnou akci v Jizerských horách — s kompletním pronájmem hotelu pro 42 hostů a rozlehlým areálem.</span>
        </p>

        <div class="events-hero-buttons-wrap">
          <a href="#celay-hotel" class="btn btn-events-read-more room-detail-hero-btn" id="btn-events-read-more">Přečíst více</a>
          <a href="#kontakt" class="btn btn-events-inquiry" id="btn-events-inquiry">Nezávazná poptávka</a>
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
      <div class="about-content">
        <h2 class="about-title">Celý hotel jen pro vás a vaše hosty</h2>
        <div class="about-text">
          <p>Plánujete skupinovou akci? Po předchozí dohodě pro vás zajistíme kompletní pronájem celého hotelu — ubytování, společenské prostory i pohoštění na jednom místě.</p>
          <p>Postaráme se o rodinnou atmosféru a hladký průběh celé akce v klidném údolí Jizerských hor, stranou ruchu a s naprostým soukromím pro skupiny až do 42 osob.</p>
        </div>
        <a href="#kontakt" class="btn btn-about btn-events-about-cta" id="events-about-cta-btn">Nezávazně poptat termín</a>
      </div>
      
      <div class="about-img-top">
        <img src="/akce/zahradka.webp" alt="Restaurační zahrádka u řeky Desné" loading="lazy" decoding="async">
      </div>

      <div class="about-img-bottom">
        <img src="/akce/restaurace.webp" alt="Restaurace a interiér Hotelu u Můstku" loading="lazy" decoding="async">
      </div>

      <div class="about-shadow-decor">
        <img src="/Decoration/list_shadow.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

  <!-- 3. JAKÉ AKCE U NÁS MŮŽETE NAPLÁNOVAT? -->
  <section class="events-types-section" id="typy-akci">
    <div class="events-types-inner">
      <h2 class="events-types-title">Jaké akce u nás můžete naplánovat?</h2>

      <div class="events-types-grid">
        <!-- Kartička 1: Svatby -->
        <div class="events-type-card">
          <div class="events-type-img-wrap">
            <img src="/akce/svatby.webp" alt="Svatby v Hotelu u Můstku" loading="lazy" decoding="async">
          </div>
          <div class="events-type-card-content">
            <h3 class="events-type-card-title">Svatby</h3>
            <p class="events-type-card-desc">Obřad i hostina v krásném prostředí hor. Celý hotel jen pro vás a vaše svatební hosty s ubytováním přímo na místě.</p>
          </div>
        </div>

        <!-- Kartička 2: Firemní Akce -->
        <div class="events-type-card">
          <div class="events-type-img-wrap">
            <img src="/akce/firemni_akce.webp" alt="Firemní akce a teambuilding" loading="lazy" decoding="async">
          </div>
          <div class="events-type-card-content">
            <h3 class="events-type-card-title">Firemní Akce</h3>
            <p class="events-type-card-desc">Zázemí pro školení, porady i teambuilding s aktivitami v přírodě, společenskou hernou a posezením na terase.</p>
          </div>
        </div>

        <!-- Kartička 3: Rodinné Oslavy -->
        <div class="events-type-card">
          <div class="events-type-img-wrap">
            <img src="/akce/rodinne_oslavy.webp" alt="Rodinné oslavy a jubilea" loading="lazy" decoding="async">
          </div>
          <div class="events-type-card-content">
            <h3 class="events-type-card-title">Rodinné Oslavy</h3>
            <p class="events-type-card-desc">Narozeniny, výročí nebo setkání rodiny pod jednou střechou — s domácí kuchyní, rauty a soukromím pro všechny.</p>
          </div>
        </div>

        <!-- Kartička 4: Klubová Soustředění -->
        <div class="events-type-card">
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
      <h2 class="features-title">Co pro vaši akci zařídíme</h2>
      
      <div class="features-grid">
        <!-- Horní řada (3 položky) -->
        <div class="features-row">
          <!-- Položka 1 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikony/Kuchařská ilustrace s transparentním pozadím.png" alt="Pohoštění na míru" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Pohoštění na míru:</strong> domácí kuchyně z čerstvých surovin.
            </p>
          </div>

          <!-- Položka 2 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikony/Autobus se zavazadly na transparentním pozadím.png" alt="Zajistíme dopravu" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Zajistíme dopravu:</strong> mikrobusem či autobusem pro celou vaši skupinu.
            </p>
          </div>

          <!-- Položka 3 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikony/Obývací scéna s transparentním pozadím.png" alt="Pořádání akcí a oslav" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Pořádání akcí a oslav</strong> bez rušení ostatních hostů.
            </p>
          </div>
        </div>

        <!-- Horizontální dělicí čára -->
        <div class="features-divider"></div>

        <!-- Spodní řada (3 položky) -->
        <div class="features-row">
          <!-- Položka 4 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikona - spolecenska herna.webp" alt="Společenská místnost" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Společenská místnost</strong> pro zábavu i vzdělávání za jakéhokoliv počasí.
            </p>
          </div>

          <!-- Položka 5 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikona - ohniste.webp" alt="Posezení u ohniště" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Posezení u ohniště:</strong> zahradní grill & udírna pro vaši akci.
            </p>
          </div>

          <!-- Položka 6 -->
          <div class="feature-item">
            <div class="feature-icon">
              <img src="/Icons/Ikona - turistika a cyklistika.webp" alt="Živá hudba" loading="lazy" decoding="async">
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
        <source media="(max-width: 767px)" srcset="/Aktivity v hotelu/vyhled na krajinu mobil.webp">
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
            <a href="#aktivity-v-okoli" class="btn btn-activities-hero btn-activities-surroundings" id="btn-activities-surroundings">Aktivity v okolí</a>
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
        <h2 class="hotel-activities-title surroundings-title">Aktivity v našem hotelu</h2>

        <div class="surroundings-slider-viewport" id="hotel-activities-viewport">
          <div class="surroundings-cards-grid" id="hotel-activities-track">
            <!-- Karta 1: Otužování U Splavu -->
            <div class="hotel-activity-card hotel-activity-card-otuzovani surrounding-card">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/Aktivity v hotelu/otuzovani.webp" alt="Otužování U Splavu" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Otužování U Splavu</h3>
            </div>

            <!-- Karta 2: Kulečník -->
            <div class="hotel-activity-card hotel-activity-card-kulecnik surrounding-card">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/Aktivity v hotelu/kulecnik.webp" alt="Kulečník v Hotelu u Můstku" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Kulečník</h3>
            </div>

            <!-- Karta 3: Fotbálek -->
            <div class="hotel-activity-card hotel-activity-card-fotbalek surrounding-card">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/Aktivity v hotelu/fotbalek.webp" alt="Stolní fotbálek" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Fotbálek</h3>
            </div>

            <!-- Karta 4: Šipky -->
            <div class="hotel-activity-card hotel-activity-card-sipky surrounding-card">
              <div class="hotel-activity-img-wrap surrounding-card-img-wrap">
                <img src="/Aktivity v hotelu/sipky.webp" alt="Elektronické šipky" loading="lazy" decoding="async">
              </div>
              <h3 class="hotel-activity-card-title surrounding-card-title">Šipky</h3>
            </div>

            <!-- Karta 5: Společenská Místnost -->
            <div class="hotel-activity-card hotel-activity-card-spolecenska surrounding-card">
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
        <h2 class="surroundings-activities-title surroundings-title">Aktivity v okolí hotelu</h2>

        <div class="surroundings-slider-viewport" id="surroundings-activities-viewport">
          <div class="surroundings-cards-grid" id="surroundings-activities-track">
            <!-- Karta 1: Turistika -->
            <div class="surrounding-activity-card surrounding-card">
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
            <div class="surrounding-activity-card surrounding-card">
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
            <div class="surrounding-activity-card surrounding-card">
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
            <div class="surrounding-activity-card surrounding-card">
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
        <h2 class="activities-faq-title">Často kladené dotazy</h2>

        <div class="activities-faq-list">
          <!-- FAQ Dotaz 1 -->
          <div class="faq-item">
            <button class="faq-question-btn" aria-expanded="false">
              <span class="faq-question-text">Které výlety zvládneme bez velkého stoupání?</span>
              <span class="faq-action-text">Zobrazit odpověď <span class="faq-arrow">&rsaquo;</span></span>
            </button>
            <div class="faq-answer-content">
              <p>K Protržené přehradě se jde údolím po rovině, dojdete tam pěšky od hotelu. Kolem přehrady Souš vede zpevněný okruh bez převýšení. Rašeliniště Jizerky má dřevěné povalové chodníky. Řekněte nám, kolik chcete ujít, a doporučíme trasu na míru.</p>
            </div>
          </div>

          <!-- FAQ Dotaz 2 -->
          <div class="faq-item">
            <button class="faq-question-btn" aria-expanded="false">
              <span class="faq-question-text">Kdy je nejlepší čas přijet?</span>
              <span class="faq-action-text">Zobrazit odpověď <span class="faq-arrow">&rsaquo;</span></span>
            </button>
            <div class="faq-answer-content">
              <p>Špatný termín tu prakticky neexistuje. V květnu až říjnu fungují rozhledny s restauracemi a bikepark, nejhezčí bývá září. Prosinec až březen patří lyžím. Listopad a duben jsou nejklidnější a nejlevnější — muzea, jeskyně i aquapark fungují celoročně.</p>
            </div>
          </div>

          <!-- FAQ Dotaz 3 -->
          <div class="faq-item">
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

    <!-- 5. REUSED SEKCE: CTA BANNER -->
    ${getCtaHTML()}

    <!-- 6. REUSED SEKCE: FOOTER -->
    ${getFooterHTML()}
  </div>
`;

// Render Funkce Pro Stránku "Aktuality"
const getNewsPageHTML = async () => {
  const allItems = await getStoredNewsItems();
  const activeItems = (allItems || []).filter(item => item.is_active);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return `
    <div class="news-page-wrapper">
      <!-- 1. HERO SEKCE AKTUALIT -->
      <section class="hero-section rooms-hero-section room-detail-hero news-hero-section" id="uvod-aktuality">
        <img class="hero-news-poster" src="/Fotky Aktivit/Aktulity hero sekce.webp" alt="Aktuality Hotel u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
        <div class="hero-overlay"></div>
        <div class="hero-inner">
          ${getHeaderHTML()}

          <div class="room-detail-hero-center news-hero-center">
            <h1 class="hero-title room-detail-hero-title">
              <span class="desktop-title-text">Aktuality & Novinky</span>
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
        <div class="news-main-inner">
          ${activeItems.length === 0 ? `
            <div class="news-empty-state">
              <div class="news-empty-icon">📰</div>
              <h3 class="news-empty-title">Aktuálně nemáme žádné novinky</h3>
              <p class="news-empty-desc">Sledujte náš web pro nadcházející akce a sezónní oznámení.</p>
            </div>
          ` : `
            <div class="news-cards-list">
              ${activeItems.map((item, index) => {
                const hasImage = Boolean(item.image_url);
                const formattedContent = (item.content || '').replace(/\n/g, '<br>');
                const isReverse = index % 2 === 1;

                if (hasImage) {
                  return `
                    <article class="news-card news-card-with-image ${isReverse ? 'news-card-reverse' : ''}">
                      <div class="news-card-content">
                        <div class="news-card-date">🗓️ ${formatDate(item.updated_at)}</div>
                        <h2 class="news-card-title">${item.title}</h2>
                        <div class="news-card-text">${formattedContent}</div>
                      </div>
                      <div class="news-card-image-wrap">
                        <img src="${item.image_url}" alt="${item.title}" class="news-card-image" loading="lazy" decoding="async">
                      </div>
                    </article>
                  `;
                } else {
                  return `
                    <article class="news-card news-card-without-image">
                      <div class="news-card-centered-header">
                        <div class="news-card-date">🗓️ ${formatDate(item.updated_at)}</div>
                        <h2 class="news-card-title">${item.title}</h2>
                      </div>
                      <div class="news-card-text news-card-text-readable">${formattedContent}</div>
                    </article>
                  `;
                }
              }).join('')}
            </div>
          `}
        </div>
      </section>

      ${getCtaHTML()}
      ${getFooterHTML()}
    </div>
  `;
};

// Render Funkce Pro Stránku "Kontakt"
const getContactPageHTML = () => `
  <div class="contact-page-wrapper">
    <!-- 1. HERO SEKCE KONTAKTU -->
    <section class="hero-section rooms-hero-section room-detail-hero contact-hero-section" id="uvod-kontakt">
      <img class="hero-contact-poster" src="/kontakt/vyhled-na-mustky.webp" alt="Kontakt Hotel u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        ${getHeaderHTML()}

        <div class="room-detail-hero-center contact-hero-center">
          <h1 class="hero-title room-detail-hero-title">
            <span class="desktop-title-text">Kontakt</span>
            <span class="mobile-tablet-title-text">Neváhejte nás kontaktovat</span>
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
          <div class="contact-info-list">
            <!-- Item 1: Adresa -->
            <div class="contact-info-item">
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
            <div class="contact-info-item">
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
            <div class="contact-info-item">
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
            <div class="contact-info-item">
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
        <div class="contact-form-column" id="form-sekce">
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
                <span class="contact-checkbox-text">Souhlasím se zpracováním osobních údajů pro účely vyřízení dotazu.</span>
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

    <!-- 3. BANNER: POZOR NA UZAVÍRKU SILNICE V ZIMĚ -->
    <section class="contact-road-closure-section">
      <div class="road-closure-overlay"></div>
      <div class="road-closure-inner">
        <h2 class="road-closure-title">Pozor na uzavírku silnice v zimě</h2>
        <p class="road-closure-desc">
          V zimním období je silnice III/290 (úsek přehrada Souš – Smědava) uzavřena.<br>
          K hotelu je celoročně přístupná cesta vždy od Tanvaldu a Desné.
        </p>
      </div>
    </section>

    <!-- 4. JAK SE K NÁM DOSTAT? -->
    <section class="contact-directions-section">
      <div class="contact-directions-inner">
        <h2 class="directions-main-title">Jak se k nám dostat?</h2>

        <div class="directions-grid">
          <!-- Levá část: Parkování -->
          <div class="directions-left-col">
            <h3 class="directions-parking-title">Parkování zdarma přímo u hotelu</h3>
            <p class="directions-parking-desc">
              Uzamykatelné a hlídané kamerovým systémem, bez nutnosti rezervace místa.
            </p>
          </div>

          <!-- Pravá část: Autem a Vlakem -->
          <div class="directions-right-col">
            <!-- Autem -->
            <div class="directions-mode-item">
              <div class="directions-icon-wrap">
                <img src="/Icons/Ikony/car.png" alt="" class="directions-icon">
              </div>
              <div class="directions-mode-content">
                <h3 class="directions-mode-title">Autem</h3>
                <p class="directions-mode-desc">
                  Cesta z Prahy přes Liberec trvá přibližně 80 minut. U hotelu na vás čeká bezplatné a bezpečné parkoviště hlídané kamerovým systémem.
                </p>
              </div>
            </div>

            <!-- Vlakem -->
            <div class="directions-mode-item">
              <div class="directions-icon-wrap">
                <img src="/Icons/Ikony/train.png" alt="" class="directions-icon">
              </div>
              <div class="directions-mode-content">
                <h3 class="directions-mode-title">Vlakem</h3>
                <p class="directions-mode-desc">
                  Vlaková zastávka je 1,5 km po rovině. V případě potřeby rádi zajistíme bezplatný odvoz vašich zavazadel od vlaku přímo k hotelu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. SEKCE MAPA -->
    <section class="contact-map-section" id="mapa">
      <div class="contact-map-inner">
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
  const heroBtn = document.getElementById('btn-goto-contact-form');
  if (heroBtn) {
    heroBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const formSec = document.getElementById('form-sekce') || document.getElementById('contact-page-form');
      if (formSec) {
        formSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  const scrollBtn = document.getElementById('scroll-btn-kontakt');
  if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
      const targetSec = document.getElementById('kontaktní-udaje');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      }
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
      inp.addEventListener('invalid', function() {
        if (this.validity.valueMissing) {
          this.setCustomValidity('Vyplňte prosím toto pole.');
        } else if (this.validity.typeMismatch || this.validity.patternMismatch) {
          this.setCustomValidity('Zadejte prosím platnou e-mailovou adresu.');
        }
      });

      inp.addEventListener('input', function() {
        this.setCustomValidity('');
        this.classList.remove('input-field-error');
      });
    });

    const gdprInput = document.getElementById('contact-gdpr-check');
    if (gdprInput) {
      gdprInput.addEventListener('invalid', function() {
        if (this.validity.valueMissing) {
          this.setCustomValidity('Zaškrtněte prosím toto pole, pokud chcete pokračovat.');
        }
      });
      gdprInput.addEventListener('change', function() {
        this.setCustomValidity('');
      });
    }

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

        // 2. Odeslání hezkého HTML e-mailu adminovi (ondra.zeman05@gmail.com)
        const emailTemplate = generateEmailContactNotification(payload);
        sendEmail({
          to: 'ondra.zeman05@gmail.com',
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
                      <span class="contact-checkbox-text">Souhlasím se zpracováním osobních údajů pro účely vyřízení dotazu.</span>
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
    items: [
      {
        id: 'protrzena-prehrada',
        title: 'Protržená přehrada na Bílé Desné',
        subtitle: '3 km od hotelu | Desná',
        img: '/Fotky Aktivit/protrzena-prehrada-na-bile-desne-5.webp',
        alt: 'Zbytky hráze protržené přehrady na Bílé Desné v Jizerských horách',
        desc: 'Přehrada se protrhla v září roku 1916, sotva rok po dokončení. Voda se během několika minut prohnala údolím a zaplavila Desnou. Zahynulo dvaašedesát lidí. Dodnes je to největší přehradní katastrofa v českých dějinách.\n\nZ hráze zůstala jen obrovská průrva a kamenné bloky v lese. Kolem vede naučná stezka s informačními cedulemi, kde si celý příběh přečtete. Cesta je rovná a nenáročná, dojdete sem pěšky přímo od hotelu asi za tři čtvrtě hodiny. Vhodné i pro pomalejší chůzi.'
      },
      {
        id: 'vyhlidka-spicka',
        title: 'Vyhlídka Špička na Malém Špičáku',
        subtitle: '6 km od hotelu | Tanvald',
        img: '/Fotky Aktivit/vyhlidka-spicka.webp',
        alt: 'Výhled ze skalní vyhlídky Špička na Malém Špičáku nad Tanvaldem',
        desc: 'Malý Špičák se zvedá nad Tanvaldem a na jeho vrcholu najdete skalní vyhlídku. Za dobrého počasí odsud dohlédnete na hřebeny Jizerských hor i na Krkonoše.\n\nVýstup je krátký, ale poslední úsek stoupá docela svižně. Počítejte zhruba s půl hodinou chůze od parkoviště. Nahoře je lavička, kde se dá v klidu posedět. Nejlepší světlo bývá dopoledne.'
      },
      {
        id: 'vodni-nadrz-sous',
        title: 'Vodní nádrž Souš',
        subtitle: '8 km od hotelu',
        img: '/Fotky Aktivit/vodni-nadrz-sous-5.webp',
        alt: 'Vodní nádrž Souš obklopená lesy v Jizerských horách',
        desc: 'Souš leží v tichém údolí mezi lesy a zásobuje pitnou vodou celý Jablonecký region. Hladina se zrcadlí v okolních kopcích a bývá tu opravdové ticho — koupání ani lodě sem nepatří.\n\nKolem přehrady vede pohodlná cesta, po které se dá jít i s kočárkem. Celý okruh má asi šest kilometrů a nikde výrazně nestoupá. Autem sem dojedete za čtvrt hodiny, parkoviště je u hráze.'
      },
      {
        id: 'mumlavske-vodopady',
        title: 'Mumlavské vodopády v Harrachově',
        subtitle: '16 km od hotelu | Harrachov',
        img: '/Fotky Aktivit/mumlavske-vodopady-3.webp',
        alt: 'Mumlavské vodopády v Harrachově padající přes skalní stupeň',
        desc: 'Řeka Mumlava se tu přelévá přes skalní stupeň vysoký deset metrů a rozstřikuje se do širokého vějíře. Po jarním tání nebo po vydatném dešti je to působivá podívaná.\n\nK vodopádu vede z Harrachova široká lesní cesta, dlouhá zhruba dva kilometry, bez prudkého stoupání. Kousek nad vodopádem stojí restaurace, kde se dá dát oběd. Autem z hotelu asi dvacet minut.'
      },
      {
        id: 'lanovy-park-bedrichov',
        title: 'Lanový park Bedřichov',
        subtitle: '20 km od hotelu',
        img: '/Fotky Aktivit/lanovy-park-bedrichov.jpg',
        alt: 'Lanové překážky mezi stromy v lanovém parku v Bedřichově',
        desc: 'Mezi stromy jsou natažené lanové překážky v několika výškových úrovních. Trasy jsou rozdělené podle náročnosti, takže si vybere i menší dítě i dospělý, který si chce vyzkoušet něco náročnějšího.\n\nO bezpečnost se stará obsluha a každý dostane jistící postroj. Nemusíte být sportovec — jde spíš o odvahu než o sílu. Autem z hotelu asi půl hodiny, ideální program na půl dne.'
      },
      {
        id: 'raseliniste-jizerky',
        title: 'Rašeliniště Jizerky',
        subtitle: '13 km od hotelu',
        img: '/Fotky Aktivit/raseliniste-jizerky-4.webp',
        alt: 'Dřevěné povalové chodníky vedoucí přes rašeliniště Jizerky',
        desc: 'Rašeliniště je jedno z nejcennějších míst v Jizerských horách. Rostou tu borovice kleč a rostliny, které jinde v Česku nepotkáte. Krajina působí trochu jako severská tundra.\n\nPřes mokřinu vedou dřevěné povalové chodníky, takže si neušpiníte boty a nikde se neboříte. Cesta je rovná a lemovaná cedulemi, které vysvětlují, co kolem sebe vidíte. Autem z hotelu asi dvacet minut.'
      },
      {
        id: 'rozhledna-svetly-vrch',
        title: 'Rozhledna Světlý vrch v Albrechticích',
        subtitle: '9 km od hotelu | Albrechtice',
        img: '/Fotky Aktivit/rozhledna-svetly-vrch.webp',
        alt: 'Kamenná rozhledna Světlý vrch nad Albrechticemi v Jizerských horách',
        desc: 'Rozhledna stojí na kopci nad Albrechticemi a nabízí kruhový výhled na okolní hřebeny. Za jasného dne je odsud vidět daleko do vnitrozemí.\n\nK rozhledně vede značená cesta lesem, výstup trvá asi dvacet minut. Není strmý, jen mírně stoupá. Autem z hotelu je to zhruba čtvrt hodiny.'
      },
      {
        id: 'osada-jizerka',
        title: 'Osada Jizerka',
        subtitle: '13 km od hotelu',
        img: '/Fotky Aktivit/osada-jizerka-1.webp',
        alt: 'Roubené chalupy v horské osadě Jizerka obklopené loukami',
        desc: 'Jizerka je hrstka roubených chalup rozesetých v široké horské kotlině. Bývá tu naměřená nejnižší teplota v celé republice — v mrazivých nocích tu klesá hluboko pod nulu.\n\nKolem osady jsou louky a rašeliniště, procházky vedou po rovině. Je tu muzeum i pár míst, kde se dá najíst. Auto se nechává na parkovišti před osadou, dovnitř se chodí pěšky. Z hotelu asi dvacet minut jízdy.'
      },
      {
        id: 'riedlova-hrobka',
        title: 'Riedlova hrobka v Desné',
        subtitle: 'pár minut od hotelu | Desná',
        img: '/Fotky Aktivit/riedlova-hrobka-v-desne-4.webp',
        alt: 'Secesní Riedlova hrobka v Desné v Jizerských horách',
        desc: 'Hrobku si nechala postavit sklářská rodina Riedlů, která v Desné po generace určovala život celého kraje. Stavba z počátku dvacátého století je ukázkou secese s barevnými vitrážemi.\n\nStojí přímo v Desné, dojdete sem pěšky za pár minut. Je to zastávka na deset minut, ale stojí za to — takhle zachovalá secesní stavba není v okolí běžná.'
      },
      {
        id: 'rozhledna-stepanka',
        title: 'Rozhledna Štěpánka',
        subtitle: '9 km od hotelu | Kořenov',
        img: '/Fotky Aktivit/rozhledna-stepanka-5.webp',
        alt: 'Kamenná rozhledna Štěpánka na kopci nad Kořenovem',
        desc: 'Štěpánka je nejstarší rozhlednou v Jizerských horách, stavěla se v polovině devatenáctého století a dokončena byla až o pár desítek let později. Kamenná věž stojí na vrcholu Hvězda nad Kořenovem.\n\nNahoru vede točité schodiště, po kterém vystoupáte na ochoz s výhledem na Jizerské hory i Krkonoše. Dole je restaurace. Autem z hotelu čtvrt hodiny, parkuje se kousek pod rozhlednou.'
      },
      {
        id: 'vodopady-cerne-desne',
        title: 'Vodopády Černé Desné',
        subtitle: '5 km od hotelu | Desná',
        img: '/Fotky Aktivit/vodopady-cerne-desne.jpg',
        alt: 'Kaskády vodopádů na říčce Černá Desná v lesním údolí',
        desc: 'Černá Desná se v lesním údolí přelévá přes balvany a vytváří řadu menších kaskád. Není to jeden velký vodopád, ale několik stupňů za sebou. V létě je tu příjemný chládek.\n\nÚdolím vede značená cesta podél vody. Terén je místy kamenitý, hodí se pevnější boty. Z hotelu je to nejbližší výlet za vodou — dojdete sem i pěšky.'
      }
    ]
  },
  'cyklistika': {
    title: 'Cyklistika',
    subtitle: 'Nekonečné kilometry cyklostezek, singltreky a horské hřebenovky pro začátečníky i náročné bikery.',
    heroImg: '/Fotky Aktivit/cyklistika.webp',
    items: [
      {
        id: 'singltrek-pod-smrkem',
        title: 'Singltrek pod Smrkem',
        subtitle: '40 km od hotelu',
        img: '/Fotky Aktivit/singltrek-pod-smrkem-4.webp',
        alt: 'Úzká lesní stezka pro horská kola v areálu Singltrek pod Smrkem',
        desc: 'Singltrek je síť úzkých stezek, které se stavěly výhradně pro kola. Vedou lesem, kopírují terén a nikde se nekříží se silnicí. Celkem je jich tu přes osmdesát kilometrů.\n\nTrasy jsou barevně rozlišené jako sjezdovky — od zelené pro začátečníky po černou. Nemusíte být závodník, zelené a modré okruhy zvládne i běžný cyklista. Kolo se dá půjčit na místě. Autem z hotelu asi hodina.'
      },
      {
        id: 'trasa-kolem-souse',
        title: 'Trasa kolem vodní nádrže Souš',
        subtitle: '8 km od hotelu',
        img: '/Fotky Aktivit/vodni-nadrz-sous-5.webp',
        alt: 'Asfaltová cyklistická cesta podél vodní nádrže Souš',
        desc: 'Kolem přehrady Souš vede asfaltová cesta bez aut. Trasa je rovinatá, takže se dá jet v klidu a povídat si — nikde se nedřete do kopce.\n\nOkruh má zhruba šest kilometrů, dá se jet i s dětmi. Cestou je několik míst s výhledem na hladinu. Do Souše se z hotelu dá dojet i na kole, ale je to do kopce — pohodlnější je dovézt kola autem.'
      },
      {
        id: 'cyklostezka-cimrmana',
        title: 'Cyklostezka Járy Cimrmana č. 3019',
        subtitle: '7 km od hotelu | Kořenov',
        img: '/Fotky Aktivit/cyklostezka-jary-cimrmana-4.webp',
        alt: 'Značená cyklostezka Járy Cimrmana vedoucí krajinou Jizerských hor',
        desc: 'Trasa je pojmenovaná po slavném fiktivním géniovi, který podle legendy v tomhle kraji působil. Vede přes Kořenov a okolní osady, částečně po klidných silničkách.\n\nStoupání jsou mírná a rozložená, není tu žádný prudký kopec. Cestou míjíte kapličky, staré domy a několik hospod. Nástup je kousek od hotelu, není potřeba nikam převážet kola.'
      },
      {
        id: 'hrebenova-cyklotrasa-smedava',
        title: 'Hřebenová cyklotrasa na Smědavu',
        subtitle: '22 km od hotelu',
        img: '/Fotky Aktivit/smedava-2.webp',
        alt: 'Horská chata Smědava na hřebeni Jizerských hor',
        desc: 'Trasa vede po hřebeni Jizerských hor a patří k náročnějším. Stoupání je delší, ale odměnou jsou otevřené výhledy do krajiny na obě strany.\n\nNa Smědavě stojí horská chata, kde se dá najíst a odpočinout před cestou zpátky. Je to klasický cíl jizerskohorských cyklistů. Počítejte s celým dnem a s tím, že je potřeba nějaká kondice.'
      },
      {
        id: 'bikepark-spicak',
        title: 'Bikepark Tanvaldský Špičák',
        subtitle: '7 km od hotelu',
        img: '/Fotky Aktivit/bikepark-tanvaldsky-spicak-4.webp',
        alt: 'Sjezdová trať bikeparku na Tanvaldském Špičáku',
        desc: 'V létě se ze sjezdovky stává bikepark. Nahoru vás vyveze lanovka i s kolem, dolů si vyberete trať podle toho, co si troufnete.\n\nTratě jsou rozdělené podle obtížnosti, od jednoduchých po skokanské. Kolo i chrániče se půjčují na místě, takže se nemusíte tahat s vlastní výbavou. Z hotelu jen deset minut autem.'
      },
      {
        id: 'stepanka-na-kole',
        title: 'Rozhledna Štěpánka na kole',
        subtitle: '9 km od hotelu',
        img: '/Fotky Aktivit/rozhledna-stepanka-5.webp',
        alt: 'Kamenná rozhledna Štěpánka jako cíl cyklistického výletu',
        desc: 'Ke Štěpánce se dá vyjet na kole po klidných silničkách přes Kořenov. Poslední kilometr před rozhlednou pořádně stoupá, tam už se většinou tlačí.\n\nNahoře necháte kolo dole a vystoupáte po schodech na ochoz. Vidět je odsud na Jizerské hory i na Krkonoše. Pod rozhlednou je restaurace, kde se dá doplnit energie na cestu zpátky.'
      },
      {
        id: 'jizerska-magistrala-cyklo',
        title: 'Jizerská magistrála pro cyklisty',
        subtitle: '20 km od hotelu',
        img: '/Fotky Aktivit/jizerska-magistrala-3.webp',
        alt: 'Široká lesní cesta Jizerské magistrály vhodná pro cyklisty',
        desc: 'Jizerská magistrála je v zimě slavná běžkařská síť. V létě se z těch samých cest stávají skvělé trasy pro kola — jsou široké, zpevněné a nejezdí po nich auta.\n\nNástup je nejsnazší v Bedřichově, kde je velké parkoviště. Odtud si můžete poskládat okruh podle toho, kolik máte sil. Značení je přehledné, na rozcestích jsou mapy.'
      },
      {
        id: 'cyklotrasa-udolim-kamenice',
        title: 'Cyklotrasa údolím řeky Kamenice',
        subtitle: '5 km od hotelu',
        img: '/Fotky Aktivit/udoli-kamenice.webp',
        alt: 'Cyklotrasa vedoucí údolím řeky Kamenice v Jizerských horách',
        desc: 'Trasa sleduje řeku Kamenici a vede převážně z kopce. Je to jedna z nejpohodlnějších vyjížděk v okolí — jedete podél vody a nemusíte se nikam drát.\n\nHodí se i pro rodiny s dětmi. Zpátky se dá vyjet vlakem, který jezdí souběžně s údolím a kola bere. Nástup je kousek od hotelu.'
      },
      {
        id: 'cerna-studnice-na-kole',
        title: 'Rozhledna Černá Studnice na kole',
        subtitle: '20 km od hotelu',
        img: '/Fotky Aktivit/rozhledna-cerna-studnice.webp',
        alt: 'Kamenná rozhledna Černá Studnice s horskou chatou',
        desc: 'Černá Studnice je výrazný vrch nad Jabloncem s kamennou rozhlednou z konce devatenáctého století. Výjezd na kole je poctivé stoupání, ale cesta je celou dobu zpevněná.\n\nNahoře je vedle rozhledny chata s kuchyní, takže se dá dát oběd a pak si užít výhled. Za jasného počasí je vidět až na Ještěd. Sjezd zpátky je rychlý a příjemný.'
      }
    ]
  },
  'zimni-vylety': {
    title: 'Výlety v zimě',
    subtitle: 'Zimní pohádka v Jizerských horách — špičkové ski areály, upravované běžecké stopy i rodinná zábava.',
    heroImg: '/Fotky Aktivit/Zimni vylety.webp',
    items: [
      {
        id: 'ski-cerna-ricka',
        title: 'Ski areál Černá Říčka v Desné',
        subtitle: '3 km od hotelu | Desná',
        img: '/Fotky Aktivit/ski-areal-cerna-ricka.webp',
        alt: 'Zasněžená sjezdovka ski areálu Černá Říčka v Desné',
        desc: 'Černá Říčka je malý rodinný areál přímo v Desné. Není to velké středisko s davy lidí — spíš klidné místo, kde se dá v pohodě lyžovat.\n\nPrávě proto se hodí pro začátečníky a děti. Fronty u vleku bývají krátké a nikdo vás nikam netlačí. Je to nejbližší lyžování od hotelu, dojedete sem za pár minut.'
      },
      {
        id: 'jizerska-magistrala-bezky',
        title: 'Jizerská magistrála pro běžkaře',
        subtitle: '20 km od hotelu',
        img: '/Fotky Aktivit/jizerska-magistrala-zima.webp',
        alt: 'Upravená běžkařská stopa Jizerské magistrály v zasněženém lese',
        desc: 'Jizerská magistrála je nejznámější běžkařská síť u nás. Přes sto sedmdesát kilometrů tratí, které se pravidelně upravují rolbou.\n\nTrasy vedou lesem po hřebenech a jsou rozdělené podle náročnosti — najdete tu rovinaté okruhy i dlouhé náročné přejezdy. Nejsnazší nástup je v Bedřichově, kde je velké parkoviště a půjčovna. Aktuální stav stop se dá zjistit online.'
      },
      {
        id: 'aquapark-babylon',
        title: 'Aquapark a wellness centrum Babylon Liberec',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/aquapark-babylon-liberec-1.webp',
        alt: 'Vnitřní bazén aquaparku Babylon v Liberci',
        desc: 'Krytý aquapark s bazény, tobogány a vířivkami. Vedle je wellness s několika druhy saun a odpočívárnou.\n\nPo dni na běžkách nebo na sjezdovce je to přesně to, co potřebujete. Všechno je uvnitř, takže na počasí nezáleží. Aquapark je součástí komplexu Babylon, kde jsou i restaurace. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'jested-zima',
        title: 'Ještěd v zimě',
        subtitle: '35 km od hotelu | Liberec',
        img: '/Fotky Aktivit/jested-zima.webp',
        alt: 'Zasněžený vrchol Ještědu s vysílačem nad Libercem',
        desc: 'V zimě se Ještěd mění na lyžařské středisko. Sjezdovky vedou přímo z vrcholu a patří k nejdelším v severních Čechách.\n\nI když nelyžujete, stojí za to vyjet lanovkou nahoru. Zasněžený vrchol s tou zvláštní kuželovitou věží je působivý pohled a nahoře je teplá restaurace s výhledem. Autem z hotelu asi tři čtvrtě hodiny.'
      },
      {
        id: 'skiareal-tanvaldsky-spicak',
        title: 'Skiareál Jizerky – Tanvaldský Špičák',
        subtitle: '7 km od hotelu',
        img: '/Fotky Aktivit/tanvaldsky-spicak-zima.webp',
        alt: 'Zasněžená sjezdovka a lanovka ve skiareálu Tanvaldský Špičák',
        desc: 'Tanvaldský Špičák je nejbližší větší středisko od hotelu — jste tam za deset minut autem. Sjezdovky pokrývají všechny obtížnosti od modrých po černé.\n\nNahoru vede lanovka, na svazích se uměle zasněžuje, takže sezona bývá dlouhá. Několik sjezdovek je osvětlených pro večerní lyžování. Půjčovna i lyžařská škola jsou přímo v areálu.'
      },
      {
        id: 'muzeum-skla-bizuterie',
        title: 'Muzeum skla a bižuterie v Jablonci nad Nisou',
        subtitle: '18 km od hotelu | Jablonec nad Nisou',
        img: '/Fotky Aktivit/muzeum-skla-jablonec.webp',
        alt: 'Expozice historického skla a bižuterie v jabloneckém muzeu',
        desc: 'Když je venku plískanice, tohle je dobrá volba. V teple si projdete jednu z největších sbírek skla a bižuterie na světě.\n\nNejhezčí bývá zimní expozice vánočních ozdob — ukazuje, jak se tady po generace vyráběly skleněné baňky. Prohlídka zabere hodinu a půl a není vyčerpávající. Autem z hotelu asi půl hodiny.'
      },
      {
        id: 'dinopark-liberec-zima',
        title: 'Dinopark Liberec',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/dinopark-liberec.webp',
        objectPosition: '25% center',
        alt: 'Model dinosaura v životní velikosti v Dinoparku Liberec',
        desc: 'Dinopark je klasika pro výlet s dětmi nebo vnoučaty. Modely dinosaurů v životní velikosti, některé pohyblivé, doplněné naučnými cedulemi.\n\nSoučástí je kino s filmem o pravěku a hřiště, kde si děti mohou zkusit vykopávat kosti. Program na dvě až tři hodiny. Před návštěvou si ověřte otevírací dobu — v zimních měsících bývá omezená.'
      },
      {
        id: 'iqlandia-liberec-zima',
        title: 'iQlandia Liberec',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/iqlandia-liberec.webp',
        objectPosition: '65% center',
        alt: 'Interaktivní exponáty ve vědeckém centru iQlandia v Liberci',
        desc: 'Když je venku zima a mokro, iQlandia je jistota. Vědecké centrum, kde si všechno můžete osahat a vyzkoušet — vesmír, lidské tělo, živly, optické klamy.\n\nPřes pět set exponátů na čtyřech patrech, k tomu planetárium s projekcí na kupoli. Během dne se konají vědecké show s pokusy. Snadno tu strávíte půl dne, aniž byste vytáhli paty z tepla.'
      },
      {
        id: 'zoo-botanicka-zima',
        title: 'Zoo a botanická zahrada Liberec',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/zoo-liberec.jpg',
        alt: 'Zvířata ve výběhu liberecké zoologické zahrady',
        desc: 'V zimě je v zoo klid a žádné fronty. Některým zvířatům chladné počasí naopak svědčí — sněžní levharti, sobi nebo vlci jsou v zimě nejaktivnější.\n\nKousek od zoo je botanická zahrada s vyhřívanými skleníky, kde se dá mezi procházkami ohřát. Ideální kombinace: hodina venku u zvířat, hodina v teple mezi tropickými rostlinami.'
      },
      {
        id: 'funpark-babylon-zima',
        title: 'Funpark a Lunapark Babylon v Liberci',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/funpark-babylon-liberec-1.webp',
        objectPosition: 'left center',
        alt: 'Vnitřní zábavní park Babylon v Liberci s atrakcemi',
        desc: 'Celý zábavní komplex je pod střechou, takže mráz ani déšť nevadí. Lunapark má klasické kolotoče a atrakce, Funpark je určený menším dětem.\n\nVe stejné budově je aquapark, wellness a několik restaurací, takže se dá naplánovat celý den na jednom místě. Parkování je přímo u budovy. Autem z hotelu necelou hodinu.'
      }
    ]
  },
  'vylety-autem': {
    title: 'Výlety autem',
    subtitle: 'Pohodlné výlety za kulturou, zábavou a památkami v širším okolí Jizerských hor a Severních Čech.',
    heroImg: '/Fotky Aktivit/vylety autem.webp',
    items: [
      {
        id: 'bobova-draha-janov',
        title: 'Bobová dráha Janov nad Nisou',
        subtitle: '16 km od hotelu | Janov nad Nisou',
        img: '/Fotky Aktivit/bobova-draha-janov.jpg',
        alt: 'Bob na kolejnici bobové dráhy v Janově nad Nisou',
        desc: 'Dráha měří devět set metrů a má dvaadvacet zatáček. Zvláštností je karusel, ve kterém se bob otočí o celou zatáčku a půl.\n\nVozík má brzdu, takže si rychlost řídíte sami — dá se to sjet svižně i pomalu. Boby jsou pro jednoho nebo dva lidi, takže menší dítě může jet s vámi. V areálu je restaurace s terasou a dětský koutek. Otevřeno bývá celoročně.'
      },
      {
        id: 'jested-auto',
        title: 'Ještěd v Liberci',
        subtitle: '35 km od hotelu | Liberec',
        img: '/Fotky Aktivit/jested-2.webp',
        alt: 'Silueta vysílače a hotelu Ještěd nad Libercem',
        desc: 'Ještěd je nejznámější stavba severních Čech — kuželovitá věž, která plynule navazuje na tvar kopce. Je to zároveň vysílač i hotel s restaurací a architektonicky patří k tomu nejlepšímu, co u nás vzniklo.\n\nNahoru se dá vyjet lanovkou z Horního Hanychova, což je nejpohodlnější varianta. Za jasného počasí je z vrcholu vidět do Německa i do Polska. Autem z hotelu asi tři čtvrtě hodiny.'
      },
      {
        id: 'rozhledna-bramberk',
        title: 'Rozhledna Bramberk s restaurací',
        subtitle: '15 km od hotelu | Lučany nad Nisou',
        img: '/Fotky Aktivit/rozhledna-bramberk-4.webp',
        alt: 'Kamenná rozhledna Bramberk obklopená lesem',
        desc: 'Bramberk stojí nad Lučany nad Nisou a patří k nejstarším rozhlednám v okolí. Kamenná věž vyrůstá přímo z lesa a nahoře je ochoz s kruhovým výhledem.\n\nU paty rozhledny je restaurace, takže se dá výlet spojit s obědem. Parkuje se kousek pod vrcholem, poslední úsek se jde pěšky asi deset minut. Nenáročné, vhodné i pro pomalejší chůzi.'
      },
      {
        id: 'dinopark-auto',
        title: 'Dinopark Liberec',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/dinopark-liberec.webp',
        objectPosition: '25% center',
        alt: 'Model dinosaura v životní velikosti v Dinoparku Liberec',
        desc: 'V parku jsou rozestavěné modely dinosaurů v životní velikosti. Některé se hýbou a vydávají zvuky, což na děti udělá dojem.\n\nKromě modelů je tu kino s filmem o pravěku, paleontologické hřiště, kde se dá hrabat v písku, a naučné cedule. Cesta parkem je zpevněná a dá se projít bez námahy. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'bozkovske-jeskyne',
        title: 'Bozkovské dolomitové jeskyně',
        subtitle: '28 km od hotelu | Bozkov',
        img: '/Fotky Aktivit/bozkovske-jeskyne.webp',
        alt: 'Podzemní jezero v Bozkovských dolomitových jeskyních',
        desc: 'Bozkovské jeskyně jsou jediné zpřístupněné jeskyně v severních Čechách. Objevily se náhodou při hledání vody v padesátých letech.\n\nProhlídka trvá zhruba čtyřicet minut a vede vás průvodce. Hlavní zajímavostí je podzemní jezero, největší svého druhu v Česku. Uvnitř je stále kolem devíti stupňů, vezměte si bundu. Vstupenky se doporučuje rezervovat předem.'
      },
      {
        id: 'koupaliste-dolina',
        title: 'Koupaliště Dolina s restaurací v Bedřichově',
        subtitle: '20 km od hotelu | Bedřichov',
        img: '/Fotky Aktivit/koupaliste-dolina.webp',
        alt: 'Přírodní koupaliště Dolina v Bedřichově s dřevěnou budovou restaurace',
        desc: 'Dolina je přírodní koupaliště v Bedřichově, obklopené lesem. Voda je horská, takže i v největším vedru osvěží.\n\nU koupaliště je restaurace s terasou a posezením, dá se tu strávit celé odpoledne. Areál je udržovaný a klidný, není to velký aquapark, ale příjemné místo na pohodový den. Autem z hotelu asi půl hodiny.'
      },
      {
        id: 'zoo-liberec-auto',
        title: 'Zoo Liberec',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/zoo-liberec.jpg',
        alt: 'Výběh se zvířaty v liberecké zoologické zahrady',
        desc: 'Liberecká zoo je nejstarší zoologická zahrada v Česku, funguje od roku 1904. Žije tu kolem sto sedmdesáti druhů zvířat ze všech světadílů.\n\nNa rozdíl od velkých zahrad se dá projít pohodlně za dvě až tři hodiny, aniž byste se uchodili. K nejoblíbenějším patří pandy červené, lachtani a levharti sněžní. V areálu je občerstvení i místa na odpočinek.'
      },
      {
        id: 'iqlandia-auto',
        title: 'iQlandia Liberec',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/iqlandia-liberec.webp',
        objectPosition: '65% center',
        alt: 'Interaktivní exponáty ve vědeckém centru iQlandia v Liberci',
        desc: 'iQlandia je vědecké centrum, kde si všechno můžete osahat a vyzkoušet. Na čtyřech patrech je přes pět set exponátů rozdělených do jedenácti expozic — vesmír, lidské tělo, živly, smysly.\n\nSoučástí je planetárium s projekcí na kupoli. Během dne probíhají vědecké show, kde se předvádějí pokusy. Je to nejlepší program na deštivý den. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'cerna-studnice-auto',
        title: 'Rozhledna Černá Studnice s chatou',
        subtitle: '20 km od hotelu | Jablonec nad Nisou',
        img: '/Fotky Aktivit/rozhledna-cerna-studnice.webp',
        alt: 'Kamenná rozhledna Černá Studnice s horskou chatou nad Jabloncem',
        desc: 'Rozhledna z konce devatenáctého století stojí na skalnatém vrcholu nad Jabloncem. Je postavená z hrubého kamene a působí spíš jako středověká věž.\n\nZ ochozu je za jasného počasí vidět na Ještěd, Jizerské hory i do vnitrozemí. Hned vedle je horská chata s kuchyní, kde se dá naobědvat. Parkoviště je kousek pod vrcholem, pěšky asi patnáct minut.'
      },
      {
        id: 'funpark-babylon-auto',
        title: 'Funpark a Lunapark Babylon v Liberci',
        subtitle: '32 km od hotelu | Liberec',
        img: '/Fotky Aktivit/funpark-babylon-liberec-1.webp',
        objectPosition: 'left center',
        alt: 'Vnitřní zábavní park Babylon v Liberci s atrakcemi',
        desc: 'Babylon je velký zábavní komplex v centru Liberce. Lunapark nabízí klasické kolotoče a atrakce, Funpark je spíš pro menší děti — prolézačky, skluzavky a herní zóny.\n\nVšechno je pod střechou, takže na počasí vůbec nezáleží. V areálu je i aquapark a několik restaurací, dá se tu strávit celý den. Parkování je přímo u budovy.'
      },
      {
        id: 'zamek-sychrov',
        title: 'Státní zámek Sychrov',
        subtitle: '45 km od hotelu | Sychrov',
        img: '/Fotky Aktivit/zamek-sychrov-5.webp',
        alt: 'Novogotický zámek Sychrov s parkem',
        desc: 'Sychrov je novogotický zámek, který po generace patřil francouzskému rodu Rohanů. Interiéry jsou dochované v původním stavu — dřevěné obklady, portréty, knihovna.\n\nProhlídky vede průvodce a trvají zhruba hodinu. Kolem zámku je rozsáhlý anglický park s rybníkem a starými stromy, kterým se dá projít i bez vstupenky. Autem z hotelu necelou hodinu.'
      },
      {
        id: 'obri-sud-libverda',
        title: 'Výletní restaurace Obří sud v Lázních Libverda',
        subtitle: '35 km od hotelu | Lázně Libverda',
        img: '/Fotky Aktivit/obri-sud-libverda.webp',
        objectPosition: 'left center',
        alt: 'Dřevěná výletní restaurace Obří sud u Lázní Libverda',
        desc: 'Restaurace je opravdu postavená do tvaru obrovského dřevěného sudu. Vznikla ve třicátých letech jako výletní atrakce a slouží dodnes.\n\nUvnitř je klasická česká kuchyně, venku terasa s výhledem do kraje. Je to místo, kam se jezdí spíš pro tu kuriozitu a atmosféru než pro jídlo samotné — ale najíst se tu dá dobře. Nedaleko jsou Lázně Libverda a Hejnice.'
      },
      {
        id: 'rozhledna-kralovka',
        title: 'Rozhledna Královka s restaurací',
        subtitle: '16 km od hotelu | Janov nad Nisou',
        img: '/Fotky Aktivit/rozhledna-kralovka-5.webp',
        alt: 'Kamenná rozhledna Královka s restaurací nad Janovem nad Nisou',
        desc: 'Královka stojí nad Janovem nad Nisou a je jednou z nejdostupnějších rozhleden v okolí. Od parkoviště je to jen kousek po rovině.\n\nZ ochozu vidíte na hřebeny Jizerských hor, Ještěd i na Jablonec. Hned u rozhledny je restaurace s terasou. Ideální na krátký výlet, když nechcete strávit celý den chůzí.'
      },
      {
        id: 'muzeum-skla-auto',
        title: 'Muzeum skla a bižuterie v Jablonci nad Nisou',
        subtitle: '18 km od hotelu | Jablonec nad Nisou',
        img: '/Fotky Aktivit/muzeum-skla-jablonec.webp',
        alt: 'Expozice skleněných a bižuterních výrobků v jabloneckém muzeu',
        desc: 'Muzeum ukazuje historii řemesla, které tenhle kraj po staletí živilo. Sbírka skla a bižuterie patří k nejrozsáhlejším na světě.\n\nUvidíte lustry, vánoční ozdoby, korálky i sklo z různých období. Expozice jsou přehledně uspořádané a nejsou vyčerpávající — projdete je za hodinu a půl. Vhodné za každého počasí. Autem z hotelu asi půl hodiny.'
      }
    ]
  }
};

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
        <img class="hero-category-poster hero-category-poster-${catId}" src="${cat.heroImg}" alt="${cat.title} - Hotel u Můstku" fetchpriority="high" loading="eager" decoding="async" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
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
              <a href="#aktivity-v-okoli" class="btn btn-activities-hero btn-activities-hotel">‹ Zpět na přehled aktivit</a>
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
  document.addEventListener('click', (e) => {
    // 1. Otevření pop-up modalu z boční záložky nebo tlačítka
    if (e.target && (e.target.closest('#announcement-side-tab') || e.target.closest('#btn-open-announcement-modal'))) {
      e.preventDefault();
      const annModal = document.getElementById('announcement-detail-modal');
      if (annModal) {
        annModal.classList.add('is-active');
        document.body.style.overflow = 'hidden';
      }
    }

    // 2. Zavření pop-up modalu tlačítkem ✕ nebo klikem na pozadí
    if (e.target && (e.target.closest('#btn-close-announcement-modal') || e.target.closest('#announcement-modal-overlay'))) {
      const annModal = document.getElementById('announcement-detail-modal');
      if (annModal) {
        annModal.classList.remove('is-active');
        document.body.style.overflow = '';
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const annModal = document.getElementById('announcement-detail-modal');
      if (annModal && annModal.classList.contains('is-active')) {
        annModal.classList.remove('is-active');
        document.body.style.overflow = '';
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

const app = document.querySelector('#app');
let currentViewKey = null;

const route = (isInitial = false) => {
  const hash = window.location.hash || '';
  let cleanHash = hash.split('?')[0];
  try {
    cleanHash = decodeURIComponent(cleanHash).toLowerCase();
  } catch (e) {}

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

  // 1. Kontrola podle čisté URL adresy (Pathname)
  if (pathName === '/ubytovani' || pathName === '/pokoje') {
    pageKey = 'rooms';
  } else if (pathName === '/stravovani' || pathName === '/gastronomie') {
    pageKey = 'dining';
  } else if (pathName === '/akce' || pathName === '/skupinove-akce') {
    pageKey = 'events';
  } else if (pathName === '/okoli-turistika.html' || pathName === '/okoli/turistika' || pathName === '/okoli-cyklistika.html' || pathName === '/okoli/cyklistika' || pathName === '/okoli-zima.html' || pathName === '/okoli/zima' || pathName === '/okoli-vylety-autem.html' || pathName === '/okoli/vylety-autem') {
    pageKey = 'category-detail';
  } else if (pathName === '/okoli' || pathName === '/aktivity' || pathName === '/vylety') {
    pageKey = 'activities';
  } else if (pathName === '/aktuality' || pathName === '/novinky') {
    pageKey = 'news';
  } else if (pathName === '/kontakt') {
    pageKey = 'contact';
  } else if (pathName === '/admin' || pathName === '/recepce') {
    pageKey = 'admin';
  } else if (pathName === '/rezervace' || pathName === '/booking') {
    pageKey = 'booking';
  } else if (pathName === '/prizemi') {
    pageKey = 'ground';
  } else if (pathName === '/vyhled') {
    pageKey = 'view';
  } else if (cleanHash.startsWith('#rezervace')) {
    pageKey = 'booking';
  } else if (cleanHash.startsWith('#admin')) {
    pageKey = 'admin';
  } else if (knownCategoryHashes.includes(cleanHash) || cleanHash.includes('turistik') || cleanHash.includes('cykl') || cleanHash.includes('zimn') || cleanHash.includes('autem')) {
    pageKey = 'category-detail';
  } else if (knownNewsHashes.includes(cleanHash) || cleanHash.includes('aktualit') || cleanHash.includes('novink')) {
    pageKey = 'news';
  } else if (knownContactHashes.includes(cleanHash) || cleanHash.includes('kontakt')) {
    pageKey = 'contact';
  } else if (knownActivitiesHashes.includes(cleanHash)) {
    pageKey = 'activities';
  } else if (knownEventsHashes.includes(cleanHash)) {
    pageKey = 'events';
  } else if (knownDiningHashes.includes(cleanHash)) {
    pageKey = 'dining';
  } else if (cleanHash === '#pokoj-prizemi' || cleanHash === '#pokoje-prizemi' || cleanHash === '#pokoj-v-prizemi') {
    pageKey = 'ground';
  } else if (cleanHash === '#pokoj-vyhled' || cleanHash === '#pokoje-vyhled' || cleanHash === '#pokoj-s-vyhledem') {
    pageKey = 'view';
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

  if (pageKey === 'ground' || pageKey === 'view' || pageKey === 'dining' || pageKey === 'events' || pageKey === 'activities' || pageKey === 'category-detail' || pageKey === 'contact' || pageKey === 'news') {
    preloadHeroImages(pageKey);
  }

  // Pre-rendered check: IF #app already has static HTML rendered for this page on initial load, do NOT overwrite it
  const isPreRendered = isInitial && app.children && app.children.length > 0;

  if (pageKey === 'booking') {
    app.innerHTML = getBookingPageHTML();
    const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
    const roomId = urlParams.get('room') || '';
    new BookingSystem('booking-container').init(roomId);
  } else if (pageKey === 'admin') {
    app.innerHTML = getAdminPageHTML();
    new AdminDashboard('admin-container').init();
  } else if (pageKey === 'news') {
    if (!isPreRendered || isNewPage) {
      getNewsPageHTML().then(html => {
        app.innerHTML = html;
        initInteractivity();
        const btnGoto = document.getElementById('btn-goto-news-list');
        if (btnGoto) {
          btnGoto.addEventListener('click', () => {
            const listSec = document.getElementById('seznam-aktualit');
            if (listSec) listSec.scrollIntoView({ behavior: 'smooth' });
          });
        }
      });
    }
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

    // If accessed via hash link from another page (e.g. /okoli#turistika), redirect to the real HTML page
    if (hash && (hash.includes('turistik') || hash.includes('cykl') || hash.includes('zimn') || hash.includes('aut'))) {
      if (catId === 'turistika' && !pathName.includes('okoli-turistika')) { window.location.href = '/okoli-turistika.html'; return; }
      if (catId === 'cyklistika' && !pathName.includes('okoli-cyklistika')) { window.location.href = '/okoli-cyklistika.html'; return; }
      if (catId === 'zimni-vylety' && !pathName.includes('okoli-zima')) { window.location.href = '/okoli-zima.html'; return; }
      if (catId === 'vylety-autem' && !pathName.includes('okoli-vylety-autem')) { window.location.href = '/okoli-vylety-autem.html'; return; }
    }

    preloadCategoryImages(catId);
    if (!isPreRendered || isNewPage) {
      app.innerHTML = getCategoryPageHTML(catId);
    }
    initDestinationModal();
  } else if (pageKey === 'activities') {
    if (!isPreRendered || isNewPage) app.innerHTML = getActivitiesPageHTML();
  } else if (pageKey === 'events') {
    if (!isPreRendered || isNewPage) app.innerHTML = getEventsPageHTML();
  } else if (pageKey === 'dining') {
    if (!isPreRendered || isNewPage) app.innerHTML = getStravovaniPageHTML();
  } else if (pageKey === 'ground') {
    app.innerHTML = getRoomGroundFloorHTML();
  } else if (pageKey === 'view') {
    app.innerHTML = getRoomViewFloorHTML();
  } else if (pageKey === 'rooms') {
    if (!isPreRendered || isNewPage) app.innerHTML = getRoomsPageHTML();
  } else if (pageKey === 'contact') {
    if (!isPreRendered || isNewPage) app.innerHTML = getContactPageHTML();
    initContactPageInteractivity();
  } else if (pageKey === '404') {
    app.innerHTML = get404PageHTML();
  } else {
    if (!isPreRendered || isNewPage) app.innerHTML = getHomePageHTML();
  }

  // Přesun na vrchol při běžné navigaci na NOVOU stránku nebo na kontakt / aktuality
  const isSectionHashOnDining = pageKey === 'dining' && ['#snidane', '#vecere', '#krb-restaurace', '#teraska', '#grilovani', '#oslavy-akce'].includes(cleanHash);
  if (pageKey === 'booking' || pageKey === 'contact' || pageKey === 'news' || (!isInitial && isNewPage && !window.pendingAutoOpenRoom && hash !== '#pokoje-nabidka' && !isSectionHashOnDining)) {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  initInteractivity();
  syncDynamicRoomPricesToDOM();
  syncDisabledRoomsToDOM();

  // Automatické odskrolování na sekci Nabídka pokojů při přechodu z tlačítka Nabídka pokojů
  if (pageKey === 'rooms' && hash === '#pokoje-nabidka') {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const roomsSec = document.querySelector('.rooms-list-section');
        if (roomsSec) {
          roomsSec.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    });
  }

  // Automatické odskrolování na podsekci na stránce Stravování
  if (isSectionHashOnDining) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const targetEl = document.querySelector(cleanHash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    });
  }

  // Automatické odskrolování na sekce na stránce Aktivity (#aktivity-v-hotelu / #aktivity-v-okoli)
  if (pageKey === 'activities' && ['#aktivity-v-hotelu', '#aktivity-v-okoli'].includes(cleanHash)) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const targetEl = document.querySelector(cleanHash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    });
  }
};

// Globální obsluha prokliků na odkazy a kategorie
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href) return;

  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('tel:') || href.startsWith('mailto:')) return;

  // Real HTML files / path links -> allow native browser navigation
  if (href.includes('.html') || (href.startsWith('/') && !href.startsWith('/#'))) {
    return; // Do NOT prevent default! Let browser open the page!
  }

  // Handle hash links
  if (href.startsWith('#')) {
    const clean = href.split('?')[0].toLowerCase();

    if (clean === '#turistika' || clean === '#turistika-stranka') {
      e.preventDefault();
      window.location.href = '/okoli-turistika.html';
      return;
    }
    if (clean === '#cyklistika' || clean === '#cyklistika-stranka') {
      e.preventDefault();
      window.location.href = '/okoli-cyklistika.html';
      return;
    }
    if (clean === '#zimni-vylety' || clean === '#zimni' || clean === '#zima') {
      e.preventDefault();
      window.location.href = '/okoli-zima.html';
      return;
    }
    if (clean === '#vylety-autem' || clean === '#autem') {
      e.preventDefault();
      window.location.href = '/okoli-vylety-autem.html';
      return;
    }
    if (clean === '#pokoje' || clean === '#nabidka-pokoju') {
      e.preventDefault();
      window.location.href = '/ubytovani.html';
      return;
    }
    if (clean === '#stravovani' || clean === '#sluzby') {
      e.preventDefault();
      window.location.href = '/stravovani.html';
      return;
    }
    if (clean === '#akce') {
      e.preventDefault();
      window.location.href = '/akce.html';
      return;
    }
    if (clean === '#aktivity' || clean === '#okoli') {
      e.preventDefault();
      window.location.href = '/okoli.html';
      return;
    }
    if (clean === '#kontakt') {
      e.preventDefault();
      window.location.href = '/kontakt.html';
      return;
    }
    if (clean === '#aktuality') {
      e.preventDefault();
      window.location.href = '/aktuality.html';
      return;
    }
    if (clean === '#pokoj-prizemi' || clean === '#pokoje-prizemi' || clean === '#prizemi') {
      e.preventDefault();
      window.location.hash = '#prizemi';
      route(false);
      window.scrollTo(0, 0);
      return;
    }
    if (clean === '#pokoj-vyhled' || clean === '#pokoje-vyhled' || clean === '#vyhled') {
      e.preventDefault();
      window.location.hash = '#vyhled';
      route(false);
      window.scrollTo(0, 0);
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

window.addEventListener('popstate', () => route(false));
window.addEventListener('hashchange', () => route(false));
window.addEventListener('DOMContentLoaded', () => route(true));

// Initial trigger
refreshActiveBanner().then(() => {
  route(true);
  preloadAllCategoriesBackground();
});
