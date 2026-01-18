-- ============================================================================
-- FIX: Convert role column from ENUM to TEXT to support gallery/ambassador
-- ============================================================================
-- This script fixes the 500 error by converting the role column from
-- user_role ENUM to TEXT, allowing any role value including 'gallery' and 'ambassador'
-- ============================================================================

-- Step 1: Drop the trigger temporarily (so we can modify the table)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop the function temporarily (we'll recreate it)
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Convert role column from user_role ENUM to TEXT
-- First, check if the column exists and what type it is
DO $$ 
DECLARE
    v_column_type TEXT;
BEGIN
    -- Get the current data type of the role column
    SELECT data_type INTO v_column_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role';
    
    -- If column exists and is using user-defined type (enum), convert it
    IF v_column_type IS NOT NULL THEN
        -- Check if it's using a user-defined type (enum)
        SELECT udt_name INTO v_column_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role';
        
        -- If it's an enum type, convert to TEXT
        IF v_column_type = 'user_role' THEN
            -- Convert enum to text using USING clause
            ALTER TABLE public.profiles 
            ALTER COLUMN role TYPE TEXT USING role::TEXT;
            
            RAISE NOTICE 'Converted role column from user_role enum to TEXT';
        ELSIF v_column_type = 'text' THEN
            RAISE NOTICE 'role column is already TEXT type';
        ELSE
            RAISE NOTICE 'role column type is: %', v_column_type;
        END IF;
    ELSE
        -- Column doesn't exist, add it as TEXT
        ALTER TABLE public.profiles 
        ADD COLUMN role TEXT DEFAULT 'member';
        RAISE NOTICE 'Added role column as TEXT type';
    END IF;
END $$;

-- Step 4: Ensure all other required columns exist
DO $$ 
BEGIN
    -- Add email column if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN email TEXT;
        RAISE NOTICE 'Added email column to profiles table';
    END IF;
    
    -- Add gallery_name column if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'gallery_name'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN gallery_name VARCHAR(255);
        RAISE NOTICE 'Added gallery_name column to profiles table';
    END IF;
    
    -- Add full_name column if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'full_name'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN full_name TEXT;
        RAISE NOTICE 'Added full_name column to profiles table';
    END IF;
    
    -- Add whatsapp column if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'whatsapp'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN whatsapp TEXT;
        RAISE NOTICE 'Added whatsapp column to profiles table';
    END IF;
END $$;

-- Step 5: Drop the user_role enum type (optional cleanup)
-- Only drop if no other tables/columns are using it
DO $$ 
DECLARE
    v_type_used INTEGER;
BEGIN
    -- Check if user_role type is used anywhere else
    SELECT COUNT(*) INTO v_type_used
    FROM information_schema.columns
    WHERE udt_name = 'user_role'
    AND table_schema = 'public';
    
    IF v_type_used = 0 THEN
        -- Type is not used anywhere, safe to drop
        DROP TYPE IF EXISTS public.user_role CASCADE;
        RAISE NOTICE 'Dropped unused user_role enum type';
    ELSE
        RAISE NOTICE 'user_role type is still in use elsewhere, keeping it';
    END IF;
END $$;

-- Step 6: Re-create handle_new_user function with robust error handling
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
    -- Extract and sanitize role (default to 'member')
    -- Now supports any text value: 'member', 'gallery', 'ambassador', etc.
    v_role := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''),
        'member'
    );
    
    -- Extract full_name (required, but provide default)
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        'İsimsiz'
    );
    
    -- Extract whatsapp (optional - can be NULL)
    v_whatsapp := NULLIF(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'whatsapp'), ''),
        NULL
    );
    
    -- Extract gallery_name (optional - can be NULL for individual accounts)
    v_gallery_name := NULLIF(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'gallery_name'), ''),
        NULL
    );
    
    -- Extract email from auth.users (should always exist)
    v_email := COALESCE(NEW.email, '');
    
    -- Insert into profiles table
    -- role is now TEXT, so it can accept 'member', 'gallery', 'ambassador', or any other value
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
        -- Log detailed error information for debugging
        RAISE WARNING 'Error in handle_new_user for user %: % (SQLSTATE: %)', 
            NEW.id, 
            SQLERRM, 
            SQLSTATE;
        -- Re-raise to fail the signup if profile creation fails
        RAISE;
END;
$$;

-- Step 7: Re-create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- VERIFICATION QUERIES (Optional - Run these to verify the fix)
-- ============================================================================

-- Check role column type (should now be 'text' or 'character varying')
-- SELECT 
--     column_name, 
--     data_type,
--     udt_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
-- AND table_name = 'profiles'
-- AND column_name = 'role';

-- Check all columns exist
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
-- AND table_name = 'profiles'
-- ORDER BY ordinal_position;

-- Check trigger exists
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'auth'
-- AND trigger_name = 'on_auth_user_created';

-- ============================================================================
-- DONE! The role column is now TEXT and can accept 'member', 'gallery', 'ambassador', etc.
-- ============================================================================
