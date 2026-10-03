const pool = require('../config/db');
const { logAction } = require('../utils/auditLog');

// GET /api/users  (Admin)
// Lists all accounts so an Admin can find the user_id to manage.
async function listUsers(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, r.role_name, u.botanist_type, u.is_active
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       ORDER BY u.user_id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
}

// PATCH /api/users/:id  (Admin)
// Body (all optional): { is_active, role_name, botanist_type }
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { is_active, role_name, botanist_type } = req.body;

    // An Admin can't deactivate or demote themselves. This also guarantees
    // there is always at least one active Admin left (the one making the call).
    if (Number(id) === req.user.user_id) {
      return res.status(400).json({ error: 'You cannot change your own account status or role' });
    }

    const updates = {};

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'is_active must be true or false' });
      }
      updates.is_active = is_active ? 1 : 0;
    }

    if (role_name !== undefined) {
      const [roleRows] = await pool.query('SELECT role_id FROM roles WHERE role_name = ?', [role_name]);
      if (roleRows.length === 0) {
        return res.status(400).json({ error: 'Invalid role_name' });
      }
      updates.role_id = roleRows[0].role_id;
    }

    if (botanist_type !== undefined) {
      if (botanist_type !== null && !['Internal', 'External'].includes(botanist_type)) {
        return res.status(400).json({ error: "botanist_type must be 'Internal', 'External' or null" });
      }
      updates.botanist_type = botanist_type;
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const [result] = await pool.query(
      `UPDATE users SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE user_id = ?`,
      [...fields.map((f) => updates[f]), id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logAction({
      user_id: req.user.user_id,
      action: 'UPDATE_USER',
      target_table: 'users',
      target_id: id,
      details: { is_active, role_name, botanist_type }
    });

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while updating user' });
  }
}

module.exports = { listUsers, updateUser };
