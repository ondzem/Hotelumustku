# Měření poptávek — Hotel u Můstků

Web od 25. 9. 2026 počítá, **kolik lidí se ozvalo** a **co je na web
přivedlo**. Neměří se nic jiného: scrolly a zobrazení sekcí nikdo
neotevře a jen by zaplevelily přehledy.

Měří se jen po souhlasu s analytickými cookies. Když návštěvník souhlas
odmítne nebo ho později odvolá, neodešle se nic a web se chová úplně
stejně jako předtím.

## 1. Co se měří

| Co člověk udělá | Událost v GA4 | Podrobnosti (parametry) |
|---|---|---|
| Odešle kontaktní formulář | `odeslani_formulare` | `formular: kontakt`, `tema: zprava`, `zdroj` |
| Odešle žádost o rezervaci | `odeslani_formulare` | `formular: rezervace`, `tema: <název pokoje>`, `zdroj` |
| Odešle recenzi | `odeslani_formulare` | `formular: recenze`, `tema: recenze`, `zdroj` |
| Klepne na telefonní číslo | `klik_telefon` | `misto`, `zdroj` |
| Klepne na e-mailovou adresu | `klik_email` | `misto`, `zdroj` |

- **`misto`** říká, odkud se volalo: `hlavicka`, `paticka`, `sekce-kontakt`,
  `plovouci`, `obsah`. Podle toho je vidět, jestli lidé volají hned z lišty,
  nebo až když text dočtou.
- **`zdroj`** je to, odkud host na web přišel — `Facebook`, `Google`,
  `Seznam`, `letak`, `primy`… Platí **první návštěva**, ne poslední
  stránka.
- **Jméno, e-mail, telefon ani text zprávy se do analytiky neposílají.**

Rezervace navíc dál posílá podrobnou událost `rezervace_odeslana`
(částka, počet nocí, pokoj), která tu byla už dřív.

## 2. Zdroj poptávky přímo v e-mailu

U zprávy z kontaktního formuláře a u nové žádosti o rezervaci přibyl
řádek **„Přišel z: …"**. Majitel tedy nemusí otevírat Analytics, aby
věděl, co poptávku přineslo. V e-mailech, které chodí hostovi, tenhle
řádek není.

Zdroj se zjistí při první návštěvě (z odkazu nebo z webu, ze kterého
člověk přišel), uloží se jen do zavření karty prohlížeče a při prokliku
po webu se nepřepisuje.

## 3. Co je potřeba nastavit v GA4 (ručně, jednou)

Bez tohohle kroku události v přehledech nebudou vidět — GA4 je sbírá, ale
samo je nezobrazí.

1. **Google Analytics → Admin → Události**. Počkej, až se objeví
   `odeslani_formulare`, `klik_telefon` a `klik_email` (naskočí do
   24 hodin od prvního výskytu, v Reálném čase hned).
2. U každé z těch tří událostí přepni přepínač **„Označit jako klíčovou
   událost"**. Teprve pak se počítají jako konverze.
3. **Admin → Vlastní definice → Vytvořit vlastní dimenzi.** Založ čtyři,
   všechny s rozsahem **Událost**:
   | Název dimenze | Parametr |
   |---|---|
   | Formulář | `formular` |
   | Téma | `tema` |
   | Místo odkazu | `misto` |
   | Zdroj poptávky | `zdroj` |
4. **Pozor na počáteční hodnotu.** Necháš-li u dimenze vyplněnou
   „výchozí hodnotu", GA4 jí přepíše všechna prázdná místa a v přehledu
   to pak vypadá, že všechny poptávky mají stejné téma. Nech ji prázdnou.
5. Data ve vlastních dimenzích se **nenačtou zpětně** — ukazují se až od
   chvíle, kdy dimenzi založíš. Proto je lepší to udělat hned.

## 4. Jak si ověřit, že to měří

1. Otevři web přes odkaz se zdrojem, třeba
   `https://umustku.cz/?utm_source=facebook`, a v cookie liště **přijmi
   analytické cookies**.
2. V GA4 otevři **Přehledy → V reálném čase**. Klepni na webu na
   telefonní číslo v patičce — do půl minuty se v přehledu událostí
   objeví `klik_telefon`.
3. Odešli zkušební zprávu z kontaktního formuláře. V reálném čase se
   objeví `odeslani_formulare` a na `hotel@umustku.cz` přijde e-mail
   s řádkem „Přišel z: Facebook".

Bez souhlasu s cookies se nestane nic — to není chyba, tak to má být.

## 5. Odkazy se zdrojem (bez nich přijdou všichni jako „přímá návštěva")

Tohle je ta část, na které celé měření zdroje stojí. Používej tyhle
adresy všude, kde na web odkazuješ:

| Kam to patří | Odkaz |
|---|---|
| Instagram — odkaz v profilu | `https://umustku.cz/?utm_source=instagram` |
| Facebook — stránka hotelu | `https://umustku.cz/?utm_source=facebook` |
| Facebook — placený příspěvek | `https://umustku.cz/?utm_source=facebook&utm_campaign=reklama` |
| Podpis v e-mailu | `https://umustku.cz/?utm_source=podpis` |
| QR kód na letáku | `https://umustku.cz/?utm_source=letak` |
| Vizitka na recepci | `https://umustku.cz/?utm_source=vizitka` |
| Google profil firmy | `https://umustku.cz/?utm_source=google-profil` |
| Firmy.cz, Mapy.cz a podobné katalogy | `https://umustku.cz/?utm_source=firmy` |

Název za `utm_source=` si můžeš zvolit jakýkoli — objeví se v e-mailu
i v přehledu přesně tak, jak ho napíšeš. Piš ho malými písmeny a bez
diakritiky.

## 6. Kde to je v kódu

- `src/utils/mereni.js` — jediné místo, které mluví s analytikou,
  posluchač na odkazy `tel:` a `mailto:` a zjištění zdroje návštěvy.
- `src/main.js` — spuštění měření, událost u kontaktního formuláře
  a u recenze.
- `src/components/BookingSystem.js` — událost u odeslané rezervace.
- `src/utils/emailService.js` — řádek „Přišel z" v e-mailech recepci.
- `kontrola/mereni.mjs` — kontrola, že se bez souhlasu neodesílá nic
  a že v událostech nejsou osobní údaje (`./zkontroluj.sh`).
