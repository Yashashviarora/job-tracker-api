const { z } = require('zod');

const email = z.email().max(255).transform((e) => e.trim().toLowerCase());
const password = z.string().min(8).max(128);

const registerSchema = z.object({ email, password }).strict();
const loginSchema = z.object({ email, password }).strict();
const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

module.exports = { registerSchema, loginSchema, refreshSchema };
