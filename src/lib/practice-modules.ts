export const PRACTICE_MODULES = ['training', 'nutrition'] as const
export type PracticeModule = typeof PRACTICE_MODULES[number]

const DEFAULT_MODULES: Record<string, PracticeModule[]> = {
  personal_trainer: ['training'],
  nutritionist: ['nutrition'],
}

export function defaultModulesForProfession(profession?: string | null): PracticeModule[] {
  return DEFAULT_MODULES[profession ?? ''] ?? []
}

export function getEnabledModules(tenant?: { profession?: string | null; enabled_modules?: unknown } | null): PracticeModule[] {
  if (Array.isArray(tenant?.enabled_modules)) {
    return tenant.enabled_modules.filter((module): module is PracticeModule =>
      typeof module === 'string' && PRACTICE_MODULES.includes(module as PracticeModule)
    )
  }
  return defaultModulesForProfession(tenant?.profession)
}

export function hasPracticeModule(tenant: { profession?: string | null; enabled_modules?: unknown } | null | undefined, module: PracticeModule) {
  return getEnabledModules(tenant).includes(module)
}
