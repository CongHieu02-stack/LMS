import 'dotenv/config';
import { supabaseAdmin } from './src/config/supabase.js';

async function listUsers() {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, rank, department')
    .order('rank', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  console.table(profiles);
}

listUsers();
