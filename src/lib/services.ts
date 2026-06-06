export type ServiceType =
  | "morning_incense"
  | "gospel_first"
  | "gospel_third"
  | "gospel_sixth"
  | "gospel_ninth"
  | "paul_epistle"
  | "catholic_epistle"
  | "acts_reading"
  | "altar_service"
  | "screen_service";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  morning_incense: "رفع بخور باكر",
  gospel_first: "إنجيل الساعة الأولى",
  gospel_third: "إنجيل الساعة الثالثة",
  gospel_sixth: "إنجيل الساعة السادسة",
  gospel_ninth: "إنجيل الساعة التاسعة",
  paul_epistle: "البولس",
  catholic_epistle: "الكاثوليكون",
  acts_reading: "الإبركسيس",
  altar_service: "خدمة الهيكل",
  screen_service: "خدمة الشاشة",
};

export const SERVICE_ORDER: ServiceType[] = [
  "morning_incense",
  "gospel_first",
  "gospel_third",
  "gospel_sixth",
  "gospel_ninth",
  "paul_epistle",
  "catholic_epistle",
  "acts_reading",
  "altar_service",
  "screen_service",
];

export const MULTI_SELECT_SERVICES: ServiceType[] = ["altar_service", "screen_service"];

export const DECLINE_REASONS: Record<string, string> = {
  exams: "امتحانات",
  travel: "سفر",
  illness: "مرض",
  family: "ظروف عائلية",
  other: "سبب آخر",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "خادم رئيسي",
  deacon: "شماس",
  servant: "خادم",
  pending: "بانتظار الموافقة",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export function formatFridayDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("ar-EG-u-nu-latn", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}
