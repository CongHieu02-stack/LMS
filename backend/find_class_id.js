import 'dotenv/config';
import { supabaseAdmin } from './src/config/supabase.js';

async function run() {
  const { data: classes, error } = await supabaseAdmin
    .from('classes')
    .select('id, name')
    .eq('name', 'INT200 - Lớp 05');

  if (error) {
    console.error(error);
    return;
  }
  console.log(classes);
}

run();
