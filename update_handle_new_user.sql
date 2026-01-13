-- ============================================================================
-- Update handle_new_user Function to Support Role from Signup
-- ============================================================================
-- This function handles new user creation and extracts the role from
-- raw_user_meta_data, defaulting to 'member' if not provided.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Extract role from raw_user_meta_data, default to 'member' if not present
    user_role := COALESCE(
        NEW.raw_user_meta_data->>'role',
        'member'
    );
    
    -- Insert into profiles table with the extracted/default role
    INSERT INTO public.profiles (
        id,
        full_name,
        whatsapp,
        email,
        role,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NULLIF(NEW.raw_user_meta_data->>'whatsapp', ''),
        NEW.email,
        user_role,
        NOW(),
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Ensure the trigger exists and is properly configured
-- ============================================================================

-- Drop trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Notes:
-- ============================================================================
-- This function:
-- 1. Checks if 'role' exists in raw_user_meta_data
-- 2. Uses the provided role if it exists
-- 3. Defaults to 'member' if role is not provided or is NULL
-- 4. Inserts the user profile with all metadata including the role
--
-- The trigger fires AFTER INSERT on auth.users, ensuring the user record
-- exists before creating the profile.
-- ============================================================================
