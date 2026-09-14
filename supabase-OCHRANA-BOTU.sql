-- ============================================================
--  OCHRANA PROTI ROBOTŮM — zavření přímého zápisu z prohlížeče
--
--  Rezervace, recenze i kontaktní zprávy se zapisovaly přímo
--  z prohlížeče anonymním klíčem. Ten klíč je vidět ve zdrojáku
--  stránky, takže si ho robot přečte a posílá zápisy rovnou do
--  Supabase REST API — formulář vůbec neotevře. Captcha ani honeypot
--  na to nemají jak dosáhnout, protože se nikdy nevykreslí.
--
--  Zápis proto nově vede JEDINĚ přes netlify/functions/zapis-formulare.js,
--  která ověří token z Cloudflare Turnstile a použije servisní klíč.
--  Tenhle skript zavírá tu druhou cestu.
--
--  POZOR: spustit AŽ POTÉ, co je nasazená verze webu, která zapisuje
--  přes serverovou funkci. Když se to pustí dřív, přestanou jít odeslat
--  rezervace, recenze i zprávy.
--
--  Skript jde spustit opakovaně.
-- ============================================================

-- 1) Zrušit pravidla, která anonymnímu klíči dovolovala zápis.
--    Názvy odpovídají supabase-ZABEZPECENI.sql a -2.sql.
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['reservations', 'reviews', 'contact_messages'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Tabulka % neexistuje, přeskakuji.', t;
      CONTINUE;
    END IF;

    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'INSERT'
        AND 'anon' = ANY(roles)
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      RAISE NOTICE 'Zrušeno pravidlo %.%', t, p.policyname;
    END LOOP;
  END LOOP;
END $$;

-- 2) Odebrat anonymnímu klíči i samotné právo INSERT.
--    Pravidla RLS jsou jedna vrstva, oprávnění druhá — bez obojího by
--    stačilo, aby někdo v budoucnu omylem přidal povolující pravidlo.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reservations', 'reviews', 'contact_messages'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- 3) Servisní klíč (role service_role) obchází RLS z principu, takže
--    serverová funkce zapisuje dál. Nic se mu nepřidává.

-- ============================================================
--  KONTROLA — po spuštění musí u všech tří tabulek vyjít nula
-- ============================================================
SELECT
  t.tabulka,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t.tabulka
      AND cmd = 'INSERT' AND 'anon' = ANY(roles))            AS anon_insert_pravidel,
  has_table_privilege('anon', 'public.' || t.tabulka, 'INSERT') AS anon_smi_insert
FROM (VALUES ('reservations'), ('reviews'), ('contact_messages')) AS t(tabulka);
