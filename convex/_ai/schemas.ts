import { z } from "zod";
import { REQUIREMENT_IMPORTANCES, REQUIREMENT_KINDS } from "../../src/shared/types";

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
/** One requirement as the model writes it; the id is computed by normalizeJobRequirements */
export const JobRequirementSchema = z.object({
  label: z.string(),
  variants: z.array(z.string()).nullish().transform(v => v ?? []),
  kind: z.enum(REQUIREMENT_KINDS),
  importance: z.enum(REQUIREMENT_IMPORTANCES),
  quote: z.string(),
  minYears: z.number().optional(),
}).passthrough();

/** Items are checked one by one: a single malformed requirement must not reject the list */
export const JobRequirementsSchema = z.object({
  requirements: z.array(z.unknown()).default([]),
}).passthrough();

export const CoverLetterSchema = z.object({
  subject: z.string().min(1),
  greeting: z.string().min(1),
  // A real letter body is several paragraphs — reject near-empty output so the
  // retry loop regenerates instead of returning a hollow letter.
  body: z.string().min(150),
  closing: z.string().min(1),
}).passthrough();

export const CompanyMetaSchema = z.object({
  companyName: z.string().nullable(),
  domainGuess: z.string().nullable(),
  industry: z.string().nullable(),
  stage: z.string().nullable().optional(),
  businessModel: z.string().nullable().optional(),
}).passthrough();
export type CompanyMetaParsed = z.infer<typeof CompanyMetaSchema>;

// Company metadata constants live in src/shared/constants/companyMeta.ts
// (zod-free) so UI imports don't pull zod into the editor bundle.
// Re-exported here for server-side/back-compat imports.
export {
  COMPANY_STAGE_OPTIONS,
  COMPANY_BUSINESS_MODEL_OPTIONS,
  getLocalizedStage,
} from '../../src/shared/constants/companyMeta';

/** Batch enrichment of work experiences with stage + businessModel tags. */
export const ExperienceEnrichmentSchema = z.object({
  results: z.array(
    z.object({
      stage: z.string().nullable(),
      businessModel: z.string().nullable(),
    }).passthrough(),
  ),
}).passthrough();
export type ExperienceEnrichmentParsed = z.infer<typeof ExperienceEnrichmentSchema>;

// ─── Tailoring pipeline (tailor.ts) ─────────────────────────────
/** The rewritten CV and, per requirement written, the source quote proving it */
export const GenerationSchema = z.object({
  cv: z.unknown(),
  // Entries read one by one (tailor.ts): a single malformed one must not reject the CV
  evidence: z.array(z.unknown()).nullish().transform(v => v ?? []),
}).passthrough();

/** Edits of the targeted repair, applied by code */
export const RepairSchema = z.object({
  edits: z.array(z.object({
    target: z.enum(["summary", "experience", "skills"]),
    expIndex: z.number().int().nullish(),
    bulletIndex: z.number().int().nullish(),
    text: z.string().trim().min(1),
  }).passthrough()).default([]),
}).passthrough();

export type RepairEdit = z.infer<typeof RepairSchema>["edits"][number];
