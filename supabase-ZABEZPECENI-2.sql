-- ===================================================================
--  DOPLNĚK ZABEZPEČENÍ — CO SMÍ ANONYM ZAPSAT
--
--  supabase-ZABEZPECENI.sql zavírá ČTENÍ, ale zápis pouští s
--  `WITH CHECK (true)`. To znamená, že návštěvník smí do řádku napsat
--  cokoli — včetně sloupců, které rozhodují o tom, co web ukáže a co
--  systém považuje za zaplacené.
--
--  Ověřeno 1. 9. 2026 proti nasazenému projektu veřejným anon klíčem:
--
--   * recenze: POST se `status: 'approved'` prošel a recenze se
--     OKAMŽITĚ objevila na webu — bez schválení recepcí.
--   * rezervace: nic nebrání poslat `status: 'confirmed'` a vlastní
--     `total_price`. Taková rezervace vypadá jako zaplacená záloha
--     (viz maZaplacenouZalohu v pricing.js) a zabere pokoj v kalendáři.
--
--  Skript se smí pouštět OPAKOVANĚ.
--  Spouští se ručně v Supabase → SQL Editor, AŽ PO supabase-ZABEZPECENI.sql.
-- ===================================================================

-- ===================================================================
-- 1) NOVÁ RECENZE JE VŽDY NESCHVÁLENÁ
-- ===================================================================
DROP POLICY IF EXISTS hm_reviews_zapis ON public.reviews;

CREATE POLICY hm_reviews_zapis ON public.reviews
  FOR INSERT TO anon
  WITH CHECK (status = 'pending_approval');

-- Sloupce, do kterých smí návštěvník psát. Bez tohohle by šlo přepsat
-- `created_at` a posunout recenzi na začátek seznamu.
REVOKE INSERT ON public.reviews FROM anon;
-- created_at MUSÍ být v seznamu — formulář recenzí ho posílá.
-- Bez něj vrátí zápis 42501 „permission denied for table reviews"
-- a hostovi se recenze tiše neuloží.
GRANT  INSERT (id, author_name, full_name, text, date, status, created_at) ON public.reviews TO anon;

-- ===================================================================
-- 2) NOVÁ REZERVACE JE VŽDY „KE SCHVÁLENÍ“
--
--    Cenu si sice pořád počítá prohlížeč, ale rezervace, která tvrdí,
--    že je potvrzená a zaplacená, už takhle vzniknout nemůže. Recepce
--    stav mění přihlášená, na tu se pravidlo nevztahuje.
-- ===================================================================
DROP POLICY IF EXISTS hm_reservations_zapis ON public.reservations;

CREATE POLICY hm_reservations_zapis ON public.reservations
  FOR INSERT TO anon
  WITH CHECK (status = 'pending_approval' AND is_archived IS NOT TRUE);

-- ===================================================================
-- KONTROLNÍ VÝPIS
--
--   `zapisove_pravidlo` musí u obou tabulek obsahovat podmínku na stav.
--   Když je tam `true`, skript neproběhl.
-- ===================================================================
SELECT
  tablename                                   AS tabulka,
  policyname                                  AS pravidlo,
  COALESCE(with_check, '(bez podmínky)')      AS zapisove_pravidlo
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('reviews', 'reservations')
  AND cmd = 'INSERT'
ORDER BY tablename;
