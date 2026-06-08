import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Login
    console.log('Logging in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'ngconghieu2013@gmail.com',
      password: 'Conghieull1@'
    });
    if (authError) throw authError;

    const token = authData.session.access_token;
    console.log('Login success!');

    // 2. Fetch a class from Khoa Quản trị - Marketing
    const { data: classes, error: cErr } = await supabase
      .from('classes')
      .select('id, name, subject:subjects(department)')
      .eq('subjects.department', 'Khoa Quản trị - Marketing');
    
    // Filter manually because of nested select filtering
    const matchingClass = classes.find(c => c.subject?.department === 'Khoa Quản trị - Marketing');
    if (!matchingClass) {
      console.log('No matching class found in Khoa Quản trị - Marketing');
      return;
    }
    console.log(`Matching class: ${matchingClass.name} (ID: ${matchingClass.id})`);

    // 3. Lecturer info (e.g., nguyetanh@gmail.com ID or tinh184@gmail.com)
    // We saw tinh184@gmail.com has ID: '5947e60c-ca0d-41a6-9ebc-35b8dedf395a'
    const instructorId = '5947e60c-ca0d-41a6-9ebc-35b8dedf395a';

    // 4. PUT request
    console.log('Sending PUT request to backend...');
    const res = await fetch(`http://localhost:3000/api/classes/${matchingClass.id}/instructor`, {
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
