-- ============================================================================
-- OTOADA - Consolidated Supabase Schema (v2)
-- ============================================================================
-- Single, production-ready schema for fresh Supabase setup
-- ============================================================================

-- Required extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMs and Types
-- ============================================================================

CREATE TYPE car_status AS ENUM (
    'Onay Bekliyor',
    'Yayında',
    'Satıldı',
    'Reddedildi'
);

CREATE TYPE currency_type AS ENUM (
    'STG',
    'TL',
    'EUR'
);

-- ============================================================================
-- Tables (with constraints)
-- ============================================================================

CREATE TABLE public.cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marka VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    fiyat NUMERIC(12, 2) NOT NULL CHECK (fiyat >= 0),
    para_birimi currency_type NOT NULL DEFAULT 'STG',
    durum car_status NOT NULL DEFAULT 'Onay Bekliyor',
    yil INTEGER CHECK (yil >= 1900 AND yil <= 2100),
    km INTEGER CHECK (km >= 0),
    yakit VARCHAR(50),
    vites VARCHAR(50),
    kasa_tipi VARCHAR(100),
    renk VARCHAR(50),
    aciklama TEXT,
    satici VARCHAR(200),
    telefon VARCHAR(50),
    konum VARCHAR(200),
    ekspertiz TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.car_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_car_images_car FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    whatsapp TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    gallery_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT profiles_role_lowercase CHECK (role = lower(role))
);

COMMENT ON COLUMN public.profiles.gallery_name IS 'Gallery name for corporate accounts (role=gallery).';

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_cars_durum ON public.cars(durum);
CREATE INDEX idx_cars_created_at ON public.cars(created_at DESC);
CREATE INDEX idx_cars_para_birimi ON public.cars(para_birimi);
CREATE INDEX idx_cars_marka ON public.cars(marka);
CREATE INDEX idx_cars_model ON public.cars(model);
CREATE INDEX idx_cars_fiyat ON public.cars(fiyat);
CREATE INDEX idx_cars_konum ON public.cars(konum);
CREATE INDEX idx_cars_yakit ON public.cars(yakit);
CREATE INDEX idx_cars_vites ON public.cars(vites);
CREATE INDEX idx_cars_durum_fiyat ON public.cars(durum, fiyat);
CREATE INDEX idx_cars_durum_created_at ON public.cars(durum, created_at DESC);
CREATE INDEX idx_cars_marka_model ON public.cars(marka, model);
CREATE INDEX idx_cars_aciklama_fts ON public.cars USING gin(to_tsvector('turkish', COALESCE(aciklama, '')));
CREATE INDEX idx_cars_search_fts ON public.cars USING gin(
    to_tsvector(
        'turkish',
        COALESCE(marka, '') || ' ' ||
        COALESCE(model, '') || ' ' ||
        COALESCE(aciklama, '')
    )
);
CREATE INDEX idx_car_images_car_id ON public.car_images(car_id);
CREATE INDEX idx_car_images_display_order ON public.car_images(car_id, display_order);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============================================================================
-- Views
-- ============================================================================

CREATE OR REPLACE VIEW public.published_cars_view AS
SELECT
    c.*,
    ci.image_url AS primary_image_url,
    ci.thumbnail_url AS primary_thumbnail_url
FROM public.cars c
LEFT JOIN LATERAL (
    SELECT image_url, thumbnail_url
    FROM public.car_images
    WHERE car_id = c.id
    ORDER BY display_order ASC
    LIMIT 1
) ci ON true
WHERE c.durum = 'Yayında'
ORDER BY c.created_at DESC;

-- ============================================================================
-- Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_role TEXT;
    v_gallery_name TEXT;
    v_full_name TEXT;
    v_whatsapp TEXT;
    v_email TEXT;
BEGIN
    v_role := COALESCE(
        NULLIF(lower(trim(NEW.raw_user_meta_data->>'role')), ''),
        'member'
    );

    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        'Isimsiz'
    );

    v_whatsapp := NULLIF(trim(NEW.raw_user_meta_data->>'whatsapp'), '');
    v_gallery_name := NULLIF(trim(NEW.raw_user_meta_data->>'gallery_name'), '');
    v_email := COALESCE(NEW.email, '');

    INSERT INTO public.profiles (
        id,
        full_name,
        whatsapp,
        email,
        role,
        gallery_name,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_full_name,
        v_whatsapp,
        v_email,
        v_role,
        v_gallery_name,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        whatsapp = EXCLUDED.whatsapp,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        gallery_name = EXCLUDED.gallery_name,
        updated_at = NOW();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user for user %: % (SQLSTATE: %)',
            NEW.id,
            SQLERRM,
            SQLSTATE;
        RAISE;
END;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER update_cars_updated_at
    BEFORE UPDATE ON public.cars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cars_public_read"
    ON public.cars
    FOR SELECT
    USING (durum = 'Yayında');

CREATE POLICY "cars_authenticated_insert"
    ON public.cars
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "cars_service_role_all"
    ON public.cars
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "car_images_public_read"
    ON public.car_images
    FOR SELECT
    USING (true);

CREATE POLICY "car_images_authenticated_insert"
    ON public.car_images
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "car_images_service_role_all"
    ON public.car_images
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "profiles_self_read"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "profiles_self_update"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_service_role_all"
    ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

