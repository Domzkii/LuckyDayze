import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://gtuagrshoswvjrqqgkiv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dWFncnNob3N3dmpycXFna2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzMwMzQsImV4cCI6MjA5NDIwOTAzNH0.QCoVz88Lune47t0YsAFMcEdtP9F6fNKdbydUTl_XDmY',
  {
    db: {
      schema: 'public'
    }
  }
)