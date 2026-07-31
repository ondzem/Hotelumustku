# SEO Roadmapa — Hotel U Můstků

**Poslední aktualizace: 31. 7. 2026**

Odškrtávej `[ ]` → `[x]`. Co je hotové, je označené ✅.

**Způsob práce:** prompty do Antigravity IDE. Claude čte složku, kontroluje výsledek a píše další prompt.

**Jazyk:** zatím jen čeština. DE/PL až úplně nakonec.

---

## PRŮBĚH

| Fáze | Stav |
|---|---|
| 0 — Přístupy a měření | ✅ hotovo |
| 1 — Migrace ze starého webu | 🟡 rozděláno (doména zatím nepřepnutá) |
| 2 — Technický základ | ✅ hotovo |
| 3 — Obsah | ✅ hotovo (mimo podstránky pokojů) |
| 4 — Copywriting | ⬜ **další na řadě** |
| 5 — AI / GEO | 🟡 rozděláno |
| 6 — Lokální SEO | ⏹️ vyřazeno ze zakázky |
| 7 — Rychlost a přístupnost | ⬜ nezačato |
| 8 — Měření | 🟡 rozděláno |

---

# FÁZE 0 — Přístupy a základna měření ✅

- [x] **Google Search Console** — property `umustku.cz` typu Doména, ověřená přes TXT záznam u Forpsi
- [x] **Google Analytics 4** — property „Hotel u můstku", měřicí ID `G-X62MWWL0FV`
- [x] **GA4 propojená se Search Console** — Správce → Product links → Search Console links
- [x] **Ověřeno, jestli měl starý web analytiku** — neměl. Žádná GA, GTM, Sklik ani Facebook Pixel. Není co zachraňovat.
- [x] **Zjištěno, jestli existuje Google Business Profile** — **existuje** a je funkční: „Hotel U Můstků", 4,4 ★, 87 recenzí, adresa i telefon vyplněné, spravuje `hotelumustku@gmail.com`
- [x] **Rozhodnutí: Business Profil neřešíme.** Profil je nárokovaný, má adresu, telefon a hodnocení — to podstatné funguje. Přístup nepotřebujeme, lokální SEO není součástí zakázky. *(rozhodnuto 31. 7. 2026)*
- [x] **Historická data z GSC** — **neexistují.** Klient nikdy Search Console nezaložil. Startujeme od nuly s novou property, data se sbírají od 31. 7. 2026.

---

# FÁZE 1 — Migrace ze starého webu 🟡

**Jak to funguje:** hodnota nesedí na starých PHP stránkách, sedí na doméně `umustku.cz`. Nový web nasadíš na tu samou doménu a 301 přesměrováním řekneš Googlu, kam se obsah posunul.

## 1.1 Přesměrování ✅

- [x] Opraven `public/_redirects` — Netlify nematchuje query parametry uvnitř cesty, původní zápis `/cz/index.php?stranka=uvod` byl neplatný
- [x] Doplněna přesměrování pro `stranka=novinky`, `stranka=kniha`, `stranka=mapy`, `/de/*`
- [x] Odstraněn catch-all `/*  /index.html  200` (dělal soft 404 z každé neexistující URL)
- [x] Vytvořena `public/404.html`
- [x] Přidány 301 z `.html` variant na hezké URL

### Kotvy ✅

- [x] Ověřeno, jaké `id` na webu existují: `#recenze` a `#o-nas` **ano**, `#cenik` a `#rezervace` **ne** (ceník i rezervace jsou uvnitř `/ubytovani` bez vlastní kotvy)
- [x] `stranka=kniha` → `/#recenze`
- [x] `stranka=cenik` a `stranka=rezervace` → `/ubytovani` (správné, obojí je na té stránce)

## 1.2 Napojení domény ⬜

**Zatím nedělat.** Až bude hotová Fáze 4 (copywriting).

- [ ] Netlify → Domain management → přidat `umustku.cz`
- [ ] `www.umustku.cz` → 301 na `umustku.cz` (jen jedna varianta smí být hlavní)
- [ ] Vynutit HTTPS
- [ ] V DNS u Forpsi změnit A záznam `umustku.cz` a `www` (dnes míří na `81.2.194.241`)
- [ ] Zkontrolovat záznam `novy.umustku.cz` — CNAME míří na `umstku.cz`, chybí tam písmeno „u"

## 1.3 Po nasazení ⬜

