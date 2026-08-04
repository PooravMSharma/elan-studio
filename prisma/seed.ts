import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TENANT_SLUG = "elan-studio";

const SERVICES = [
  { name: "Signature Cut & Finish", slug: "signature-cut", category: "Hair", durationMin: 45, bufferMin: 15, priceMinor: 90000, description: "A consultation-led cut, shaped to your face and hair fall, finished with a blow-dry." },
  { name: "Gloss & Tone", slug: "gloss-tone", category: "Hair", durationMin: 60, bufferMin: 15, priceMinor: 180000, description: "A demi-permanent gloss that evens tone and adds shine without lifting your natural colour." },
  { name: "Balayage", slug: "balayage", category: "Hair", durationMin: 180, bufferMin: 30, priceMinor: 650000, description: "Hand-painted lightening for a lived-in, sun-grown gradient." },
  { name: "Keratin Smoothing", slug: "keratin-smoothing", category: "Hair", durationMin: 150, bufferMin: 30, priceMinor: 750000, description: "A smoothing treatment that cuts drying time and calms frizz for months." },
  { name: "Hair Spa Ritual", slug: "hair-spa", category: "Hair", durationMin: 60, bufferMin: 15, priceMinor: 220000, description: "Scalp massage, steam and a deep conditioning mask." },
  { name: "Classic Facial", slug: "classic-facial", category: "Skin", durationMin: 60, bufferMin: 15, priceMinor: 250000, description: "Cleanse, exfoliate, extract and mask, tailored to your skin on the day." },
  { name: "Hydrafacial", slug: "hydrafacial", category: "Skin", durationMin: 75, bufferMin: 15, priceMinor: 450000, description: "Resurfacing and hydration in one, with visible results the same evening." },
  { name: "Gel Manicure", slug: "gel-manicure", category: "Nails", durationMin: 45, bufferMin: 10, priceMinor: 120000, description: "Shaped, cuticle work, and a gel colour that lasts three weeks." },
  { name: "Bridal Makeup", slug: "bridal-makeup", category: "Bridal", durationMin: 180, bufferMin: 30, priceMinor: 2500000, requiresDeposit: true, depositMinor: 500000, description: "Full bridal makeup with draping and lashes, built from a prior trial." },
  { name: "Bridal Trial", slug: "bridal-trial", category: "Bridal", durationMin: 120, bufferMin: 30, priceMinor: 800000, requiresDeposit: true, depositMinor: 200000, description: "A full run-through of your wedding-day look, photographed in daylight." },
];

const STAFF = [
  { name: "Ritika Malhotra", slug: "ritika", title: "Creative Director", bio: "Fifteen years behind the chair, with a decade of that in colour. Trained in London, back in Jaipur since 2019.", services: ["signature-cut", "gloss-tone", "balayage", "keratin-smoothing", "hair-spa"] },
  { name: "Arjun Nair", slug: "arjun", title: "Senior Stylist", bio: "Precision cutting and men's grooming. Believes most bad haircuts are actually bad consultations.", services: ["signature-cut", "gloss-tone", "hair-spa"] },
  { name: "Meher Kaur", slug: "meher", title: "Bridal Artist", bio: "Bridal and editorial makeup across two hundred weddings. Known for skin that still looks like skin.", services: ["bridal-makeup", "bridal-trial", "classic-facial"] },
  { name: "Sana Qureshi", slug: "sana", title: "Skin & Nail Therapist", bio: "Clinical facials and nail artistry. Certified in Hydrafacial protocols.", services: ["classic-facial", "hydrafacial", "gel-manicure"] },
];

const OPENING_HOURS = [
  { weekday: 0, startMinute: 11 * 60, endMinute: 18 * 60 },
  { weekday: 1, startMinute: 10 * 60, endMinute: 20 * 60 },
  { weekday: 2, startMinute: 10 * 60, endMinute: 20 * 60 },
  { weekday: 3, startMinute: 10 * 60, endMinute: 20 * 60 },
  { weekday: 4, startMinute: 10 * 60, endMinute: 20 * 60 },
  { weekday: 5, startMinute: 10 * 60, endMinute: 21 * 60 },
  { weekday: 6, startMinute: 10 * 60, endMinute: 21 * 60 },
];

const FULL_WEEK = [1, 2, 3, 4, 5, 6];

