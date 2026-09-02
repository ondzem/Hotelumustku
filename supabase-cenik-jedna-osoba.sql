-- Příplatek za jednu osobu na pokoji (2. 9. 2026)
--
-- Sloupec „1 osoba" v ceníku byl zrušen. Sólo host platí sazbu pro dvě
-- osoby plus tento příplatek (Kč / NOC), zvlášť pro standard a nadstandard.
-- Městský poplatek je v ceně a z Příplatků mizí; příplatek za pobyt na
-- jednu noc nemůže nastat (formulář vyžaduje dvě noci).
--
-- Lze spouštět opakovaně. Řádky cenik_ceny s pocet_osob = 1 zůstávají,
-- výpočet je jen nečte.

INSERT INTO public.cenik_nastaveni (klic, hodnota, popis, jednotka, poradi) VALUES
  ('solo_standard',    150, 'Příplatek za jednu osobu na pokoji — Standard a turistický', 'Kč / noc', 5),
  ('solo_nadstandard', 890, 'Příplatek za jednu osobu na pokoji — Nadstandard',           'Kč / noc', 6)
ON CONFLICT (klic) DO NOTHING;

DELETE FROM public.cenik_nastaveni WHERE klic IN ('mestsky_poplatek', 'priplatek_1_noc');

-- Kontrola
SELECT klic, hodnota, popis, jednotka FROM public.cenik_nastaveni ORDER BY poradi;
