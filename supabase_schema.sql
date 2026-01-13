-- ============================================================================
-- OTOADA - Supabase Database Schema Migration
-- ============================================================================
-- This file contains the SQL schema to migrate from Airtable to Supabase
-- Generated for PostgreSQL (Supabase)
-- ============================================================================

-- Drop existing objects if they exist (for fresh migration)
DROP TABLE IF EXISTS car_images CASCADE;
DROP TABLE IF EXISTS cars CASCADE;
DROP TYPE IF EXISTS car_status CASCADE;
DROP TYPE IF EXISTS currency_type CASCADE;

-- ============================================================================
-- ENUM Types
-- ============================================================================

-- Car Status Enum (matches Airtable 'Durum' field)
CREATE TYPE car_status AS ENUM (
    'Onay Bekliyor',  -- Pending Approval
    'Yayında',        -- Published
    'Satıldı',        -- Sold
    'Reddedildi'      -- Rejected
);

-- Currency Type Enum (matches Airtable 'ParaBirimi' field)
CREATE TYPE currency_type AS ENUM (
    'STG',  -- British Pound
    'TL',   -- Turkish Lira
    'EUR'   -- Euro
);

-- ============================================================================
-- Main Cars Table
-- ============================================================================

CREATE TABLE cars (
    -- Primary Key (UUID instead of Airtable record ID)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Required Fields
    marka VARCHAR(100) NOT NULL,                    -- Brand (Marka)
    model VARCHAR(100) NOT NULL,                    -- Model (Model)
    fiyat NUMERIC(12, 2) NOT NULL CHECK (fiyat >= 0), -- Price (Fiyat)
    para_birimi currency_type NOT NULL DEFAULT 'STG', -- Currency (ParaBirimi)
    durum car_status NOT NULL DEFAULT 'Onay Bekliyor', -- Status (Durum)
    
    -- Optional Vehicle Details
    yil INTEGER CHECK (yil >= 1900 AND yil <= 2100), -- Year (Yil)
    km INTEGER CHECK (km >= 0),                     -- Kilometers (KM)
    yakit VARCHAR(50),                              -- Fuel Type (Yakit)
    vites VARCHAR(50),                              -- Transmission (Vites)
    kasa_tipi VARCHAR(100),                         -- Body Type (Kasa Tipi)
    renk VARCHAR(50),                               -- Color (Renk)
    
    -- Description
    aciklama TEXT,                                  -- Description (Aciklama)
    
    -- Seller Information
    satici VARCHAR(200),                            -- Seller Name (Satici)
    telefon VARCHAR(50),                            -- Phone Number (Telefon)
    konum VARCHAR(200),                             -- Location (Konum)
    
    -- Damage Report
    ekspertiz TEXT,                                 -- Damage Report (Ekspertiz/Hasar Durumu)
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Created timestamp (maps to Airtable createdTime)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- Updated timestamp
);

-- ============================================================================
-- Car Images Table (Normalized from Airtable Attachment field)
-- ============================================================================

CREATE TABLE car_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,                        -- Image URL from ImgBB or storage
    thumbnail_url TEXT,                             -- Thumbnail URL (if available)
    display_order INTEGER NOT NULL DEFAULT 0,       -- Order for image display
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_car_images_car FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary lookups
CREATE INDEX idx_cars_durum ON cars(durum);
CREATE INDEX idx_cars_created_at ON cars(created_at DESC);
CREATE INDEX idx_cars_para_birimi ON cars(para_birimi);

-- Search and filtering indexes
CREATE INDEX idx_cars_marka ON cars(marka);
CREATE INDEX idx_cars_model ON cars(model);
CREATE INDEX idx_cars_fiyat ON cars(fiyat);
CREATE INDEX idx_cars_konum ON cars(konum);
CREATE INDEX idx_cars_yakit ON cars(yakit);
CREATE INDEX idx_cars_vites ON cars(vites);

-- Composite indexes for common queries
CREATE INDEX idx_cars_durum_fiyat ON cars(durum, fiyat);
CREATE INDEX idx_cars_durum_created_at ON cars(durum, created_at DESC);
CREATE INDEX idx_cars_marka_model ON cars(marka, model);

