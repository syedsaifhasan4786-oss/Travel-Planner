import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isMockMode = !supabaseUrl || !supabaseAnonKey;

let realClient = null;

if (!isMockMode) {
  realClient = createClient(supabaseUrl, supabaseAnonKey);
}

// In-memory auth listeners list
const authListeners = new Set();

// Mock Auth Class
class MockAuth {
  signUp({ email, password, options }) {
    const userId = `usr-${Date.now()}`;
    const name = options?.data?.name || email.split('@')[0];
    const session = {
      access_token: email, // use email as mock token
      user: { id: userId, email, raw_user_meta_data: { name } }
    };
    
    // Save to localStorage
    localStorage.setItem('tripboard_session', JSON.stringify(session));
    this._triggerStateChange('SIGNED_IN', session);

    return Promise.resolve({ data: { user: session.user, session }, error: null });
  }

  resetPasswordForEmail(email, options) {
    return Promise.resolve({ data: {}, error: null });
  }

  updateUser({ password }) {
    const sessionStr = localStorage.getItem('tripboard_session');
    if (!sessionStr) return Promise.resolve({ data: { user: null }, error: null });

    try {
      const session = JSON.parse(sessionStr);
      return Promise.resolve({ data: { user: session.user }, error: null });
    } catch (e) {
      return Promise.resolve({ data: { user: null }, error: null });
    }
  }

  signInWithPassword({ email, password }) {
    const session = {
      access_token: email, // use email as mock token
      user: { 
        id: `usr-${email.split('@')[0]}`, 
        email, 
        raw_user_meta_data: { name: email.split('@')[0] } 
      }
    };

    localStorage.setItem('tripboard_session', JSON.stringify(session));
    this._triggerStateChange('SIGNED_IN', session);

    return Promise.resolve({ data: { user: session.user, session }, error: null });
  }

  signInWithOAuth({ provider }) {
    // Mock Google sign in
    const email = 'google_user@example.com';
    return this.signUp({ 
      email, 
      password: 'oauth', 
      options: { data: { name: 'Google Explorer' } } 
    });
  }

  signOut() {
    localStorage.removeItem('tripboard_session');
    this._triggerStateChange('SIGNED_OUT', null);
    return Promise.resolve({ error: null });
  }

  getSession() {
    const sessionStr = localStorage.getItem('tripboard_session');
    if (!sessionStr) return Promise.resolve({ data: { session: null }, error: null });
    
    try {
      const session = JSON.parse(sessionStr);
      return Promise.resolve({ data: { session }, error: null });
    } catch (e) {
      return Promise.resolve({ data: { session: null }, error: null });
    }
  }

  onAuthStateChange(callback) {
    authListeners.add(callback);
    // Trigger initial state
    this.getSession().then(({ data: { session } }) => {
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authListeners.delete(callback);
          }
        }
      }
    };
  }

  _triggerStateChange(event, session) {
    authListeners.forEach(callback => callback(event, session));
  }
}

// Mock Realtime Channel Class using BroadcastChannel
class MockChannel {
  constructor(name) {
    this.name = name;
    this.callbacks = [];
    this.bc = new BroadcastChannel(`realtime-${name}`);
    this.bc.onmessage = (event) => {
      const { payload } = event.data;
      this.callbacks.forEach(cb => cb(payload));
    };
  }

  on(type, filter, callback) {
    // Mimic supabase channel.on('postgres_changes', ...)
    this.callbacks.push(callback);
    return this;
  }

  subscribe(callback) {
    if (callback) callback('SUBSCRIBED');
    return this;
  }

  unsubscribe() {
    this.bc.close();
  }

  send(payload) {
    // Broadcast message to other tabs/windows
    this.bc.postMessage({ payload });
  }
}

// Expose Client
export const supabase = !isMockMode ? realClient : {
  auth: new MockAuth(),
  channel: (name) => new MockChannel(name)
};

