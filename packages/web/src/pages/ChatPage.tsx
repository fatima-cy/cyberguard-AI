import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/auth.context';
import { chatApi } from '../api/dashboard.api';
import { getAccessToken } from '../api/client';
import { Layout } from '../components/Layout';
import { CitationBlock } from '../components/CitationBlock';
import type { ChatSession, ChatSource } from '@cyberguard/shared';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  tokens?: { total: number };
  sources?: ChatSource[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
  }
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function SessionItem({
  session, isActive, onSelect, onRename, onDelete,
}: {
  session: ChatSession; isActive: boolean;
  onSelect: () => void; onRename: (id: string, title: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function handleRenameSubmit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.title) await onRename(session.id, trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') { setEditValue(session.title); setEditing(false); }
  }

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    await onDelete(session.id);
    setConfirming(false);
  }

  return (
    <div className={`session-item-wrapper ${isActive ? 'active' : ''}`}>
      {editing ? (
        <input ref={inputRef} className="session-rename-input" value={editValue}
          onChange={e => setEditValue(e.target.value)} onKeyDown={handleKeyDown}
          onBlur={handleRenameSubmit} maxLength={100} />
      ) : (
        <button className="session-item-btn" onClick={onSelect}>
          <span className="session-title">{session.title}</span>
          <span className="session-count">{session.messageCount} msgs</span>
        </button>
      )}
      {!editing && (
        <div className="session-actions">
          <button className="session-action-btn" onClick={e => { e.stopPropagation(); setEditing(true); setEditValue(session.title); }} title="Rename">✏️</button>
          <button className={`session-action-btn ${confirming ? 'danger' : ''}`} onClick={e => { e.stopPropagation(); handleDelete(); }} title={confirming ? 'Confirm delete' : 'Delete'}>
            {confirming ? '⚠️' : '🗑️'}
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatPage() {
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(urlSessionId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const streamingSessionIdRef = useRef<string | null>(null);

  const sessions = search.trim()
    ? allSessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : allSessions;

  useEffect(() => { setActiveSessionId(urlSessionId ?? null); }, [urlSessionId]);

  const refreshSessions = useCallback(() => {
    chatApi.listSessions().then(d => setAllSessions(d.sessions)).catch(() => {});
  }, []);

  useEffect(() => {
    chatApi.listSessions()
      .then(d => setAllSessions(d.sessions))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    if (streamingSessionIdRef.current === activeSessionId) return;
    chatApi.getSession(activeSessionId).then(data => {
      setMessages(data.messages.map(m => ({
        id: m.id, role: m.role as 'user' | 'assistant', content: m.content,
        tokens: m.tokens ? { total: m.tokens.total } : undefined,
        sources: m.sources,
      })));
    }).catch(() => setError('Failed to load conversation.'));
  }, [activeSessionId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  async function handleRename(id: string, title: string) {
    await chatApi.renameSession(id, title);
    setAllSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
  }

  async function handleDelete(id: string) {
    await chatApi.deleteSession(id);
    setAllSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); navigate('/chat', { replace: true }); }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setInput('');
    setSending(true);
    setError('');

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `stream-${Date.now()}`;

    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: message }]);
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', streaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getAccessToken();
      const response = await fetch('/api/v1/cyberguard/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ message, sessionId: activeSessionId ?? undefined }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error('Stream request failed');

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
              streamingSessionIdRef.current = event.sessionId;
              setActiveSessionId(event.sessionId);
              navigate(`/chat/${event.sessionId}`, { replace: true });
            }
            if (event.type === 'sources') {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, sources: event.sources } : m));
            }
            if (event.type === 'token') {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: m.content + event.token } : m));
            }
            if (event.type === 'done') {
              setMessages(prev => prev.map(m => m.id === assistantMsgId
                ? { ...m, id: event.messageId ?? m.id, streaming: false, tokens: event.metadata?.tokens ? { total: event.metadata.tokens.total } : undefined }
                : m));
              streamingSessionIdRef.current = null;
              refreshSessions();
            }
            if (event.type === 'error') throw new Error(event.error ?? 'Stream error');
          } catch { }
        }
      }
    } catch (err: any) {
      streamingSessionIdRef.current = null;
      if (err.name === 'AbortError') return;
      setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
      setError(err.message ?? 'Failed to send message.');
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function startNewChat() {
    abortRef.current?.abort();
    streamingSessionIdRef.current = null;
    setActiveSessionId(null);
    setMessages([]);
    navigate('/chat', { replace: true });
  }

  const sidebarContent = (
    <>
      <button className="btn btn-ghost btn-sm new-chat-btn" onClick={startNewChat}>
        + New conversation
      </button>

      <div className="session-search-wrapper">
        <input className="session-search" type="text" placeholder="Search conversations..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button className="session-search-clear" onClick={() => setSearch('')}>✕</button>}
      </div>

      <div className="session-list">
        {sessionsLoading && (
          <>
            {[1,2,3].map(i => <div key={i} className="skeleton skeleton-row" style={{ borderRadius: 8, margin: '0 0 4px' }} />)}
          </>
        )}
        {!sessionsLoading && sessions.length === 0 && search && (
          <p className="session-empty">No conversations match "{search}"</p>
        )}
        {sessions.map(s => (
          <SessionItem key={s.id} session={s} isActive={s.id === activeSessionId}
            onSelect={() => { abortRef.current?.abort(); streamingSessionIdRef.current = null; setActiveSessionId(s.id); navigate(`/chat/${s.id}`); }}
            onRename={handleRename} onDelete={handleDelete} />
        ))}
      </div>
    </>
  );

  return (
    <Layout sidebar={sidebarContent} userEmail={user?.email}>
      <main className="chat-panel">
        <header className="panel-header">
          <div>
            <h1>AI Assistant</h1>
            <p className="panel-subtitle">Grounded in current NDPA/GAID, ISO 27001, and OWASP guidance</p>
          </div>
        </header>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">🛡️</div>
            <h2>CyberGuard AI Assistant</h2>
            <p>Ask me about NDPA/GAID compliance, cybersecurity threats, ISO 27001, data protection, and security best practices for African enterprises.</p>
            <div className="chat-suggestions">
              {['What are the NDPA requirements for a fintech startup?', 'How do I protect against BEC attacks?', 'Create an ISO 27001 gap analysis checklist'].map(s => (
                <button key={s} className="suggestion-chip" onClick={() => setInput(s)}>{s}</button>
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
                  {m.role === 'assistant' && !m.streaming && m.sources && <CitationBlock sources={m.sources} />}
                  <div className="message-actions">
                    {m.role === 'assistant' && !m.streaming && (
                      <><CopyButton text={m.content} />{m.tokens && m.tokens.total > 0 && <span className="message-meta">{m.tokens.total} tokens</span>}</>
                    )}
                    {m.role === 'assistant' && m.streaming && <span className="message-meta streaming-indicator">CyberGuard AI is thinking...</span>}
                    {m.role === 'user' && <CopyButton text={m.content} />}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && <div className="chat-error">{error}</div>}

        <form className="chat-input-bar" onSubmit={handleSend}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
            placeholder="Ask CyberGuard AI anything about cybersecurity..."
            rows={1}
            disabled={sending}
          />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || sending}>
            {sending ? '■' : '↑'}
          </button>
        </form>
      </main>
    </Layout>
  );
}
