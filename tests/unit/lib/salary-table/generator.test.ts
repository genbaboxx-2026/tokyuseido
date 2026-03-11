import { describe, it, expect } from 'vitest'
import {
  getRankLettersInRange,
  getRankZone,
  generateRankSystem,
  getBandsPerGrade,
  generateSalaryLadder,
  calculateDefaultGradeBandAssignments,
  calculateSalaryTable,
  getGradeRankSalary,
  generateGradeRankMatrix,
  calculateBaseSalaryMax,
  generateSalaryTableEntries,
  findEmployeeSalaryPosition,
  checkGradeSalaryMismatch,
  generateDefaultSalaryAdjustmentTable,
  type SalaryTableCalculationParams,
  type GeneratedSalaryEntry,
} from '@/lib/salary-table/generator'
import { STANDARD_PARAMS, SAMPLE_GRADES } from '@tests/helpers'

// ============================================
// getRankLettersInRange
// ============================================

describe('getRankLettersInRange', () => {
  it('デフォルト（S〜D）で5文字を返す', () => {
    const result = getRankLettersInRange()
    expect(result).toEqual(['S', 'A', 'B', 'C', 'D'])
  })

  it('S〜D の指定で5文字を返す', () => {
    const result = getRankLettersInRange('S', 'D')
    expect(result).toEqual(['S', 'A', 'B', 'C', 'D'])
  })

  it('S〜F の指定で全7文字を返す', () => {
    const result = getRankLettersInRange('S', 'F')
    expect(result).toEqual(['S', 'A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('A〜C の指定で3文字を返す', () => {
    const result = getRankLettersInRange('A', 'C')
    expect(result).toEqual(['A', 'B', 'C'])
  })

  it('同じ文字（B〜B）で1文字を返す', () => {
    const result = getRankLettersInRange('B', 'B')
    expect(result).toEqual(['B'])
  })

  it('無効な範囲（D〜S、逆順）でデフォルトを返す', () => {
    const result = getRankLettersInRange('D', 'S')
    expect(result).toEqual(['S', 'A', 'B', 'C', 'D'])
  })
})

// ============================================
// getRankZone
// ============================================

describe('getRankZone', () => {
  it('有効なランク文字列からゾーンを取得する', () => {
    expect(getRankZone('S1')).toBe('S')
    expect(getRankZone('A3')).toBe('A')
    expect(getRankZone('D8')).toBe('D')
  })

  it('無効なランク文字はDを返す', () => {
    expect(getRankZone('X1')).toBe('D')
    expect(getRankZone('Z9')).toBe('D')
  })
})

// ============================================
// generateRankSystem
// ============================================

describe('generateRankSystem', () => {
  it('S〜D, stepsPerBand=8 で40ランクを生成する', () => {
    const ranks = generateRankSystem(8)
    expect(ranks).toHaveLength(40)
    expect(ranks[0]).toBe('S1')
    expect(ranks[7]).toBe('S8')
    expect(ranks[8]).toBe('A1')
    expect(ranks[39]).toBe('D8')
  })

  it('A〜C, stepsPerBand=3 で9ランクを生成する', () => {
    const ranks = generateRankSystem(3, 'A', 'C')
    expect(ranks).toHaveLength(9)
    expect(ranks[0]).toBe('A1')
    expect(ranks[8]).toBe('C3')
  })

  it('stepsPerBand=1 で各ゾーン1ランクのみ', () => {
    const ranks = generateRankSystem(1, 'S', 'D')
    expect(ranks).toHaveLength(5)
    expect(ranks).toEqual(['S1', 'A1', 'B1', 'C1', 'D1'])
  })
})

// ============================================
// getBandsPerGrade
// ============================================

describe('getBandsPerGrade', () => {
  it('S〜D で5を返す', () => {
    expect(getBandsPerGrade('S', 'D')).toBe(5)
  })

  it('S〜F で7を返す', () => {
    expect(getBandsPerGrade('S', 'F')).toBe(7)
  })

  it('A〜C で3を返す', () => {
    expect(getBandsPerGrade('A', 'C')).toBe(3)
  })
})

// ============================================
// generateSalaryLadder
// ============================================

describe('generateSalaryLadder', () => {
  it('CLAUDE.md仕様の標準パラメータで正しく号俸列を生成する', () => {
    const { salaryLadder, bands, ranks } = generateSalaryLadder(
      180_000, 1_900, 1.05, 8, 15,
    )

    // 総号俸数 = 15帯 × 8ステップ = 120
    expect(salaryLadder).toHaveLength(120)

    // 号俸1の基本給 = baseSalaryMin
    expect(salaryLadder[0].baseSalary).toBe(180_000)
    expect(salaryLadder[0].stepNumber).toBe(1)
    expect(salaryLadder[0].stepDiff).toBe(0)
    expect(salaryLadder[0].bandNumber).toBe(1)

    // 号俸帯数 = 15
    expect(bands).toHaveLength(15)
  })

  it('号俸帯1内は等差（同じ号差で加算）', () => {
    const { salaryLadder } = generateSalaryLadder(180_000, 1_900, 1.05, 8, 15)

    // 号俸帯1（号俸1〜8）の号差は1,900円
    for (let i = 1; i < 8; i++) {
      const diff = salaryLadder[i].baseSalary - salaryLadder[i - 1].baseSalary
      expect(diff).toBe(1_900)
    }
  })

  it('号俸帯2の号差は号俸帯1の号差 × 増加率', () => {
    const { salaryLadder } = generateSalaryLadder(180_000, 1_900, 1.05, 8, 15)

    // 号俸帯2（号俸9〜16）の号差 = round(1900 × 1.05) = 1995
    const expectedDiff = Math.round(1_900 * 1.05)
    for (let i = 9; i < 16; i++) {
      const diff = salaryLadder[i].baseSalary - salaryLadder[i - 1].baseSalary
      expect(diff).toBe(expectedDiff)
    }
  })

  it('各号俸帯の号差が正しく増加率倍になる', () => {
    const { bands } = generateSalaryLadder(180_000, 1_900, 1.05, 8, 15)

    // 号俸帯1の号差 = 1900
    expect(bands[0].stepDiff).toBe(1_900)

    // 号俸帯2の号差 = round(1900 * 1.05) = 1995
    expect(bands[1].stepDiff).toBe(Math.round(1_900 * 1.05))

    // 号俸帯3の号差 = round(1900 * 1.05 * 1.05) = round(2094.75) = 2095
    expect(bands[2].stepDiff).toBe(Math.round(1_900 * 1.05 * 1.05))
  })

  it('年収は基本給 × 12', () => {
    const { salaryLadder } = generateSalaryLadder(180_000, 1_900, 1.05, 8, 15)

    for (const step of salaryLadder) {
      expect(step.annualSalary).toBe(step.baseSalary * 12)
    }
  })

  it('ランク文字が号俸帯に正しく割り当てられる（最下位帯=最下位ランク）', () => {
    const { salaryLadder } = generateSalaryLadder(180_000, 1_900, 1.05, 8, 15)

    // 号俸帯1（号俸1〜8）のランク文字はD（最下位ランク）
    for (let i = 0; i < 8; i++) {
      expect(salaryLadder[i].rank.charAt(0)).toBe('D')
    }

    // 号俸帯2（号俸9〜16）のランク文字はC
    for (let i = 8; i < 16; i++) {
      expect(salaryLadder[i].rank.charAt(0)).toBe('C')
    }
  })

  it('号俸帯情報のminSalary/maxSalaryが正しい', () => {
    const { salaryLadder, bands } = generateSalaryLadder(180_000, 1_900, 1.05, 8, 15)

    for (const band of bands) {
      const stepsInBand = salaryLadder.filter(s => s.bandNumber === band.bandNumber)
      expect(band.minSalary).toBe(stepsInBand[0].baseSalary)
      expect(band.maxSalary).toBe(stepsInBand[stepsInBand.length - 1].baseSalary)
    }
  })

  it('カスタムランク範囲（A〜C）で正しく生成する', () => {
    const { salaryLadder, bands } = generateSalaryLadder(
      200_000, 2_000, 1.03, 4, 6, 'A', 'C',
    )

    // 6帯 × 4ステップ = 24号俸
    expect(salaryLadder).toHaveLength(24)
    expect(bands).toHaveLength(6)

    // ランク文字はC, B, A の3種（繰り返し）
    expect(salaryLadder[0].rank.charAt(0)).toBe('C')
    expect(salaryLadder[4].rank.charAt(0)).toBe('B')
    expect(salaryLadder[8].rank.charAt(0)).toBe('A')
  })
})

// ============================================
// calculateDefaultGradeBandAssignments
// ============================================

describe('calculateDefaultGradeBandAssignments', () => {
  it('最下位等級は号俸帯1から開始する', () => {
    const { salaryLadder, bands } = generateSalaryLadder(
      180_000, 1_900, 1.05, 8, 15,
    )

    const assignments = calculateDefaultGradeBandAssignments(
      SAMPLE_GRADES, salaryLadder, bands, 8, 15,
    )

    // level=1 が最下位
    const lowestGrade = assignments.find(a => a.gradeLevel === 1)
    expect(lowestGrade?.startBand).toBe(1)
  })

  it('等級が上がるごとに2号俸帯ずつオフセットする', () => {
    const { salaryLadder, bands } = generateSalaryLadder(
      180_000, 1_900, 1.05, 8, 15,
    )

    const assignments = calculateDefaultGradeBandAssignments(
      SAMPLE_GRADES, salaryLadder, bands, 8, 15,
    )

    const sorted = [...assignments].sort((a, b) => a.gradeLevel - b.gradeLevel)

    // 等級1: 帯1, 等級2: 帯3, 等級3: 帯5, ...
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i].startBand).toBe(1 + i * 2)
    }
  })

  it('各等級はbandsPerGrade個の号俸帯を使用する（S〜D = 5帯）', () => {
    const { salaryLadder, bands } = generateSalaryLadder(
      180_000, 1_900, 1.05, 8, 15,
    )

    const assignments = calculateDefaultGradeBandAssignments(
      SAMPLE_GRADES, salaryLadder, bands, 8, 15,
    )

    for (const assignment of assignments) {
      const expectedEnd = Math.min(assignment.startBand + 4, 15)
      expect(assignment.endBand).toBe(expectedEnd)
    }
  })

  it('空の等級配列で空の割り当てを返す', () => {
    const { salaryLadder, bands } = generateSalaryLadder(
      180_000, 1_900, 1.05, 8, 15,
    )

    const assignments = calculateDefaultGradeBandAssignments(
      [], salaryLadder, bands, 8, 15,
    )

    expect(assignments).toEqual([])
  })

  it('rankBandsが正しいランク文字とバンド番号の対応を持つ', () => {
    const { salaryLadder, bands } = generateSalaryLadder(
      180_000, 1_900, 1.05, 8, 15,
    )

    const assignments = calculateDefaultGradeBandAssignments(
      SAMPLE_GRADES, salaryLadder, bands, 8, 15,
    )

    // 最下位等級（startBand=1）のrankBands
    const lowest = assignments.find(a => a.gradeLevel === 1)!
    expect(lowest.rankBands).toHaveLength(5)
    // D=band1, C=band2, B=band3, A=band4, S=band5
    expect(lowest.rankBands[0]).toEqual({ rank: 'D', bandNumber: 1 })
    expect(lowest.rankBands[4]).toEqual({ rank: 'S', bandNumber: 5 })
  })
})

