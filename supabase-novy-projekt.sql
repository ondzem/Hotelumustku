-- =====================================================================
--  ZALOŽENÍ DATABÁZE V NOVÉM PROJEKTU
--
--  Vygenerováno ze skutečné struktury starého projektu
--  (jpvnvjcktpxyxrvsdukm), ne odhadem z kódu.
--
--  Vlož celý soubor do NOVÉHO projektu → SQL Editor → Run.
--  Je bezpečné ho spustit i opakovaně.
--
--  Zakládá 12 tabulek se všemi sloupci, typy, výchozími hodnotami,
--  klíči, kontrolami, vazbami, indexy, ochranou řádků i pravidly
--  přístupu. Data se přenášejí zvlášť druhým skriptem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABULKY
--    Pořadí respektuje vazby: cenik_sezony musí vzniknout dřív
--    než tabulky, které na ni odkazují.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.aktuality (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  is_banner boolean NOT NULL DEFAULT false,
  banner_text text,
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL DEFAULT 'all'::text,
  date_from date NOT NULL,
  date_to date NOT NULL,
  reason text DEFAULT 'Uzávěrka recepce'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cenik_nastaveni (
  klic text NOT NULL,
  hodnota integer NOT NULL DEFAULT 0,
  popis text,
  jednotka text,
  poradi integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cenik_sezony (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nazev text NOT NULL,
  datum_od text,
  datum_do text,
  opakuje_se boolean NOT NULL DEFAULT true,
  je_zakladni boolean NOT NULL DEFAULT false,
  vikendovy_priplatek integer NOT NULL DEFAULT 0,
  priorita integer NOT NULL DEFAULT 0,
  poznamka text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  surname text NOT NULL,
  email text NOT NULL,
  phone text,
  message text,
  status text DEFAULT 'new'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disabled_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  is_disabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent'::text,
  discount_value numeric NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  valid_from date,
  valid_until date,
  max_uses integer,
  used_count integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.reservations (
  id text NOT NULL,
  code text NOT NULL,
  manage_token text,
  room_id text NOT NULL,
  room_name text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text NOT NULL,
  guest_note text,
  guest_street text,
  guest_city text,
  guest_zip text,
  guest_country text DEFAULT 'Česká republika'::text,
  guests jsonb DEFAULT '[]'::jsonb,
  adults_count integer DEFAULT 1,
  children_count integer DEFAULT 0,
  has_dog boolean DEFAULT false,
  has_ebike boolean DEFAULT false,
  ebike_count integer DEFAULT 0,
  has_half_board boolean DEFAULT false,
  half_board_count integer DEFAULT 0,
  total_price numeric NOT NULL,
  deposit_price numeric NOT NULL,
  remaining_price numeric NOT NULL,
  accommodation_price numeric,
  city_tax numeric,
  addons_price numeric,
  status text DEFAULT 'pending_approval'::text,
  created_at timestamp with time zone DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamp with time zone,
  has_winter_parking boolean NOT NULL DEFAULT false,
  parking_cars_count integer NOT NULL DEFAULT 1,
  winter_parking_price_total integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id text NOT NULL,
  author_name text NOT NULL,
  full_name text,
  text text NOT NULL,
  date text,
  status text DEFAULT 'pending_approval'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  base_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  room_name text,
  weekday_price integer,
  weekend_price integer,
  zakladni_luzka integer NOT NULL DEFAULT 2,
  max_pristylek integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.cenik_ceny (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sezona_id uuid NOT NULL,
  kategorie text NOT NULL,
  pocet_osob integer NOT NULL,
  cena_za_osobu_noc integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cenik_ceny_pokoj (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sezona_id uuid NOT NULL,
  room_id text NOT NULL,
  pocet_osob integer NOT NULL,
  cena_za_osobu_noc integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2) KLÍČE, JEDINEČNOST, KONTROLY A VAZBY
--    Přidávají se jen tehdy, když ještě nejsou — kvůli opakovanému
--    spuštění. ADD CONSTRAINT nemá vlastní IF NOT EXISTS.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aktuality_pkey'
                   AND conrelid = 'public.aktuality'::regclass) THEN
    ALTER TABLE public.aktuality ADD CONSTRAINT aktuality_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blocked_dates_pkey'
                   AND conrelid = 'public.blocked_dates'::regclass) THEN
    ALTER TABLE public.blocked_dates ADD CONSTRAINT blocked_dates_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_nastaveni_pkey'
                   AND conrelid = 'public.cenik_nastaveni'::regclass) THEN
    ALTER TABLE public.cenik_nastaveni ADD CONSTRAINT cenik_nastaveni_pkey PRIMARY KEY (klic);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_sezony_pkey'
                   AND conrelid = 'public.cenik_sezony'::regclass) THEN
    ALTER TABLE public.cenik_sezony ADD CONSTRAINT cenik_sezony_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_pkey'
                   AND conrelid = 'public.contact_messages'::regclass) THEN
    ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disabled_rooms_pkey'
                   AND conrelid = 'public.disabled_rooms'::regclass) THEN
    ALTER TABLE public.disabled_rooms ADD CONSTRAINT disabled_rooms_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disabled_rooms_room_id_key'
                   AND conrelid = 'public.disabled_rooms'::regclass) THEN
    ALTER TABLE public.disabled_rooms ADD CONSTRAINT disabled_rooms_room_id_key UNIQUE (room_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_codes_pkey'
                   AND conrelid = 'public.discount_codes'::regclass) THEN
    ALTER TABLE public.discount_codes ADD CONSTRAINT discount_codes_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_codes_code_key'
                   AND conrelid = 'public.discount_codes'::regclass) THEN
    ALTER TABLE public.discount_codes ADD CONSTRAINT discount_codes_code_key UNIQUE (code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_pkey'
                   AND conrelid = 'public.reservations'::regclass) THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_pkey'
                   AND conrelid = 'public.reviews'::regclass) THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_prices_pkey'
                   AND conrelid = 'public.room_prices'::regclass) THEN
    ALTER TABLE public.room_prices ADD CONSTRAINT room_prices_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_prices_room_id_key'
                   AND conrelid = 'public.room_prices'::regclass) THEN
    ALTER TABLE public.room_prices ADD CONSTRAINT room_prices_room_id_key UNIQUE (room_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_ceny_pkey'
                   AND conrelid = 'public.cenik_ceny'::regclass) THEN
    ALTER TABLE public.cenik_ceny ADD CONSTRAINT cenik_ceny_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_ceny_pocet_osob_rozsah'
                   AND conrelid = 'public.cenik_ceny'::regclass) THEN
    ALTER TABLE public.cenik_ceny ADD CONSTRAINT cenik_ceny_pocet_osob_rozsah CHECK (((pocet_osob >= 1) AND (pocet_osob <= 8)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_ceny_sezona_id_fkey'
                   AND conrelid = 'public.cenik_ceny'::regclass) THEN
    ALTER TABLE public.cenik_ceny ADD CONSTRAINT cenik_ceny_sezona_id_fkey FOREIGN KEY (sezona_id) REFERENCES cenik_sezony(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_ceny_unikat'
                   AND conrelid = 'public.cenik_ceny'::regclass) THEN
    ALTER TABLE public.cenik_ceny ADD CONSTRAINT cenik_ceny_unikat UNIQUE (sezona_id, kategorie, pocet_osob);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_ceny_pokoj_pkey'
                   AND conrelid = 'public.cenik_ceny_pokoj'::regclass) THEN
    ALTER TABLE public.cenik_ceny_pokoj ADD CONSTRAINT cenik_ceny_pokoj_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_ceny_pokoj_pocet_osob_rozsah'
                   AND conrelid = 'public.cenik_ceny_pokoj'::regclass) THEN
    ALTER TABLE public.cenik_ceny_pokoj ADD CONSTRAINT cenik_ceny_pokoj_pocet_osob_rozsah CHECK (((pocet_osob >= 1) AND (pocet_osob <= 8)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_ceny_pokoj_sezona_id_fkey'
                   AND conrelid = 'public.cenik_ceny_pokoj'::regclass) THEN
    ALTER TABLE public.cenik_ceny_pokoj ADD CONSTRAINT cenik_ceny_pokoj_sezona_id_fkey FOREIGN KEY (sezona_id) REFERENCES cenik_sezony(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cenik_ceny_pokoj_unikat'
                   AND conrelid = 'public.cenik_ceny_pokoj'::regclass) THEN
    ALTER TABLE public.cenik_ceny_pokoj ADD CONSTRAINT cenik_ceny_pokoj_unikat UNIQUE (sezona_id, room_id, pocet_osob);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3) INDEXY
