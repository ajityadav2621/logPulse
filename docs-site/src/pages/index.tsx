import React from 'react';
import { Redirect } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

// NOTE: Docusaurus renders src/pages/index.(ts)x at "/" — this landing page
// mirrors the shadcn docs entry: badge → headline → primary/outline buttons →
// feature card grid. Everything below links into /docs/* or /api-reference.

const FEATURES: { icon: string; title: string; text: string; to: string }[] = [
  {
    icon: '📡',
    title: 'Live log stream',
    text: 'Ingest behind per-app API keys; entries push to every dashboard over WebSocket in real time.',
    to: '/docs/websocket-protocol',
  },
  {
    icon: '🧩',
    title: 'Clustering & dedup',
    text: 'Near-duplicate lines collapse into normalized patterns with live counts — signal, not noise.',
    to: '/docs/architecture#monitoring-pipeline',
  },
  {
    icon: '📈',
    title: 'Anomaly detection',
    text: 'Hour-of-day baselines per app; volume spikes, error-rate surges, and silent services flagged automatically.',
    to: '/docs/architecture#monitoring-pipeline',
  },
  {
    icon: '🧠',
    title: 'Root-cause copilot',
    text: 'Every incident gets a timeline, failure signatures, and ranked hypotheses citing the actual log lines.',
    to: '/docs/architecture#monitoring-pipeline',
  },
  {
    icon: '🔔',
    title: 'Alerting with triage',
    text: 'Threshold rules with cooldown suppression, trigger history, and describe-it-in-words authoring.',
    to: '/docs/api-reference',
  },
  {
    icon: '📦',
    title: 'SDKs in 3 languages',
    text: 'Go, Node/TypeScript, and Python clients with async buffering and framework middleware.',
    to: '/docs/sdks',
  },
];

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Documentation" description={siteConfig.tagline}>
      <main className="container">
        <section className="lp-hero">
          <span className="lp-hero__badge">v1.1 · AI-native monitoring</span>
          <h1>LogPulse Documentation</h1>
          <p>
            Centralized log monitoring: ingest, search, and stream logs live —
            with clustering, anomaly detection, incident correlation, volume
            forecasting, and SDKs for Go, Node, and Python.
          </p>
          <div className="lp-buttons">
            <Link className="lp-button lp-button--primary" to="/docs/intro">
              Get started
            </Link>
            <Link className="lp-button lp-button--outline" to="/api-reference">
              API reference
            </Link>
            <Link className="lp-button lp-button--outline" to="/docs/configuration">
              Configuration
            </Link>
          </div>
        </section>

        <h2 className="lp-section-title">Explore</h2>
        <p className="lp-section-sub">Everything you need to run, integrate, and operate LogPulse.</p>
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-card">
              <Link to={f.to}>
                <span className="lp-card__icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}

// Keep the import used if the redirect ever replaces this page.
void Redirect;
