// Supabase Configuration
const SUPABASE_URL = 'https://dorxghvoyapmiiqbscun.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnhnaHZveWFwbWlpcWJzY3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzIzOTcsImV4cCI6MjA4MzcwODM5N30.buIFbdYCZPOi9T5LLAtwQnrJT2tvNcdy3K1MZbBo-JU';

// Initialize Supabase client (globally accessible)
// The global supabase object from CDN is available after the script loads in <head>
// Access via window to avoid variable shadowing
var supabase;
try {
    // Access the global supabase object from the CDN and create client
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('Supabase CDN not loaded. Client will be null.');
        supabase = null;
    }
} catch (error) {
    console.error('Error initializing Supabase client:', error);
    supabase = null;
}

// ImgBB Configuration
// Fill in your ImgBB API Key (get one at https://api.imgbb.com/)
const IMGBB_API_KEY = 'YOUR_API_KEY_HERE';


