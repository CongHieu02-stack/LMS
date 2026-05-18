import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vixdlfyidrlrjdegzeao.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeGRsZnlpZHJscmpkZWd6ZWFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA4NDE4MCwiZXhwIjoyMDk0NjYwMTgwfQ.K7vuo4yhMDwj9mgfhRr7s2Rv-4_hef1Bp3xMTsm8sx0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Fetching user_role enum values from DB...');
  const { data, error } = await supabase.rpc('get_roles_test_which_doesnt_exist');
  console.log(error);
}

check();
