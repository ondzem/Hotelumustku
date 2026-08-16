-- =====================================================================
--  CENÍK — sezóny, ceny podle počtu osob, výjimky pro pokoje
--  Vlož celý tento soubor do Supabase → SQL Editor → Run.
--  Je bezpečné ho spustit i opakovaně (IF NOT EXISTS / ON CONFLICT).
--
--  Pozn.: dřívější verze skriptu padala na
--  ERROR 42P01 relation "public.room_prices" does not exist.
--  Příčinou bylo psaní public.room_prices uvnitř ON CONFLICT DO UPDATE —
--  v klauzuli SET se cílová tabulka smí uvádět jen nekvalifikovaně.
--  Teď se místo toho použije DO NOTHING a samostatný UPDATE.
--
--  Druhá oprava: kontrola jedinečného omezení porovnávala array_agg
--  (typ name[]) s ARRAY['room_id'] (typ text[]), což Postgres odmítl
--  chybou 42883. Teď se hledá přímo v pg_index.
--
--  Ceny jsou naplněné přesně podle ceníku na umustku.cz
--  platného od 1. 1. 2026: cena je vždy ZA OSOBU A NOC se snídaní
--  a klesá s počtem lidí na pokoji.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) SEZÓNY
--
--    Základní sezóna (je_zakladni = true) platí vždy a nedá se smazat.
--    Ostatní sezóny ji přebíjejí ve svém datumovém rozsahu.
--
--    datum_od / datum_do:
--      opakuje_se = true  → 'MM-DD'      (platí každý rok, např. '11-01')
--      opakuje_se = false → 'YYYY-MM-DD' (jednorázově, např. Silvestr 2026)
--
--    Rozsah smí přecházet přes Nový rok — zima '11-01' → '04-15' funguje.
--
--    Při překryvu vyhrává vyšší priorita; jednorázová sezóna má vždy
--    přednost před opakující se.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cenik_sezony (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nazev               text        NOT NULL,
  datum_od            text,
  datum_do            text,
  opakuje_se          boolean     NOT NULL DEFAULT true,
  je_zakladni         boolean     NOT NULL DEFAULT false,
  vikendovy_priplatek integer     NOT NULL DEFAULT 0,  -- Kč / osoba / noc, platí pá+so+ne
  priorita            integer     NOT NULL DEFAULT 0,
  poznamka            text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Základní sezóna smí být jen jedna
CREATE UNIQUE INDEX IF NOT EXISTS cenik_sezony_jedna_zakladni_idx
  ON public.cenik_sezony (je_zakladni)
  WHERE je_zakladni = true;


-- ---------------------------------------------------------------------
-- 2) CENY PO KATEGORIÍCH
--
--    Jedna buňka = jedna cena za osobu a noc.
--    cena_za_osobu_noc = NULL znamená "použij základní sezónu".
--    Díky tomu nemusí admin u nové sezóny vyplňovat všechno.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cenik_ceny (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sezona_id         uuid        NOT NULL REFERENCES public.cenik_sezony(id) ON DELETE CASCADE,
  kategorie         text        NOT NULL,  -- 'standard' | 'nadstandard' | 'turisticky'
  pocet_osob        integer     NOT NULL,  -- 1 až 4
  cena_za_osobu_noc integer,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cenik_ceny_pocet_osob_rozsah CHECK (pocet_osob BETWEEN 1 AND 8),
  CONSTRAINT cenik_ceny_unikat UNIQUE (sezona_id, kategorie, pocet_osob)
);


-- ---------------------------------------------------------------------
-- 3) VÝJIMKY PRO KONKRÉTNÍ POKOJ
--
--    Přebíjí cenu kategorie. Admin je vyplňuje jen tam, kde chce,
--    aby se pokoj lišil od zbytku své kategorie.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cenik_ceny_pokoj (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sezona_id         uuid        NOT NULL REFERENCES public.cenik_sezony(id) ON DELETE CASCADE,
  room_id           text        NOT NULL,
  pocet_osob        integer     NOT NULL,
  cena_za_osobu_noc integer,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cenik_ceny_pokoj_pocet_osob_rozsah CHECK (pocet_osob BETWEEN 1 AND 8),
  CONSTRAINT cenik_ceny_pokoj_unikat UNIQUE (sezona_id, room_id, pocet_osob)
);


