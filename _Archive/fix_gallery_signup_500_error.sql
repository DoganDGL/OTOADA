-- ============================================================================
-- Fix 500 Error: Gallery Signup Support
-- ============================================================================
-- This script fixes the "Database error saving new user" error by:
-- 1. Adding gallery_name column if missing
-- 2. Dropping and recreating the trigger function with proper NULL handling
-- ============================================================================

-- Step 1: Add gallery_name column to profiles table if it doesn't exist
-- This column should be nullable since individual accounts don't have gallery names
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
        ADD COLUMN gallery_name VARCHAR(255) NULL;
        
        COMMENT ON COLUMN public.profiles.gallery_name IS 'Gallery name for corporate accounts (role=gallery). NULL for individual accounts.';
        
        RAISE NOTICE 'Added gallery_name column to profiles table';
    ELSE
        RAISE NOTICE 'gallery_name column already exists';
    END IF;
END $$;

-- ============================================================================
-- Step 2: Drop existing trigger and function (safe - uses IF EXISTS)
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================================
-- Step 3: Re-create handle_new_user function with robust error handling
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_role TEXT;
    user_gallery_name TEXT;
    user_full_name TEXT;
    user_whatsapp TEXT;
BEGIN
    -- Extract role from raw_user_meta_data, default to 'member' if not present
    user_role := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'role', ''),
        'member'
    );
    
    -- Extract full_name (required field)
    user_full_name := NEW.raw_user_meta_data->>'full_name';
    
    -- Extract whatsapp (optional - can be NULL)
    user_whatsapp := NULLIF(
        NULLIF(NEW.raw_user_meta_data->>'whatsapp', ''),
        NULL
    );
    
    -- Extract gallery_name (optional - can be NULL for individual accounts)
    -- Only set if it exists and is not empty
    user_gallery_name := NULLIF(
        NULLIF(NEW.raw_user_meta_data->>'gallery_name', ''),
        NULL
    );
    
    -- Insert into profiles table with all metadata
    -- Handle NULL values properly for optional fields
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
        COALESCE(user_full_name, 'İsimsiz'),  -- Default if missing
        user_whatsapp,                          -- Can be NULL
        COALESCE(NEW.email, ''),               -- Should always exist, but safe default
        user_role,
        user_gallery_name,                      -- Can be NULL for individual accounts
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;  -- Prevent duplicate inserts if trigger fires twice
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error for debugging
        RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
        -- Re-raise to ensure the signup fails if profile creation fails
        RAISE;
END;
$$;

-- ============================================================================
-- Step 4: Re-create the trigger
-- ============================================================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Verification Queries (Optional - Run these to verify the setup)
-- ============================================================================

-- Check if gallery_name column exists
-- SELECT 
--     column_name, 
--     data_type, 
--     is_nullable,
--     column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
-- AND table_name = 'profiles'
-- AND column_name = 'gallery_name';

-- Check trigger exists
-- SELECT 
--     trigger_name,
--     event_manipulation,
--     event_object_table,
--     action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- AND trigger_name = 'on_auth_user_created';

-- Check function exists
-- SELECT 
--     routine_name,
--     routine_type,
--     data_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name = 'handle_new_user';

-- ============================================================================
-- Test Query (DO NOT RUN IN PRODUCTION - Only for testing)
-- ============================================================================
-- To test if the function works, you can manually insert a test user:
-- INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
-- VALUES (
--     gen_random_uuid(),
--     'test@example.com',
--     '{"full_name": "Test User", "role": "gallery", "gallery_name": "Test Gallery"}'::jsonb,
--     NOW(),
--     NOW()
-- );
-- Then check: SELECT * FROM public.profiles WHERE email = 'test@example.com';
-- ============================================================================
