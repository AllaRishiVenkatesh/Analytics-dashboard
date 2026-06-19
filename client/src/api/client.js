const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
export const SERVER_BASE = import.meta.env.VITE_SERVER_BASE_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch (e) {
      // response wasn't JSON — keep the generic message
    }
    throw new Error(message);
  }

  return res.json();
}

export const api = {
  getSessions: (page = 1, limit = 50) => request(`/sessions?page=${page}&limit=${limit}`),
  getSessionEvents: (sessionId) => request(`/sessions/${encodeURIComponent(sessionId)}/events`),
  getHeatmap: (path) => request(`/heatmap?path=${encodeURIComponent(path)}`),
  getPages: () => request('/pages')
};
