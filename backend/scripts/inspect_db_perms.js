import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('--- ALL PERMISSIONS ---');
    const { data: perms, error: permsErr } = await supabase
      .from('permissions')
      .select('id, code, name, group_name');
    
    if (permsErr) {
      console.error(permsErr);
    } else {
      console.table(perms);
    }

    console.log('--- ROLE DEFAULT PERMISSIONS ---');
    const { data: rolePerms, error: rolePermsErr } = await supabase
      .from('role_default_permissions')
      .select('role, permission_id, permissions(code)');
    
    if (rolePermsErr) {
      console.error(rolePermsErr);
    } else {
      const formatted = rolePerms.map(rp => ({
        role: rp.role,
        permission_code: rp.permissions?.code
      }));
      console.table(formatted);
    }

    console.log('--- RECTOR USER PERMISSIONS OVERRIDES ---');
    const { data: userPerms, error: userPermsErr } = await supabase
      .from('user_permissions')
      .select('user_id, profiles(email, role), permissions(code)');
    
    if (userPermsErr) {
      console.error(userPermsErr);
    } else {
      const formatted = userPerms.map(up => ({
        email: up.profiles?.email,
        role: up.profiles?.role,
        permission_code: up.permissions?.code
      }));
      console.table(formatted);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
