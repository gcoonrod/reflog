import { createDB } from "./schema";
import { syncMiddleware, setDbReference } from "./middleware";
import { encryptionMiddleware } from "./encryption";

export { setEncryptionKey, getEncryptionKey } from "./encryption";
export type { ReflogDB } from "./schema";

const db = createDB("ReflogDB");
// Order matters: Dexie stacks middlewares so the LAST registered is
// outermost (closest to application code).  Encryption must be inner
// (registered first) so the outer sync middleware sees plaintext values
// and records them in sync_queue before they are encrypted.
db.use(encryptionMiddleware);
db.use(syncMiddleware);
setDbReference(db);

export default db;
