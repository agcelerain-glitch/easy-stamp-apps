import { SignJWT, jwtVerify } from "jose";

const secret = process.env.DEV_SESSION_SECRET;
if (!secret) {
  throw new Error(
    "[dev-session] DEV_SESSION_SECRET が設定されていません。Vercel 環境変数または .env.local に設定してください。"
  );
}
const SECRET = new TextEncoder().encode(secret);
const COOKIE_NAME = "dev_token";
const TTL_SECONDS = 60 * 60 * 8; // 8時間

export async function signDevToken(): Promise<string> {
  return new SignJWT({ role: "dev" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifyDevToken(
  token: string
): Promise<{ role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.role !== "dev") return null;
    return { role: "dev" };
  } catch {
    return null;
  }
}

export { COOKIE_NAME as DEV_COOKIE_NAME, TTL_SECONDS as DEV_TTL_SECONDS };
