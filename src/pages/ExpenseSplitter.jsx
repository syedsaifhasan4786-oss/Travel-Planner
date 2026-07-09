import React, { useState, useEffect, useCallback } from 'react';
import { expensesApi } from '../lib/supabaseClient';
import {
  Receipt,
  Plus,
  Trash2,
  Users2,
  ArrowRight,
  Loader,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw
} from 'lucide-react';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const fmt = (n) => {
  const num = Number(n) || 0;
  return `₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function MemberInitial({ name, size = 28, color = 'var(--sb-teal)' }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: color, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.38, flexShrink: 0
      }}
    >
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Add Expense Modal
// ─────────────────────────────────────────────────────────
function AddExpenseModal({ tripId, members, currentUserId, onClose, onAdded }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    paid_by: currentUserId,
    split_among: members.map(m => m.id)
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleSplit = (userId) => {
    setForm(f => {
      const current = f.split_among;
      if (current.includes(userId)) {
        if (current.length === 1) return f; // always keep at least one
        return { ...f, split_among: current.filter(id => id !== userId) };
      }
      return { ...f, split_among: [...current, userId] };
    });
  };

  const perPersonAmount = form.amount && form.split_among.length > 0
    ? (Number(form.amount) / form.split_among.length).toFixed(2)
    : '0.00';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.amount) <= 0) return setError('Amount must be greater than 0');
    if (form.split_among.length === 0) return setError('Select at least one member to split with');
    setError('');
    setLoading(true);
    try {
      const created = await expensesApi.add(tripId, {
          description: form.description,
          amount: Number(form.amount),
          paid_by: form.paid_by,
          split_among: form.split_among
        });
      onAdded(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay-saas">
      <div className="modal-card-saas">
        <div className="modal-header-saas">
          <h3 className="modal-title-saas">Log Expense</h3>
          <button className="modal-close-btn-saas" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group-saas">
            <label className="form-label-saas">Description</label>
            <input
              type="text"
              className="form-input-saas"
              placeholder="e.g. Dinner at restaurant, Hotel night..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="form-group-saas" style={{ flex: 1 }}>
              <label className="form-label-saas">Amount (INR)</label>
              <input
                type="number"
                className="form-input-saas"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>

            <div className="form-group-saas" style={{ flex: 1 }}>
              <label className="form-label-saas">Paid by</label>
              <select
                className="form-input-saas"
                value={form.paid_by}
                onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group-saas">
            <label className="form-label-saas">Split between</label>
            <div className="expense-split-members-grid">
              {members.map(m => {
                const selected = form.split_among.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`expense-member-toggle ${selected ? 'selected' : ''}`}
                    onClick={() => toggleSplit(m.id)}
                  >
                    <MemberInitial name={m.name || m.email} size={24} color={selected ? 'var(--sb-teal)' : '#94a3b8'} />
                    <span>{m.name || m.email.split('@')[0]}</span>
                  </button>
                );
              })}
            </div>
            {form.amount && (
              <p className="expense-per-person-hint">
                Each person pays <strong>₹{Number(perPersonAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </p>
            )}
          </div>

          {error && <div className="auth-error-alert">{error}</div>}

          <button type="submit" className="btn-saas btn-primary-saas" disabled={loading}>
            {loading
              ? <Loader size={16} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
              : <Plus size={16} style={{ marginRight: '8px' }} />
            }
            Add Expense
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main ExpenseSplitter Component
// ─────────────────────────────────────────────────────────
export default function ExpenseSplitter({ tripId, members, currentUserId }) {
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [settlements, setSettlements] = useState(null);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('log'); // 'log' | 'settle'
  const [deleteId, setDeleteId] = useState(null);

  const fetchExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    try {
      const data = await expensesApi.list(tripId);
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoadingExpenses(false);
    }
  }, [tripId]);

  const fetchSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const data = await expensesApi.settlements(tripId);
      setSettlements(data);
    } catch (err) {
      console.error('Failed to compute settlements:', err);
    } finally {
      setLoadingSettlements(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'settle' && !settlements) {
      fetchSettlements();
    }
  };

  const handleDeleteExpense = async (id) => {
    setDeleteId(id);
    try {
      await expensesApi.remove(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      setSettlements(null);
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeleteId(null);
    }
  };

  const totalSpend = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // ── Expense Log Tab ──────────────────────────────────────
  const renderLog = () => (
    <div className="expense-log-container">
      {/* Summary bar */}
      <div className="expense-summary-bar">
        <div className="expense-summary-stat">
          <span className="expense-summary-label">Total Expenses</span>
          <span className="expense-summary-value">{fmt(totalSpend)}</span>
        </div>
        <div className="expense-summary-stat">
          <span className="expense-summary-label">Count</span>
          <span className="expense-summary-value">{expenses.length}</span>
        </div>
        <div className="expense-summary-stat">
          <span className="expense-summary-label">Members</span>
          <span className="expense-summary-value">{members.length}</span>
        </div>
      </div>

      {/* List */}
      {loadingExpenses ? (
        <div className="expense-loading-state">
          <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--sb-teal)' }} />
          <span>Loading expenses...</span>
        </div>
      ) : expenses.length === 0 ? (
        <div className="empty-itinerary-state" style={{ margin: '24px 0' }}>
          <Receipt size={28} style={{ color: 'var(--sb-text-muted)' }} />
          <p>No expenses logged yet.</p>
          <button className="btn-saas btn-outline-saas btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} style={{ marginRight: '6px' }} /> Add first expense
          </button>
        </div>
      ) : (
        <div className="expense-items-list">
          {expenses.map(exp => {
            const payerName = exp.payer?.name || exp.payer?.email || exp.paid_by;
            return (
              <div key={exp.id} className="expense-item-card">
                <div className="expense-item-left">
                  <MemberInitial name={payerName} size={36} />
                  <div className="expense-item-info">
                    <span className="expense-item-desc">{exp.description}</span>
                    <span className="expense-item-meta">
                      Paid by <strong>{payerName}</strong>
                      {' · '}split {exp.splits?.length || 0} way{exp.splits?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="expense-item-right">
                  <span className="expense-item-amount">{fmt(exp.amount)}</span>
                  <button
                    className="activity-btn-action-saas activity-btn-delete-saas"
                    onClick={() => handleDeleteExpense(exp.id)}
                    disabled={deleteId === exp.id}
                    title="Delete expense"
                  >
                    {deleteId === exp.id
                      ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Trash2 size={14} />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Settle Up Tab ─────────────────────────────────────
  const renderSettle = () => (
    <div className="settle-container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          className="btn-saas btn-outline-saas btn-sm"
          onClick={fetchSettlements}
          disabled={loadingSettlements}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} style={loadingSettlements ? { animation: 'spin 1s linear infinite' } : {}} />
          Recalculate
        </button>
      </div>

      {loadingSettlements ? (
        <div className="expense-loading-state">
          <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--sb-teal)' }} />
          <span>Computing balances...</span>
        </div>
      ) : !settlements ? null : (
        <>
          {/* Balances */}
          <h4 className="settle-section-title">Member Balances</h4>
          <div className="settle-balances-grid">
            {settlements.balances.map(b => {
              const isPositive = b.net > 0.005;
              const isNegative = b.net < -0.005;
              return (
                <div key={b.user_id} className="settle-balance-card">
                  <MemberInitial name={b.name} size={38} color={isPositive ? '#10b981' : isNegative ? '#f43f5e' : '#94a3b8'} />
                  <div className="settle-balance-info">
                    <span className="settle-member-name">{b.name}</span>
                    <span className="settle-member-stats">
                      Paid {fmt(b.total_paid)} · Owes {fmt(b.total_owed)}
                    </span>
                  </div>
                  <div className={`settle-net-badge ${isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'}`}>
                    {isPositive && <TrendingUp size={13} />}
                    {isNegative && <TrendingDown size={13} />}
                    {!isPositive && !isNegative && <Minus size={13} />}
                    {isPositive ? '+' : ''}{fmt(b.net)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Suggested Payments */}
          <h4 className="settle-section-title" style={{ marginTop: '24px' }}>
            Suggested Payments
            <span className="settle-section-subtitle"> — minimal transfers to settle all debts</span>
          </h4>

          {settlements.settlements.length === 0 ? (
            <div className="settle-all-clear">
              ✅ Everyone is settled up — no payments needed!
            </div>
          ) : (
            <div className="settle-payments-list">
              {settlements.settlements.map((s, i) => (
                <div key={i} className="settle-payment-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MemberInitial name={s.from_name} size={30} color="#f43f5e" />
                    <span className="settle-payment-name">{s.from_name}</span>
                  </div>
                  <div className="settle-payment-arrow">
                    <ArrowRight size={16} />
                    <span className="settle-payment-amount">{fmt(s.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MemberInitial name={s.to_name} size={30} color="#10b981" />
                    <span className="settle-payment-name">{s.to_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="expense-splitter-container">
      {/* Panel Header */}
      <div className="expense-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Receipt size={20} style={{ color: 'var(--sb-teal)' }} />
          <h2 className="expense-panel-title">Group Expenses</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="expense-tabs">
            <button
              className={`expense-tab ${activeTab === 'log' ? 'active' : ''}`}
              onClick={() => handleTabChange('log')}
            >
              <Receipt size={14} /> Log
            </button>
            <button
              className={`expense-tab ${activeTab === 'settle' ? 'active' : ''}`}
              onClick={() => handleTabChange('settle')}
            >
              <Users2 size={14} /> Settle Up
            </button>
          </div>
          <button
            className="btn-saas btn-primary-saas btn-sm"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
          >
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="expense-tab-content">
        {activeTab === 'log' ? renderLog() : renderSettle()}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddExpenseModal
          tripId={tripId}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setShowAddModal(false)}
          onAdded={(newExp) => {
            setExpenses(prev => [newExp, ...prev]);
            setSettlements(null); // invalidate cache
          }}
        />
      )}
    </div>
  );
}
