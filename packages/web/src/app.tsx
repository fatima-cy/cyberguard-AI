import { useEffect, useState } from 'react';
import './app.css';

interface SystemHealth {
  status: string;
  version: string;
  environment: string;
  timestamp: string;
  checks: {
    api: string;
  };
}

export default function App() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json() as Promise<SystemHealth>;
      })
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch health check:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="app-container">
      <div className="glow-orb glow-orb-top"></div>
      <div className="glow-orb glow-orb-bottom"></div>

      <header className="app-header">
        <div className="logo-container">
          <span className="logo-icon">🛡️</span>
          <span className="logo-text">CyberGuard AI</span>
        </div>
        <nav>
          <ul className="nav-links">
            <li><a href="#dashboard" className="nav-link active">Dashboard</a></li>
            <li><a href="#threats" className="nav-link">Threat Center</a></li>
            <li><a href="#policies" className="nav-link">Policies</a></li>
            <li><a href="#billing" className="nav-link">Billing</a></li>
          </ul>
        </nav>
        <div className="header-actions">
          <button className="btn btn-ghost">Sign In</button>
          <button className="btn btn-primary">Launch Console</button>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <div className="badge">
            <span className="badge-pulse"></span>
            Sprint 0 Foundation Live
          </div>
          <h1 className="hero-title">
            AI-Native Cybersecurity for <br />
            <span className="gradient-text">African & MENA Enterprises</span>
          </h1>
          <p className="hero-description">
            Advanced multi-tenant risk assessment, instant phishing analysis, and compliance policy generation grounded in Nigerian and African regulatory frameworks (NDPR, ISO 27001, CIS Controls).
          </p>
        </section>

        <section className="dashboard-grid" id="dashboard">
          <div className="cyber-card">
            <div className="card-header">
              <div className="card-icon-wrapper">💬</div>
              <span className="card-badge">CyberGuard Chat</span>
            </div>
            <h3 className="card-title">SecOps Assistant</h3>
            <p className="card-description">
              Ground truth security advice and interactive risk mitigation guides grounded in local compliance policies.
            </p>
            <div className="card-footer">
              <span>Launch Chat</span>
              <span>→</span>
            </div>
          </div>

          <div className="cyber-card">
            <div className="card-header">
              <div className="card-icon-wrapper">🔍</div>
              <span className="card-badge">Phishing Analyzer</span>
            </div>
            <h3 className="card-title">Email Intelligence</h3>
            <p className="card-description">
              Analyze headers and content with state-of-the-art GPT-4o models to flag potential social engineering indicators.
            </p>
            <div className="card-footer">
              <span>Inspect Content</span>
              <span>→</span>
            </div>
          </div>

          <div className="cyber-card">
            <div className="card-header">
              <div className="card-icon-wrapper">📄</div>
              <span className="card-badge">Policy Generator</span>
            </div>
            <h3 className="card-title">Compliance Builder</h3>
            <p className="card-description">
              Dynamically build NDPR and ISO 27001 compliant policies structured precisely for your business context.
            </p>
            <div className="card-footer">
              <span>Generate Policies</span>
              <span>→</span>
            </div>
          </div>
        </section>

        <section className="status-section">
          <h2 className="status-title">
            <span>🔌</span> API Service Integration Status
          </h2>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">API Health</span>
              <span className={`status-value ${health?.status === 'healthy' ? 'healthy' : ''}`}>
                {loading ? 'Testing...' : health ? 'HEALTHY' : 'UNREACHABLE'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Version</span>
              <span className="status-value version">
                {loading ? '...' : health?.version ?? '0.1.0'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Environment</span>
              <span className="status-value">
                {loading ? '...' : health?.environment ?? 'development'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Cosmos DB API</span>
              <span className="status-value version">NoSQL (Native)</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} CyberGuard AI. Built on Azure · TypeScript · React · Turborepo. All rights reserved.</p>
      </footer>
    </div>
  );
}
