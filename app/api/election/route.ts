export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { parseTimestampMs } from '@/lib/time'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const cookieStore = await cookies()
    const schoolSlug = request.nextUrl.searchParams.get('school') || cookieStore.get('voter_school_slug')?.value
    if (!schoolSlug) {
      return NextResponse.json({ error: 'school query param or voter cookie required' }, { status: 400 })
    }

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', schoolSlug)
      .single()

    if (schoolError || !school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    const schoolId = school.id

    const { data, error } = await supabase
      .from('election_stats')
      .select('id, is_active, started_at, ended_at, total_students, students_voted, votes_cast, election_year')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) {
      return NextResponse.json(
        { is_active: false, started_at: null, ended_at: null, time_remaining: 0 },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    const now = Date.now()
    const endTime = parseTimestampMs(data.ended_at)
    const timeRemaining = endTime ? Math.max(0, Math.floor((endTime - now) / 1000)) : 0
    
    // Auto-deactivate if time has expired but still marked active
    if (data.is_active && timeRemaining === 0 && endTime > 0) {
      await supabase
        .from('election_stats')
        .update({ is_active: false })
        .eq('id', data.id)
        .eq('school_id', schoolId)
      
      data.is_active = false
    }

    return NextResponse.json(
      { ...data, time_remaining: timeRemaining },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('Error fetching election status:', error)
    return NextResponse.json({ error: 'Failed to fetch election status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed in Voting Portal' }, { status: 405 })
}
