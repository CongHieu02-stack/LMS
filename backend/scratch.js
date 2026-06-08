import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://vixdlfyidrlrjdegzeao.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    console.log('Fetching classes...');
    const { data: classes, error: err1 } = await supabase
      .from('classes')
      .select(`
        *,
        subject:subjects(id, code, name, credits, department),
        instructor:profiles!instructor_id(id, full_name, email),
        manager:profiles!manager_id(id, full_name, email)
      `);
    if (err1) {
      console.error('Classes error:', err1);
    } else {
      console.log(`Fetched ${classes.length} classes`);
      if (classes.length > 0) {
        console.log('Sample class:', JSON.stringify(classes[0], null, 2));
      }
    }

    console.log('Fetching profiles...');
    const { data: profiles, error: err2 } = await supabase
      .from('profiles')
      .select('*');
    if (err2) {
      console.error('Profiles error:', err2);
    } else {
      console.log(`Fetched ${profiles.length} profiles`);
    }
  } catch (e) {
    console.error(e);
  }
}

check();
