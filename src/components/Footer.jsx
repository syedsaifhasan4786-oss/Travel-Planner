import React, { useState } from 'react';
import { Compass, Twitter, Instagram, Github, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setEmail('');
    }
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="logo-icon" style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
                <Compass size={18} />
              </div>
              <span className="footer-logo-text">TripPlanner</span>
            </div>
            <p className="footer-desc">
              Designing itineraries, exploring maps, and collaborating in real-time with travel buddies has never been easier.
            </p>
            <div className="footer-socials">
              <a href="#" className="social-btn" aria-label="Twitter"><Twitter size={16} /></a>
              <a href="#" className="social-btn" aria-label="Instagram"><Instagram size={16} /></a>
              <a href="#" className="social-btn" aria-label="Github"><Github size={16} /></a>
            </div>
          </div>
          
          <div>
            <h4 className="footer-col-title">Product</h4>
            <ul className="footer-links">
              <li><a href="#features">Features</a></li>
              <li><a href="#how-it-works">How It Works</a></li>
              <li><Link to="/auth">Mock Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">Company</h4>
            <ul className="footer-links">
              <li><a href="#">About Us</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Privacy Policy</a></li>
            </ul>
          </div>

          <div className="footer-newsletter">
            <h4 className="footer-col-title">Stay Updated</h4>
            <p className="footer-desc" style={{ fontSize: '13px' }}>
              Subscribe to get release updates, templates, and travel hacks.
            </p>
            {submitted ? (
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px', fontWeight: '500' }}>
                Thank you! You have been subscribed.
              </p>
            ) : (
              <form className="newsletter-form" onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="newsletter-input"
                  aria-label="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary" aria-label="Subscribe" style={{ padding: '0 16px', borderRadius: '8px' }}>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} TripPlanner Inc. All rights reserved.</p>
          <p>Made with love for travelers worldwide.</p>
        </div>
      </div>
    </footer>
  );
}
