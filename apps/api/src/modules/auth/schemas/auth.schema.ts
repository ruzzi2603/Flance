import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  avatarUrl: z.string().min(3).max(3000000).optional(),
});

export const verifyRegistrationEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export const resendRegistrationEmailSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export const verifyResetCodeSchema = z.object({
  token: z.string().min(10),
  code: z.string().min(4).max(10),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyRegistrationEmailInput = z.infer<typeof verifyRegistrationEmailSchema>;
export type ResendRegistrationEmailInput = z.infer<typeof resendRegistrationEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyResetCodeInput = z.infer<typeof verifyResetCodeSchema>;
