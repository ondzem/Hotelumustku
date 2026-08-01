# SEO & Copywriting kontext — Hotel U Můstků

Referenční dokument pro veškerou SEO a copy práci na tomto webu. Držet se ho při každé úpravě textů a meta dat.

---

## 1. Co je projekt

Statický Vite web (7 HTML stránek, vanilla JS, Supabase pro rezervace + Resend pro e-maily) pro rodinný **Hotel U Můstků**, Údolní 368, Desná v Jizerských horách 1, 468 61.

- Doména: `umustku.cz` (nahrazuje starý PHP web + Wix prezentaci)
- Majitelé: **Lenka & Jan Bellingerovi**, provozují od 2015, bydlí přímo v budově

### Fakturační údaje — ověřeno v ARES 1. 8. 2026

| | |
|---|---|
| Podnikatel | Lenka Bellingerová (fyzická osoba) |
| IČ | 74349074 |
| **Sídlo** | **Budovcova 1148/80, Poděbrady III, 290 01 Poděbrady** |
| Provozovna | Hotel U Můstků, Údolní 368, Desná v Jizerských horách 1, 468 61 |
| DPH | **je plátcem DPH** — ceny na webu jsou včetně DPH |
| DIČ | `CZ7357111014` — **nezveřejňovat na webu**, obsahuje rodné číslo. Patří jen na daňové doklady. |
| Živnostenský rejstřík | ŽÚ Poděbrady, podniká od 1. 2. 2007 |

⚠️ **Sídlo NENÍ v Desné.** Dřívější dokumenty uváděly Desnou jako sídlo i provozovnu — chybně.
Pro § 435 občanského zákoníku se uvádí **sídlo**, adresa provozovny je doplňková.
- Tel: +420 777 666 273 · E-mail: hotel@umustku.cz
- GPS: 50°45'43,73"N, 15°18'10,74"E

### Struktura webu

| Soubor | URL | Titulek |
|---|---|---|
| index.html | `/` | Hotel U Můstků \| Ubytování v Jizerských horách |
| ubytovani.html | `/ubytovani` | Ubytování & Pokoje |
| stravovani.html | `/stravovani` | Restaurace & Stravování |
| akce.html | `/akce` | Skupinové & Firemní akce |
| okoli.html | `/okoli` | Výlety & Aktivity v okolí |
| aktuality.html | `/aktuality` | Aktuality & Novinky |
| kontakt.html | `/kontakt` | Kontakt & Kde nás najdete |

Rewrites a 301 ze starého PHP webu jsou v `public/_redirects`.
Podstránky pokojů zatím **neexistují** jako HTML (jen fotky v `public/pokoje/`).

---

## 2. Cílová skupina (priorita shora dolů)

1. **Aktivní senioři 60+** — hlavní segment. Chtějí ticho, čistotu, poctivé české jídlo, snadné parkování, rovinatou cestu od vlaku (1,5 km), odvoz zavazadel zdarma. Potřebují velké písmo, jednoduchý jazyk, telefonní číslo na dosah.
2. **Rodiny s dětmi (i se psem)** — oplocená zahrada, dětský koutek, dog-friendly (150 Kč/den).
3. **Sportovci** — cyklostezka Járy Cimrmana č. 3019 u hotelu, kolárna/lyžárna pod kamerou, dobíjení elektrokol (15 Kč/den), Tanvaldský Špičák 10 min, Černá Říčka 3 min autem, Jizerská magistrála.
4. **Skupiny / B2B** — pronájem celého hotelu pro 42 osob, svatby, soustředění (reference SK Kosmonosy divize), firemní akce, optická Wi-Fi.

---

## 3. USP — o co se copy vždycky opírá

1. **Absolutní čistota** — v recenzích opakovaně ("Tak čistý pokoj jsme snad ještě nezažili")
2. **Šumící splav Bílé Desné** přímo pod zahradou a terasou
3. **Výhled na skokanské můstky** z balkónů a terasy
4. **Poctivá domácí kuchyně** — domácí jogurty, pečený chléb, jednotné denní menu, bezlepkově na míru
5. **Rodinný přístup Bellingerových** — bydlí v domě, poslali hostům zapomenuté magnetky poštou
6. **Klid a bezpečí** — slepá lesní ulice, oplocené parkoviště se závorou a kamerami zdarma

---

