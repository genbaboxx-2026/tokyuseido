/**
 * 号俸テーブル生成ロジック
 *
 * 【設計思想：串刺し構造】
 *
 * Phase 1: 基本パラメータから1本の号俸列を生成
 * - 号俸1〜N（例: 120号俸）の基本給をMINから積み上げ計算
 * - 号俸帯ごとに号差が増加率で増える
 *
 * Phase 2: 各等級は号俸帯単位で範囲を割り当て
 * - 各等級は連続する5つの号俸帯を使用（40号俸 = 8ステップ × 5帯）
 * - 等級の範囲は号俸帯の境界でしか区切れない（号俸帯単位）
 * - 等級間でオーバーラップすることで、同じ号俸 = 同じ基本給
 */

import type { SalaryTableMatrixRow, RoundingMethod, RoundingUnit, RoundingOptions } from "@/types/salary"

// ============================================
// 丸め処理関数
// ============================================

/**
 * 金額を指定された方法と単位で丸める
 * @param value - 丸める前の金額
 * @param method - 丸め方法（none/ceil/floor/round）
 * @param unit - 丸め単位（1/10/100/1000/10000）
 * @returns 丸めた後の金額
 */
export function roundSalary(
  value: number,
  method: RoundingMethod = "none",
  unit: RoundingUnit = 1
): number {
  if (method === "none" || unit === 1) {
    return Math.round(value)
  }

  switch (method) {
    case "ceil":
      return Math.ceil(value / unit) * unit
    case "floor":
      return Math.floor(value / unit) * unit
    case "round":
      return Math.round(value / unit) * unit
    default:
      return Math.round(value)
  }
}

/**
 * 丸めオプションを適用して金額を丸める
 */
export function applyRounding(value: number, options?: RoundingOptions): number {
  if (!options) {
    return Math.round(value)
  }
  return roundSalary(value, options.method, options.unit)
}

/**
 * 利用可能なランク文字の定義
 */
export const AVAILABLE_RANK_LETTERS = ["S", "A", "B", "C", "D", "E", "F"] as const
export type RankLetter = (typeof AVAILABLE_RANK_LETTERS)[number]

/**
 * ランク範囲から使用するランク文字の配列を生成
 */
export function getRankLettersInRange(
  startLetter: RankLetter = "S",
  endLetter: RankLetter = "D"
): RankLetter[] {
  const startIndex = AVAILABLE_RANK_LETTERS.indexOf(startLetter)
  const endIndex = AVAILABLE_RANK_LETTERS.indexOf(endLetter)

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    return ["S", "A", "B", "C", "D"]
  }

  return AVAILABLE_RANK_LETTERS.slice(startIndex, endIndex + 1) as RankLetter[]
}

/**
 * ランク番号からゾーン（ランク文字）を取得
 */
export function getRankZone(rank: string): RankLetter {
  const zone = rank.charAt(0) as RankLetter
  return AVAILABLE_RANK_LETTERS.includes(zone as RankLetter) ? zone : "D"
}

/**
 * ランク体系を生成する（最上位から最下位の順）
 * 例: S1, S2, S3, ... S8, A1, A2, ... D8
 */
export function generateRankSystem(
  stepsPerBand: number,
  rankStartLetter: RankLetter = "S",
  rankEndLetter: RankLetter = "D"
): string[] {
  const zones = getRankLettersInRange(rankStartLetter, rankEndLetter)
  const ranks: string[] = []

  for (const zone of zones) {
    for (let i = 1; i <= stepsPerBand; i++) {
      ranks.push(`${zone}${i}`)
    }
  }

  return ranks
}

// ============================================
// 号俸列（単一の給与ラダー）
// ============================================

/**
 * 号俸列の各号俸
 */
