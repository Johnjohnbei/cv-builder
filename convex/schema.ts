import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ─── Reusable validators ───

const personalInfoValidator = v.object({
  name: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  location: v.optional(v.string()),
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  github: v.optional(v.string()),
  website: v.optional(v.string()),
  photo_url: v.optional(v.string()),
});

const educationValidator = v.object({
  school: v.string(),
  degree: v.string(),
  field: v.optional(v.string()),
  start_date: v.optional(v.string()),
  end_date: v.optional(v.string()),
});

const languageValidator = v.object({
  name: v.string(),
  proficiency: v.string(),
});

const designValidator = v.object({
  template: v.string(),
  primaryColor: v.string(),
  secondaryColor: v.string(),
  fontFamily: v.string(),
  sectionTitleWeight: v.optional(v.string()),
  sectionTitleTransform: v.optional(v.string()),
  sectionTitleSpacing: v.optional(v.string()),
  pageLimit: v.optional(v.number()),
  showPhoto: v.optional(v.boolean()),
  paperSize: v.optional(v.string()),
  orientation: v.optional(v.string()),
  includedSections: v.optional(v.array(v.string())),
});

// ─── Schema ───
// Note: experience and skills use v.any() because AI responses can include
// unpredictable extra fields (displayMode, kpi, intro, proficiency objects).
// Strict validation on those would break on AI output variations.

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    email: v.string(),
    fullName: v.string(),
    baseCV: v.optional(v.any()),
    lastGeneratedCV: v.optional(v.any()),
    lastJobDescription: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),

  cvs: defineTable({
    userId: v.string(),
    title: v.optional(v.string()),
    personal_info: personalInfoValidator,
    experience: v.array(v.any()),
    education: v.array(educationValidator),
    skills: v.array(v.any()),
    languages: v.array(languageValidator),
    design: v.optional(designValidator),
    jobDescription: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]),

  coverLetters: defineTable({
    userId: v.string(),
    cvId: v.optional(v.id("cvs")),
    jobDescription: v.string(),
    companyName: v.optional(v.string()),
    subject: v.string(),
    greeting: v.string(),
    body: v.string(),
    closing: v.string(),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]),

  accessCodes: defineTable({
    code: v.string(),
    maxUses: v.number(),
    usedCount: v.number(),
    expiresAt: v.string(),
    createdAt: v.string(),
    label: v.optional(v.string()),
  }).index("by_code", ["code"]),

  accessRequests: defineTable({
    email: v.string(),
    message: v.optional(v.string()),
    createdAt: v.string(),
  }),
});
