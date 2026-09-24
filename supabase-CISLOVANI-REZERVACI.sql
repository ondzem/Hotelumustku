-- ============================================================
--  ČÍSLOVÁNÍ REZERVACÍ — řada od 2000 místo náhodných čísel
--
--  Kód rezervace byl `HM-<rok>-<náhodná čtyřčíslí>`. Vypadalo to jako
--  pořadí, ale žádné nebylo: čísla skákala a nešlo z nich poznat, kolik
--  rezervací hotel měl. Nově je to řada, která začíná na 2000 — aby
--  hned první host nedostal „objednávku číslo 1".
--
--  Co skript udělá:
--    1. přidá sloupec `cislo` (pořadí v řadě) a posloupnost od 2000,
--    2. dorovná čísla všem rezervacím, které ho ještě nemají, v pořadí
--       podle data vzniku (první zapsaná dostane 2000),
--    3. přepíše `code` na `HM-<rok vzniku>-<cislo>`,
--    4. založí funkci `dalsi_cislo_rezervace()`, ze které si číslo bere
--       web i ruční zápis, a zamkne kód i číslo unikátním indexem.
--
--  ČÍSLO SE NIKDY NEVRACÍ DO OBĚHU. Stornovaná rezervace si své číslo
--  nechá: host ho má v e-mailu a nese ho i variabilní symbol platby
--  (`getVariableSymbol`). Kdyby se stejné číslo vydalo podruhé, přišla
--  by na účet platba, která sedí na dvě různé rezervace, a v knize by
--  byly dva různé pobyty pod jedním kódem. Mezera v řadě po stornu je
--  proti tomu neškodná — a je i doklad, že se něco stornovalo.
--
--  Skript jde spustit opakovaně: dorovnává jen to, co ještě nemá číslo.
-- ============================================================

-- 1) Sloupec a posloupnost ------------------------------------------------
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS cislo integer;

CREATE SEQUENCE IF NOT EXISTS public.rezervace_cislo_seq AS integer
  START WITH 2000 MINVALUE 2000 NO CYCLE;

-- 2) Dorovnat čísla tomu, co v knize už je -------------------------------
--    Pořadí podle `created_at`; při shodě rozhoduje `id`, aby byl
--    výsledek stejný při každém spuštění (Postgres jinak vrací řádky se
--    stejným časem pokaždé jinak).
DO $$
DECLARE zaklad integer;
BEGIN
  SELECT COALESCE(MAX(cislo), 1999) INTO zaklad FROM public.reservations;

  WITH serazene AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS poradi
    FROM public.reservations
    WHERE cislo IS NULL
  )
  UPDATE public.reservations r
  SET cislo = zaklad + s.poradi
  FROM serazene s
  WHERE r.id = s.id;
END $$;

-- 3) Přepsat kódy do nové podoby -----------------------------------------
UPDATE public.reservations
SET code = 'HM-' || to_char(COALESCE(created_at, now()), 'YYYY') || '-' || cislo::text
WHERE cislo IS NOT NULL
  AND code IS DISTINCT FROM
      'HM-' || to_char(COALESCE(created_at, now()), 'YYYY') || '-' || cislo::text;

-- 4) Posunout posloupnost za poslední použité číslo ----------------------
--    Nikdy zpátky: číslo, které už si někdo vyzvedl a ještě ho nestihl
--    zapsat, se nesmí vydat podruhé. Proto GREATEST — posloupnost se
--    při opakovaném spuštění skriptu jen dorovná dopředu.
SELECT setval('public.rezervace_cislo_seq',
              GREATEST(
                (SELECT COALESCE(MAX(cislo), 1999) + 1 FROM public.reservations),
                (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
                   FROM public.rezervace_cislo_seq)
              ),
              false);

-- 5) Zamknout jedinečnost -------------------------------------------------
--    Bez indexu by dvě rezervace založené v tutéž vteřinu mohly dostat
--    stejný kód a nikdo by si toho nevšiml.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_code_uniq ON public.reservations (code);
CREATE UNIQUE INDEX IF NOT EXISTS reservations_cislo_uniq ON public.reservations (cislo);

-- 6) Funkce, ze které si číslo bere web i administrace --------------------
--    SECURITY DEFINER proto, aby recepční nemusel mít právo na samotnou
--    posloupnost. Anonymní návštěvník ji volat nesmí — veřejný formulář
--    si číslo nebere sám, přiděluje ho serverová funkce servisním klíčem
--    (netlify/functions/zapis-formulare.js).
CREATE OR REPLACE FUNCTION public.dalsi_cislo_rezervace()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.rezervace_cislo_seq')::integer;
$$;

REVOKE EXECUTE ON FUNCTION public.dalsi_cislo_rezervace() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dalsi_cislo_rezervace() FROM anon;
GRANT EXECUTE ON FUNCTION public.dalsi_cislo_rezervace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dalsi_cislo_rezervace() TO service_role;

-- Recepční musí `cislo` vidět i zapsat (ruční zápis rezervace).
GRANT SELECT (cislo), INSERT (cislo), UPDATE (cislo) ON public.reservations TO authenticated;

-- ============================================================
--  KONTROLA — čísla musí jít v řadě a kódy jim odpovídat
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM public.reservations)                                   AS rezervaci_celkem,
  (SELECT COUNT(*) FROM public.reservations WHERE cislo IS NULL)               AS bez_cisla,
  (SELECT MIN(cislo) FROM public.reservations)                                 AS nejnizsi_cislo,
  (SELECT MAX(cislo) FROM public.reservations)                                 AS nejvyssi_cislo,
  (SELECT COUNT(*) FROM public.reservations
     WHERE code IS DISTINCT FROM 'HM-' || to_char(COALESCE(created_at, now()), 'YYYY')
                                 || '-' || cislo::text)                        AS nesedici_kody,
  (SELECT last_value FROM public.rezervace_cislo_seq)                          AS dalsi_v_rade;
