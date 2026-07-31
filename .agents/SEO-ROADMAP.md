# SEO Roadmapa — Hotel U Můstků

**Poslední aktualizace: 31. 7. 2026 (večer)**

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
| 4 — Copywriting | ✅ **hotovo** |
| 5 — AI / GEO | ✅ hotovo (test v AI až po spuštění) |
| 6 — Lokální SEO | ⏹️ vyřazeno ze zakázky |
| 7 — Rychlost a přístupnost | 🟡 soubory hotové, zbývá LCP 6,0 s |
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

# FÁZE 4 — Copywriting ✅

## 4.0 Oprava faktických chyb ✅

Podklady klienta obsahovaly dvě nepravdivá tvrzení, která se stihla dostat do textů i strukturovaných dat. Obojí ověřeno na místě a odstraněno.

- [x] **Bezbariérovost** — hotel bezbariérový NENÍ, do budovy se jde po schodech. Odstraněno ze všech `amenityFeature`, z `HotelRoom` popisu, z `llms.txt`, z meta descriptions, z viditelných textů i z `src/main.js`.
- [x] **Trampolína** — hotel ji odstranil. Vymazána ze všech schemat, `llms.txt`, `index.html`, `stravovani.html` i `src/main.js`.
- [x] Do `SEO-CONTEXT.md` přidána závazná pravidla, jak psát o pokojích, a varování, že `02_pokoje_a_cenik.md` je chybný

## 4.1 Úvodní stránka ✅

- [x] Sekce „Zázemí" přepsána — H2 „Klid Jizerských hor, do kterého se budete rádi vracet". Text obsahuje Desnou, splav Bílé Desné i skokanské můstky. Zachován vítající tón; čísla o kapacitě do téhle sekce záměrně nedávána (patří do ceníku a schema).
- [x] Sekce „Více než jen ubytování" ponechána beze změny — kulečník, šipky a ping-pong sem nepatří

## 4.2 Podstránky ✅

Všech 6 podstránek přepsáno. Meta descriptions mají 143–154 znaků, což je v optimálním pásmu.

| stránka | title | H1 | desc |
|---|---|---|---|
| `/ubytovani` | ✅ | ✅ | 147 zn. |
| `/stravovani` | ✅ | ✅ | 153 zn. |
| `/akce` | ✅ | ✅ | 151 zn. |
| `/okoli` | ✅ | ✅ | 153 zn. |
| `/kontakt` | ✅ | ✅ | 154 zn. |
| `/aktuality` | ✅ | ✅ | 143 zn. |

- [x] ⛔ **FAQ sekce se NEPŘIDÁVAJÍ.** Ondřej je zkusil nasadit a otázky jen opakovaly to, co už je na stránce zodpovězené — duplicitní vata. Existující FAQ na `/okoli` a `/ubytovani` zůstávají. *(rozhodnuto 31. 7. 2026)*

### Zbývá jediná drobnost

- [ ] `okoli-turistika.html` má `<title>` a popisky převzaté z jednoho výletu (Protržená přehrada) místo z celé kategorie. Ostatní tři stránky výletů to mají správně.

## 4.3 Mapa klíčových slov

| Cílový dotaz | Stránka |
|---|---|
| ubytování Jizerské hory | `/` |
| hotel Desná Jizerské hory | `/` |
| ubytování s polopenzí Jizerky | `/stravovani` |
| dog friendly hotel Jizerské hory | `/ubytovani` |
| ceník ubytování Desná | `/ubytovani` |
| penzion pro sportovní soustředění Jizerky | `/akce` |
| svatba v Jizerských horách | `/akce` |
| výlet k Protržené přehradě | `/okoli/turistika` |
| kam na běžky v Jizerkách | `/okoli/zima` |

**Pravidlo:** jedno klíčové slovo = jedna stránka.

---

# FÁZE 5 — Optimalizace pro AI vyhledávače ✅ (co jde udělat před spuštěním)

- [x] `llms.txt` — strukturovaný přehled pro AI
- [x] `robots.txt` neblokuje GPTBot, ClaudeBot, PerplexityBot, Google-Extended
- [x] Obsah hlavních stránek je v HTML, ne generovaný JavaScriptem
- [x] Sjednocený název firmy napříč webem
- [x] ⛔ **FAQ sekce na dalších stránkách — VYŘAZENO.** Duplicitní vata, viz Fáze 4.2.
- [x] **NAP konzistence** — na webu sjednoceno. Mimo web (Booking, Firmy.cz, Mapy.cz) **neřešíme** — spadá pod lokální SEO, které není součástí zakázky (Fáze 6). Jediné, co je potřeba: aby název, adresa a telefon na webu seděly s Google Business Profilem — **sedí**.

## Test viditelnosti v AI — až po spuštění domény ⬜

Nemá smysl testovat teď. Web ještě není na `umustku.cz`, AI vyhledávače o něm nevědí. **Zařadit do měsíční kontroly** (Fáze 8) po přepnutí domény.

- [ ] Zeptat se ChatGPT / Perplexity / Google AI Overview na:
  - „hotel v Desné v Jizerských horách"
  - „ubytování s polopenzí Jizerky"
  - „kde se ubytovat u Tanvaldského Špičáku"
- [ ] Zapsat výchozí stav, opakovat po 1, 3 a 6 měsících

---

# FÁZE 6 — Lokální SEO ⏹️ VYŘAZENO ZE ZAKÁZKY

**Rozhodnuto 31. 7. 2026: neděláme.**

Google Business Profile existuje, je nárokovaný, má vyplněnou adresu, telefon a hodnocení 4,4 ★ z 87 recenzí. To podstatné funguje. Optimalizace profilu, sbírání recenzí a zápisy do katalogů nejsou součástí zakázky.

