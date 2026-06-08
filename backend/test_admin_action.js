import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    console.log('Logging in as ngconghieu2007@gmail.com (HIEU_TRUONG)...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'ngconghieu2007@gmail.com',
      password: 'Conghieull1@'
    });
    if (authError) throw authError;

    const token = authData.session.access_token;
    console.log('Login success!');

    // First, let's create a subject so we have a target
    const randomCode = 'TEST' + Math.floor(100 + Math.random() * 900);
    console.log(`Creating a pending subject with code ${randomCode}...`);
    const createRes = await fetch('http://localhost:3000/api/subjects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        code: randomCode,
        name: 'Test Subject ' + randomCode,
        credits: 3,
        description: 'Testing admin action'
      })
    });
    console.log('Create response status:', createRes.status);
    const createData = await createRes.json();
    console.log('Create response:', createData);
    if (!createData.success) {
      console.error('Failed to create test subject');
      return;
    }

    const subjectId = createData.data.id;

    // Now call the /admin/action endpoint to approve it
    console.log(`Calling /admin/action to approve subject ${subjectId}...`);
    const approveRes = await fetch('http://localhost:3000/api/admin/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        entity: 'subject',
        targetId: subjectId,
        action: 'DUYET',
        reason: null
      })
    });

    console.log('Approve response status:', approveRes.status);
    console.log('Approve response:', await approveRes.text());

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
