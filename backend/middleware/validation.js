import { getDb } from '../utils/db.js';

// Validation error helper
export function validationError(res, message) {
  return res.status(400).json({ error: message });
}

// Not found error helper
export function notFoundError(res, message) {
  return res.status(404).json({ error: message });
}

// Validate required fields middleware factory
export function requireFields(...fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null) {
        return validationError(res, `${field} is required`);
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        return validationError(res, `${field} cannot be empty`);
      }
    }
    next();
  };
}

// Validate that a name field is present and not empty
export function requireName(req, res, next) {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return validationError(res, 'Name is required');
  }
  next();
}

// Validate phase_id exists and belongs to user
export async function validatePhaseId(req, res, next) {
  const phaseId = req.body.phase_id ?? req.body.phaseId;
  if (phaseId === undefined || phaseId === null) {
    return next(); // phase_id is optional in many cases
  }

  try {
    const db = await getDb();
    const phase = await db.get(
      'SELECT id FROM phases WHERE id = ? AND user_id = ?',
      [phaseId, req.userId]
    );
    if (!phase) {
      return validationError(res, 'Invalid phase_id');
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Validate required phase_id
export async function requirePhaseId(req, res, next) {
  const phaseId = req.body.phase_id ?? req.body.phaseId;
  if (phaseId === undefined || phaseId === null) {
    return validationError(res, 'phase_id is required');
  }

  try {
    const db = await getDb();
    const phase = await db.get(
      'SELECT id FROM phases WHERE id = ? AND user_id = ?',
      [phaseId, req.userId]
    );
    if (!phase) {
      return validationError(res, 'Invalid phase_id');
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Validate location_id exists and belongs to user (optional field)
export async function validateLocationId(req, res, next) {
  const locationId = req.body.location_id ?? req.body.locationId;
  if (locationId === undefined || locationId === null) {
    return next(); // location_id is optional
  }

  try {
    const db = await getDb();
    const location = await db.get(
      'SELECT id FROM locations WHERE id = ? AND user_id = ?',
      [locationId, req.userId]
    );
    if (!location) {
      return validationError(res, 'Invalid location_id');
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Validate material type
export function validateMaterialType(req, res, next) {
  const { type } = req.body;
  if (type !== undefined && !['clay', 'glaze', 'other'].includes(type)) {
    return validationError(res, 'Material type must be one of: clay, glaze, other');
  }
  next();
}

// Validate material_ids array (optional field)
export async function validateMaterialIds(req, res, next) {
  const materialIds = req.body.material_ids ?? req.body.materialIds;
  if (!materialIds || !Array.isArray(materialIds) || materialIds.length === 0) {
    return next(); // material_ids is optional
  }

  try {
    const db = await getDb();
    for (const materialId of materialIds) {
      const material = await db.get(
        'SELECT id FROM materials WHERE id = ? AND user_id = ?',
        [materialId, req.userId]
      );
      if (!material) {
        return validationError(res, `Invalid material_id: ${materialId}`);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
