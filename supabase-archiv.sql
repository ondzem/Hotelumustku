-- =====================================================================
--  ARCHIV REZERVACÍ + ZIMNÍ PARKOVÁNÍ
--  Vlož celý tento soubor do Supabase → SQL Editor → Run.
--  Je bezpečné ho spustit i opakovaně (IF NOT EXISTS).
-- =====================================================================

-- 1) Sloupce pro archiv
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2) Sloupce pro zimní parkování
--    Dosud se ukládaly jako falešný host uvnitř pole guests, což rozbíjelo
--    počet hostů v ubytovací knize, v e-mailu i na tištěném lístku.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS has_winter_parking boolean NOT NULL DEFAULT false;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS parking_cars_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS winter_parking_price_total integer NOT NULL DEFAULT 0;

-- 3) Index — recepce načítá skoro vždy jen NEarchivované.
--    Částečný index je malý i po letech provozu.
CREATE INDEX IF NOT EXISTS reservations_aktivni_idx
  ON public.reservations (created_at DESC)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS reservations_archiv_idx
  ON public.reservations (archived_at DESC)
  WHERE is_archived = true;

-- 4) Přenos dat ze starého způsobu uložení do nových sloupců.
--    Projde stávající rezervace a vytáhne příznaky z pole guests.
UPDATE public.reservations r
SET is_archived = true,
    archived_at = COALESCE(r.archived_at, now())
WHERE r.is_archived = false
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(r.guests::jsonb) = 'array'
                THEN r.guests::jsonb ELSE '[]'::jsonb END
         ) AS g
    WHERE (g ->> '_is_archived') = 'true'
  );

UPDATE public.reservations r
SET has_winter_parking = COALESCE((w.meta ->> 'has_winter_parking')::boolean, false),
    parking_cars_count = COALESCE((w.meta ->> 'parking_cars_count')::integer, 1),
    winter_parking_price_total = COALESCE((w.meta ->> 'winter_parking_price_total')::integer, 0)
FROM (
  SELECT r2.id, (g -> '_winter_parking') AS meta
  FROM public.reservations r2,
       LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(r2.guests::jsonb) = 'array'
              THEN r2.guests::jsonb ELSE '[]'::jsonb END
       ) AS g
  WHERE g ? '_winter_parking'
) AS w
WHERE r.id = w.id
  AND r.has_winter_parking = false;

-- 5) Vyčištění falešných hostů z pole guests.
--    Odstraní položky, které nejsou skutečný host (nemají jméno)
--    a nesou jen technický příznak.
UPDATE public.reservations r
SET guests = (
  SELECT COALESCE(jsonb_agg(g), '[]'::jsonb)
  FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(r.guests::jsonb) = 'array'
              THEN r.guests::jsonb ELSE '[]'::jsonb END
       ) AS g
  WHERE NOT (g ? '_is_archived')
    AND NOT (g ? '_winter_parking')
)
WHERE jsonb_typeof(r.guests::jsonb) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(r.guests::jsonb) AS g2
    WHERE (g2 ? '_is_archived') OR (g2 ? '_winter_parking')
  );

-- =====================================================================
--  OVĚŘENÍ — spusť po migraci, oba dotazy musí vrátit 0 řádků
-- =====================================================================

-- a) nikde už nesmí být falešný host v poli guests
-- SELECT id, code, guests FROM public.reservations
-- WHERE guests::text LIKE '%_is_archived%'
--    OR guests::text LIKE '%_winter_parking%';

-- b) kontrola, že sloupce existují a mají hodnoty
-- SELECT id, code, is_archived, archived_at,
--        has_winter_parking, parking_cars_count
-- FROM public.reservations
-- ORDER BY created_at DESC
-- LIMIT 10;
