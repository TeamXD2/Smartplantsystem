// The ONE place the web app talks to the outside world: the backend API.
// (The app never connects to Supabase itself; see the root README.)
//
// Every call goes through api(), which
//   - adds the login token,
//   - turns failures into an ApiError with a message that is safe to show,
//   - signs the user out if the backend says the token is no longer valid.

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const TOKEN_KEY = 'sps_token';

// The token lives in localStorage so a page reload keeps you signed in.
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function withQuery(path, params) {
  if (!params) return path;
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  });
  const text = qs.toString();
  return text ? `${path}?${text}` : path;
}

// options: { method, body (JSON object), form (FormData), params (query string), auth (default true) }
export async function api(path, { method = 'GET', body, form, params, auth = true } = {}) {
  const headers = {};
  const token = auth ? tokenStore.get() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // the browser sets the multipart Content-Type itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(API_URL + withQuery(path, params), { method, headers, body: payload });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and that the backend is running.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // empty or non-JSON body
  }

  if (!response.ok) {
    // 401 on a request that carried a token = expired token or deactivated account.
    if (response.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError((data && data.error) || `Request failed (${response.status})`, response.status);
  }
  return data;
}
