import { Prisma } from '@prisma/client';

/**
 * Every money field in the schema is a Decimal(14,2). Decimal.js's default
 * JSON serialization drops trailing zeros (18000 instead of 18000.00), which
 * is exactly the kind of inconsistency the blueprint warns against for a
 * money UI. Patching toJSON once, at process start, is the only way to make
 * every controller response consistent without hand-formatting every field.
 * Side-effecting import - must run before any response is serialized.
 */
Prisma.Decimal.prototype.toJSON = function toJSON(this: Prisma.Decimal) {
  return this.toFixed(2);
};