--    Jen ty, které nevznikly automaticky z omezení výše.
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS cenik_sezony_jedna_zakladni_idx ON public.cenik_sezony USING btree (je_zakladni) WHERE (je_zakladni = true);
CREATE INDEX IF NOT EXISTS reservations_aktivni_idx ON public.reservations USING btree (created_at DESC) WHERE (is_archived = false);
CREATE INDEX IF NOT EXISTS reservations_archiv_idx ON public.reservations USING btree (archived_at DESC) WHERE (is_archived = true);

-- ---------------------------------------------------------------------
-- 4) OCHRANA ŘÁDKŮ
-- ---------------------------------------------------------------------

ALTER TABLE public.aktuality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_ceny ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_ceny_pokoj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_nastaveni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenik_sezony ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disabled_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_prices ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 5) PRAVIDLA PŘÍSTUPU
--    Beze změny podle starého projektu — web čte i zapisuje
--    přes veřejný anon klíč.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'aktuality'
                     AND policyname = 'Allow full access on aktuality') THEN
    EXECUTE 'CREATE POLICY "Allow full access on aktuality" ON public.aktuality AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'aktuality'
                     AND policyname = 'Allow public read access on aktuality') THEN
    EXECUTE 'CREATE POLICY "Allow public read access on aktuality" ON public.aktuality AS PERMISSIVE FOR SELECT TO public USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'blocked_dates'
                     AND policyname = 'Allow all for blocked_dates') THEN
    EXECUTE 'CREATE POLICY "Allow all for blocked_dates" ON public.blocked_dates AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'cenik_ceny'
                     AND policyname = 'cenik_ceny_vse') THEN
    EXECUTE 'CREATE POLICY "cenik_ceny_vse" ON public.cenik_ceny AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'cenik_ceny_pokoj'
                     AND policyname = 'cenik_ceny_pokoj_vse') THEN
    EXECUTE 'CREATE POLICY "cenik_ceny_pokoj_vse" ON public.cenik_ceny_pokoj AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'cenik_nastaveni'
                     AND policyname = 'cenik_nastaveni_vse') THEN
    EXECUTE 'CREATE POLICY "cenik_nastaveni_vse" ON public.cenik_nastaveni AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'cenik_sezony'
                     AND policyname = 'cenik_sezony_vse') THEN
    EXECUTE 'CREATE POLICY "cenik_sezony_vse" ON public.cenik_sezony AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'contact_messages'
                     AND policyname = 'Enable insert for all users') THEN
    EXECUTE 'CREATE POLICY "Enable insert for all users" ON public.contact_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'contact_messages'
                     AND policyname = 'Enable select for all users') THEN
    EXECUTE 'CREATE POLICY "Enable select for all users" ON public.contact_messages AS PERMISSIVE FOR SELECT TO public USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'disabled_rooms'
                     AND policyname = 'Allow all for disabled_rooms') THEN
    EXECUTE 'CREATE POLICY "Allow all for disabled_rooms" ON public.disabled_rooms AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'discount_codes'
                     AND policyname = 'Allow all for discount_codes') THEN
    EXECUTE 'CREATE POLICY "Allow all for discount_codes" ON public.discount_codes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'reservations'
                     AND policyname = 'Allow delete for all') THEN
    EXECUTE 'CREATE POLICY "Allow delete for all" ON public.reservations AS PERMISSIVE FOR DELETE TO public USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'reservations'
                     AND policyname = 'Allow public insert') THEN
    EXECUTE 'CREATE POLICY "Allow public insert" ON public.reservations AS PERMISSIVE FOR INSERT TO public WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'reservations'
                     AND policyname = 'Allow public select') THEN
    EXECUTE 'CREATE POLICY "Allow public select" ON public.reservations AS PERMISSIVE FOR SELECT TO public USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'reservations'
                     AND policyname = 'Allow public update') THEN
    EXECUTE 'CREATE POLICY "Allow public update" ON public.reservations AS PERMISSIVE FOR UPDATE TO public USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'reviews'
                     AND policyname = 'Public insert pending reviews') THEN
    EXECUTE 'CREATE POLICY "Public insert pending reviews" ON public.reviews AS PERMISSIVE FOR INSERT TO public WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'reviews'
                     AND policyname = 'Public read approved reviews') THEN
    EXECUTE 'CREATE POLICY "Public read approved reviews" ON public.reviews AS PERMISSIVE FOR SELECT TO public USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'reviews'
                     AND policyname = 'Public update delete reviews') THEN
    EXECUTE 'CREATE POLICY "Public update delete reviews" ON public.reviews AS PERMISSIVE FOR ALL TO public USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'room_prices'
                     AND policyname = 'Allow all for room_prices') THEN
    EXECUTE 'CREATE POLICY "Allow all for room_prices" ON public.room_prices AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 6) PRÁVA PRO VEŘEJNÉ API
--    Bez nich PostgREST tabulky vůbec nezařadí do schématu
--    a web dostane PGRST205.
-- ---------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
--  OVĚŘENÍ — musí vyjít 12 tabulek, 21 omezení, 19 pravidel
-- =====================================================================
-- SELECT
--   (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tabulky,
--   (SELECT count(*) FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
--     JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='public') AS omezeni,
--   (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS pravidla;