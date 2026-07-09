import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();

  const handleScroll = (id) => {
    if (window.location.pathname !== '/') {
      navigate('/');
      // Wait for navigation to complete before scrolling
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="navbar">
      <div className="container navbar-container">
        <div className="logo-group" onClick={() => navigate('/')}>
          <div className="logo-icon">
            <Compass size={24} />
          </div>
          <span className="logo-text">TripPlanner</span>
        </div>
        
        <nav>
          <ul className="nav-links">
            <li>
              <a href="#features" onClick={(e) => { e.preventDefault(); handleScroll('features'); }} className="nav-link">
                Features
              </a>
            </li>
            <li>
              <a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleScroll('how-it-works'); }} className="nav-link">
                How It Works
              </a>
            </li>
          </ul>
        </nav>

        <div className="nav-actions">
          <Link to="/auth" className="btn btn-sm btn-text">
            Log In
          </Link>
          <Link to="/auth" className="btn btn-sm btn-primary">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
