import { createDB } from "./schema";
import { encryptionMiddleware } from "./encryption";

export { setEncryptionKey, getEncryptionKey } from "./encryption";
export type { ReflogDB } from "./schema";

const db = createDB("ReflogDB");
db.use(encryptionMiddleware);

export default db;
