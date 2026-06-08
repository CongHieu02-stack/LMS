import 'dotenv/config';
import { supabaseAdmin } from './src/config/supabase.js';

async function testSupabase() {
  console.log('Querying via supabaseAdmin from config...');
  try {
    const { data, error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) {
      console.error('Error returned by query:', error);
    } else {
      console.log('Query successful, first result:', data);
    }
  } catch (err) {
    console.error('Catch block error:', err);
  }
}

testSupabase();
