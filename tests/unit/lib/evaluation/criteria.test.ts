import { describe, it, expect } from 'vitest'
import {
  calculateFinalRating,
  buildCriteriaMatrix,
  matrixToArray,
  compareRatings,
  sortRatingsDesc,
  DEFAULT_CRITERIA_MATRIX,
  RATING_ORDER,
} from '@/lib/evaluation/criteria'
import type { EvaluationRating } from '@/lib/evaluation/constants'
import { ALL_RATINGS } from '@tests/helpers'

// ============================================
// DEFAULT_CRITERIA_MATRIX
// ============================================

describe('DEFAULT_CRITERIA_MATRIX', () => {
  it('全ての評価レート組み合わせ（5×5=25）が定義されている', () => {
    for (const first of ALL_RATINGS) {
      for (const second of ALL_RATINGS) {
        expect(DEFAULT_CRITERIA_MATRIX[first][second]).toBeDefined()
        expect(ALL_RATINGS).toContain(DEFAULT_CRITERIA_MATRIX[first][second])
      }
    }
  })

  it('S×SはSを返す', () => {
    expect(DEFAULT_CRITERIA_MATRIX['S']['S']).toBe('S')
  })

  it('D×DはDを返す', () => {
    expect(DEFAULT_CRITERIA_MATRIX['D']['D']).toBe('D')
  })
})

// ============================================
// calculateFinalRating
// ============================================

describe('calculateFinalRating', () => {
  it('デフォルトマトリクスで前期S×後期Sの最終評価はS', () => {
    expect(calculateFinalRating('S', 'S')).toBe('S')
  })

  it('デフォルトマトリクスで前期D×後期Dの最終評価はD', () => {
    expect(calculateFinalRating('D', 'D')).toBe('D')
  })

  it('デフォルトマトリクスで前期S×後期Dの最終評価はC', () => {
    expect(calculateFinalRating('S', 'D')).toBe('C')
  })

  it('デフォルトマトリクスで前期B×後期Bの最終評価はB', () => {
    expect(calculateFinalRating('B', 'B')).toBe('B')
  })

  it('カスタムマトリクスを使用できる', () => {
    const customMatrix: Record<EvaluationRating, Record<EvaluationRating, EvaluationRating>> = {
      S: { S: 'S', A: 'S', B: 'A', C: 'B', D: 'C' },
      A: { S: 'S', A: 'A', B: 'A', C: 'B', D: 'C' },
      B: { S: 'A', A: 'A', B: 'B', C: 'B', D: 'C' },
      C: { S: 'B', A: 'B', B: 'B', C: 'C', D: 'D' },
      D: { S: 'C', A: 'C', B: 'C', C: 'D', D: 'D' },
    }

    expect(calculateFinalRating('S', 'B', customMatrix)).toBe('A')
    expect(calculateFinalRating('C', 'D', customMatrix)).toBe('D')
  })
})

// ============================================
// buildCriteriaMatrix
// ============================================

describe('buildCriteriaMatrix', () => {
  it('空の入力でデフォルトマトリクスを返す', () => {
    const matrix = buildCriteriaMatrix([])
    expect(matrix).toEqual(DEFAULT_CRITERIA_MATRIX)
  })

  it('部分的なデータでデフォルトを上書きする', () => {
    const criteria = [
      { firstHalfRating: 'S' as const, secondHalfRating: 'S' as const, finalRating: 'A' as const },
    ]

    const matrix = buildCriteriaMatrix(criteria)

    // 上書きされた値
    expect(matrix['S']['S']).toBe('A')

    // 上書きされていない値はデフォルトのまま
    expect(matrix['D']['D']).toBe(DEFAULT_CRITERIA_MATRIX['D']['D'])
  })

  it('元のDEFAULT_CRITERIA_MATRIXを変更しない', () => {
    const originalSS = DEFAULT_CRITERIA_MATRIX['S']['S']

    buildCriteriaMatrix([
      { firstHalfRating: 'S', secondHalfRating: 'S', finalRating: 'D' },
    ])

    expect(DEFAULT_CRITERIA_MATRIX['S']['S']).toBe(originalSS)
  })

  it('全25組み合わせを上書きできる', () => {
    const criteria = ALL_RATINGS.flatMap(first =>
      ALL_RATINGS.map(second => ({
        firstHalfRating: first,
        secondHalfRating: second,
        finalRating: 'B' as const,
      })),
    )

    const matrix = buildCriteriaMatrix(criteria)

    for (const first of ALL_RATINGS) {
      for (const second of ALL_RATINGS) {
        expect(matrix[first][second]).toBe('B')
      }
    }
  })
})

