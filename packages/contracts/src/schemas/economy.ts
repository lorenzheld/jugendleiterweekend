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
  name: z.string().optional(),
  ownerType: z.enum(["PLAYER", "TEAM"]).optional(),
  ownerId: z.string().uuid(),
  quantity: z.number().int().optional(),
  slot: ItemSlotSchema,
  isEquipped: z.boolean(),
  isBound: z.boolean(),
  stats: z.record(z.number()).optional(),
  stackable: z.boolean().optional(),
});
export type ItemInstance = z.infer<typeof ItemInstanceSchema>;

export const InventoryListResponseSchema = z.object({
  items: z.array(ItemInstanceSchema),
});
export type InventoryListResponse = z.infer<typeof InventoryListResponseSchema>;

export const EconomySummarySchema = z.object({
  fame: z.number().int(),
  denarii: z.number().int(),
  equippedStats: z.record(z.number()),
  playerCount: z.number().int(),
  teamCount: z.number().int(),
  playerLimit: z.number().int(),
  teamLimit: z.number().int(),
});
export type EconomySummary = z.infer<typeof EconomySummarySchema>;

export const TeamListEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type TeamListEntry = z.infer<typeof TeamListEntrySchema>;

export const TradeRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  receiverTeamId: z.string().uuid(),
  items: z
    .array(
      z.object({
        itemInstanceId: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .optional()
    .default([]),
  currencies: z
    .array(
      z.object({
        currencyType: CurrencyTypeSchema,
        amount: z.number().int(),
      }),
    )
    .optional()
    .default([]),
});
export type TradeRequest = z.infer<typeof TradeRequestSchema>;

export const TradeSideSchema = z.object({
  items: z.array(
    z.object({
      itemInstanceId: z.string().uuid(),
      quantity: z.number().int().min(1),
    }),
  ),
  denarii: z.number().int().nonnegative(),
  itemLabels: z.array(z.string()).optional(),
});
export type TradeSide = z.infer<typeof TradeSideSchema>;

export const TradeOfferSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["OPEN", "ACCEPTED", "REJECTED", "CANCELLED"]),
  initiatorTeamId: z.string().uuid(),
  counterpartyTeamId: z.string().uuid(),
  initiatorName: z.string(),
  counterpartyName: z.string(),
  initiatorPayload: TradeSideSchema,
  counterpartyPayload: TradeSideSchema.nullable(),
  createdAt: z.string(),
});
export type TradeOffer = z.infer<typeof TradeOfferSchema>;

export const TradeOfferListSchema = z.object({
  incoming: z.array(TradeOfferSchema),
  outgoing: z.array(TradeOfferSchema),
});
export type TradeOfferList = z.infer<typeof TradeOfferListSchema>;

export const RewardItemGrantedSchema = z.object({
  defKey: z.string(),
  quantity: z.number().int(),
  owner: z.enum(["PLAYER", "TEAM"]),
});
export type RewardItemGranted = z.infer<typeof RewardItemGrantedSchema>;
