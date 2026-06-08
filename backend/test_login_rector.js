import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using admin key to check auth client or anon
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const emails = ['nguyenvanz@gmail.com', 'nguyenvana@gmail.com', 'ngconghieu2007@gmail.com'];
  for (const email of emails) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'Conghieull1@'
      });
      if (error) {
        console.log(`Failed for ${email}: ${error.message}`);
      } else {
        console.log(`SUCCESS for ${email}! User:`, data.user.email);
        return;
      }
    } catch (e) {
      console.log(`Error for ${email}:`, e.message);
    }
  }
}

test().catch(console.error);
