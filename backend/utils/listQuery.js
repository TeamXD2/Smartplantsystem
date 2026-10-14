// Shared helpers for list endpoints (?search=&page=&limit=).

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Reads ?page= and ?limit= (both optional). Returns { page, limit, offset }
// or { error } for values that aren't sensible whole numbers.
function parsePaging(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    return { error: 'page must be a whole number of 1 or more' };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `limit must be a whole number from 1 to ${MAX_LIMIT}` };
  }
  return { page, limit, offset: (page - 1) * limit };
}

// Turns a search box value into an ILIKE pattern ("%pitcher%"). % and _ typed
// by the user are matched literally instead of acting as wildcards.
// Use with: column ILIKE $n ESCAPE '\'
function likePattern(search) {
  const escaped = String(search).trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

module.exports = { parsePaging, likePattern, MAX_LIMIT };