// Global Fetch helper — kept for mock mode fallback compatibility
export async function fetchWithAuth(endpoint, options = {}) {
  let token = 'mock-user-id';
  
  if (!isMockMode) {
    const { data: { session } } = await realClient.auth.getSession();
    if (session) token = session.access_token;
  } else {
    const sessionStr = localStorage.getItem('tripboard_session');
    if (sessionStr) {
      try { token = JSON.parse(sessionStr).access_token; } catch (e) {}
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  const API_URL = 'http://localhost:3000';
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────────────────
// Direct Supabase API — no Express backend needed
// ─────────────────────────────────────────────────────────

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function getClient() {
  if (isMockMode) return null;
  return realClient;
}

// TRIPS
export const tripsApi = {
  async list() {
    if (isMockMode) return fetchWithAuth('/api/trips');
    const db = await getClient();
    const { data: { user } } = await db.auth.getUser();
    const { data, error } = await db
      .from('trip_members')
      .select('trip:trips(*, trip_members(id, role, user_id))')
      .eq('user_id', user.id);
    if (error) throw error;
    return (data || []).map(r => r.trip);
  },

  async get(tripId) {
    if (isMockMode) return fetchWithAuth(`/api/trips/${tripId}`);
    const db = await getClient();
    const { data: trip, error: tripErr } = await db
      .from('trips').select('*').eq('id', tripId).single();
    if (tripErr) throw tripErr;
    const { data: members } = await db
      .from('trip_members').select('id, role, user_id').eq('trip_id', tripId);
    const { data: itinerary } = await db
      .from('itinerary_items').select('*').eq('trip_id', tripId).order('position_index');
    return { ...trip, members: members || [], itinerary: itinerary || [] };
  },

  async create(payload) {
    if (isMockMode) return fetchWithAuth('/api/trips', { method: 'POST', body: JSON.stringify(payload) });
    const db = await getClient();
    const { data: { user } } = await db.auth.getUser();
    const { data: trip, error } = await db
      .from('trips')
      .insert({ ...payload, invite_code: generateInviteCode() })
      .select().single();
    if (error) throw error;
    await db.from('trip_members').insert({ trip_id: trip.id, user_id: user.id, role: 'owner' });
    return trip;
  },

  async join(invite_code) {
    if (isMockMode) return fetchWithAuth('/api/trips/join', { method: 'POST', body: JSON.stringify({ invite_code }) });
    const db = await getClient();
    const { data: { user } } = await db.auth.getUser();
    const { data: trip, error } = await db
      .from('trips').select('*').eq('invite_code', invite_code).single();
    if (error || !trip) throw new Error('Invalid invite code');
    const { error: joinErr } = await db
      .from('trip_members').insert({ trip_id: trip.id, user_id: user.id, role: 'member' });
    if (joinErr && !joinErr.message.includes('duplicate')) throw joinErr;
    return { trip_id: trip.id };
  }
};

// ITINERARY
export const itineraryApi = {
  async add(tripId, payload) {
    if (isMockMode) return fetchWithAuth(`/api/trips/${tripId}/itinerary`, { method: 'POST', body: JSON.stringify(payload) });
    const db = await getClient();
    const { data, error } = await db
      .from('itinerary_items').insert({ ...payload, trip_id: tripId }).select().single();
    if (error) throw error;
    return data;
  },

  async update(itemId, payload) {
    if (isMockMode) return fetchWithAuth(`/api/itinerary/${itemId}`, { method: 'PUT', body: JSON.stringify(payload) });
    const db = await getClient();
    const { error } = await db.from('itinerary_items').update(payload).eq('id', itemId);
    if (error) throw error;
  },

  async remove(itemId) {
    if (isMockMode) return fetchWithAuth(`/api/itinerary/${itemId}`, { method: 'DELETE' });
    const db = await getClient();
    const { error } = await db.from('itinerary_items').delete().eq('id', itemId);
    if (error) throw error;
  }
};

// EXPENSES
export const expensesApi = {
  async list(tripId) {
    if (isMockMode) return fetchWithAuth(`/api/trips/${tripId}/expenses`);
    const db = await getClient();
    const { data, error } = await db
      .from('expenses').select('*, expense_splits(*)').eq('trip_id', tripId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async add(tripId, payload) {
    if (isMockMode) return fetchWithAuth(`/api/trips/${tripId}/expenses`, { method: 'POST', body: JSON.stringify(payload) });
    const db = await getClient();
    const { split_among, ...expensePayload } = payload;
    const { data: expense, error } = await db
      .from('expenses').insert({ ...expensePayload, trip_id: tripId }).select().single();
    if (error) throw error;
    if (split_among?.length) {
      const perPerson = expense.amount / split_among.length;
      const splits = split_among.map(uid => ({ expense_id: expense.id, user_id: uid, amount: perPerson }));
      await db.from('expense_splits').insert(splits);
    }
    return expense;
  },

  async remove(expenseId) {
    if (isMockMode) return fetchWithAuth(`/api/expenses/${expenseId}`, { method: 'DELETE' });
    const db = await getClient();
    const { error } = await db.from('expenses').delete().eq('id', expenseId);
    if (error) throw error;
  },

  async settlements(tripId) {
    if (isMockMode) return fetchWithAuth(`/api/trips/${tripId}/settlements`);
    const db = await getClient();
    const { data, error } = await db.functions.invoke('calculate-settlements', { body: { trip_id: tripId } });
    if (error) throw error;
    return data;
  }
};

// BUDGET SUGGEST
export const budgetApi = {
  async suggest(payload) {
    if (isMockMode) return fetchWithAuth('/api/budget-suggest', { method: 'POST', body: JSON.stringify(payload) });
    const db = await getClient();
    const { data, error } = await db.functions.invoke('suggest-budget-trip', { body: payload });
    if (error) throw error;
    return data;
  }
};
