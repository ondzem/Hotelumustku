-- ===================================================================
-- ZABEZPEČENÍ DATABÁZE — pravidla přístupu (Row Level Security)
--
-- PROČ: anonymní klíč je veřejný ve zdrojáku stránky. Bez pravidel s ním
-- kdokoli přečte rezervace i s osobními údaji hostů a kontaktní zprávy,
-- a hlavně smí zapisovat, měnit a MAZAT. Ověřeno 18. 8. 2026: vložení,
-- úprava i smazání blokace anonymním klíčem prošly se stavem 204.
--
-- JAK TO FUNGUJE PO SPUŠTĚNÍ:
--   role `anon`          = návštěvník webu. Smí si objednat, napsat
--                          recenzi a zprávu, a přečíst si jen to, co má
--                          web veřejně ukazovat.
--   role `authenticated` = přihlášený recepční (Supabase Auth). Smí vše.
--
-- Skript je psaný tak, aby šel spustit OPAKOVANĚ.
-- Spouští se ručně v Supabase → SQL Editor.
-- ===================================================================

-- Krok 1: zapnout RLS a SMAZAT VŠECHNA STÁVAJÍCÍ PRAVIDLA.
--
-- Mazat se musí úplně všechna, ne jen ta naše. RLS je totiž POVOLUJÍCÍ:
-- stačí jediné pravidlo, které přístup pustí, a je otevřeno — ostatní
-- pravidla to nezakážou. Když se 18. 8. 2026 pustila první verze skriptu,
-- která maže jen vlastní pravidla `hm_%`, zůstala vedle nich stará
-- povolující pravidla a anonymním klíčem šlo dál číst kontaktní zprávy
-- i přepsat ceník.
--
-- Tabulka, která v projektu není, se přeskočí — skript kvůli ní nespadne.
DO $$
DECLARE
  t text;
  r record;
  tabulky text[] := ARRAY[
    'reservations','contact_messages','reviews','aktuality','blocked_dates',
    'room_prices','disabled_rooms','discount_codes',
    'cenik_sezony','cenik_ceny','cenik_ceny_pokoj','cenik_nastaveni'
  ];
BEGIN
  FOREACH t IN ARRAY tabulky LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Tabulka % v projektu není, přeskakuji.', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ===================================================================
-- PRAVIDLA
--
-- Vytvářejí se v cyklu, aby chybějící tabulka skript nezhodila. Jedna
-- neexistující tabulka uprostřed jinak shodí i všechno za ní a databáze
-- zůstane odemčená — přesně to se stalo při prvním pokusu.
--
--   'cti'    = anon smí číst všechno v tabulce
--   'zapis'  = anon smí zakládat nové řádky
--   <výraz>  = anon smí číst jen řádky, které výrazu vyhoví
-- Recepce (authenticated) má vždy plný přístup.
-- ===================================================================
DO $$
DECLARE
  z record;
BEGIN
  FOR z IN
    SELECT * FROM (VALUES
      -- tabulka,            čtení pro anon,        zápis pro anon
      ('reservations',       'true',                 true),
      ('contact_messages',   NULL,                   true),
      ('reviews',            'status = ''approved''', true),
      ('aktuality',          'true',                 false),
      ('blocked_dates',      'true',                 false),
      ('room_prices',        'true',                 false),
      ('disabled_rooms',     'true',                 false),
      ('discount_codes',     'is_active = true',     false),
      ('cenik_sezony',       'true',                 false),
      ('cenik_ceny',         'true',                 false),
      ('cenik_ceny_pokoj',   'true',                 false),
      ('cenik_nastaveni',    'true',                 false)
    ) AS t(tabulka, cteni, zapis)
  LOOP
    IF to_regclass('public.' || z.tabulka) IS NULL THEN
      RAISE NOTICE 'Tabulka % v projektu není, přeskakuji.', z.tabulka;
      CONTINUE;
    END IF;

    IF z.cteni IS NOT NULL THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (%s)',
                     'hm_' || z.tabulka || '_cteni', z.tabulka, z.cteni);
    END IF;

    IF z.zapis THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO anon WITH CHECK (true)',
                     'hm_' || z.tabulka || '_zapis', z.tabulka);
    END IF;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                   'hm_' || z.tabulka || '_recepce', z.tabulka);
  END LOOP;
END $$;

-- ===================================================================
-- OSOBNÍ ÚDAJE HOSTŮ
--
-- Řádkové pravidlo výš pouští anon do tabulky rezervací, protože veřejný
-- kalendář musí vidět obsazenost. Jména, e-maily, telefony a adresy ale
-- chrání oprávnění na SLOUPCE — PostgREST je respektuje, takže `select=*`
-- i `select=guest_email` skončí chybou 42501.
--
-- Kdyby kalendář někdy potřeboval další sloupec, přidej ho do GRANT.
-- NIKDY nevracej SELECT na celou tabulku.
-- ===================================================================
DO $$
BEGIN
  IF to_regclass('public.reservations') IS NOT NULL THEN
    REVOKE SELECT ON public.reservations FROM anon;
    GRANT  SELECT (room_id, date_from, date_to, status) ON public.reservations TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- KONTROLA — tenhle výpis se ukáže po spuštění.
-- U každé tabulky musí být RLS = true a pravidla jen 'hm_...'.
-- U rezervací musí anon vidět POUZE room_id, date_from, date_to, status.
-- ===================================================================
SELECT
  c.relname                                        AS tabulka,
  c.relrowsecurity                                 AS rls_zapnute,
  (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname)               AS pravidel_celkem,
  (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname
       AND p.policyname NOT LIKE 'hm_%')                                      AS cizich_pravidel
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND c.relname IN ('reservations','contact_messages','reviews','aktuality',
                    'blocked_dates','room_prices','disabled_rooms','discount_codes',
                    'cenik_sezony','cenik_ceny','cenik_ceny_pokoj','cenik_nastaveni')
ORDER BY c.relname;
