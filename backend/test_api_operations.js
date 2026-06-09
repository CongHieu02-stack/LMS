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

    // 1. GET pending subjects
    console.log('Fetching subjects list...');
    const subjRes = await fetch('http://localhost:3000/api/subjects', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Subjects list response status:', subjRes.status);
    const subjData = await subjRes.json();
    const pendingSubjects = subjData.data?.filter(s => s.status === 'pending') || [];
    console.log(`Found ${pendingSubjects.length} pending subjects.`);

    if (pendingSubjects.length > 0) {
      const subject = pendingSubjects[0];
      console.log(`Attempting to approve subject: ${subject.name} (${subject.id})...`);
      
      const approveRes = await fetch(`http://localhost:3000/api/subjects/${subject.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'approved' })
      });
      console.log('Approve subject status:', approveRes.status);
      console.log('Approve subject response:', await approveRes.text());
    } else {
      console.log('No pending subjects to approve.');
    }

    // 2. GET pending class proposals
    console.log('Fetching class proposals list...');
    const propRes = await fetch('http://localhost:3000/api/class-proposals/pending', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Class proposals response status:', propRes.status);
    const propData = await propRes.json();
    console.log('Class proposals list:', propData);

    const pendingProposals = propData.data || [];
    if (pendingProposals.length > 0) {
      const proposal = pendingProposals[0];
      console.log(`Attempting to approve class proposal ID: ${proposal.id}...`);

      const approvePropRes = await fetch(`http://localhost:3000/api/class-proposals/${proposal.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'approved' })
      });
      console.log('Approve class proposal status:', approvePropRes.status);
      console.log('Approve class proposal response:', await approvePropRes.text());
    } else {
      console.log('No pending class proposals to approve.');
    }

  } catch (err) {
    console.error('Error during run:', err);
  }
}

run();
