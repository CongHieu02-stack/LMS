import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    // 1. Login as TBM
    console.log('Logging in as TBM (ngconghieu2013@gmail.com)...');
    const { data: tbmAuth, error: tbmAuthErr } = await supabase.auth.signInWithPassword({
      email: 'ngconghieu2013@gmail.com',
      password: 'Conghieull1@'
    });
    if (tbmAuthErr) throw tbmAuthErr;
    const tbmToken = tbmAuth.session.access_token;

    // 2. Login as HIEU_TRUONG
    console.log('Logging in as HIEU_TRUONG (ngconghieu2007@gmail.com)...');
    const { data: htAuth, error: htAuthErr } = await supabase.auth.signInWithPassword({
      email: 'ngconghieu2007@gmail.com',
      password: 'Conghieull1@'
    });
    if (htAuthErr) throw htAuthErr;
    const htToken = htAuth.session.access_token;

    // 3. TBM creates subject proposal
    const randomCode = 'TEST' + Math.floor(100 + Math.random() * 900);
    console.log(`TBM creating pending subject: ${randomCode}...`);
    const createSubj = await fetch('http://localhost:3000/api/subjects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tbmToken}`
      },
      body: JSON.stringify({
        code: randomCode,
        name: 'Test Subject ' + randomCode,
        credits: 3,
        description: 'TBM proposed subject',
        department: 'Khoa Công nghệ thông tin'
      })
    });
    const createSubjData = await createSubj.json();
    console.log('Create subject response:', createSubjData);
    if (!createSubjData.success) return;

    const subjectId = createSubjData.data.id;

    // 4. HIEU_TRUONG approves subject
    console.log(`HIEU_TRUONG approving subject: ${subjectId}...`);
    const approveSubj = await fetch(`http://localhost:3000/api/subjects/${subjectId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${htToken}`
      },
      body: JSON.stringify({ status: 'approved' })
    });
    console.log('Approve subject response:', await approveSubj.json());

    // 5. TBM creates class proposal for the approved subject
    console.log(`TBM creating class proposal for subject: ${subjectId}...`);
    const createProp = await fetch('http://localhost:3000/api/class-proposals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tbmToken}`
      },
      body: JSON.stringify({
        subjectId: subjectId,
        quantity: 2,
        maxStudents: 40,
        semester: 'HK1-2026',
        reason: 'Nhu cầu cao',
        schedule: 'T2(07:30-10:00), T4(13:00-15:30)',
        startDate: '2026-06-25',
        endDate: '2026-09-15'
      })
    });
    const createPropData = await createProp.json();
    console.log('Create class proposal response:', createPropData);
    if (!createPropData.success) return;

    const proposalId = createPropData.data.id;

    // 6. HIEU_TRUONG approves class proposal
    console.log(`HIEU_TRUONG approving class proposal: ${proposalId}...`);
    const approveProp = await fetch(`http://localhost:3000/api/class-proposals/${proposalId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${htToken}`
      },
      body: JSON.stringify({ status: 'approved' })
    });
    console.log('Approve class proposal response:', await approveProp.json());

  } catch (err) {
    console.error('Error during workflow:', err);
  }
}

run();
