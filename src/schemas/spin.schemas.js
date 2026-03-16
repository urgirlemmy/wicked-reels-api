import Joi from 'joi';

export const spinHistoryQuerySchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'Limit must be at least 1.',
      'number.max': 'Limit must be at most 100.',
    }),

  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Offset must be 0 or greater.',
    }),
});