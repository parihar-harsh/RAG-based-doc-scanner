const { z } = require('zod');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function normalizeName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

const passwordSchema = z
  .string({ error: 'Password is required.' })
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`)
  .refine((value) => !/^\s|\s$/.test(value), 'Password cannot start or end with a space.')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'Password must include at least one letter and one number.');

const signupSchema = z.object({
  name: z
    .preprocess(normalizeName, z
      .string({ error: 'Name is required.' })
      .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters.`)
      .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer.`)),
  email: z
    .preprocess(normalizeEmail, z
      .string({ error: 'Email is required.' })
      .max(254, 'Enter a valid email address.')
      .regex(EMAIL_RE, 'Enter a valid email address.')),
  password: passwordSchema,
}).strict();

const loginSchema = z.object({
  email: z
    .preprocess(normalizeEmail, z
      .string({ error: 'Email is required.' })
      .max(254, 'Invalid email or password.')
      .regex(EMAIL_RE, 'Invalid email or password.')),
  password: z
    .string({ error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(MAX_PASSWORD_LENGTH, 'Invalid email or password.'),
}).strict();

function firstZodMessage(result) {
  return result.error?.issues?.[0]?.message || 'Invalid request.';
}

module.exports = {
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  signupSchema,
  loginSchema,
  firstZodMessage,
  normalizeName,
  normalizeEmail,
};
