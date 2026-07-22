import './style.css';

// SVG Ikony pro sekce Vybavení (vykresleno inline)
const icons = {
  parking: `<svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="M9 13v6M14 9a3 3 0 0 0-3-3h-2v6h2a3 3 0 0 0 3-3z"/></svg>`,
  wifi: `<svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>`,
  wellness: `<svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10zM2 12h20M12 2v20"/></svg>`,
  storage: `<svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 22H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2zM12 2v20M3 12h18"/></svg>`,
  restaurant: `<svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  playground: `<svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10v6M4 10h16M12 4v16"/></svg>`
};

// Inline SVG vrstevnice pro pozadí promo banneru a footeru
const contourSVG = `
<svg class="promo-contour" viewBox="0 0 1440 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M-50 150 C 300 20, 600 280, 900 80 C 1200 -120, 1300 250, 1500 120" stroke="rgba(105, 121, 71, 0.15)" stroke-width="2" />
  <path d="M-50 120 C 250 50, 550 200, 850 120 C 1150 40, 1250 180, 1500 90" stroke="rgba(105, 121, 71, 0.1)" stroke-width="1.5" />
  <path d="M-50 90 C 200 80, 500 120, 800 160 C 1100 200, 1200 110, 1500 60" stroke="rgba(105, 121, 71, 0.08)" stroke-width="1" />
</svg>
`;

// Inline SVG list jako vodoznak v sekci o nás
const leafSVG = `
<svg class="about-watermark" viewBox="0 0 200 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M100 280 C100 280 40 180 30 130 C20 80 50 30 100 20 C150 30 180 80 170 130 C160 180 100 280 100 280 Z" stroke="var(--accent)" stroke-width="2" />
  <path d="M100 20 V280" stroke="var(--accent)" stroke-width="1.5" />
  <path d="M100 100 C120 90 140 90 150 100" stroke="var(--accent)" stroke-width="1.5" />
  <path d="M100 150 C80 140 60 140 50 150" stroke="var(--accent)" stroke-width="1.5" />
  <path d="M100 200 C120 190 140 190 152 200" stroke="var(--accent)" stroke-width="1.5" />
  <path d="M100 240 C80 230 60 230 48 240" stroke="var(--accent)" stroke-width="1.5" />
</svg>
`;

