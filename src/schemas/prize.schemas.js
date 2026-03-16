import Joi from 'joi';

export const createPrizeSchema = Joi.object({
  code: Joi.string()
    .alphanum()
    .uppercase()
    .min(2)
    .max(20)
    .required()
    .messages({
      'string.alphanum': 'Code must be alphanumeric.',
      'string.min':      'Code must be at least 2 characters.',
      'string.max':      'Code must be at most 20 characters.',
      'any.required':    'Code is required.',
    }),

  full_name: Joi.string().min(1).max(100).required().messages({
    'any.required': 'Full name is required.',
  }),

  emoji: Joi.string().max(10).default('🎁'),

  rarity: Joi.string()
    .valid('common', 'uncommon', 'legendary')
    .default('common')
    .messages({
      'any.only': 'Rarity must be common, uncommon, or legendary.',
    }),

  weight: Joi.number().integer().min(1).max(1000).default(10).messages({
    'number.min': 'Weight must be at least 1.',
    'number.max': 'Weight must be at most 1000.',
  }),
});

export const updatePrizeSchema = Joi.object({
  full_name: Joi.string().min(1).max(100),
  emoji:     Joi.string().max(10),
  rarity:    Joi.string().valid('common', 'uncommon', 'legendary'),
  weight:    Joi.number().integer().min(1).max(1000),
  is_active: Joi.boolean(),
}).min(1).messages({
  'object.min': 'At least one field must be provided.',
});