// API client. One place that knows the base URL, the token rules and the
// error shape. Components call api.* and never touch fetch directly.
//
// Token strategy:
//   - access token lives only in this module's memory (lost on reload, by design)
//   - refresh token lives in localStorage so a reload can silently log back in
//   - on 401 we refresh ONCE and retry ONCE; concurrent 401s share a single
//     refresh promise so the server never sees the same refresh token twice
//     (the API treats a reused refresh token as theft and kills every session)

const BASE = import.meta.env.VITE_API_URL || 'https://job-tracker-api-mh92.onrender.com';
const REFRESH_KEY = 'jobtracker.refreshToken';

let accessToken = null;
let refreshing = null; // the in-flight refresh promise, or null

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function setTokens({ accessToken: a, refreshToken: r }) {
  accessToken = a;
  try {
    localStorage.setItem(REFRESH_KEY, r);
  } catch {
    /* private mode or blocked storage: the session just won't survive reload */
  }
}

export function clearTokens() {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSession() {
  return Boolean(getRefreshToken());
}

async function refresh() {
  if (!refreshing) {
    refreshing = (async () => {
      const rt = getRefreshToken();
      if (!rt) throw new ApiError(401, 'Not logged in');
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        clearTokens();
        throw new ApiError(401, 'Session expired, please log in again');
      }
      setTokens(await res.json());
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function request(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    // After a reload we have a refresh token but no access token yet.
    if (!accessToken && getRefreshToken()) await refresh();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry && getRefreshToken()) {
    await refresh();
    return request(path, { method, body, auth, retry: false });
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error || {};
    throw new ApiError(res.status, err.message || res.statusText, err.details);
  }
  return data;
}

function query(params) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  baseUrl: BASE,

  health: () => fetch(`${BASE}/health`).then((r) => r.json()),

  async register(email, password) {
    const data = await request('/auth/register', { method: 'POST', body: { email, password }, auth: false });
    setTokens(data);
    return data.user;
  },

  async login(email, password) {
    const data = await request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    setTokens(data);
    return data.user;
  },

  async logout() {
    const rt = getRefreshToken();
    clearTokens();
    if (rt) {
      await fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
    }
  },

  me: () => request('/auth/me'),

  listApplications: (params) => request(`/applications${query(params)}`),
  stats: () => request('/applications/stats'),
  getApplication: (id) => request(`/applications/${id}`),
  createApplication: (body) => request('/applications', { method: 'POST', body }),
  updateApplication: (id, body) => request(`/applications/${id}`, { method: 'PATCH', body }),
  deleteApplication: (id) => request(`/applications/${id}`, { method: 'DELETE' }),

  activity: (params) => request(`/activity${query(params)}`),
};
