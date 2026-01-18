-- ============================================================================
-- COMPLETE RESET: Fix Gallery Signup 500 Error
-- ============================================================================
-- This is a COMPLETE reset that will fix all issues:
-- 1. Drops existing trigger and function (clears bad logic)
-- 2. Adds missing columns (gallery_name, email) if they don't exist
-- 3. Recreates the trigger function with proper error handling
-- ============================================================================
-- INSTRUCTIONS: Copy this ENTIRE block and paste into Supabase SQL Editor
-- ============================================================================

-- Step 1: Drop existing trigger and function (safe - uses IF EXISTS)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Ensure all required columns exist in profiles table
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
    ELSE
        RAISE NOTICE 'email column already exists';
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
    ELSE
        RAISE NOTICE 'gallery_name column already exists';
    END IF;
    
    -- Add role column if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN role TEXT DEFAULT 'member';
        RAISE NOTICE 'Added role column to profiles table';
    ELSE
        RAISE NOTICE 'role column already exists';
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
    ELSE
        RAISE NOTICE 'full_name column already exists';
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
    ELSE
        RAISE NOTICE 'whatsapp column already exists';
    END IF;
END $$;

-- Step 3: Re-create handle_new_user function with COMPLETE error handling
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
    -- All fields are handled with COALESCE/NULLIF for safety
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
        -- Log detailed error information
        RAISE WARNING 'Error in handle_new_user for user %: % (SQLSTATE: %)', 
            NEW.id, 
            SQLERRM, 
            SQLSTATE;
        -- Re-raise to fail the signup if profile creation fails
        RAISE;
END;
$$;

-- Step 4: Re-create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- VERIFICATION (Optional - Run these to verify setup)
-- ============================================================================

-- Check all columns exist:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
-- AND table_name = 'profiles'
-- ORDER BY ordinal_position;

-- Check trigger exists:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'auth'
-- AND trigger_name = 'on_auth_user_created';

-- ============================================================================
-- DONE! The trigger should now work correctly for both member and gallery signups.
-- ============================================================================
