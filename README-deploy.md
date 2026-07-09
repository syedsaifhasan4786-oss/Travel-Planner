# Deployment notes

This project includes CI files to deploy Supabase Edge Functions and the frontend to Vercel.

Required GitHub Secrets (set in repository Settings → Secrets):

- `SUPABASE_ACCESS_TOKEN` — token for Supabase CLI (from `supabase login`)
- `SUPABASE_PROJECT_REF` — your Supabase project ref (from project settings)
- `VERCEL_TOKEN` — Vercel API token
- `VERCEL_ORG_ID` — Vercel organization id
- `VERCEL_PROJECT_ID` — Vercel project id

Also, in Supabase dashboard set the following function secrets:

- `GEMINI_API_KEY` — Gemini API key (keep private)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key used by server-side functions

Quick manual commands:

```bash
# Deploy functions locally with supabase CLI
supabase login
supabase secrets set GEMINI_API_KEY="<value>" --project-ref <ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<value>" --project-ref <ref>
cd supabase/functions/suggest-budget-trip
supabase functions deploy suggest-budget-trip --project-ref <ref>
cd ../calculate-settlements
supabase functions deploy calculate-settlements --project-ref <ref>

# Deploy frontend with Vercel CLI
vercel login
vercel --prod
```
