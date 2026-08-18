-- ===================================================================
-- DIAGNOSTIKA ZABEZPEČENÍ — nic nemění, jen vypisuje stav.
-- Spustit v Supabase → SQL Editor a poslat výsledek.
-- ===================================================================

-- 1) Jaká pravidla na tabulkách opravdu jsou
SELECT
  tablename                       AS tabulka,
  policyname                      AS pravidlo,
  cmd                             AS operace,
  COALESCE(array_to_string(roles, ','), '(všichni)') AS pro_role
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2) Kde je RLS zapnuté a kolik je tam pravidel
SELECT
  c.relname                                     AS tabulka,
  c.relrowsecurity                              AS rls_zapnute,
  (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname='public' AND p.tablename=c.relname) AS pravidel
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
ORDER BY c.relname;

-- 3) Co přesně smí role anon u každé tabulky
SELECT
  table_name                             AS tabulka,
  string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS opravneni
FROM information_schema.table_privileges
WHERE grantee = 'anon' AND table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- 4) Které sloupce rezervací smí anon číst (musí být právě čtyři)
SELECT column_name AS sloupec
FROM information_schema.column_privileges
WHERE grantee='anon' AND table_schema='public'
  AND table_name='reservations' AND privilege_type='SELECT'
ORDER BY column_name;
