"use client"

import { Input } from "@/components/ui/input"

interface Eval360TemplateBasicInfoProps {
  name: string
  onNameChange: (name: string) => void
}

export function Eval360TemplateBasicInfo({
  name,
  onNameChange,
}: Eval360TemplateBasicInfoProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">テンプレート名 *</h2>
      <Input
        id="name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="テンプレート名を入力"
        className="max-w-md"
      />
    </div>
  )
}
