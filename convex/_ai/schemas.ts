import { z } from "zod";

// ─── Personal Info ──────────────────────────────────────────────
export const PersonalInfoSchema = z.object({
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().optional(),
  location: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  website: z.string().optional(),
  photo_url: z.string().optional(),
}).passthrough();

// ─── Experience ─────────────────────────────────────────────────
export const ExperienceDisplayModeSchema = z.enum(["hidden", "compact", "normal", "extended"]);

export const ExperienceSchema = z.object({
  company: z.string().default(""),
  position: z.string().default(""),
  location: z.string().optional(),
  start_date: z.string().default(""),
  end_date: z.string().optional(),
  // Accept boolean | string | null — coerced in normalizer
  current: z.any().optional(),
  intro: z.string().optional(),
  description: z.any().default([]),
  kpi: z.string().optional(),
  showKpi: z.boolean().optional(),
  displayMode: ExperienceDisplayModeSchema.optional(),
}).passthrough();

// ─── Education ──────────────────────────────────────────────────
export const EducationSchema = z.object({
  school: z.string().default(""),
  degree: z.string().default(""),
  field: z.string().optional(),
  start_date: z.string().default(""),
  end_date: z.string().optional(),
}).passthrough();

// ─── Skills ─────────────────────────────────────────────────────
export const SkillDisplayModeSchema = z.enum(["hidden", "compact", "normal"]);

export const SkillCategorySchema = z.object({
  category: z.any().optional(),       // may be string, null, or missing
  items: z.array(z.any()).default([]), // may contain strings or {name, skill, ...} objects
  displayMode: SkillDisplayModeSchema.optional(),
}).passthrough();

// ─── Language ───────────────────────────────────────────────────
export const LanguageSchema = z.object({
  name: z.string().default(""),
  proficiency: z.string().default(""),
}).passthrough();

// ─── CVData (top-level) ─────────────────────────────────────────
export const CVDataSchema = z.object({
  personal_info: PersonalInfoSchema.default({ name: "", email: "" }),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(SkillCategorySchema).default([]),
  languages: z.array(LanguageSchema).default([]),
}).passthrough();

export type CVDataParsed = z.infer<typeof CVDataSchema>;

// ─── Ancillary AI action schemas ────────────────────────────────
export const ATSAnalysisSchema = z.object({
  score: z.number(),
  missingKeywords: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  ats_compatibility: z.enum(["LOW", "MEDIUM", "HIGH"]),
}).passthrough();

export const KeywordListSchema = z.object({
  keywords: z.array(z.string()).default([]),
}).passthrough();

export const CoverLetterSchema = z.object({
  subject: z.string(),
  greeting: z.string(),
  body: z.string(),
  closing: z.string(),
}).passthrough();

export const BulletSuggestionsSchema = z.object({
  suggestions: z.array(z.string()).default([]),
}).passthrough();

export const BulletRewriteSchema = z.object({
  rewrites: z.array(
    z.object({
      index: z.number(),
      original: z.string().default(""),
      rewritten: z.string().default(""),
    }).passthrough()
  ).default([]),
}).passthrough();

// ─── Keyword distribution (Phase 12) ────────────────────────────
export const KeywordAssignmentSchema = z.object({
  keyword: z.string(),
  expIndex: z.number().nullable(),
  bulletIndex: z.number().nullable().optional(),
  originalBullet: z.string().nullable().optional(),
  rewrittenBullet: z.string().nullable().optional(),
  reason: z.string().default(""),
}).passthrough();

export const KeywordDistributionSchema = z.object({
  assignments: z.array(KeywordAssignmentSchema).default([]),
}).passthrough();

export type KeywordDistributionParsed = z.infer<typeof KeywordDistributionSchema>;
