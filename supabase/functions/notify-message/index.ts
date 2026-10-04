// Supabase Edge Function: notify-message
// Sends a "new message" email to the partner's contact_email.
//
// Deploy:
//   supabase functions deploy notify-message --no-verify-jwt
//
// Environment variables (set in Supabase dashboard → Project Settings → Edge Functions):
//   RESEND_API_KEY   — from resend.com (free tier covers ~3k emails/month)
//   FROM_EMAIL       — verified sender address, e.g. "notifications@licensedexchange.com"
//
// After deploy, set window.NOTIFY_MESSAGE_URL in index.html to:
//   https://<project-ref>.supabase.co/functions/v1/notify-message

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notifications@licensedexchange.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const { conversation_id, partner_listing_id, sender_name, preview } = await req.json();
    if (!partner_listing_id || !preview) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch partner's contact email from their listing
    const { data: listing, error } = await supabase
      .from('listings')
      .select('contact_email, business_name, contact_name')
      .eq('id', partner_listing_id)
      .maybeSingle();

    if (error || !listing?.contact_email) {
      return new Response(JSON.stringify({ error: 'Partner listing not found' }), { status: 404 });
    }

    const recipientEmail = listing.contact_email;
    const recipientName = listing.contact_name || listing.business_name;
    const previewTruncated = preview.length > 120 ? preview.slice(0, 117) + '…' : preview;

    const emailBody = {
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `New message from ${sender_name || 'a partner'} on Licensed Exchange`,
      html: `
        <p>Hi ${recipientName},</p>
        <p><strong>${sender_name || 'A partner'}</strong> sent you a message on Licensed Exchange:</p>
        <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">${previewTruncated}</blockquote>
        <p><a href="https://licensed-exchange.vercel.app">Log in to reply →</a></p>
        <p style="font-size:0.8em;color:#999;">You're receiving this because your business is listed on Licensed Exchange.</p>
      `
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailBody)
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Email delivery failed' }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('notify-message error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
