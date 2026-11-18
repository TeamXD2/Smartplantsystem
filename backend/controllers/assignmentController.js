const pool = require('../config/db');
const { logActionTx } = require('../utils/auditLog');
const { withTransaction } = require('../utils/transaction');
const { isValidId } = require('../middleware/validateId');

// External Botanist assignments (Conservation Officer / Admin only, see routes/plantRoutes.js).
// An External Botanist sees a plant's full record, photos, history and versions only
// while they are assigned to it (canSeeFullDetail in plantController.js). They are
// assigned automatically to the plants they register; these endpoints let an Officer
// give (or take away) access to any other plant.

async function plantExists(client, plantId) {
  const { rows } = await client.query('SELECT 1 FROM plants WHERE plant_id = $1', [plantId]);
  return rows.length > 0;
}

// GET /api/plants/:id/assignments
// Who is assigned now, and which active External Botanists could still be assigned.
async function listAssignments(req, res) {
  try {
    const { id } = req.params;
    if (!(await plantExists(pool, id))) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const { rows: assigned } = await pool.query(
      `SELECT ba.botanist_id, u.full_name, u.email, u.is_active, ba.assigned_at,
              ab.full_name AS assigned_by_name,
              (p.registered_by = ba.botanist_id) AS registered_plant
       FROM botanist_assignments ba
       JOIN users u ON u.user_id = ba.botanist_id
       JOIN plants p ON p.plant_id = ba.plant_id
       LEFT JOIN users ab ON ab.user_id = ba.assigned_by
       WHERE ba.plant_id = $1
       ORDER BY u.full_name`,
      [id]
    );

    const { rows: available } = await pool.query(
      `SELECT u.user_id, u.full_name, u.email
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE r.role_name = 'Botanist' AND u.botanist_type = 'External' AND u.is_active
         AND NOT EXISTS (SELECT 1 FROM botanist_assignments ba WHERE ba.plant_id = $1 AND ba.botanist_id = u.user_id)
       ORDER BY u.full_name`,
      [id]
    );

    res.json({ assigned, available });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching assignments' });
  }
}

// POST /api/plants/:id/assignments  { botanist_id }
async function assignBotanist(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(req.body.botanist_id)) {
      return res.status(400).json({ error: 'botanist_id must be a user id' });
    }
    const botanistId = Number(req.body.botanist_id);

    // The assignment and its audit entry are saved together.
    const result = await withTransaction(async (client) => {
      if (!(await plantExists(client, id))) return { status: 404, error: 'Plant not found' };

      const { rows: [botanist] } = await client.query(
        `SELECT u.full_name, u.botanist_type, u.is_active, r.role_name
         FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE u.user_id = $1`,
        [botanistId]
      );
      if (!botanist) return { status: 404, error: 'User not found' };
      if (botanist.role_name !== 'Botanist' || botanist.botanist_type !== 'External') {
        return { status: 400, error: 'Only External Botanists are assigned to plants (everyone else already sees every record)' };
      }
      if (!botanist.is_active) return { status: 400, error: 'This account is deactivated' };

      const inserted = await client.query(
        `INSERT INTO botanist_assignments (botanist_id, plant_id, assigned_by) VALUES ($1, $2, $3)
         ON CONFLICT (botanist_id, plant_id) DO NOTHING`,
        [botanistId, id, req.user.user_id]
      );
      if (inserted.rowCount === 0) return { status: 409, error: `${botanist.full_name} is already assigned to this plant` };

      await logActionTx(client, {
        user_id: req.user.user_id,
        action: 'ASSIGN_BOTANIST',
        target_table: 'plants',
        target_id: id,
        details: { botanist_id: botanistId, botanist_name: botanist.full_name }
      });
      return { status: 201, message: `${botanist.full_name} can now see this plant's full record` };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json({ message: result.message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while assigning the botanist' });
  }
}

// DELETE /api/plants/:id/assignments/:botanistId
async function unassignBotanist(req, res) {
  try {
    const { id, botanistId } = req.params;

    const result = await withTransaction(async (client) => {
      const { rows: [removed] } = await client.query(
        `DELETE FROM botanist_assignments ba
         USING users u
         WHERE ba.plant_id = $1 AND ba.botanist_id = $2 AND u.user_id = ba.botanist_id
         RETURNING u.full_name`,
        [id, botanistId]
      );
      if (!removed) return null;

      await logActionTx(client, {
        user_id: req.user.user_id,
        action: 'UNASSIGN_BOTANIST',
        target_table: 'plants',
        target_id: id,
        details: { botanist_id: Number(botanistId), botanist_name: removed.full_name }
      });
      return removed;
    });

    if (!result) return res.status(404).json({ error: 'This botanist is not assigned to this plant' });
    res.json({ message: `${result.full_name} no longer sees this plant's full record` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while removing the assignment' });
  }
}

module.exports = { listAssignments, assignBotanist, unassignBotanist };
