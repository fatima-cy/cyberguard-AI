/**
 * CyberGuard AI — App Layout
 *
 * Wraps the sidebar + main panel pattern used by Dashboard and Chat.
 * Handles the mobile hamburger menu, overlay, and sidebar open/close state.
 *
 * Sprint 2.6: Mobile responsiveness
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close on Escape key
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
      {/* Hamburger button — mobile only */}
      <button
        className={`sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle navigation"
      >
        <span />
        <span />
        <span />
      </button>

      {/* Overlay — mobile only */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">🛡️ CyberGuard AI</div>

        <ul className="sidebar-nav">
          <li className={isActive('/dashboard') ? 'active' : ''}>
            <Link to="/dashboard" onClick={() => setSidebarOpen(false)}>Dashboard</Link>
          </li>
          <li className={isActive('/chat') ? 'active' : ''}>
            <Link to="/chat" onClick={() => setSidebarOpen(false)}>AI Assistant</Link>
          </li>
        </ul>

        {/* Extra sidebar content (session list for chat page) */}
        {sidebar}

        <div className="sidebar-footer">
          {userEmail && <span className="sidebar-user">{userEmail}</span>}
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
