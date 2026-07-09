import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Resolve environment variables (checks both server and vite formats)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

const isMockMode = !supabaseUrl || !supabaseKey;

let supabase = null;
if (!isMockMode) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('⚡ Connected to Supabase at:', supabaseUrl);
} else {
  console.log('⚠️ Running in local MOCK DATABASE mode. Data will persist in-memory.');
}

// In-memory data store for Mock Mode
const mockDB = {
  expenses: [],
  expenseSplits: [],
  users: [
    { id: 'usr-1', email: 'john@example.com', name: 'John Doe', avatar_url: '' },
    { id: 'usr-2', email: 'jane@example.com', name: 'Jane Smith', avatar_url: '' }
  ],
  trips: [
    {
      id: 'trip-1',
      title: 'Summer Kyoto Exploration',
      destination: 'Kyoto, Japan',
      start_date: '2026-08-14',
      end_date: '2026-08-22',
      cover_photo: 'linear-gradient(135deg, rgba(99, 102, 241, 0.45) 0%, rgba(139, 92, 246, 0.45) 100%)',
      invite_code: 'kyoto26'
    }
  ],
  tripMembers: [
    { id: 'mem-1', trip_id: 'trip-1', user_id: 'usr-1', role: 'owner' },
    { id: 'mem-2', trip_id: 'trip-1', user_id: 'usr-2', role: 'collaborator' }
  ],
  itineraryItems: [
    {
      id: 'item-1',
      trip_id: 'trip-1',
      title: 'Arrival at Kansai Airport',
      time: '10:30 AM',
      notes: 'Take Haruka Express train to Kyoto Station.',
      category: 'flight',
      date: '2026-08-14',
      lat: 34.437,
      lng: 135.244,
      position_index: 0
    },
    {
      id: 'item-2',
      trip_id: 'trip-1',
      title: 'Check-in at Ryokan',
      time: '03:00 PM',
      notes: 'Cozy traditional lodging.',
      category: 'lodging',
      date: '2026-08-14',
      lat: 35.011,
      lng: 135.768,
      position_index: 1
    },
    {
      id: 'item-3',
      trip_id: 'trip-1',
      title: 'Dinner in Gion',
      time: '07:00 PM',
      notes: 'Look for traditional noodle shops.',
      category: 'food',
      date: '2026-08-14',
      lat: 35.003,
      lng: 135.778,
      position_index: 2
    }
  ]
};

