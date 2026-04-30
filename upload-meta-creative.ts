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

    const { client_id, image_url, image_data, filename } = await req.json()
    if (!client_id) throw new Error('client_id required')
    if (!image_url && !image_data) throw new Error('image_url or image_data required')

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const { data: credRow, error: credErr } = await supa
      .from('credentials').select('data').eq('client_id', client_id).single()
    if (credErr || !credRow) throw new Error('No credentials found')

    const { meta_token, meta_account } = credRow.data
    if (!meta_token || !meta_account) throw new Error('Meta token or account missing')

    const api = `https://graph.facebook.com/v19.0/${meta_account}/adimages`

    let body: any = { access_token: meta_token }

    if (image_url) {
      // Upload by URL
      body.url = image_url
      body.filename = filename || 'image.jpg'
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(`Meta image upload error: ${data.error.message}`)
      const images = data.images
      const key = Object.keys(images)[0]
      const img = images[key]
      return new Response(JSON.stringify({
        success: true,
        hash: img.hash,
        url:  img.url,
        width: img.width,
        height: img.height,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (image_data) {
      // Upload base64 image
      body.bytes = image_data
      body.name  = filename || 'upload.jpg'
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(`Meta image upload error: ${data.error.message}`)
      const images = data.images
      const key = Object.keys(images)[0]
      const img = images[key]
      return new Response(JSON.stringify({
        success: true,
        hash: img.hash,
        url:  img.url,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