- [ ] V GSC odeslat `sitemap.xml`
- [ ] V GSC „Kontrola URL → Požádat o indexování" na hlavních stránkách
- [ ] Otestovat všechny staré URL, že skutečně skočí kam mají
- [ ] Ověřit, že `umustku.cz/nesmysl` vrací **404**, ne homepage
- [ ] Zkontrolovat `umustku.cz/robots.txt` a `umustku.cz/llms.txt` v prohlížeči
- [ ] Počítat s dočasným propadem pozic o 2–6 týdnů — je to normální

---

# FÁZE 2 — Technický základ ✅

## 2.1–2.5 Meta tagy a soubory ✅

- [x] `<link rel="canonical">` na všech stránkách
- [x] `public/robots.txt` — s odkazem na sitemap, AI crawlery záměrně povolené
- [x] `public/sitemap.xml`
- [x] `public/llms.txt` — kompletní přehled hotelu pro AI vyhledávače (ceník, vybavení, vzdálenosti, doprava, zimní uzavírka)
- [x] Smazána `meta keywords` (byla identická na všech stránkách)
- [x] Doplněno `og:url`, `og:locale`, `og:site_name`
- [x] Doplněny Twitter Card tagy
- [x] Každá stránka má vlastní `og:image` v absolutní URL

## 2.6 Strukturovaná data ✅

- [x] `Hotel` schema na všech stránkách — adresa, GPS, telefon, cenové rozpětí, 12 pokojů, psi vítáni, check-in/out, zakladatelé, 23× `amenityFeature`
- [x] `HotelRoom` + `Offer` pro obě kategorie pokojů na `/ubytovani`
- [x] `FAQPage` na `/okoli` (3 otázky, text doslova z HTML)
- [x] `BreadcrumbList` na všech podstránkách
- [x] `ItemList` + `TouristAttraction` na 4 stránkách výletů

**Záměrně nepřidáno:** `AggregateRating`. Google vyžaduje doložitelný zdroj hodnocení, recenze z knihy návštěv se nepočítají. Přidat až po nasbírání Google recenzí (Fáze 6).

## 2.7 Kontrola ⬜

Jde udělat až po nasazení na doménu.

- [ ] Všechny stránky přes **Google Rich Results Test** — 0 chyb
- [ ] Všechny stránky přes **Schema Markup Validator** — 0 chyb

## 2.8 Sjednocení názvu ✅

- [x] Web sjednocen na **„Hotel U Můstků"** (100 nahrazení) — sedí s Google Business Profilem
- [x] V JSON-LD ponecháno `alternateName: "Hotel u Můstku"`, aby Google spároval i starý tvar

---

# FÁZE 3 — Obsah 🟡

## 3.1 Stránky výletů ✅

Ve složce `Aktivity popisky/` bylo 35 kB hotových SEO textů, které nikde nebyly použité.

- [x] `/okoli/turistika` — 11 výletů
- [x] `/okoli/cyklistika` — 9 tras
- [x] `/okoli/zima` — 10 tipů
- [x] `/okoli/vylety-autem` — 14 cílů
- [x] Všech 44 textů v `src/main.js` jako `CATEGORIES_DATA`, zobrazení přes modal „Zjistit více" (**záměrné rozhodnutí**)
- [x] Napojení: `vite.config.js`, `_redirects`, `sitemap.xml`, odkazy z `/okoli`

**Poznámka:** texty se do stránky vloží až po kliknutí. Google je najde v JSON-LD, AI boti (nespouštějí JS) uvidí jen část. Rozhodnuto ponechat — je to záměr designu.

## 3.2 Cookie lišta a právní stránky ✅

- [x] Cookie lišta se třemi tlačítky (Přijmout vše / Odmítnout / Nastavení), volba v `localStorage`
- [x] **GA4 se spustí až po souhlasu** — skript odstraněn z HTML, načítá se funkcí `initGA4()`
- [x] `gdpr.html` — 399 slov, `noindex`, canonical
- [x] `cookies.html` — 255 slov, `noindex`, canonical
- [x] Odkazy v patičce fungují, „Nastavení" znovu otevře lištu
- [x] Obě stránky **nejsou** v sitemap (mají noindex — správně)

## 3.3 Co na webu už je jako sekce (nové stránky netřeba)

Ověřeno 31. 7. 2026:

