import { createContext, useContext, useState, useEffect } from "react";
import {
  getAccessToken,
  clearTokens,
  decodeJWT,
  isTokenExpired,
} from "../utils/tokenStore";
import { login as apiLogin, logout as apiLogout, refreshTokens as apiRefresh } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function applyToken(accessToken) {
    const payload = decodeJWT(accessToken);
    if (payload?.sub) setUser({ username: payload.sub });
  }

  async function login(username, password) {
    const data = await apiLogin(username, password);
    applyToken(data.access_token);
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  useEffect(() => {
    async function init() {
      const at = getAccessToken();
      if (at && !isTokenExpired(at)) {
        applyToken(at);
      } else {
        try {
          const accessToken = await apiRefresh();
          applyToken(accessToken);
        } catch {
          clearTokens();
        }
      }
      setLoading(false);
    }

    init();

    // Interceptor fires this when refresh fails mid-session
    const handler = () => setUser(null);
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
