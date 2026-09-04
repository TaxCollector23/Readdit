/**
 * Verifies a Firebase ID token without requiring a service account,
 * using Firebase's public JWKS endpoint to verify the JWT signature.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? "";

const JWKS = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

export interface FirebaseClaims {
  uid: string;
  email?: string;
}

export async function verifyFirebaseToken(token: string): Promise<FirebaseClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    const uid = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    if (!uid) return null;
    return { uid, email };
  } catch {
    return null;
  }
}
