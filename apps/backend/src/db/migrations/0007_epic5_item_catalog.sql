-- Migration 0007: starter item catalog for Epic 5 loot / equip
INSERT INTO item_def (id, key, name, equip_slot, stats, stackable, max_stack, buy_price, sell_price)
VALUES
  (gen_random_uuid(), 'gladius', 'Gladius', 'WEAPON', '{"atk":5}'::jsonb, false, 1, 80, 40),
  (gen_random_uuid(), 'lorica', 'Lorica', 'ARMOR', '{"def":4}'::jsonb, false, 1, 90, 45),
  (gen_random_uuid(), 'fibula', 'Fibula', 'ACCESSORY', '{"luck":1}'::jsonb, false, 1, 40, 20),
  (gen_random_uuid(), 'potion_small', 'Heiltrank', 'CONSUMABLE', '{"heal":20}'::jsonb, true, 99, 15, 8)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  equip_slot = EXCLUDED.equip_slot,
  stats = EXCLUDED.stats,
  stackable = EXCLUDED.stackable,
  max_stack = EXCLUDED.max_stack;
