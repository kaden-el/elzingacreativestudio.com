import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://elzingacreativestudio.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to refresh Google token')
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

    const { client_id, campaign_resource_name, action, value } = await req.json()
    if (!client_id || !campaign_resource_name || !action) {
      throw new Error('client_id, campaign_resource_name, action required')
    }

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const { data: credRow, error: credErr } = await supa
      .from('credentials').select('data').eq('client_id', client_id).single()
    if (credErr || !credRow) throw new Error('No credentials found')

    const { g_client_id, g_client_secret, g_refresh, g_customer, g_mcc, g_dev_token } = credRow.data
    if (!g_client_id || !g_client_secret || !g_refresh || !g_customer) {
      throw new Error('Google credentials incomplete')
    }

    const accessToken = await getGoogleAccessToken(g_client_id, g_client_secret, g_refresh)
    const customerId  = g_customer.replace(/-/g, '')
    const authHeaders = {
      'Authorization':   `Bearer ${accessToken}`,
      'developer-token': g_dev_token,
      'Content-Type':    'application/json',
      ...(g_mcc ? { 'login-customer-id': g_mcc.replace(/-/g, '') } : {}),
    }

    let resultMsg = ''

    if (action === 'pause' || action === 'resume' || action === 'archive') {
      const statusMap: any = { pause: 'PAUSED', resume: 'ENABLED', archive: 'REMOVED' }
      const res = await fetch(
        `https://googleads.googleapis.com/v16/customers/${customerId}/campaigns:mutate`,
        {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({
            operations: [{ update: { resourceName: campaign_resource_name, status: statusMap[action] }, updateMask: 'status' }]
          })
        }
      )
      const data = await res.json()
      if (data.error) throw new Error(`Google API error: ${data.error.message}`)
      resultMsg = `Campaign ${action}d`

      const dbStatusMap: any = { pause: 'paused', resume: 'launched', archive: 'archived' }
      await supa.from('launched_campaigns')
        .update({ status: dbStatusMap[action] })
        .eq('client_id', client_id)
        .contains('launch_result', { campaign_id: campaign_resource_name })

    } else if (action === 'edit_budget') {
      if (!value) throw new Error('value required for edit_budget')
      // First get the budget resource name from the campaign
      const campRes = await fetch(
        `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`,
        {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ query: `SELECT campaign.campaign_budget FROM campaign WHERE campaign.resource_name = '${campaign_resource_name}'` })
        }
      )
      const campData = await campRes.json()
      const budgetResourceName = campData.results?.[0]?.campaign?.campaignBudget
      if (!budgetResourceName) throw new Error('Could not find campaign budget')

      const res = await fetch(
        `https://googleads.googleapis.com/v16/customers/${customerId}/campaignBudgets:mutate`,
        {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({
            operations: [{
              update: { resourceName: budgetResourceName, amountMicros: Math.round(parseFloat(value) * 1_000_000) },
              updateMask: 'amount_micros'
            }]
          })
        }
      )
      const data = await res.json()
      if (data.error) throw new Error(`Google budget update error: ${data.error.message}`)
      resultMsg = `Budget updated to $${value}/day`
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
