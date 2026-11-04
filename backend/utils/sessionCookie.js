const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Cookie sessions for the web app.
//
// The web app signs in with the header "X-Auth-Mode: cookie". The backend then puts the login
// token in an httpOnly cookie (JavaScript on the page cannot read it, so a script injected into
// the page cannot steal it) and does not return it in the response body. The mobile app, Postman
// and the sensor boards do not send that header and keep using "Authorization: Bearer <token>".
//
// A browser attaches a cookie to every request to the API by itself, so a cookie session also
// needs CSRF protection (see middleware/auth.js): every request that changes data must carry an
// X-CSRF-Token header that matches the session. The matching value is also handed to the page in
// a second cookie that JavaScript can read, because a page of another website cannot read it.
const SESSION_COOKIE = 'sps_session';
const CSRF_COOKIE = 'sps_csrf';

const SAME_SITE = ['strict', 'lax', 'none'].includes((process.env.COOKIE_SAMESITE || '').toLowerCase())
  ? process.env.COOKIE_SAMESITE.toLowerCase()
  : 'strict';
// SameSite=None is only accepted by browsers together with Secure, so it forces it.
const SECURE = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true' || SAME_SITE === 'none';

// Reads the Cookie header into { name: value }. A malformed value is skipped.
function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    let value = part.slice(i + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      if (!(name in out)) out[name] = decodeURIComponent(value);
    } catch {
      // ignore a cookie with broken encoding
    }
  }
  return out;
}

// The CSRF value for one session: a keyed hash of the session token. Another website can neither
// read nor guess it, and it changes whenever the session token does.
function csrfFor(sessionToken) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update('csrf:' + sessionToken).digest('hex');
}

function csrfMatches(sessionToken, supplied) {
  if (typeof supplied !== 'string') return false;
  const expected = Buffer.from(csrfFor(sessionToken));
  const given = Buffer.from(supplied);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// True when the request asks for a cookie session instead of a token in the response body.
function wantsCookie(req) {
  return req.get('X-Auth-Mode') === 'cookie';
}

function baseOptions() {
  return { secure: SECURE, sameSite: SAME_SITE, path: '/' };
}

// Sets the session cookie and its CSRF companion. Both last exactly as long as the token.
function setSessionCookies(res, token) {
  const exp = jwt.decode(token)?.exp;
  const maxAge = exp ? Math.max(0, exp * 1000 - Date.now()) : undefined;
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(), httpOnly: true, maxAge });
  res.cookie(CSRF_COOKIE, csrfFor(token), { ...baseOptions(), httpOnly: false, maxAge });
}

// Re-issues only the CSRF companion (for a session that is still valid, see GET /api/auth/me).
function refreshCsrfCookie(res, token) {
  const exp = jwt.decode(token)?.exp;
  const maxAge = exp ? Math.max(0, exp * 1000 - Date.now()) : undefined;
  res.cookie(CSRF_COOKIE, csrfFor(token), { ...baseOptions(), httpOnly: false, maxAge });
}

function clearSessionCookies(res) {
  res.clearCookie(SESSION_COOKIE, { ...baseOptions(), httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...baseOptions(), httpOnly: false });
}

module.exports = {
  SESSION_COOKIE, parseCookies, csrfMatches, wantsCookie,
  setSessionCookies, refreshCsrfCookie, clearSessionCookies
};
