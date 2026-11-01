const pool = require('../config/db');
const { parsePaging } = require('../utils/listQuery');

// GET /api/audit-logs?action=&user_id=&page=&limit=  (Admin)
// Every action the backend records (logins, plant changes, approvals,
// account changes...), newest first.
async function listAuditLogs(req, res) {
  try {
    const paging = parsePaging(req.query);
    if (paging.error) return res.status(400).json({ error: paging.error });

    const params = [];
    const conditions = [];
    if (req.query.action) {
      if (typeof req.query.action !== 'string' || !/^[A-Z_]{1,100}$/.test(req.query.action)) {
        return res.status(400).json({ error: 'action must be an action name like LOGIN' });
      }
      params.push(req.query.action);
      conditions.push(`l.action = $${params.length}`);
    }
    if (req.query.user_id) {
      const userId = Number(req.query.user_id);
      if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'user_id must be a number' });
      params.push(userId);
      conditions.push(`l.user_id = $${params.length}`);
    }
    params.push(paging.limit, paging.offset);

    const { rows } = await pool.query(
      `SELECT l.log_id, l.user_id, u.full_name AS user_name, u.email AS user_email, l.action,
              l.target_table, l.target_id, l.details, l.created_at,
              COUNT(*) OVER () AS total
       FROM audit_logs l
       LEFT JOIN users u ON u.user_id = l.user_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY l.created_at DESC, l.log_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const { rows: actions } = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');

    res.json({
      logs: rows.map(({ total, ...log }) => log),
      total: rows.length ? Number(rows[0].total) : 0,
      page: paging.page,
      limit: paging.limit,
      actions: actions.map((a) => a.action)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching the audit log' });
  }
}

module.exports = { listAuditLogs };
