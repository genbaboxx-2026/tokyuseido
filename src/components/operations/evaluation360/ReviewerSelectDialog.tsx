"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ReviewerSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  excludeEmployeeId: string
  selectedIds: string[]
  onSelect: (ids: string[]) => void
}

export function ReviewerSelectDialog({
  open,
  onOpenChange,
  companyId,
  excludeEmployeeId,
  selectedIds,
  onSelect,
}: ReviewerSelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds)

  // Handle dialog open/close with state reset
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Reset local state when dialog opens
      setLocalSelected(selectedIds)
      setSearchTerm("")
    }
    onOpenChange(isOpen)
  }

  const { data: employeesData } = useQuery<{ employees: { id: string; firstName: string; lastName: string; grade?: { name: string } | null; department?: { name: string } | null }[] }>({
    queryKey: ["companyEmployees", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/employees`)
      if (!res.ok) throw new Error("従業員の取得に失敗しました")
      return res.json()
    },
    enabled: open,
  })

  const filteredEmployees = (employeesData?.employees ?? []).filter((emp: { id: string; firstName: string; lastName: string }) => {
    if (emp.id === excludeEmployeeId) return false
    const fullName = `${emp.lastName}${emp.firstName}`
    return fullName.includes(searchTerm)
  }) || []

  const toggleEmployee = (id: string) => {
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>評価者を選択</DialogTitle>
          <DialogDescription>評価者として追加する従業員を選択してください</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="名前で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filteredEmployees.map((emp: { id: string; firstName: string; lastName: string; department?: { name: string } | null; grade?: { name: string } | null }) => (
              <div
                key={emp.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  localSelected.includes(emp.id)
                    ? "bg-blue-50 border-blue-300"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => toggleEmployee(emp.id)}
              >
                <div>
                  <p className="font-medium">{emp.lastName} {emp.firstName}</p>
                  <p className="text-sm text-muted-foreground">
                    {emp.department?.name || "-"} / {emp.grade?.name || "-"}
                  </p>
                </div>
                {localSelected.includes(emp.id) && (
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={() => {
            onSelect(localSelected)
            onOpenChange(false)
          }}>
            選択を確定 ({localSelected.length}人)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
