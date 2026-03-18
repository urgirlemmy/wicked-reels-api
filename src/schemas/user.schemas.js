import Joi from 'joi';

export const updateUsernameSchema = Joi.object({
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
    password: Joi.string().required().messages({
    'any.required': 'Password is required.',
  }),
});

export const updateEmailSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Must be a valid email address.',
      'any.required': 'Email is required.',
    }),
    password: Joi.string().required().messages({
    'any.required': 'Password is required.',
  }),
});

export const updatePasswordSchema = Joi.object({
  current_password: Joi.string().required().messages({
    'any.required': 'Current password is required.',
  }),
  new_password: Joi.string().min(6).max(72).required().messages({
    'string.min':   'New password must be at least 6 characters.',
    'string.max':   'New password must be at most 72 characters.',
    'any.required': 'New password is required.',
  }),
});

export const deleteAccountSchema = Joi.object({
  password: Joi.string().required().messages({
    'any.required': 'Password is required.',
  }),
});
