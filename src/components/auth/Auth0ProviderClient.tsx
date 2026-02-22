// Lazy-loaded wrapper for Auth0Provider.
// @auth0/auth0-spa-js references `self` at module evaluation time,
// so it must be dynamically imported to avoid SSR prerender failures.

import type { ReactNode } from "react";
import { Auth0Provider } from "@auth0/auth0-react";

export default function Auth0ProviderClient({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN as string}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID as string}
      useRefreshTokens
      cacheLocation="localstorage"
      authorizationParams={{
        redirect_uri:
          typeof window !== "undefined" ? window.location.origin : "",
        audience: import.meta.env.VITE_AUTH0_AUDIENCE as string,
        scope: "openid profile email offline_access",
      }}
    >
      {children}
    </Auth0Provider>
  );
}
