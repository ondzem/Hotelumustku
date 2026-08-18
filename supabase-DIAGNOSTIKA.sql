-- ===================================================================
-- DIAGNOSTIKA ZABEZPEČENÍ — nic nemění, jen vypisuje.
--
-- JE TO JEDEN DOTAZ. SQL Editor ukazuje jen výsledek posledního příkazu,
-- proto je všechno slepené do jedné tabulky.
-- Spustit celé a poslat výsledek.
-- ===================================================================
WITH tabulky AS (
  SELECT unnest(ARRAY[
    'reservations','contact_messages','reviews','aktuality','blocked_dates',
    'room_prices','disabled_rooms','discount_codes',
    'cenik_sezony','cenik_ceny','cenik_ceny_pokoj','cenik_nastaveni'
  ]) AS t
)
SELECT
  tabulky.t AS tabulka,
  CASE WHEN to_regclass('public.' || tabulky.t) IS NULL THEN 'NEEXISTUJE'
       WHEN (SELECT c.relrowsecurity FROM pg_class c
              WHERE c.oid = to_regclass('public.' || tabulky.t)) THEN 'ano'
       ELSE 'NE !!' END AS rls,
  COALESCE((SELECT string_agg(p.cmd || ':' || p.policyname, ', ' ORDER BY p.policyname)
     FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = tabulky.t
       AND p.policyname LIKE 'hm_%'), '—') AS nase_pravidla,
  COALESCE((SELECT string_agg(p.policyname, ', ' ORDER BY p.policyname)
     FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = tabulky.t
       AND p.policyname NOT LIKE 'hm_%'), '—') AS CIZI_PRAVIDLA,
  COALESCE((SELECT string_agg(DISTINCT tp.privilege_type, ',' ORDER BY tp.privilege_type)
     FROM information_schema.table_privileges tp
     WHERE tp.grantee = 'anon' AND tp.table_schema = 'public'
       AND tp.table_name = tabulky.t), '—') AS opravneni_anon
FROM tabulky
ORDER BY 1;
