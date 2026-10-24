import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPlanDefinition,
  getCurrentUtcMonthStart,
  getTrialEndDate,
  hasSubscriptionAccess,
  isPaidPlanKey,
  isTrialExpired,
  PLAN_CATALOG,
} from './plans.ts'

test('trial dura 30 giorni e consente al massimo 10 clienti', () => {
  const start = new Date('2026-01-15T12:00:00.000Z')
  assert.equal(getTrialEndDate(start).toISOString(), '2026-02-14T12:00:00.000Z')
  assert.equal(PLAN_CATALOG.trial.maxClients, 10)
})

test('i piani hanno quote AI crescenti e sempre finite', () => {
  const quotas = [
    PLAN_CATALOG.trial.aiMonthlyRequests,
    PLAN_CATALOG.starter.aiMonthlyRequests,
    PLAN_CATALOG.professional.aiMonthlyRequests,
    PLAN_CATALOG.business.aiMonthlyRequests,
  ]
  assert.deepEqual(quotas, [10, 100, 500, 2_000])
  assert.ok(quotas.every(Number.isFinite))
})

test('il periodo AI mensile usa un confine UTC stabile', () => {
  assert.equal(
    getCurrentUtcMonthStart(new Date('2026-03-31T23:30:00-02:00')).toISOString(),
    '2026-04-01T00:00:00.000Z'
  )
})

test('l accesso scade alla fine del trial o con tenant non attivo', () => {
  const now = new Date('2026-03-01T00:00:00.000Z')
  assert.equal(isTrialExpired({ plan: 'trial', trial_ends_at: '2026-02-28T23:59:59.000Z' }, now), true)
  assert.equal(hasSubscriptionAccess({ status: 'active', plan: 'trial', trial_ends_at: '2026-03-02T00:00:00.000Z' }, now), true)
  assert.equal(hasSubscriptionAccess({ status: 'suspended', plan: 'professional' }, now), false)
})

test('solo i piani a pagamento sono accettati da Stripe', () => {
  assert.equal(isPaidPlanKey('starter'), true)
  assert.equal(isPaidPlanKey('trial'), false)
  assert.equal(getPlanDefinition('sconosciuto').key, 'trial')
})
