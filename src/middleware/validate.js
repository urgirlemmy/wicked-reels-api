import Joi from 'joi';

/**
 * Returns an Express middleware that validates req.body against a Joi schema.
 * On failure, responds 400 with a clear error message.
 * On success, replaces req.body with the validated (and sanitized) value.
 */
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,    // return all errors, not just the first
      stripUnknown: true,   // strip fields not in schema
    });

    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({
        error: 'Validation failed.',
        details: messages,
      });
    }

    req.body = value;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,      // converts "20" string → 20 number from query string
    });

    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({
        error: 'Validation failed.',
        details: messages,
      });
    }

    req.query = value;
    next();
  };
}