import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';

const ICONS = { page_view: '▢', click: '◉' };

function formatTime(value) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const [state, setState] = useState({ status: 'loading', events: [], error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .getSessionEvents(sessionId)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', events: data.events, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', events: [], error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← All sessions
          </Link>
          <p className="eyebrow">Session journey</p>
          <h1 className="mono break">{sessionId}</h1>
        </div>
      </header>

      {state.status === 'loading' && <Loader label="Fetching events" />}
      {state.status === 'error' && <EmptyState title="Couldn't load this session" description={state.error} />}

      {state.status === 'ready' && (
        <ol className="timeline">
          {state.events.map((evt, idx) => (
            <li className="timeline-item" key={evt._id ? String(evt._id) : idx}>
              <span className={`timeline-icon timeline-icon--${evt.type}`}>{ICONS[evt.type] || '•'}</span>
              <div className="timeline-body">
                <div className="timeline-row">
                  <span className="timeline-type">{evt.type.replace('_', ' ')}</span>
                  <span className="mono timeline-time">{formatTime(evt.timestamp)}</span>
                </div>
                <p className="timeline-path">{evt.path || evt.url}</p>
                {evt.type === 'click' && (
                  <p className="timeline-meta mono">
                    x:{Math.round(evt.x)} y:{Math.round(evt.y)}
                    {evt.targetTag ? ` · <${evt.targetTag}>` : ''}
                    {evt.targetText ? ` "${evt.targetText}"` : ''}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
