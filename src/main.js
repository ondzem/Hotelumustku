import './style.css';

const getHeaderHTML = () => `
  <!-- Hlavička (Navigace a logo) -->
  <header class="site-header">
    <div class="nav-left">
      <a href="#pokoje" class="nav-link">Nabídka pokojů</a>
      <a href="#sluzby" class="nav-link">Stravování</a>
    </div>
    
    <a href="#domu" class="header-logo">
      <img src="/Logo/white logo.webp" alt="Hotel u Můstku Logo">
    </a>
    
    <div class="nav-right">
      <a href="#aktivity" class="nav-link">Okolí</a>
      <a href="#sluzby" class="nav-link">Akce</a>
      <a href="#kontakt" class="nav-link">Kontakt</a>
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
      <a href="#pokoje" class="mobile-nav-link">Nabídka pokojů</a>
      <a href="#sluzby" class="mobile-nav-link">Stravování</a>
      <a href="#aktivity" class="mobile-nav-link">Okolí</a>
      <a href="#sluzby" class="mobile-nav-link">Akce</a>
      <a href="#kontakt" class="mobile-nav-link">Kontakt</a>
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
        <p class="promo-desc">Rezervací přímo na tomto webu získáte slevu <strong>10%</strong> na celý pobyt. Ušetříte a zajistíte si nejvýhodnější ubytování v našem hotelu.</p>
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

const getReviewsHTML = () => `
  <!-- SEKCE RECENZE (1:1 REPLIKA DLE SVG PŘEDLOHY + INTERAKTIVNÍ INFINITY SLIDER) -->
  <section class="reviews-section" id="recenze">
    <div class="reviews-inner">
      <h2 class="reviews-title">Co o nás říkají sami hosté?</h2>
      
      <div class="reviews-slider-viewport" id="reviews-viewport">
        <div class="reviews-slider-track" id="reviews-track">
          <!-- Recenze 1 -->
          <div class="review-card">
            <img src="/Icons/google logo.webp" alt="Google Logo" class="review-google-icon" loading="lazy" decoding="async">
            <p class="review-quote">Byli jsme jen na 3 dny ale naprostá spokojenost. Pokud pojedeme do těchto končin znovu, určitě se ubytujeme opět tady.</p>
            <div class="review-contour-bg">
              <img src="/Decoration/hory_contour.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
            </div>
            <div class="review-footer">
              <span class="review-author-name">Martin Novák</span>
              <span class="review-date">17.8.2025</span>
            </div>
          </div>
          
          <!-- Recenze 2 -->
          <div class="review-card">
            <img src="/Icons/google logo.webp" alt="Google Logo" class="review-google-icon" loading="lazy" decoding="async">
            <p class="review-quote">Nádherný výhled na skokanské můstky a úžasná snídaně! Personál neuvěřitelně milý a ochotný.</p>
            <div class="review-contour-bg">
              <img src="/Decoration/hory_contour.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
            </div>
            <div class="review-footer">
              <span class="review-author-name">Lucie Králová</span>
              <span class="review-date">2.9.2025</span>
            </div>
          </div>
          
          <!-- Recenze 3 -->
          <div class="review-card">
            <img src="/Icons/google logo.webp" alt="Google Logo" class="review-google-icon" loading="lazy" decoding="async">
            <p class="review-quote">Perfektní čistota pokojů, pohodlné matrace a klid na spaní. Ideální výchozí bod pro turistiku v Jizerskách.</p>
            <div class="review-contour-bg">
              <img src="/Decoration/hory_contour.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
            </div>
            <div class="review-footer">
              <span class="review-author-name">Pavel Dvořák</span>
              <span class="review-date">14.10.2025</span>
            </div>
          </div>

          <!-- Recenze 4 -->
          <div class="review-card">
            <img src="/Icons/google logo.webp" alt="Google Logo" class="review-google-icon" loading="lazy" decoding="async">
            <p class="review-quote">Skvělá zimní dovolená! Úschovna lyží hned v hotelu a kousek na sjezdovky. Rádi se sem příští rok vrátíme.</p>
            <div class="review-contour-bg">
              <img src="/Decoration/hory_contour.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
            </div>
            <div class="review-footer">
              <span class="review-author-name">Eva Šimková</span>
              <span class="review-date">5.1.2026</span>
            </div>
          </div>

          <!-- Recenze 5 -->
          <div class="review-card">
            <img src="/Icons/google logo.webp" alt="Google Logo" class="review-google-icon" loading="lazy" decoding="async">
            <p class="review-quote">Vynikající domácí kuchyně a posezení na terase přímo nad splavem. Velká spokojenost s celým naším pobytem.</p>
            <div class="review-contour-bg">
              <img src="/Decoration/hory_contour.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
            </div>
            <div class="review-footer">
              <span class="review-author-name">Tomáš Procházka</span>
              <span class="review-date">20.2.2026</span>
            </div>
          </div>
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
              <img src="/Icons/Ikona - venkovni prvky.webp" alt="Dětské venkovní herní prvky" loading="lazy" decoding="async">
            </div>
            <p class="feature-text">
              <strong>Dětské venkovní herní prvky</strong> pro radost vašich nejmenších.
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
              <strong>Oplocená zahrada s ohništěm</strong> a grilem pro příjemné večery.
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

