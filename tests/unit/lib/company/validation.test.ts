import { describe, it, expect } from 'vitest'
import {
  companySchema,
  departmentSchema,
  positionSchema,
  jobCategorySchema,
  jobTypeSchema,
} from '@/lib/company/validation'
import { buildCompanyData } from '@tests/helpers'

// ============================================
// companySchema
// ============================================

describe('companySchema', () => {
  const validData = buildCompanyData()

  describe('正常系', () => {
    it('必須項目のみで通る', () => {
      const result = companySchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('全項目指定で通る', () => {
      const result = companySchema.safeParse({
        ...validData,
        address: '東京都渋谷区1-1-1',
        representative: '山田太郎',
        establishedDate: '2020-01-01',
        businessDescription: '解体工事業',
      })
      expect(result.success).toBe(true)
    })

    it('HALF_YEARLY と YEARLY のみ許可', () => {
      expect(companySchema.safeParse({ ...validData, evaluationCycle: 'HALF_YEARLY' }).success).toBe(true)
      expect(companySchema.safeParse({ ...validData, evaluationCycle: 'YEARLY' }).success).toBe(true)
    })
  })

  describe('異常系: name', () => {
    it('空文字でエラー', () => {
      const result = companySchema.safeParse({ ...validData, name: '' })
      expect(result.success).toBe(false)
    })

    it('200文字超でエラー', () => {
      const result = companySchema.safeParse({ ...validData, name: 'あ'.repeat(201) })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: evaluationCycle', () => {
    it('無効な値でエラー', () => {
      const result = companySchema.safeParse({ ...validData, evaluationCycle: 'QUARTERLY' })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: オプション項目の文字数制限', () => {
    it('addressが500文字超でエラー', () => {
      const result = companySchema.safeParse({ ...validData, address: 'あ'.repeat(501) })
      expect(result.success).toBe(false)
    })

    it('representativeが100文字超でエラー', () => {
      const result = companySchema.safeParse({ ...validData, representative: 'あ'.repeat(101) })
      expect(result.success).toBe(false)
    })

    it('businessDescriptionが2000文字超でエラー', () => {
      const result = companySchema.safeParse({ ...validData, businessDescription: 'あ'.repeat(2001) })
      expect(result.success).toBe(false)
    })
  })

  describe('nullable項目', () => {
    it('オプション項目にnullを指定できる', () => {
      const result = companySchema.safeParse({
        ...validData,
        address: null,
        representative: null,
        establishedDate: null,
        businessDescription: null,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('境界値', () => {
    it('name 1文字で通る', () => {
      const result = companySchema.safeParse({ ...validData, name: 'あ' })
      expect(result.success).toBe(true)
    })

    it('name 200文字で通る', () => {
      const result = companySchema.safeParse({ ...validData, name: 'あ'.repeat(200) })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// departmentSchema
// ============================================

describe('departmentSchema', () => {
  it('有効なデータで通る', () => {
    const result = departmentSchema.safeParse({ name: '解体事業部' })
    expect(result.success).toBe(true)
  })

  it('parentIdを指定できる', () => {
    const result = departmentSchema.safeParse({ name: '第1課', parentId: 'dept-123' })
    expect(result.success).toBe(true)
  })

  it('parentIdにnullを指定できる', () => {
    const result = departmentSchema.safeParse({ name: '本部', parentId: null })
    expect(result.success).toBe(true)
  })

  it('nameが空文字でエラー', () => {
    const result = departmentSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('nameが100文字超でエラー', () => {
    const result = departmentSchema.safeParse({ name: 'あ'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

// ============================================
// positionSchema
// ============================================

describe('positionSchema', () => {
  it('有効なデータで通る', () => {
    const result = positionSchema.safeParse({ name: '現場主任' })
    expect(result.success).toBe(true)
  })

  it('nameが空文字でエラー', () => {
    const result = positionSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('nameが100文字超でエラー', () => {
    const result = positionSchema.safeParse({ name: 'あ'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

// ============================================
// jobCategorySchema
// ============================================

describe('jobCategorySchema', () => {
  it('有効なデータで通る', () => {
    const result = jobCategorySchema.safeParse({ name: '施工管理' })
    expect(result.success).toBe(true)
  })

  it('nameが空文字でエラー', () => {
    const result = jobCategorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('nameが100文字超でエラー', () => {
    const result = jobCategorySchema.safeParse({ name: 'あ'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

// ============================================
// jobTypeSchema
// ============================================

describe('jobTypeSchema', () => {
  it('有効なデータで通る', () => {
    const result = jobTypeSchema.safeParse({ name: '解体作業員', jobCategoryId: 'cat-123' })
    expect(result.success).toBe(true)
  })

  it('nameが空文字でエラー', () => {
    const result = jobTypeSchema.safeParse({ name: '', jobCategoryId: 'cat-123' })
    expect(result.success).toBe(false)
  })

  it('nameが100文字超でエラー', () => {
    const result = jobTypeSchema.safeParse({ name: 'あ'.repeat(101), jobCategoryId: 'cat-123' })
    expect(result.success).toBe(false)
  })

  it('jobCategoryIdが空文字でエラー', () => {
    const result = jobTypeSchema.safeParse({ name: '解体作業員', jobCategoryId: '' })
    expect(result.success).toBe(false)
  })
})