// ============================================
// calculateSalaryTable
// ============================================

describe('calculateSalaryTable', () => {
  it('CLAUDE.md仕様の標準パラメータで正しい結果を返す', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)

    expect(result.totalSteps).toBe(120)
    expect(result.totalBands).toBe(15)
    expect(result.stepsPerBand).toBe(8)
    expect(result.bandsPerGrade).toBe(5)
    expect(result.ranksPerGrade).toBe(40)
    expect(result.baseSalaryMin).toBe(180_000)
  })

  it('baseSalaryMaxが号俸列の最上位基本給と一致する', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)

    const lastStep = result.salaryLadder[result.salaryLadder.length - 1]
    expect(result.baseSalaryMax).toBe(lastStep.baseSalary)
  })

  it('gradeBandOverridesで等級の開始号俸帯を上書きできる', () => {
    const params: SalaryTableCalculationParams = {
      ...STANDARD_PARAMS,
      gradeBandOverrides: [{ gradeId: 'g1', startBand: 3 }],
    }

    const result = calculateSalaryTable(params, SAMPLE_GRADES)

    const g1Assignment = result.gradeBandAssignments.find(a => a.gradeId === 'g1')
    expect(g1Assignment?.startBand).toBe(3)
    expect(g1Assignment?.endBand).toBe(7)
  })

  it('無効なgradeBandOverrides（範囲外）は無視される', () => {
    const params: SalaryTableCalculationParams = {
      ...STANDARD_PARAMS,
      gradeBandOverrides: [{ gradeId: 'g1', startBand: 100 }],
    }

    const result = calculateSalaryTable(params, SAMPLE_GRADES)

    // デフォルトの割り当てが維持される
    const g1Assignment = result.gradeBandAssignments.find(a => a.gradeId === 'g1')
    expect(g1Assignment?.startBand).toBe(1)
  })

  it('空の等級配列でも号俸列は生成される', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, [])

    expect(result.salaryLadder).toHaveLength(120)
    expect(result.gradeBandAssignments).toEqual([])
  })
})

