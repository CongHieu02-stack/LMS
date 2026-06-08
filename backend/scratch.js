import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    console.log('Fetching profiles...');
    const { data: profiles, error: err } = await supabase
      .from('profiles')
      .select('id, email, role, rank')
      .gte('rank', 60);
      
    if (err) {
      console.error(err);
      return;
    }

    for (const p of profiles) {
      console.log(`\nUser: ${p.email} | Role: ${p.role} | Rank: ${p.rank}`);
      
      // Query user_permissions
      const { data: userPerms, error: uErr } = await supabase
        .from('user_permissions')
        .select('permissions(code)')
        .eq('user_id', p.id);
        
      if (uErr) {
        console.error('Error fetching user_permissions:', uErr);
      } else {
        console.log('  user_permissions:', userPerms.map(x => x.permissions?.code));
      }

      // Query role_default_permissions
      const { data: rolePerms, error: rErr } = await supabase
        .from('role_default_permissions')
        .select('permissions(code)')
        .eq('role', p.role);
        
      if (rErr) {
        console.error('Error fetching role_default_permissions:', rErr);
      } else {
        console.log('  role_default_permissions:', rolePerms.map(x => x.permissions?.code));
      }
    }
  } catch (e) {
    console.error(e);
  }
}

check();

