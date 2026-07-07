import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/auth.context';
import { chatApi } from '../api/dashboard.api';
import { getAccessToken } from '../api/client';
import type { ChatSession } from '@cyberguard/shared';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatApi.listSessions().then(data => setSessions(data.sessions)).catch(() => {});
  }, []);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setInput('');
    setSending(true);
    setError('');

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `stream-${Date.now()}`;

    // Add user message immediately
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: message }]);

    // Add empty assistant message that will be streamed into
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', streaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getAccessToken();
      const response = await fetch('/api/v1/cyberguard/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          message,
          sessionId: activeSessionId ?? undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Stream request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            if (event.type === 'session' && !activeSessionId) {
              setActiveSessionId(event.sessionId);
              navigate(`/chat/${event.sessionId}`, { replace: true });
            }

            if (event.type === 'token') {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + event.token }
                  : m,
              ));
            }

            if (event.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      id: event.messageId ?? m.id,
                      streaming: false,
                      tokens: event.metadata?.tokens?.total
                        ? { total: event.metadata.tokens.total }
                        : undefined,
                    }
                  : m,
              ));
              // Refresh session list to show updated title/count
              chatApi.listSessions().then(d => setSessions(d.sessions)).catch(() => {});
            }

            if (event.type === 'error') {
              throw new Error(event.error ?? 'Stream error');
            }
          } catch (parseErr) {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User navigated away
      setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
      setError(err.message ?? 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function startNewChat() {
    abortRef.current?.abort();
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
              onClick={() => {
                abortRef.current?.abort();
                setActiveSessionId(s.id);
                navigate(`/chat/${s.id}`);
              }}
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
                  {m.role === 'assistant' ? (
                    <div className={`message-markdown ${m.streaming ? 'streaming' : ''}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content || (m.streaming ? '▋' : '')}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="message-text">{m.content}</div>
                  )}
                  {m.role === 'assistant' && !m.streaming && m.tokens && (
                    <div className="message-meta">{m.tokens.total} tokens</div>
                  )}
                  {m.role === 'assistant' && m.streaming && (
                    <div className="message-meta streaming-indicator">CyberGuard AI is thinking...</div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && <div className="chat-error">{error}</div>}

        <form className="chat-input-bar" onSubmit={handleSend}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
            placeholder="Ask CyberGuard AI anything about cybersecurity..."
            rows={1}
            disabled={sending}
          />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || sending}>
            {sending ? '■' : '↑'}
          </button>
        </form>
      </main>
    </div>
  );
}
