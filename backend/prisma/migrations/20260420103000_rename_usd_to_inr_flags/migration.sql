-- Rename USD-quote trading flag to INR on tokens and global_asset_settings.
-- Existing true/false values are preserved (a token that allowed USD trading now allows INR trading).
ALTER TABLE "tokens" RENAME COLUMN "allowTradeUsd" TO "allowTradeInr";
ALTER TABLE "global_asset_settings" RENAME COLUMN "defaultAllowTradeUsd" TO "defaultAllowTradeInr";
