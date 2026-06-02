import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vixdlfyidrlrjdegzeao.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeGRsZnlpZHJscmpkZWd6ZWFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA4NDE4MCwiZXhwIjoyMDk0NjYwMTgwfQ.K7vuo4yhMDwj9mgfhRr7s2Rv-4_hef1Bp3xMTsm8sx0';
const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws
  }
});

async function check() {
  console.log('Inspecting exams table...');
  const { data: examsData, error: examsError } = await supabase.from('exams').select('*').limit(1);
  if (examsError) {
    console.error('exams error:', examsError);
  } else {
    console.log('exams sample:', JSON.stringify(examsData, null, 2));
  }
}

check();
