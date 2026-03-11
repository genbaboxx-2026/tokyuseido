import { describe, it, expect } from 'vitest'
import {
  salaryTableFormSchema,
  salaryTableUpdateSchema,
  SALARY_TABLE_LIMITS,
  SALARY_TABLE_DEFAULTS,
} from '@/lib/salary-table/index'
import { buildSalaryTableFormData } from '@tests/helpers'

// ============================================
// salaryTableFormSchema
// ============================================

describe('salaryTableFormSchema', () => {
  const validData = buildSalaryTableFormData()

  describe('正常系', () => {
    it('有効なデータでバリデーションが通る', () => {
      const result = salaryTableFormSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('nameがオプション（省略時は空文字デフォルト）', () => {
      const result = salaryTableFormSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('')
      }
    })

    it('全パラメータ指定でバリデーションが通る', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        name: 'テスト号俸テーブル',
        baseSalaryMax: 500_000,
        isActive: true,
        rankStartLetter: 'S',
        rankEndLetter: 'D',
      })
      expect(result.success).toBe(true)
    })

    it('ランク範囲がA〜Cでバリデーションが通る', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        rankStartLetter: 'A',
        rankEndLetter: 'C',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('異常系: companyId', () => {
    it('空文字でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        companyId: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: baseSalaryMin', () => {
    it('下限未満でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        baseSalaryMin: SALARY_TABLE_LIMITS.baseSalaryMin.min - 1,
      })
      expect(result.success).toBe(false)
    })

    it('上限超過でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        baseSalaryMin: SALARY_TABLE_LIMITS.baseSalaryMin.max + 1,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: initialStepDiff', () => {
    it('下限未満でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        initialStepDiff: SALARY_TABLE_LIMITS.initialStepDiff.min - 1,
      })
      expect(result.success).toBe(false)
    })

    it('上限超過でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        initialStepDiff: SALARY_TABLE_LIMITS.initialStepDiff.max + 1,
      })
      expect(result.success).toBe(false)
    })

    it('小数値でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        initialStepDiff: 1900.5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: bandIncreaseRate', () => {
    it('下限未満（1.01未満）でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        bandIncreaseRate: 1.0,
      })
      expect(result.success).toBe(false)
    })

    it('上限超過（1.20超過）でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        bandIncreaseRate: 1.21,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: stepsPerBand', () => {
    it('下限未満でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        stepsPerBand: 0,
      })
      expect(result.success).toBe(false)
    })

    it('上限超過でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        stepsPerBand: SALARY_TABLE_LIMITS.stepsPerBand.max + 1,
      })
      expect(result.success).toBe(false)
    })

    it('小数値でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        stepsPerBand: 8.5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: salaryBandCount', () => {
    it('下限未満（5未満）でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        salaryBandCount: 4,
      })
      expect(result.success).toBe(false)
    })

    it('上限超過（50超過）でエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        salaryBandCount: 51,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: ランク範囲', () => {
    it('逆順ランク（D→S）でrefineエラー', () => {
      const result = salaryTableFormSchema.safeParse({
        ...validData,
        rankStartLetter: 'D',
        rankEndLetter: 'S',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('境界値', () => {
    it('全パラメータの下限値でバリデーションが通る', () => {
      const result = salaryTableFormSchema.safeParse({
        companyId: 'c',
        baseSalaryMin: SALARY_TABLE_LIMITS.baseSalaryMin.min,
        initialStepDiff: SALARY_TABLE_LIMITS.initialStepDiff.min,
        bandIncreaseRate: SALARY_TABLE_LIMITS.bandIncreaseRate.min,
        stepsPerBand: SALARY_TABLE_LIMITS.stepsPerBand.min,
        salaryBandCount: SALARY_TABLE_LIMITS.salaryBandCount.min,
      })
      expect(result.success).toBe(true)
    })

    it('全パラメータの上限値でバリデーションが通る', () => {
      const result = salaryTableFormSchema.safeParse({
        companyId: 'c',
        baseSalaryMin: SALARY_TABLE_LIMITS.baseSalaryMin.max,
        initialStepDiff: SALARY_TABLE_LIMITS.initialStepDiff.max,
        bandIncreaseRate: SALARY_TABLE_LIMITS.bandIncreaseRate.max,
        stepsPerBand: SALARY_TABLE_LIMITS.stepsPerBand.max,
        salaryBandCount: SALARY_TABLE_LIMITS.salaryBandCount.max,
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// salaryTableUpdateSchema
// ============================================

describe('salaryTableUpdateSchema', () => {
  it('全フィールド省略でバリデーションが通る', () => {
    const result = salaryTableUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('一部フィールドのみ指定でバリデーションが通る', () => {
    const result = salaryTableUpdateSchema.safeParse({
      name: '更新テスト',
      baseSalaryMin: 200_000,
    })
    expect(result.success).toBe(true)
  })

  it('nameが空文字でエラー', () => {
    const result = salaryTableUpdateSchema.safeParse({
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('nameが100文字超でエラー', () => {
    const result = salaryTableUpdateSchema.safeParse({
      name: 'あ'.repeat(101),
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// SALARY_TABLE_DEFAULTS
// ============================================

describe('SALARY_TABLE_DEFAULTS', () => {
  it('デフォルト値がバリデーションスキーマの範囲内', () => {
    const defaults = SALARY_TABLE_DEFAULTS

    expect(defaults.baseSalaryMin).toBeGreaterThanOrEqual(SALARY_TABLE_LIMITS.baseSalaryMin.min)
    expect(defaults.baseSalaryMin).toBeLessThanOrEqual(SALARY_TABLE_LIMITS.baseSalaryMin.max)

    expect(defaults.initialStepDiff).toBeGreaterThanOrEqual(SALARY_TABLE_LIMITS.initialStepDiff.min)
    expect(defaults.initialStepDiff).toBeLessThanOrEqual(SALARY_TABLE_LIMITS.initialStepDiff.max)

    expect(defaults.bandIncreaseRate).toBeGreaterThanOrEqual(SALARY_TABLE_LIMITS.bandIncreaseRate.min)
    expect(defaults.bandIncreaseRate).toBeLessThanOrEqual(SALARY_TABLE_LIMITS.bandIncreaseRate.max)

    expect(defaults.stepsPerBand).toBeGreaterThanOrEqual(SALARY_TABLE_LIMITS.stepsPerBand.min)
    expect(defaults.stepsPerBand).toBeLessThanOrEqual(SALARY_TABLE_LIMITS.stepsPerBand.max)

    expect(defaults.salaryBandCount).toBeGreaterThanOrEqual(SALARY_TABLE_LIMITS.salaryBandCount.min)
    expect(defaults.salaryBandCount).toBeLessThanOrEqual(SALARY_TABLE_LIMITS.salaryBandCount.max)
  })
})