export interface SalaryStep {
  stepNumber: number        // 号俸番号（1が最下位、Nが最上位）
  baseSalary: number        // 基本給
  bandNumber: number        // 所属する号俸帯番号（1が最下位）
  stepDiff: number          // この号俸の号差（前号俸との差額）
  rank: string              // ランク（S1, D8など）- 号俸帯内での位置に対応
  annualSalary: number      // 年収（基本給×12）
}

/**
 * 号俸帯情報
 */
export interface SalaryBandInfo {
  bandNumber: number        // 号俸帯番号（1が最下位）
  letter: string            // ランク文字（D, C, B, A, S等）
  stepDiff: number          // この号俸帯の号差
  startStep: number         // 開始号俸番号
  endStep: number           // 終了号俸番号
  minSalary: number         // 開始号俸の基本給
  maxSalary: number         // 終了号俸の基本給
}

/**
 * 等級の号俸帯割り当て
 */
export interface GradeBandAssignment {
  gradeId: string
  gradeName: string
  gradeLevel: number
  startBand: number         // 開始号俸帯（ユーザーが設定）
  endBand: number           // 終了号俸帯（= startBand + 4、自動計算）
  startStep: number         // 開始号俸（自動計算）
  endStep: number           // 終了号俸（自動計算）
  minSalary: number         // 開始号俸の基本給（自動計算）
  maxSalary: number         // 終了号俸の基本給（自動計算）
  // 各ランクに対応する号俸帯（D=startBand, C=startBand+1, ..., S=endBand）
  rankBands: { rank: RankLetter; bandNumber: number }[]
}

/**
 * 号俸テーブル全体の計算結果
 */
export interface SalaryTableCalculationResult {
  salaryLadder: SalaryStep[]              // 1本の号俸列（串）
  bands: SalaryBandInfo[]                 // 号俸帯一覧
  ranks: string[]                         // ランク一覧（S1〜D8等）
  totalSteps: number                      // 総号俸数
  totalBands: number                      // 総号俸帯数
  stepsPerBand: number                    // 号俸帯内ステップ数
  bandsPerGrade: number                   // 各等級の号俸帯数（= ランク数）
  ranksPerGrade: number                   // 各等級の号俸数（= stepsPerBand × bandsPerGrade）
  gradeBandAssignments: GradeBandAssignment[]  // 等級ごとの号俸帯割り当て
  baseSalaryMin: number                   // 最低基本給
  baseSalaryMax: number                   // 最高基本給
}

/**
 * 計算パラメータ
 */
export interface SalaryTableCalculationParams {
  baseSalaryMin: number           // 号俸1の基本給（最下位）
  initialStepDiff: number         // 初期号差（最下位号俸帯の号差）
  bandIncreaseRate: number        // 号俸帯間増加率
  stepsPerBand: number            // 号俸帯内ステップ数（例: 8）
  salaryBandCount: number         // 号俸帯数（例: 15）
  rankStartLetter?: RankLetter    // 開始ランク文字（最上位）
  rankEndLetter?: RankLetter      // 終了ランク文字（最下位）
  gradeBandOverrides?: { gradeId: string; startBand: number }[]  // 等級別開始号俸帯の上書き
  roundingMethod?: RoundingMethod // 丸め方法
  roundingUnit?: RoundingUnit     // 丸め単位
}

/**
 * 等級情報
 */
export interface GradeInfo {
  id: string
  name: string
  level: number
}

/**
 * ランク範囲から等級あたりの号俸帯数を計算
 * S〜D = 5帯, S〜C = 4帯, S〜B = 3帯, S〜E = 6帯
 */
export function getBandsPerGrade(
  rankStartLetter: RankLetter = "S",
  rankEndLetter: RankLetter = "D"
): number {
  const rankLetters = getRankLettersInRange(rankStartLetter, rankEndLetter)
  return rankLetters.length
}

/**
 * デフォルトの等級あたり号俸帯数（S〜D = 5帯）
 * @deprecated Use getBandsPerGrade() instead
 */
