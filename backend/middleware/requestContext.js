const { AsyncLocalStorage } = require('async_hooks');

// Remembers who is calling for the duration of a request, so the audit log can record the
// IP address and the device (browser or app) of every action without each controller having
// to pass them along. utils/auditLog.js reads it.
const storage = new AsyncLocalStorage();

// Control characters are removed so a crafted User-Agent cannot mess up a log view.
const clean = (value, max) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) || null;

function requestContext(req, res, next) {
  storage.run({ ip: clean(req.ip, 45), userAgent: clean(req.get('User-Agent'), 255) }, next);
}

function currentContext() {
  return storage.getStore() || { ip: null, userAgent: null };
}

module.exports = { requestContext, currentContext };
