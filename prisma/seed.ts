import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@dentallab.com" },
    update: {},
    create: {
      email: "admin@dentallab.com",
      name: "Admin User",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const technicians = await Promise.all([
    prisma.technician.upsert({
      where: { id: "tech-001" },
      update: {},
      create: { id: "tech-001", name: "Maria Garcia", specialty: "Crown & Bridge" },
    }),
    prisma.technician.upsert({
      where: { id: "tech-002" },
      update: {},
      create: { id: "tech-002", name: "James Chen", specialty: "Full Arch" },
    }),
    prisma.technician.upsert({
      where: { id: "tech-003" },
      update: {},
      create: { id: "tech-003", name: "Sarah Johnson", specialty: "Cosmetics" },
    }),
  ]);

  const accounts = await Promise.all([
    prisma.dentalAccount.upsert({
      where: { id: "acc-001" },
      update: {},
      create: {
        id: "acc-001",
        name: "Bright Smile Dental",
        doctorName: "Smith",
        email: "office@brightsmile.com",
        phone: "(555) 123-4567",
        city: "Los Angeles",
        state: "CA",
      },
    }),
    prisma.dentalAccount.upsert({
      where: { id: "acc-002" },
      update: {},
      create: {
        id: "acc-002",
        name: "Family Dental Care",
        doctorName: "Johnson",
        email: "drjohnson@familydental.com",
        phone: "(555) 234-5678",
        city: "San Diego",
        state: "CA",
      },
    }),
    prisma.dentalAccount.upsert({
      where: { id: "acc-003" },
      update: {},
      create: {
        id: "acc-003",
        name: "Advanced Oral Care",
        doctorName: "Williams",
        email: "office@advancedoral.com",
        phone: "(555) 345-6789",
        city: "Irvine",
        state: "CA",
      },
    }),
    prisma.dentalAccount.upsert({
      where: { id: "acc-004" },
      update: {},
      create: {
        id: "acc-004",
        name: "Premier Dental Group",
        doctorName: "Martinez",
        phone: "(555) 456-7890",
        city: "Riverside",
        state: "CA",
      },
    }),
  ]);

  const doctorPassword = await bcrypt.hash("doctor123", 10);
  await prisma.user.upsert({
    where: { email: "doctor@brightsmile.com" },
    update: { dentalAccountId: accounts[0].id, role: "DOCTOR" },
    create: {
      email: "doctor@brightsmile.com",
      name: "Dr. Smith",
      password: doctorPassword,
      role: "DOCTOR",
      dentalAccountId: accounts[0].id,
    },
  });

  const casesData = [
    {
      id: "case-001",
      caseNumber: "DL-00001",
      patientName: "John Anderson",
      dentalAccountId: accounts[0].id,
      technicianId: technicians[0].id,
      status: "WIP",
      priority: "NORMAL",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      shade: "A2",
      pan: "P-001",
      totalValue: 450,
      items: [
        { productType: "Posterior Zirconia", toothNumbers: "14", units: 1, shade: "A2", price: 250 },
        { productType: "Anterior Zirconia", toothNumbers: "9", units: 1, shade: "A2", price: 200 },
      ],
    },
    {
      id: "case-002",
      caseNumber: "DL-00002",
      patientName: "Mary Thompson",
      dentalAccountId: accounts[1].id,
      technicianId: technicians[1].id,
      status: "INCOMING",
      priority: "RUSH",
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      shade: "B1",
      totalValue: 1200,
      items: [
        { productType: "Full Arch Restoration", toothNumbers: "Upper", units: 1, shade: "B1", price: 1200 },
      ],
    },
    {
      id: "case-003",
      caseNumber: "DL-00003",
      patientName: "Robert Davis",
      dentalAccountId: accounts[0].id,
      technicianId: technicians[2].id,
      status: "HOLD",
      priority: "NORMAL",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      shade: "A3",
      notes: "Waiting for shade approval from doctor",
      totalValue: 675,
      items: [
        { productType: "Veneer Pressable", toothNumbers: "6, 7, 8, 9, 10, 11", units: 6, shade: "A3", price: 112.5 },
      ],
    },
    {
      id: "case-004",
      caseNumber: "DL-00004",
      patientName: "Lisa Wilson",
      dentalAccountId: accounts[2].id,
      status: "REMAKE",
      priority: "STAT",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      shade: "A1",
      notes: "Crown does not fit - redo margin",
      totalValue: 250,
      items: [
        { productType: "Crown", toothNumbers: "30", units: 1, shade: "A1", price: 250 },
      ],
    },
    {
      id: "case-005",
      caseNumber: "DL-00005",
      patientName: "Michael Brown",
      dentalAccountId: accounts[3].id,
      technicianId: technicians[0].id,
      status: "COMPLETE",
      priority: "NORMAL",
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      shade: "A2",
      totalValue: 480,
      isPaid: true,
      items: [
        { productType: "PFM High Noble Yellow", toothNumbers: "18, 19", units: 2, shade: "A2", price: 240 },
      ],
    },
    {
      id: "case-006",
      caseNumber: "DL-00006",
      patientName: "Patricia Jones",
      dentalAccountId: accounts[1].id,
      technicianId: technicians[1].id,
      status: "IN_LAB",
      priority: "NORMAL",
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      totalValue: 880,
      items: [
        { productType: "Denture", toothNumbers: "Upper Full", units: 1, price: 550 },
        { productType: "Acrylic Partial", toothNumbers: "Lower", units: 1, price: 330 },
      ],
    },
    {
      id: "case-007",
      caseNumber: "DL-00007",
      patientName: "Charles Miller",
      dentalAccountId: accounts[2].id,
      status: "WIP",
      priority: "NORMAL",
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      shade: "A2",
      totalValue: 350,
      items: [
        { productType: "Implant Crown", toothNumbers: "3", units: 1, shade: "A2", price: 350 },
      ],
    },
    {
      id: "case-008",
      caseNumber: "DL-00008",
      patientName: "Barbara Taylor",
      dentalAccountId: accounts[3].id,
      technicianId: technicians[2].id,
      status: "SHIPPED",
      priority: "NORMAL",
      shippedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      totalValue: 720,
      isPaid: false,
      items: [
        { productType: "Cast Partial", toothNumbers: "Lower", units: 1, price: 420 },
        { productType: "Ortho Retainer", toothNumbers: "Upper", units: 1, price: 180 },
        { productType: "Custom Tray", toothNumbers: "Lower", units: 1, price: 120 },
      ],
    },
  ];

  for (const { items, ...caseFields } of casesData) {
    await prisma.case.upsert({
      where: { id: caseFields.id },
      update: {},
      create: {
        ...caseFields,
        items: { create: items },
      } as any,
    });
  }

  console.log("✅ Database seeded successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
