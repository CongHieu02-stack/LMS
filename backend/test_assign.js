import 'dotenv/config';
import { assignInstructor, findAll } from './src/models/classModel.js';
import { supabaseAdmin } from './src/config/supabase.js';

async function run() {
  try {
    const classes = await findAll();
    if (classes.length === 0) {
      console.log('No classes found');
      return;
    }
    const targetClass = classes[0];
    console.log(`Target class: ${targetClass.name} (ID: ${targetClass.id})`);

    // Get a lecturer
    const { data: lecturers, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'GIANG_VIEN')
      .limit(1);

    if (pErr) {
      console.error('Error fetching lecturer:', pErr);
      return;
    }
    if (!lecturers || lecturers.length === 0) {
      console.log('No lecturers found');
      return;
    }
    const targetLecturer = lecturers[0];
    console.log(`Target lecturer: ${targetLecturer.full_name} (ID: ${targetLecturer.id})`);

    console.log('Attempting assignInstructor...');
    const result = await assignInstructor(targetClass.id, targetLecturer.id);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Caught error during assignInstructor:', err);
  }
}

run();
