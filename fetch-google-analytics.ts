import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://elzingacreativestudio.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Refresh Google OAuth access token using stored refresh token
async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to refresh Google access token')
  return data.access_token
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

    const { client_id, days = 30 } = await req.json()
    if (!client_id) throw new Error('client_id required')

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Fetch credentials
    const { data: credRow, error: credErr } = await supa
      .from('credentials')
      .select('data')
      .eq('client_id', client_id)
      .single()

    if (credErr || !credRow) throw new Error('No credentials found for this client')

    const creds = credRow.data
    const { g_client_id, g_client_secret, g_refresh, g_customer, g_mcc, g_dev_token } = creds

    if (!g_client_id || !g_client_secret || !g_refresh || !g_customer) {
      throw new Error('Google Ads credentials incomplete')
    }

    // Get fresh access token
    const accessToken = await getGoogleAccessToken(g_client_id, g_client_secret, g_refresh)

    // ── CALL GOOGLE ADS API (REST) ────────────────────────────────
    const customerId = g_customer.replace(/-/g, '')
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)
    const fmt = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '')

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.conversions,
        metrics.cost_per_conversion,
        metrics.conversion_value,
        metrics.search_impression_share,
        metrics.all_conversions
      FROM campaign
      WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
        AND campaign.status != 'REMOVED'
    `

    const googleRes = await fetch(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization':        `Bearer ${accessToken}`,
          'developer-token':      g_dev_token,
          'Content-Type':         'application/json',
          ...(g_mcc ? { 'login-customer-id': g_mcc.replace(/-/g, '') } : {}),
        },
        body: JSON.stringify({ query }),
      }
    )

    const googleData = await googleRes.json()
    if (googleData.error) throw new Error(`Google Ads API error: ${googleData.error.message}`)

    // ── PARSE RESULTS ─────────────────────────────────────────────
    const rows = googleData.results || []

    // Aggregate by campaign
    const campMap: Record<string, any> = {}
    for (const row of rows) {
      const id = row.campaign.id
      if (!campMap[id]) {
        campMap[id] = {
          campaign_id:   id,
          campaign_name: row.campaign.name,
          status:        row.campaign.status,
          type:          row.campaign.advertisingChannelType,
          impressions:   0, clicks: 0, spend: 0,
          conversions:   0, conversion_value: 0,
        }
      }
      const c = campMap[id]
      const m = row.metrics
      c.impressions        += parseInt(m.impressions || '0')
      c.clicks             += parseInt(m.clicks || '0')
      c.spend              += (parseInt(m.costMicros || '0') / 1_000_000)
      c.conversions        += parseFloat(m.conversions || '0')
      c.conversion_value   += parseFloat(m.conversionValue || '0')
    }

    const campaigns = Object.values(campMap).map((c: any) => ({
      ...c,
      spend:   +c.spend.toFixed(2),
      ctr:     c.impressions > 0 ? +((c.clicks / c.impressions) * 100).toFixed(2) : 0,
      cpc:     c.clicks > 0 ? +(c.spend / c.clicks).toFixed(2) : null,
      cpa:     c.conversions > 0 ? +(c.spend / c.conversions).toFixed(2) : null,
      roas:    c.spend > 0 ? +(c.conversion_value / c.spend).toFixed(2) : null,
    }))

    // Totals
    const totals = campaigns.reduce((acc: any, c: any) => ({
      spend:            +(acc.spend + c.spend).toFixed(2),
      impressions:      acc.impressions + c.impressions,
      clicks:           acc.clicks + c.clicks,
      conversions:      +(acc.conversions + c.conversions).toFixed(1),
      conversion_value: +(acc.conversion_value + c.conversion_value).toFixed(2),
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 })

    totals.ctr  = totals.impressions > 0 ? +((totals.clicks / totals.impressions) * 100).toFixed(2) : 0
    totals.cpa  = totals.conversions > 0 ? +(totals.spend / totals.conversions).toFixed(2) : null
    totals.roas = totals.spend > 0 ? +(totals.conversion_value / totals.spend).toFixed(2) : null

    const result = {
      platform:   'google',
      client_id,
      days,
      fetched_at: new Date().toISOString(),
      totals,
      campaigns,
    }

    // Save to analytics table
    await supa.from('analytics').upsert([{
      client_id,
      platform: 'google',
      date_preset: `last_${days}d`,
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
