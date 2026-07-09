import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isMockMode = !supabaseUrl || !supabaseAnonKey;
export const API_URL = 'http://localhost:3000';

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

// Global Fetch helper that appends JWT authentication headers
export async function fetchWithAuth(endpoint, options = {}) {
  let token = 'mock-user-id';
  
  if (!isMockMode) {
    const { data: { session } } = await realClient.auth.getSession();
    if (session) {
      token = session.access_token;
    }
  } else {
    const sessionStr = localStorage.getItem('tripboard_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        token = session.access_token;
      } catch (e) {}
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}