export const BANDS_PER_GRADE = 5

/**
 * 1本の号俸列（串）を生成する
 * 号俸1（最下位）から号俸N（最上位）までの基本給を計算
 */
export function generateSalaryLadder(
  baseSalaryMin: number,
  initialStepDiff: number,
  bandIncreaseRate: number,
  stepsPerBand: number,
  salaryBandCount: number,
  rankStartLetter: RankLetter = "S",
  rankEndLetter: RankLetter = "D",
  roundingMethod: RoundingMethod = "none",
  roundingUnit: RoundingUnit = 1
): { salaryLadder: SalaryStep[]; bands: SalaryBandInfo[]; ranks: string[] } {
  const totalSteps = salaryBandCount * stepsPerBand

  // 各号俸帯で使用するランク文字を決定
  // 号俸帯1〜5 = D,C,B,A,S、号俸帯6〜10 = D,C,B,A,S（繰り返し）
  const rankLetters = getRankLettersInRange(rankStartLetter, rankEndLetter)

  // ランク体系を生成（S1〜D8等）- プレビュー用
  const ranks = generateRankSystem(stepsPerBand, rankStartLetter, rankEndLetter)

  // 号俸帯ごとの号差を計算（号俸帯1から順に）
  const bandStepDiffs: number[] = []
  let currentStepDiff = initialStepDiff
  for (let i = 0; i < salaryBandCount; i++) {
    bandStepDiffs.push(Math.round(currentStepDiff))
    currentStepDiff = currentStepDiff * bandIncreaseRate
  }

  // 号俸帯情報を生成
  const bands: SalaryBandInfo[] = []

  // 号俸列を生成（号俸1から号俸N）
  const salaryLadder: SalaryStep[] = []
  let currentSalary = baseSalaryMin

  for (let step = 1; step <= totalSteps; step++) {
    // この号俸が属する号俸帯を決定（0-indexed）
    const bandIndex = Math.floor((step - 1) / stepsPerBand)
    const bandNumber = bandIndex + 1
    const stepDiff = bandStepDiffs[bandIndex]

    // 号俸帯内での位置（0-indexed）
    const positionInBand = (step - 1) % stepsPerBand

    // この号俸帯に対応するランク文字（号俸帯を5帯ごとに繰り返し）
    const rankLetterIndex = bandIndex % rankLetters.length
    // 号俸帯内はD（最下位）からS（最上位）の順なので逆順
    const letterForBand = rankLetters[rankLetters.length - 1 - rankLetterIndex]

    // ランク（例: D8, D7, ..., D1）
    const rank = `${letterForBand}${stepsPerBand - positionInBand}`

    // 号俸1は号差なし、それ以降は号差を加算
    if (step > 1) {
      currentSalary = currentSalary + stepDiff
    }

    // 丸め処理を適用
    const roundedSalary = roundSalary(currentSalary, roundingMethod, roundingUnit)

    salaryLadder.push({
      stepNumber: step,
      baseSalary: roundedSalary,
      bandNumber,
      stepDiff: step === 1 ? 0 : stepDiff,
      rank,
      annualSalary: roundedSalary * 12,
    })
  }

  // 号俸帯情報を完成させる
  for (let i = 0; i < salaryBandCount; i++) {
    const bandNumber = i + 1
    const startStep = i * stepsPerBand + 1
    const endStep = (i + 1) * stepsPerBand

    // この号俸帯に対応するランク文字
    const rankLetterIndex = i % rankLetters.length
    const letter = rankLetters[rankLetters.length - 1 - rankLetterIndex]

    const minSalary = salaryLadder.find(s => s.stepNumber === startStep)?.baseSalary || 0
    const maxSalary = salaryLadder.find(s => s.stepNumber === endStep)?.baseSalary || 0

    bands.push({
      bandNumber,
      letter,
      stepDiff: bandStepDiffs[i],
      startStep,
      endStep,
      minSalary,
      maxSalary,
    })
  }

  return { salaryLadder, bands, ranks }
}

