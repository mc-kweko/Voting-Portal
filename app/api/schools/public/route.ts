import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('schools')
      .select('id, name, slug, portal_live')
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching schools:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch schools'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