// Middleware: Authenticate User
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];

  if (isMockMode) {
    // In mock mode, the token is simply the user_id or email
    const user = mockDB.users.find(u => u.id === token || u.email === token);
    if (!user) {
      // If user doesn't exist, create a mock user record dynamically
      const newUser = { id: token, email: token.includes('@') ? token : `${token}@example.com`, name: token.split('@')[0], avatar_url: '' };
      mockDB.users.push(newUser);
      req.user = newUser;
    } else {
      req.user = user;
    }
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// ----------------------------------------
// API ENDPOINTS
// ----------------------------------------

// Auth helper
app.post('/api/auth/register-profile', authenticateUser, async (req, res) => {
  const user = req.user;
  const { name } = req.body;

  if (isMockMode) {
    const dbUser = mockDB.users.find(u => u.id === user.id);
    if (dbUser) dbUser.name = name || dbUser.name;
    return res.json({ success: true, user: dbUser || user });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({ id: user.id, email: user.email, name: name || user.email.split('@')[0] })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all trips the user belongs to
app.get('/api/trips', authenticateUser, async (req, res) => {
  const user = req.user;

  if (isMockMode) {
    const userTripIds = mockDB.tripMembers
      .filter(m => m.user_id === user.id)
      .map(m => m.trip_id);

    const userTrips = mockDB.trips.filter(t => userTripIds.includes(t.id));

    // Append members info to each trip
    const tripsWithMembers = userTrips.map(t => {
      const memberUserIds = mockDB.tripMembers
        .filter(m => m.trip_id === t.id)
        .map(m => m.user_id);
      const members = mockDB.users.filter(u => memberUserIds.includes(u.id));
      return { ...t, members };
    });

    return res.json(tripsWithMembers);
  }

  try {
    // 1. Fetch trip IDs the user is part of
    const { data: membershipData, error: memError } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', user.id);

    if (memError) throw memError;
    const tripIds = membershipData.map(m => m.trip_id);

    if (tripIds.length === 0) {
      return res.json([]);
    }

    // 2. Fetch the actual trips and join details
    const { data: tripsData, error: tripError } = await supabase
      .from('trips')
      .select(`
        *,
        trip_members (
          user_id,
          role,
          users ( id, email, name, avatar_url )
        )
      `)
      .in('id', tripIds);

    if (tripError) throw tripError;

    // Reshape data to match expected frontend schema
    const formattedTrips = tripsData.map(t => {
      const members = t.trip_members.map(m => ({
        id: m.users.id,
        email: m.users.email,
        name: m.users.name,
        avatar_url: m.users.avatar_url,
        role: m.role
      }));
      const { trip_members, ...tripDetails } = t;
      return { ...tripDetails, members };
    });

    res.json(formattedTrips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single trip details with itinerary items
app.get('/api/trips/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  if (isMockMode) {
    const isMember = mockDB.tripMembers.some(m => m.trip_id === id && m.user_id === user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Access Denied: You are not a member of this trip' });
    }

    const trip = mockDB.trips.find(t => t.id === id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const memberUserIds = mockDB.tripMembers.filter(m => m.trip_id === id).map(m => m.user_id);
    const members = mockDB.users.filter(u => memberUserIds.includes(u.id));

    const itinerary = mockDB.itineraryItems
      .filter(item => item.trip_id === id)
      .sort((a, b) => a.position_index - b.position_index);

    return res.json({ ...trip, members, itinerary });
  }

  try {
    // 1. Check membership
    const { data: member, error: checkErr } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (!member) {
      return res.status(403).json({ error: 'Access Denied' });
    }

    // 2. Fetch trip with members and itinerary items
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select(`
        *,
        trip_members (
          role,
          users ( id, email, name, avatar_url )
        )
      `)
      .eq('id', id)
      .single();

    if (tripErr) throw tripErr;

    const { data: itinerary, error: itinErr } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('trip_id', id)
      .order('position_index', { ascending: true });

    if (itinErr) throw itinErr;

    const formattedTrip = {
      ...trip,
      members: trip.trip_members.map(m => ({
        id: m.users.id,
        email: m.users.email,
        name: m.users.name,
        avatar_url: m.users.avatar_url,
        role: m.role
      })),
      itinerary
    };
    delete formattedTrip.trip_members;

    res.json(formattedTrip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new trip
app.post('/api/trips', authenticateUser, async (req, res) => {
  const { title, destination, start_date, end_date } = req.body;
  const user = req.user;

  const randomGradients = [
    'linear-gradient(135deg, rgba(99, 102, 241, 0.45) 0%, rgba(139, 92, 246, 0.45) 100%)',
    'linear-gradient(135deg, rgba(6, 182, 212, 0.45) 0%, rgba(59, 130, 246, 0.45) 100%)',
    'linear-gradient(135deg, rgba(244, 63, 94, 0.45) 0%, rgba(249, 115, 22, 0.45) 100%)',
    'linear-gradient(135deg, rgba(16, 185, 129, 0.45) 0%, rgba(99, 102, 241, 0.45) 100%)'
  ];
  const cover_photo = randomGradients[Math.floor(Math.random() * randomGradients.length)];
  const invite_code = Math.random().toString(36).substring(2, 10);

  if (isMockMode) {
    const newTrip = {
      id: `trip-${Date.now()}`,
      title,
      destination,
      start_date,
      end_date,
      cover_photo,
      invite_code
    };
    mockDB.trips.push(newTrip);

    const newMember = {
      id: `mem-${Date.now()}`,
      trip_id: newTrip.id,
      user_id: user.id,
      role: 'owner'
    };
    mockDB.tripMembers.push(newMember);

    return res.json({ ...newTrip, members: [user], itinerary: [] });
  }

  try {
    // 1. Insert Trip
    const { data: tripData, error: tripErr } = await supabase
      .from('trips')
      .insert({ title, destination, start_date, end_date, cover_photo, invite_code })
      .select()
      .single();

    if (tripErr) throw tripErr;

    // 2. Insert Owner Member
    const { error: memErr } = await supabase
      .from('trip_members')
      .insert({ trip_id: tripData.id, user_id: user.id, role: 'owner' });

    if (memErr) throw memErr;

    res.json({ ...tripData, members: [{ ...user, role: 'owner' }], itinerary: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST join a trip using invite code
app.post('/api/trips/join', authenticateUser, async (req, res) => {
  const { invite_code } = req.body;
  const user = req.user;

  if (isMockMode) {
    const trip = mockDB.trips.find(t => t.invite_code.toLowerCase() === invite_code.trim().toLowerCase());
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found with this invite code' });
    }

    const alreadyMember = mockDB.tripMembers.some(m => m.trip_id === trip.id && m.user_id === user.id);
    if (alreadyMember) {
      return res.json({ success: true, trip_id: trip.id, message: 'Already a member' });
    }

    mockDB.tripMembers.push({
      id: `mem-${Date.now()}`,
      trip_id: trip.id,
      user_id: user.id,
      role: 'collaborator'
    });

    return res.json({ success: true, trip_id: trip.id, message: 'Joined trip successfully' });
  }

  try {
    // 1. Find trip
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('id')
      .eq('invite_code', invite_code.trim())
      .maybeSingle();

    if (tripErr) throw tripErr;
    if (!trip) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // 2. Insert member (role: collaborator)
    const { error: memErr } = await supabase
      .from('trip_members')
      .upsert({ trip_id: trip.id, user_id: user.id, role: 'collaborator' });

    if (memErr) throw memErr;

    res.json({ success: true, trip_id: trip.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add itinerary item
app.post('/api/trips/:tripId/itinerary', authenticateUser, async (req, res) => {
  const { tripId } = req.params;
  const { title, time, notes, category, date, lat, lng, position_index } = req.body;
  const user = req.user;

  if (isMockMode) {
    const isMember = mockDB.tripMembers.some(m => m.trip_id === tripId && m.user_id === user.id);
    if (!isMember) return res.status(403).json({ error: 'Access Denied' });

    const newItem = {
      id: `item-${Date.now()}`,
      trip_id: tripId,
      title,
      time,
      notes,
      category,
      date,
      lat: Number(lat),
      lng: Number(lng),
      position_index: Number(position_index)
    };
    mockDB.itineraryItems.push(newItem);

    return res.json(newItem);
  }

  try {
    const { data, error } = await supabase
      .from('itinerary_items')
      .insert({
        trip_id: tripId,
        title,
        time,
        notes,
        category,
        date,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        position_index: Number(position_index)
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update / reorder itinerary item
app.put('/api/itinerary/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const user = req.user;

  if (isMockMode) {
    const item = mockDB.itineraryItems.find(i => i.id === id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const isMember = mockDB.tripMembers.some(m => m.trip_id === item.trip_id && m.user_id === user.id);
    if (!isMember) return res.status(403).json({ error: 'Access Denied' });

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'trip_id') {
        item[key] = updates[key];
      }
    });

    return res.json(item);
  }

  try {
    const { data, error } = await supabase
      .from('itinerary_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE itinerary item
app.delete('/api/itinerary/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  if (isMockMode) {
    const itemIdx = mockDB.itineraryItems.findIndex(i => i.id === id);
    if (itemIdx === -1) return res.status(404).json({ error: 'Item not found' });

    const item = mockDB.itineraryItems[itemIdx];
    const isMember = mockDB.tripMembers.some(m => m.trip_id === item.trip_id && m.user_id === user.id);
    if (!isMember) return res.status(403).json({ error: 'Access Denied' });

    mockDB.itineraryItems.splice(itemIdx, 1);
    return res.json({ success: true });
  }

  try {
    const { error } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------
// BUDGET SUGGESTION
// ----------------------------------------

// POST suggest a budget trip (proxies to Gemini via Supabase Edge Function or mock)
app.post('/api/budget-suggest', authenticateUser, async (req, res) => {
  const { destination, budget_inr, days } = req.body;

  if (!destination || budget_inr == null || days == null) {
    return res.status(400).json({ error: 'destination, budget_inr, and days are required' });
  }

  if (isMockMode) {
    // Return realistic mock data so the UI works without a Gemini key
    const perDay = Math.floor(budget_inr / days);
    const mockDays = Array.from({ length: Number(days) }, (_, i) => ({
      day: i + 1,
      travel: i === 0 ? Math.round(perDay * 0.35) : Math.round(perDay * 0.1),
      accommodation: Math.round(perDay * 0.3),
      food: Math.round(perDay * 0.2),
      activities: Math.round(perDay * 0.15),
      notes: i === 0
        ? `Arrive in ${destination}. Airport transfer, check-in, and light exploration.`
        : `Day ${i + 1} in ${destination}. Local sightseeing, food, and cultural activities.`
    }));
    const total = mockDays.reduce((s, d) => s + d.travel + d.accommodation + d.food + d.activities, 0);
    return res.json({
      summary: `A ${days}-day budget trip to ${destination} for ₹${budget_inr}. Covers travel, accommodation, food, and activities.`,
      total_estimated_cost: total,
      currency: 'INR',
      days: mockDays
    });
  }

  try {
    // Invoke the Supabase Edge Function server-side
    const { data, error } = await supabase.functions.invoke('suggest-budget-trip', {
      body: { destination, budget_inr: Number(budget_inr), days: Number(days) }
    });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------
// EXPENSES
// ----------------------------------------

// GET all expenses for a trip (with splits and payer info)
app.get('/api/trips/:tripId/expenses', authenticateUser, async (req, res) => {
  const { tripId } = req.params;
  const user = req.user;

  if (isMockMode) {
    const isMember = mockDB.tripMembers.some(m => m.trip_id === tripId && m.user_id === user.id);
    if (!isMember) return res.status(403).json({ error: 'Access Denied' });

    const expenses = mockDB.expenses
      .filter(e => e.trip_id === tripId)
      .map(e => ({
        ...e,
        payer: mockDB.users.find(u => u.id === e.paid_by) || { id: e.paid_by, name: e.paid_by, email: '' },
        splits: mockDB.expenseSplits
          .filter(s => s.expense_id === e.id)
          .map(s => ({
            ...s,
            user: mockDB.users.find(u => u.id === s.user_id) || { id: s.user_id, name: s.user_id, email: '' }
          }))
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json(expenses);
  }

  try {
    const { data: member } = await supabase
      .from('trip_members').select('id').eq('trip_id', tripId).eq('user_id', user.id).maybeSingle();
    if (!member) return res.status(403).json({ error: 'Access Denied' });

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select(`
        *,
        payer:users!expenses_paid_by_fkey ( id, name, email ),
        splits:expense_splits ( id, user_id, share_amount, user:users ( id, name, email ) )
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add an expense with equal splits among selected members
app.post('/api/trips/:tripId/expenses', authenticateUser, async (req, res) => {
  const { tripId } = req.params;
  const { amount, description, paid_by, split_among } = req.body;
  const user = req.user;

  // split_among: array of user_ids to split the expense between
  if (!amount || !description || !paid_by || !Array.isArray(split_among) || split_among.length === 0) {
    return res.status(400).json({ error: 'amount, description, paid_by, and split_among[] are required' });
  }

  const shareAmount = Math.round((Number(amount) / split_among.length) * 100) / 100;

  if (isMockMode) {
    const isMember = mockDB.tripMembers.some(m => m.trip_id === tripId && m.user_id === user.id);
    if (!isMember) return res.status(403).json({ error: 'Access Denied' });

    const newExpense = {
      id: `exp-${Date.now()}`,
      trip_id: tripId,
      paid_by,
      amount: Number(amount),
      description,
      created_at: new Date().toISOString()
    };
    mockDB.expenses.push(newExpense);

    const newSplits = split_among.map(uid => ({
      id: `spl-${Date.now()}-${uid}`,
      expense_id: newExpense.id,
      user_id: uid,
      share_amount: shareAmount
    }));
    mockDB.expenseSplits.push(...newSplits);

    return res.json({
      ...newExpense,
      payer: mockDB.users.find(u => u.id === paid_by) || { id: paid_by, name: paid_by, email: '' },
      splits: newSplits.map(s => ({
        ...s,
        user: mockDB.users.find(u => u.id === s.user_id) || { id: s.user_id, name: s.user_id, email: '' }
      }))
    });
  }

  try {
    const { data: member } = await supabase
      .from('trip_members').select('id').eq('trip_id', tripId).eq('user_id', user.id).maybeSingle();
    if (!member) return res.status(403).json({ error: 'Access Denied' });

    const { data: expense, error: expErr } = await supabase
      .from('expenses')
      .insert({ trip_id: tripId, paid_by, amount: Number(amount), description })
      .select().single();
    if (expErr) throw expErr;

    const splitsToInsert = split_among.map(uid => ({
      expense_id: expense.id,
      user_id: uid,
      share_amount: shareAmount
    }));
    const { error: splitErr } = await supabase.from('expense_splits').insert(splitsToInsert);
    if (splitErr) throw splitErr;

    // Return the expense with nested payer + splits
    const { data: full, error: fullErr } = await supabase
      .from('expenses')
      .select(`
        *,
        payer:users!expenses_paid_by_fkey ( id, name, email ),
        splits:expense_splits ( id, user_id, share_amount, user:users ( id, name, email ) )
      `)
      .eq('id', expense.id)
      .single();
    if (fullErr) throw fullErr;
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE an expense (also cascades splits via FK)
app.delete('/api/expenses/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  if (isMockMode) {
    const expIdx = mockDB.expenses.findIndex(e => e.id === id);
    if (expIdx === -1) return res.status(404).json({ error: 'Expense not found' });
    const exp = mockDB.expenses[expIdx];
    const isMember = mockDB.tripMembers.some(m => m.trip_id === exp.trip_id && m.user_id === user.id);
    if (!isMember) return res.status(403).json({ error: 'Access Denied' });

    mockDB.expenses.splice(expIdx, 1);
    mockDB.expenseSplits = mockDB.expenseSplits.filter(s => s.expense_id !== id);
    return res.json({ success: true });
  }

  try {
    // Verify membership via trip_id lookup
    const { data: exp } = await supabase.from('expenses').select('trip_id').eq('id', id).maybeSingle();
    if (!exp) return res.status(404).json({ error: 'Expense not found' });
    const { data: member } = await supabase
      .from('trip_members').select('id').eq('trip_id', exp.trip_id).eq('user_id', user.id).maybeSingle();
    if (!member) return res.status(403).json({ error: 'Access Denied' });

    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST compute settlement payments for a trip
app.post('/api/trips/:tripId/settlements', authenticateUser, async (req, res) => {
  const { tripId } = req.params;
  const user = req.user;

  if (isMockMode) {
    const isMember = mockDB.tripMembers.some(m => m.trip_id === tripId && m.user_id === user.id);
    if (!isMember) return res.status(403).json({ error: 'Access Denied' });

    // Run debt-simplification in-process for mock mode
    const memberIds = mockDB.tripMembers.filter(m => m.trip_id === tripId).map(m => m.user_id);
    const paidMap = {};
    const owedMap = {};
    memberIds.forEach(uid => { paidMap[uid] = 0; owedMap[uid] = 0; });

    const tripExpenses = mockDB.expenses.filter(e => e.trip_id === tripId);
    for (const exp of tripExpenses) {
      paidMap[exp.paid_by] = (paidMap[exp.paid_by] || 0) + Number(exp.amount);
      const splits = mockDB.expenseSplits.filter(s => s.expense_id === exp.id);
      for (const s of splits) {
        owedMap[s.user_id] = (owedMap[s.user_id] || 0) + Number(s.share_amount);
      }
    }

    const round2 = n => Math.round(n * 100) / 100;
    const getName = uid => mockDB.users.find(u => u.id === uid)?.name || uid;

    const balances = memberIds.map(uid => ({
      user_id: uid,
      name: getName(uid),
      email: mockDB.users.find(u => u.id === uid)?.email || '',
      total_paid: round2(paidMap[uid] || 0),
      total_owed: round2(owedMap[uid] || 0),
      net: round2((paidMap[uid] || 0) - (owedMap[uid] || 0))
    }));

    const creditors = balances.filter(b => b.net > 0.005).map(b => ({ ...b, remaining: b.net })).sort((a, b) => b.remaining - a.remaining);
    const debtors = balances.filter(b => b.net < -0.005).map(b => ({ ...b, remaining: -b.net })).sort((a, b) => b.remaining - a.remaining);
    const settlements = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const credit = creditors[ci], debt = debtors[di];
      const transfer = round2(Math.min(credit.remaining, debt.remaining));
      settlements.push({ from_user_id: debt.user_id, from_name: debt.name, to_user_id: credit.user_id, to_name: credit.name, amount: transfer });
      credit.remaining = round2(credit.remaining - transfer);
      debt.remaining = round2(debt.remaining - transfer);
      if (credit.remaining < 0.005) ci++;
      if (debt.remaining < 0.005) di++;
    }

    return res.json({ balances, settlements });
  }

  try {
    const { data: member } = await supabase
      .from('trip_members').select('id').eq('trip_id', tripId).eq('user_id', user.id).maybeSingle();
    if (!member) return res.status(403).json({ error: 'Access Denied' });

    const { data, error } = await supabase.functions.invoke('calculate-settlements', {
      body: { trip_id: tripId }
    });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Express API Server running on port ${PORT}`);
});
