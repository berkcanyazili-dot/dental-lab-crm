import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSessionAuthorName() {
  const session = await getServerSession(authOptions);
  return session?.user?.name ?? session?.user?.email ?? "Unknown User";
}
