import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: [
    "http://localhost:3000",
    "https://reflog.microcode.io",
    "https://reflog-8t5.pages.dev",
  ],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Authorization", "Content-Type"],
  maxAge: 86400,
});
