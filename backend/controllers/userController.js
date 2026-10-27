const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { logAction } = require('../utils/auditLog');
const { validatePassword } = require('../utils/validateAccount');

// GET /api/users  (Admin)
// Lists all accounts so an Admin can find the user_id to manage.
async function listUsers(req, res) {
  try {
    const { rows } = await pool.query(
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
      updates.is_active = is_active;
    }

    if (role_name !== undefined) {
      const { rows: roleRows } = await pool.query('SELECT role_id FROM roles WHERE role_name = $1', [role_name]);
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

    // A Botanist always needs a type (without one they'd get Internal rights), and
    // other roles never have one - checked against what the account will look like after the change.
    if (role_name !== undefined || botanist_type !== undefined) {
      const { rows: currentRows } = await pool.query(
        `SELECT r.role_name, u.botanist_type
         FROM users u JOIN roles r ON u.role_id = r.role_id
         WHERE u.user_id = $1`,
        [id]
      );
      if (currentRows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const finalRole = role_name !== undefined ? role_name : currentRows[0].role_name;
      const finalType = botanist_type !== undefined ? botanist_type : currentRows[0].botanist_type;

      if (finalRole === 'Botanist' && !finalType) {
        return res.status(400).json({ error: "botanist_type ('Internal' or 'External') is required for Botanists" });
      }
      if (finalRole !== 'Botanist') {
        if (botanist_type) {
          return res.status(400).json({ error: 'botanist_type only applies to Botanists' });
        }
        updates.botanist_type = null; // moving away from Botanist clears the type
      }
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const result = await pool.query(
      `UPDATE users SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE user_id = $${fields.length + 1}`,
      [...fields.map((f) => updates[f]), id]
    );
    if (result.rowCount === 0) {
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

// POST /api/users/:id/reset-password  (Admin)
// Body: { new_password } - a temporary password the Admin gives the person
// privately (there is no email service). Admins change their own password
// with PATCH /api/auth/password instead.
async function resetPassword(req, res) {
  try {
    const { id } = req.params;
    const { new_password } = req.body || {};
    if (Number(id) === req.user.user_id) {
      return res.status(400).json({ error: 'Use "Change password" for your own account' });
    }
    const invalid = validatePassword(new_password);
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }
    const password_hash = await bcrypt.hash(new_password, 10);
    const result = await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [password_hash, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    await logAction({ user_id: req.user.user_id, action: 'RESET_PASSWORD', target_table: 'users', target_id: id });
    res.json({ message: 'Password reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while resetting the password' });
  }
}

module.exports = { listUsers, updateUser, resetPassword };