// ============================================
// getGradeRankSalary
// ============================================

describe('getGradeRankSalary', () => {
  it('存在する等級・ランクの基本給を取得できる', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)

    const salary = getGradeRankSalary(result, 'g1', 'D8')
    expect(salary).toBeGreaterThan(0)
  })

  it('存在しない等級IDで0を返す', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)

    const salary = getGradeRankSalary(result, 'nonexistent', 'D8')
    expect(salary).toBe(0)
  })

  it('存在しないランク文字で0を返す', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)

    const salary = getGradeRankSalary(result, 'g1', 'X1')
    expect(salary).toBe(0)
  })

  it('同じランクは同じ等級内で同じ基本給を返す', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)

    const salary1 = getGradeRankSalary(result, 'g1', 'D1')
    const salary2 = getGradeRankSalary(result, 'g1', 'D1')
    expect(salary1).toBe(salary2)
  })

  it('S1がD8より高い基本給を返す（同じ等級内）', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)

    const salaryS1 = getGradeRankSalary(result, 'g1', 'S1')
    const salaryD8 = getGradeRankSalary(result, 'g1', 'D8')
    expect(salaryS1).toBeGreaterThan(salaryD8)
  })
})

// ============================================
// generateGradeRankMatrix
// ============================================

describe('generateGradeRankMatrix', () => {
  it('各等級のマトリクスが生成される', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)
    const matrix = generateGradeRankMatrix(result)

    expect(matrix.size).toBe(SAMPLE_GRADES.length)

    for (const grade of SAMPLE_GRADES) {
      expect(matrix.has(grade.id)).toBe(true)
    }
  })

  it('各等級のマトリクスが正しいランク数のエントリを持つ', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)
    const matrix = generateGradeRankMatrix(result)

    for (const [, gradeMap] of matrix) {
      // 5ランク × 8ステップ = 40エントリ
      expect(gradeMap.size).toBe(40)
    }
  })
})

