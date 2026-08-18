# Graph Report - Hotel u mustku  (2026-08-18)

## Corpus Check
- 43 files · ~159,693 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 602 nodes · 1272 edges · 34 communities (28 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `afe2771b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.js
- .agents/SEO-ROADMAP.md
- pricing.js
- BookingSystem
- AdminCenik.js
- emailService.js
- AdminDashboard.js
- package.json
- AdminDostupnost.js
- supabase-novy-projekt.sql
- send-email.js
- supabase-cenik.sql
- qrPayment.js
- 20260725_init_reservation_schema.sql
- nasadit.sh
- vetev.sh
- discount_codes
- public.reservations
- SEO-ROADMAP.md
- AdminDashboard
- Pravidla a pokyny pro tlačítka a responzivitu v projektu Hotel u Můstku
- Hotel u Můstků — web a rezervační systém
- Výlety autem — SEO texty
- Turistika — SEO texty
- Výlety v zimě — SEO texty
- SEO & Copywriting kontext — Hotel U Můstků
- Cyklistika — SEO texty
- graphify
- .claude/CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `BookingSystem` - 43 edges
2. `AdminDashboard` - 31 edges
3. `route()` - 30 edges
4. `calculateReservationPrice()` - 18 edges
5. `initInteractivity()` - 17 edges
6. `formatCzechPrice()` - 16 edges
7. `Výlety autem — SEO texty` - 15 edges
8. `obrazovkaCenyTabulka()` - 14 edges
9. `getHeaderHTML()` - 14 edges
10. `getFooterHTML()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `obrazovkaCenyTabulka()` --calls--> `vikendovyPriplatek()`  [EXTRACTED]
  src/components/AdminCenik.js → src/utils/cenik.js
- `obnovCenik()` --calls--> `fetchCenik()`  [EXTRACTED]
  src/components/AdminCenik.js → src/lib/supabaseClient.js
- `renderRucniRezervaceModal()` --calls--> `formatCzechPrice()`  [EXTRACTED]
  src/components/AdminRucniRezervace.js → src/utils/pricing.js
- `bindRucniRezervaceModal()` --calls--> `saveStoredReservation()`  [EXTRACTED]
  src/components/AdminRucniRezervace.js → src/lib/supabaseClient.js
- `renderRoomBreakdownItem()` --calls--> `getStoredDisabledRooms()`  [EXTRACTED]
  src/main.js → src/lib/supabaseClient.js

## Import Cycles
- None detected.

## Communities (34 total, 6 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.07
Nodes (65): fetchCenik(), fetchRoomPrices(), formatGDPRName(), saveContactMessage(), saveStoredReview(), app, CATEGORIES_DATA, closePromoCodeModal() (+57 more)

### Community 1 - ".agents/SEO-ROADMAP.md"
Cohesion: 0.04
Nodes (48): 1.1 Přesměrování ✅, 1.2 Napojení domény 🔒 BLOKOVÁNO, 1.3 Po nasazení 🔒 BLOKOVÁNO doménou, 2.1–2.5 Meta tagy a soubory ✅, 2.6 Strukturovaná data ✅, 2.7 Kontrola 🟡, 2.8 Sjednocení názvu ✅, 3.1 Stránky výletů ✅ (+40 more)

### Community 2 - "pricing.js"
Cohesion: 0.08
Nodes (46): prekryvajiciObdobi(), bindRucniRezervaceModal(), dnesStr(), escapuj(), formatCzechDateStr(), MESICE, obsazenostDne(), pocetNoci() (+38 more)

### Community 3 - "BookingSystem"
Cohesion: 0.14
Nodes (3): BookingSystem, formatCzechDateStr(), getTodayDateString()

### Community 4 - "AdminCenik.js"
Cohesion: 0.12
Nodes (37): aktivniSezona(), bindCenikModal(), dialogHtml(), escapuj(), hodnotaKategorie(), hodnotaPokoje(), kartaVolby(), KATEGORIE (+29 more)

### Community 5 - "emailService.js"
Cohesion: 0.22
Nodes (21): generateEmail1ReceptionNotification(), generateEmail1RequestReceived(), generateEmail2ApprovalAndPaymentRequest(), generateEmail3FinalConfirmation(), generateEmailCancellation(), generateEmailContactNotification(), generateEmailNewReviewNotification(), generateEmailPaymentExpired() (+13 more)

### Community 6 - "AdminDashboard.js"
Cohesion: 0.08
Nodes (55): isDummyIdNumber(), isDummyName(), isValidEmail(), isValidPhone(), ALLOWED_SUPABASE_COLUMNS, decrementDiscountCodeUsage(), DEFAULT_REVIEWS, deleteStoredBlockedDate() (+47 more)

### Community 7 - "package.json"
Cohesion: 0.12
Nodes (16): dependencies, qrcode, @supabase/supabase-js, devDependencies, vite, name, private, scripts (+8 more)

### Community 8 - "AdminDostupnost.js"
Cohesion: 0.28
Nodes (14): bindDostupnostModal(), dnesStr(), escapuj(), formatCzechDateStr(), MESICE, pocetNoci(), posunDatum(), prazdnyPrehled() (+6 more)

### Community 9 - "supabase-novy-projekt.sql"
Cohesion: 0.15
Nodes (12): public.aktuality, public.blocked_dates, public.cenik_ceny, public.cenik_ceny_pokoj, public.cenik_nastaveni, public.cenik_sezony, public.contact_messages, public.disabled_rooms (+4 more)

### Community 10 - "send-email.js"
Cohesion: 0.24
Nodes (9): handler(), jeEmail(), ODESILATELE, odpoved(), POVOLENE_TYPY, handler(), odpoved(), POVOLENE_TYPY (+1 more)

### Community 11 - "supabase-cenik.sql"
Cohesion: 0.53
Nodes (5): public, public.cenik_ceny, public.cenik_ceny_pokoj, public.cenik_nastaveni, public.cenik_sezony

### Community 12 - "qrPayment.js"
Cohesion: 0.50
Nodes (3): BANK_ACCOUNT, buildSpaydString(), generateQrCodeDataUrl()

### Community 13 - "20260725_init_reservation_schema.sql"
Cohesion: 0.60
Nodes (4): blocks, reservations, rooms, settings

### Community 23 - "SEO-ROADMAP.md"
Cohesion: 0.06
Nodes (32): 1.1 Přesměrování ✅, 1.2 Napojení domény ⬜, 1.3 Po nasazení ⬜, 2.1–2.5 Meta tagy a soubory ✅, 2.6 Strukturovaná data ✅, 2.7 Kontrola ⬜, 2.8 Sjednocení názvu ✅, 3.1 Stránky výletů ✅ (+24 more)

### Community 24 - "AdminDashboard"
Cohesion: 0.16
Nodes (6): AdminDashboard, formatCzechDateStr(), getDiscountValidityDisplay(), groupContiguousDateRanges(), posunDatum(), zobrazRozsahBlokace()

### Community 25 - "Pravidla a pokyny pro tlačítka a responzivitu v projektu Hotel u Můstku"
Cohesion: 0.09
Nodes (21): 📱 1. Mobilní verze (<768px), 1. Pixelový `min-height` nesmí nikdy přesáhnout okno, 1. Rozměry a typografie, 2. Konzistentní boční padding (Postranní odsazení), 2. Rozměry počítané ze šířky musí mít strop podle výšky, 📱 2. Tabletová verze (768px - 1028.98px), 💻 3. Desktopová verze (1029px+), 3. Obsah v hero se nepozicuje pevnými pixely shora (+13 more)

### Community 26 - "Hotel u Můstků — web a rezervační systém"
Cohesion: 0.10
Nodes (20): 1. Statické HTML a JS šablony se musí shodovat, 2. `date_to` je vždy VÝLUČNÉ, 3. Build na Netlify stojí na `netlify.toml`, 4. Ceny se počítají za osobu a noc, ne za pokoj, 5. Klíče nesmí do prohlížeče, 6. Nic těžkého do Supabase Storage, 6b. Aktuality se do HTML nezapisují, 7. Migrace se spouštějí ručně (+12 more)

### Community 27 - "Výlety autem — SEO texty"
Cohesion: 0.12
Nodes (15): 10. Funpark a Lunapark Babylon v Liberci, 11. Státní zámek Sychrov, 12. Výletní restaurace Obří sud v Lázních Libverda, 13. Rozhledna Královka s restaurací, 14. Muzeum skla a bižuterie v Jablonci nad Nisou, 1. Bobová dráha Janov nad Nisou, 2. Ještěd v Liberci, 3. Rozhledna Bramberk s restaurací (+7 more)

### Community 28 - "Turistika — SEO texty"
Cohesion: 0.15
Nodes (12): 10. Rozhledna Štěpánka, 11. Vodopády Černé Desné, 1. Protržená přehrada na Bílé Desné, 2. Vyhlídka Špička na Malém Špičáku, 3. Vodní nádrž Souš, 4. Mumlavské vodopády v Harrachově, 5. Lanový park Bedřichov, 6. Rašeliniště Jizerky (+4 more)

### Community 29 - "Výlety v zimě — SEO texty"
Cohesion: 0.17
Nodes (11): 10. Funpark a Lunapark Babylon v Liberci, 1. Ski areál Černá Říčka v Desné, 2. Jizerská magistrála pro běžkaře, 3. Aquapark a wellness centrum Babylon Liberec, 4. Ještěd, 5. Skiareál Jizerky – Tanvaldský Špičák, 6. Muzeum skla a bižuterie v Jablonci nad Nisou, 7. Dinopark Liberec (+3 more)

### Community 30 - "SEO & Copywriting kontext — Hotel U Můstků"
Cohesion: 0.18
Nodes (10): 1. Co je projekt, 2. Cílová skupina (priorita shora dolů), 3. USP — o co se copy vždycky opírá, 4. Fakta pro texty (nikdy si nevymýšlet jiná), 5. Stav SEO — co chybí (audit k 31. 7. 2026), 6. Copy pravidla, 7. Kde jsou zdrojová data, Fakturační údaje — ověřeno v ARES 1. 8. 2026 (+2 more)

### Community 31 - "Cyklistika — SEO texty"
Cohesion: 0.18
Nodes (10): 1. Singltrek pod Smrkem, 2. Trasa kolem vodní nádrže Souš, 3. Cyklostezka Járy Cimrmana č. 3019, 4. Hřebenová cyklotrasa na Smědavu, 5. Bikepark Tanvaldský Špičák, 6. Rozhledna Štěpánka na kole, 7. Jizerská magistrála pro cyklisty, 8. Cyklotrasa údolím řeky Kamenice (+2 more)

## Knowledge Gaps
- **206 isolated node(s):** `/Users/ondrejzeman/.local/bin/graphify-mcp`, `nasadit.sh script`, `NETLIFY_AUTH_TOKEN`, `POVOLENE_TYPY`, `ODESILATELE` (+201 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BookingSystem` connect `BookingSystem` to `main.js`, `AdminDashboard.js`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `AdminDashboard` connect `AdminDashboard` to `main.js`, `AdminDashboard.js`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `MOCK_ROOMS` connect `AdminDashboard.js` to `main.js`, `pricing.js`, `AdminCenik.js`, `emailService.js`, `AdminDostupnost.js`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `/Users/ondrejzeman/.local/bin/graphify-mcp`, `nasadit.sh script`, `NETLIFY_AUTH_TOKEN` to the rest of the system?**
  _206 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06773211567732115 - nodes in this community are weakly interconnected._
- **Should `.agents/SEO-ROADMAP.md` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `pricing.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07755102040816327 - nodes in this community are weakly interconnected._