-- Full-text search index for description and seller name
CREATE INDEX idx_cars_aciklama_fts ON cars USING gin(to_tsvector('turkish', COALESCE(aciklama, '')));
CREATE INDEX idx_cars_search_fts ON cars USING gin(
    to_tsvector('turkish', 
        COALESCE(marka, '') || ' ' || 
        COALESCE(model, '') || ' ' || 
        COALESCE(aciklama, '')
    )
);

-- Image table indexes
CREATE INDEX idx_car_images_car_id ON car_images(car_id);
CREATE INDEX idx_car_images_display_order ON car_images(car_id, display_order);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_cars_updated_at
    BEFORE UPDATE ON cars
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- Note: Enable RLS after data migration, configure policies based on requirements

ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_images ENABLE ROW LEVEL SECURITY;

-- Example: Public read access for published cars
-- CREATE POLICY "Public can view published cars"
--     ON cars FOR SELECT
--     USING (durum = 'Yayında');

-- Example: Authenticated users can insert (for upload functionality)
-- CREATE POLICY "Authenticated users can insert cars"
--     ON cars FOR INSERT
--     TO authenticated
--     WITH CHECK (true);

-- Example: Service role can manage all cars (for admin dashboard)
-- CREATE POLICY "Service role has full access"
--     ON cars FOR ALL
--     TO service_role
--     USING (true)
--     WITH CHECK (true);

-- ============================================================================
-- Views (Optional - for convenience)
-- ============================================================================

-- View for published cars with first image
CREATE OR REPLACE VIEW published_cars_view AS
SELECT 
    c.*,
    ci.image_url as primary_image_url,
    ci.thumbnail_url as primary_thumbnail_url
FROM cars c
LEFT JOIN LATERAL (
    SELECT image_url, thumbnail_url
    FROM car_images
    WHERE car_id = c.id
    ORDER BY display_order ASC
    LIMIT 1
) ci ON true
WHERE c.durum = 'Yayında'
ORDER BY c.created_at DESC;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE cars IS 'Main table storing car listings. Migrated from Airtable Table 1.';
COMMENT ON TABLE car_images IS 'Stores images for cars. Normalized from Airtable Resim attachment field.';
COMMENT ON COLUMN cars.durum IS 'Car listing status: Onay Bekliyor (Pending), Yayında (Published), Satıldı (Sold), Reddedildi (Rejected)';
COMMENT ON COLUMN cars.para_birimi IS 'Currency type: STG (British Pound), TL (Turkish Lira), EUR (Euro)';
COMMENT ON COLUMN car_images.display_order IS 'Order for displaying images (0 = primary image)';

-- ============================================================================
-- Migration Notes
-- ============================================================================
-- 
-- Field Mapping from Airtable to PostgreSQL:
-- 
-- Airtable Field          PostgreSQL Column       Type
-- --------------------    --------------------    --------------------
-- id                      id                      UUID (auto-generated)
-- createdTime             created_at              TIMESTAMPTZ
-- Marka                   marka                   VARCHAR(100)
-- Model                   model                   VARCHAR(100)
-- Fiyat                   fiyat                   NUMERIC(12,2)
-- ParaBirimi              para_birimi             currency_type ENUM
-- Durum                   durum                   car_status ENUM
-- Yil                     yil                     INTEGER
-- KM                      km                      INTEGER
-- Yakit                   yakit                   VARCHAR(50)
-- Vites                   vites                   VARCHAR(50)
-- Kasa Tipi               kasa_tipi               VARCHAR(100)
-- Renk                    renk                    VARCHAR(50)
-- Aciklama                aciklama                TEXT
-- Satici                  satici                  VARCHAR(200)
-- Telefon                 telefon                 VARCHAR(50)
-- Konum                   konum                   VARCHAR(200)
-- Ekspertiz/Hasar Durumu  ekspertiz               TEXT
-- Resim (Attachment)      car_images table        Separate table
-- 
-- Next Steps:
-- 1. Set up Supabase project
-- 2. Run this SQL schema in Supabase SQL Editor
-- 3. Create migration script to transfer data from Airtable
-- 4. Update JavaScript files to use Supabase client instead of Airtable API
-- 5. Configure RLS policies based on access requirements
-- 6. Set up storage bucket for images (optional - if not using ImgBB)
-- 7. Update config.js with Supabase credentials
-- 8. Test all CRUD operations
-- 
-- ============================================================================

