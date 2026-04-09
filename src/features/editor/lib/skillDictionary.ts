/**
 * Skill categorization dictionary — maps skill names to category keys.
 * Used by LinkedIn parser to split flat skill lists into typed groups.
 */

import type { SkillCategory } from '@/src/shared/types';

export type SkillCategoryKey = 'technical' | 'tools' | 'methodologies' | 'soft_skills' | 'other';

export const SKILL_CATEGORY_ORDER: SkillCategoryKey[] = [
  'technical', 'tools', 'methodologies', 'soft_skills', 'other',
];

// ─── Dictionary (~200 entries) ─────────────────────────────────────

const SKILL_DICTIONARY: Record<string, SkillCategoryKey> = {
  // Technical (~80)
  'javascript': 'technical', 'typescript': 'technical', 'python': 'technical',
  'java': 'technical', 'c#': 'technical', 'c++': 'technical', 'c': 'technical',
  'go': 'technical', 'rust': 'technical', 'ruby': 'technical', 'php': 'technical',
  'swift': 'technical', 'kotlin': 'technical', 'r': 'technical', 'scala': 'technical',
  'perl': 'technical', 'dart': 'technical', 'lua': 'technical', 'haskell': 'technical',
  'elixir': 'technical', 'clojure': 'technical', 'matlab': 'technical',
  'html': 'technical', 'css': 'technical', 'sass': 'technical', 'less': 'technical',
  'react': 'technical', 'angular': 'technical', 'vue': 'technical', 'svelte': 'technical',
  'next': 'technical', 'nuxt': 'technical', 'gatsby': 'technical',
  'node': 'technical', 'express': 'technical', 'nestjs': 'technical', 'fastify': 'technical',
  'django': 'technical', 'flask': 'technical', 'spring': 'technical', 'spring boot': 'technical',
  '.net': 'technical', 'rails': 'technical', 'laravel': 'technical', 'symfony': 'technical',
  'sql': 'technical', 'nosql': 'technical', 'mongodb': 'technical', 'postgresql': 'technical',
  'mysql': 'technical', 'redis': 'technical', 'elasticsearch': 'technical', 'cassandra': 'technical',
  'graphql': 'technical', 'rest': 'technical', 'grpc': 'technical', 'websocket': 'technical',
  'machine learning': 'technical', 'deep learning': 'technical', 'nlp': 'technical',
  'computer vision': 'technical', 'data analysis': 'technical', 'data science': 'technical',
  'data engineering': 'technical', 'big data': 'technical', 'blockchain': 'technical',
  'iot': 'technical', 'embedded systems': 'technical', 'microservices': 'technical',
  'api development': 'technical', 'cloud computing': 'technical', 'devops': 'technical',
  'site reliability': 'technical', 'system design': 'technical', 'algorithms': 'technical',
  'oop': 'technical', 'functional programming': 'technical', 'tensorflow': 'technical',
  'pytorch': 'technical', 'pandas': 'technical', 'numpy': 'technical', 'spark': 'technical',
  'hadoop': 'technical', 'kafka': 'technical', 'rabbitmq': 'technical',
  'cybersecurity': 'technical', 'networking': 'technical', 'linux': 'technical',
  // FR technical
  'developpement web': 'technical', 'base de donnees': 'technical',
  'securite informatique': 'technical', 'intelligence artificielle': 'technical',
  'apprentissage automatique': 'technical', 'analyse de donnees': 'technical',
  'science des donnees': 'technical', 'informatique en nuage': 'technical',

  // Tools (~50)
  'git': 'tools', 'github': 'tools', 'gitlab': 'tools', 'bitbucket': 'tools',
  'jira': 'tools', 'confluence': 'tools', 'figma': 'tools', 'sketch': 'tools',
  'adobe xd': 'tools', 'photoshop': 'tools', 'illustrator': 'tools',
  'docker': 'tools', 'kubernetes': 'tools', 'aws': 'tools', 'azure': 'tools',
  'gcp': 'tools', 'jenkins': 'tools', 'circleci': 'tools', 'github actions': 'tools',
  'terraform': 'tools', 'ansible': 'tools', 'puppet': 'tools', 'chef': 'tools',
  'webpack': 'tools', 'vite': 'tools', 'npm': 'tools', 'yarn': 'tools', 'pnpm': 'tools',
  'vs code': 'tools', 'intellij': 'tools', 'eclipse': 'tools', 'visual studio': 'tools',
  'postman': 'tools', 'swagger': 'tools', 'insomnia': 'tools',
  'tableau': 'tools', 'power bi': 'tools', 'excel': 'tools', 'google sheets': 'tools',
  'notion': 'tools', 'trello': 'tools', 'asana': 'tools', 'monday': 'tools',
  'slack': 'tools', 'teams': 'tools', 'zoom': 'tools',
  'salesforce': 'tools', 'hubspot': 'tools', 'sap': 'tools', 'oracle': 'tools',
  'datadog': 'tools', 'grafana': 'tools', 'prometheus': 'tools', 'new relic': 'tools',
  'splunk': 'tools', 'sentry': 'tools', 'sonarqube': 'tools',

  // Methodologies (~30)
  'agile': 'methodologies', 'scrum': 'methodologies', 'kanban': 'methodologies',
  'lean': 'methodologies', 'six sigma': 'methodologies', 'design thinking': 'methodologies',
  'tdd': 'methodologies', 'bdd': 'methodologies', 'ci/cd': 'methodologies',
  'devsecops': 'methodologies', 'project management': 'methodologies',
  'product management': 'methodologies', 'change management': 'methodologies',
  'risk management': 'methodologies', 'itil': 'methodologies', 'waterfall': 'methodologies',
  'safe': 'methodologies', 'xp': 'methodologies', 'pair programming': 'methodologies',
  'code review': 'methodologies', 'a/b testing': 'methodologies',
  'ux research': 'methodologies', 'user testing': 'methodologies',
  'sprint planning': 'methodologies', 'retrospective': 'methodologies',
  'continuous integration': 'methodologies', 'continuous deployment': 'methodologies',
  'test driven development': 'methodologies',
  // FR methodologies
  'gestion de projet': 'methodologies', 'gestion du changement': 'methodologies',
  'gestion des risques': 'methodologies', 'gestion de produit': 'methodologies',
  'amelioration continue': 'methodologies',

  // Soft Skills (~40)
  'leadership': 'soft_skills', 'communication': 'soft_skills', 'teamwork': 'soft_skills',
  'problem solving': 'soft_skills', 'critical thinking': 'soft_skills',
  'adaptability': 'soft_skills', 'creativity': 'soft_skills',
  'time management': 'soft_skills', 'negotiation': 'soft_skills',
  'mentoring': 'soft_skills', 'coaching': 'soft_skills', 'collaboration': 'soft_skills',
  'presentation': 'soft_skills', 'public speaking': 'soft_skills',
  'conflict resolution': 'soft_skills', 'decision making': 'soft_skills',
  'emotional intelligence': 'soft_skills', 'strategic thinking': 'soft_skills',
  'analytical thinking': 'soft_skills', 'attention to detail': 'soft_skills',
  'organization': 'soft_skills', 'self-motivation': 'soft_skills',
  'initiative': 'soft_skills', 'empathy': 'soft_skills', 'active listening': 'soft_skills',
  'work ethic': 'soft_skills', 'flexibility': 'soft_skills', 'resilience': 'soft_skills',
  'persuasion': 'soft_skills', 'accountability': 'soft_skills',
  // FR soft skills
  'travail en equipe': 'soft_skills', 'resolution de problemes': 'soft_skills',
  'esprit critique': 'soft_skills', 'gestion du temps': 'soft_skills',
  'prise de decision': 'soft_skills', 'esprit d\'initiative': 'soft_skills',
  'sens de l\'organisation': 'soft_skills', 'autonomie': 'soft_skills',
  'rigueur': 'soft_skills', 'ecoute active': 'soft_skills',
  'esprit d\'equipe': 'soft_skills', 'capacite d\'adaptation': 'soft_skills',
  'direction': 'soft_skills',
};

