import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://elzingacreativestudio.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEST_MODE = false // Set to true to simulate without hitting Meta API

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

    // Get credentials
    const { data: credRow, error: credErr } = await supa
      .from('credentials')
      .select('data')
      .eq('client_id', client_id)
      .single()

    if (credErr || !credRow) throw new Error('No credentials found for this client')

    const creds = credRow.data
    const token      = creds.meta_token
    const account_id = creds.meta_account

    if (!token || !account_id) throw new Error('Meta token or ad account ID missing in credentials')

    const m = campaign.meta
    const log: string[] = []
    const result: any = { platform: 'meta', client_id, steps: [] }

    // ── TEST MODE ──────────────────────────────────────────────────
    if (TEST_MODE) {
      await new Promise(r => setTimeout(r, 800))
      result.test_mode = true
      result.campaign_id = 'TEST_CAMP_' + Date.now()
      result.adset_id    = 'TEST_ADSET_' + Date.now()
      result.ad_id       = 'TEST_AD_' + Date.now()
      result.steps = [
        { step: 'Campaign',  status: 'success', id: result.campaign_id, name: m.campName },
        { step: 'Ad Set',    status: 'success', id: result.adset_id,    name: m.adsetName },
        { step: 'Ad',        status: 'success', id: result.ad_id,       name: m.adName },
      ]
      result.message = '✓ Test mode — campaign structure validated. Real launch will go live when TEST_MODE=false.'
      await saveToSupabase(supa, client_id, 'meta', campaign, result)
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const api = `https://graph.facebook.com/v19.0`

    // ── STEP 1: CREATE CAMPAIGN ────────────────────────────────────
    const campBody: any = {
      name:         m.campName,
      objective:    m.objective,
      status:       m.status || 'PAUSED',
      buying_type:  m.buyingType || 'AUCTION',
      access_token: token,
    }
    if (m.specialCat && m.specialCat !== 'NONE') campBody.special_ad_categories = [m.specialCat]
    if (m.cbo === 'true' && m.budget) {
      campBody[m.budgetType === 'daily' ? 'daily_budget' : 'lifetime_budget'] = Math.round(parseFloat(m.budget) * 100)
    }
    if (m.spendCap) campBody.spend_cap = Math.round(parseFloat(m.spendCap) * 100)
    if (m.startDate) campBody.start_time = new Date(m.startDate).toISOString()
    if (m.endDate)   campBody.stop_time  = new Date(m.endDate).toISOString()

    const campRes = await fetch(`${api}/${account_id}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campBody),
    })
    const campData = await campRes.json()
    if (campData.error) throw new Error(`Campaign creation failed: ${campData.error.message}`)
    result.campaign_id = campData.id
    result.steps.push({ step: 'Campaign', status: 'success', id: campData.id, name: m.campName })

    // ── STEP 2: CREATE AD SET ──────────────────────────────────────
    const targeting: any = {
      geo_locations: { countries: (m.countries || 'US').split(',').map((s: string) => s.trim().toUpperCase()) },
      age_min:   parseInt(m.ageMin || '18'),
      age_max:   parseInt(m.ageMax || '65'),
    }
    if (m.gender === 'male')   targeting.genders = [1]
    if (m.gender === 'female') targeting.genders = [2]
    if (m.interests) {
      targeting.interests = m.interests.split('\n').filter(Boolean).map((s: string) => ({ name: s.trim() }))
    }
    if (m.customAud) {
      targeting.custom_audiences = m.customAud.split('\n').filter(Boolean).map((id: string) => ({ id: id.trim() }))
    }
    if (m.lookalike) {
      targeting.lookalike_audiences = m.lookalike.split('\n').filter(Boolean).map((id: string) => ({ id: id.trim() }))
    }
    if (m.placementMode === 'manual') {
      const publishers: string[] = []
      const fb_pos: string[] = []
      const ig_pos: string[] = []
      if (m.pubFacebook)   publishers.push('facebook')
      if (m.pubInstagram)  publishers.push('instagram')
      if (m.fbFeed)        fb_pos.push('feed')
      if (m.fbStory)       fb_pos.push('story')
      if (m.fbReels)       fb_pos.push('reels')
      if (m.igStream)      ig_pos.push('stream')
      if (m.igStory)       ig_pos.push('story')
      if (m.igReels)       ig_pos.push('reels')
      if (publishers.length) targeting.publisher_platforms = publishers
      if (fb_pos.length)    targeting.facebook_positions  = fb_pos
      if (ig_pos.length)    targeting.instagram_positions = ig_pos
    }

    const adsetBody: any = {
      name:             m.adsetName,
      campaign_id:      result.campaign_id,
      status:           m.status || 'PAUSED',
      billing_event:    m.billingEvent || 'IMPRESSIONS',
      optimization_goal: m.optGoal || 'REACH',
      targeting,
      access_token:     token,
    }
    if (m.pageId)    adsetBody.promoted_object = { page_id: m.pageId }
    if (m.pixelId)   adsetBody.promoted_object = { ...adsetBody.promoted_object, pixel_id: m.pixelId, custom_event_type: m.convEvent || 'LEAD' }
    if (!m.cbo || m.cbo !== 'true') {
      if (m.adsetBudget) adsetBody[m.budgetType === 'daily' ? 'daily_budget' : 'lifetime_budget'] = Math.round(parseFloat(m.adsetBudget) * 100)
    }
    if (m.bidStrategy) adsetBody.bid_strategy = m.bidStrategy
    if (m.bidCap)      adsetBody.bid_amount    = Math.round(parseFloat(m.bidCap) * 100)
    if (m.adsetStart)  adsetBody.start_time    = new Date(m.adsetStart).toISOString()
    if (m.adsetEnd)    adsetBody.end_time      = new Date(m.adsetEnd).toISOString()

    const adsetRes = await fetch(`${api}/${account_id}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adsetBody),
    })
    const adsetData = await adsetRes.json()
    if (adsetData.error) throw new Error(`Ad set creation failed: ${adsetData.error.message}`)
    result.adset_id = adsetData.id
    result.steps.push({ step: 'Ad Set', status: 'success', id: adsetData.id, name: m.adsetName })

    // ── STEP 3: CREATE AD CREATIVE ─────────────────────────────────
    const creative: any = {
      name: m.adName + '_creative',
      object_story_spec: {
        page_id: m.pageId,
        link_data: {
          message:     m.primaryText,
          name:        m.headline,
          description: m.description,
          link:        m.destUrl,
          call_to_action: { type: m.cta || 'LEARN_MORE', value: { link: m.destUrl } },
        }
      },
      access_token: token,
    }
    if (m.imageUrl) creative.object_story_spec.link_data.picture = m.imageUrl
    if (m.videoId)  {
      delete creative.object_story_spec.link_data
      creative.object_story_spec.video_data = {
        video_id:    m.videoId,
        message:     m.primaryText,
        title:       m.headline,
        call_to_action: { type: m.cta || 'LEARN_MORE', value: { link: m.destUrl } },
      }
    }

    const creativeRes = await fetch(`${api}/${account_id}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creative),
    })
    const creativeData = await creativeRes.json()
    if (creativeData.error) throw new Error(`Creative creation failed: ${creativeData.error.message}`)
    result.creative_id = creativeData.id

    // ── STEP 4: CREATE AD ──────────────────────────────────────────
    const adBody = {
      name:        m.adName,
      adset_id:    result.adset_id,
      creative:    { creative_id: result.creative_id },
      status:      m.status || 'PAUSED',
      access_token: token,
    }
    if (m.utmSource) {
      adBody['tracking_specs'] = [{
        'action.type': ['offsite_conversion'],
        'fb_pixel': [m.pixelId],
      }]
    }

    const adRes = await fetch(`${api}/${account_id}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adBody),
    })
    const adData = await adRes.json()
    if (adData.error) throw new Error(`Ad creation failed: ${adData.error.message}`)
    result.ad_id = adData.id
    result.steps.push({ step: 'Ad', status: 'success', id: adData.id, name: m.adName })
    result.message = '✓ Campaign launched successfully on Meta'

    await saveToSupabase(supa, client_id, 'meta', campaign, result)

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
      campaign_name:  campaign.meta?.campName || campaign.google?.campName || '',
      campaign_data:  campaign,
      launch_result:  result,
      status:         result.error ? 'failed' : 'launched',
      launched_at:    new Date().toISOString(),
    }])
  } catch(e) {
    console.error('Failed to save launch result:', e)
  }
}
