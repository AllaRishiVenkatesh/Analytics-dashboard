import { Routes, Route, NavLink } from 'react-router-dom';
import SessionsPage from './pages/SessionsPage.jsx';
import SessionDetailPage from './pages/SessionDetailPage.jsx';
import HeatmapPage from './pages/HeatmapPage.jsx';

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Pulse</span>
        </div>
        <p className="brand-sub">session analytics</p>

        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-index">01</span> Sessions
          </NavLink>
          <NavLink to="/heatmap" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-index">02</span> Heatmap
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <p>CausalFunnel — Full Stack assignment</p>
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<SessionsPage />} />
          <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
          <Route path="/heatmap" element={<HeatmapPage />} />
        </Routes>
      </main>
    </div>
  );
}