// ─── Internal helpers ──────────────────────────────────────────────

/** Strips FR accents and lowercases: e/e/e->e, a/a->a, u/u->u, o/o->o, i/i->i, c->c */
function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Categorize a single skill: exact match, then suffix/prefix stripping, then 'other'. */
function categorizeSkill(skill: string): SkillCategoryKey {
  const normalized = normalizeSkill(skill);

  // Exact match
  if (SKILL_DICTIONARY[normalized]) return SKILL_DICTIONARY[normalized];

  // Strip common suffixes: .js, .ts, .py
  const stripped = normalized.replace(/\.(js|ts|py)$/i, '');
  if (stripped !== normalized && SKILL_DICTIONARY[stripped]) return SKILL_DICTIONARY[stripped];

  // Strip vendor prefixes: apache, microsoft, google
  const prefixStripped = normalized.replace(/^(apache|microsoft|google)\s+/, '');
  if (prefixStripped !== normalized && SKILL_DICTIONARY[prefixStripped]) {
    return SKILL_DICTIONARY[prefixStripped];
  }

  return 'other';
}

// ─── Public API ────────────────────────────────────────────────────

/** Groups skills by category, filters empty categories, returns in SKILL_CATEGORY_ORDER. */
export function categorizeSkills(skills: string[]): SkillCategory[] {
  if (skills.length === 0) return [];

  const groups: Record<SkillCategoryKey, string[]> = {
    technical: [], tools: [], methodologies: [], soft_skills: [], other: [],
  };

  for (const skill of skills) {
    const key = categorizeSkill(skill);
    groups[key].push(skill); // preserves original casing
  }

  return SKILL_CATEGORY_ORDER
    .filter(key => groups[key].length > 0)
    .map(key => ({ category: key, items: groups[key] }));
}