-- ---------------------------------------------------------------------
-- 3b) PŘÍPLATKY A OSTATNÍ ČÍSLA CENÍKU
--
--     Dřív byly natvrdo v kódu, takže je majitel nemohl změnit.
--     Uloženo jako dvojice klíč → hodnota, aby přidání dalšího
--     příplatku znamenalo jeden řádek, ne zásah do databáze.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cenik_nastaveni (
  klic       text PRIMARY KEY,
  hodnota    integer     NOT NULL DEFAULT 0,
  popis      text,
  jednotka   text,
  poradi     integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------
-- 4) LŮŽKA A PŘISTÝLKY U POKOJŮ
--
--    Určuje, kolik osob jde na pokoj vybrat v rezervaci — a tím pádem
--    který sloupec ceníku se použije.
--    POZOR: výchozí hodnoty jsou převzaté ze současných dat webu.
--    Majitel je musí u každého pokoje potvrdit.
-- ---------------------------------------------------------------------
--    Tabulka room_prices se v tomhle projektu nemusí jmenovat
--    public.room_prices — proto si ji skript nejdřív najde podle
--    názvu v libovolném schématu. Když neexistuje vůbec, založí ji.
DO $$
DECLARE
  schema_rp text;
BEGIN
  SELECT n.nspname INTO schema_rp
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'room_prices'
    AND c.relkind IN ('r', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY (n.nspname = 'public') DESC
  LIMIT 1;

  IF schema_rp IS NULL THEN
    RAISE NOTICE 'Tabulka room_prices nenalezena, zakládám ji v public.';
    CREATE TABLE public.room_prices (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id        text NOT NULL UNIQUE,
      room_name      text,
      base_price     integer,
      weekday_price  integer,
      weekend_price  integer,
      zakladni_luzka integer NOT NULL DEFAULT 2,
      max_pristylek  integer NOT NULL DEFAULT 0,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    );
    schema_rp := 'public';
  ELSE
    RAISE NOTICE 'Tabulka room_prices nalezena ve schématu %.', schema_rp;
    EXECUTE format(
      'ALTER TABLE %I.room_prices ADD COLUMN IF NOT EXISTS zakladni_luzka integer NOT NULL DEFAULT 2', schema_rp);
    EXECUTE format(
      'ALTER TABLE %I.room_prices ADD COLUMN IF NOT EXISTS max_pristylek integer NOT NULL DEFAULT 0', schema_rp);
  END IF;

  -- Zápis lůžek z administrace používá ON CONFLICT (room_id).
  -- Bez jedinečného indexu na room_id by skončil chybou, proto ho
  -- tady doplníme, pokud ještě žádný není.
  --
  -- Hledá se přes pg_index: indisunique = jedinečný, indnkeyatts = 1
  -- znamená, že index stojí právě na jednom sloupci.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c  ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE c.relname = 'room_prices'
      AND n.nspname = schema_rp
      AND i.indisunique
      AND i.indnatts = 1
      AND a.attname = 'room_id'
  ) THEN
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.room_prices ADD CONSTRAINT room_prices_room_id_unikat UNIQUE (room_id)', schema_rp);
      RAISE NOTICE 'Doplněno jedinečné omezení na room_id.';
    EXCEPTION
      WHEN duplicate_table OR duplicate_object THEN
        RAISE NOTICE 'Jedinečné omezení na room_id už existuje, přeskakuji.';
      WHEN unique_violation THEN
        RAISE EXCEPTION 'V tabulce room_prices je stejné room_id víckrát. Nejdřív duplicity odstraň, pak spusť skript znovu.';
    END;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 5) NAPLNĚNÍ DAT — ceník platný od 1. 1. 2026
-- ---------------------------------------------------------------------

-- 5a) Základní sezóna
INSERT INTO public.cenik_sezony (nazev, je_zakladni, opakuje_se, vikendovy_priplatek, priorita, poznamka)
SELECT 'Základní ceník (celý rok)', true, true, 0, 0,
       'Platí všude, kde nezasahuje jiná sezóna. Nelze smazat.'
WHERE NOT EXISTS (SELECT 1 FROM public.cenik_sezony WHERE je_zakladni = true);

-- 5b) Sezóny navíc — zatím bez vlastních cen, takže se chovají
--     jako základní ceník. Majitel do nich jen doplní čísla.
INSERT INTO public.cenik_sezony (nazev, datum_od, datum_do, opakuje_se, vikendovy_priplatek, priorita, poznamka)
SELECT 'Zimní sezóna', '11-01', '04-15', true, 0, 10,
       'Zatím prázdná — dokud se nevyplní ceny, platí základní ceník.'
