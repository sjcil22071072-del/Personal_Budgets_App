import { createClient, createAdminClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// GET: 지원자 목록 조회
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // adminClient로 RLS 우회해서 본인 role 조회
    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 지원자 목록 조회
    const { data: supporters, error } = await adminClient
      .from('profiles')
      .select('id, name, email, role')
      .in('role', ['admin', 'supporter'])
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(supporters || [])
  } catch (error) {
    console.error('Error fetching supporters:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}