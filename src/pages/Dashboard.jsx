import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchWithAuth } from '../lib/supabaseClient';
import { 
  Compass, 
  Plus, 
  Link as LinkIcon, 
  CalendarDays, 
  MapPin, 
  Users2, 
  LogOut, 
  X, 
  ArrowRight 
} from 'lucide-react';

export default function Dashboard({ session }) {
  const navigate = useNavigate();
  const user = session.user;

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form states
  const [newTrip, setNewTrip] = useState({ title: '', destination: '', start_date: '', end_date: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth('/api/trips');
      setTrips(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load trips. Make sure your backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const created = await fetchWithAuth('/api/trips', {
        method: 'POST',
        body: JSON.stringify(newTrip)
      });
      setShowCreateModal(false);
      setNewTrip({ title: '', destination: '', start_date: '', end_date: '' });
      fetchTrips(); // Refresh
      navigate(`/app/trip/${created.id}`); // Route directly to new trip
    } catch (err) {
      alert(err.message || 'Failed to create trip');
    } finally {
      setModalLoading(false);
    }
  };

  const handleJoinTrip = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const result = await fetchWithAuth('/api/trips/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode })
      });
      setShowJoinModal(false);
      setInviteCode('');
      navigate(`/app/trip/${result.trip_id}`); // Navigate directly to joined trip
    } catch (err) {
      alert(err.message || 'Failed to join trip. Please verify the code.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const getUserInitials = (userObj) => {
    if (userObj.name) return userObj.name.substring(0, 2).toUpperCase();
    if (userObj.email) return userObj.email.substring(0, 2).toUpperCase();
    return '??';
  };

  return (
    <div className="dashboard-saas-container">
      {/* Sidebar */}
      <aside className="sidebar-saas">
        <div className="sidebar-logo">
          <div className="logo-icon-saas">
            <Compass size={20} />
          </div>
          <span className="logo-text-saas" style={{ fontSize: '20px' }}>TripBoard</span>
        </div>

        <ul className="sidebar-menu-saas">
          <li className="sidebar-item-saas active">
            <a href="#" onClick={(e) => e.preventDefault()}>
              <Users2 size={18} /> Trips
            </a>
          </li>
        </ul>

        <div className="sidebar-footer-saas">
          <div className="avatar-saas">
            {getUserInitials(user)}
          </div>
          <div className="user-info-saas">
            <span className="user-name-saas">{user.raw_user_meta_data?.name || user.email.split('@')[0]}</span>
            <span className="user-email-saas">{user.email}</span>
          </div>
          <button 
            className="btn btn-sm btn-text" 
            onClick={handleSignOut} 
            title="Sign Out"
            style={{ marginLeft: 'auto', padding: '6px' }}
          >
            <LogOut size={16} style={{ color: 'var(--sb-text-muted)' }} />
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content-saas">
        <div className="dashboard-header-saas">
          <div className="dashboard-title-group">
            <h1 className="dashboard-title-saas">My Trips</h1>
            <p className="auth-subtitle-saas" style={{ textAlign: 'left' }}>
              Create or join trip boards to map routes and coordinate itineraries with friends.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn-saas btn-outline-saas"
              onClick={() => setShowJoinModal(true)}
            >
              <LinkIcon size={16} style={{ marginRight: '8px' }} /> Join Trip
            </button>
            <button 
              className="btn-saas btn-primary-saas"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} style={{ marginRight: '8px' }} /> Create Trip
            </button>
          </div>
        </div>

        {errorMsg && <div className="auth-error-alert">{errorMsg}</div>}

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--sb-text-muted)' }}>
            Loading your boards...
          </div>
        ) : trips.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 40px', 
            backgroundColor: 'var(--sb-bg-white)', 
            borderRadius: '20px', 
            border: '1px dashed var(--sb-border)',
            color: 'var(--sb-text-muted)'
          }}>
            <h3 style={{ fontSize: '20px', color: 'var(--sb-text)', marginBottom: '8px' }}>No trips planned yet</h3>
            <p style={{ marginBottom: '24px' }}>Create a trip board and invite your friends to start co-planning!</p>
            <button className="btn-saas btn-primary-saas" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} style={{ marginRight: '8px' }} /> Create Your First Trip
            </button>
          </div>
        ) : (
          <div className="trips-grid-saas">
            {trips.map(trip => (
              <div 
                key={trip.id} 
                className="trip-card-saas"
                onClick={() => navigate(`/app/trip/${trip.id}`)}
              >
                <div 
                  className="trip-card-cover-saas" 
                  style={{ background: trip.cover_photo }}
                >
                  <span className="trip-card-badge-saas">Active</span>
                </div>
                <div className="trip-card-body-saas">
                  <h3 className="trip-card-title-saas">{trip.title}</h3>
                  <div className="trip-card-dest-saas">
                    <MapPin size={15} style={{ color: 'var(--sb-teal)' }} />
                    <span>{trip.destination}</span>
                  </div>
                  
                  <div className="trip-card-meta-saas">
                    <div className="trip-card-dates-saas">
                      <CalendarDays size={14} style={{ color: 'var(--sb-text-muted)' }} />
                      <span>{trip.start_date}</span>
                    </div>
                    <div className="collaborators-saas">
                      {trip.members?.map((member, i) => (
                        <div 
                          key={member.id} 
                          className="collaborator-avatar-saas"
                          title={member.name || member.email}
                          style={{ zIndex: 10 - i }}
                        >
                          {getUserInitials(member)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE TRIP MODAL */}
      {showCreateModal && (
        <div className="modal-overlay-saas">
          <div className="modal-card-saas">
            <div className="modal-header-saas">
              <h3 className="modal-title-saas">Create a Trip Board</h3>
              <button className="modal-close-btn-saas" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTrip} style={{ display: 'flex', flexStack: 'column', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group-saas">
                <label className="form-label-saas" htmlFor="trip-title">Trip Title</label>
                <input
                  type="text"
                  id="trip-title"
                  className="form-input-saas"
                  placeholder="Graduation Trip, European Getaway..."
                  value={newTrip.title}
                  onChange={(e) => setNewTrip({ ...newTrip, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group-saas">
                <label className="form-label-saas" htmlFor="trip-dest">Destination</label>
                <input
                  type="text"
                  id="trip-dest"
                  className="form-input-saas"
                  placeholder="Paris, France; Maui, Hawaii..."
                  value={newTrip.destination}
                  onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group-saas" style={{ flex: 1 }}>
                  <label className="form-label-saas" htmlFor="trip-start">Start Date</label>
                  <input
                    type="date"
                    id="trip-start"
                    className="form-input-saas"
                    value={newTrip.start_date}
                    onChange={(e) => setNewTrip({ ...newTrip, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group-saas" style={{ flex: 1 }}>
                  <label className="form-label-saas" htmlFor="trip-end">End Date</label>
                  <input
                    type="date"
                    id="trip-end"
                    className="form-input-saas"
                    value={newTrip.end_date}
                    onChange={(e) => setNewTrip({ ...newTrip, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-saas btn-primary-saas"
                disabled={modalLoading}
                style={{ marginTop: '10px' }}
              >
                {modalLoading ? 'Creating...' : 'Create Trip'}
                {!modalLoading && <ArrowRight size={16} style={{ marginLeft: '8px' }} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* JOIN TRIP MODAL */}
      {showJoinModal && (
        <div className="modal-overlay-saas">
          <div className="modal-card-saas">
            <div className="modal-header-saas">
              <h3 className="modal-title-saas">Join a Trip Board</h3>
              <button className="modal-close-btn-saas" onClick={() => setShowJoinModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleJoinTrip} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group-saas">
                <label className="form-label-saas" htmlFor="invite-code">Invite Code</label>
                <input
                  type="text"
                  id="invite-code"
                  className="form-input-saas"
                  placeholder="Enter the 8-character invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-saas btn-primary-saas"
                disabled={modalLoading}
                style={{ marginTop: '10px' }}
              >
                {modalLoading ? 'Joining...' : 'Join Trip'}
                {!modalLoading && <ArrowRight size={16} style={{ marginLeft: '8px' }} />}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
