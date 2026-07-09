import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, isMockMode, tripsApi, itineraryApi } from '../lib/supabaseClient';
import L from 'leaflet';
import { 
  Compass, 
  X,
  MapPin, 
  CalendarDays, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Users2, 
  Edit,
  Clock,
  Notebook,
  Copy,
  Check,
  Sparkles,
  Receipt
} from 'lucide-react';
import BudgetSuggestModal from '../components/BudgetSuggestModal';
import ExpenseSplitter from './ExpenseSplitter';

// Fix for default marker icons in Leaflet + Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getDefaultCoordinates = (destination) => {
  const dest = destination.toLowerCase();
  if (dest.includes('kyoto')) return { lat: 35.0116, lng: 135.7681 };
  if (dest.includes('tokyo')) return { lat: 35.6762, lng: 139.6503 };
  if (dest.includes('paris')) return { lat: 48.8566, lng: 2.3522 };
  if (dest.includes('london')) return { lat: 51.5074, lng: -0.1278 };
  if (dest.includes('new york')) return { lat: 40.7128, lng: -74.0060 };
  if (dest.includes('rome')) return { lat: 41.9028, lng: 12.4964 };
  if (dest.includes('hawaii')) return { lat: 20.7984, lng: -156.3319 };
  if (dest.includes('delhi')) return { lat: 28.7041, lng: 77.1025 };
  if (dest.includes('lucknow')) return { lat: 26.8467, lng: 80.9462 };
  return { lat: 48.8566, lng: 2.3522 }; // Fallback to Paris
};

