import React, { useState } from 'react';
import { fetchWithAuth } from '../lib/supabaseClient';
import { X, Sparkles, DollarSign, MapPin, CalendarDays, Loader, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORY_COLORS = {
  travel: '#06b6d4',
  accommodation: '#6366f1',
  food: '#f59e0b',
  activities: '#0d9488'
};

function DayCard({ day, onImport, importing }) {
  const [expanded, setExpanded] = useState(false);
  const total = day.travel + day.accommodation + day.food + day.activities;

  return (
    <div className="budget-day-card">
      <button
        className="budget-day-header"
        onClick={() => setExpanded(prev => !prev)}
        type="button"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="budget-day-badge">Day {day.day}</span>
          <span className="budget-day-total">₹{total.toLocaleString('en-IN')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-saas btn-primary-saas btn-sm"
            onClick={(e) => { e.stopPropagation(); onImport(day); }}
            disabled={importing}
            style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}
            type="button"
          >
            {importing ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : '+ Import'}
          </button>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="budget-day-body">
          <div className="budget-breakdown-grid">
            {['travel', 'accommodation', 'food', 'activities'].map(cat => (
              <div key={cat} className="budget-breakdown-item">
                <span className="budget-cat-dot" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                <span className="budget-cat-label">{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                <span className="budget-cat-value">₹{Number(day[cat]).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          {day.notes && <p className="budget-day-notes">{day.notes}</p>}
        </div>
      )}
    </div>
  );
}

export default function BudgetSuggestModal({ tripId, tripDates, onClose, onImportDay }) {
  const [form, setForm] = useState({ destination: '', budget_inr: '', days: '' });
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState('');
  const [importingDay, setImportingDay] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuggestion(null);
    setLoading(true);
    try {
      const data = await fetchWithAuth('/api/budget-suggest', {
        method: 'POST',
        body: JSON.stringify({
          destination: form.destination,
          budget_inr: Number(form.budget_inr),
          days: Number(form.days)
        })
      });
      setSuggestion(data);
    } catch (err) {
      setError(err.message || 'Failed to get suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportDay = async (day) => {
    if (!tripId) return;
    setImportingDay(day.day);
    try {
      // Map the day index to an actual trip date if available
      const targetDate = tripDates?.[day.day - 1] || tripDates?.[0] || '';
      await onImportDay(day, targetDate);
    } finally {
      setImportingDay(null);
    }
  };

  const handleImportAll = async () => {
    if (!suggestion) return;
    for (const day of suggestion.days) {
      await handleImportDay(day);
    }
  };

  return (
    <div className="modal-overlay-saas">
      <div className="modal-card-saas budget-modal-wide">
        {/* Header */}
        <div className="modal-header-saas">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="budget-icon-badge">
              <Sparkles size={18} />
            </div>
            <h3 className="modal-title-saas">AI Budget Trip Suggestion</h3>
          </div>
          <button className="modal-close-btn-saas" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="form-group-saas" style={{ flex: '2', minWidth: '160px' }}>
              <label className="form-label-saas">
                <MapPin size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Destination
              </label>
              <input
                type="text"
                className="form-input-saas"
                placeholder="e.g. Kyoto, Japan"
                value={form.destination}
                onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                required
              />
            </div>
            <div className="form-group-saas" style={{ flex: '1', minWidth: '110px' }}>
              <label className="form-label-saas">
                <span style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', fontWeight: 600 }}>₹</span>
                Total Budget (INR)
              </label>
              <input
                type="number"
                className="form-input-saas"
                placeholder="e.g. 150000"
                min="1"
                value={form.budget_inr}
                onChange={e => setForm(f => ({ ...f, budget_inr: e.target.value }))}
                required
              />
            </div>
            <div className="form-group-saas" style={{ flex: '1', minWidth: '90px' }}>
              <label className="form-label-saas">
                <CalendarDays size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Days
              </label>
              <input
                type="number"
                className="form-input-saas"
                placeholder="e.g. 7"
                min="1"
                max="30"
                value={form.days}
                onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
                required
              />
            </div>
          </div>

          {error && <div className="auth-error-alert">{error}</div>}

          <button
            type="submit"
            className="btn-saas btn-primary-saas"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading
              ? <><Loader size={16} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />Generating with AI...</>
              : <><Sparkles size={16} style={{ marginRight: '8px' }} />Suggest Budget Trip</>
            }
          </button>
        </form>

        {/* Results */}
        {suggestion && (
          <div className="budget-results-section">
            <div className="budget-summary-bar">
              <div>
                <div className="budget-summary-label">AI Summary</div>
                <p className="budget-summary-text">{suggestion.summary}</p>
              </div>
              <div className="budget-total-pill">
                <CheckCircle size={14} />
                ₹{Number(suggestion.total_estimated_cost ?? 0).toLocaleString('en-IN')} / ₹{Number(form.budget_inr).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="budget-days-list">
              {suggestion.days.map(day => (
                <DayCard
                  key={day.day}
                  day={day}
                  onImport={handleImportDay}
                  importing={importingDay === day.day}
                />
              ))}
            </div>

            {tripId && (
              <button
                type="button"
                className="btn-saas btn-outline-saas"
                onClick={handleImportAll}
                style={{ width: '100%', marginTop: '4px' }}
              >
                Import All Days to Itinerary
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
