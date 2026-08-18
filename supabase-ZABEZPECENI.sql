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

-- Krok 1: zapnout RLS všude. Bez toho se pravidla neuplatní vůbec.
ALTER TABLE public.reservations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aktuality         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disabled_rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_sezony      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_ceny        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_ceny_pokoj  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_nastaveni   ENABLE ROW LEVEL SECURITY;

-- Krok 2: smazat případná stará pravidla, ať jde skript pustit znovu.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'hm_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ===================================================================
-- REZERVACE
-- Host smí založit rezervaci. Číst smí jen obsazenost — a to díky
-- oprávnění na SLOUPCE níž, ne celý řádek. Měnit a mazat nesmí nic.
-- ===================================================================
CREATE POLICY hm_rezervace_zapis_host ON public.reservations
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY hm_rezervace_cteni_obsazenost ON public.reservations
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_rezervace_recepce ON public.reservations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Osobní údaje se anonymnímu klíči neposkytnou vůbec. PostgREST
-- respektuje oprávnění na sloupce, takže `select=*` vrátí chybu
-- a `select=guest_email` taky — projde jen výčet níž.
REVOKE SELECT ON public.reservations FROM anon;
GRANT  SELECT (room_id, date_from, date_to, status) ON public.reservations TO anon;

-- ===================================================================
-- KONTAKTNÍ ZPRÁVY — poslat smí kdokoli, číst nikdo kromě recepce.
-- ===================================================================
CREATE POLICY hm_zpravy_zapis ON public.contact_messages
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY hm_zpravy_recepce ON public.contact_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================================================================
-- RECENZE — napsat smí kdokoli, ale veřejně jsou vidět jen schválené.
-- ===================================================================
CREATE POLICY hm_recenze_zapis ON public.reviews
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY hm_recenze_cteni_schvalenych ON public.reviews
  FOR SELECT TO anon USING (status = 'approved');
CREATE POLICY hm_recenze_recepce ON public.reviews
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================================================================
-- OBSAH A CENÍK — návštěvník jen čte, zapisuje výhradně recepce.
-- ===================================================================
CREATE POLICY hm_aktuality_cteni ON public.aktuality
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_aktuality_recepce ON public.aktuality
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hm_blokace_cteni ON public.blocked_dates
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_blokace_recepce ON public.blocked_dates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hm_pokoje_cteni ON public.room_prices
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_pokoje_recepce ON public.room_prices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hm_vypnute_cteni ON public.disabled_rooms
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_vypnute_recepce ON public.disabled_rooms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hm_sezony_cteni ON public.cenik_sezony
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_sezony_recepce ON public.cenik_sezony
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hm_ceny_cteni ON public.cenik_ceny
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_ceny_recepce ON public.cenik_ceny
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hm_ceny_pokoj_cteni ON public.cenik_ceny_pokoj
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_ceny_pokoj_recepce ON public.cenik_ceny_pokoj
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hm_nastaveni_cteni ON public.cenik_nastaveni
  FOR SELECT TO anon USING (true);
CREATE POLICY hm_nastaveni_recepce ON public.cenik_nastaveni
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================================================================
-- SLEVOVÉ KÓDY — rezervační formulář si je načítá, aby kód ověřil,
-- takže aktivní kódy veřejné zůstat musí. Neaktivní a chystané ne.
-- ===================================================================
CREATE POLICY hm_slevy_cteni_aktivnich ON public.discount_codes
  FOR SELECT TO anon USING (is_active = true);
CREATE POLICY hm_slevy_recepce ON public.discount_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
