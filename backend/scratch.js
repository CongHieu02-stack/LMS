import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const codes = [
      'subject_approve',
      'class_quantity_approve',
      'class_create',
      'class_quantity_propose',
      'instructor_assign',
      'subject_propose',
      'lesson_exam_manage'
    ];

    console.log('Fetching permissions for new defaults...');
    const { data: perms, error: permErr } = await supabase
      .from('permissions')
      .select('id, code')
      .in('code', codes);

    if (permErr || !perms) {
      console.error('Error fetching permissions:', permErr);
      return;
    }

    console.log(`Found ${perms.length} permissions to set as default.`);

    console.log('Deleting existing default permissions for HIEU_TRUONG...');
    const { error: delDefaultErr } = await supabase
      .from('role_default_permissions')
      .delete()
      .eq('role', 'HIEU_TRUONG');

    if (delDefaultErr) {
      console.error('Error deleting default permissions:', delDefaultErr);
      return;
    }

    console.log('Inserting new default permissions for HIEU_TRUONG...');
    const defaultPairs = perms.map(p => ({
      role: 'HIEU_TRUONG',
      permission_id: p.id
    }));

    const { error: insertDefaultErr } = await supabase
      .from('role_default_permissions')
      .insert(defaultPairs);

    if (insertDefaultErr) {
      console.error('Error inserting default permissions:', insertDefaultErr);
      return;
    }

    console.log('Fetching all Rector profiles...');
    const { data: rectors, error: rErr } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('role', 'HIEU_TRUONG');

    if (rErr || !rectors) {
      console.error('Error fetching rectors:', rErr);
      return;
    }

    const rectorIds = rectors.map(r => r.id);
    console.log(`Found ${rectors.length} Rector accounts:`, rectors.map(r => r.email));

    if (rectorIds.length > 0) {
      console.log('Resetting (deleting) custom overrides in user_permissions for all Rector accounts...');
      const { error: delCustomErr } = await supabase
        .from('user_permissions')
        .delete()
        .in('user_id', rectorIds);

      if (delCustomErr) {
        console.error('Error deleting custom overrides:', delCustomErr);
        return;
      }
    }

    console.log('Rector permissions successfully configured with new defaults and reset!');
  } catch (e) {
    console.error(e);
  }
}

run();

