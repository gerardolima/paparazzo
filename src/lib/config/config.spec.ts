import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { loadEnv } from './config.ts'

describe('loadEnv', () => {
  const originalA = process.env.TEST_VAR_A
  const originalB = process.env.TEST_VAR_B

  afterEach(() => {
    if (originalA !== undefined) {
      process.env.TEST_VAR_A = originalA
    } else {
      delete process.env.TEST_VAR_A
    }
    if (originalB !== undefined) {
      process.env.TEST_VAR_B = originalB
    } else {
      delete process.env.TEST_VAR_B
    }
  })

  it('returns values in the same order as the requested names', () => {
    process.env.TEST_VAR_A = 'value-a'
    process.env.TEST_VAR_B = 'value-b'

    const result = loadEnv('TEST_VAR_B', 'TEST_VAR_A')

    assert.deepStrictEqual(result, ['value-b', 'value-a'])
  })

  it('returns a single-element array for one variable', () => {
    process.env.TEST_VAR_A = 'only'

    const result = loadEnv('TEST_VAR_A')

    assert.deepStrictEqual(result, ['only'])
  })

  it('throws when a variable is missing', () => {
    delete process.env.TEST_VAR_A
    process.env.TEST_VAR_B = 'present'

    assert.throws(() => loadEnv('TEST_VAR_A', 'TEST_VAR_B'), {
      message: /TEST_VAR_A/,
    })
  })

  it('throws when a variable is empty', () => {
    process.env.TEST_VAR_A = ''

    assert.throws(() => loadEnv('TEST_VAR_A'), {
      message: /TEST_VAR_A/,
    })
  })
})
