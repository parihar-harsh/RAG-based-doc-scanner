import { z } from 'zod';

export const MAX_NAME_LENGTH = 80;
export const MAX_PASSWORD_LENGTH = 128;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

const passwordSchema = z
  .string({ error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(MAX_PASSWORD_LENGTH, `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`)
  .refine((value) => !/^\s|\s$/.test(value), 'Password cannot start or end with a space.')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'Password must include at least one letter and one number.');

export const signupFormSchema = z
  .object({
    name: z.preprocess(normalizeName, z
      .string({ error: 'Name is required.' })
      .min(2, 'Name must be at least 2 characters.')
      .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer.`)),
    email: z.preprocess(normalizeEmail, z
      .string({ error: 'Email is required.' })
      .max(254, 'Enter a valid email address.')
      .regex(EMAIL_RE, 'Enter a valid email address.')),
    password: passwordSchema,
    confirmPassword: z.string({ error: 'Confirm your password.' }).min(1, 'Confirm your password.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const loginFormSchema = z.object({
  email: z.preprocess(normalizeEmail, z
    .string({ error: 'Email is required.' })
    .max(254, 'Enter a valid email address.')
    .regex(EMAIL_RE, 'Enter a valid email address.')),
  password: z
    .string({ error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(MAX_PASSWORD_LENGTH, `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`),
});

export function firstZodMessage(result) {
  return result.error?.issues?.[0]?.message || 'Invalid form input.';
}
