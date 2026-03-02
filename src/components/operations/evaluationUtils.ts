// うるう年判定
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// 号俸反映日を計算（うるう年考慮）
export const calculateSalaryReflectionDate = (month: number, day: number): string => {
  const now = new Date()
  let year = now.getFullYear()

  // 今日より前の日付なら来年
  const targetDate = new Date(year, month - 1, day)
  if (targetDate < now) {
    year++
  }

  // 2月28日設定でうるう年なら2月29日に
  let adjustedDay = day
  if (month === 2 && day === 28 && isLeapYear(year)) {
    adjustedDay = 29
  }

  return `${year}年${month}月${adjustedDay}日`
}

// 賞与支給日を計算（土日考慮、前倒し）
export const calculateBonusPaymentDate = (paymentDate: string): string => {
  const date = new Date(paymentDate)
  const now = new Date()

  // 今年または来年の日付を計算
  let year = now.getFullYear()
  const month = date.getMonth()
  let day = date.getDate()

  // 2月28日でうるう年なら2月29日に
  if (month === 1 && day === 28 && isLeapYear(year)) {
    day = 29
  }

  let targetDate = new Date(year, month, day)

  // 今日より前なら来年
  if (targetDate < now) {
    year++
    // 来年がうるう年かチェック
    if (month === 1 && date.getDate() === 28 && isLeapYear(year)) {
      day = 29
    } else {
      day = date.getDate()
    }
    targetDate = new Date(year, month, day)
  }

  // 土日の場合は前の営業日に（金曜日に前倒し）
  const dayOfWeek = targetDate.getDay()
  if (dayOfWeek === 0) {
    // 日曜 → 金曜（-2日）
    targetDate.setDate(targetDate.getDate() - 2)
  } else if (dayOfWeek === 6) {
    // 土曜 → 金曜（-1日）
    targetDate.setDate(targetDate.getDate() - 1)
  }

  return `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
}

// 日付をフォーマット（月日のみ保存されている場合は年を計算）
export const formatDateWithYear = (dateStr: string | null, referenceDate?: Date): string => {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()

  // 年が2000年の場合は、現在年に基づいて計算
  if (date.getFullYear() === 2000) {
    const now = referenceDate || new Date()
    let year = now.getFullYear()
    const targetDate = new Date(year, month - 1, day)
    if (targetDate < now) {
      year++
    }
    return `${year}年${month}月${day}日`
  }

  return `${date.getFullYear()}年${month}月${day}日`
}

// 評価期間名から対象を判定
export interface BonusSetting {
  id: string
  name: string
  paymentDate: string
  assessmentStartDate: string
  assessmentEndDate: string
}

export function parseTargets(name: string, bonusSettings: BonusSetting[]) {
  const targets: { type: "salary" | "bonus"; label: string; bonusId?: string }[] = []
  if (name.includes("号俸反映")) {
    targets.push({ type: "salary", label: "号俸反映" })
  }
  // 賞与設定の名前と照合
  for (const bonus of bonusSettings) {
    if (name.includes(bonus.name)) {
      targets.push({ type: "bonus", label: bonus.name, bonusId: bonus.id })
    }
  }
  return targets
}
