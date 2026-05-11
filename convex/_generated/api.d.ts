/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _ai_auth from "../_ai/auth.js";
import type * as _ai_chat from "../_ai/chat.js";
import type * as _ai_languageDetection from "../_ai/languageDetection.js";
import type * as _ai_normalizers from "../_ai/normalizers.js";
import type * as _ai_prompts_adapt from "../_ai/prompts/adapt.js";
import type * as _ai_prompts_analysis from "../_ai/prompts/analysis.js";
import type * as _ai_prompts_companyExtraction from "../_ai/prompts/companyExtraction.js";
import type * as _ai_prompts_coverLetter from "../_ai/prompts/coverLetter.js";
import type * as _ai_prompts_distribute from "../_ai/prompts/distribute.js";
import type * as _ai_prompts_experienceEnrichment from "../_ai/prompts/experienceEnrichment.js";
import type * as _ai_prompts_extract from "../_ai/prompts/extract.js";
import type * as _ai_prompts_fragments from "../_ai/prompts/fragments.js";
import type * as _ai_prompts_jobDescription from "../_ai/prompts/jobDescription.js";
import type * as _ai_prompts_rewrite from "../_ai/prompts/rewrite.js";
import type * as _ai_providers from "../_ai/providers.js";
import type * as _ai_schemas from "../_ai/schemas.js";
import type * as accessCodes from "../accessCodes.js";
import type * as ai from "../ai.js";
import type * as coverLetters from "../coverLetters.js";
import type * as cvs from "../cvs.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_ai/auth": typeof _ai_auth;
  "_ai/chat": typeof _ai_chat;
  "_ai/languageDetection": typeof _ai_languageDetection;
  "_ai/normalizers": typeof _ai_normalizers;
  "_ai/prompts/adapt": typeof _ai_prompts_adapt;
  "_ai/prompts/analysis": typeof _ai_prompts_analysis;
  "_ai/prompts/companyExtraction": typeof _ai_prompts_companyExtraction;
  "_ai/prompts/coverLetter": typeof _ai_prompts_coverLetter;
  "_ai/prompts/distribute": typeof _ai_prompts_distribute;
  "_ai/prompts/experienceEnrichment": typeof _ai_prompts_experienceEnrichment;
  "_ai/prompts/extract": typeof _ai_prompts_extract;
  "_ai/prompts/fragments": typeof _ai_prompts_fragments;
  "_ai/prompts/jobDescription": typeof _ai_prompts_jobDescription;
  "_ai/prompts/rewrite": typeof _ai_prompts_rewrite;
  "_ai/providers": typeof _ai_providers;
  "_ai/schemas": typeof _ai_schemas;
  accessCodes: typeof accessCodes;
  ai: typeof ai;
  coverLetters: typeof coverLetters;
  cvs: typeof cvs;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
