/**
 * Creates a signed-looking JWT with the given payload for testing purposes.
 * The token is structurally valid (3 dot-separated parts, base64url payload)
 * but not cryptographically signed.
 */
export function makeJWT(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${body}.test-signature`;
}

/** A JWT whose exp is far in the future. */
export const VALID_TOKEN = makeJWT({ sub: 'testuser', exp: 9999999999 });

/** A JWT that is already expired. */
export const EXPIRED_TOKEN = makeJWT({ sub: 'testuser', exp: 1 });
