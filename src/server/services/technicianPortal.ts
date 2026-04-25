import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface TechnicianSession {
  name?: string | null;
  email?: string | null;
  technicianId: string;
}

export async function getTechnicianSession(): Promise<TechnicianSession | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { name?: string | null; email?: string | null; role?: string; technicianId?: string | null }
    | undefined;

  if (!user || user.role !== "TECHNICIAN" || !user.technicianId) {
    return null;
  }

  return {
    name: user.name,
    email: user.email,
    technicianId: user.technicianId,
  };
}