/**
 * 等級ごとのデフォルト号俸帯割り当てを計算
 * 各等級は連続するN個の号俸帯を使用（Nはランク数）
 * 等級が上がるごとに2号俸帯ずつずらす（オーバーラップ）
 */
export function calculateDefaultGradeBandAssignments(
  grades: GradeInfo[],
  salaryLadder: SalaryStep[],
  bands: SalaryBandInfo[],
  stepsPerBand: number,
  totalBands: number,
  rankStartLetter: RankLetter = "S",
  rankEndLetter: RankLetter = "D"
): GradeBandAssignment[] {
  const sortedGrades = [...grades].sort((a, b) => a.level - b.level) // 低い等級から
  const gradeCount = sortedGrades.length
  const rankLetters = getRankLettersInRange(rankStartLetter, rankEndLetter)
  const bandsPerGrade = rankLetters.length // ランク数 = 等級あたりの号俸帯数

  if (gradeCount === 0 || bands.length === 0) return []

  // 等級ごとに開始号俸帯を計算
  // 最下位等級は号俸帯1から、等級が上がるごとに2号俸帯ずつずらす
  const assignments: GradeBandAssignment[] = []

  for (let i = 0; i < gradeCount; i++) {
    const grade = sortedGrades[i]

    // 開始号俸帯 = 1 + (等級インデックス × 2)
    // 例: 等級0(正⑥)=1, 等級1(正⑤)=3, 等級2(正④)=5, 等級3(正③)=7, 等級4(正②)=9, 等級5(正①)=11
    const startBand = 1 + i * 2

    // 終了号俸帯 = 開始号俸帯 + (ランク数 - 1)
    const endBand = Math.min(startBand + bandsPerGrade - 1, totalBands)

    // 号俸範囲
    const startStep = (startBand - 1) * stepsPerBand + 1
    const endStep = endBand * stepsPerBand

    // 基本給範囲
    const minSalary = salaryLadder.find(s => s.stepNumber === startStep)?.baseSalary || 0
    const maxSalary = salaryLadder.find(s => s.stepNumber === endStep)?.baseSalary || 0

    // 各ランクに対応する号俸帯（最下位ランク=startBand, ... 最上位ランク=endBand）
    const rankBands: { rank: RankLetter; bandNumber: number }[] = []
    for (let j = 0; j < bandsPerGrade && startBand + j <= totalBands; j++) {
      // 逆順: j=0→最下位ランク, j=bandsPerGrade-1→最上位ランク
      const rankLetter = rankLetters[rankLetters.length - 1 - j] || rankLetters[0]
      rankBands.push({
        rank: rankLetter,
        bandNumber: startBand + j,
      })
    }

    assignments.push({
      gradeId: grade.id,
      gradeName: grade.name,
      gradeLevel: grade.level,
      startBand,
      endBand,
      startStep,
      endStep,
      minSalary,
      maxSalary,
      rankBands,
    })
  }

  return assignments
}

/**
 * 号俸テーブルを計算する
 */
