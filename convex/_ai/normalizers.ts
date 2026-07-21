import { CVDataSchema } from "./schemas";
import type {
  CVData,
  Experience,
  SkillCategory,
  Language,
  ExperienceDisplayMode,
} from "../../src/shared/types";

// ─── Proficiency: store RAW, localize at render ──────────────────
// The backend must NOT freeze proficiency to a localized string. It used to
// map to French ("Courant (C1)"), which then rendered French even on an
// English CV, AND survived translateCV (re-frozen after translation). The
// bilingual owner is the render-side normalizeProficiency in
// src/features/editor/lib/formatting.ts — it localizes FR↔EN from the raw
// source value (LinkedIn "Full professional", "Native or bilingual", …). So
// here we only trim: keep the raw value, let the render localize it.
export function normalizeProficiency(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim();
}

// ─── Title coercion ──────────────────────────────────────────────
export function normalizeTitle(title: string | undefined): string | undefined {
  if (!title || typeof title !== "string") return title;
  if (title.length <= 50) return title;
  const parts = title.split(/[|,]/);
  return parts[0].trim();
}

// ─── displayMode coercion ────────────────────────────────────────
const VALID_DISPLAY_MODES: ExperienceDisplayMode[] = ["hidden", "compact", "normal", "extended"];
function normalizeDisplayMode(mode: unknown): ExperienceDisplayMode {
  if (typeof mode === "string" && (VALID_DISPLAY_MODES as string[]).includes(mode)) {
    return mode as ExperienceDisplayMode;
  }
  return "normal";
}

// ─── Description coercion ────────────────────────────────────────
function normalizeDescription(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    // Handle case where model returned a single string instead of array
    if (typeof raw === "string") return normalizeDescription([raw]);
    return [];
  }
  return raw
    .flatMap((d: unknown) => {
      if (typeof d === "string" && d.length > 200) {
        return d
          .split(/[•·\-–—]\s+|(?:\.\s+)(?=[A-Z])/)
          .filter((s) => s.trim().length > 10)
          .map((s) => s.trim());
      }
      return [typeof d === "string" ? d.trim() : String(d)];
    })
    .filter((s) => s.length > 0)
    .slice(0, 5);
}

// ─── Experience coercion ─────────────────────────────────────────
export function normalizeExperience(raw: any): Experience {
  const endDateRaw = typeof raw.end_date === "string" ? raw.end_date : "";
  const endDateLower = endDateRaw.toLowerCase();
  const isCurrent =
    raw.current === true ||
    endDateRaw === "" ||
    endDateLower === "présent" ||
    endDateLower === "present";

  return {
    company: typeof raw.company === "string" ? raw.company : "",
    position: typeof raw.position === "string" ? raw.position : "",
    location: typeof raw.location === "string" ? raw.location : undefined,
    start_date: typeof raw.start_date === "string" ? raw.start_date : "",
    end_date: isCurrent ? "" : endDateRaw,
    current: isCurrent,
    intro: typeof raw.intro === "string" ? raw.intro : undefined,
    description: normalizeDescription(raw.description),
    kpi: typeof raw.kpi === "string" ? raw.kpi.trim() : "",
    showKpi: typeof raw.showKpi === "boolean" ? raw.showKpi : undefined,
    displayMode: normalizeDisplayMode(raw.displayMode),
  };
}

// ─── Skills coercion ─────────────────────────────────────────────
export function normalizeSkills(raw: unknown): SkillCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((cat: any): SkillCategory => {
      const category =
        typeof cat?.category === "string" && cat.category.trim().length > 0
          ? cat.category
          : "Compétences";
      const rawItems = Array.isArray(cat?.items) ? cat.items : [];
      const stringItems: string[] = rawItems
        .map((item: any): string => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            return String(item.name ?? item.skill ?? item.title ?? "").trim();
          }
          return String(item ?? "").trim();
        })
        .filter((s: string) => s.length > 0);
      // Dedupe case-insensitively, preserve first occurrence
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const item of stringItems) {
        const key = item.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      }
      return {
        category,
        items: deduped.slice(0, 8),
        displayMode: cat?.displayMode,
      };
    })
    .slice(0, 5);
}

// ─── Languages coercion ──────────────────────────────────────────
function normalizeLanguages(raw: unknown): Language[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(
    (lang: any): Language => ({
      name: typeof lang?.name === "string" ? lang.name : "",
      proficiency: normalizeProficiency(lang?.proficiency),
    })
  );
}

// ─── Top-level normalizer (D-05) ─────────────────────────────────
export function normalizeCVData(raw: unknown): CVData {
  const parsed = CVDataSchema.safeParse(raw);
  if (!parsed.success) {
    const preview = JSON.stringify(raw).slice(0, 500);
    console.error(
      "[normalizeCVData] Zod parse failed:",
      parsed.error.message,
      "raw:",
      preview
    );
    throw new Error("L'IA a retourné un CV invalide. Veuillez réessayer.");
  }
  const data = parsed.data;

  return {
    personal_info: {
      name: typeof data.personal_info.name === "string" ? data.personal_info.name : "",
      email: typeof data.personal_info.email === "string" ? data.personal_info.email : "",
      phone: data.personal_info.phone,
      location: data.personal_info.location,
      title: normalizeTitle(data.personal_info.title),
      summary: data.personal_info.summary,
      linkedin: (data.personal_info as any).linkedin,
      github: (data.personal_info as any).github,
      website: (data.personal_info as any).website,
      photo_url: (data.personal_info as any).photo_url,
    },
    experience: (data.experience ?? []).map(normalizeExperience),
    education: (data.education ?? []).map((e: any) => ({
      school: typeof e.school === "string" ? e.school : "",
      degree: typeof e.degree === "string" ? e.degree : "",
      field: typeof e.field === "string" ? e.field : undefined,
      start_date: typeof e.start_date === "string" ? e.start_date : "",
      end_date: typeof e.end_date === "string" ? e.end_date : undefined,
    })),
    skills: normalizeSkills(data.skills),
    languages: normalizeLanguages(data.languages),
  };
}
