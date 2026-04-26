import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface SessionTenant {
  userId: string;
  tenantId: string;
  role: string | null;
  dentalAccountId: string | null;
  technicianId: string | null;
  name: string | null;
  email: string | null;
}

export async function getSessionTenant(): Promise<SessionTenant | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
        tenantId?: string | null;
        dentalAccountId?: string | null;
        technicianId?: string | null;
      }
    | undefined;

  if (!user?.id || !user.tenantId) {
    return null;
  }

  return {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role ?? null,
    dentalAccountId: user.dentalAccountId ?? null,
    technicianId: user.technicianId ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
  };
}