export function calculateSalaryTable(
  params: SalaryTableCalculationParams,
  grades: GradeInfo[]
): SalaryTableCalculationResult {
  const {
    baseSalaryMin,
    initialStepDiff,
    bandIncreaseRate,
    stepsPerBand,
    salaryBandCount,
    rankStartLetter = "S",
    rankEndLetter = "D",
    gradeBandOverrides,
    roundingMethod = "none",
    roundingUnit = 1,
  } = params

  // ランク範囲から等級あたりの号俸帯数を計算
  const bandsPerGrade = getBandsPerGrade(rankStartLetter, rankEndLetter)

  // 1本の号俸列を生成（丸めオプションを渡す）
  const { salaryLadder, bands, ranks } = generateSalaryLadder(
    baseSalaryMin,
    initialStepDiff,
    bandIncreaseRate,
    stepsPerBand,
    salaryBandCount,
    rankStartLetter,
    rankEndLetter,
    roundingMethod,
    roundingUnit
  )

  const totalSteps = salaryLadder.length
  const totalBands = bands.length
  const ranksPerGrade = bandsPerGrade * stepsPerBand // 各等級の号俸数（例: 5ランク × 8ステップ = 40号俸）

  // 等級ごとの号俸帯割り当てを計算
  let gradeBandAssignments = calculateDefaultGradeBandAssignments(
    grades,
    salaryLadder,
    bands,
    stepsPerBand,
    totalBands,
    rankStartLetter,
    rankEndLetter
  )

  // オーバーライドがあれば適用
  if (gradeBandOverrides && gradeBandOverrides.length > 0) {
    const rankLetters = getRankLettersInRange(rankStartLetter, rankEndLetter)

    gradeBandAssignments = gradeBandAssignments.map(assignment => {
      const override = gradeBandOverrides.find(o => o.gradeId === assignment.gradeId)
      if (override && override.startBand >= 1 && override.startBand <= totalBands - bandsPerGrade + 1) {
        const startBand = override.startBand
        const endBand = Math.min(startBand + bandsPerGrade - 1, totalBands)
        const startStep = (startBand - 1) * stepsPerBand + 1
        const endStep = endBand * stepsPerBand
        const minSalary = salaryLadder.find(s => s.stepNumber === startStep)?.baseSalary || 0
        const maxSalary = salaryLadder.find(s => s.stepNumber === endStep)?.baseSalary || 0

        // 各ランクに対応する号俸帯
        const rankBands: { rank: RankLetter; bandNumber: number }[] = []
        for (let j = 0; j < bandsPerGrade && startBand + j <= totalBands; j++) {
          const rankLetter = rankLetters[rankLetters.length - 1 - j] || rankLetters[0]
          rankBands.push({
            rank: rankLetter,
            bandNumber: startBand + j,
          })
        }

        return {
          ...assignment,
          startBand,
          endBand,
          startStep,
          endStep,
          minSalary,
          maxSalary,
          rankBands,
        }
      }
      return assignment
    })
  }

  // 最低・最高基本給
  const baseSalaryMax = salaryLadder.length > 0
    ? salaryLadder[salaryLadder.length - 1].baseSalary
    : 0

  return {
    salaryLadder,
    bands,
    ranks,
    totalSteps,
    totalBands,
    stepsPerBand,
    bandsPerGrade,
    ranksPerGrade,
    gradeBandAssignments,
    baseSalaryMin,
    baseSalaryMax,
  }
}

/**
 * 等級のランクに対応する基本給を取得
 * 等級の号俸帯範囲内から、ランクに対応する号俸の基本給を取得
 */
export function getGradeRankSalary(
  result: SalaryTableCalculationResult,
  gradeId: string,
  rank: string  // 例: "S1", "A3", "D8"
): number {
  const assignment = result.gradeBandAssignments.find(a => a.gradeId === gradeId)
  if (!assignment) return 0

  // ランクをパース
  const rankLetter = rank.charAt(0) as RankLetter
  const rankNumber = parseInt(rank.slice(1), 10)

  // このランク文字に対応する号俸帯を検索
  const bandForRank = assignment.rankBands.find(rb => rb.rank === rankLetter)
  if (!bandForRank) return 0

  // 号俸帯内での位置から号俸番号を計算
  // rankNumber=1が号俸帯の最上位、=8が最下位
  const stepInBand = result.stepsPerBand - rankNumber + 1  // 1→8, 8→1
  const stepNumber = (bandForRank.bandNumber - 1) * result.stepsPerBand + stepInBand

  const step = result.salaryLadder.find(s => s.stepNumber === stepNumber)
  return step?.baseSalary || 0
}

