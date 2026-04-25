import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface DoctorSession {
  name?: string | null;
  email?: string | null;
  dentalAccountId: string;
}

export async function getDoctorSession(): Promise<DoctorSession | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { name?: string | null; email?: string | null; role?: string; dentalAccountId?: string | null }
    | undefined;

  if (!user || user.role !== "DOCTOR" || !user.dentalAccountId) {
    return null;
  }

  return {
    name: user.name,
    email: user.email,
    dentalAccountId: user.dentalAccountId,
  };
}
