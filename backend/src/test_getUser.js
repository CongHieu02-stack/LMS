import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Đăng nhập để lấy access_token thật
    console.log('Logging in...')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'ngconghieu2005@gmail.com',
      password: 'Conghieull1@'
    })

    if (authError) throw authError

    const token = authData.session.access_token
    console.log('Log in successful! Token starts with:', token.substring(0, 20))

    // 2. Thử gọi getUser bằng token
    console.log('Testing getUser(token) using createClient instance...')
    const { data: userData1, error: error1 } = await supabase.auth.getUser(token)
    if (error1) {
      console.warn('getUser(token) failed:', error1.message)
    } else {
      console.log('getUser(token) succeeded! User email:', userData1.user?.email)
    }

    // 3. Thử tạo client mới không có persistSession và gọi getUser(token)
    console.log('Testing with persistSession: false...')
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: userData2, error: error2 } = await adminClient.auth.getUser(token)
    if (error2) {
      console.warn('adminClient.auth.getUser(token) failed:', error2.message)
    } else {
      console.log('adminClient.auth.getUser(token) succeeded! User email:', userData2.user?.email)
    }

  } catch (err) {
    console.error('Error:', err.message)
  }
}

run()
