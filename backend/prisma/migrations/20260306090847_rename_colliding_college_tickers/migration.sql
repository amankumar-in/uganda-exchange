-- Rename college coin tickers that collide with Coinbase token symbols
UPDATE "tokens" SET "symbol" = 'BOLTC' WHERE "symbol" = 'BTC' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'ERWTC' WHERE "symbol" = 'ETC' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'ETHZR' WHERE "symbol" = 'ETH' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'FRTIL' WHERE "symbol" = 'FIL' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'GRSTH' WHERE "symbol" = 'GST' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'LKTCH' WHERE "symbol" = 'LTC' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'MNTRL' WHERE "symbol" = 'MON' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'SPBKE' WHERE "symbol" = 'SEI' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'SACUI' WHERE "symbol" = 'SUI' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'ULTMA' WHERE "symbol" = 'UMA' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'UNOIA' WHERE "symbol" = 'UNI' AND "isCollegeCoin" = true;
UPDATE "tokens" SET "symbol" = 'UNPAC' WHERE "symbol" = 'UP' AND "isCollegeCoin" = true;