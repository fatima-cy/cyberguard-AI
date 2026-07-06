import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth.context';
import { chatApi } from '../api/dashboard.api';
import type { ChatSession } from '@cyberguard/shared';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens?: { total: number };
}

export function ChatPage() {
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(urlSessionId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load session list
  useEffect(() => {
    chatApi.listSessions().then(data => setSessions(data.sessions)).catch(() => {});
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    chatApi.getSession(activeSessionId).then(data => {
      setMessages(data.messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        tokens: m.tokens ? { total: m.tokens.total } : undefined,
      })));
    }).catch(() => setError('Failed to load conversation.'));
  }, [activeSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setInput('');
    setSending(true);
    setError('');

    // Optimistically add user message
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: message }]);

    try {
      const data = await chatApi.sendMessage({
        message,
        sessionId: activeSessionId ?? undefined,
      });

      // Update session ID if new
      if (!activeSessionId) {
        setActiveSessionId(data.sessionId);
        navigate(`/chat/${data.sessionId}`, { replace: true });
        // Refresh session list
        chatApi.listSessions().then(d => setSessions(d.sessions)).catch(() => {});
      }

      // Replace temp message and add assistant response
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        { id: `user-${Date.now()}`, role: 'user', content: message },
        {
          id: data.messageId,
          role: 'assistant',
          content: data.response,
          tokens: { total: data.metadata.tokens.total },
        },
      ]);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setError(err.message ?? 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function startNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    navigate('/chat', { replace: true });
  }

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-logo">🛡️ CyberGuard AI</div>
        <ul className="sidebar-nav">
          <li><Link to="/dashboard">Dashboard</Link></li>
          <li className="active"><Link to="/chat">AI Assistant</Link></li>
        </ul>

        <button className="btn btn-ghost btn-sm new-chat-btn" onClick={startNewChat}>
          + New conversation
        </button>

        <div className="session-list">
          {sessions.map(s => (
            <button
              key={s.id}
              className={`session-item ${s.id === activeSessionId ? 'active' : ''}`}
              onClick={() => { setActiveSessionId(s.id); navigate(`/chat/${s.id}`); }}
            >
              <span className="session-title">{s.title}</span>
              <span className="session-count">{s.messageCount} msgs</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <main className="chat-panel">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">🛡️</div>
            <h2>CyberGuard AI Assistant</h2>
            <p>Ask me about NDPR compliance, cybersecurity threats, ISO 27001, data protection, and security best practices for African enterprises.</p>
            <div className="chat-suggestions">
              {[
                'What are the NDPR requirements for a fintech startup?',
                'How do I protect against BEC attacks?',
                'Create an ISO 27001 gap analysis checklist',
              ].map(s => (
                <button key={s} className="suggestion-chip" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map(m => (
              <div key={m.id} className={`message message-${m.role}`}>
                <div className="message-avatar">{m.role === 'user' ? '👤' : '🛡️'}</div>
                <div className="message-content">
                  <pre className="message-text">{m.content}</pre>
                  {m.role === 'assistant' && m.tokens && (
                    <div className="message-meta">{m.tokens.total} tokens</div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="message message-assistant">
                <div className="message-avatar">🛡️</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && <div className="chat-error">{error}</div>}

        <form className="chat-input-bar" onSubmit={handleSend}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
            placeholder="Ask CyberGuard AI anything about cybersecurity..."
            rows={1}
            disabled={sending}
          />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || sending}>
            {sending ? '...' : '↑'}
          </button>
        </form>
      </main>
    </div>
  );
}
