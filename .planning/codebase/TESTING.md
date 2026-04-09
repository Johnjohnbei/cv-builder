# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Runner:**
- Vitest 4.1.2
- Config: `vite.config.ts` (lines 10-14)
- Settings: globals enabled, node environment, test files pattern: `src/**/*.test.ts`

**Assertion Library:**
- Built-in Vitest assertions: `expect()`, `toBe()`, `toEqual()`, `toHaveLength()`, `toBeNull()`

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Watch mode
npm run lint             # Type check with tsc
```

## Test File Organization

**Location:**
- Co-located with source files
- Pattern: `*.test.ts` suffix (e.g., `scoring.ts` → `scoring.test.ts`)

**Naming:**
- Files: `autoFit.test.ts`, `displayModes.test.ts`, `scoring.test.ts`
- Tests found in: `src/features/editor/lib/` directory (utility/algorithm testing)

**Structure:**
```
src/features/editor/lib/
├── autoFit.ts
├── autoFit.test.ts
├── displayModes.ts
├── displayModes.test.ts
├── scoring.ts
└── scoring.test.ts
```

**Current Test Coverage:**
- 3 test files found (109 + 137 + 179 = 425 total test lines)
- No component (.tsx) tests present
- No hook tests present
- Focus on pure utility/algorithm testing

## Test Structure

**Suite Organization:**
All tests use Vitest's `describe()` and `it()` pattern with section dividers:

```typescript
import { describe, it, expect } from 'vitest';
import { functionName } from './functionName';

function makeHelper(overrides = {}): Type {
  return { ...defaultValues, ...overrides };
}

describe('functionName', () => {
  it('behaves correctly when X', () => {
    const result = functionName(input);
    expect(result).toBe(expected);
  });

  it('handles edge case Y', () => {
    expect(result).toBeNull();
  });
});
```

**Example Structure from displayModes.test.ts:**

```typescript
import { describe, it, expect } from 'vitest';
import { getVisibleBullets, getIntro, getActionBullets, shouldShowKPI, isHidden, isCompact, getVisibleSkills, isSkillHidden } from './displayModes';
import type { Experience, SkillCategory } from '@/src/shared/types';

function makeExp(overrides: Partial<Experience> = {}): Experience {
  return {
    company: 'Acme',
    position: 'Dev',
    start_date: '2020',
    current: false,
    description: ['Intro line', 'Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4'],
    ...overrides,
  };
}

describe('getVisibleBullets', () => {
  it('returns 0 bullets for hidden mode', () => {
    expect(getVisibleBullets(makeExp({ displayMode: 'hidden' }))).toEqual([]);
  });

  it('returns 2 bullets for normal mode', () => {
    expect(getVisibleBullets(makeExp({ displayMode: 'normal' }))).toHaveLength(2);
  });
});

// ─── getIntro ───

describe('getIntro', () => {
  it('returns dedicated intro field when present', () => {
    expect(getIntro(makeExp({ intro: 'My intro' }))).toBe('My intro');
  });
});
```

**Patterns:**
- setUp: Helper factory functions (`makeExp()`, `makeSkill()`) create test data with overrideable defaults
- Teardown: Not used (pure functions, no side effects to clean up)
- Assertion: Multiple assertions per test when testing same function variant

## Mocking

**Framework:** No mocking library detected (node environment, pure function testing)

**Patterns:**
- Tests work with real data structures, not mocks
- Test data created via factory functions: `makeExp()`, `makeSkills()`
- Arrays and objects created fresh for each test to avoid mutation

**What to Mock:**
- For future component tests: Would need to mock Convex hooks (`useQuery`, `useMutation`)
- Would need to mock Clerk auth (`useUser`)

**What NOT to Mock:**
- Pure utility functions tested directly (no mocking)
- Display mode logic tested with real type objects
- Immutability preserved by creating new objects in tests

## Fixtures and Factories

**Test Data:**
Factories follow naming pattern `make[Type]()`:

From `autoFit.test.ts`:
```typescript
function makeExp(mode: string = 'normal', priority: number = 50): Experience {
  return {
    company: 'Co',
    position: 'Dev',
    start_date: '2020',
    current: false,
    description: ['Did things'],
    displayMode: mode as any,
  };
}

