import { useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export interface AuthUser {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => void;
  getToken: () => Promise<string>;
}

export function useAuth(): AuthState {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const login = useCallback(() => {
    void loginWithRedirect();
  }, [loginWithRedirect]);

  const logout = useCallback(() => {
    void auth0Logout({
      logoutParams: {
        returnTo: `${window.location.origin}/login`,
      },
    });
  }, [auth0Logout]);

  const getToken = useCallback(async () => {
    return getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE as string,
      },
    });
  }, [getAccessTokenSilently]);

  const authUser: AuthUser | null =
    isAuthenticated && user
      ? {
          sub: user.sub ?? "",
          email: user.email ?? "",
          emailVerified: user.email_verified ?? false,
          name: user.name ?? "",
          picture: user.picture ?? "",
        }
      : null;

  return {
    isAuthenticated,
    isLoading,
    user: authUser,
    login,
    logout,
    getToken,
  };
}
