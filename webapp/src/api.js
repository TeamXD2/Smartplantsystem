// The ONE place the web app talks to the outside world: the backend API.
// (The app never connects to Supabase itself; see the root README.)
//
// Every call goes through api(), which
//   - sends the login session cookie (and, for requests that change data, the CSRF header),
//   - turns failures into an ApiError with a message that is safe to show,
//   - signs the user out if the backend says the session is no longer valid.

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const CSRF_COOKIE = 'sps_csrf';

// The login token is NOT kept by this app. The backend keeps it in an httpOnly cookie that
// JavaScript cannot read, so a script injected into the page cannot steal it, and a page reload
// keeps you signed in. Older versions kept the token in localStorage: remove any left over.
try { localStorage.removeItem('sps_token'); } catch { /* storage blocked */ }

// The backend also sets a second cookie that JavaScript can read. It holds the CSRF value that
// every request changing data must send back in the X-CSRF-Token header. It exists exactly while
// the session does, so it also tells the app whether there is anything to restore after a reload.
function csrfToken() {
  const match = document.cookie.split('; ').find((part) => part.startsWith(CSRF_COOKIE + '='));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

export function hasSession() {
  return csrfToken() !== null;
}

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
  // 'X-Auth-Mode: cookie' asks the backend to keep the login in a cookie (it only matters at login).
  const headers = { 'X-Auth-Mode': 'cookie' };
  const csrf = auth && method !== 'GET' && method !== 'HEAD' ? csrfToken() : null;
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const hadSession = auth && hasSession();

  let payload;
  if (form) {
    payload = form; // the browser sets the multipart Content-Type itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(API_URL + withQuery(path, params), { method, headers, body: payload, credentials: 'include' });
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
    // 401 on a request made with a session = expired session or deactivated account.
    // (The backend has already removed the cookies.)
    if (response.status === 401 && hadSession) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError((data && data.error) || `Request failed (${response.status})`, response.status);
  }
  return data;
}
