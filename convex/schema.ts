import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(), // Clerk Subject ID (sub)
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
    personal_info: v.any(),
    experience: v.array(v.any()),
    education: v.array(v.any()),
    skills: v.array(v.any()),
    languages: v.array(v.any()),
    design: v.optional(v.any()),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]),
});
