import 'dotenv/config';
import { supabaseAdmin } from './src/config/supabase.js';

async function run() {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, rank, department')
    .gte('rank', 70)
    .order('rank', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(profiles, null, 2));
}

run().catch(console.error);
