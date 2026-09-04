import { z } from "zod";

export const RoleSchema = z.enum(["PLAYER", "GM", "ADMIN"]);
export type Role = z.infer<typeof RoleSchema>;

export const LoginRequestSchema = z.object({
  accessCode: z.string().min(4).max(64),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  account: z.object({
    id: z.string().uuid(),
    username: z.string(),
    role: RoleSchema,
  }),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