// ============================================
// matrixToArray
// ============================================

describe('matrixToArray', () => {
  it('デフォルトマトリクスから25要素の配列を生成する', () => {
    const array = matrixToArray(DEFAULT_CRITERIA_MATRIX)
    expect(array).toHaveLength(25) // 5×5
  })

  it('各要素がfirstHalfRating, secondHalfRating, finalRatingを持つ', () => {
    const array = matrixToArray(DEFAULT_CRITERIA_MATRIX)

    for (const item of array) {
      expect(ALL_RATINGS).toContain(item.firstHalfRating)
      expect(ALL_RATINGS).toContain(item.secondHalfRating)
      expect(ALL_RATINGS).toContain(item.finalRating)
    }
  })

  it('buildCriteriaMatrixとの往復変換で値が保持される', () => {
    const array = matrixToArray(DEFAULT_CRITERIA_MATRIX)
    const rebuilt = buildCriteriaMatrix(array)

    for (const first of ALL_RATINGS) {
      for (const second of ALL_RATINGS) {
        expect(rebuilt[first][second]).toBe(DEFAULT_CRITERIA_MATRIX[first][second])
      }
    }
  })
})

// ============================================
// compareRatings
// ============================================

describe('compareRatings', () => {
  it('SはAより高い（正の値を返す）', () => {
    expect(compareRatings('S', 'A')).toBeGreaterThan(0)
  })

  it('DはCより低い（負の値を返す）', () => {
    expect(compareRatings('D', 'C')).toBeLessThan(0)
  })

  it('同じレートで0を返す', () => {
    expect(compareRatings('B', 'B')).toBe(0)
  })

  it('RATING_ORDERの値と整合する', () => {
    expect(RATING_ORDER['S']).toBeGreaterThan(RATING_ORDER['A'])
    expect(RATING_ORDER['A']).toBeGreaterThan(RATING_ORDER['B'])
    expect(RATING_ORDER['B']).toBeGreaterThan(RATING_ORDER['C'])
    expect(RATING_ORDER['C']).toBeGreaterThan(RATING_ORDER['D'])
  })
})

// ============================================
// sortRatingsDesc
// ============================================

describe('sortRatingsDesc', () => {
  it('高い順にソートする', () => {
    const sorted = sortRatingsDesc(['D', 'B', 'S', 'C', 'A'])
    expect(sorted).toEqual(['S', 'A', 'B', 'C', 'D'])
  })

  it('既にソート済みの配列はそのまま', () => {
    const sorted = sortRatingsDesc(['S', 'A', 'B', 'C', 'D'])
    expect(sorted).toEqual(['S', 'A', 'B', 'C', 'D'])
  })

  it('元の配列を変更しない', () => {
    const original: EvaluationRating[] = ['D', 'S', 'B']
    const sorted = sortRatingsDesc(original)

    expect(original).toEqual(['D', 'S', 'B'])
    expect(sorted).toEqual(['S', 'B', 'D'])
  })

  it('空配列で空配列を返す', () => {
    expect(sortRatingsDesc([])).toEqual([])
  })

  it('重複を含む配列も正しくソートする', () => {
    const sorted = sortRatingsDesc(['B', 'B', 'A', 'D', 'A'])
    expect(sorted).toEqual(['A', 'A', 'B', 'B', 'D'])
  })
})