WHERE NOT EXISTS (SELECT 1 FROM public.cenik_sezony WHERE nazev = 'Zimní sezóna');

INSERT INTO public.cenik_sezony (nazev, datum_od, datum_do, opakuje_se, vikendovy_priplatek, priorita, poznamka)
SELECT 'Letní sezóna', '07-01', '08-31', true, 0, 10,
       'Zatím prázdná — dokud se nevyplní ceny, platí základní ceník.'
WHERE NOT EXISTS (SELECT 1 FROM public.cenik_sezony WHERE nazev = 'Letní sezóna');

-- 5c) Ceny základní sezóny — opsáno z ceníku na umustku.cz
--
--     Pokoje standard:   1 os. 890 / 2 os. 740 / 3 os. 720 / 4 os. 700
--     Kat. A + A1 + Zen: 890 za osobu; sólo obsazení 1 780 (platí pokoj)
INSERT INTO public.cenik_ceny (sezona_id, kategorie, pocet_osob, cena_za_osobu_noc)
SELECT s.id, v.kategorie, v.pocet_osob, v.cena
FROM public.cenik_sezony s
CROSS JOIN (VALUES
  ('standard',    1,  890),
  ('standard',    2,  740),
  ('standard',    3,  720),
  ('standard',    4,  700),
  ('nadstandard', 1, 1780),
  ('nadstandard', 2,  890),
  ('nadstandard', 3,  890),
  ('nadstandard', 4,  890),
  ('turisticky',  1,  890),
  ('turisticky',  2,  740),
  ('turisticky',  3,  720),
  ('turisticky',  4,  700)
) AS v(kategorie, pocet_osob, cena)
WHERE s.je_zakladni = true
ON CONFLICT (sezona_id, kategorie, pocet_osob) DO NOTHING;

-- 5c2) Příplatky — opsáno z ceníku na umustku.cz
INSERT INTO public.cenik_nastaveni (klic, hodnota, popis, jednotka, poradi) VALUES
  ('polopenze',        195, 'Dokoupená polopenze',            'Kč / osoba / noc', 1),
  ('pes',              150, 'Poplatek za psa',                'Kč / noc',         2),
  ('elektrokolo',       15, 'Poplatek za elektrokolo',        'Kč / kus / den',   3),
  ('zimni_parkovani',   50, 'Zimní parkování',                'Kč / auto / noc',  4),
  ('priplatek_1_noc',  200, 'Příplatek za pobyt na 1 noc',    'Kč / osoba',       5),
  ('mestsky_poplatek',   0, 'Městský poplatek (0 = v ceně)',  'Kč / osoba / noc', 6),
  ('zaloha_procent',    30, 'Záloha předem',                  '% z celkové ceny', 7)
ON CONFLICT (klic) DO NOTHING;

-- 5d) Lůžka a přistýlky podle současných dat webu.
--     Mahagon (pa) a Motýl (a1) mají dnes 1 přistýlku, ostatní žádnou.
DO $$
DECLARE
  schema_rp    text;
  sloupce      text;
  hodnoty      text;
  sloupec_ceny text;
