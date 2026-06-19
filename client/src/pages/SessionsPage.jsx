import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusDot from '../components/StatusDot.jsx';

const LIVE_WINDOW_MS = 5 * 60 * 1000;

function formatDuration(ms) {
  if (!ms || ms < 1000) return '<1s';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  return `${minutes}m ${remSeconds}s`;
}

function formatTime(value) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function SessionsPage() {
  const [state, setState] = useState({ status: 'loading', sessions: [], error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .getSessions(1, 50)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', sessions: data.sessions, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', sessions: [], error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Sessions</p>
          <h1>Every visit, in order.</h1>
        </div>
      </header>

      {state.status === 'loading' && <Loader label="Fetching sessions" />}

      {state.status === 'error' && <EmptyState title="Couldn't load sessions" description={state.error} />}

      {state.status === 'ready' && state.sessions.length === 0 && (
        <EmptyState
          title="No sessions yet"
          description="Open the demo storefront with the tracker installed, click around, then come back here."
        />
      )}

      {state.status === 'ready' && state.sessions.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th aria-label="status"></th>
                <th>Session</th>
                <th>Events</th>
                <th>Pages</th>
                <th>Clicks</th>
                <th>First seen</th>
                <th>Last seen</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {state.sessions.map((s) => {
                const isLive = Date.now() - new Date(s.lastSeen).getTime() < LIVE_WINDOW_MS;
                return (
                  <tr key={s.sessionId}>
                    <td>
                      <StatusDot active={isLive} />
                    </td>
                    <td>
                      <Link className="mono-link" to={`/sessions/${s.sessionId}`}>
                        {s.sessionId.length > 20 ? `${s.sessionId.slice(0, 20)}…` : s.sessionId}
                      </Link>
                    </td>
                    <td>{s.eventCount}</td>
                    <td>{s.pagesVisited}</td>
                    <td>{s.clickCount}</td>
                    <td className="mono">{formatTime(s.firstSeen)}</td>
                    <td className="mono">{formatTime(s.lastSeen)}</td>
                    <td className="mono">{formatDuration(s.durationMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
