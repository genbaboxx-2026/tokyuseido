/**
 * レビュー指摘事項の回帰テスト
 * 各 family_tag に対して最低1件の再発防止テストを含む
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../../../')

/**
 * family_tag: dead-code
 * console.log がコンポーネントファイルに残っていないことを検証
 */
describe('dead-code 回帰テスト', () => {
  it('EmployeeEvaluationSection.tsx にデバッグ用 console.log が残っていない', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'src/components/evaluations/EmployeeEvaluationSection.tsx'),
      'utf-8'
    )
    expect(content).not.toContain('console.log')
  })

  it('tests/helpers/index.ts に TEST_CUID_2 の re-export が残っていない', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'tests/helpers/index.ts'),
      'utf-8'
    )
    expect(content).not.toContain('TEST_CUID_2')
  })

  it('schemas.test.ts に未使用の evaluation360CreateSchema インポートが残っていない', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'tests/unit/lib/evaluation/schemas.test.ts'),
      'utf-8'
    )
    expect(content).not.toContain('evaluation360CreateSchema')
  })
})

/**
 * family_tag: type-safety
 * as any / as unknown as ダブルアサーションが対象ファイルに残っていないことを検証
 */
describe('type-safety 回帰テスト', () => {
  it('grades/page.tsx に "as any" が残っていない', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'src/app/companies/[companyId]/grades/page.tsx'),
      'utf-8'
    )
    expect(content).not.toContain('as any')
  })

  it('grades/roles/page.tsx に "as any" が残っていない', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'src/app/companies/[companyId]/grades/roles/page.tsx'),
      'utf-8'
    )
    expect(content).not.toContain('as any')
  })

  it('PersonalSheet.tsx に "as unknown as" ダブルアサーションが残っていない', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'src/components/employees/PersonalSheet.tsx'),
      'utf-8'
    )
    expect(content).not.toContain('as unknown as')
  })

  it('IndividualPreparingTab.tsx に "as unknown as" ダブルアサーションが残っていない', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'src/components/operations/individual/IndividualPreparingTab.tsx'),
      'utf-8'
    )
    expect(content).not.toContain('as unknown as')
  })
})

/**
 * family_tag: accessibility
 * 公開360度評価ページにaria属性が存在することを検証
 */
describe('accessibility 回帰テスト', () => {
  it('public 360ページのスコアボタンに aria-label と aria-pressed が設定されている', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'src/app/public/360/[token]/page.tsx'),
      'utf-8'
    )
    expect(content).toContain('aria-label=')
    expect(content).toContain('aria-pressed=')
  })

  it('public 360ページの Progress に aria-label が設定されている', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'src/app/public/360/[token]/page.tsx'),
      'utf-8'
    )
    // Progress コンポーネントに aria-label が渡されていること
    expect(content).toMatch(/Progress[^>]*aria-label/)
  })
})

/**
 * family_tag: test-reliability
 * 条件付きアサーションがテストに含まれていないことを検証
 */
describe('test-reliability 回帰テスト', () => {
  it('generator.test.ts の suggestedGrade テストに条件付きアサーションが残っていない', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'tests/unit/lib/salary-table/generator.test.ts'),
      'utf-8'
    )
    // suggestedGrade テスト周辺に if (result.hasMismatch) パターンがないこと
    const testBlock = content.slice(
      content.indexOf('suggestedGradeを提案する'),
      content.indexOf('suggestedGradeを提案する') + 300
    )
    expect(testBlock).not.toContain('if (result.hasMismatch)')
  })
})