BEGIN
  SELECT n.nspname INTO schema_rp
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'room_prices'
    AND c.relkind IN ('r', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY (n.nspname = 'public') DESC
  LIMIT 1;

  -- Doplní jen pokoje, které v tabulce ještě nejsou.
  --
  -- Seznam sloupců se skládá podle toho, co tabulka opravdu má.
  -- Starší instalace mohou mít jiné sloupce s cenami, nebo je mít
  -- povinné — díky tomu skript nespadne ani v jednom případě.
  sloupce := 'room_id, zakladni_luzka, max_pristylek';
  hodnoty := 'v.room_id, v.luzka, v.pristylky';

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = schema_rp AND table_name = 'room_prices'
               AND column_name = 'room_name') THEN
    sloupce := sloupce || ', room_name';
    hodnoty := hodnoty || ', v.room_name';
  END IF;

  FOREACH sloupec_ceny IN ARRAY ARRAY['base_price', 'weekday_price', 'weekend_price'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = schema_rp AND table_name = 'room_prices'
                 AND column_name = sloupec_ceny) THEN
      sloupce := sloupce || ', ' || sloupec_ceny;
      hodnoty := hodnoty || ', 890';
    END IF;
  END LOOP;

  EXECUTE format($sql$
    INSERT INTO %I.room_prices (%s)
    SELECT %s
    FROM (VALUES
      ('p6',  'Pokoj 1 - Standard',                2, 0),
      ('p5',  'Pokoj 2 - Standard',                2, 0),
      ('pa',  'Pokoj 3 - Nadstandard - Mahagon',   2, 1),
      ('p3',  'Pokoj 4 - Turistický',              2, 0),
      ('p2',  'Pokoj 5 - Turistický',              2, 0),
      ('p1',  'Pokoj 6 - Turistický',              2, 0),
      ('p7',  'Pokoj 7 - Standard',                2, 0),
      ('a1',  'Pokoj 8 - Nadstandard - Motýl',     2, 1),
      ('zen', 'Pokoj 9 - Nadstandard - Zen',       2, 0),
      ('p10', 'Pokoj 10 - Standard',               2, 0),
      ('p11', 'Pokoj 11 - Standard',               2, 0),
      ('p12', 'Pokoj 12 - Standard',               2, 0)
    ) AS v(room_id, room_name, luzka, pristylky)
    WHERE NOT EXISTS (
      SELECT 1 FROM %I.room_prices rp WHERE rp.room_id = v.room_id
    )
  $sql$, schema_rp, sloupce, hodnoty, schema_rp);

  -- Stávající záznamy dostaly z ALTER TABLE výchozí 2 lůžka a 0 přistýlek.
  -- Mahagon a Motýl mají podle dat webu jednu přistýlku navíc.
  -- Nastavuje se jen tam, kde je ještě nikdo neupravil.
  EXECUTE format($sql$
    UPDATE %I.room_prices
    SET max_pristylek = 1
    WHERE room_id IN ('pa', 'a1') AND COALESCE(max_pristylek, 0) = 0
  $sql$, schema_rp);
END $$;


-- ---------------------------------------------------------------------
-- 6) PRÁVA
--    Stejný režim jako u ostatních tabulek webu — ceník čte rezervační
--    formulář (nepřihlášený návštěvník) a zapisuje administrace.
-- ---------------------------------------------------------------------
ALTER TABLE public.cenik_sezony     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_ceny       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_ceny_pokoj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_nastaveni  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename = 'cenik_sezony' AND policyname = 'cenik_sezony_vse') THEN
    CREATE POLICY cenik_sezony_vse ON public.cenik_sezony
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename = 'cenik_ceny' AND policyname = 'cenik_ceny_vse') THEN
    CREATE POLICY cenik_ceny_vse ON public.cenik_ceny
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename = 'cenik_ceny_pokoj' AND policyname = 'cenik_ceny_pokoj_vse') THEN
    CREATE POLICY cenik_ceny_pokoj_vse ON public.cenik_ceny_pokoj
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename = 'cenik_nastaveni' AND policyname = 'cenik_nastaveni_vse') THEN
    CREATE POLICY cenik_nastaveni_vse ON public.cenik_nastaveni
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- =====================================================================
--  OVĚŘENÍ — spusť po migraci
-- =====================================================================

-- a) Sezóny (musí být 3, z toho jedna základní)
-- SELECT nazev, datum_od, datum_do, je_zakladni, vikendovy_priplatek, priorita
-- FROM public.cenik_sezony ORDER BY priorita DESC, nazev;

-- b) Ceník základní sezóny (musí být 12 řádků)
-- SELECT c.kategorie, c.pocet_osob, c.cena_za_osobu_noc
-- FROM public.cenik_ceny c
-- JOIN public.cenik_sezony s ON s.id = c.sezona_id
-- WHERE s.je_zakladni = true
-- ORDER BY c.kategorie, c.pocet_osob;

-- c) Příplatky (musí být 7 řádků)
-- SELECT klic, hodnota, popis, jednotka FROM public.cenik_nastaveni ORDER BY poradi;

-- d) Lůžka u pokojů (musí být 12 řádků)
-- SELECT room_id, room_name, zakladni_luzka, max_pristylek,
--        zakladni_luzka + max_pristylek AS max_osob
-- FROM room_prices ORDER BY room_id;

-- e) Kdyby něco selhalo — kde vlastně room_prices leží:
-- SELECT n.nspname AS schema, c.relname, c.relkind
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE c.relname = 'room_prices';
