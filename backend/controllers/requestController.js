const pool = require('../config/db');
const { logAction } = require('../utils/auditLog');
const { canSeeFullDetail, parseJson } = require('./plantController');
const { validatePlantFields } = require('../utils/validatePlant');
const { pickEditableFields, applyPlantChanges } = require('../utils/plantChanges');

// POST /api/requests
// Botanist submits an EDIT or DELETE request for an existing plant record.
// EDIT requests are for External Botanists - Internal Botanists edit directly
// via PATCH /api/plants/:id. DELETE always needs a request for any Botanist.
async function submitRequest(req, res) {
  try {
    const { plant_id, request_type, proposed_changes } = req.body;

    if (!plant_id || !request_type) {
      return res.status(400).json({ error: 'plant_id and request_type are required' });
    }
    if (!['EDIT', 'DELETE'].includes(request_type)) {
      return res.status(400).json({ error: "request_type must be 'EDIT' or 'DELETE'" });
    }
    if (request_type === 'EDIT' && req.user.botanist_type !== 'External') {
      return res.status(400).json({ error: 'Internal Botanists edit directly via PATCH /api/plants/:id' });
    }

    const [plantRows] = await pool.query(
      'SELECT plant_id, qr_code, scientific_name FROM plants WHERE plant_id = ?',
      [plant_id]
    );
    if (plantRows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }
    const plant = plantRows[0];

    if (!(await canSeeFullDetail(req.user, plant_id))) {
      return res.status(403).json({ error: 'You are not assigned to this plant' });
    }

    let changesToStore = null;
    if (request_type === 'EDIT') {
      if (!proposed_changes || typeof proposed_changes !== 'object') {
        return res.status(400).json({ error: 'proposed_changes object is required for EDIT requests' });
      }
      // Only allow whitelisted fields through
      changesToStore = pickEditableFields(proposed_changes);
      if (Object.keys(changesToStore).length === 0) {
        return res.status(400).json({ error: 'No valid editable fields in proposed_changes' });
      }
      // Validate now, so a bad value is rejected here instead of failing
      // later when an Officer approves it.
      const { errors, values } = validatePlantFields(changesToStore);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('; ') });
      }
      changesToStore = values;
    }

    const [result] = await pool.query(
      `INSERT INTO record_change_requests
        (plant_id, plant_qr_code_snapshot, plant_scientific_name_snapshot,
         request_type, proposed_changes, requested_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        plant_id, plant.qr_code, plant.scientific_name,
        request_type, changesToStore ? JSON.stringify(changesToStore) : null, req.user.user_id
      ]
    );

    await logAction({
      user_id: req.user.user_id,
      action: `REQUEST_${request_type}`,
      target_table: 'plants',
      target_id: plant_id,
      details: { request_id: result.insertId, proposed_changes: changesToStore }
    });

    res.status(201).json({ message: 'Request submitted', request_id: result.insertId, status: 'Pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while submitting request' });
  }
}

// GET /api/requests?status=Pending
// Conservation Officer / Admin view of requests, optionally filtered by status.
async function listRequests(req, res) {
  try {
    const { status } = req.query;

    let query = `
      SELECT r.*, u.full_name AS requested_by_name
      FROM record_change_requests r
      JOIN users u ON r.requested_by = u.user_id
    `;
    const params = [];

    if (status) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }
    query += ' ORDER BY r.requested_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching requests' });
  }
}

// PATCH /api/requests/:id/review
// Conservation Officer approves or rejects a request.
// On approval, actually applies the EDIT/DELETE to the `plants` table.
async function reviewRequest(req, res) {
  const { id } = req.params;
  const { decision, review_comment } = req.body; // decision: 'Approved' | 'Rejected'

  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'Approved' or 'Rejected'" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock the request row so two reviewers can't both approve it.
    const [requestRows] = await connection.query(
      'SELECT * FROM record_change_requests WHERE request_id = ? FOR UPDATE',
      [id]
    );
    if (requestRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Request not found' });
    }
    const request = requestRows[0];

    if (request.status !== 'Pending') {
      await connection.rollback();
      return res.status(409).json({ error: `Request has already been ${request.status}` });
    }

    // Collected here so we can write a detailed audit log AFTER commit.
    let auditDetails = { request_id: id, review_comment: review_comment || null };

    if (decision === 'Approved') {
      if (request.request_type === 'EDIT') {
        const fieldChanges = await applyPlantChanges(
          connection, request.plant_id, parseJson(request.proposed_changes)
        );
        if (!fieldChanges) {
          await connection.rollback();
          return res.status(409).json({ error: 'This plant no longer exists' });
        }
        auditDetails.changes = fieldChanges;
      } else if (request.request_type === 'DELETE') {
        // Capture the full record before it's gone, for the audit trail.
        const [beforeRows] = await connection.query(
          'SELECT * FROM plants WHERE plant_id = ? FOR UPDATE',
          [request.plant_id]
        );
        if (beforeRows.length === 0) {
          await connection.rollback();
          return res.status(409).json({ error: 'This plant no longer exists' });
        }
        auditDetails.deleted_record = beforeRows[0];

        await connection.query('DELETE FROM plants WHERE plant_id = ?', [request.plant_id]);
      }
    }

    await connection.query(
      `UPDATE record_change_requests
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_comment = ?
       WHERE request_id = ?`,
      [decision, req.user.user_id, review_comment || null, id]
    );

    await connection.commit();

    await logAction({
      user_id: req.user.user_id,
      action: `${decision.toUpperCase()}_REQUEST`,
      target_table: 'plants',
      target_id: request.plant_id,
      details: auditDetails
    });

    res.json({ message: `Request ${decision.toLowerCase()}`, request_id: id });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Server error while reviewing request' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { submitRequest, listRequests, reviewRequest };
