import { createClient } from '@supabase/supabase-js';
export const ownerUserId = '30485ccc-d3cf-4618-b78f-d864368baf35';
export function getSupabase() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url || !key) throw new Error('Workspace connection is not configured.');
 return createClient(url,key);
}