## 4. Fakta pro texty (nikdy si nevymýšlet jiná)

**Kapacita:** 12 nekuřáckých pokojů, 42 lůžek. 6× Standard v přízemí (balkón s výhledem) + 6× Nadstandard v patře (prostorná terasa, výhled na celé údolí), z toho 3 rekonstruované (Zen, A, A1).

**⛔ POZOR — hotel NENÍ bezbariérový.** Do budovy se vchází po schodech. Obě patra jsou nad úrovní terénu — „přízemí" **není** v úrovni parkoviště ani terasy a **není s nimi propojené**. Dokument klienta `Marek - Hotel/komplexni_informace_o_hotelu/02_pokoje_a_cenik.md` tvrdí opak — **je chybný, neřídit se jím**. Ověřeno na místě 31. 7. 2026.

**Jak psát o pokojích:**
- **Standard (přízemí):** balkón, končit slovem „s výhledem". Nespecifikovat, na co je výhled, a **nikdy nesrovnávat s patrem.**
- **Nadstandard (patro):** prostorná terasa a **výhled na celé údolí**.
- **Zakázáno psát:** „bezbariérový", „bez schodů", „přímý přístup na terasu / k parkovišti", „výhled do zeleně", jakékoli srovnání typu horší/lepší výhled.

**⛔ TRAMPOLÍNA UŽ NEEXISTUJE.** Hotel ji odstranil. Podklady klienta i staré weby ji zmiňují — **neplatí to**. Ověřeno 31. 7. 2026.

