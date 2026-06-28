// Persian display labels for enum values.

export const roleLabel: Record<string, string> = {
  OWNER: "مالک",
  ADMIN: "مدیر",
  MEMBER: "عضو",
};

export const stageLabel: Record<string, string> = {
  LEAD: "سرنخ",
  QUALIFIED: "واجد شرایط",
  PROPOSAL: "پیشنهاد",
  NEGOTIATION: "مذاکره",
  WON: "موفق",
  LOST: "ناموفق",
};

// Marketing sources / campaigns for deal attribution.
export const DEAL_SOURCES = [
  "اینستاگرام",
  "تماس سرد",
  "معرفی مشتری",
  "وب‌سایت",
  "واتساپ",
  "نمایشگاه",
  "تبلیغات",
  "سایر",
];

export const priorityLabel: Record<string, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "زیاد",
};

export const activityTypeLabel: Record<string, string> = {
  NOTE: "یادداشت",
  CALL: "تماس",
  EMAIL: "ایمیل",
  MEETING: "جلسه",
  STAGE_CHANGE: "تغییر مرحله",
};
