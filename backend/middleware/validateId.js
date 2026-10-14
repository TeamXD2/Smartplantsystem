// Route ids are INT columns in Postgres. A value like "abc" or "99999999999"
// would make Postgres throw (-> 500), so anything that isn't a plain positive
// integer is answered as "not found" before it reaches the database.
// Usage: router.param('id', validateId)
function isValidId(value) {
  return /^[1-9]\d{0,8}$/.test(String(value));
}

function validateId(req, res, next, value) {
  if (!isValidId(value)) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

module.exports = validateId;
module.exports.isValidId = isValidId;