/**
 * 等級×ランクの給与マトリクスを生成
 */
export function generateGradeRankMatrix(
  result: SalaryTableCalculationResult
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>()

  for (const assignment of result.gradeBandAssignments) {
    const gradeMap = new Map<string, number>()

    // この等級が使用するすべてのランク（S1〜D8等）
    for (const rankBand of assignment.rankBands) {
      for (let i = 1; i <= result.stepsPerBand; i++) {
        const rank = `${rankBand.rank}${i}`
        const salary = getGradeRankSalary(result, assignment.gradeId, rank)
        gradeMap.set(rank, salary)
      }
    }

    matrix.set(assignment.gradeId, gradeMap)
  }

  return matrix
}

/**
 * パラメータから最高給与（号俸列の最上位）を計算
 */
export function calculateBaseSalaryMax(params: SalaryTableCalculationParams): number {
  const { salaryLadder } = generateSalaryLadder(
    params.baseSalaryMin,
    params.initialStepDiff,
    params.bandIncreaseRate,
    params.stepsPerBand,
    params.salaryBandCount,
    params.rankStartLetter,
    params.rankEndLetter,
    params.roundingMethod,
    params.roundingUnit
  )

  return salaryLadder.length > 0 ? salaryLadder[salaryLadder.length - 1].baseSalary : 0
}

// ============================================
// 旧型との互換性のための型定義・関数
// ============================================

export interface SalaryStepDetail {
  stepNumber: number
  rank: string
  baseSalary: number
  stepDiff: number
  bandNumber: number
  isBandBoundary: boolean
  increaseAmount: number
  bandIncreaseRate: number
  annualSalary: number
}

/**
 * 号俸テーブルエントリを生成（DB保存用）
 */
export interface GeneratedSalaryEntry {
  gradeId: string
  stepNumber: number
  rank: string
  baseSalary: number
}

export function generateSalaryTableEntries(
  params: SalaryTableCalculationParams,
  grades: GradeInfo[]
): GeneratedSalaryEntry[] {
  const result = calculateSalaryTable(params, grades)
  const entries: GeneratedSalaryEntry[] = []
  const matrix = generateGradeRankMatrix(result)

  for (const assignment of result.gradeBandAssignments) {
    const gradeMap = matrix.get(assignment.gradeId)
    if (!gradeMap) continue

    // ランクごとにエントリを生成
    let stepCounter = assignment.endStep - assignment.startStep + 1
    for (const rankBand of assignment.rankBands) {
      for (let i = 1; i <= result.stepsPerBand; i++) {
        const rank = `${rankBand.rank}${i}`
        const baseSalary = gradeMap.get(rank) || 0

        entries.push({
          gradeId: assignment.gradeId,
          stepNumber: stepCounter,
          rank,
          baseSalary,
        })
        stepCounter--
      }
    }
  }

  return entries
}

/**
 * 後方互換性のための関数
 */
export function generateSalaryTable(
  params: {
    baseSalaryMax: number
    baseSalaryMin: number
    stepsPerBand: number
    bandIncreaseRate: number
    initialStepDiff: number
    salaryBandCount: number
    rankStartLetter?: RankLetter
    rankEndLetter?: RankLetter
    gradeOverrides?: { gradeId: string; startBand: number }[]
  },
  grades: GradeInfo[]
): GeneratedSalaryEntry[] {
  return generateSalaryTableEntries(
    {
      baseSalaryMin: params.baseSalaryMin,
      initialStepDiff: params.initialStepDiff,
      bandIncreaseRate: params.bandIncreaseRate,
      stepsPerBand: params.stepsPerBand,
      salaryBandCount: params.salaryBandCount,
      rankStartLetter: params.rankStartLetter,
      rankEndLetter: params.rankEndLetter,
      gradeBandOverrides: params.gradeOverrides,
    },
    grades
  )
}

/**
 * 等級ごとの基本給範囲を計算（旧互換用）
 */