// ============================================
// calculateBaseSalaryMax
// ============================================

describe('calculateBaseSalaryMax', () => {
  it('標準パラメータで計算結果MAXを返す', () => {
    const max = calculateBaseSalaryMax(STANDARD_PARAMS)
    expect(max).toBeGreaterThan(STANDARD_PARAMS.baseSalaryMin)
  })

  it('calculateSalaryTableのbaseSalaryMaxと一致する', () => {
    const max = calculateBaseSalaryMax(STANDARD_PARAMS)
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)
    expect(max).toBe(result.baseSalaryMax)
  })
})

// ============================================
// generateSalaryTableEntries
// ============================================

describe('generateSalaryTableEntries', () => {
  it('各等級分のエントリが生成される', () => {
    const entries = generateSalaryTableEntries(STANDARD_PARAMS, SAMPLE_GRADES)

    expect(entries.length).toBeGreaterThan(0)

    // 各等級に対してエントリが存在する
    for (const grade of SAMPLE_GRADES) {
      const gradeEntries = entries.filter(e => e.gradeId === grade.id)
      expect(gradeEntries.length).toBeGreaterThan(0)
    }
  })

  it('エントリのbaseSalaryが0より大きい', () => {
    const entries = generateSalaryTableEntries(STANDARD_PARAMS, SAMPLE_GRADES)

    for (const entry of entries) {
      expect(entry.baseSalary).toBeGreaterThan(0)
    }
  })
})

