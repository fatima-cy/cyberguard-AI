/**
 * CyberGuard AI — App Layout
 *
 * Wraps the sidebar + main panel pattern used by Dashboard and Chat.
 * Handles the mobile hamburger menu, overlay, and sidebar open/close state.
 *
 * Sprint 2.6: Mobile responsiveness
 * Sprint 4.1.3: Grouped nav sections + icons for faster visual scanning as
 * the module count grows (Dashboard alone → Dashboard + 3 AI tools)
 */

import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth.context';

interface LayoutProps {
  children: ReactNode;
  sidebar?: ReactNode; // Extra sidebar content (session list, etc.)
  userEmail?: string;
}

export function Layout({ children, sidebar, userEmail }: LayoutProps) {
  const { logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="app-shell">
      <button
        className={`sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle navigation"
      >
        <span />
        <span />
        <span />
      </button>

      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/cloudsecure-icon.png" alt="CloudSecure" className="sidebar-logo-mark" />
          CyberGuard AI
        </div>

        <div className="sidebar-nav-group">
          <ul className="sidebar-nav">
            <li className={isActive('/dashboard') ? 'active' : ''}>
              <Link to="/dashboard" onClick={() => setSidebarOpen(false)}>
                <span className="sidebar-nav-icon">📊</span> Dashboard
              </Link>
            </li>
          </ul>
        </div>

        <div className="sidebar-nav-group">
          <span className="sidebar-nav-section-label">AI Tools</span>
          <ul className="sidebar-nav">
            <li className={isActive('/chat') ? 'active' : ''}>
              <Link to="/chat" onClick={() => setSidebarOpen(false)}>
                <span className="sidebar-nav-icon">💬</span> AI Assistant
              </Link>
            </li>
            <li className={isActive('/phishing') ? 'active' : ''}>
              <Link to="/phishing" onClick={() => setSidebarOpen(false)}>
                <span className="sidebar-nav-icon">🎣</span> Phishing Analyzer
              </Link>
            </li>
            <li className={isActive('/policies') ? 'active' : ''}>
              <Link to="/policies" onClick={() => setSidebarOpen(false)}>
                <span className="sidebar-nav-icon">📄</span> Policy Generator
              </Link>
            </li>
          </ul>
        </div>

        {/* Extra sidebar content (session list for chat page, recent analyses/
            saved policies for other pages). Sprint 4.1.5 fix: closes the mobile
            sidebar on click — the existing location.pathname-based auto-close
            only fires on actual route navigation, but selecting a past analysis
            or saved policy is a same-page state update, not a route change, so
            it never triggered the close. Rename/delete buttons already call
            stopPropagation(), so they're unaffected by this. */}
        <div className="sidebar-extra" onClick={() => setSidebarOpen(false)}>
          {sidebar}
        </div>

        <div className="sidebar-footer">
          {userEmail && <span className="sidebar-user">{userEmail}</span>}
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
