-- ============================================================
-- ÚLOŽIŠTĚ PRO FOTKY AKTUALIT
--
-- Koš `aktuality-images` v tomto projektu chyběl — zůstal ve starém
-- projektu, ze kterého se web stěhoval. Nahrání fotky proto končilo
-- chybou „Bucket not found“.
--
-- POZOR na pravidla přístupu: koš je veřejný jen pro ČTENÍ. Zápis
-- schválně NEMÁ povolený anonymní klíč — ten je vidět ve zdrojáku
-- stránky, takže by kdokoli mohl do koše nahrávat soubory nebo hotelu
-- mazat fotky. Nahrávání obstarává serverová funkce
-- netlify/functions/upload-news-image.js servisním klíčem.
--
-- Spouští se ručně v Supabase → SQL Editor. Lze spustit opakovaně.
-- Když koš už existuje (typicky založený přes Storage → New bucket),
-- jen mu srovná nastavení.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aktuality-images',
  'aktuality-images',
  true,                                      -- veřejné čtení fotek na webu
  5242880,                                   -- 5 MB strop na soubor
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

NOTIFY pgrst, 'reload schema';

-- Kontrola:
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'aktuality-images';