function makeSkill(mode: string = 'normal'): SkillCategory {
  return { category: 'Tech', items: ['React', 'TS'], displayMode: mode as any };
}
```

From `displayModes.test.ts`:
```typescript
function makeExp(overrides: Partial<Experience> = {}): Experience {
  return {
    company: 'Acme',
    position: 'Dev',
    start_date: '2020',
    current: false,
    description: ['Intro line', 'Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4'],
    ...overrides,
  };
}
```

**Location:**
- Defined inside test files (co-located with tests)
- No shared fixtures directory
- Factories accept overrides parameter for test variations

## Coverage

**Requirements:** Not enforced (no coverage reporting configuration in `vite.config.ts`)

**View Coverage:** 
- Not configured
- Could add: `npm run test:coverage` with vitest coverage options (not present)

**Current State:** Test coverage appears limited to core algorithms only (3 test files for utilities, no component/hook/page tests)

## Test Types

**Unit Tests:**
- Scope: Pure utility functions
- Approach: Direct function calls with simple inputs/outputs
- Examples: `formatDateShort()`, `extractKeywords()`, `getVisibleBullets()`

**Example from scoring.test.ts:**
```typescript
describe('formatDateShort', () => {
  it('returns empty string for undefined', () => {
    expect(formatDateShort(undefined)).toBe('');
  });

  it('shortens French month names', () => {
    expect(formatDateShort('Septembre 2021')).toBe('Sept. 2021');
  });

  it('handles MM/YYYY format', () => {
    expect(formatDateShort('01/2021')).toBe('Jan. 2021');
  });
});
```

**Integration Tests:**
- Not present (no multi-component or Convex interaction tests)
- Would be needed for: useCVLoader, data loading flows, API calls

**E2E Tests:**
- Framework: Not used
- No Playwright or Cypress configuration
- No end-to-end test files found

## Common Patterns

**Immutability Testing:**
Tests verify functions don't mutate inputs:

From `autoFit.test.ts`:
```typescript
it('does not mutate input arrays', () => {
  const exps = [makeExp('extended'), makeExp('normal')];
  const skills = [makeSkill()];
  const priorities = [80, 20];

  const origExps = JSON.stringify(exps);
  const origSkills = JSON.stringify(skills);

  condenseOneStep(exps, skills, priorities);

  expect(JSON.stringify(exps)).toBe(origExps);
  expect(JSON.stringify(skills)).toBe(origSkills);
});
```

**Edge Case Testing:**
Tests include boundary conditions and null returns:

From `autoFit.test.ts`:
```typescript
it('never hides the last visible experience', () => {
  const exps = [makeExp('compact')];
  const skills: SkillCategory[] = [];
  const priorities = [10];

  const result = condenseOneStep(exps, skills, priorities);
  expect(result).toBeNull();
});

it('returns null when nothing can be condensed', () => {
  const exps = [makeExp('hidden')];
  const skills = [makeSkill('hidden')];
  const priorities = [50];

  expect(condenseOneStep(exps, skills, priorities)).toBeNull();
});
```

**Multi-step State Testing:**
Tests verify sequence of state transitions:

From `autoFit.test.ts`:
```typescript
it('steps through extended → normal → compact → hidden for lowest priority', () => {
  const exps = [makeExp('extended'), makeExp('extended')];
  const skills: SkillCategory[] = [];
  const priorities = [90, 20];

  let state = { experiences: exps, skills };
  const modes: string[] = [];

  for (let i = 0; i < 10; i++) {
    const result = condenseOneStep(state.experiences, state.skills, priorities);
    if (!result) break;
    state = result;
    modes.push(state.experiences[1].displayMode!);
  }

  expect(modes[0]).toBe('normal');
  expect(modes[1]).toBe('compact');
  expect(modes[2]).toBe('hidden');
});
```

## Testing Gaps

**No Component Tests:**
- `src/shared/ui/*.tsx` - Button, Input, ErrorBoundary, etc. untested
- `src/features/editor/components/*.tsx` - EditorHeader, TemplateConfirmModal untested
- `src/pages/*.tsx` - EditorPage, DashboardPage untested

**No Hook Tests:**
- `src/features/editor/hooks/useCVLoader.ts` - untested
- `src/features/editor/hooks/useAutoZoom.ts` - untested
- `src/features/editor/hooks/useOverflowDetection.ts` - untested
- `src/shared/hooks/*.ts` - useAccessCode, useDocumentTitle untested

**No Integration Tests:**
- Convex data loading flows
- Authentication flows
- PDF export functionality

**No E2E Tests:**
- User workflows (create CV, edit, export)
- Form interactions
- File upload/PDF parsing

**Priority Areas for Testing:**
1. Hook tests (useAutoZoom, useCVLoader, useOverflowDetection)
2. UI component tests (Button variants, Input states, form components)
3. Integration tests (data loading, save/load flows)
4. E2E tests for core user workflows (if scaling)

---

*Testing analysis: 2026-04-09*