| Obsah | Kde je |
|---|---|
| Ceník | sekce v `/ubytovani`, renderuje `main.js` (`room-breakdown`) |
| O nás | sekce `#o-nas` na úvodní stránce |
| Recenze | sekce `#recenze` na úvodní stránce („Co o nás říkají sami hosté?") |

## 3.4 Duplicitní obsah ✅

- [x] **Recenze** — na `index.html` zůstalo všech 47, na `ubytovani`, `stravovani` a `akce` po 4 tematicky vybraných + odkaz na `/#recenze`. Texty recenzí se nikde nezkracovaly, jen se snížil jejich počet na podstránkách.
- [x] **„Co vše můžete v okolí podniknout"** — odstraněno z `index`, `ubytovani` a `stravovani`, zůstalo jen na `/okoli`
- [x] **„Co dalšího nabízíme"** — jen na `index.html`
- [x] Opraven překlep „zaslouženýodpočinek" → „zasloužený odpočinek" na všech stránkách

## 3.5 Podstránky pokojů ⬜

Ve `public/pokoje/` leží fotky ~10 pokojů (Zen, Motýl, Mahagon, Standard P5–P12), po 7–10 fotkách. Nikde se nepoužívají.

- [ ] Rozhodnout, jestli je chceme jako samostatné stránky
- [ ] Cílové dotazy: „pokoj s balkónem Jizerské hory", „pokoj s výhledem Desná"

---

# FÁZE 4 — Copywriting ⬜

Nejdůležitější zbývající blok.

## 4.1 Pravidla

Primární cílovka jsou **senioři 60+**:
- krátké věty, jedna myšlenka na větu
- konkrétní čísla místo přídavných jmen („1,5 km po rovině", ne „nedaleko")
- žádné anglicismy (wellness, buyout, packages)
- telefonní číslo viditelně na každé stránce
- odpovídat na obavy dřív, než je host vysloví

## 4.2 Co přepsat

- [ ] **H1 na podstránkách** — dnes generické bez klíčových slov
  - `/ubytovani`: „Nabídka pokojů" → „Ubytování v Jizerských horách — pokoje hotelu U Můstků"
  - `/kontakt`: „Kontakt" → „Kontakt a cesta k hotelu v Desné"
  - `/akce`: „Skupinové akce" → „Skupinové akce a pronájem celého hotelu v Jizerských horách"
- [ ] **Meta descriptions** — musí obsahovat cílový dotaz a důvod kliknout (55–160 znaků)
- [ ] **FAQ sekce** na `/ubytovani`, `/stravovani`, `/akce` — nejsilnější formát pro AI vyhledávače
- [ ] **Doplnit obsah** tam, kde je ho málo — `/aktuality` má 2 položky, `/kontakt` je krátký
- [ ] **Odstranit všechna tvrzení o bezbariérovosti** — hotel bezbariérový NENÍ, do budovy se jde po schodech. Zbývá v `src/main.js` a ve viditelném textu `ubytovani.html`.

## 4.3 Mapa klíčových slov

| Cílový dotaz | Stránka |
|---|---|
| ubytování Jizerské hory | `/` |
| hotel Desná Jizerské hory | `/` |
| ubytování s polopenzí Jizerky | `/stravovani` |
| dog friendly hotel Jizerské hory | `/ubytovani` |
| ceník ubytování Desná | `/ubytovani#cenik` |
| penzion pro sportovní soustředění Jizerky | `/akce` |
| svatba v Jizerských horách | `/akce` |
| výlet k Protržené přehradě | `/okoli/turistika` |
| kam na běžky v Jizerkách | `/okoli/zima` |

**Pravidlo:** jedno klíčové slovo = jedna stránka. Dvě stránky na stejný dotaz si kanibalizují pozice.

---

# FÁZE 5 — Optimalizace pro AI vyhledávače 🟡

- [x] `llms.txt` — strukturovaný přehled pro AI
- [x] `robots.txt` neblokuje GPTBot, ClaudeBot, PerplexityBot, Google-Extended
- [x] Obsah hlavních stránek je v HTML, ne generovaný JavaScriptem
- [x] Sjednocený název firmy napříč webem
- [ ] **NAP konzistence i mimo web** — stejný název, adresa a telefon na Google Business Profile, Booking.com, Firmy.cz, Mapy.cz
- [ ] **FAQ sekce na dalších stránkách** (viz 4.2) — formát otázka + přímá odpověď AI přebírá doslova
- [ ] **Test viditelnosti v AI** — zeptat se ChatGPT / Perplexity / Google AI Overview na:
  - „hotel v Desné v Jizerských horách"
  - „ubytování s polopenzí Jizerky"
  - Zapsat výchozí stav, opakovat po 1, 3 a 6 měsících

---

# FÁZE 6 — Lokální SEO ⏹️ VYŘAZENO ZE ZAKÁZKY

**Rozhodnuto 31. 7. 2026: neděláme.**

Google Business Profile existuje, je nárokovaný, má vyplněnou adresu, telefon a hodnocení 4,4 ★ z 87 recenzí. To podstatné funguje. Optimalizace profilu, sbírání recenzí a zápisy do katalogů nejsou součástí zakázky.

**Jediná věc, kterou je vhodné ověřit** (zdarma, bez přístupu — stačí otevřít Google Maps): jestli má profil vyplněný **odkaz na web**. Když u karty hotelu chybí tlačítko „Webová stránka", lidé z Map na web neproklinou. Kdyby chybělo, klient to doplní za minutu.

**Důsledek pro schema:** `AggregateRating` do JSON-LD nepřidáváme. Bez správy profilu nemáme doložitelný zdroj hodnocení a vymyšlený agregát je porušení pravidel Googlu.

---

# FÁZE 7 — Rychlost a přístupnost ⬜

- [ ] Změřit výchozí stav na **PageSpeed Insights** (mobilní verze!)
- [ ] **`Mobil - Kontakt.svg` má 17 MB** — kritické, optimalizovat nebo nahradit
- [ ] Hero video se načítá ze Supabase — ověřit, jestli neblokuje LCP
- [ ] Doplnit `width` a `height` ke všem `<img>` (zabraňuje posunu layoutu)
- [ ] `loading="lazy"` na obrázky pod ohybem
- [ ] Zvážit self-hosting Google Fonts (ušetří ~200 ms)
- [ ] **Cíl:** LCP < 2,5 s · INP < 200 ms · CLS < 0,1 na mobilu

## Přístupnost (pro seniorskou cílovku dvojnásob důležité)

- [ ] **Alt texty** — dnes obecné („Hotel U Můstků", „Kontakt Hotel U Můstků"). Popsat, co na fotce konkrétně je.
- [ ] Klikací plochy min. 44×44 px — dnešní tlačítka mají na mobilu **36 px, pod limitem**
- [ ] Kontrast textu min. 4,5:1
- [ ] Formuláře mají `<label>`

---

# FÁZE 8 — Měření 🟡

- [x] Google Search Console nastavená
- [x] GA4 nastavená a propojená s GSC
- [ ] V GA4 nastavit konverzní událost „odeslaná rezervace"
- [ ] Zachytit výchozí stav: `/seo drift baseline https://umustku.cz`

## Měsíční kontrola

- [ ] GSC → Výkon: rostou impressions a prokliky? Kde jsme na pozicích 4–15 (tam je největší prostor)?
- [ ] GSC → Indexování: nejsou nové chyby?
- [ ] PageSpeed Insights: nezhoršily se Core Web Vitals?
- [ ] Test v AI vyhledávačích
- [ ] Odpovědět na nové Google recenze

## Čtvrtletní

- [ ] `/seo audit https://umustku.cz`
- [ ] Přidat 3–5 nových stránek obsahu
- [ ] Aktualizovat ceník a `lastmod` v sitemap

---

# JAK POZNÁME, ŽE JE TO 100 %

| Metrika | Nástroj | Cíl |
|---|---|---|
| Lighthouse SEO skóre | PageSpeed Insights | **100/100** |
| Chyby strukturovaných dat | Rich Results Test | **0 chyb** |
| Indexované stránky | GSC → Indexování | **100 % odeslaných URL** |
| Core Web Vitals | PageSpeed Insights (mobil) | LCP < 2,5 s · INP < 200 ms · CLS < 0,1 |
| Pozice | GSC → Výkon | TOP 3 na 15 cílových dotazů |
| Viditelnost v AI | ruční test | hotel se objeví v odpovědi |
| Přímé rezervace | Supabase / GA4 | rostoucí podíl vs. Booking.com |

První viditelné výsledky v GSC: **4–8 týdnů po nasazení domény.** Plný efekt: **3–6 měsíců.**

---

# CO DĚLAT PŘÍŠTĚ

1. **Fáze 4** — copywriting: H1, meta descriptions, FAQ sekce (největší zbývající blok)
2. **Fáze 1.1** — doladit kotvy v přesměrování (`stranka=cenik` → `/ubytovani#cenik` atd.)
3. **Fáze 7** — rychlost, alt texty, 17MB SVG
4. **Fáze 1.2** — teprve pak přepnout doménu
5. **Fáze 2.7** — po přepnutí ověřit schema v Rich Results Test
