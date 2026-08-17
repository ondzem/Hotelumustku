-- ============================================================
-- VÍKENDOVÝ PŘÍPLATEK PODLE KATEGORIE POKOJE
--
-- Příplatek za pátek, sobotu a neděli se nově řídí kategorií
-- pokoje a platí stejně pro všechny sezóny:
--   Standard (i turistický) …  60 Kč / osoba / noc
--   Nadstandard            … 100 Kč / osoba / noc
--
-- Obsluha ho mění v administraci: Ceník → Příplatky a poplatky.
-- Starý sloupec cenik_sezony.vikendovy_priplatek zůstává v tabulce,
-- ale výpočet ceny ho už nečte.
--
-- Spouští se ručně v Supabase → SQL Editor. Lze spustit opakovaně —
-- už existující hodnoty nepřepíše.
-- ============================================================

INSERT INTO public.cenik_nastaveni (klic, hodnota, popis, jednotka, poradi) VALUES
  ('vikend_standard',     60, 'Víkendový příplatek — Standard (pá, so, ne)',    'Kč / osoba / noc', 8),
  ('vikend_nadstandard', 100, 'Víkendový příplatek — Nadstandard (pá, so, ne)', 'Kč / osoba / noc', 9)
ON CONFLICT (klic) DO NOTHING;

-- Ať API novou hodnotu vidí hned, bez restartu projektu.
NOTIFY pgrst, 'reload schema';

-- Kontrola:
-- SELECT klic, hodnota, popis FROM public.cenik_nastaveni WHERE klic LIKE 'vikend%';
