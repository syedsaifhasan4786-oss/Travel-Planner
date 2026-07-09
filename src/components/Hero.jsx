import React from 'react';
import { Link } from 'react-router-dom';
import heroVideo from '../assets/hero-video.mp4';
import heroPoster from '../assets/hero-poster.jpg';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-video-container">
        <video
          className="hero-video"
          poster={heroPoster}
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="hero-overlay" />
      </div>
      
      <div className="hero-content">
        <div className="hero-tag">
          <span /> Powered by Collaboration
        </div>
        <h1 className="hero-title">Plan trips together, effortlessly</h1>
        <p className="hero-subtitle">
          Bring your travel squad together. Co-create itineraries, visualize stops on an interactive map, and sync schedules in real-time.
        </p>
        <div className="hero-actions">
          <Link to="/auth" className="btn btn-lg btn-primary">
            Get Started <ArrowRight size={18} style={{ marginLeft: '8px' }} />
          </Link>
          <a href="#features" className="btn btn-lg btn-glass">
            Explore Features
          </a>
        </div>
      </div>
    </section>
  );
}