export function calculateGradeRanges(
  steps: SalaryStepDetail[],
  grades: GradeInfo[],
  stepsPerBand: number
): Map<string, { min: number; max: number; startStep: number; endStep: number }> {
  return new Map()
}

/**
 * エントリをマトリクス形式に変換（旧互換）
 */
export function entriesToMatrix(
  entries: GeneratedSalaryEntry[],
  grades: GradeInfo[],
  params: {
    baseSalaryMax: number
    baseSalaryMin: number
    stepsPerBand: number
    salaryBandCount: number
    rankStartLetter?: RankLetter
    rankEndLetter?: RankLetter
  }
): SalaryTableMatrixRow[] {
  const totalSteps = params.stepsPerBand * params.salaryBandCount
  const ranks = generateRankSystem(
    params.stepsPerBand,
    params.rankStartLetter,
    params.rankEndLetter
  )

  const entryMap = new Map<string, GeneratedSalaryEntry>()
  for (const entry of entries) {
    entryMap.set(`${entry.gradeId}-${entry.stepNumber}`, entry)
  }

  const rows: SalaryTableMatrixRow[] = []
  const sortedGrades = [...grades].sort((a, b) => b.level - a.level)

  for (let step = 1; step <= totalSteps; step++) {
    const rankIndex = totalSteps - step
    const rank = ranks[rankIndex] || ranks[ranks.length - 1]

    const rowEntries = sortedGrades.map((grade) => {
      const entry = entryMap.get(`${grade.id}-${step}`)
      return {
        gradeId: grade.id,
        baseSalary: entry?.baseSalary ?? 0,
        annualSalary: (entry?.baseSalary ?? 0) * 12,
      }
    })

    rows.push({
      stepNumber: step,
      rank,
      entries: rowEntries,
    })
  }

  return rows
}

/**
 * 従業員の基本給から最も近い号俸を検索
 */
export interface EmployeeSalaryPosition {
  stepNumber: number | null
  rank: string | null
  tableBaseSalary: number | null
  difference: number | null
  isWithinRange: boolean
  isExactMatch: boolean
}

export function findEmployeeSalaryPosition(
  baseSalary: number,
  gradeId: string,
  entries: GeneratedSalaryEntry[]
): EmployeeSalaryPosition {
  const gradeEntries = entries
    .filter((e) => e.gradeId === gradeId)
    .sort((a, b) => a.baseSalary - b.baseSalary)

  if (gradeEntries.length === 0) {
    return {
      stepNumber: null,
      rank: null,
      tableBaseSalary: null,
      difference: null,
      isWithinRange: false,
      isExactMatch: false,
    }
  }

  const minSalary = gradeEntries[0].baseSalary
  const maxSalary = gradeEntries[gradeEntries.length - 1].baseSalary
  const isWithinRange = baseSalary >= minSalary && baseSalary <= maxSalary

  let closestEntry = gradeEntries[0]
  let minDiff = Math.abs(baseSalary - closestEntry.baseSalary)

  for (const entry of gradeEntries) {
    const diff = Math.abs(baseSalary - entry.baseSalary)
    if (diff < minDiff) {
      minDiff = diff
      closestEntry = entry
    }
  }

  return {
    stepNumber: closestEntry.stepNumber,
    rank: closestEntry.rank,
    tableBaseSalary: closestEntry.baseSalary,
    difference: baseSalary - closestEntry.baseSalary,
    isWithinRange,
    isExactMatch: minDiff === 0,
  }
}

/**
 * 従業員の等級と基本給のミスマッチをチェック
 */
