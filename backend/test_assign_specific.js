import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('Logging in as ngconghieu2013@gmail.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'ngconghieu2013@gmail.com',
      password: 'Conghieull1@'
    });
    if (authError) throw authError;

    const token = authData.session.access_token;
    console.log('Login success!');

    const classId = '5981ea7d-f9b4-47b5-9595-e9ff57bea586';
    const instructorId = '14d93c64-70e9-499e-ab88-090f4050b104'; // Nguyệt Anh

    console.log('Sending PUT request to backend...');
    const res = await fetch(`http://localhost:3000/api/classes/${classId}/instructor`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ instructorId })
    });

    console.log('Response status:', res.status);
    const bodyText = await res.text();
    console.log('Response body:', bodyText);
  } catch (err) {
    console.error('API Error:', err);
  }
}

run();