// ============================================
// findEmployeeSalaryPosition
// ============================================

describe('findEmployeeSalaryPosition', () => {
  let entries: GeneratedSalaryEntry[]

  beforeAll(() => {
    entries = generateSalaryTableEntries(STANDARD_PARAMS, SAMPLE_GRADES)
  })

  it('テーブル上の基本給に完全一致する場合、isExactMatchがtrue', () => {
    const gradeEntries = entries.filter(e => e.gradeId === 'g1')
    const targetSalary = gradeEntries[0].baseSalary

    const position = findEmployeeSalaryPosition(targetSalary, 'g1', entries)
    expect(position.isExactMatch).toBe(true)
    expect(position.difference).toBe(0)
    expect(position.isWithinRange).toBe(true)
  })

  it('テーブル範囲内だが非一致の場合、最近傍の号俸を返す', () => {
    const gradeEntries = entries
      .filter(e => e.gradeId === 'g1')
      .sort((a, b) => a.baseSalary - b.baseSalary)
    const targetSalary = gradeEntries[0].baseSalary + 1

    const position = findEmployeeSalaryPosition(targetSalary, 'g1', entries)
    expect(position.isWithinRange).toBe(true)
    expect(position.isExactMatch).toBe(false)
    expect(position.tableBaseSalary).not.toBeNull()
  })

  it('テーブル範囲外の場合、isWithinRangeがfalse', () => {
    const position = findEmployeeSalaryPosition(1_000_000, 'g1', entries)
    expect(position.isWithinRange).toBe(false)
  })

  it('存在しない等級IDで全てnullを返す', () => {
    const position = findEmployeeSalaryPosition(200_000, 'nonexistent', entries)
    expect(position.stepNumber).toBeNull()
    expect(position.rank).toBeNull()
    expect(position.tableBaseSalary).toBeNull()
    expect(position.difference).toBeNull()
    expect(position.isWithinRange).toBe(false)
    expect(position.isExactMatch).toBe(false)
  })
})

// ============================================
// checkGradeSalaryMismatch
// ============================================

