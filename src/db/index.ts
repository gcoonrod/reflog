import { createDB } from "./schema";
import { syncMiddleware, setDbReference } from "./middleware";
import { encryptionMiddleware } from "./encryption";

export { setEncryptionKey, getEncryptionKey } from "./encryption";
export type { ReflogDB } from "./schema";

const db = createDB("ReflogDB");
// Order matters: sync middleware BEFORE encryption middleware
// so it captures plaintext for sync_queue payloads (see quickstart § A1)
db.use(syncMiddleware);
db.use(encryptionMiddleware);
setDbReference(db);

export default db;
