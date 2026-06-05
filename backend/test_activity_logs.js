import 'dotenv/config'
import { supabaseAdmin } from './src/config/supabase.js'

async function check() {
  console.log('Querying first profile...')
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role')
    .limit(1)

  if (profileError) {
    console.error('Failed to fetch profiles:', profileError)
    return
  }

  if (!profiles || profiles.length === 0) {
    console.log('No profiles found in database!')
    return
  }

  const testUser = profiles[0]
  console.log('Using profile for test insert:', testUser)

  console.log('Inserting test log into admin_activity_logs...')
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('admin_activity_logs')
    .insert({
      admin_id: testUser.id,
      action_type: 'ADMIN_ACTION',
      target_type: 'SYSTEM',
      description: `Kiểm tra ghi log hoạt động cho admin ${testUser.full_name}`,
      metadata: { ip: '127.0.0.1', userAgent: 'NodeTest' }
    })
    .select()

  if (insertError) {
    console.error('Insert error:', insertError)
  } else {
    console.log('Inserted log successfully:', inserted)
  }

  console.log('Fetching logs again...')
  const { data: logs, error: logsError } = await supabaseAdmin
    .from('admin_activity_logs')
    .select(`
      id,
      action_type,
      target_type,
      target_id,
      description,
      metadata,
      created_at,
      profiles (
        id,
        email,
        full_name,
        role
      )
    `)
    .limit(5)

  if (logsError) {
    console.error('Logs fetch error:', logsError)
  } else {
    console.log('Logs in database:', JSON.stringify(logs, null, 2))
  }
}

check().catch(console.error)
