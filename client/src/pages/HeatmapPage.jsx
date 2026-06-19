import { useEffect, useMemo, useState } from 'react';
import { api, SERVER_BASE } from '../api/client.js';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';

// The path stored on each event is window.location.pathname as recorded on
// the demo page itself (e.g. "/demo/product.html", since that's where the
// backend serves it from) — so it can be appended straight onto the server
// root with no extra mapping.
function resolveDemoUrl(path) {
  return `${SERVER_BASE}${path}`;
}

export default function HeatmapPage() {
  const [pages, setPages] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [pagesStatus, setPagesStatus] = useState('loading');
  const [clicks, setClicks] = useState([]);
  const [clicksStatus, setClicksStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getPages()
      .then((data) => {
        setPages(data.pages);
        setPagesStatus('ready');
        if (data.pages.length > 0) setSelectedPath(data.pages[0].path);
      })
      .catch((err) => {
        setError(err.message);
        setPagesStatus('error');
      });
  }, []);

  useEffect(() => {
    if (!selectedPath) return undefined;
    let cancelled = false;
    setClicksStatus('loading');
    api
      .getHeatmap(selectedPath)
      .then((data) => {
        if (!cancelled) {
          setClicks(data.clicks);
          setClicksStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setClicksStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPath]);

  const demoUrl = useMemo(() => (selectedPath ? resolveDemoUrl(selectedPath) : null), [selectedPath]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Heatmap</p>
          <h1>Where people actually click.</h1>
        </div>
      </header>

      {pagesStatus === 'loading' && <Loader label="Fetching pages" />}
      {pagesStatus === 'error' && <EmptyState title="Couldn't load pages" description={error} />}

      {pagesStatus === 'ready' && pages.length === 0 && (
        <EmptyState title="No pages tracked yet" description="Visit the demo storefront to generate click data." />
      )}

      {pagesStatus === 'ready' && pages.length > 0 && (
        <>
          <div className="page-selector">
            {pages.map((p) => (
              <button
                key={p.path}
                type="button"
                className={`chip${selectedPath === p.path ? ' chip--active' : ''}`}
                onClick={() => setSelectedPath(p.path)}
              >
                {p.path}
                <span className="chip-count">{p.clicks}</span>
              </button>
            ))}
          </div>

          <div className="heatmap-frame">
            {clicksStatus === 'loading' && (
              <div className="heatmap-loading">
                <Loader label="Plotting clicks" />
              </div>
            )}
            {demoUrl && <iframe title="page-preview" src={demoUrl} className="heatmap-iframe" />}
            <div className="heatmap-overlay">
              {clicks.map((c, idx) => (
                <span
                  key={idx}
                  className="heat-dot"
                  style={{ left: `${c.xPercent}%`, top: `${c.yPercent}%` }}
                  title={`${c.targetTag || 'element'}${c.targetText ? `: ${c.targetText}` : ''}`}
                />
              ))}
            </div>
          </div>
          <p className="heatmap-caption mono">
            {clicks.length} clicks plotted · positioned by page-relative percentage, so they stay accurate across
            viewport sizes
          </p>
        </>
      )}
    </div>
  );
}
