import { z } from "zod";

export const CurrencyTypeSchema = z.enum(["FAME", "DENARII"]);
export type CurrencyType = z.infer<typeof CurrencyTypeSchema>;

export const LedgerSourceSchema = z.enum([
  "QUEST",
  "COMBAT",
  "TRADE",
  "STORE",
  "ADMIN",
]);
export type LedgerSource = z.infer<typeof LedgerSourceSchema>;

export const LedgerEntrySchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  playerId: z.string().uuid().nullable(),
  currencyType: CurrencyTypeSchema,
  amount: z.number().int(),
  source: LedgerSourceSchema,
  idempotencyKey: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const ItemSlotSchema = z.enum([
  "WEAPON",
  "ARMOR",
  "ACCESSORY",
  "CONSUMABLE",
]);
export type ItemSlot = z.infer<typeof ItemSlotSchema>;

export const ItemInstanceSchema = z.object({
  id: z.string().uuid(),
  definitionId: z.string(),
  ownerId: z.string().uuid(),
  slot: ItemSlotSchema,
  isEquipped: z.boolean(),
  isBound: z.boolean(),
});
export type ItemInstance = z.infer<typeof ItemInstanceSchema>;
