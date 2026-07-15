import { useState, useEffect } from 'react';

/**
 * Sprint 4.1.4 — for the two operations that can take up to 90 seconds
 * (phishing analysis, policy generation), a static disabled button with
 * unchanging text reads as broken, not busy. Neither backend endpoint
 * streams true progress (both are blocking POST requests, not SSE), so
 * this deliberately does NOT show a fake percentage — that would be
 * dishonest. Instead it cycles through real status messages on a timer,
 * which is an honest, well-established pattern for long AI operations:
 * it signals "still working" without claiming precision we don't have.
 */
export function LoadingIndicator({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % messages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="loading-indicator">
      <div className="loading-indicator-spinner" />
      <span className="loading-indicator-text">{messages[index]}</span>
    </div>
  );
}