const getSurroundingsHTML = () => `
  <!-- SEKCE AKTIVITY V OKOLÍ (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="surroundings-section" id="aktivity">
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
  <footer class="site-footer" id="kontakt">
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
            <li><a href="#pokoje">Ubytování</a></li>
            <li><a href="#sluzby">Stravování</a></li>
            <li><a href="#sluzby">Akce</a></li>
            <li><a href="#aktivity">Okolí</a></li>
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
        <div class="footer-copyright">© 2026 All Rights Reserved.</div>
        <div class="footer-logo-wrap">
          <img src="/Logo/white logo.webp" alt="Hotel U Můstku" loading="lazy" decoding="async">
        </div>
        <div class="footer-author">Vytvořil <a href="https://ozeman.cz" target="_blank" rel="noopener">ozeman.cz</a></div>
      </div>
    </div>
  </footer>
`;

// Render Funkce Pro Domovskou Stránku
const getHomePageHTML = () => `
  <!-- HERO SEKCE -->
  <section class="hero-section" id="uvod">
    <video 
      class="hero-video" 
      autoplay 
      muted 
      loop 
      playsinline 
      preload="auto" 
      fetchpriority="high"
      poster="/Uvodni stranka/Uvodní fotka - hero sekce.webp"
    >
      <source src="/videos/hero_video.mp4" type="video/mp4">
      <source src="https://jpvnvjcktpxyxrvsdukm.supabase.co/storage/v1/object/public/hotel-videos/Video%20Hero%20sekce.mp4" type="video/mp4">
    </video>
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
        <div class="control-item">
          <img src="/Icons/sun_icon.png" alt="Slunce" class="control-icon">
          <span>Léto</span>
        </div>
        <div class="control-item">
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
        <button class="btn btn-about" id="about-more-btn">Přečíst náš příběh</button>
      </div>
      
      <div class="about-img-top">
        <img src="/Uvodni stranka/Vyhled z balkonu na skokanky.webp" alt="Vyhlídka ze skokanských můstků" loading="lazy" decoding="async">
      </div>

      <div class="about-img-bottom">
        <img src="/Uvodni stranka/Pohled na hotel ze z predni strany.webp" alt="Hotel u Můstku budova" loading="lazy" decoding="async">
      </div>

      <div class="about-shadow-decor">
        <img src="/Decoration/list_shadow.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

  ${getPromoHTML()}
  ${getPanoramicHTML()}
  ${getServicesHTML()}
  ${getReviewsHTML()}
  ${getFeaturesHTML()}
  ${getSurroundingsHTML()}
  ${getCtaHTML()}
  ${getFooterHTML()}
`;

