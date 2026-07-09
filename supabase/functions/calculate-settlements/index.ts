// Supabase Edge Function: calculate-settlements
// Reads all expenses + splits for a trip from the DB,
// computes each member's net balance, then runs a greedy debt-simplification
// algorithm to produce the minimal set of who-owes-whom payments.
//
// Deploy: supabase functions deploy calculate-settlements

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Balance {
  user_id: string;
  name: string;
  email: string;
  total_paid: number;
  total_owed: number;
  net: number; // positive = others owe them; negative = they owe others
}

interface Settlement {
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  amount: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { trip_id } = await req.json();

    if (!trip_id) {
      return new Response(JSON.stringify({ error: 'trip_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // Use the service-role key so RLS is bypassed (Edge Functions run server-side)
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch trip members with user info
    const { data: members, error: memErr } = await supabase
      .from('trip_members')
      .select('user_id, users ( id, name, email )')
      .eq('trip_id', trip_id);

    if (memErr) throw new Error(`Fetching members failed: ${memErr.message}`);
    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ balances: [], settlements: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch all expenses for this trip
    const { data: expenses, error: expErr } = await supabase
      .from('expenses')
      .select(`
        id, paid_by, amount,
        expense_splits ( user_id, share_amount )
      `)
      .eq('trip_id', trip_id);

    if (expErr) throw new Error(`Fetching expenses failed: ${expErr.message}`);

    // 3. Build maps: paid[uid] and owed[uid]
    const paidMap: Record<string, number> = {};
    const owedMap: Record<string, number> = {};
    const userInfo: Record<string, { name: string; email: string }> = {};

    for (const m of members) {
      const uid = m.user_id as string;
      paidMap[uid] = 0;
      owedMap[uid] = 0;
      const u = m.users as { id: string; name: string; email: string } | null;
      if (u) {
        userInfo[uid] = { name: u.name || u.email, email: u.email };
      }
    }

    for (const exp of (expenses ?? [])) {
      const payerId = exp.paid_by as string;
      paidMap[payerId] = (paidMap[payerId] ?? 0) + Number(exp.amount);

      for (const split of (exp.expense_splits as { user_id: string; share_amount: number }[])) {
        owedMap[split.user_id] = (owedMap[split.user_id] ?? 0) + Number(split.share_amount);
      }
    }

    // 4. Compute net balances
    const balances: Balance[] = Object.keys(paidMap).map((uid) => {
      const paid = paidMap[uid] ?? 0;
      const owed = owedMap[uid] ?? 0;
      return {
        user_id: uid,
        name: userInfo[uid]?.name ?? uid,
        email: userInfo[uid]?.email ?? '',
        total_paid: round2(paid),
        total_owed: round2(owed),
        net: round2(paid - owed),
      };
    });

    // 5. Debt-simplification greedy algorithm
    //    creditors: net > 0 (are owed money)
    //    debtors:   net < 0 (owe money)
    const creditors = balances
      .filter((b) => b.net > 0.005)
      .map((b) => ({ ...b, remaining: b.net }))
      .sort((a, b) => b.remaining - a.remaining);

    const debtors = balances
      .filter((b) => b.net < -0.005)
      .map((b) => ({ ...b, remaining: -b.net }))
      .sort((a, b) => b.remaining - a.remaining);

    const settlements: Settlement[] = [];
    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const credit = creditors[ci];
      const debt = debtors[di];
      const transfer = Math.min(credit.remaining, debt.remaining);

      settlements.push({
        from_user_id: debt.user_id,
        from_name: debt.name,
        to_user_id: credit.user_id,
        to_name: credit.name,
        amount: round2(transfer),
      });

      credit.remaining = round2(credit.remaining - transfer);
      debt.remaining = round2(debt.remaining - transfer);

      if (credit.remaining < 0.005) ci++;
      if (debt.remaining < 0.005) di++;
    }

    return new Response(JSON.stringify({ balances, settlements }), {
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