export function checkGradeSalaryMismatch(
  employeeBaseSalary: number,
  employeeGradeId: string,
  entries: GeneratedSalaryEntry[],
  grades: GradeInfo[]
): {
  hasMismatch: boolean
  mismatchType: "ABOVE_RANGE" | "BELOW_RANGE" | "WRONG_GRADE" | null
  suggestedGrade: GradeInfo | null
} {
  const gradeEntries = entries
    .filter((e) => e.gradeId === employeeGradeId)
    .sort((a, b) => a.baseSalary - b.baseSalary)

  if (gradeEntries.length === 0) {
    return { hasMismatch: false, mismatchType: null, suggestedGrade: null }
  }

  const minSalary = gradeEntries[0].baseSalary
  const maxSalary = gradeEntries[gradeEntries.length - 1].baseSalary

  if (employeeBaseSalary >= minSalary && employeeBaseSalary <= maxSalary) {
    return { hasMismatch: false, mismatchType: null, suggestedGrade: null }
  }

  let suggestedGrade: GradeInfo | null = null
  for (const grade of grades) {
    if (grade.id === employeeGradeId) continue

    const otherEntries = entries
      .filter((e) => e.gradeId === grade.id)
      .sort((a, b) => a.baseSalary - b.baseSalary)

    if (otherEntries.length > 0) {
      const otherMin = otherEntries[0].baseSalary
      const otherMax = otherEntries[otherEntries.length - 1].baseSalary

      if (employeeBaseSalary >= otherMin && employeeBaseSalary <= otherMax) {
        suggestedGrade = grade
        break
      }
    }
  }

  return {
    hasMismatch: true,
    mismatchType: employeeBaseSalary > maxSalary ? "ABOVE_RANGE" : "BELOW_RANGE",
    suggestedGrade,
  }
}

// ============================================
// 等級別号俸改定基準テーブル用の型定義
// ============================================

/**
 * 評価レートの定義
 */
export type EvaluationRate = "1" | "1T" | "2" | "2T" | "3" | "3T" | "4" | "4T" | "5" | "5T" | "6"

/**
 * 号俸改定基準セル
 */
export interface SalaryAdjustmentCell {
  evaluationRate: EvaluationRate
  bandNumber: number
  stepChange: number  // +2, +1, 0, -1 など
}

/**
 * 号俸改定基準テーブル全体
 */
export interface SalaryAdjustmentTable {
  rows: {
    evaluationRate: EvaluationRate
    cells: { bandNumber: number; stepChange: number }[]
  }[]
}

/**
 * デフォルトの号俸改定基準を生成
 * スプレッドシートの2枚目と同じ構造
 */
export function generateDefaultSalaryAdjustmentTable(
  totalBands: number
): SalaryAdjustmentTable {
  // 評価レート（高い方から）
  const evaluationRates: EvaluationRate[] = ["1", "1T", "2", "2T", "3", "3T", "4", "4T", "5", "5T", "6"]

  const rows = evaluationRates.map((rate) => {
    const cells = []
    for (let band = 1; band <= totalBands; band++) {
      // デフォルトの号俸変動計算
      // 評価が高いほど、号俸帯が低いほど上がり幅が大きい
      let stepChange = 0

      // 基本ロジック（仮）
      // 評価1: +3〜+4
      // 評価2: +2〜+3
      // 評価3: +1〜+2
      // 評価4: 0〜+1
      // 評価5: -1〜0
      // 評価6: -2〜-1
      // 号俸帯が低いほど上がり幅が大きい

      const rateValue = parseInt(rate.replace("T", ""), 10)
      const isTransition = rate.includes("T")
      const baseChange = 4 - rateValue  // 1→+3, 2→+2, 3→+1, 4→0, 5→-1, 6→-2

      // 号俸帯による補正（低い号俸帯ほどボーナス）
      const bandBonus = Math.max(0, Math.floor((totalBands - band) / 5))

      stepChange = baseChange + bandBonus
      if (isTransition) {
        stepChange = Math.max(stepChange - 1, baseChange - 1)
      }

      cells.push({ bandNumber: band, stepChange })
    }
    return { evaluationRate: rate, cells }
  })

  return { rows }
}
