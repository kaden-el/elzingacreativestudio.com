import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://elzingacreativestudio.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// action: 'pause' | 'resume' | 'edit_budget' | 'archive'
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── AUTH CHECK — reject unauthenticated requests ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { client_id, campaign_id, action, value } = await req.json()
    if (!client_id || !campaign_id || !action) throw new Error('client_id, campaign_id, action required')

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const { data: credRow, error: credErr } = await supa
      .from('credentials').select('data').eq('client_id', client_id).single()
    if (credErr || !credRow) throw new Error('No credentials found')

    const { meta_token } = credRow.data
    if (!meta_token) throw new Error('Meta token missing')

    const api = `https://graph.facebook.com/v19.0/${campaign_id}`
    let body: any = { access_token: meta_token }
    let resultMsg = ''

    switch (action) {
      case 'pause':
        body.status = 'PAUSED'
        resultMsg = 'Campaign paused'
        break
      case 'resume':
        body.status = 'ACTIVE'
        resultMsg = 'Campaign resumed'
        break
      case 'edit_budget':
        if (!value) throw new Error('value required for edit_budget')
        body.daily_budget = Math.round(parseFloat(value) * 100)
        resultMsg = `Budget updated to $${value}/day`
        break
      case 'archive':
        body.status = 'ARCHIVED'
        resultMsg = 'Campaign archived'
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) throw new Error(`Meta API error: ${data.error.message}`)

    // Update status in launched_campaigns table
    if (action === 'pause' || action === 'resume' || action === 'archive') {
      const statusMap: any = { pause: 'paused', resume: 'launched', archive: 'archived' }
      await supa.from('launched_campaigns')
        .update({ status: statusMap[action] })
        .eq('client_id', client_id)
        .contains('launch_result', { campaign_id })
    }

    return new Response(JSON.stringify({ success: true, message: resultMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