**Jediná věc, kterou je vhodné ověřit** (zdarma, bez přístupu — stačí otevřít Google Maps): jestli má profil vyplněný **odkaz na web**. Když u karty hotelu chybí tlačítko „Webová stránka", lidé z Map na web neproklinou. Kdyby chybělo, klient to doplní za minutu.

**Důsledek pro schema:** `AggregateRating` do JSON-LD nepřidáváme. Bez správy profilu nemáme doložitelný zdroj hodnocení a vymyšlený agregát je porušení pravidel Googlu.

---

# FÁZE 7 — Rychlost a přístupnost 🟡

## 7.0 Naměřeno — PageSpeed Insights, mobil, 31. 7. 2026

| metrika | hodnota | |
|---|---|---|
| **SEO** | **100/100** | ✅ cíl splněn |
| **Accessibility** | **100/100** | ✅ |
| Best Practices | 96 | ✅ |
| **CLS** (posun layoutu) | **0** | ✅ |
| TBT | 10 ms | ✅ |
| FCP | 2,8 s | 🟡 |
| Speed Index | 5,2 s | 🟡 |
| **LCP** | **6,0 s** | 🔴 cíl < 2,5 s |
| Performance | 70 | 🟡 |

- [x] ⛔ **`width` a `height` k obrázkům se NEPŘIDÁVAJÍ.** CLS je **0** — layout neskáče vůbec, protože obrázky sedí v kontejnerech s pevnou velikostí a `object-fit`. Atributy by nic nezlepšily a znamenaly by 331 zásahů do kódu. *(rozhodnuto po měření 31. 7. 2026)*

## 7.1 Velké soubory ✅

- [x] Smazána tři nepoužívaná hero videa (87 MB) — hero se načítá ze Supabase
- [x] Smazán `Mobil - Kontakt.svg` (16,4 MB) z kořene projektu
- [x] Složky pokojů: 19 → 8, ověřeno MD5 hashem že šlo o identické soubory
- [x] Smazány prázdné `p6` a `Pokoj Standard P6`
- [x] Smazány nepoužívané ikony v `public/Icons/Ikony/`
- [x] Ověřeno: **0 rozbitých odkazů** na obrázky
- **Ušetřeno zhruba 115 MB.** Největší soubor: 34,9 MB → 0,8 MB

## 7.2 LCP 6,0 s — hlavní zbývající problém 🔴

**Příčina nalezena: ikony jsou uložené v rozlišení 1024 × 1024 px.**

| ikona | velikost | rozměr |
|---|---|---|
| Ikona - polopenze | 294 kB | 1024×1024 |
| Ikona - ohniste | 265 kB | 1024×1024 |
| Ikona - spolecenska herna | 244 kB | 1024×1024 |
| Ikona - venkovni prvky | 242 kB | 1024×1024 |
| Ikona - venkovni posezeni | 203 kB | 1024×1024 |
| Otuzovani-u-splavu + duplikát | 2× 119 kB | 1024×1024 |
| Ikona - turistika a cyklistika | 92 kB | 938×938 |

Zobrazují se jako malé ikonky, načítají se v plném rozlišení. **Dohromady 1,6 MB.**

Úvodní stránka načítá **5,5 MB obrázků** ve 116 souborech, celá stránka 8,6 MB.

- [ ] Zmenšit ikony na dvojnásobek zobrazované velikosti, cíl pod 20 kB na ikonu
- [ ] Smazat duplikát `Otuzovani u splavu.webp` / `Otuzovani-u-splavu.webp`
- [ ] Hero obrázky (417–456 kB) — přes `<picture>` servírovat menší verzi na mobil
- [ ] **Google Fonts blokují vykreslení o 950 ms** — načítat neblokujícím způsobem, zúžit rozsah řezů

## 7.3 Alt texty ⬜ (nízká priorita)

Accessibility skóre je 100, takže formálně je vše v pořádku. Ale 200 obrázků má popisek typu „Hotel U Můstků", což nepomáhá ve vyhledávání obrázků ani nevidomým uživatelům.

- [ ] Přepsat obecné alt texty na popis toho, co na fotce konkrétně je (5–12 slov)

## 7.4 Tlačítka na mobilu ⬜

- [ ] 36 px výšky, doporučené minimum pro dotyk je 44 px. V `src/style.css` na 33 místech. Pro seniorskou cílovku podstatné. **Pozor: kolize s Button Design System v `.agents/AGENTS.md`, kde je 36 px předepsáno — rozhodnout s Ondřejem.**

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
- [ ] **Test viditelnosti v AI** (viz Fáze 5)
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

1. **Fáze 7.2** — zmenšit ikony z 1024 px, hero přes `<picture>`, odblokovat fonty
   → cíl: LCP z 6,0 s pod 2,5 s
2. **Fáze 4.2** — opravit `<title>` na `okoli-turistika.html` (2 minuty)
3. **Fáze 1.2** — přepnout doménu
4. **Fáze 2.7** — po přepnutí ověřit schema v Rich Results Test
5. **Fáze 7.3 + 7.4** — alt texty a tlačítka, až bude čas

**Poznámka:** SEO skóre je už teď 100/100. Zbytek Fáze 7 je o rychlosti,
ne o SEO jako takovém — ale LCP 6 s je faktor hodnocení a hlavně
odrazuje návštěvníky.

## Poučení z průběhu

Podklady klienta (`Marek - Hotel/`) obsahují **faktické chyby**. Zatím se našly dvě
(bezbariérovost, trampolína) a obě se stihly dostat na web, než je Ondřej zachytil.
**Před psaním textu o čemkoli fyzickém v hotelu si to ověřit u Ondřeje nebo klienta**,
ne slepě přebírat z dokumentace.