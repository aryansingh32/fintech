import { StaffRole } from '../types/enums';

export interface DecodedAccessToken {
  sub: string;
  subjectType: 'CUSTOMER' | 'STAFF';
  sessionId: string;
  role?: StaffRole;
  branchId?: string | null;
  isGlobal?: boolean;
  exp: number;
}

/**
 * Client-side JWT payload decode for UI purposes ONLY (e.g. "which screens
 * should this role see"). This does NOT verify the signature and must never
 * be treated as an authorization decision - the backend's AccessGuard is
 * the only thing that actually enforces role/permission/branch checks
 * (blueprint #41). A tampered token decoded here might show the wrong menu
 * item; it can never grant a call the server would otherwise reject.
 */
export function decodeAccessTokenForDisplay(accessToken: string): DecodedAccessToken | null {
  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) return null;
    const json = base64UrlDecode(payloadSegment);
    return JSON.parse(json) as DecodedAccessToken;
  } catch {
    return null;
  }
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64url -> UTF-8 string, implemented from scratch rather than relying
 * on `atob`/`Buffer` - neither is guaranteed to exist in a React Native
 * (Hermes) runtime without a polyfill, and this package is shared by both
 * a Node backend context (tests) and both RN apps.
 */
function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');

  let bytes: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;
  for (const char of normalized) {
    if (char === '=') break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes.push((buffer >> bitsCollected) & 0xff);
    }
  }

  // Bytes are UTF-8 - decode via TextDecoder when available (RN/modern JS),
  // falling back to a manual decode for older/limited environments.
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }
  return decodeUtf8Bytes(bytes);
}

function decodeUtf8Bytes(bytes: number[]): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
    } else if (byte1 >> 5 === 0x6) {
      const byte2 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte1 >> 4 === 0xe) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0xf) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
    } else {
      i += 3;
    }
  }
  return result;
}