describe('checkGradeSalaryMismatch', () => {
  let entries: GeneratedSalaryEntry[]

  beforeAll(() => {
    entries = generateSalaryTableEntries(STANDARD_PARAMS, SAMPLE_GRADES)
  })

  it('範囲内の給与ではミスマッチなし', () => {
    const gradeEntries = entries
      .filter(e => e.gradeId === 'g1')
      .sort((a, b) => a.baseSalary - b.baseSalary)
    const midSalary = gradeEntries[Math.floor(gradeEntries.length / 2)].baseSalary

    const result = checkGradeSalaryMismatch(midSalary, 'g1', entries, SAMPLE_GRADES)
    expect(result.hasMismatch).toBe(false)
    expect(result.mismatchType).toBeNull()
  })

  it('上限超過でABOVE_RANGEを返す', () => {
    const gradeEntries = entries
      .filter(e => e.gradeId === 'g1')
      .sort((a, b) => a.baseSalary - b.baseSalary)
    const maxSalary = gradeEntries[gradeEntries.length - 1].baseSalary

    const result = checkGradeSalaryMismatch(maxSalary + 10_000, 'g1', entries, SAMPLE_GRADES)
    expect(result.hasMismatch).toBe(true)
    expect(result.mismatchType).toBe('ABOVE_RANGE')
  })

  it('下限未満でBELOW_RANGEを返す', () => {
    const gradeEntries = entries
      .filter(e => e.gradeId === 'g1')
      .sort((a, b) => a.baseSalary - b.baseSalary)
    const minSalary = gradeEntries[0].baseSalary

    const result = checkGradeSalaryMismatch(minSalary - 10_000, 'g1', entries, SAMPLE_GRADES)
    expect(result.hasMismatch).toBe(true)
    expect(result.mismatchType).toBe('BELOW_RANGE')
  })

  it('別の等級の範囲内にある場合、suggestedGradeを提案する', () => {
    // g6（最上位等級）の範囲を超える給与を g1（最下位等級）に割り当てた場合
    const g6Entries = entries
      .filter(e => e.gradeId === 'g6')
      .sort((a, b) => a.baseSalary - b.baseSalary)
    const g6MidSalary = g6Entries[Math.floor(g6Entries.length / 2)].baseSalary

    const result = checkGradeSalaryMismatch(g6MidSalary, 'g1', entries, SAMPLE_GRADES)

    expect(result.hasMismatch).toBe(true)
    expect(result.suggestedGrade).not.toBeNull()
  })

  it('等級のエントリが存在しない場合、ミスマッチなしを返す', () => {
    const result = checkGradeSalaryMismatch(200_000, 'nonexistent', entries, SAMPLE_GRADES)
    expect(result.hasMismatch).toBe(false)
  })
})

// ============================================
// generateDefaultSalaryAdjustmentTable
// ============================================

describe('generateDefaultSalaryAdjustmentTable', () => {
  it('11の評価レート行を生成する', () => {
    const table = generateDefaultSalaryAdjustmentTable(15)
    expect(table.rows).toHaveLength(11)
  })

  it('各行がtotalBands個のセルを持つ', () => {
    const totalBands = 15
    const table = generateDefaultSalaryAdjustmentTable(totalBands)

    for (const row of table.rows) {
      expect(row.cells).toHaveLength(totalBands)
    }
  })

  it('評価1の号俸変動が最も高い', () => {
    const table = generateDefaultSalaryAdjustmentTable(15)

    const rate1 = table.rows.find(r => r.evaluationRate === '1')!
    const rate6 = table.rows.find(r => r.evaluationRate === '6')!

    // 同じ号俸帯で比較
    for (let i = 0; i < rate1.cells.length; i++) {
      expect(rate1.cells[i].stepChange).toBeGreaterThan(rate6.cells[i].stepChange)
    }
  })

  it('評価レートの順序が正しい', () => {
    const table = generateDefaultSalaryAdjustmentTable(15)
    const expectedOrder = ['1', '1T', '2', '2T', '3', '3T', '4', '4T', '5', '5T', '6']

    expect(table.rows.map(r => r.evaluationRate)).toEqual(expectedOrder)
  })
})

// ============================================
// CLAUDE.md仕様の計算例の検証
// ============================================

describe('CLAUDE.md仕様の計算例', () => {
  it('号俸帯1の号差は1,900円', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)
    expect(result.bands[0].stepDiff).toBe(1_900)
  })

  it('総号俸数は120（15帯 × 8ステップ）', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)
    expect(result.totalSteps).toBe(120)
  })

  it('号俸帯15の号差は約3,762円', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)
    const band15Diff = result.bands[14].stepDiff

    // 1900 * 1.05^14 ≒ 3762
    // 累積丸めがあるので完全一致ではなく近似値チェック
    expect(band15Diff).toBeGreaterThanOrEqual(3_700)
    expect(band15Diff).toBeLessThanOrEqual(3_850)
  })

  it('計算結果MAXは約510,900円', () => {
    const result = calculateSalaryTable(STANDARD_PARAMS, SAMPLE_GRADES)

    // 丸めの影響で完全一致ではなく近似値チェック
    expect(result.baseSalaryMax).toBeGreaterThanOrEqual(505_000)
    expect(result.baseSalaryMax).toBeLessThanOrEqual(520_000)
  })
})
