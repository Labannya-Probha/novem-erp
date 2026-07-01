import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const SUPABASE_CONFIG = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }

// True when the required environment variables are present at build time.
// A missing value means the app was deployed without the Vercel (or .env)
// settings — the UI in main.jsx will surface a clear message instead of
// leaving the user with a blank page.
export const SUPABASE_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!SUPABASE_CONFIGURED) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — set them in your Vercel project environment settings and redeploy.')
}

// storage: sessionStorage means the session is cleared automatically
// when the browser tab or window is closed — user must log in again
// next time, instead of staying signed in indefinitely (the default
// localStorage behavior).
export const supabase = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
