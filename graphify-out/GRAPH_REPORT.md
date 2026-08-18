# Graph Report - Hotel u mustku  (2026-08-18)

## Corpus Check
- 45 files · ~163,701 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 705 nodes · 1448 edges · 56 communities (38 shown, 18 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a06762b2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.js
- supabaseClient.js
- AdminDashboard.js
- Výlety autem — SEO texty
- BookingSystem
- AdminCenik.js
- SEO-ROADMAP.md
- CLAUDE.md — projektová dokumentace
- Okolí (Aktivity) Page
- Pravidla a pokyny pro tlačítka a responzivitu v projektu Hotel u Můstku
- Hotel u Můstků — web a rezervační systém
- package.json
- .agents/SEO-ROADMAP.md
- AdminRucniRezervace.js
- AdminDostupnost.js
- supabase-novy-projekt.sql
- Turistika — SEO texty
- SEO & Copywriting kontext — Hotel U Můstků
- Cyklistika — SEO texty
- FÁZE 7 — Rychlost a přístupnost ✅ UZAVŘENO
- CO DĚLAT PŘÍŠTĚ
- FÁZE 3 — Obsah 🟡
- FÁZE 4 — Copywriting ✅
- supabase-cenik.sql
- FÁZE 1 — Migrace ze starého webu 🟡
- FÁZE 2 — Technický základ ✅
- qrPayment.js
- 20260725_init_reservation_schema.sql
- .claude/CLAUDE.md
- graphify
- nasadit.sh
- vetev.sh
- CLAUDE.md — sekce Graphify
- discount_codes
- SEO-CONTEXT.md
- Výlety v zimě — SEO texty
- public.aktuality
- src/style.css (Global Stylesheet)
- public.blocked_dates
- public.cenik_ceny
- public.cenik_ceny_pokoj
- public.cenik_nastaveni
- public.cenik_sezony
- public.contact_messages
- public.disabled_rooms
- public.discount_codes
- public.reviews
- public.room_prices
- public.reservations
- public.reservations

## God Nodes (most connected - your core abstractions)
1. `BookingSystem` - 43 edges
2. `AdminDashboard` - 31 edges
3. `route()` - 31 edges
4. `CLAUDE.md — projektová dokumentace` - 22 edges
5. `initInteractivity()` - 18 edges
6. `calculateReservationPrice()` - 18 edges
7. `formatCzechPrice()` - 16 edges
8. `Výlety autem — SEO texty` - 15 edges
9. `obrazovkaCenyTabulka()` - 14 edges
10. `renderRucniRezervaceModal()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `SEO Fáze 6 — Lokální SEO (vyřazeno)` --references--> `index.html — úvodní stránka`  [INFERRED]
  SEO-ROADMAP.md → index.html
- `src/style.css (Global Stylesheet)` --implements--> `Button Design System`  [INFERRED]
  okoli.html → .agents/AGENTS.md
- `src/style.css (Global Stylesheet)` --implements--> `Hero Section System`  [INFERRED]
  okoli.html → .agents/AGENTS.md
- `src/style.css (Global Stylesheet)` --implements--> `Pravidlo pro výšku okna`  [INFERRED]
  okoli.html → .agents/AGENTS.md
- `index.html — úvodní stránka` --references--> `Cookie lišta a GA4 gating`  [INFERRED]
  index.html → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Aktuality — čtení, nahrávání, storage** — aktuality_html, src_main, table_aktuality, netlify_functions_upload_news_image, storage_aktuality_images, src_components_admindashboard [EXTRACTED 0.90]
- **Výpočet ceny rezervace přes vrstvy** — src_components_bookingsystem, src_utils_pricing, src_utils_cenik, table_cenik_ceny, table_cenik_ceny_pokoj, table_cenik_sezony, table_cenik_nastaveni, concept_price_lookup_order [EXTRACTED 0.90]
- **Obsahová pipeline pro /okoli — 4 kategorie z markdown textů** — aktivity_popisky_texty_turistika, aktivity_popisky_texty_cyklistika, aktivity_popisky_texty_zima, aktivity_popisky_texty_vylety_autem, okoli, agents_seo_roadmap [EXTRACTED 0.90]
- **SEO governance — pravidla, roadmapa a fakta o hotelu** — agents_seo_context, agents_seo_roadmap, faktica_zakaz, faq_zakaz, cenik_2026, storno_podminky [EXTRACTED 0.95]
- **Sdílená HTML kostra stránek (nav, header, styly, schema)** — okoli, podminky, stravovani, ubytovani, site_header_component, src_style, schema_hotel_jsonld [EXTRACTED 0.95]
- **Tři nástroje na zavírání provozu** — table_blocked_dates, table_disabled_rooms, src_components_admindostupnost, src_utils_cenik [EXTRACTED 0.95]

## Communities (56 total, 18 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.06
Nodes (72): isPreRenderedMatch — kontrola shody, fetchCenik(), fetchRoomPrices(), formatGDPRName(), getStoredNewsItems(), reorderNewsItem(), saveContactMessage(), saveStoredReview() (+64 more)

### Community 1 - "supabaseClient.js"
Cohesion: 0.06
Nodes (50): Pravidlo — date_to je výlučné, AdminDashboard, formatCzechDateStr(), getDiscountValidityDisplay(), ALLOWED_SUPABASE_COLUMNS, decrementDiscountCodeUsage(), DEFAULT_REVIEWS, deleteStoredBlockedDate() (+42 more)

### Community 2 - "AdminDashboard.js"
Cohesion: 0.08
Nodes (54): this.castka(klic) v BookingSystem, Živé procento zálohy, Minimum dvě noci (hasValidDates), posunDatum(), zobrazRozsahBlokace(), isDummyIdNumber(), isDummyName(), isValidEmail() (+46 more)

### Community 3 - "Výlety autem — SEO texty"
Cohesion: 0.13
Nodes (15): 10. Funpark a Lunapark Babylon v Liberci, 11. Státní zámek Sychrov, 12. Výletní restaurace Obří sud v Lázních Libverda, 13. Rozhledna Královka s restaurací, 14. Muzeum skla a bižuterie v Jablonci nad Nisou, 1. Bobová dráha Janov nad Nisou, 2. Ještěd v Liberci, 3. Rozhledna Bramberk s restaurací (+7 more)

### Community 4 - "BookingSystem"
Cohesion: 0.14
Nodes (3): BookingSystem, formatCzechDateStr(), getTodayDateString()

### Community 5 - "AdminCenik.js"
Cohesion: 0.07
Nodes (60): Pořadí hledání ceny, Zákaz upsertu na room_prices, Víkendový příplatek, aktivniSezona(), bindCenikModal(), dialogHtml(), escapuj(), hodnotaKategorie() (+52 more)

### Community 6 - "SEO-ROADMAP.md"
Cohesion: 0.05
Nodes (39): public/404.html, public/llms.txt, public/_redirects, public/robots.txt, public/sitemap.xml, SEO Fáze 1 — Migrace ze starého webu, SEO Fáze 4 — Copywriting, 1.1 Přesměrování ✅ (+31 more)

### Community 7 - "CLAUDE.md — projektová dokumentace"
Cohesion: 0.07
Nodes (35): admin.html — recepční portál, akce.html — skupinové akce, aktuality.html — aktuality, CLAUDE.md — projektová dokumentace, Cookie lišta a GA4 gating, spustHeroVideo() — podmíněné spuštění hero videa, Kapacita pokojů (17. 8. 2026), VITE_ prefix pro klientské env proměnné (+27 more)

### Community 8 - "Okolí (Aktivity) Page"
Cohesion: 0.23
Nodes (12): Faktické zákazy (bezbariérovost, trampolína), Hlavní navigační stránky, Okolí (Aktivity) Page, BreadcrumbList JSON-LD, FAQPage schema (okoli), FAQPage schema (ubytování), Hotel JSON-LD schema, HotelRoom JSON-LD (Standard/Nadstandard) (+4 more)

### Community 9 - "Pravidla a pokyny pro tlačítka a responzivitu v projektu Hotel u Můstku"
Cohesion: 0.10
Nodes (21): 📱 1. Mobilní verze (<768px), 1. Pixelový `min-height` nesmí nikdy přesáhnout okno, 1. Rozměry a typografie, 2. Konzistentní boční padding (Postranní odsazení), 2. Rozměry počítané ze šířky musí mít strop podle výšky, 📱 2. Tabletová verze (768px - 1028.98px), 💻 3. Desktopová verze (1029px+), 3. Obsah v hero se nepozicuje pevnými pixely shora (+13 more)

### Community 10 - "Hotel u Můstků — web a rezervační systém"
Cohesion: 0.10
Nodes (20): 1. Statické HTML a JS šablony se musí shodovat, 2. `date_to` je vždy VÝLUČNÉ, 3. Build na Netlify stojí na `netlify.toml`, 4. Ceny se počítají za osobu a noc, ne za pokoj, 5. Klíče nesmí do prohlížeče, 6. Nic těžkého do Supabase Storage, 6b. Aktuality se do HTML nezapisují, 7. Migrace se spouštějí ručně (+12 more)

### Community 11 - "package.json"
Cohesion: 0.12
Nodes (16): dependencies, qrcode, @supabase/supabase-js, devDependencies, vite, name, private, scripts (+8 more)

### Community 12 - ".agents/SEO-ROADMAP.md"
Cohesion: 0.17
Nodes (10): FÁZE 0 — Přístupy a základna měření ✅, FÁZE 5 — Optimalizace pro AI vyhledávače ✅ (co jde udělat před spuštěním), FÁZE 6 — Lokální SEO ⏹️ VYŘAZENO ZE ZAKÁZKY, FÁZE 8 — Měření ✅, JAK POZNÁME, ŽE JE TO 100 %, ⚠️ Jak číst nezaškrtnuté položky, 🔁 Pravidelná údržba — NENÍ TO CHECKLIST, PRŮBĚH (+2 more)

### Community 13 - "AdminRucniRezervace.js"
Cohesion: 0.23
Nodes (21): bindRucniRezervaceModal(), CELY_HOTEL, dnesStr(), escapuj(), formatCzechDateStr(), kapacitaHotelu(), MESICE, obsazenostDne() (+13 more)

### Community 14 - "AdminDostupnost.js"
Cohesion: 0.25
Nodes (16): bindDostupnostModal(), dnesStr(), escapuj(), formatCzechDateStr(), MESICE, odjezdVDen(), pocetNoci(), posunDatum() (+8 more)

### Community 15 - "supabase-novy-projekt.sql"
Cohesion: 0.15
Nodes (12): public.aktuality, public.blocked_dates, public.cenik_ceny, public.cenik_ceny_pokoj, public.cenik_nastaveni, public.cenik_sezony, public.contact_messages, public.disabled_rooms (+4 more)

### Community 16 - "Turistika — SEO texty"
Cohesion: 0.17
Nodes (12): 10. Rozhledna Štěpánka, 11. Vodopády Černé Desné, 1. Protržená přehrada na Bílé Desné, 2. Vyhlídka Špička na Malém Špičáku, 3. Vodní nádrž Souš, 4. Mumlavské vodopády v Harrachově, 5. Lanový park Bedřichov, 6. Rašeliniště Jizerky (+4 more)

### Community 17 - "SEO & Copywriting kontext — Hotel U Můstků"
Cohesion: 0.20
Nodes (10): 1. Co je projekt, 2. Cílová skupina (priorita shora dolů), 3. USP — o co se copy vždycky opírá, 4. Fakta pro texty (nikdy si nevymýšlet jiná), 5. Stav SEO — co chybí (audit k 31. 7. 2026), 6. Copy pravidla, 7. Kde jsou zdrojová data, Fakturační údaje — ověřeno v ARES 1. 8. 2026 (+2 more)

### Community 18 - "Cyklistika — SEO texty"
Cohesion: 0.20
Nodes (10): 1. Singltrek pod Smrkem, 2. Trasa kolem vodní nádrže Souš, 3. Cyklostezka Járy Cimrmana č. 3019, 4. Hřebenová cyklotrasa na Smědavu, 5. Bikepark Tanvaldský Špičák, 6. Rozhledna Štěpánka na kole, 7. Jizerská magistrála pro cyklisty, 8. Cyklotrasa údolím řeky Kamenice (+2 more)

### Community 19 - "FÁZE 7 — Rychlost a přístupnost ✅ UZAVŘENO"
Cohesion: 0.25
Nodes (8): 7.0 Finální měření — PageSpeed Insights, 31. 7. 2026, 23:05, 7.1 Velké soubory ✅, 7.2 LCP Optimalizace ✅ (Vyřešeno 31. 7. 2026), 7.3 Alt texty ✅ *(1. 8. 2026)*, 7.4 Dotykové plochy tlačítek ✅ *(1. 8. 2026)*, 7.5 Přístupnost lightboxu ✅ *(1. 8. 2026)*, FÁZE 7 — Rychlost a přístupnost ✅ UZAVŘENO, ⛔ Rozhodnutí: dál se rychlostí nezabýváme *(Ondřej, 31. 7. 2026)*

### Community 20 - "CO DĚLAT PŘÍŠTĚ"
Cohesion: 0.25
Nodes (8): A) Co jde dodělat TEĎ, bez domény — dokopání do finále, B) Co jde až po přepnutí domény, CO DĚLAT PŘÍŠTĚ, Do Antigravity — jeden prompt, Hotovo — už neřešit, Poslední úkol — konverzní událost v GA4, Poučení z průběhu, Stav k 1. 8. 2026

### Community 21 - "FÁZE 3 — Obsah 🟡"
Cohesion: 0.33
Nodes (6): 3.1 Stránky výletů ✅, 3.2 Cookie lišta a právní stránky ✅, 3.3 Co na webu už je jako sekce (nové stránky netřeba), 3.4 Duplicitní obsah ✅, 3.5 Podstránky pokojů ⬜, FÁZE 3 — Obsah 🟡

### Community 22 - "FÁZE 4 — Copywriting ✅"
Cohesion: 0.33
Nodes (6): 4.0 Oprava faktických chyb ✅, 4.1 Úvodní stránka ✅, 4.2 Podstránky ✅, 4.3 Mapa klíčových slov, FÁZE 4 — Copywriting ✅, Kontrola meta dat — 1. 8. 2026

### Community 23 - "supabase-cenik.sql"
Cohesion: 0.53
Nodes (5): public, public.cenik_ceny, public.cenik_ceny_pokoj, public.cenik_nastaveni, public.cenik_sezony

### Community 24 - "FÁZE 1 — Migrace ze starého webu 🟡"
Cohesion: 0.40
Nodes (5): 1.1 Přesměrování ✅, 1.2 Napojení domény 🔒 BLOKOVÁNO, 1.3 Po nasazení 🔒 BLOKOVÁNO doménou, FÁZE 1 — Migrace ze starého webu 🟡, Kotvy ✅

### Community 25 - "FÁZE 2 — Technický základ ✅"
Cohesion: 0.40
Nodes (5): 2.1–2.5 Meta tagy a soubory ✅, 2.6 Strukturovaná data ✅, 2.7 Kontrola 🟡, 2.8 Sjednocení názvu ✅, FÁZE 2 — Technický základ ✅

### Community 26 - "qrPayment.js"
Cohesion: 0.50
Nodes (3): BANK_ACCOUNT, buildSpaydString(), generateQrCodeDataUrl()

### Community 27 - "20260725_init_reservation_schema.sql"
Cohesion: 0.60
Nodes (4): blocks, reservations, rooms, settings

### Community 29 - "graphify"
Cohesion: 0.50
Nodes (3): GRAPHIFY_QUERY_LOG_ENABLE, /Users/ondrejzeman/.local/bin/graphify-mcp, graphify

### Community 34 - "SEO-CONTEXT.md"
Cohesion: 0.50
Nodes (4): Ceník 2026, Zákaz nových FAQ sekcí, Obchodní podmínky Page, Storno podmínky

### Community 40 - "Výlety v zimě — SEO texty"
Cohesion: 0.18
Nodes (11): 10. Funpark a Lunapark Babylon v Liberci, 1. Ski areál Černá Říčka v Desné, 2. Jizerská magistrála pro běžkaře, 3. Aquapark a wellness centrum Babylon Liberec, 4. Ještěd, 5. Skiareál Jizerky – Tanvaldský Špičák, 6. Muzeum skla a bižuterie v Jablonci nad Nisou, 7. Dinopark Liberec (+3 more)

### Community 42 - "src/style.css (Global Stylesheet)"
Cohesion: 0.70
Nodes (4): Button Design System, Hero Section System, src/style.css (Global Stylesheet), Pravidlo pro výšku okna

## Knowledge Gaps
- **241 isolated node(s):** `/Users/ondrejzeman/.local/bin/graphify-mcp`, `GRAPHIFY_QUERY_LOG_ENABLE`, `nasadit.sh script`, `NETLIFY_AUTH_TOKEN`, `POVOLENE_TYPY` (+236 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `src/style.css (Global Stylesheet)` connect `src/style.css (Global Stylesheet)` to `Okolí (Aktivity) Page`, `main.js`, `SEO-CONTEXT.md`?**
  _High betweenness centrality (0.292) - this node is a cross-community bridge._
- **Why does `Okolí (Aktivity) Page` connect `Okolí (Aktivity) Page` to `src/style.css (Global Stylesheet)`, `.agents/SEO-ROADMAP.md`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `index.html — úvodní stránka` connect `CLAUDE.md — projektová dokumentace` to `main.js`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **What connects `/Users/ondrejzeman/.local/bin/graphify-mcp`, `GRAPHIFY_QUERY_LOG_ENABLE`, `nasadit.sh script` to the rest of the system?**
  _241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06049382716049383 - nodes in this community are weakly interconnected._
- **Should `supabaseClient.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05569620253164557 - nodes in this community are weakly interconnected._
- **Should `AdminDashboard.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._