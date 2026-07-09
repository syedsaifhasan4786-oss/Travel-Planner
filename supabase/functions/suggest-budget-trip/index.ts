// Supabase Edge Function: suggest-budget-trip
// Calls the Gemini API server-side using the GEMINI_API_KEY secret.
// Never exposes the API key to the client.
//
// Deploy:  supabase functions deploy suggest-budget-trip
// Secret:  supabase secrets set GEMINI_API_KEY=<your_key>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { destination, budget_inr, days } = await req.json();

    if (!destination || budget_inr == null || days == null) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: destination, budget_inr, days' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret is not configured on this project.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const prompt = `You are a professional travel budget planner.
A traveler is going to ${destination} for ${days} day(s) with a total budget of ₹${budget_inr} INR.

Produce a realistic, day-by-day cost breakdown that fits entirely within that budget.
Return ONLY a valid JSON object — no markdown fences, no extra commentary — with this exact structure:

{
  "summary": "<1-2 sentence trip overview>",
  "total_estimated_cost": <number>,
  "currency": "INR",
  "days": [
    {
      "day": 1,
      "travel": <number>,
      "accommodation": <number>,
      "food": <number>,
      "activities": <number>,
      "notes": "<practical suggestions for the day>"
    }
  ]
}

Rules:
- total_estimated_cost must be <= ${budget_inr}.
- The sum of (travel + accommodation + food + activities) across all days must be <= ${budget_inr}.
- Use realistic local prices for ${destination}.
- Day 1 may include higher travel/transport costs (e.g. airport transfer).
- Return exactly ${days} objects inside the "days" array.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini API error ${geminiResponse.status}: ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText: string | undefined =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Gemini returned an empty response.');
    }

    // Strip potential markdown code fences before parsing
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini response did not contain a JSON object.');
    }

    const suggestion = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