// Vykreslení celého stromu HomePage s integrovanou pixel-perfect full-width Hero sekcí
document.querySelector('#app').innerHTML = `
  <!-- HERO SEKCE (Šířka 100 % s vycentrovanou vnitřní Figma mřížkou) -->
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
      <!-- Hlavička (Navigace a logo) -->
      <header class="site-header">
        <div class="nav-left">
          <a href="#ubytovani" class="nav-link">O nás</a>
          <a href="#pokoje" class="nav-link">Ubytování</a>
          <a href="#wellness" class="nav-link">Stravování</a>
        </div>
        
        <div class="header-logo">
          <img src="/Logo/white logo.webp" alt="Hotel u Můstku Logo">
        </div>
        
        <div class="nav-right">
          <a href="#wellness" class="nav-link">Skupinové akce</a>
          <a href="#aktivity" class="nav-link">Okolí</a>
          <a href="#kontakt" class="nav-link">Kontakt</a>
        </div>
      </header>

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

      <!-- Spodní šipka dolů (Stylizovaná v barevném ohraničení jako Nabídka pokojů, jemná šipka) -->
      <div class="scroll-down-btn" id="scroll-btn">
        <svg width="12" height="14" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.29 17.1C7.68 17.49 8.32 17.49 8.71 17.1L15.07 10.74C15.46 10.35 15.46 9.71 15.07 9.32C14.68 8.93 14.05 8.93 13.66 9.32L8 14.98L2.34 9.32C1.95 8.93 1.32 8.93 0.93 9.32C0.54 9.71 0.54 10.35 0.93 10.74L7.29 17.1ZM8 0H7V16.39H8H9V0H8Z" fill="white"/>
        </svg>
      </div>
    </div>
  </section>

  <!-- SEKCE O NÁS / ZÁZEMÍ (1:1 replika dle SVG předlohy) -->
  <section class="about-section" id="ubytovani">
    <div class="about-inner">
      <!-- Levý textový blok -->
      <div class="about-content">
        <h2 class="about-title" id="o-nas">Zázemí, do kterého se budete rádi vracet.</h2>
        <div class="about-text">
          <p>Náš hotel najdete ukrytý v tichém lesním údolí, stranou ruchu měst. Čeká vás komfortní ubytování, poctivá domácí kuchyně a osobní přístup, díky kterému se tu budete cítit jako doma.</p>
          <p>Ať už přijedete za odpočinkem, nebo za výlety po okolních horách, o pohodlný pobyt se postaráme za vás.</p>
        </div>
        <button class="btn btn-about" id="about-more-btn">Přečíst náš příběh</button>
      </div>
      
      <!-- Fotka 1: Vpravo nahoře -->
      <div class="about-img-top">
        <img src="/Uvodni stranka/Vyhled z balkonu na skokanky.webp" alt="Vyhlídka ze skokanských můstků" loading="lazy" decoding="async">
      </div>

      <!-- Fotka 2: Dole uprostřed -->
      <div class="about-img-bottom">
        <img src="/Uvodni stranka/Pohled na hotel ze z predni strany.webp" alt="Hotel u Můstku budova" loading="lazy" decoding="async">
      </div>

      <!-- Stínová dekorace listu vlevo dole -->
      <div class="about-shadow-decor">
        <img src="/Decoration/list_shadow.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
      </div>
    </div>
  </section>

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

  <!-- PANORAMATICKÝ NÁHLED (FOTKA ZAHRADY A TERASY POD BANNEREM) -->
  <section class="panoramic-section" id="galerie">
    <img src="/Uvodni stranka/Fotka Zahrady a Terasy.webp" alt="Zahrada a terasa Hotelu u Můstku" class="panoramic-img" loading="lazy" decoding="async">
  </section>

  <!-- SEKCE NABÍDKA POKOJŮ (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="rooms-section" id="pokoje">
    <div class="rooms-inner">
      <div class="rooms-header-block">
        <h2 class="rooms-title">Naše nabídka pokojů</h2>
        <p class="rooms-desc">Vyberte si z našich útulných, zářivě čistých pokojů s jedinečným výhledem. Nabízíme pohodlné bezbariérové pokoje v přízemí i panoramatické ubytování v patře - najděte to pravé zázemí pro vaši bezstarostnou dovolenou.</p>
        <button class="btn btn-rooms-offer" id="rooms-all-btn">Prohlédnout nabídku</button>
      </div>

      <div class="rooms-cards-grid">
        <!-- Pokoj 1 (Vlevo) -->
        <div class="room-photo-card room-card-left">
          <img src="/Uvodni stranka/Pokoj 1.webp" alt="Útulný pokoj s dřevěnými trámy" loading="lazy" decoding="async">
        </div>

        <!-- Pokoj 3 (Uprostřed - posunutý dolů) -->
        <div class="room-photo-card room-card-center">
          <img src="/Uvodni stranka/Pokoj 3.webp" alt="Světlý pokoj s výhledem" loading="lazy" decoding="async">
        </div>

        <!-- Pokoj 2 (Vpravo) -->
        <div class="room-photo-card room-card-right">
          <img src="/Uvodni stranka/Pokoj 2.webp" alt="Komfortní dvoulůžkový pokoj" loading="lazy" decoding="async">
        </div>
      </div>
    </div>
  </section>

  <!-- SEKCE CO DALŠÍHO NABÍZÍME / UPSELL (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="services-section" id="wellness">
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

  <!-- SEKCE RECENZE (1:1 REPLIKA DLE SVG PŘEDLOHY + INTERAKTIVNÍ INFINITY SLIDER) -->
  <section class="reviews-section">
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
            <p class="review-quote">Perfektní čistota pokojů, pohodlné matrace a klid na spaní. Ideální výchozí bod pro turistiku v Jizerkách.</p>
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

  <!-- SEKCE AKTIVITY V OKOLÍ (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="surroundings-section" id="aktivity">
    <div class="surroundings-inner">
      <h2 class="surroundings-title">Co vše můžete v okolí podniknout?</h2>
      
      <div class="surroundings-cards-grid">
        <!-- Karta 1 -->
        <div class="surrounding-card">
          <div class="surrounding-card-img-wrap">
            <img src="/Uvodni stranka/Vodopady Jizerky.webp" alt="Vodopády na Černé Desné" loading="lazy" decoding="async">
          </div>
          <h3 class="surrounding-card-title">VODOPÁDY NA ČERNÉ DESNÉ</h3>
        </div>
        
        <!-- Karta 2 -->
        <div class="surrounding-card">
          <div class="surrounding-card-img-wrap">
            <img src="/Uvodni stranka/Rozhledna Stepanka.webp" alt="Rozhledna Štěpánka" loading="lazy" decoding="async">
          </div>
          <h3 class="surrounding-card-title">ROZHLEDNA ŠTĚPÁNKA</h3>
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

  <!-- CTA SEKCE (1:1 REPLIKA DLE SVG PŘEDLOHY) -->
  <section class="cta-section">
    <div class="cta-inner">
      <h2 class="cta-title">Dopřejte si zasloužený<br>odpočinek v Jizerských horách</h2>
      <button class="btn btn-cta" id="cta-booking-btn">Rezervovat pobyt</button>
    </div>
  </section>

  <!-- ZÁPATÍ (FOOTER) - 1:1 REPLIKA DLE SVG PŘEDLOHY -->
  <footer class="site-footer" id="kontakt">
    <div class="footer-contour-bg">
      <img src="/Decoration/Dekorace footer.png" alt="" aria-hidden="true" loading="lazy" decoding="async">
    </div>

    <div class="footer-inner">
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
            <li><a href="#about">O nás</a></li>
            <li><a href="#pokoje">Ubytování</a></li>
            <li><a href="#sluzby">Stravování</a></li>
            <li><a href="#sluzby">Skupinové akce</a></li>
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

// Event listenery pro interaktivitu
const bookingAction = () => {
  alert('Rezervační systém bude spuštěn v dalším kroku.');
};

document.querySelector('#booking-btn').addEventListener('click', bookingAction);
document.querySelector('#cta-booking-btn').addEventListener('click', bookingAction);
document.querySelector('#promo-booking-btn').addEventListener('click', bookingAction);

document.querySelector('#rooms-btn').addEventListener('click', () => {
  document.querySelector('#pokoje').scrollIntoView({ behavior: 'smooth' });
});

document.querySelector('#scroll-btn').addEventListener('click', () => {
  document.querySelector('#ubytovani').scrollIntoView({ behavior: 'smooth' });
});

document.querySelector('#about-more-btn').addEventListener('click', () => {
  alert('Detailní informace o ubytování se připravují.');
});

document.querySelector('#rooms-all-btn').addEventListener('click', () => {
  alert('Seznam všech pokojů se připravuje.');
});

document.querySelector('#service-restaurant-btn').addEventListener('click', () => {
  alert('Jídelní lístek se připravuje.');
});

document.querySelector('#service-events-btn').addEventListener('click', () => {
  alert('Možnosti firemních akcí a svateb se připravují.');
});

document.querySelector('#surroundings-more-btn').addEventListener('click', () => {
  alert('Tipy na výlety v okolí se připravují.');
});

// Autoplay, zpomalení přehrávání na 85 % a inteligentní IntersectionObserver pro úsporu paměti (RAM, CPU, GPU)
const heroVideo = document.querySelector('.hero-video');
const heroSection = document.querySelector('.hero-section');

if (heroVideo) {
  heroVideo.playbackRate = 0.85;
  heroVideo.addEventListener('loadedmetadata', () => {
    heroVideo.playbackRate = 0.85;
  });
  heroVideo.play().catch(err => {
    console.log('Autoplay fallback initialized:', err);
  });

  // Inteligentní pozastavení videa při odscrollování mimo Hero sekci
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
    }, {
      threshold: 0.05 // Video se pozastaví až při kompletním opuštění Hero sekce
    });

    videoObserver.observe(heroSection);
  }
}

// --- INTERAKTIVNÍ INFINITY SLIDER PRO RECENZE ---
const reviewsTrack = document.getElementById('reviews-track');
const reviewsViewport = document.getElementById('reviews-viewport');
const prevBtn = document.getElementById('reviews-prev');
const nextBtn = document.getElementById('reviews-next');

if (reviewsTrack && reviewsViewport) {
  const originalCards = Array.from(reviewsTrack.children);
  const totalOriginal = originalCards.length;

  // Klonování pro plynulý infinite loop
  originalCards.forEach(card => {
    const cloneEnd = card.cloneNode(true);
    reviewsTrack.appendChild(cloneEnd);
  });
  originalCards.forEach(card => {
    const cloneStart = card.cloneNode(true);
    reviewsTrack.insertBefore(cloneStart, reviewsTrack.firstChild);
  });

  const allCards = Array.from(reviewsTrack.children);
  let currentIndex = totalOriginal; // Začínáme na originálním prvním prvku

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

  // Inicializace pozice bez animace
  updatePosition(false);

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

  const slideNext = () => {
    currentIndex++;
    updatePosition(true);
  };

  const slidePrev = () => {
    currentIndex--;
    updatePosition(true);
  };

  if (nextBtn) nextBtn.addEventListener('click', slideNext);
  if (prevBtn) prevBtn.addEventListener('click', slidePrev);

  // Dragging / Swiping (Myš i Touch)
  let startX = 0;
  let isDragging = false;

  const getPositionX = (e) => (e.type.includes('mouse') ? e.pageX : e.touches[0].clientX);

  const dragStart = (e) => {
    isDragging = true;
    startX = getPositionX(e);
    reviewsTrack.style.transition = 'none';
    reviewsViewport.classList.add('is-dragging');
  };

  const dragMove = (e) => {
    if (!isDragging) return;
    const currentX = getPositionX(e);
    const diff = currentX - startX;
    const step = getCardStep();
    reviewsTrack.style.transform = `translateX(-${currentIndex * step - diff}px)`;
  };

  const dragEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    reviewsViewport.classList.remove('is-dragging');
    const endX = e.type.includes('mouse') ? e.pageX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : startX);
    const diff = endX - startX;

    if (diff < -50) {
      slideNext();
    } else if (diff > 50) {
      slidePrev();
    } else {
      updatePosition(true);
    }
  };

  reviewsViewport.addEventListener('mousedown', dragStart);
  reviewsViewport.addEventListener('mousemove', dragMove);
  reviewsViewport.addEventListener('mouseup', dragEnd);
  reviewsViewport.addEventListener('mouseleave', () => {
    if (isDragging) dragEnd({ pageX: startX, type: 'mouse' });
  });

  reviewsViewport.addEventListener('touchstart', dragStart, { passive: true });
  reviewsViewport.addEventListener('touchmove', dragMove, { passive: true });
  reviewsViewport.addEventListener('touchend', dragEnd);
}
