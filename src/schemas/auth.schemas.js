import Joi from 'joi';

export const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must only contain letters and numbers.',
      'string.min':      'Username must be at least 3 characters.',
      'string.max':      'Username must be at most 30 characters.',
      'any.required':    'Username is required.',
    }),

  password: Joi.string()
    .min(6)
    .max(72)
    .required()
    .messages({
      'string.min':   'Password must be at least 6 characters.',
      'string.max':   'Password must be at most 72 characters.',
      'any.required': 'Password is required.',
    }),
});

export const loginSchema = Joi.object({
  username: Joi.string().required().messages({
    'any.required': 'Username is required.',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required.',
  }),
});