// Supabase Edge Function: verify-license
// Deploy with: supabase functions deploy verify-license
// Usage (from frontend):
//   GET https://<project>.functions.supabase.co/verify-license?license=ABC123

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// Optional: allow overriding the source dataset via env var
const OCM_DATASET = Deno.env.get("OCM_DATASET") || "jskf-tt3q"; // NYS OCM dataset ID
const OCM_BASE = Deno.env.get("OCM_BASE") || "https://data.ny.gov/resource";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const license = (url.searchParams.get("license") || "").trim();
    if (!license) {
      return new Response(JSON.stringify({ active: false, error: "missing license" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Query the Socrata dataset for the given license
    const queryUrl = `${OCM_BASE}/${OCM_DATASET}.json?q=${encodeURIComponent(license)}&$limit=1`;
    const resp = await fetch(queryUrl);

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ active: false, error: "upstream fetch failed" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const json = await resp.json();
    const active = Array.isArray(json) ? json.length > 0 : false;

    return new Response(JSON.stringify({ active }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ active: false, error: "server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
