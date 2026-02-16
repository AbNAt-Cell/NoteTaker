'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

const features = [
  {
    icon: '✍️',
    title: 'Rich Note Editor',
    description: 'Beautiful TipTap-powered editor with markdown, code blocks, task lists, and more.',
  },
  {
    icon: '🤖',
    title: 'AI Meeting Intelligence',
    description: 'Automated meeting capture, transcription, and smart summaries with action items.',
  },
  {
    icon: '🔍',
    title: 'Semantic Search',
    description: 'Find anything instantly with AI-powered search across all your notes and transcripts.',
  },
  {
    icon: '🔄',
    title: 'Real-time Sync',
    description: 'Collaborate live with Socket.io powered real-time sync across all devices.',
  },
  {
    icon: '📂',
    title: 'Smart Organization',
    description: 'Folders, tags, and AI-suggested categories keep everything structured.',
  },
  {
    icon: '🔒',
    title: 'Enterprise Security',
    description: 'SOC2-ready architecture with role-based access and encrypted data.',
  },
];

export default function LandingPage() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className={styles.page}>
      {/* Animated background */}
      <div
        className={styles.bgGlow}
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(139, 92, 246, 0.06), transparent 40%)`,
        }}
      />
      <div className={styles.bgGrid} />

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>📝</span>
            <span className={styles.logoText}>NoteTaker</span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="/login" className="btn-secondary" style={{ padding: '10px 22px' }}>
              Sign In
            </Link>
            <Link href="/register" className="btn-primary" style={{ padding: '10px 22px' }}>
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            AI-Powered Note Taking
          </div>
          <h1 className={styles.heroTitle}>
            Your notes,
            <br />
            <span className="gradient-text">supercharged with AI</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Capture meetings, organize thoughts, and let AI extract insights —
            all in one beautiful platform built for modern teams.
          </p>
          <div className={styles.heroCta}>
            <Link href="/register" className="btn-primary" style={{ padding: '16px 36px', fontSize: '1.05rem' }}>
              Start Taking Notes →
            </Link>
            <Link href="#features" className="btn-secondary" style={{ padding: '16px 36px', fontSize: '1.05rem' }}>
              See Features
            </Link>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>300</span>
              <span className={styles.statLabel}>Free minutes/mo</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>∞</span>
              <span className={styles.statLabel}>Notes</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>E2E</span>
              <span className={styles.statLabel}>Encrypted</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Everything you need to
            <span className="gradient-text"> capture brilliance</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            From quick notes to full meeting transcripts, NoteTaker handles it all.
          </p>
        </div>
        <div className={styles.featureGrid}>
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`${styles.featureCard} glass`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={`${styles.ctaCard} glass`}>
          <h2 className={styles.ctaTitle}>
            Ready to <span className="gradient-text">supercharge</span> your notes?
          </h2>
          <p className={styles.ctaSubtitle}>
            Join thousands of teams using NoteTaker to capture every idea and meeting.
          </p>
          <Link href="/register" className="btn-primary" style={{ padding: '16px 40px', fontSize: '1.1rem' }}>
            Get Started — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.logoIcon}>📝</span>
            <span>NoteTaker</span>
          </div>
          <p className={styles.footerText}>© 2026 NoteTaker. Built for brilliant minds.</p>
        </div>
      </footer>
    </div>
  );
}
