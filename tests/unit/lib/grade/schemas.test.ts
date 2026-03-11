import { describe, it, expect } from 'vitest'
import {
  gradeFormSchema,
  gradeJobTypeConfigSchema,
  matrixUpdateSchema,
  gradeRoleSchema,
} from '@/lib/grade/schemas'
import {
  buildGradeFormData,
  buildGradeJobTypeConfigData,
  buildMatrixUpdateData,
  buildGradeRoleData,
} from '@tests/helpers'

// ============================================
// gradeFormSchema
// ============================================

describe('gradeFormSchema', () => {
  const validData = buildGradeFormData()

  describe('正常系', () => {
    it('有効なデータでバリデーションが通る', () => {
      const result = gradeFormSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('全てのemploymentTypeで通る', () => {
      const types = ['FULL_TIME', 'CONTRACT', 'OUTSOURCE', 'PART_TIME']
      for (const type of types) {
        const result = gradeFormSchema.safeParse({ ...validData, employmentType: type })
        expect(result.success).toBe(true)
      }
    })

    it('isManagementのデフォルトはfalse', () => {
      const result = gradeFormSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isManagement).toBe(false)
      }
    })

    it('isManagement=trueで通る', () => {
      const result = gradeFormSchema.safeParse({ ...validData, isManagement: true })
      expect(result.success).toBe(true)
    })
  })

  describe('異常系: name', () => {
    it('空文字でエラー', () => {
      const result = gradeFormSchema.safeParse({ ...validData, name: '' })
      expect(result.success).toBe(false)
    })

    it('50文字超でエラー', () => {
      const result = gradeFormSchema.safeParse({ ...validData, name: 'あ'.repeat(51) })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: level', () => {
    it('0以下でエラー', () => {
      const result = gradeFormSchema.safeParse({ ...validData, level: 0 })
      expect(result.success).toBe(false)
    })

    it('100超でエラー', () => {
      const result = gradeFormSchema.safeParse({ ...validData, level: 101 })
      expect(result.success).toBe(false)
    })

    it('小数値でエラー', () => {
      const result = gradeFormSchema.safeParse({ ...validData, level: 1.5 })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: employmentType', () => {
    it('無効な値でエラー', () => {
      const result = gradeFormSchema.safeParse({ ...validData, employmentType: 'INTERN' })
      expect(result.success).toBe(false)
    })
  })

  describe('異常系: companyId', () => {
    it('空文字でエラー', () => {
      const result = gradeFormSchema.safeParse({ ...validData, companyId: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('境界値', () => {
    it('name 1文字で通る', () => {
      const result = gradeFormSchema.safeParse({ ...validData, name: 'あ' })
      expect(result.success).toBe(true)
    })

    it('name 50文字で通る', () => {
      const result = gradeFormSchema.safeParse({ ...validData, name: 'あ'.repeat(50) })
      expect(result.success).toBe(true)
    })

    it('level 1で通る', () => {
      const result = gradeFormSchema.safeParse({ ...validData, level: 1 })
      expect(result.success).toBe(true)
    })

    it('level 100で通る', () => {
      const result = gradeFormSchema.safeParse({ ...validData, level: 100 })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// gradeJobTypeConfigSchema
// ============================================

describe('gradeJobTypeConfigSchema', () => {
  it('有効なデータで通る', () => {
    const result = gradeJobTypeConfigSchema.safeParse(buildGradeJobTypeConfigData())
    expect(result.success).toBe(true)
  })

  it('gradeIdが空文字でエラー', () => {
    const result = gradeJobTypeConfigSchema.safeParse(buildGradeJobTypeConfigData({ gradeId: '' }))
    expect(result.success).toBe(false)
  })

  it('jobTypeIdが空文字でエラー', () => {
    const result = gradeJobTypeConfigSchema.safeParse(buildGradeJobTypeConfigData({ jobTypeId: '' }))
    expect(result.success).toBe(false)
  })
})

// ============================================
// matrixUpdateSchema
// ============================================

describe('matrixUpdateSchema', () => {
  it('有効なデータで通る', () => {
    const result = matrixUpdateSchema.safeParse(buildMatrixUpdateData())
    expect(result.success).toBe(true)
  })

  it('空のupdates配列で通る', () => {
    const result = matrixUpdateSchema.safeParse(buildMatrixUpdateData({ updates: [] }))
    expect(result.success).toBe(true)
  })

  it('companyIdが空文字でエラー', () => {
    const result = matrixUpdateSchema.safeParse(buildMatrixUpdateData({ companyId: '' }))
    expect(result.success).toBe(false)
  })
})

// ============================================
// gradeRoleSchema
// ============================================

describe('gradeRoleSchema', () => {
  it('有効なデータで通る', () => {
    const result = gradeRoleSchema.safeParse(buildGradeRoleData())
    expect(result.success).toBe(true)
  })

  it('空の配列でデフォルト値が設定される', () => {
    const result = gradeRoleSchema.safeParse(
      buildGradeRoleData({ responsibilities: undefined, positionNames: undefined }),
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.responsibilities).toEqual([])
      expect(result.data.positionNames).toEqual([])
    }
  })

  it('gradeJobTypeConfigIdが空文字でエラー', () => {
    const result = gradeRoleSchema.safeParse(buildGradeRoleData({ gradeJobTypeConfigId: '' }))
    expect(result.success).toBe(false)
  })
})
