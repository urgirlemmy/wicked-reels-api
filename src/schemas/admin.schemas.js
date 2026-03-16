import Joi from 'joi';

export const giveSpinsSchema = Joi.object({
  user_id: Joi.string().uuid().required().messages({
    'string.uuid':  'user_id must be a valid UUID.',
    'any.required': 'user_id is required.',
  }),
  amount: Joi.number().integer().min(1).max(1000).required().messages({
    'number.min':   'Amount must be at least 1.',
    'number.max':   'Amount must be at most 1000.',
    'any.required': 'Amount is required.',
  }),
});