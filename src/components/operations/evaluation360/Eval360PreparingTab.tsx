"use client"

import React, { useMemo, useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  FileText,
  CheckCircle,
  Pencil,
  Send,
  Users,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Employee360EvaluationItemsDialog } from "@/components/evaluations/Employee360EvaluationItemsDialog"
import { DistributionConfirmModal } from "@/components/operations/evaluation360/DistributionConfirmModal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Eval360PreparingTabProps {
  companyId: string
  periodId: string
  onStatusChange: () => void
  onDistributionStart?: () => void
}

type Phase360 = "preparing" | "distributing" | "aggregated" | "completed"

interface Record360 {
  id: string
  employeeId: string
  status: string
  currentPhase: Phase360
  isAnonymous: boolean
  evaluationMethod: string
  reviewerCount: number
  categoryCount: number
  maxScore?: number
  reviewerIds?: string[]
  employee: {
    id: string
    employeeCode?: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
    department: { name: string } | null
    gradeId?: string | null
    jobTypeId?: string | null
  }
}

interface EmployeeOption {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

interface Template360 {
  id: string
  name: string
  status: string
  grades: { id: string; name: string }[]
  jobTypes: { id: string; name: string }[]
  categoryCount: number
  itemCount: number
  totalMaxScore: number
  periodId?: string | null
  sourceTemplateId?: string | null
}

export function Eval360PreparingTab({
  companyId,
  periodId,
  onStatusChange,
  onDistributionStart,
}: Eval360PreparingTabProps) {
  const queryClient = useQueryClient()

  // モーダル状態
  const [selectedRecord, setSelectedRecord] = useState<Record360 | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<Template360 | null>(null)

  // 楽観的更新用のローカルチェック状態
  const [optimisticChecked, setOptimisticChecked] = useState<Record<string, boolean>>({})
  const [editFormData, setEditFormData] = useState<{
    categories: { name: string; sortOrder: number; isExpanded: boolean; items: { content: string; sortOrder: number; maxScore: number }[] }[]
  }>({ categories: [] })

  // 各レコードの評価者設定（ローカルステート）
  const [reviewerSettings, setReviewerSettings] = useState<Record<string, (string | null)[]>>({})

  // 配布確認モーダル状態
  const [showDistributionModal, setShowDistributionModal] = useState(false)

  // テンプレート一括適用モーダル状態
  const [applyingTemplate, setApplyingTemplate] = useState<Template360 | null>(null)
  const [applyOverwrite, setApplyOverwrite] = useState(false)

  // 全レコードを取得（全タブでキャッシュ共有）
  const { data, isLoading } = useQuery<{ records: Record360[] }>({
    queryKey: ["360Records", companyId, periodId, "all"],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360?includeAll=true`
      )
      if (!res.ok) throw new Error("データの取得に失敗しました")
      return res.json()
    },
    staleTime: 30000,
  })

  // 全従業員を取得（評価者選択用）
  const { data: employeesData } = useQuery<{ employees: EmployeeOption[] }>({
    queryKey: ["employees", companyId, "list"],
    queryFn: async () => {
      const res = await fetch(`/api/employees?companyId=${companyId}&limit=200`)
      if (!res.ok) throw new Error("従業員の取得に失敗しました")
      return res.json()
    },
    staleTime: 60000,
  })

  const allEmployees = employeesData?.employees || []

  // 360度評価テンプレートを取得
  const { data: templatesData } = useQuery<{ templates: Template360[] }>({
    queryKey: ["360Templates", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-360-templates`)
      if (!res.ok) throw new Error("テンプレートの取得に失敗しました")
      const data = await res.json()
      // テンプレートにカテゴリ数・項目数・満点を追加
      const templatesWithStats = (data.templates || []).map((t: {
        id: string
        name: string
        status: string
        periodId?: string | null
        sourceTemplateId?: string | null
        grades: { id: string; name: string }[]
        jobTypes: { id: string; name: string }[]
        categories: { items: { maxScore: number }[] }[]
      }) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        periodId: t.periodId,
        sourceTemplateId: t.sourceTemplateId,
        grades: t.grades,
        jobTypes: t.jobTypes,
        categoryCount: t.categories?.length || 0,
        itemCount: t.categories?.reduce((sum: number, c: { items: unknown[] }) => sum + (c.items?.length || 0), 0) || 0,
        totalMaxScore: t.categories?.reduce(
          (sum: number, c: { items: { maxScore: number }[] }) =>
            sum + (c.items?.reduce((s: number, i: { maxScore: number }) => s + (i.maxScore || 0), 0) || 0),
          0
        ) || 0,
      }))
      return { templates: templatesWithStats }
    },
    staleTime: 60000,
  })

  // 期間固有テンプレートがある場合はマスターを除外
  const confirmedTemplates = useMemo(() => {
    const allTemplates = (templatesData?.templates || []).filter(
      (t: Template360) => t.status === "confirmed"
    )

    // この期間の期間固有テンプレートを取得
    const periodSpecificTemplates = allTemplates.filter(
      (t: Template360) => t.periodId === periodId
    )

    // 期間固有テンプレートがあればそれを使用
    if (periodSpecificTemplates.length > 0) {
      return periodSpecificTemplates
    }

    // なければマスターテンプレート（periodIdがnull）を使用
    return allTemplates.filter((t: Template360) => !t.periodId)
  }, [templatesData?.templates, periodId])

  // レコードが読み込まれたら評価者設定を初期化
  useEffect(() => {
    if (data?.records) {
      const settings: Record<string, (string | null)[]> = {}
      for (const record of data.records) {
        const ids = record.reviewerIds || []
        settings[record.id] = [
          ids[0] || null,
          ids[1] || null,
          ids[2] || null,
          ids[3] || null,
          ids[4] || null,
        ]
      }
      setReviewerSettings(settings)
    }
  }, [data?.records])

  // レコード一覧（ソートなし、APIの順序を維持）
  const records = useMemo(() => {
    return data?.records ?? []
  }, [data?.records])

  // 各従業員が評価者として何回登場するかをカウント
  const evaluatorCountMap = useMemo(() => {
    const countMap = new Map<string, number>()
    const allReviewerIds = Object.values(reviewerSettings).flat().filter(Boolean) as string[]
    for (const reviewerId of allReviewerIds) {
      countMap.set(reviewerId, (countMap.get(reviewerId) || 0) + 1)
    }
    return countMap
  }, [reviewerSettings])

  // 評価者が設定されているレコード数
  const recordsWithReviewers = useMemo(() => {
    return records.filter((record) => {
      const reviewers = reviewerSettings[record.id] || []
      return reviewers.some((r) => r !== null && r !== "")
    })
  }, [records, reviewerSettings])

  // 評価者設定済みで準備完了のレコード数
  const readyRecordsWithReviewers = useMemo(() => {
    return recordsWithReviewers.filter((r) => r.status === "ready" || r.status === "completed")
  }, [recordsWithReviewers])

  // 評価者設定済みの全レコードが準備完了かどうか
  const allEligibleReady = useMemo(() => {
    if (recordsWithReviewers.length === 0) return false
    return readyRecordsWithReviewers.length === recordsWithReviewers.length
  }, [recordsWithReviewers, readyRecordsWithReviewers])

  // 全レコードが準備完了かどうか（配布開始用）- 楽観的状態を考慮
  const allRecordsReady = useMemo(() => {
    if (records.length === 0) return false
    return records.every((r) => {
      const isChecked = optimisticChecked[r.id] ?? (r.status === "ready" || r.status === "completed")
      return isChecked
    })
  }, [records, optimisticChecked])

  // 準備完了のレコード数 - 楽観的状態を考慮
  const readyCount = useMemo(() => {
    return records.filter((r) => {
      const isChecked = optimisticChecked[r.id] ?? (r.status === "ready" || r.status === "completed")
      return isChecked
    }).length
  }, [records, optimisticChecked])

  // 評価者更新mutation（期間固有の評価者アサインを更新）
  const updateReviewersMutation = useMutation({
    mutationFn: async ({ employeeId, reviewerIds }: { employeeId: string; reviewerIds: string[] }) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewers`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewerIds }),
        }
      )
      if (!res.ok) throw new Error("評価者の更新に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
    },
  })

  // レコード完了/未完了切り替えmutation
  const toggleReadyMutation = useMutation({
    mutationFn: async ({ employeeId, recordId, ready }: { employeeId: string; recordId: string; ready: boolean }) => {
      // ready=trueの場合、評価者があれば先に保存
      if (ready) {
        const reviewers = reviewerSettings[recordId] || []
        const validIds = reviewers.filter((id): id is string => id !== null && id !== "")

        if (validIds.length > 0) {
          await fetch(
            `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewers`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reviewerIds: validIds }),
            }
          )
        }
      }

      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: ready ? "ready" : "preparing_items" }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "ステータスの更新に失敗しました")
      }
      return { recordId, ready }
    },
    onSuccess: (data) => {
      // 楽観的状態をクリア（サーバーデータで上書きされる）
      setOptimisticChecked((prev) => {
        const next = { ...prev }
        delete next[data.recordId]
        return next
      })
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
    },
    onError: (_error, variables) => {
      // エラー時は楽観的状態をクリア
      setOptimisticChecked((prev) => {
        const next = { ...prev }
        delete next[variables.recordId]
        return next
      })
    },
  })

  // 一括配布開始mutation
  const startDistributionMutation = useMutation({
    mutationFn: async ({ responseDeadline }: { responseDeadline: string }) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/distribute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responseDeadline }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "配布開始に失敗しました")
      }
      return res.json()
    },
    onSuccess: (data) => {
      setShowDistributionModal(false)
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
      // 結果をアラート表示
      if (data.emailsFailed > 0) {
        alert(`${data.emailsSent}名にメールを送信しました。\n${data.emailsFailed}名は送信に失敗しました。`)
      }
      // 配布・回収タブに遷移
      if (onDistributionStart) {
        onDistributionStart()
      } else {
        onStatusChange()
      }
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // 全員一括完了/解除mutation
  const toggleAllReadyMutation = useMutation({
    mutationFn: async (ready: boolean) => {
      // ready=true: まだreadyでないレコードのみ対象
      // ready=false: 既にreadyのレコードのみ対象
      const targetRecords = ready
        ? records.filter((record) => {
            const currentChecked = optimisticChecked[record.id] ?? (record.status === "ready" || record.status === "completed")
            return !currentChecked
          })
        : records.filter((record) => {
            const currentChecked = optimisticChecked[record.id] ?? (record.status === "ready" || record.status === "completed")
            return currentChecked
          })

      if (targetRecords.length === 0) {
        return { succeeded: 0, failed: 0, total: 0, ready }
      }

      // 全レコードを並列処理
      const promises = targetRecords.map(async (record) => {
        try {
          // ready=trueの場合、評価者があれば先に保存
          if (ready) {
            const reviewers = reviewerSettings[record.id] || []
            const validIds = reviewers.filter((id): id is string => id !== null && id !== "")

            if (validIds.length > 0) {
              await fetch(
                `/api/companies/${companyId}/operations/${periodId}/360/${record.employee.id}/reviewers`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reviewerIds: validIds }),
                }
              )
            }
          }

          // ステータスを更新
          const res = await fetch(
            `/api/companies/${companyId}/operations/${periodId}/360/${record.employee.id}/status`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: ready ? "ready" : "preparing_items" }),
            }
          )
          return res.ok
        } catch {
          return false
        }
      })

      const results = await Promise.all(promises)
      const succeeded = results.filter((r) => r).length
      const failed = results.filter((r) => !r).length

      return { succeeded, failed, total: targetRecords.length, ready, targetRecordIds: targetRecords.map((r) => r.id) }
    },
    onSuccess: (data) => {
      // 楽観的状態をクリア
      if (data.targetRecordIds) {
        setOptimisticChecked((prev) => {
          const next = { ...prev }
          for (const id of data.targetRecordIds) {
            delete next[id]
          }
          return next
        })
      }
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
    },
  })

  // テンプレートコピーmutation
  const copyTemplateMutation = useMutation({
    mutationFn: async (sourceTemplateId: string) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360-templates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceTemplateId }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "テンプレートのコピーに失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["360Templates", companyId],
      })
    },
  })

  // テンプレート更新mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: unknown }) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360-templates/${templateId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )
      if (!res.ok) throw new Error("テンプレートの更新に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["360Templates", companyId],
      })
      setEditingTemplate(null)
      alert("テンプレートを保存しました")
    },
  })

  // テンプレート一括適用mutation
  const applyTemplateMutation = useMutation({
    mutationFn: async ({ templateId, overwrite }: { templateId: string; overwrite: boolean }) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360-templates/${templateId}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overwrite }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "テンプレートの適用に失敗しました")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
      setApplyingTemplate(null)
      setApplyOverwrite(false)
      alert(`${data.appliedCount}件に適用しました。\n${data.skippedCount}件はスキップされました。`)
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // 一括テンプレート生成mutation
  const bulkGenerateItemsMutation = useMutation({
    mutationFn: async (overwrite: boolean) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/bulk-generate-items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overwrite }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "一括生成に失敗しました")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
      alert(`${data.generated}件に項目を生成しました。\n${data.skipped || 0}件はスキップされました。`)
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // テンプレート詳細取得
  const { data: templateDetailData } = useQuery({
    queryKey: ["360TemplateDetail", editingTemplate?.id],
    queryFn: async () => {
      if (!editingTemplate?.id) return null
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360-templates/${editingTemplate.id}`
      )
      if (!res.ok) throw new Error("テンプレートの取得に失敗しました")
      return res.json()
    },
    enabled: !!editingTemplate?.id,
  })

  // テンプレート詳細が読み込まれたらフォームにセット
  useEffect(() => {
    if (templateDetailData?.categories) {
      setEditFormData({
        categories: templateDetailData.categories.map((c: { name: string; sortOrder: number; items: { content: string; sortOrder: number; maxScore: number }[] }) => ({
          name: c.name,
          sortOrder: c.sortOrder,
          isExpanded: true,
          items: c.items.map((i: { content: string; sortOrder: number; maxScore: number }) => ({
            content: i.content,
            sortOrder: i.sortOrder,
            maxScore: i.maxScore,
          })),
        })),
      })
    }
  }, [templateDetailData])

  // テンプレート編集開始ハンドラ
  const handleEditTemplate = async (template: Template360) => {
    // 期間固有テンプレートかどうかチェック（isPeriodSpecificフラグで判断）
    // マスターテンプレートの場合はまずコピーを作成
    try {
      // コピーを試みる（既にコピー済みの場合はエラーが返る）
      const result = await copyTemplateMutation.mutateAsync(template.id)
      // コピー成功したら、コピーされたテンプレートを編集
      setEditingTemplate({ ...template, id: result.templateId })
    } catch {
      // 既にコピー済みの場合はそのまま編集
      setEditingTemplate(template)
    }
  }

  // カテゴリ追加
  const handleAddCategory = () => {
    setEditFormData((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        { name: "新しいカテゴリ", sortOrder: prev.categories.length, isExpanded: true, items: [] },
      ],
    }))
  }

  // カテゴリ展開/折りたたみ
  const toggleCategoryExpand = (categoryIndex: number) => {
    setEditFormData((prev) => ({
      ...prev,
      categories: prev.categories.map((c, i) =>
        i === categoryIndex ? { ...c, isExpanded: !c.isExpanded } : c
      ),
    }))
  }

  // アイテム削除
  const handleRemoveItem = (categoryIndex: number, itemIndex: number) => {
    setEditFormData((prev) => ({
      ...prev,
      categories: prev.categories.map((c, ci) =>
        ci === categoryIndex
          ? { ...c, items: c.items.filter((_, ii) => ii !== itemIndex) }
          : c
      ),
    }))
  }

  // テンプレート保存（status指定）
  const handleSaveTemplateWithStatus = (status: "draft" | "confirmed") => {
    if (!editingTemplate) return
    updateTemplateMutation.mutate({
      templateId: editingTemplate.id,
      data: { categories: editFormData.categories, status },
    })
  }

  // アイテム追加
  const handleAddItem = (categoryIndex: number) => {
    setEditFormData((prev) => ({
      ...prev,
      categories: prev.categories.map((c, i) =>
        i === categoryIndex
          ? { ...c, items: [...c.items, { content: "", sortOrder: c.items.length, maxScore: 5 }] }
          : c
      ),
    }))
  }


  // 評価者変更ハンドラ
  const handleReviewerChange = (recordId: string, employeeId: string, index: number, reviewerId: string | null) => {
    setReviewerSettings((prev) => {
      const current = prev[recordId] || [null, null, null, null, null]
      const updated = [...current]
      updated[index] = reviewerId
      return { ...prev, [recordId]: updated }
    })

    // 有効な評価者IDのみを送信
    const currentSettings = reviewerSettings[recordId] || [null, null, null, null, null]
    const updatedSettings = [...currentSettings]
    updatedSettings[index] = reviewerId
    const validIds = updatedSettings.filter((id): id is string => id !== null && id !== "")

    updateReviewersMutation.mutate({ employeeId, reviewerIds: validIds })
  }

  // 従業員名取得
  const getEmployeeName = (empId: string | null): string => {
    if (!empId) return ""
    const emp = allEmployees.find((e) => e.id === empId)
    return emp ? `${emp.lastName} ${emp.firstName}` : ""
  }

  // 配布モーダル用の評価者リストを作成
  const reviewersForModal = useMemo(() => {
    const reviewerMap = new Map<string, {
      id: string
      firstName: string
      lastName: string
      email: string | null
      targetEmployees: Array<{ id: string; name: string }>
    }>()

    for (const record of records) {
      const reviewers = reviewerSettings[record.id] || []
      for (const reviewerId of reviewers) {
        if (!reviewerId) continue

        const emp = allEmployees.find((e) => e.id === reviewerId)
        if (!emp) continue

        if (!reviewerMap.has(reviewerId)) {
          reviewerMap.set(reviewerId, {
            id: reviewerId,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            targetEmployees: [],
          })
        }

        const targetName = `${record.employee.lastName} ${record.employee.firstName}`
        const existing = reviewerMap.get(reviewerId)!
        if (!existing.targetEmployees.some((t) => t.id === record.employee.id)) {
          existing.targetEmployees.push({
            id: record.employee.id,
            name: targetName,
          })
        }
      }
    }

    return Array.from(reviewerMap.values())
  }, [records, reviewerSettings, allEmployees])

  // 配布確認ハンドラー
  const handleDistributionConfirm = (deadline: Date, _emailOverrides: Record<string, string>) => {
    startDistributionMutation.mutate({
      responseDeadline: deadline.toISOString(),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            <FileText className="h-4 w-4 mr-1" />
            一括テンプレ生成
          </Button>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          評価対象者がいません
        </div>
      </div>
    )
  }

  // 選択された従業員をダイアログ用の形式に変換
  const selectedEmployee = selectedRecord
    ? {
        id: selectedRecord.employee.id,
        employeeCode: selectedRecord.employee.employeeCode || "",
        firstName: selectedRecord.employee.firstName,
        lastName: selectedRecord.employee.lastName,
        grade: selectedRecord.employee.grade,
        jobType: selectedRecord.employee.jobType,
        gradeId: selectedRecord.employee.gradeId || selectedRecord.employee.grade?.id || null,
        jobTypeId: selectedRecord.employee.jobTypeId || selectedRecord.employee.jobType?.id || null,
      }
    : null

  return (
    <div className="space-y-4">
      {/* 一括操作ボタン */}
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkGenerateItemsMutation.mutate(false)}
          disabled={bulkGenerateItemsMutation.isPending || confirmedTemplates.length === 0}
        >
          {bulkGenerateItemsMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-1" />
          )}
          一括テンプレ生成
        </Button>

        <Button
          size="sm"
          disabled={!allRecordsReady || reviewersForModal.length === 0}
          className="bg-green-600 hover:bg-green-700"
          onClick={() => setShowDistributionModal(true)}
        >
          <Send className="h-4 w-4 mr-1" />
          配布開始
        </Button>

        <span className="text-sm text-muted-foreground ml-2">
          準備完了: {readyCount} / {records.length}名
        </span>
      </div>

      {/* 配布確認モーダル */}
      <DistributionConfirmModal
        open={showDistributionModal}
        onOpenChange={setShowDistributionModal}
        reviewers={reviewersForModal}
        onConfirm={handleDistributionConfirm}
        isLoading={startDistributionMutation.isPending}
      />

      {/* テンプレートカード */}
      {confirmedTemplates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              360度評価テンプレート
            </CardTitle>
            <CardDescription>360度評価で使用するテンプレートを管理します（運用側で編集可能）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {confirmedTemplates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    <Badge className="bg-green-500 text-white text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      確定
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span>対象等級: {template.grades.map((g) => g.name).join(", ") || "-"}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span>対象職種: {template.jobTypes.map((jt) => jt.name).join(", ") || "-"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm text-muted-foreground">
                    <span>{template.categoryCount}カテゴリ / {template.itemCount}項目 / 満点{template.totalMaxScore}点</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                      disabled={copyTemplateMutation.isPending}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      編集
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setApplyingTemplate(template)}
                      disabled={applyTemplateMutation.isPending}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      全員に適用
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* テンプレート編集ダイアログ */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="!max-w-[calc(100vw-80px)] w-[calc(100vw-80px)] h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              360度評価テンプレート
            </DialogTitle>
            <DialogDescription>
              {editingTemplate?.name} - ここでの変更はこの評価期間のみに適用されます
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {editFormData.categories.map((category, cIdx) => {
              const categoryItemCount = category.items.length
              const categoryTotalScore = category.items.reduce((sum, item) => sum + item.maxScore, 0)

              return (
                <div key={cIdx} className="border rounded-lg overflow-hidden">
                  {/* カテゴリヘッダー */}
                  <div className="w-full flex items-center justify-between p-3 bg-muted/50">
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity flex-1"
                      onClick={() => toggleCategoryExpand(cIdx)}
                    >
                      {category.isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Input
                        value={category.name}
                        onChange={(e) => {
                          e.stopPropagation()
                          setEditFormData((prev) => ({
                            ...prev,
                            categories: prev.categories.map((c, i) =>
                              i === cIdx ? { ...c, name: e.target.value } : c
                            ),
                          }))
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-lg h-8 w-48 bg-transparent border-dashed"
                        placeholder="カテゴリ名"
                      />
                      <Badge variant="secondary" className="text-xs">
                        {categoryItemCount}項目 / {categoryTotalScore}点満点
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditFormData((prev) => ({
                          ...prev,
                          categories: prev.categories.filter((_, i) => i !== cIdx),
                        }))
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 項目一覧 */}
                  {category.isExpanded && (
                    <div className="p-3 space-y-2">
                      {/* ヘッダー */}
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span className="w-6 text-center">No</span>
                        <span className="flex-1">項目名</span>
                        <span className="w-14 text-center">満点</span>
                        <span className="w-8"></span>
                      </div>

                      {/* 項目リスト */}
                      {category.items.map((item, iIdx) => (
                        <div key={iIdx} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-6 text-center">
                            {iIdx + 1}
                          </span>
                          <Input
                            value={item.content}
                            onChange={(e) => {
                              setEditFormData((prev) => ({
                                ...prev,
                                categories: prev.categories.map((c, ci) =>
                                  ci === cIdx
                                    ? {
                                        ...c,
                                        items: c.items.map((it, ii) =>
                                          ii === iIdx ? { ...it, content: e.target.value } : it
                                        ),
                                      }
                                    : c
                                ),
                              }))
                            }}
                            className="flex-1 h-8 text-sm"
                            placeholder="評価項目を入力"
                          />
                          <Input
                            type="number"
                            min="0"
                            value={item.maxScore}
                            onChange={(e) => {
                              setEditFormData((prev) => ({
                                ...prev,
                                categories: prev.categories.map((c, ci) =>
                                  ci === cIdx
                                    ? {
                                        ...c,
                                        items: c.items.map((it, ii) =>
                                          ii === iIdx ? { ...it, maxScore: parseInt(e.target.value) || 0 } : it
                                        ),
                                      }
                                    : c
                                ),
                              }))
                            }}
                            className="w-14 h-8 text-center text-sm"
                          />
                          <div className="w-8 flex justify-center">
                            {category.items.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveItem(cIdx, iIdx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* 項目追加ボタン */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAddItem(cIdx)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        項目追加
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}

            <Button variant="outline" onClick={handleAddCategory}>
              <Plus className="h-4 w-4 mr-1" />
              カテゴリを追加
            </Button>
          </div>

          <DialogFooter className="flex-shrink-0 border-t p-4">
            <div className="flex justify-between w-full">
              <div>
                {editingTemplate?.periodId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (editingTemplate) {
                        applyTemplateMutation.mutate({
                          templateId: editingTemplate.id,
                          overwrite: false,
                        })
                      }
                    }}
                    disabled={applyTemplateMutation.isPending}
                  >
                    {applyTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4 mr-1" />
                    )}
                    従業員に反映
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                  閉じる
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleSaveTemplateWithStatus("draft")}
                  disabled={updateTemplateMutation.isPending}
                >
                  {updateTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  保存
                </Button>
                <Button
                  onClick={() => handleSaveTemplateWithStatus("confirmed")}
                  disabled={updateTemplateMutation.isPending}
                >
                  {updateTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  確定
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* テンプレート一括適用確認ダイアログ */}
      <Dialog open={!!applyingTemplate} onOpenChange={(open) => !open && setApplyingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>テンプレートを全員に適用</DialogTitle>
            <DialogDescription>
              {applyingTemplate?.name}を対象等級・職種の全従業員に適用します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm">
              <p className="font-medium mb-2">対象範囲:</p>
              <ul className="list-disc ml-4 text-muted-foreground">
                <li>等級: {applyingTemplate?.grades.map((g) => g.name).join(", ") || "全て"}</li>
                <li>職種: {applyingTemplate?.jobTypes.map((jt) => jt.name).join(", ") || "全て"}</li>
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="overwrite"
                checked={applyOverwrite}
                onCheckedChange={(checked) => setApplyOverwrite(!!checked)}
              />
              <Label htmlFor="overwrite" className="text-sm">
                既存の評価項目を上書きする（スコア入力済みでも上書き）
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyingTemplate(null)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (applyingTemplate) {
                  applyTemplateMutation.mutate({
                    templateId: applyingTemplate.id,
                    overwrite: applyOverwrite,
                  })
                }
              }}
              disabled={applyTemplateMutation.isPending}
            >
              {applyTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              適用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* レコード一覧 */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5">
              <TableHead className="w-[160px] text-primary">氏名</TableHead>
              <TableHead className="w-[120px] text-primary">職種</TableHead>
              <TableHead className="w-[80px] text-primary">等級</TableHead>
              <TableHead className="w-[110px] text-primary">評価者1</TableHead>
              <TableHead className="w-[110px] text-primary">評価者2</TableHead>
              <TableHead className="w-[110px] text-primary">評価者3</TableHead>
              <TableHead className="w-[110px] text-primary">評価者4</TableHead>
              <TableHead className="w-[110px] text-primary">評価者5</TableHead>
              <TableHead className="w-[80px] text-center text-primary">満点</TableHead>
              <TableHead className="w-[100px] text-center text-primary">
                <div className="flex items-center justify-center gap-2">
                  <span>完了</span>
                  <Checkbox
                    checked={allRecordsReady && records.length > 0}
                    disabled={records.length === 0}
                    onCheckedChange={(checked) => {
                      // 全レコードを楽観的に更新
                      const newState: Record<string, boolean> = {}
                      for (const record of records) {
                        newState[record.id] = !!checked
                      }
                      setOptimisticChecked(newState)
                      toggleAllReadyMutation.mutate(!!checked)
                    }}
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => {
              const isCompleted = record.status === "completed" || record.status === "ready"
              const reviewers = reviewerSettings[record.id] || [null, null, null, null, null]
              // この従業員が評価者として何回登場するか
              const asEvaluatorCount = evaluatorCountMap.get(record.employee.id) || 0
              // 評価者が1人以上設定されているか
              const hasReviewers = reviewers.some((r) => r !== null && r !== "")

              return (
                <TableRow
                  key={record.id}
                  className={isCompleted ? "bg-green-50/50" : ""}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-primary hover:underline cursor-pointer"
                        onClick={() => setSelectedRecord(record)}
                        title="評価項目を編集"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <span
                        className="hover:text-primary cursor-pointer"
                        onClick={() => setSelectedRecord(record)}
                      >
                        {record.employee.lastName} {record.employee.firstName}
                        <span className="text-muted-foreground ml-1">({asEvaluatorCount})</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {record.employee.jobType?.name || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {record.employee.grade?.name || "-"}
                  </TableCell>
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <TableCell key={idx} className="p-1">
                      <Select
                        value={reviewers[idx] || "none"}
                        onValueChange={(value) =>
                          handleReviewerChange(
                            record.id,
                            record.employee.id,
                            idx,
                            value === "none" ? null : value
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs w-[100px]">
                          <SelectValue>
                            {reviewers[idx] ? getEmployeeName(reviewers[idx]) : "-"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          {allEmployees
                            .filter((e) => e.id !== record.employee.id)
                            .map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.lastName} {e.firstName}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-medium">
                    {record.maxScore && record.maxScore > 0 ? `${record.maxScore}点` : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={optimisticChecked[record.id] ?? isCompleted}
                      disabled={record.status === "aggregated" || record.status === "completed" || record.status === "collecting"}
                      onCheckedChange={(checked) => {
                        // 楽観的に即座にUIを更新
                        setOptimisticChecked((prev) => ({
                          ...prev,
                          [record.id]: !!checked,
                        }))
                        toggleReadyMutation.mutate({
                          employeeId: record.employee.id,
                          recordId: record.id,
                          ready: !!checked,
                        })
                      }}
                      className="mx-auto"
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 360度評価項目モーダル */}
      <Employee360EvaluationItemsDialog
        open={!!selectedRecord}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecord(null)
            queryClient.invalidateQueries({
              queryKey: ["360Records", companyId, periodId],
            })
            onStatusChange()
          }
        }}
        employee={selectedEmployee}
        companyId={companyId}
      />
    </div>
  )
}