**Ceník 2026** (za osobu/noc, snídaně v ceně):
- Standard: 1 os. 830 Kč · 2 os. 740 Kč · 3 os. 720 Kč · 4 os. 700 Kč
- Kat. A / A1 / Zen: 890 Kč
- Polopenze +195 Kč/os./den · Pes 150 Kč/den · Elektrokolo 15 Kč/den · Parkování zdarma · Poplatek obci v ceně
- **Příplatek za pobyt na 1 noc nebo samostatné obsazení pokoje:** Standard a Turistický +200 Kč/os./noc · Nadstandard (A, A1, Zen) **+300 Kč/os./noc**
  *(dřívější údaj „+200 pro všechny" byl chybný — ověřeno 1. 8. 2026)*

**Storno:** více než 3 dny před příjezdem **zdarma** · méně než 3 dny nebo nedojezd **100 %**
*(Ověřeno u Ondřeje 1. 8. 2026. Dřívější údaj 21/14/7 dní byl chybný a byl na webu na třech místech — v FAQ schematu na `/ubytovani`, v `llms.txt` a v tomto dokumentu. Závazná je verze z modalu v rezervačním formuláři.)*

**Check-in / check-out:** příjezd od **15:00**, odjezd do **10:00**. Jiný čas po domluvě.
*(Schema na 11 stránkách mělo chybně 14:00 — opraveno 1. 8. 2026.)*

**Stravování:** snídaně švédský stůl 8:00–9:00 · večeře polopenzí v 18:00, dvouchodové menu, jen pro ubytované (není veřejná restaurace) · letní zahrádka nad splavem květen–září, Bernard 10°, Bernard 11° polotmavý, Pilsner Urquell 12° · venkovní udírna a kamenné ohniště

**Zázemí:** herna s krbem zdarma (kulečník, ping-pong, fotbálek, šipky), dětský koutek, přírodní tůň k otužování, optická Wi-Fi zdarma, uzamykatelná kolárna/lyžárna se servisním koutkem

**⚠️ Zimní uzavírka:** silnice II/290 v úseku přehrada Souš – Smědava je v zimě (listopad–duben) uzavřena. Navigace ji přesto navrhují. K hotelu vždy **od Tanvaldu a Desné**. Musí být výrazně na Kontaktu i v patičce.

**Doprava:** Praha přes Liberec cca 80 min autem · vlak/bus zastávka 1,5 km po rovině, odvoz zavazadel zdarma po domluvě

---

## 5. Stav SEO — co chybí (audit k 31. 7. 2026)

**Kritické:**
- ❌ **Žádné schema.org / JSON-LD** na žádné stránce — chybí `Hotel`, `LocalBusiness`, `Room`, `Offer`, `AggregateRating`, `FAQPage`, `BreadcrumbList`
- ❌ **Žádný `rel="canonical"`** na žádné stránce
- ❌ **Chybí `robots.txt` i `sitemap.xml`**
- ❌ **Chybí `llms.txt`** (viditelnost pro AI vyhledávače)
- ❌ Chybí `og:url`, `og:locale`, `og:site_name`, Twitter Card
- ❌ OG image je na všech stránkách stejná (`/uvodni_hero_sekce.webp`)

**Obsahové:**
- ⚠️ `meta keywords` je na **všech 7 stránkách identická** (a Google ji stejně ignoruje)
- ⚠️ ~55 recenzí je duplikováno na 4 stránkách (index, ubytovani, stravovani, akce) → duplicitní obsah
- ⚠️ Sekce "Co dalšího nabízíme" a "Co vše můžete v okolí podniknout" duplikovány napříč stránkami
- ⚠️ H1 na podstránkách jsou generické bez klíčových slov: "Nabídka pokojů", "Kontakt", "Skupinové akce"
- ⚠️ Chybí podstránky jednotlivých pokojů (velký potenciál pro long-tail)
- ⚠️ Chybí obsah k výletům jako samostatné stránky — hotové texty leží v `Aktivity popisky/` (turistika, cyklistika, zima, výlety autem) včetně H1/Title/Meta/Alt
- ⚠️ Typo v `<h2>`: "zaslouženýodpočinek" (chybí mezera) — v patičce na všech stránkách
- ⚠️ Alt texty obrázků jsou obecné ("Hotel U Můstků", "Kontakt Hotel U Můstků")
- ⚠️ Žádná jazyková mutace (DE/PL) — přitom příhraniční lokalita

**Cílové dotazy** (dle strategie):
- Transakční CZ: „rodinné ubytování Desná Jizerské hory", „ubytování s polopenzí Jizerky", „penzion pro sportovní soustředění Jizerky", „dog friendly hotel Jizerské hory"
- Informační CZ: „kam na běžky v Jizerkách", „cyklotrasy pro rodiny s dětmi Desná", „výlet k Protržené přehradě z Desné"
- DE: „Pension für Senioren Isergebirge", „Fahrradtouren Isergebirge Unterkunft"
- PL: „noclegi Góry Izerskie z wyżywieniem", „noclegi z psem Góry Izerskie"

---

## 6. Copy pravidla

- Jazyk: čeština, vykání, teplý a věcný tón bez marketingového nafukování
- Psát pro seniory: krátké věty, konkrétní čísla, žádné anglicismy ani abstrakce
- Nikdy neslibovat, co hotel nemá (**není bezbariérový — do budovy se jde po schodech**, není veřejná restaurace, není nabíječka pro elektromobily, večeře je jednotné menu bez výběru)
- Slovo „Restaurace" v navigaci nahrazeno „Stravování" (záměrně — restaurace evokuje veřejnou provozovnu)
- Cenovou paritu s Booking.com neporušovat: sleva 5 % se komunikuje jako věrnostní benefit za přímou rezervaci, ne jako veřejně nižší cena

**⛔ ŽÁDNÉ NOVÉ FAQ SEKCE.** Zákaz přidávat sekce „Často kladené dotazy" na stránky, kde nejsou. Otázky by jen znovu odpovídaly na to, co už je na stránce výš napsané — je to duplicitní vata. Existující FAQ na `/okoli` a `/ubytovani` zůstávají. *(rozhodnuto Ondřejem 31. 7. 2026)*

---

## 7. Kde jsou zdrojová data

- `Marek - Hotel/komplexni_informace_o_hotelu/` — 8 dokumentů: profil, pokoje a ceník, stravování, služby, marketing a SEO, rezervační systémy, sitemap, tipy na výlety
- `Marek - Hotel/audit_stavajiciho_webu.md` — doslovný obsah starých webů + všechny recenze
- `Marek - Hotel/vyzkum_a_analyza_trhu.md`, `finalni_analyza_a_vyzkum*.md` — analýza trhu
- `Hotel u mustku/Aktivity popisky/*.md` — hotové SEO texty na výlety (H1, Title, Meta, Alt)
- `claude-seo-main/` — 25 SEO sub-skills (`/seo audit`, `/seo schema`, `/seo local`, `/seo geo`, ...)
- `marketingskills-main/` a `Copywritting/Skills/` — 40+ marketingových skills (copywriting, cro, ai-seo, schema, site-architecture)
