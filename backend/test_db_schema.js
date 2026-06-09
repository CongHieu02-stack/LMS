import 'dotenv/config';
import { supabaseAdmin } from './src/config/supabase.js';

async function run() {
  const { data: subjects, error: err1 } = await supabaseAdmin
    .from('subjects')
    .select('*')
    .limit(1);

  if (err1) {
    console.error('Subjects err:', err1);
  } else {
    console.log('Subject record:', subjects[0]);
  }

  const { data: proposals, error: err2 } = await supabaseAdmin
    .from('class_proposals')
    .select('*')
    .limit(1);

  if (err2) {
    console.error('Proposals err:', err2);
  } else {
    console.log('Proposal record:', proposals[0]);
  }

  const { data: classes, error: err3 } = await supabaseAdmin
    .from('classes')
    .select('*')
    .limit(1);

  if (err3) {
    console.error('Classes err:', err3);
  } else {
    console.log('Class record:', classes[0]);
  }
}

run().catch(console.error);