const SCHEDULES: Record<string, { weekday: number; startMinute: number; endMinute: number }[]> = {
  ritika: FULL_WEEK.filter((d) => d !== 2).map((weekday) => ({ weekday, startMinute: 10 * 60, endMinute: 19 * 60 })),
  arjun: [...FULL_WEEK, 0].map((weekday) => ({ weekday, startMinute: weekday === 0 ? 11 * 60 : 11 * 60, endMinute: weekday === 0 ? 18 * 60 : 20 * 60 })),
  meher: [4, 5, 6, 0].map((weekday) => ({ weekday, startMinute: 10 * 60, endMinute: 18 * 60 })),
  sana: FULL_WEEK.map((weekday) => ({ weekday, startMinute: 10 * 60, endMinute: 19 * 60 })),
};

const LUNCH_BREAKS: Record<string, { start: number; end: number }> = {
  ritika: { start: 14 * 60, end: 14 * 60 + 45 },
  sana: { start: 13 * 60 + 30, end: 14 * 60 + 15 },
};

async function main() {
  console.log("Seeding Élan Studio…");

  await prisma.tenant.deleteMany({ where: { slug: TENANT_SLUG } });

  const tenant = await prisma.tenant.create({
    data: {
      slug: TENANT_SLUG,
      name: "Élan Studio",
      tagline: "Hair, skin and bridal artistry in the heart of Jaipur.",
      timezone: "Asia/Kolkata",
      currency: "INR",
      themeKey: "warm-editorial",
      phone: "+911412000000",
      whatsapp: "+911412000000",
      email: "hello@elanstudio.example",
      addressL1: "2nd Floor, Anand Plaza",
      addressL2: "C-Scheme",
      city: "Jaipur",
      latitude: 26.9124,
      longitude: 75.7873,
      gridMinutes: 15,
      minLeadMinutes: 60,
    },
  });

  await prisma.openingHour.createMany({
    data: OPENING_HOURS.map((h) => ({ ...h, tenantId: tenant.id })),
  });

  const serviceBySlug = new Map<string, string>();
  for (const [i, s] of SERVICES.entries()) {
    const created = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        category: s.category,
        durationMin: s.durationMin,
        bufferMin: s.bufferMin,
        priceMinor: s.priceMinor,
        requiresDeposit: s.requiresDeposit ?? false,
        depositMinor: s.depositMinor ?? 0,
        sortOrder: i,
      },
    });
    serviceBySlug.set(s.slug, created.id);
  }

  for (const [i, member] of STAFF.entries()) {
    const staff = await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        name: member.name,
        slug: member.slug,
        title: member.title,
        bio: member.bio,
        sortOrder: i,
        services: {
          create: member.services.map((slug) => ({
            service: { connect: { id: serviceBySlug.get(slug)! } },
          })),
        },
      },
    });

    const shifts = SCHEDULES[member.slug] ?? [];
    const lunch = LUNCH_BREAKS[member.slug];

    for (const shift of shifts) {
      if (lunch) {
        await prisma.staffSchedule.createMany({
          data: [
            { tenantId: tenant.id, staffId: staff.id, weekday: shift.weekday, startMinute: shift.startMinute, endMinute: lunch.start },
            { tenantId: tenant.id, staffId: staff.id, weekday: shift.weekday, startMinute: lunch.end, endMinute: shift.endMinute },
          ],
        });
      } else {
        await prisma.staffSchedule.create({
          data: { tenantId: tenant.id, staffId: staff.id, weekday: shift.weekday, startMinute: shift.startMinute, endMinute: shift.endMinute },
        });
      }
    }
  }

  await prisma.discountCode.createMany({
    data: [
      { tenantId: tenant.id, code: "FIRSTVISIT", type: "PERCENT", value: 15, maxUses: 200 },
      { tenantId: tenant.id, code: "MONSOON500", type: "FIXED", value: 50000, maxUses: 50 },
    ],
  });

  const passwordHash = await bcrypt.hash("elan-demo-2026", 10);
  await prisma.adminUser.create({
    data: {
      tenantId: tenant.id,
      email: "owner@elanstudio.example",
      name: "Ritika Malhotra",
      passwordHash,
      role: "OWNER",
    },
  });

  const diwali = new Date("2026-11-08T00:00:00+05:30");
  const diwaliEnd = new Date("2026-11-10T00:00:00+05:30");
  await prisma.timeOff.create({
    data: { tenantId: tenant.id, startsAt: diwali, endsAt: diwaliEnd, reason: "Diwali — salon closed" },
  });

  console.log(`Seeded tenant ${tenant.slug} with ${SERVICES.length} services and ${STAFF.length} staff.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });