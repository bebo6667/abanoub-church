/**
 * مسح دوري (يُحدَّث تلقائيًا عند فتح الصفحة) لاقتراح:
 * 1) الشمامسة المرشحين للخدمة في الجدول القادم.
 * 2) الشمامسة الذين يستحقون الافتقاد.
 */
import { db } from "@/lib/db";
import { effectiveAge } from "@/lib/age";
import { RANK_LABELS, type DeaconRank } from "@/lib/services";

export const CANDIDATE_MIN_ATTENDANCE = 70; // %
export const CANDIDATE_MIN_AGE = 10;
export const REST_DAYS = 30; // مدة بلا خدمة تجعله أولى بالترشيح
export const VISIT_GAP_DAYS = 60; // مدة بلا افتقاد
export const LOW_ATTENDANCE = 50; // % يستحق الافتقاد

export type DeaconInsight = {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  rank: DeaconRank | null;
  age: number | null;
  present: number;
  absent: number;
  recorded: number;
  pct: number;
  daysSinceService: number | null; // null = لم يخدم قط
  daysSinceVisit: number | null; // null = لم يُفتقد قط
  profileComplete: boolean;
  isCandidate: boolean;
  candidateReasons: string[];
  candidateScore: number;
  needsVisit: boolean;
  visitReasons: string[];
  visitScore: number;
};

function daysBetween(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export async function fetchDeaconInsights(): Promise<DeaconInsight[]> {
  const [{ data: members }, { data: checkins }, { data: assignments }, { data: visits }] = await Promise.all([
    db.from("profiles")
      .select("id, full_name, profile_image_url, phone, whatsapp, age, date_of_birth, rank, education_stage, address, user_roles!user_roles_user_id_fkey(role)")
      .eq("status", "approved"),
    db.from("attendance_checkins").select("user_id, present, schedule_id"),
    db.from("schedule_assignments").select("user_id, schedules(friday_date,status)"),
    db.from("visitations").select("deacon_id, visited_at"),
  ]);

  const deacons = ((members ?? []) as any[]).filter((m) => {
    const roles = (m.user_roles ?? []).map((r: any) => r.role);
    return roles.includes("deacon") && !roles.includes("admin") && !roles.includes("servant");
  });

  const att = new Map<string, { present: number; absent: number }>();
  for (const c of (checkins ?? []) as any[]) {
    const s = att.get(c.user_id) ?? { present: 0, absent: 0 };
    if (c.present) s.present++; else s.absent++;
    att.set(c.user_id, s);
  }

  const lastService = new Map<string, string>();
  for (const a of (assignments ?? []) as any[]) {
    const d = a.schedules?.friday_date;
    if (!d || a.schedules?.status !== "published") continue;
    const prev = lastService.get(a.user_id);
    if (!prev || d > prev) lastService.set(a.user_id, d);
  }

  const lastVisit = new Map<string, string>();
  for (const v of (visits ?? []) as any[]) {
    const prev = lastVisit.get(v.deacon_id);
    if (!prev || v.visited_at > prev) lastVisit.set(v.deacon_id, v.visited_at);
  }

  const today = new Date().toISOString().slice(0, 10);

  return deacons.map((m): DeaconInsight => {
    const s = att.get(m.id) ?? { present: 0, absent: 0 };
    const recorded = s.present + s.absent;
    const pct = recorded === 0 ? 0 : Math.round((s.present / recorded) * 100);
    const age = effectiveAge(m.date_of_birth, m.age);
    const lastSvc = lastService.get(m.id);
    const daysSinceService = lastSvc && lastSvc <= today ? daysBetween(lastSvc) : lastSvc ? 0 : null;
    const daysSinceVisit = daysBetween(lastVisit.get(m.id));
    const profileComplete = Boolean((m.phone || m.whatsapp) && m.date_of_birth && m.rank);

    // ===== ترشيح للخدمة =====
    const candidateReasons: string[] = [];
    let candidateScore = 0;
    const goodAttendance = recorded === 0 ? false : pct >= CANDIDATE_MIN_ATTENDANCE;
    const ageOk = age != null && age >= CANDIDATE_MIN_AGE;
    const restedEnough = daysSinceService == null || daysSinceService >= REST_DAYS;

    if (goodAttendance) { candidateReasons.push(`مواظبة ${pct}%`); candidateScore += pct; }
    if (ageOk) { candidateReasons.push(`السن ${age} سنة`); candidateScore += 10; }
    if (m.rank) { candidateReasons.push(RANK_LABELS[m.rank as DeaconRank] ?? ""); candidateScore += 10; }
    if (profileComplete) { candidateScore += 10; }
    if (daysSinceService == null) {
      candidateReasons.push("لم تُسند إليه خدمة من قبل");
      candidateScore += 60;
    } else if (daysSinceService >= REST_DAYS) {
      candidateReasons.push(`مضى ${daysSinceService} يومًا بلا خدمة`);
      candidateScore += Math.min(daysSinceService, 120) / 2;
    }

    const isCandidate = goodAttendance && ageOk && profileComplete && restedEnough;

    // ===== استحقاق الافتقاد =====
    const visitReasons: string[] = [];
    let visitScore = 0;
    if (recorded >= 2 && pct < LOW_ATTENDANCE) {
      visitReasons.push(`مواظبة منخفضة ${pct}%`);
      visitScore += 100 - pct;
    }
    if (s.absent >= 3) { visitReasons.push(`غياب ${s.absent} مرات`); visitScore += s.absent * 5; }
    if (daysSinceVisit == null && s.absent > 0) { visitReasons.push("لم يُفتقد من قبل"); visitScore += 40; }
    else if (daysSinceVisit != null && daysSinceVisit >= VISIT_GAP_DAYS) {
      visitReasons.push(`مضى ${daysSinceVisit} يومًا على آخر افتقاد`);
      visitScore += Math.min(daysSinceVisit, 180) / 3;
    }

    return {
      id: m.id,
      full_name: m.full_name,
      profile_image_url: m.profile_image_url ?? null,
      phone: m.phone ?? null,
      whatsapp: m.whatsapp ?? null,
      rank: (m.rank ?? null) as DeaconRank | null,
      age,
      present: s.present,
      absent: s.absent,
      recorded,
      pct,
      daysSinceService,
      daysSinceVisit,
      profileComplete,
      isCandidate,
      candidateReasons: candidateReasons.filter(Boolean),
      candidateScore,
      needsVisit: visitReasons.length > 0,
      visitReasons,
      visitScore,
    };
  });
}
