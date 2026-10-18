import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyDevToken, DEV_COOKIE_NAME } from "@/lib/dev-session";

export default async function DevProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEV_COOKIE_NAME)?.value;
  if (!token) redirect("/dev");

  const session = await verifyDevToken(token);
  if (!session) redirect("/dev");

  return <>{children}</>;
}