export default function TripPlanner() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [itinerary, setItinerary] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date selection
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  
  // Add stop modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStop, setNewStop] = useState({
    title: '',
    time: '12:00 PM',
    notes: '',
    category: 'activity'
  });
  
  // Invite states
  const [copied, setCopied] = useState(false);

  // Panel toggle: 'itinerary' | 'expenses'
  const [activePanel, setActivePanel] = useState('itinerary');

  // Budget suggestion modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  // Toggle map feature on/off (disabled for now)
  const MAP_ENABLED = false;

  // Current auth user id (for expense paid_by default)
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setCurrentUserId(session.user.id);
    });
    if (isMockMode) {
      // In mock mode, derive from localStorage session
      try {
        const s = JSON.parse(localStorage.getItem('tripboard_session') || '{}');
        if (s?.user?.id) setCurrentUserId(s.user.id);
      } catch (_) {}
    }
  }, []);

  // Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const polylineRef = useRef(null);

  // Helper to generate full dates list between start and end date
  const getDatesRange = (startDateStr, endDateStr) => {
    const datesList = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let current = new Date(start);
    while (current <= end) {
      datesList.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return datesList;
  };

  const fetchTripDetails = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await tripsApi.get(tripId);
      setTrip(data);
      setItinerary(data.itinerary || []);
      setMembers(data.members || []);
      const range = getDatesRange(data.start_date, data.end_date);
      setDates(range);
      if (!selectedDate && range.length > 0) setSelectedDate(range[0]);
    } catch (err) {
      console.error(err);
      alert('Error loading trip details.');
      navigate('/app');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Broadcast function for mock mode realtime updates
  const broadcastChange = () => {
    if (isMockMode) {
      const channel = supabase.channel(`trip-${tripId}`);
      channel.send({ event: 'ITINERARY_CHANGE' });
    }
  };

  useEffect(() => {
    fetchTripDetails();
  }, [tripId]);

  // Realtime subscription setup
  useEffect(() => {
    // Subscribe to changes on the itinerary_items table
    const channel = supabase.channel(`trip-${tripId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'itinerary_items'
      }, () => {
        // Refetch silently
        fetchTripDetails(false);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [tripId, selectedDate]);

  // Map Initializer
  useEffect(() => {
    if (!MAP_ENABLED) return;
    if (loading || !trip || !mapContainerRef.current) return;

    const defaultCoords = getDefaultCoordinates(trip.destination);

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView(
        [defaultCoords.lat, defaultCoords.lng],
        13
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);

      markersGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    return () => {
      // Don't destroy map on every selectedDate change, just update layers
    };
  }, [loading, trip]);

  // Map Markers and Polylines updater
  const dayItems = itinerary.filter(item => item.date === selectedDate);

  useEffect(() => {
    if (!MAP_ENABLED) return;
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    // Clear old elements
    markersGroupRef.current.clearLayers();
    if (polylineRef.current) {
      mapInstanceRef.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const latlngs = [];

    dayItems.forEach((item, index) => {
      if (item.lat && item.lng) {
        const latlng = [Number(item.lat), Number(item.lng)];
        latlngs.push(latlng);

        const customIcon = L.divIcon({
          html: `<div class="custom-map-marker-pin"><span>${index + 1}</span></div>`,
          className: 'custom-div-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -30]
        });

        const marker = L.marker(latlng, { icon: customIcon })
          .bindPopup(`
            <div class="leaflet-popup-content-saas">
              <h4>${item.title}</h4>
              <p><strong>${item.time}</strong></p>
              ${item.notes ? `<p>${item.notes}</p>` : ''}
            </div>
          `)
          .addTo(markersGroupRef.current);

        marker.on('click', () => {
          const el = document.getElementById(`activity-item-${item.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlighted-active');
            setTimeout(() => {
              el.classList.remove('highlighted-active');
            }, 2000);
          }
        });
      }
    });

    // Draw routing Polyline
    if (latlngs.length > 1) {
      polylineRef.current = L.polyline(latlngs, {
        color: 'var(--sb-teal)',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8'
      }).addTo(mapInstanceRef.current);
    }

    // Set bounds
    if (latlngs.length > 0) {
      mapInstanceRef.current.fitBounds(latlngs, { padding: [50, 50] });
    } else {
      const defaultCoords = getDefaultCoordinates(trip.destination);
      mapInstanceRef.current.setView([defaultCoords.lat, defaultCoords.lng], 13);
    }
  }, [selectedDate, itinerary, loading]);

  const handleAddStop = async (e) => {
    e.preventDefault();
    try {
      const coords = getDefaultCoordinates(trip.destination);
      const body = {
        title: newStop.title,
        time: newStop.time,
        notes: newStop.notes,
        category: newStop.category,
        lat: coords.lat,
        lng: coords.lng,
        date: selectedDate,
        position_index: dayItems.length
      };
      await itineraryApi.add(tripId, body);
      setShowAddModal(false);
      setNewStop({ title: '', time: '12:00 PM', notes: '', category: 'activity' });
      fetchTripDetails(false);
      broadcastChange();
    } catch (err) {
      alert(err.message || 'Failed to add stop');
    }
  };

  const handleDeleteStop = async (itemId) => {
    if (!confirm('Are you sure you want to delete this activity stop?')) return;
    try {
      await itineraryApi.remove(itemId);
      fetchTripDetails(false);
      broadcastChange();
    } catch (err) {
      alert(err.message || 'Failed to delete stop');
    }
  };

  // HTML5 Drag and Drop Reordering Handlers
  const handleDragStart = (e, itemId) => {
    e.dataTransfer.setData('text/plain', itemId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    const draggedItem = itinerary.find(item => item.id === itemId);
    
    if (!draggedItem) return;

    // Filter day's items excluding the dragged one (if it's from the same day)
    const otherDayItems = dayItems.filter(item => item.id !== itemId);
    
    // Insert item at target index
    otherDayItems.splice(targetIndex, 0, { ...draggedItem, date: selectedDate });

    // Build batch position update list
    const updates = otherDayItems.map((item, idx) => ({
      id: item.id,
      updates: { position_index: idx, date: selectedDate }
    }));

    try {
      // Perform updates sequentially
      for (const update of updates) {
        await itineraryApi.update(update.id, update.updates);
      }
      fetchTripDetails(false);
      broadcastChange();
    } catch (err) {
      console.error("Failed to reorder items:", err);
    }
  };

  const handleCopyInvite = () => {
    if (!trip) return;
    navigator.clipboard.writeText(trip.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const focusMapOnStop = (item) => {
    if (!MAP_ENABLED) return;
    if (mapInstanceRef.current && item.lat && item.lng) {
      mapInstanceRef.current.setView([item.lat, item.lng], 16, { animate: true });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf8f5' }}>
        <div style={{ color: '#0d9488', fontWeight: 600 }}>Loading trip itinerary...</div>
      </div>
    );
  }

  return (
    <div className="planner-saas-container">
      {/* Itinerary Timeline Section (60%) */}
      <section className="itinerary-panel-saas">
        <div className="itinerary-header-saas">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="activity-btn-action-saas" onClick={() => navigate('/app')}>
              <ArrowLeft size={18} />
            </button>
            <h1 style={{ fontSize: '24px', margin: 0, color: 'var(--sb-text)' }}>{trip.title}</h1>
          </div>

          <div className="itinerary-meta-grid-saas">
            <div className="itinerary-meta-item-saas">
              <MapPin size={16} style={{ color: 'var(--sb-teal)' }} />
              <span className="itinerary-meta-value-saas">{trip.destination}</span>
            </div>
            <div className="itinerary-meta-item-saas">
              <CalendarDays size={16} style={{ color: 'var(--sb-text-muted)' }} />
              <span className="itinerary-meta-value-saas">{trip.start_date} to {trip.end_date}</span>
            </div>
            <div className="itinerary-meta-item-saas">
              <Users2 size={16} style={{ color: 'var(--sb-text-muted)' }} />
              <span className="itinerary-meta-value-saas">{members.length} collaborators</span>
            </div>
          </div>

          {/* Share invite panel */}
          <div className="itinerary-invite-bar-saas">
            <span className="itinerary-invite-text-saas">Invite friends to plan together:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Code:</span>
              <strong className="itinerary-invite-code-saas">{trip.invite_code}</strong>
              <button 
                className="btn-saas btn-outline-saas btn-sm" 
                onClick={handleCopyInvite}
                style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {copied ? <Check size={14} style={{ color: 'var(--sb-teal)' }} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>

          {/* Panel toggle + Day tabs row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            {/* Panel switcher */}
            <button
              className={`btn-saas ${activePanel === 'itinerary' ? 'btn-primary-saas' : 'btn-outline-saas'}`}
              onClick={() => setActivePanel('itinerary')}
              style={{ padding: '7px 14px', fontSize: '13px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CalendarDays size={14} /> Itinerary
            </button>
            <button
              className={`btn-saas ${activePanel === 'expenses' ? 'btn-primary-saas' : 'btn-outline-saas'}`}
              onClick={() => setActivePanel('expenses')}
              style={{ padding: '7px 14px', fontSize: '13px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Receipt size={14} /> Expenses
            </button>

            {/* Budget AI button */}
            <button
              className="btn-saas budget-suggest-btn"
              onClick={() => setShowBudgetModal(true)}
              style={{ padding: '7px 14px', fontSize: '13px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
            >
              <Sparkles size={14} /> Budget AI
            </button>
          </div>

          {/* Horizontal Day Tabs — only shown on itinerary panel */}
          {activePanel === 'itinerary' && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {dates.map((date, index) => (
                <button
                  key={date}
                  className={`btn-saas ${selectedDate === date ? 'btn-primary-saas' : 'btn-outline-saas'}`}
                  onClick={() => setSelectedDate(date)}
                  style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', whiteSpace: 'nowrap' }}
                >
                  Day {index + 1} ({new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expenses panel (replaces itinerary scroll when active) */}
        {activePanel === 'expenses' && (
          <ExpenseSplitter
            tripId={tripId}
            members={members}
            currentUserId={currentUserId || members[0]?.id || ''}
          />
        )}

        {/* Days timeline scroll list */}
        {activePanel === 'itinerary' && (
        <div className="itinerary-scroller-saas">
          <div className="day-timeline-saas">
            <div className="day-header-saas">
              <h2 className="day-title-saas">
                Day {dates.indexOf(selectedDate) + 1} Stops
              </h2>
              <button 
                className="btn-saas btn-primary-saas btn-sm"
                onClick={() => {
                  const defaultCoords = getDefaultCoordinates(trip.destination);
                  setNewStop(prev => ({
                    ...prev,
                    lat: defaultCoords.lat.toString(),
                    lng: defaultCoords.lng.toString()
                  }));
                  setShowAddModal(true);
                }}
                style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px' }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} /> Add Activity
              </button>
            </div>

            {dayItems.length === 0 ? (
              <div className="empty-itinerary-state">
                <p>No stops scheduled for this day.</p>
                <button 
                  className="btn-saas btn-outline-saas btn-sm" 
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={14} style={{ marginRight: '6px' }} /> Add stop
                </button>
              </div>
            ) : (
              <div 
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                onDragOver={handleDragOver}
              >
                {dayItems.map((item, index) => (
                  <div
                    key={item.id}
                    id={`activity-item-${item.id}`}
                    className="activity-card-saas"
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={() => focusMapOnStop(item)}
                  >
                    <div className="activity-drag-handle" style={{ color: 'var(--sb-text-muted)', cursor: 'grab', marginRight: '-8px' }}>
                      ⋮⋮
                    </div>
                    
                    <div className={`activity-icon-category-saas ${item.category}`}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{index + 1}</span>
                    </div>

                    <div className="activity-details-saas">
                      <div className="activity-time-title-row-saas">
                        <span className="activity-time-saas">{item.time}</span>
                        <h4 className="activity-title-saas">{item.title}</h4>
                      </div>
                      {item.notes && <p className="activity-notes-saas">{item.notes}</p>}
                    </div>

                    <div className="activity-actions-saas">
                      <button 
                        className="activity-btn-action-saas activity-btn-delete-saas"
                        onClick={(e) => { e.stopPropagation(); handleDeleteStop(item.id); }}
                        title="Delete stop"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {/* Last Dropzone to drag item to bottom of the list */}
                <div 
                  style={{ height: '30px', border: '1px dashed transparent', margin: '4px 0' }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dayItems.length)}
                />
              </div>
            )}
          </div>
        </div>
        )}
      </section>

      {/* Map Section (40%) */}
      {MAP_ENABLED && (
        <section className="map-panel-saas">
          <div ref={mapContainerRef} className="leaflet-map-wrapper" />
        </section>
      )}

      {/* ADD STOP MODAL */}
      {showAddModal && (
        <div className="modal-overlay-saas">
          <div className="modal-card-saas">
            <div className="modal-header-saas">
              <h3 className="modal-title-saas">Add Stop to Timeline</h3>
              <button className="modal-close-btn-saas" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddStop} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group-saas">
                <label className="form-label-saas" htmlFor="stop-title">Stop Title</label>
                <input
                  type="text"
                  id="stop-title"
                  className="form-input-saas"
                  placeholder="Kinkaku-ji Temple, Lunch in Gion..."
                  value={newStop.title}
                  onChange={(e) => setNewStop({ ...newStop, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group-saas" style={{ flex: 1 }}>
                  <label className="form-label-saas" htmlFor="stop-time">Time</label>
                  <input
                    type="text"
                    id="stop-time"
                    className="form-input-saas"
                    placeholder="10:30 AM, 3:00 PM..."
                    value={newStop.time}
                    onChange={(e) => setNewStop({ ...newStop, time: e.target.value })}
                  />
                </div>
                <div className="form-group-saas" style={{ flex: 1 }}>
                  <label className="form-label-saas" htmlFor="stop-category">Category</label>
                  <select
                    id="stop-category"
                    className="form-input-saas"
                    value={newStop.category}
                    onChange={(e) => setNewStop({ ...newStop, category: e.target.value })}
                  >
                    <option value="activity">🏛️ Sightseeing / Activity</option>
                    <option value="departure">🚀 Starting Point / Departure</option>
                    <option value="food">🍽️ Food / Dining</option>
                    <option value="lodging">🏨 Hotel / Stay</option>
                    <option value="flight">✈️ Travel / Transit</option>
                    <option value="shopping">🛍️ Shopping</option>
                    <option value="other">📌 Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group-saas">
                <label className="form-label-saas" htmlFor="stop-notes">Notes</label>
                <textarea
                  id="stop-notes"
                  className="form-input-saas"
                  rows="3"
                  placeholder="Important ticket numbers, items to bring, dining options..."
                  value={newStop.notes}
                  onChange={(e) => setNewStop({ ...newStop, notes: e.target.value })}
                />
              </div>



              <button
                type="submit"
                className="btn-saas btn-primary-saas"
                style={{ marginTop: '10px' }}
              >
                Add Activity Stop
              </button>
            </form>
          </div>
        </div>
      )}

      {/* BUDGET AI MODAL */}
      {showBudgetModal && (
        <BudgetSuggestModal
          tripId={tripId}
          tripDates={dates}
          onClose={() => setShowBudgetModal(false)}
          onImportDay={async (day, targetDate) => {
            const defaultCoords = getDefaultCoordinates(trip.destination);
            const cats = [
              { key: 'travel', category: 'flight', label: 'Travel' },
              { key: 'accommodation', category: 'lodging', label: 'Accommodation' },
              { key: 'food', category: 'food', label: 'Food' },
              { key: 'activities', category: 'activity', label: 'Activities' }
            ];
            const date = targetDate || (dates.length > 0 ? dates[Math.min(day.day - 1, dates.length - 1)] : '');
            for (let i = 0; i < cats.length; i++) {
              const { key, category, label } = cats[i];
              if (day[key] > 0) {
                await itineraryApi.add(tripId, {
                  title: `[Budget] Day ${day.day} ${label}`,
                  time: '12:00 PM',
                  notes: `Estimated cost: ₹${day[key]}. ${day.notes || ''}`,
                  category,
                  date,
                  lat: defaultCoords.lat,
                  lng: defaultCoords.lng,
                  position_index: 100 + i
                });
              }
            }
            fetchTripDetails(false);
            broadcastChange();
          }}
        />
      )}
    </div>
  );
}
