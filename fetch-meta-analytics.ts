import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://elzingacreativestudio.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const { client_id, date_preset = 'last_30d' } = await req.json()
    if (!client_id) throw new Error('client_id required')

    // Init Supabase with service role — server-side only, never exposed to browser
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Fetch stored credentials for this client
    const { data: credRow, error: credErr } = await supa
      .from('credentials')
      .select('data')
      .eq('client_id', client_id)
      .single()

    if (credErr || !credRow) throw new Error('No credentials found for this client')

    const creds = credRow.data
    const token      = creds.meta_token
    const account_id = creds.meta_account // format: act_123456789

    if (!token || !account_id) throw new Error('Meta token or account ID missing')

    // ── CALL META MARKETING API ───────────────────────────────────
    const fields = [
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'reach',
      'cpm',
      'cpc',
      'ctr',
      'actions',         // includes leads, purchases etc
      'cost_per_action_type',
      'frequency',
      'unique_clicks',
      'video_play_actions',
      'video_thruplay_watched_actions',
    ].join(',')

    const metaUrl = `https://graph.facebook.com/v19.0/${account_id}/campaigns?` +
      `fields=id,name,status,objective,daily_budget,lifetime_budget,` +
      `insights.date_preset(${date_preset}){${fields}}` +
      `&access_token=${token}`

    const metaRes = await fetch(metaUrl)
    const metaData = await metaRes.json()

    if (metaData.error) throw new Error(`Meta API error: ${metaData.error.message}`)

    // ── PARSE INTO CLEAN ANALYTICS OBJECT ────────────────────────
    const campaigns = (metaData.data || []).map((camp: any) => {
      const ins = camp.insights?.data?.[0] || {}
      const actions = ins.actions || []
      const leads     = actions.find((a: any) => a.action_type === 'lead')?.value || 0
      const purchases = actions.find((a: any) => a.action_type === 'purchase')?.value || 0
      const spend = parseFloat(ins.spend || '0')
      const clicks = parseInt(ins.clicks || '0')
      const impressions = parseInt(ins.impressions || '0')

      return {
        campaign_id:   camp.id,
        campaign_name: camp.name,
        status:        camp.status,
        objective:     camp.objective,
        daily_budget:  camp.daily_budget ? parseInt(camp.daily_budget) / 100 : null,
        spend:         spend,
        impressions:   impressions,
        clicks:        clicks,
        reach:         parseInt(ins.reach || '0'),
        cpm:           parseFloat(ins.cpm || '0'),
        cpc:           parseFloat(ins.cpc || '0'),
        ctr:           parseFloat(ins.ctr || '0'),
        frequency:     parseFloat(ins.frequency || '0'),
        leads:         parseInt(leads),
        purchases:     parseInt(purchases),
        cpl:           leads > 0 ? +(spend / leads).toFixed(2) : null,
        roas:          purchases > 0 ? +(purchases / spend).toFixed(2) : null,
      }
    })

    // ── TOTALS ────────────────────────────────────────────────────
    const totals = campaigns.reduce((acc: any, c: any) => ({
      spend:       +(acc.spend + c.spend).toFixed(2),
      impressions: acc.impressions + c.impressions,
      clicks:      acc.clicks + c.clicks,
      leads:       acc.leads + c.leads,
      purchases:   acc.purchases + c.purchases,
    }), { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0 })

    totals.ctr  = totals.impressions > 0 ? +((totals.clicks / totals.impressions) * 100).toFixed(2) : 0
    totals.cpl  = totals.leads > 0 ? +(totals.spend / totals.leads).toFixed(2) : null
    totals.roas = totals.purchases > 0 ? +(totals.purchases / totals.spend).toFixed(2) : null

    const result = {
      platform:    'meta',
      client_id,
      date_preset,
      fetched_at:  new Date().toISOString(),
      totals,
      campaigns,
    }

    // ── SAVE TO analytics TABLE ───────────────────────────────────
    await supa.from('analytics').upsert([{
      client_id,
      platform: 'meta',
      date_preset,
      data: result,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'client_id,platform,date_preset' })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
