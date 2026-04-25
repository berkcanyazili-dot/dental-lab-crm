import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { prisma } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dental Lab CRM",
  description: "Dental Laboratory Case Management System",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let labName = "Dental Lab";
  try {
    const settings = await prisma.labSettings.findUnique({ where: { id: "default" } });
    if (settings?.labName) labName = settings.labName;
  } catch {
    // DB unavailable — fall back to default
  }

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-900 text-gray-100 antialiased`}>
        <div className="flex min-h-screen">
          <Sidebar labName={labName} />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
