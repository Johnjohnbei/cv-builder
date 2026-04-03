import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    personal_info: v.any(),
    experience: v.array(v.any()),
    education: v.array(v.any()),
    skills: v.array(v.any()),
    languages: v.array(v.any()),
    design: v.optional(v.any()),
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
