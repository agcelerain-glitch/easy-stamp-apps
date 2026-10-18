import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "dev_token";
const TTL_SECONDS = 60 * 60 * 8; // 8時間

// トップレベルで throw するとビルドの page data 収集時に失敗するため、
// シークレットの解決は呼び出し時まで遅延させる。
function getSecret(): Uint8Array {
  const secret = process.env.DEV_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "[dev-session] DEV_SESSION_SECRET が設定されていません。Vercel 環境変数または .env.local に設定してください。"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signDevToken(): Promise<string> {
  return new SignJWT({ role: "dev" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyDevToken(
  token: string
): Promise<{ role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "dev") return null;
    return { role: "dev" };
  } catch {
    return null;
  }
}

export { COOKIE_NAME as DEV_COOKIE_NAME, TTL_SECONDS as DEV_TTL_SECONDS };
