-- =====================================================================
--  KROK 1 PŘESUNU — vyčtení struktury ze STARÉHO projektu
--
--  Spusť ve starém projektu (jpvnvjcktpxyxrvsdukm) → SQL Editor.
--  Nic nemění, jen čte.
--
--  Je to JEDEN dotaz — označ celý soubor, dej Run a pošli výsledek.
--  (Supabase při více dotazech ukáže jen ten poslední, proto je
--   všechno slepené do jedné tabulky se sloupcem "sekce".)
--
--  Sekce 1 = sloupce a typy
--  Sekce 2 = klíče, jedinečnost, kontroly, vazby
--  Sekce 3 = indexy
--  Sekce 4 = ochrana řádků
--  Sekce 5 = pravidla přístupu
-- =====================================================================

SELECT * FROM (

  -- 1) sloupce, typy, povinnost, výchozí hodnoty
  SELECT
    1                        AS sekce,
    c.table_name::text       AS tabulka,
    c.ordinal_position::int  AS poradi,
    c.column_name::text      AS a,
    c.data_type::text        AS b,
    c.character_maximum_length::text AS c,
    c.is_nullable::text      AS d,
    c.column_default::text   AS e,
    NULL::text               AS f
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'

  UNION ALL

  -- 2) klíče, jedinečnost, kontroly, vazby
  SELECT
    2,
    cl.relname::text,
    NULL::int,
    co.conname::text,
    pg_get_constraintdef(co.oid),
    NULL, NULL, NULL, NULL
  FROM pg_constraint co
  JOIN pg_class cl     ON cl.oid = co.conrelid
  JOIN pg_namespace ns ON ns.oid = cl.relnamespace
  WHERE ns.nspname = 'public'

  UNION ALL

  -- 3) indexy
  SELECT
    3,
    i.tablename::text,
    NULL::int,
    i.indexname::text,
    i.indexdef::text,
    NULL, NULL, NULL, NULL
  FROM pg_indexes i
  WHERE i.schemaname = 'public'

  UNION ALL

  -- 4) u kterých tabulek je zapnutá ochrana řádků
  SELECT
    4,
    cl.relname::text,
    NULL::int,
    cl.relrowsecurity::text,
    NULL, NULL, NULL, NULL, NULL
  FROM pg_class cl
  JOIN pg_namespace ns ON ns.oid = cl.relnamespace
  WHERE ns.nspname = 'public'
    AND cl.relkind = 'r'

  UNION ALL

  -- 5) pravidla přístupu
  SELECT
    5,
    p.tablename::text,
    NULL::int,
    p.policyname::text,
    p.permissive::text,
    p.roles::text,
    p.cmd::text,
    p.qual::text,
    p.with_check::text
  FROM pg_policies p
  WHERE p.schemaname = 'public'

) AS vse
ORDER BY sekce, tabulka, poradi NULLS FIRST, a;
