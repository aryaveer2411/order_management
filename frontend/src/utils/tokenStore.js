let _accessToken = null;

export function getAccessToken() {
  return _accessToken;
}

export function setTokens(accessToken) {
  _accessToken = accessToken;
}

export function clearTokens() {
  _accessToken = null;
}

export function decodeJWT(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = decodeJWT(token);
  return !payload?.exp || payload.exp * 1000 < Date.now();
}
