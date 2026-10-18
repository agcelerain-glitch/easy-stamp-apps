import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "admin_token";
const TTL_SECONDS = 60 * 60 * 8; // 8時間

// トップレベルで throw するとビルドの page data 収集時に失敗するため、
// シークレットの解決は呼び出し時まで遅延させる。
function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "[admin-session] ADMIN_SESSION_SECRET が設定されていません。Vercel 環境変数または .env.local に設定してください。"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(pointId: number): Promise<string> {
  return new SignJWT({ point_id: pointId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyAdminToken(
  token: string
): Promise<{ point_id: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { point_id: payload.point_id as number };
  } catch {
    return null;
  }
}

export { COOKIE_NAME as ADMIN_COOKIE_NAME };
