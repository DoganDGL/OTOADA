// Supabase Configuration
// Note: SUPABASE_URL and SUPABASE_ANON_KEY are loaded from secrets.js
// Make sure secrets.js is loaded before this file in your HTML

// Check if secrets are loaded
if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
    console.error('ERROR: secrets.js must be loaded before config.js!');
    console.error('Please ensure secrets.js is included in your HTML before config.js');
}

// Initialize Supabase client (globally accessible)
// The global supabase object from CDN is available after the script loads in <head>
// Access via window to avoid variable shadowing
var supabase;
try {
    // Access the global supabase object from the CDN and create client
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error('Supabase credentials not found. Please check secrets.js');
            supabase = null;
        }
    } else {
        console.warn('Supabase CDN not loaded. Client will be null.');
        supabase = null;
    }
} catch (error) {
    console.error('Error initializing Supabase client:', error);
    supabase = null;
}

// ImgBB Configuration
// Note: IMGBB_API_KEY is loaded from secrets.js
// Make sure secrets.js is loaded before this file in your HTML


