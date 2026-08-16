-- =====================================================================
--  ÚKLID — vrátí zpět změny z supabase-cenik.sql
--
--  Spusť TOHLE ve špatném projektu, kam skript omylem doběhl.
--
--  Co udělá:
--    • smaže čtyři tabulky ceníku (cenik_sezony, cenik_ceny,
--      cenik_ceny_pokoj, cenik_nastaveni) — ty tam předtím nebyly
--    • odebere z room_prices dva sloupce, které ceník přidal
--      (zakladni_luzka, max_pristylek)
--    • odebere jedinečné omezení, které ceník doplnil
--      (jen to s naším názvem room_prices_room_id_unikat)
--
--  Co NEUDĚLÁ:
--    • nesmaže samotnou tabulku room_prices ani žádná tvoje data.
--      Kdyby ji tam ceník teprve založil, skript na to na konci
--      upozorní a smazání necháš na sobě — viz KROK 2 dole.
-- =====================================================================


-- ---------------------------------------------------------------------
-- KROK 1 — automatický úklid
-- ---------------------------------------------------------------------

DROP TABLE IF EXISTS public.cenik_ceny_pokoj CASCADE;
DROP TABLE IF EXISTS public.cenik_ceny       CASCADE;
DROP TABLE IF EXISTS public.cenik_nastaveni  CASCADE;
DROP TABLE IF EXISTS public.cenik_sezony     CASCADE;

DO $$
DECLARE
  schema_rp  text;
  pocet      integer;
  nasich     integer;
  vlozenych  integer;
  ma_sloupce boolean;
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
    RAISE NOTICE 'Tabulka room_prices tu není, nic dalšího k úklidu.';
    RETURN;
  END IF;

  -- Kolik řádků v ní je a kolik z nich vypadá jako naše nasazená data
  EXECUTE format('SELECT count(*) FROM %I.room_prices', schema_rp) INTO pocet;
  EXECUTE format($q$
    SELECT count(*) FROM %I.room_prices
    WHERE room_id IN ('p1','p2','p3','p5','p6','p7','p10','p11','p12','pa','a1','zen')
  $q$, schema_rp) INTO nasich;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = schema_rp AND table_name = 'room_prices'
      AND column_name = 'zakladni_luzka'
  ) INTO ma_sloupce;

  -- Odeber jedinečné omezení, ale jen to s naším názvem.
  -- Cizí omezení se nikdy nedotkneme.
  IF EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'room_prices'
      AND n.nspname = schema_rp
      AND con.conname = 'room_prices_room_id_unikat'
  ) THEN
    EXECUTE format('ALTER TABLE %I.room_prices DROP CONSTRAINT room_prices_room_id_unikat', schema_rp);
    RAISE NOTICE 'Odebráno jedinečné omezení room_prices_room_id_unikat.';
  END IF;

  -- Odeber přidané sloupce
  EXECUTE format('ALTER TABLE %I.room_prices DROP COLUMN IF EXISTS zakladni_luzka', schema_rp);
  EXECUTE format('ALTER TABLE %I.room_prices DROP COLUMN IF EXISTS max_pristylek', schema_rp);

  RAISE NOTICE '---------------------------------------------------------';
  RAISE NOTICE 'Tabulky ceníku smazány.';

  IF ma_sloupce THEN
    RAISE NOTICE 'Z %.room_prices odebrány sloupce zakladni_luzka a max_pristylek.', schema_rp;
  END IF;

  RAISE NOTICE 'V %.room_prices zůstává % řádků, z toho % s ID pokojů hotelu.', schema_rp, pocet, nasich;

  -- Kolik řádků tam ceník sám vložil. Poznají se podle názvu pokoje,
  -- který skript zapisuje v přesně daném tvaru.
  EXECUTE format($q$
    SELECT count(*) FROM %I.room_prices
    WHERE room_name IN (
      'Pokoj 1 - Standard', 'Pokoj 2 - Standard', 'Pokoj 3 - Nadstandard - Mahagon',
      'Pokoj 4 - Turistický', 'Pokoj 5 - Turistický', 'Pokoj 6 - Turistický',
      'Pokoj 7 - Standard', 'Pokoj 8 - Nadstandard - Motýl', 'Pokoj 9 - Nadstandard - Zen',
      'Pokoj 10 - Standard', 'Pokoj 11 - Standard', 'Pokoj 12 - Standard')
  $q$, schema_rp) INTO vlozenych;

  IF pocet = nasich AND pocet = 12 THEN
    RAISE NOTICE 'POZOR: vypadá to, že celou tabulku room_prices založil až ceník.';
    RAISE NOTICE 'Jestli tam předtím nebyla, smaž ji ručně — viz KROK 2 na konci souboru.';
  ELSIF vlozenych > 0 THEN
    RAISE NOTICE 'Tabulka room_prices tu byla už dřív, ale ceník do ní vložil % nových řádků.', vlozenych;
    RAISE NOTICE 'Zkontroluj je a smaž ručně — viz KROK 3 na konci souboru.';
  ELSE
    RAISE NOTICE 'Tabulka room_prices je v původním stavu, nic dalšího řešit netřeba.';
  END IF;
  RAISE NOTICE '---------------------------------------------------------';
END $$;

NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- KROK 2 — jen když to skript nahoře doporučí
--
--   Pusť POUZE tehdy, když jsi si jistý, že tabulka room_prices
--   v tomhle projektu předtím nebyla. Odstraň znaky -- před řádkem.
-- ---------------------------------------------------------------------

-- DROP TABLE IF EXISTS public.room_prices CASCADE;


-- ---------------------------------------------------------------------
-- KROK 3 — jen když to skript nahoře doporučí
--
--   Nejdřív se podívej, co by se smazalo:
-- ---------------------------------------------------------------------

-- SELECT room_id, room_name FROM room_prices
-- WHERE room_name IN (
--   'Pokoj 1 - Standard', 'Pokoj 2 - Standard', 'Pokoj 3 - Nadstandard - Mahagon',
--   'Pokoj 4 - Turistický', 'Pokoj 5 - Turistický', 'Pokoj 6 - Turistický',
--   'Pokoj 7 - Standard', 'Pokoj 8 - Nadstandard - Motýl', 'Pokoj 9 - Nadstandard - Zen',
--   'Pokoj 10 - Standard', 'Pokoj 11 - Standard', 'Pokoj 12 - Standard');

--   A když to sedí, teprve pak smaž:

-- DELETE FROM room_prices
-- WHERE room_name IN (
--   'Pokoj 1 - Standard', 'Pokoj 2 - Standard', 'Pokoj 3 - Nadstandard - Mahagon',
--   'Pokoj 4 - Turistický', 'Pokoj 5 - Turistický', 'Pokoj 6 - Turistický',
--   'Pokoj 7 - Standard', 'Pokoj 8 - Nadstandard - Motýl', 'Pokoj 9 - Nadstandard - Zen',
--   'Pokoj 10 - Standard', 'Pokoj 11 - Standard', 'Pokoj 12 - Standard');


-- ---------------------------------------------------------------------
-- KONTROLA — po úklidu musí všechny čtyři dotazy skončit chybou
--            "relation does not exist"
-- ---------------------------------------------------------------------

-- SELECT * FROM cenik_sezony;
-- SELECT * FROM cenik_ceny;
-- SELECT * FROM cenik_ceny_pokoj;
-- SELECT * FROM cenik_nastaveni;
