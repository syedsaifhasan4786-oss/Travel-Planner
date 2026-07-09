import React from 'react';

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Invite Your Friends',
      description: 'Create a trip workspace and send secure invite links to your travel group.',
    },
    {
      num: '02',
      title: 'Co-Design the Plan',
      description: 'Pin sights, vote on restaurants, and arrange day-by-day plans together.',
    },
    {
      num: '03',
      title: 'Explore Stress-Free',
      description: 'Access timelines and routes on-the-go with synchronized directions.',
    },
  ];

  return (
    <section id="how-it-works" className="section" style={{ borderTop: '1px solid var(--border-light)' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-label">Process</span>
          <h2 className="section-title">How it works</h2>
          <p className="section-desc">
            Organizing group trips doesn't need to be chaotic. Get set up in three simple, interactive steps.
          </p>
        </div>
        
        <div className="steps-container">
          {steps.map((step, idx) => (
            <div key={idx} className="step-item">
              <div className="step-badge">{step.num}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
