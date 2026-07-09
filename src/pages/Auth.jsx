import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Compass, Mail, Lock, ArrowRight, Chrome, RefreshCw } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Check if already signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/app');
      }
    });
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'recover') {
      setRecoveryMode(true);
      setIsSignUp(false);
      setSuccessMsg('Create a new password to finish resetting your account.');
    }
  }, [location.search]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const redirectTo = `${window.location.origin}/auth`;

    try {
      if (recoveryMode) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setSuccessMsg('Password updated. You can now sign in with your new password.');
        setRecoveryMode(false);
        setPassword('');
        setConfirmPassword('');
        return;
      }

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0] },
            emailRedirectTo: redirectTo
          }
        });
        if (error) throw error;

        if (data.session) {
          navigate('/app');
        } else {
          setErrorMsg('Check your email to confirm your account, then sign in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/app');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg('Enter your email address first.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=recover`
      });
      if (error) throw error;
      setResetEmailSent(true);
      setSuccessMsg('Password reset email sent. Check your inbox to continue.');
    } catch (err) {
      setErrorMsg(err.message || 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth` }
      });
      if (error) throw error;
      navigate('/app');
    } catch (err) {
      setErrorMsg(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card-saas">
        <div className="auth-header-saas">
          <div className="logo-group-saas" onClick={() => navigate('/')}>
            <div className="logo-icon-saas">
              <Compass size={24} />
            </div>
            <span className="logo-text-saas">TripBoard</span>
          </div>
          <h2 className="auth-title-saas">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="auth-subtitle-saas">
            {recoveryMode
              ? 'Set a new password to regain access.'
              : isSignUp
                ? 'Start planning group trips in real-time.'
                : 'Sign in to plan with your squad.'}
          </p>
        </div>

        {successMsg && <div className="auth-success-alert">{successMsg}</div>}
        {errorMsg && <div className="auth-error-alert">{errorMsg}</div>}

        <form className="auth-form-saas" onSubmit={handleAuth}>
          {!recoveryMode && isSignUp && (
            <div className="form-group-saas">
              <label className="form-label-saas" htmlFor="auth-name">Your Name</label>
              <div className="input-with-icon-saas">
                <input
                  type="text"
                  id="auth-name"
                  className="form-input-saas"
                  placeholder="Alex Johnson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group-saas">
            <label className="form-label-saas" htmlFor="auth-email">Email Address</label>
            <div className="input-with-icon-saas">
              <Mail className="input-icon-saas" size={16} />
              <input
                type="email"
                id="auth-email"
                className="form-input-saas"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group-saas">
            <label className="form-label-saas" htmlFor="auth-password">Password</label>
            <div className="input-with-icon-saas">
              <Lock className="input-icon-saas" size={16} />
              <input
                type="password"
                id="auth-password"
                className="form-input-saas"
                placeholder={recoveryMode ? 'Enter new password' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {recoveryMode && (
            <div className="form-group-saas">
              <label className="form-label-saas" htmlFor="auth-confirm-password">Confirm New Password</label>
              <div className="input-with-icon-saas">
                <Lock className="input-icon-saas" size={16} />
                <input
                  type="password"
                  id="auth-confirm-password"
                  className="form-input-saas"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-saas btn-primary-saas"
            disabled={loading}
            style={{ width: '100%', marginTop: '10px' }}
          >
            {loading ? 'Processing...' : recoveryMode ? 'Update Password' : isSignUp ? 'Get Started' : 'Sign In'}
            {!loading && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
          </button>
        </form>

        {!recoveryMode && !isSignUp && (
          <button
            type="button"
            className="auth-forgot-btn"
            onClick={handleForgotPassword}
            disabled={loading}
          >
            <RefreshCw size={14} />
            {resetEmailSent ? 'Reset email sent again' : 'Forgot password?'}
          </button>
        )}

        <div className="auth-divider-saas">
          <span>or continue with</span>
        </div>

        <button
          type="button"
          className="btn btn-saas btn-outline-saas"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Chrome size={18} style={{ marginRight: '8px', color: '#db4437' }} />
          Google
        </button>

        {!recoveryMode && (
          <div className="auth-footer-saas">
          {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
          <button
            type="button"
            className="auth-link-saas"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
          </div>
        )}
      </div>
    </div>
  );
}
