import React from 'react';
import { CalendarRange, Map, Users } from 'lucide-react';

export default function Features() {
  const featuresList = [
    {
      icon: <CalendarRange size={28} />,
      title: 'Itinerary Builder',
      description: 'Craft beautiful day-by-day plans, attach reservations, organize times, and allocate expenses in a visual timeline.',
    },
    {
      icon: <Map size={28} />,
      title: 'Map View',
      description: 'Visualize your entire journey on an interactive map. Group stops geographically and optimize travel routes seamlessly.',
    },
    {
      icon: <Users size={28} />,
      title: 'Realtime Collaboration',
      description: 'Invite your travel squad to edit, suggest stops, vote on options, and coordinate in real-time with instant sync.',
    },
  ];

  return (
    <section id="features" className="section">
      <div className="section-bg-glow" />
      <div className="container">
        <div className="section-header">
          <span className="section-label">Core Capabilities</span>
          <h2 className="section-title">Everything you need for the perfect trip</h2>
          <p className="section-desc">
            Ditch the messy spreadsheet chains. Our built-in tools keep your group aligned so you can spend less time planning and more time traveling.
          </p>
        </div>
        
        <div className="features-grid">
          {featuresList.map((feat, idx) => (
            <div key={idx} className="feature-card">
              <div className="feature-icon-wrapper">
                {feat.icon}
              </div>
              <h3 className="feature-card-title">{feat.title}</h3>
              <p className="feature-card-desc">{feat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
