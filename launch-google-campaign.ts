import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://elzingacreativestudio.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEST_MODE = false // Set to true to simulate without hitting Google API

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
  if (!data.access_token) throw new Error('Failed to refresh Google access token: ' + JSON.stringify(data))
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

    const { client_id, campaign } = await req.json()
    if (!client_id || !campaign) throw new Error('client_id and campaign required')

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const { data: credRow, error: credErr } = await supa
      .from('credentials')
      .select('data')
      .eq('client_id', client_id)
      .single()

    if (credErr || !credRow) throw new Error('No credentials found for this client')

    const creds = credRow.data
    const { g_client_id, g_client_secret, g_refresh, g_customer, g_mcc, g_dev_token } = creds

    if (!g_client_id || !g_client_secret || !g_refresh || !g_customer) {
      throw new Error('Google Ads credentials incomplete — need client_id, client_secret, refresh_token, customer_id')
    }

    const result: any = { platform: 'google', client_id, steps: [] }
    const g = campaign.google

    // ── TEST MODE ──────────────────────────────────────────────────
    if (TEST_MODE) {
      await new Promise(r => setTimeout(r, 800))
      result.test_mode    = true
      result.campaign_id  = 'TEST_GCAMP_' + Date.now()
      result.adgroup_id   = 'TEST_GAG_' + Date.now()
      result.steps = [
        { step: 'Campaign',  status: 'success', id: result.campaign_id, name: g.campName },
        { step: 'Ad Group',  status: 'success', id: result.adgroup_id,  name: g.agName },
        { step: 'Ad',        status: 'success', id: 'TEST_GAD_' + Date.now(), name: 'Responsive Search Ad' },
      ]
      result.message = '✓ Test mode — Google campaign structure validated.'
      await saveToSupabase(supa, client_id, 'google', campaign, result)
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const accessToken  = await getGoogleAccessToken(g_client_id, g_client_secret, g_refresh)
    const customerId   = g_customer.replace(/-/g, '')
    const baseUrl      = `https://googleads.googleapis.com/v16/customers/${customerId}`
    const authHeaders  = {
      'Authorization':   `Bearer ${accessToken}`,
      'developer-token': g_dev_token,
      'Content-Type':    'application/json',
      ...(g_mcc ? { 'login-customer-id': g_mcc.replace(/-/g, '') } : {}),
    }

    // ── STEP 1: CREATE CAMPAIGN BUDGET ─────────────────────────────
    const budgetRes = await fetch(`${baseUrl}/campaignBudgets:mutate`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({
        operations: [{
          create: {
            name:           g.campName + '_budget',
            amountMicros:   Math.round(parseFloat(g.dailyBudget || '50') * 1_000_000),
            deliveryMethod: 'STANDARD',
          }
        }]
      })
    })
    const budgetData = await budgetRes.json()
    if (budgetData.error) throw new Error(`Budget creation failed: ${budgetData.error.message}`)
    const budgetResourceName = budgetData.results?.[0]?.resourceName
    result.steps.push({ step: 'Budget', status: 'success', name: g.campName + '_budget' })

    // ── STEP 2: CREATE CAMPAIGN ────────────────────────────────────
    const campPayload: any = {
      name:             g.campName,
      status:           g.status || 'PAUSED',
      campaignBudget:   budgetResourceName,
      advertisingChannelType: g.campType || 'SEARCH',
      networkSettings: {
        targetGoogleSearch:         g.netSearch !== false,
        targetSearchNetwork:        g.netPartners === true,
        targetContentNetwork:       g.netDisplay === true,
      },
      startDate: (g.startDate || new Date().toISOString().split('T')[0]).replace(/-/g, ''),
    }
    if (g.endDate) campPayload.endDate = g.endDate.replace(/-/g, '')
    if (g.bidStrategy === 'TARGET_CPA' && g.targetCpa) {
      campPayload.targetCpa = { targetCpaMicros: Math.round(parseFloat(g.targetCpa) * 1_000_000) }
    } else if (g.bidStrategy === 'TARGET_ROAS' && g.targetRoas) {
      campPayload.targetRoas = { targetRoas: parseFloat(g.targetRoas) / 100 }
    } else if (g.bidStrategy === 'MAXIMIZE_CONVERSIONS') {
      campPayload.maximizeConversions = {}
    } else if (g.bidStrategy === 'MAXIMIZE_CONVERSION_VALUE') {
      campPayload.maximizeConversionValue = {}
    } else {
      campPayload.manualCpc = { enhancedCpcEnabled: g.enhancedCpc === 'true' }
    }

    const campRes = await fetch(`${baseUrl}/campaigns:mutate`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ operations: [{ create: campPayload }] })
    })
    const campData = await campRes.json()
    if (campData.error) throw new Error(`Campaign creation failed: ${campData.error.message}`)
    const campResourceName = campData.results?.[0]?.resourceName
    result.campaign_id = campResourceName
    result.steps.push({ step: 'Campaign', status: 'success', id: campResourceName, name: g.campName })

    // ── STEP 3: CREATE AD GROUP ────────────────────────────────────
    const agRes = await fetch(`${baseUrl}/adGroups:mutate`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({
        operations: [{
          create: {
            name:     g.agName || g.campName + '_AG1',
            campaign: campResourceName,
            status:   'ENABLED',
            type:     g.campType === 'DISPLAY' ? 'DISPLAY_STANDARD' : 'DEFAULT',
            cpcBidMicros: Math.round(parseFloat(g.agCpc || '1') * 1_000_000),
          }
        }]
      })
    })
    const agData = await agRes.json()
    if (agData.error) throw new Error(`Ad group creation failed: ${agData.error.message}`)
    const agResourceName = agData.results?.[0]?.resourceName
    result.adgroup_id = agResourceName
    result.steps.push({ step: 'Ad Group', status: 'success', id: agResourceName, name: g.agName })

    // ── STEP 4: ADD KEYWORDS ───────────────────────────────────────
    if (g.keywords) {
      const keywords = g.keywords.split('\n').map((k: string) => k.trim()).filter(Boolean)
      const kwOps = keywords.map((kw: string) => {
        let matchType = 'BROAD'
        let text = kw
        if (kw.startsWith('"') && kw.endsWith('"')) { matchType = 'PHRASE'; text = kw.slice(1,-1) }
        else if (kw.startsWith('[') && kw.endsWith(']')) { matchType = 'EXACT'; text = kw.slice(1,-1) }
        return { create: { adGroup: agResourceName, status: 'ENABLED', text, matchType } }
      })
      if (kwOps.length) {
        const kwRes = await fetch(`${baseUrl}/adGroupCriteria:mutate`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ operations: kwOps })
        })
        const kwData = await kwRes.json()
        if (!kwData.error) result.steps.push({ step: 'Keywords', status: 'success', count: kwOps.length })
      }
    }

    // ── STEP 5: CREATE RESPONSIVE SEARCH AD ───────────────────────
    const headlines = g.headlines?.filter(Boolean).slice(0,15) || []
    const descriptions = g.descriptions?.filter(Boolean).slice(0,4) || []
    if (headlines.length >= 3 && descriptions.length >= 2) {
      const adRes = await fetch(`${baseUrl}/adGroupAds:mutate`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          operations: [{
            create: {
              adGroup: agResourceName,
              status:  'ENABLED',
              ad: {
                finalUrls: [g.finalUrl],
                responsiveSearchAd: {
                  headlines:    headlines.map((h: string) => ({ text: h })),
                  descriptions: descriptions.map((d: string) => ({ text: d })),
                  path1: g.path1 || '',
                  path2: g.path2 || '',
                }
              }
            }
          }]
        })
      })
      const adData = await adRes.json()
      if (adData.error) throw new Error(`Ad creation failed: ${adData.error.message}`)
      result.ad_id = adData.results?.[0]?.resourceName
      result.steps.push({ step: 'Ad', status: 'success', id: result.ad_id, name: 'Responsive Search Ad' })
    }

    result.message = '✓ Campaign launched successfully on Google Ads'
    await saveToSupabase(supa, client_id, 'google', campaign, result)

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

async function saveToSupabase(supa: any, client_id: string, platform: string, campaign: any, result: any) {
  try {
    await supa.from('launched_campaigns').insert([{
      client_id,
      platform,
      campaign_name: campaign.google?.campName || '',
      campaign_data: campaign,
      launch_result: result,
      status:        result.error ? 'failed' : 'launched',
      launched_at:   new Date().toISOString(),
    }])
  } catch(e) { console.error('Failed to save launch result:', e) }
}
