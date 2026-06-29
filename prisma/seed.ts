import { PrismaClient, DealStage, DealStatus, ActivityType, TaskPriority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 در حال مقداردهی اولیه پایگاه داده...");

  const password = await bcrypt.hash("password123", 12);

  // --- کاربران ---
  const admin = await prisma.user.upsert({
    where: { email: "admin@spun.local" },
    update: {},
    create: {
      email: "admin@spun.local",
      name: "مدیر سیستم",
      passwordHash: password,
      role: "OWNER",
      avatarColor: "#b8860b",
    },
  });

  const sara = await prisma.user.upsert({
    where: { email: "sara@spun.local" },
    update: {},
    create: {
      email: "sara@spun.local",
      name: "سارا محمدی",
      passwordHash: password,
      role: "MEMBER",
      avatarColor: "#ec4899",
    },
  });

  const reza = await prisma.user.upsert({
    where: { email: "reza@spun.local" },
    update: {},
    create: {
      email: "reza@spun.local",
      name: "رضا کریمی",
      passwordHash: password,
      role: "ADMIN",
      avatarColor: "#10b981",
    },
  });

  const users = [admin, sara, reza];

  // پاک‌سازی داده‌های نمونه برای اجرای مجدد
  await prisma.message.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.task.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.tag.deleteMany();

  // --- برچسب‌ها ---
  const tagNames: [string, string][] = [
    ["سازمانی", "#b8860b"],
    ["کوچک و متوسط", "#10b981"],
    ["سرنخ داغ", "#ef4444"],
    ["شریک تجاری", "#f59e0b"],
    ["در خطر ریزش", "#8b5cf6"],
  ];
  const tags = await Promise.all(
    tagNames.map(([name, color]) => prisma.tag.create({ data: { name, color } }))
  );

  // --- شرکت‌ها ---
  const companyData = [
    { name: "گروه صنعتی آرتا", industry: "تولیدی", domain: "arta.co", website: "https://arta.co", phone: "۰۲۱-۸۸۷۷۶۶۵۵" },
    { name: "بازرگانی پاسارگاد", industry: "بازرگانی", domain: "pasargad.com", website: "https://pasargad.com", phone: "۰۲۱-۲۲۳۳۴۴۵۵" },
    { name: "فناوری نوین رایان", industry: "فناوری اطلاعات", domain: "rayan.io", website: "https://rayan.io", phone: "۰۲۱-۴۴۵۵۶۶۷۷" },
    { name: "داروسازی البرز", industry: "دارویی", domain: "alborz.health", website: "https://alborz.health", phone: "۰۲۶-۳۳۲۲۱۱۰۰" },
    { name: "هلدینگ کاسپین", industry: "سرمایه‌گذاری", domain: "caspian.group", website: "https://caspian.group", phone: "۰۲۱-۸۸۸۸۹۹۹۹" },
  ];
  const companies = await Promise.all(
    companyData.map((c, i) =>
      prisma.company.create({
        data: {
          ...c,
          ownerId: users[i % users.length].id,
          tags: { connect: [{ id: tags[i % tags.length].id }] },
        },
      })
    )
  );

  // --- مخاطبین ---
  const firstNames = ["علی", "زهرا", "محمد", "فاطمه", "حسین", "مریم", "امیر", "نگار", "سعید", "لیلا"];
  const lastNames = ["احمدی", "رضایی", "موسوی", "حسینی", "کاظمی", "نوری", "صادقی", "جعفری", "قاسمی", "بهرامی"];
  const titles = ["مدیرعامل", "معاون فروش", "مدیر فنی", "کارشناس تدارکات", "مدیر عملیات", "مدیر بازاریابی"];

  const contacts = [];
  for (let i = 0; i < 14; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const company = companies[i % companies.length];
    const c = await prisma.contact.create({
      data: {
        firstName: fn,
        lastName: ln,
        email: `user${i + 1}@${company.domain}`,
        phone: `۰۹۱۲۳۴۵۶۷${(10 + i).toString().slice(-2)}`,
        title: titles[i % titles.length],
        companyId: company.id,
        ownerId: users[i % users.length].id,
        tags: { connect: [{ id: tags[i % tags.length].id }] },
      },
    });
    contacts.push(c);
  }

  // --- معاملات ---
  const stages: DealStage[] = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
  const dealTitles = [
    "تمدید قرارداد سالانه", "توسعه پلتفرم", "برنامه آزمایشی", "استقرار سازمانی",
    "ارتقای پشتیبانی", "راه‌اندازی واحد جدید", "بسته سخت‌افزاری", "پروژه مشاوره",
    "قرارداد چندساله", "ماژول‌های افزودنی", "پروژه مهاجرت داده", "بسته آموزشی",
  ];
  const deals = [];
  for (let i = 0; i < 12; i++) {
    const stage = stages[i % stages.length];
    const status: DealStatus = stage === "WON" ? "WON" : stage === "LOST" ? "LOST" : "OPEN";
    const contact = contacts[i % contacts.length];
    const d = await prisma.deal.create({
      data: {
        title: dealTitles[i],
        value: (i + 1) * 75_000_000 + 50_000_000, // مبالغ به تومان
        currency: "Toman",
        stage,
        status,
        probability: stage === "WON" ? 100 : stage === "LOST" ? 0 : 10 + (i % 5) * 20,
        expectedCloseDate: new Date(Date.now() + (i - 4) * 7 * 86400000),
        closedAt: status === "OPEN" ? null : new Date(Date.now() - i * 86400000),
        companyId: contact.companyId,
        contactId: contact.id,
        ownerId: users[i % users.length].id,
        tags: { connect: [{ id: tags[i % tags.length].id }] },
      },
    });
    deals.push(d);
  }

  // --- فعالیت‌ها ---
  const actTypes: ActivityType[] = ["NOTE", "CALL", "EMAIL", "MEETING"];
  const actContents = [
    "پیام صوتی درباره تمدید قرارداد گذاشته شد.",
    "پیش‌فاکتور ارسال شد، در انتظار بازخورد.",
    "تماس اکتشافی خوبی بود — بودجه تأیید شد.",
    "جلسه با واحد تدارکات برگزار شد، قرارداد در واحد حقوقی است.",
    "هفته آینده پیگیری می‌شود.",
  ];
  for (let i = 0; i < 20; i++) {
    const deal = deals[i % deals.length];
    await prisma.activity.create({
      data: {
        type: actTypes[i % actTypes.length],
        content: actContents[i % actContents.length],
        userId: users[i % users.length].id,
        dealId: deal.id,
        contactId: deal.contactId,
        companyId: deal.companyId,
      },
    });
  }

  // --- وظایف ---
  const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
  const taskTitles = [
    "پیگیری پیش‌فاکتور", "هماهنگی جلسه دمو", "ارسال قرارداد", "تهیه ارائه بازبینی فصلی",
    "تماس با تصمیم‌گیرنده", "به‌روزرسانی یادداشت‌ها", "تأیید قیمت‌گذاری", "پیگیری با مشتری کلیدی",
  ];
  for (let i = 0; i < 10; i++) {
    await prisma.task.create({
      data: {
        title: taskTitles[i % taskTitles.length],
        priority: priorities[i % priorities.length],
        dueDate: new Date(Date.now() + (i - 3) * 86400000),
        completed: i % 4 === 0,
        assigneeId: users[i % users.length].id,
        dealId: deals[i % deals.length].id,
        contactId: contacts[i % contacts.length].id,
      },
    });
  }

  // --- گفتگوی تیمی ---
  const general = await prisma.channel.create({
    data: {
      name: "عمومی",
      description: "اطلاعیه‌ها و گفتگوهای عمومی شرکت",
      createdById: admin.id,
      members: { create: users.map((u) => ({ userId: u.id })) },
    },
  });
  const sales = await prisma.channel.create({
    data: {
      name: "فروش",
      description: "به‌روزرسانی معاملات و خط لوله فروش",
      createdById: admin.id,
      members: { create: users.map((u) => ({ userId: u.id })) },
    },
  });

  const seedMessages: [string, string, string][] = [
    [general.id, admin.id, "به سامانه CRM تیم خوش آمدید! 🎉 خودتان را اینجا معرفی کنید."],
    [general.id, sara.id, "سلام به همگی! خوشحالم که به تیم پیوستم."],
    [general.id, reza.id, "جلسه بررسی خط لوله هر دوشنبه ساعت ۱۰ صبح."],
    [sales.id, sara.id, "معامله گروه آرتا به مرحله مذاکره رسید 🤞"],
    [sales.id, reza.id, "عالیه! من را هم در جریان شرایط قرارداد بگذار."],
  ];
  for (const [channelId, senderId, body] of seedMessages) {
    await prisma.message.create({ data: { channelId, senderId, body } });
  }

  console.log("✅ مقداردهی اولیه کامل شد.");
  console.log("\nورود با:");
  console.log("  admin@spun.local / password123  (مالک)");
  console.log("  reza@spun.local  / password123  (مدیر)");
  console.log("  sara@spun.local  / password123  (عضو)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