// Render Funkce Pro Stránku "Nabídka Pokojů" (Ubytování)
const getRoomsPageHTML = () => `
  <!-- HERO SEKCE POKOJŮ -->
  <section class="hero-section rooms-hero-section" id="uvod-pokoje">
    <div class="hero-overlay"></div>
    <div class="hero-inner">
      ${getHeaderHTML()}

      <!-- Středový nadpis (s odlišnými texty pro desktop vs mobil) -->
      <h1 class="hero-title rooms-hero-title">
        <span class="desktop-only-text">Nabídka pokojů</span>
        <span class="mobile-only-text">Prohlédněte si pokoje a vyberte ten svůj</span>
      </h1>

      <!-- Mobilní tlačítko akce (pouze mobil) -->
      <button class="btn btn-rooms-mobile-cta" id="rooms-mobile-cta">Prohlédnout nabídku</button>

      <!-- Podtext posunutý blíže k nadpisu (pouze desktop) -->
      <p class="rooms-hero-subtitle">Prohlédněte si nabídku našich pokojů a vyberte si ten správný pro váš pobyt v Jizerských horách.</p>

      <!-- Date Picker Bar napůl v hero sekci a napůl v sekci pod ním -->
      <div class="rooms-date-picker-bar">
        <div class="date-picker-fields-group">
          <div class="date-picker-field">
            <div class="date-picker-info">
              <span class="date-picker-label">Příjezd</span>
            </div>
            <svg class="date-picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>

          <div class="date-picker-field">
            <div class="date-picker-info">
              <span class="date-picker-label">Odjezd</span>
            </div>
            <svg class="date-picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
        </div>

        <button class="btn btn-booking rooms-search-btn">Zjistit dostupnost</button>
      </div>

      <!-- Spodní šipka dolů -->
      <div class="scroll-down-btn" id="scroll-btn-pokoje">
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
          <img src="/balkony 1.png" alt="Pokoje přízemí" loading="lazy" decoding="async">
        </div>
        <div class="room-card-content">
          <h2 class="room-card-title">Pokoje přízemí</h2>
          <p class="room-card-desc">Útulně a moderně zařízené pokoje s výhledem do zeleně. Tyto pokoje se nacházejí v přízemí hotelu, a nabízejí tak přímý a snadný přístup na venkovní terasu a k hlavnímu parkovišti.</p>
          <div class="room-card-buttons">
            <button class="btn btn-booking btn-room-primary">Zjistit více</button>
            <button class="btn btn-rooms btn-room-secondary">Rezervovat</button>
          </div>
        </div>
      </div>

      <!-- Card 2: Pokoje s výhledem -->
      <div class="room-card">
        <div class="room-card-content">
          <h2 class="room-card-title">Pokoje s výhledem</h2>
          <p class="room-card-desc">Prostor a soukromí s vlastní prostornou terasou a výhledem na celé údolí. Tyto pokoje se nacházejí v patře hotelu a disponují vlastní koupelnou, balónem a nádherným výhledem.</p>
          <div class="room-card-buttons">
            <button class="btn btn-rooms btn-room-secondary">Rezervovat</button>
            <button class="btn btn-booking btn-room-primary">Zjistit více</button>
          </div>
        </div>
        <div class="room-card-image-wrap">
          <img src="/vyhled 1.png" alt="Pokoje s výhledem" loading="lazy" decoding="async">
        </div>
      </div>
    </div>
  </section>

  ${getPromoHTML()}
  ${getPanoramicHTML()}
  ${getServicesHTML()}
  ${getReviewsHTML()}
  ${getFeaturesHTML()}
  ${getSurroundingsHTML()}
  ${getCtaHTML()}
  ${getFooterHTML()}
`;

// Inicializace událostí a interaktivity po vykreslení
const initInteractivity = () => {
  // Mobile Hamburger Drawer
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileClose = document.getElementById('mobile-menu-close');
  const mobileOverlay = document.getElementById('mobile-menu-overlay');

  if (mobileToggle && mobileOverlay) {
    mobileToggle.addEventListener('click', () => {
      mobileOverlay.classList.add('is-active');
    });
  }

  if (mobileClose && mobileOverlay) {
    mobileClose.addEventListener('click', () => {
      mobileOverlay.classList.remove('is-active');
    });
  }

  // Links navigation inside mobile overlay
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileOverlay) mobileOverlay.classList.remove('is-active');
    });
  });

  // Hero Video Handling (HomePage)
  const heroVideo = document.querySelector('.hero-video');
  const heroSection = document.querySelector('.hero-section');

  if (heroVideo) {
    heroVideo.playbackRate = 0.85;
    heroVideo.play().catch(() => {});
    if ('IntersectionObserver' in window && heroSection) {
      const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            heroVideo.playbackRate = 0.85;
            heroVideo.play().catch(() => {});
          } else {
            heroVideo.pause();
          }
        });
      }, { threshold: 0.05 });
      videoObserver.observe(heroSection);
    }
  }

  // Reviews Slider
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

    updatePosition(false);
    window.addEventListener('resize', () => updatePosition(false));

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

    // Touch Swipe & Drag Support Pro Recenze Slider
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

  // Surroundings Slider
  const surroundingsTrack = document.getElementById('surroundings-track');
  const surroundingsViewport = document.getElementById('surroundings-viewport');
  const surrPrevBtn = document.getElementById('surroundings-prev');
  const surrNextBtn = document.getElementById('surroundings-next');

  if (surroundingsTrack && surroundingsViewport) {
    const cards = Array.from(surroundingsTrack.children);
    let currentIndex = 0;

    const getCardStep = () => {
      if (cards.length === 0) return 0;
      const cardWidth = cards[0].offsetWidth;
      const style = window.getComputedStyle(surroundingsTrack);
      const gap = parseFloat(style.gap) || 24;
      return cardWidth + gap;
    };

    const getMaxScroll = () => {
      return Math.max(0, surroundingsTrack.scrollWidth - surroundingsViewport.offsetWidth);
    };

    const updateBtnState = (offset, maxScroll) => {
      if (surrPrevBtn) {
        surrPrevBtn.style.opacity = offset <= 2 ? '0.4' : '1';
        surrPrevBtn.style.cursor = offset <= 2 ? 'default' : 'pointer';
      }
      if (surrNextBtn) {
        surrNextBtn.style.opacity = offset >= maxScroll - 5 ? '0.4' : '1';
        surrNextBtn.style.cursor = offset >= maxScroll - 5 ? 'default' : 'pointer';
      }
    };

    const updatePosition = (animated = true) => {
      if (window.innerWidth >= 1029) {
        surroundingsTrack.style.transform = 'none';
        surroundingsTrack.style.transition = 'none';
        return;
      }

      const step = getCardStep();
      const maxScroll = getMaxScroll();
      let targetOffset = Math.min(currentIndex * step, maxScroll);

      surroundingsTrack.style.transition = animated ? 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
      surroundingsTrack.style.transform = `translateX(-${targetOffset}px)`;
      updateBtnState(targetOffset, maxScroll);
    };

    updatePosition(false);
    window.addEventListener('resize', () => updatePosition(false));

    const handleNext = () => {
      const maxScroll = getMaxScroll();
      if (currentIndex * getCardStep() < maxScroll - 5) {
        currentIndex++;
        updatePosition(true);
      }
    };

    const handlePrev = () => {
      if (currentIndex > 0) {
        currentIndex--;
        updatePosition(true);
      }
    };

    if (surrNextBtn) surrNextBtn.addEventListener('click', handleNext);
    if (surrPrevBtn) surrPrevBtn.addEventListener('click', handlePrev);

    // Touch Swipe & Drag Support Pro Okolí Slider
    let surrStartX = 0;
    let surrStartY = 0;
    let surrIsDragging = false;

    surroundingsViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) return;
      surrStartX = e.touches[0].clientX;
      surrStartY = e.touches[0].clientY;
      surrIsDragging = true;
    }, { passive: true });

    surroundingsViewport.addEventListener('touchend', (e) => {
      if (!surrIsDragging) return;
      surrIsDragging = false;
      const deltaX = surrStartX - e.changedTouches[0].clientX;
      const deltaY = surrStartY - e.changedTouches[0].clientY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
        if (deltaX > 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }, { passive: true });

    surroundingsViewport.addEventListener('mousedown', (e) => {
      surrStartX = e.clientX;
      surrStartY = e.clientY;
      surrIsDragging = true;
    });

    surroundingsViewport.addEventListener('mouseup', (e) => {
      if (!surrIsDragging) return;
      surrIsDragging = false;
      const deltaX = surrStartX - e.clientX;
      const deltaY = surrStartY - e.clientY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
        if (deltaX > 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    });

    surroundingsViewport.addEventListener('mouseleave', () => {
      surrIsDragging = false;
    });
  }

  // Button clicks
  const roomsBtn = document.getElementById('rooms-btn');
  if (roomsBtn) {
    roomsBtn.addEventListener('click', () => {
      window.location.hash = '#pokoje';
    });
  }

  const bookingBtns = document.querySelectorAll('.btn-booking, .btn-promo, .btn-cta');
  bookingBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      alert('Rezervační systém se načítá...');
    });
  });
};

// Router
const app = document.querySelector('#app');

const route = () => {
  const hash = window.location.hash;
  if (hash === '#pokoje' || hash === '#nabidka-pokoju') {
    app.innerHTML = getRoomsPageHTML();
  } else {
    app.innerHTML = getHomePageHTML();
  }
  window.scrollTo(0, 0);
  initInteractivity();
};

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

// Initial trigger
route();
