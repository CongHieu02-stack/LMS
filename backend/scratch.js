import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://vixdlfyidrlrjdegzeao.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeGRsZnlpZHJscmpkZWd6ZWFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA4NDE4MCwiZXhwIjoyMDk0NjYwMTgwfQ.K7vuo4yhMDwj9mgfhRr7s2Rv-4_hef1Bp3xMTsm8sx0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Fetching rooms...');
  const { data, error } = await supabase.from('rooms').select('id, name, capacity');
  if (error) {
    console.error(error);
  } else {
    console.log(`Fetched ${data.length} rooms`);
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
  }
}

check();
