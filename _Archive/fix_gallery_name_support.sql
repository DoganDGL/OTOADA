-- ============================================================================
-- Fix Gallery Name Support in Profiles Table and Trigger
-- ============================================================================
-- This script adds gallery_name column support and updates the trigger function
-- ============================================================================

-- Step 1: Add gallery_name column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'gallery_name'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN gallery_name VARCHAR(255);
        
        COMMENT ON COLUMN public.profiles.gallery_name IS 'Gallery name for corporate accounts (role=gallery)';
    END IF;
END $$;

-- ============================================================================
-- Step 2: Drop existing trigger and function (if they exist)
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================================
-- Step 3: Re-create handle_new_user function with gallery_name support
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    user_gallery_name TEXT;
BEGIN
    -- Extract role from raw_user_meta_data, default to 'member' if not present
    user_role := COALESCE(
        NEW.raw_user_meta_data->>'role',
        'member'
    );
    
    -- Extract gallery_name from raw_user_meta_data (can be NULL)
    user_gallery_name := NULLIF(
        NEW.raw_user_meta_data->>'gallery_name',
        ''
    );
    
    -- Insert into profiles table with all metadata including role and gallery_name
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
        NEW.raw_user_meta_data->>'full_name',
        NULLIF(NEW.raw_user_meta_data->>'whatsapp', ''),
        NEW.email,
        user_role,
        user_gallery_name,
        NOW(),
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 4: Re-create the trigger
-- ============================================================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Verification Query (Optional - Run this to verify the setup)
-- ============================================================================
-- SELECT 
--     column_name, 
--     data_type, 
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
-- AND table_name = 'profiles'
-- ORDER BY ordinal_position;
-- ============================================================================
