import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../index";

interface AuthContext {
  auth0Sub: string;
  email: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(domain: string): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${domain}/.well-known/jwks.json`)
    );
  }
  return jwks;
}

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return c.json(
      { error: "unauthorized", message: "Missing or invalid Authorization header" },
      401
    );
  }

  const token = authorization.slice(7);

  try {
    const { payload } = await jwtVerify(
      token,
      getJWKS(c.env.AUTH0_DOMAIN),
      {
        audience: c.env.AUTH0_AUDIENCE,
        issuer: `https://${c.env.AUTH0_DOMAIN}/`,
      }
    );

    if (!payload.sub) {
      return c.json(
        { error: "unauthorized", message: "Token missing sub claim" },
        401
      );
    }

    const email =
      (payload["https://reflog.app/claims/email"] as string) ??
      (payload.email as string) ??
      "";

    c.set("auth", {
      auth0Sub: payload.sub,
      email,
    });

    await next();
  } catch {
    return c.json(
      { error: "unauthorized", message: "Invalid or expired token" },
      401
    );
  }
});
