import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.ADMIN_SESSION_SECRET ?? "fallback-secret-change-in-production"
);
const COOKIE_NAME = "admin_token";
const TTL_SECONDS = 60 * 60 * 8; // 8時間

export async function signAdminToken(pointId: number): Promise<string> {
  return new SignJWT({ point_id: pointId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifyAdminToken(
  token: string
): Promise<{ point_id: number } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { point_id: payload.point_id as number };
  } catch {
    return null;
  }
}

export { COOKIE_NAME as ADMIN_COOKIE_NAME };
