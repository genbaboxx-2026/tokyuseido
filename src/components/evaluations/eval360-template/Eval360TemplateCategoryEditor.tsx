"use client"

import { useMemo } from "react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { type CategoryState } from "./Eval360TemplateTypes"

interface Eval360TemplateCategoryEditorProps {
  categories: CategoryState[]
  onAddCategory: () => void
  onRemoveCategory: (catIndex: number) => void
  onCategoryNameChange: (catIndex: number, newName: string) => void
  onToggleCategory: (catIndex: number) => void
  onAddItem: (catIndex: number) => void
  onRemoveItem: (catIndex: number, itemIndex: number) => void
  onItemContentChange: (catIndex: number, itemIndex: number, newContent: string) => void
  onItemMaxScoreChange: (catIndex: number, itemIndex: number, newMaxScore: number) => void
}

export function Eval360TemplateCategoryEditor({
  categories,
  onAddCategory,
  onRemoveCategory,
  onCategoryNameChange,
  onToggleCategory,
  onAddItem,
  onRemoveItem,
  onItemContentChange,
  onItemMaxScoreChange,
}: Eval360TemplateCategoryEditorProps) {
  // 通し番号の計算
  const getGlobalItemNumber = (catIndex: number, itemIndex: number): number => {
    let count = 0
    for (let i = 0; i < catIndex; i++) {
      count += categories[i].items.length
    }
    return count + itemIndex + 1
  }

  // カテゴリごとの合計点
  const getCategoryTotal = (category: CategoryState): number => {
    return category.items.reduce((sum, item) => sum + (item.maxScore || 0), 0)
  }

  // 全体の合計
  const grandTotal = useMemo(() => {
    return categories.reduce((sum, cat) => sum + getCategoryTotal(cat), 0)
  }, [categories])

  const totalItems = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.items.length, 0)
  }, [categories])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">評価カテゴリ・項目</h2>
          <span className="text-sm text-muted-foreground">
            {categories.length}カテゴリ / {totalItems}項目 / 合計{grandTotal}点
          </span>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">カテゴリがありません</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">カテゴリを追加して評価項目を作成してください</p>
            <Button variant="outline" onClick={onAddCategory}>
              <Plus className="h-4 w-4 mr-2" />
              カテゴリを追加
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category, catIndex) => (
            <CategoryTable
              key={catIndex}
              category={category}
              catIndex={catIndex}
              categoriesLength={categories.length}
              getGlobalItemNumber={getGlobalItemNumber}
              getCategoryTotal={getCategoryTotal}
              onToggleCategory={onToggleCategory}
              onCategoryNameChange={onCategoryNameChange}
              onRemoveCategory={onRemoveCategory}
              onItemContentChange={onItemContentChange}
              onItemMaxScoreChange={onItemMaxScoreChange}
              onRemoveItem={onRemoveItem}
              onAddItem={onAddItem}
            />
          ))}

          {/* カテゴリ追加ボタン */}
          <div className="flex justify-center py-2">
            <Button variant="outline" onClick={onAddCategory}>
              <Plus className="h-4 w-4 mr-2" />
              カテゴリを追加
            </Button>
          </div>

          {/* 全体合計 */}
          <div className="bg-blue-50 px-4 py-3 flex justify-between items-center border-t-2 border-blue-200">
            <span className="font-bold text-blue-900">全体合計</span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-blue-700">{totalItems}項目</span>
              <span className="font-bold text-blue-900 text-lg">{grandTotal}点</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// カテゴリテーブルコンポーネント
function CategoryTable({
  category,
  catIndex,
  categoriesLength,
  getGlobalItemNumber,
  getCategoryTotal,
  onToggleCategory,
  onCategoryNameChange,
  onRemoveCategory,
  onItemContentChange,
  onItemMaxScoreChange,
  onRemoveItem,
  onAddItem,
}: {
  category: CategoryState
  catIndex: number
  categoriesLength: number
  getGlobalItemNumber: (catIndex: number, itemIndex: number) => number
  getCategoryTotal: (category: CategoryState) => number
  onToggleCategory: (catIndex: number) => void
  onCategoryNameChange: (catIndex: number, newName: string) => void
  onRemoveCategory: (catIndex: number) => void
  onItemContentChange: (catIndex: number, itemIndex: number, newContent: string) => void
  onItemMaxScoreChange: (catIndex: number, itemIndex: number, newMaxScore: number) => void
  onRemoveItem: (catIndex: number, itemIndex: number) => void
  onAddItem: (catIndex: number) => void
}) {
  const categoryTotal = getCategoryTotal(category)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* カテゴリヘッダー */}
      <div
        className="bg-gray-50 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => onToggleCategory(catIndex)}
      >
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={category.name}
            onChange={(e) => {
              e.stopPropagation()
              onCategoryNameChange(catIndex, e.target.value)
            }}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold h-8 max-w-[400px] bg-white"
            placeholder="カテゴリ名を入力"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveCategory(catIndex)
            }}
            disabled={categoriesLength <= 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {category.isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* テーブル本体（展開時） */}
      {category.isExpanded && (
        <>
          {/* テーブルヘッダー */}
          <div className="grid grid-cols-[50px_1fr_70px_40px] bg-gray-100 border-t border-gray-200">
            <div className="px-3 py-2 text-xs font-semibold text-gray-600 text-center border-r border-gray-200">
              No
            </div>
            <div className="px-3 py-2 text-xs font-semibold text-gray-600 border-r border-gray-200">
              項目
            </div>
            <div className="px-3 py-2 text-xs font-semibold text-gray-600 text-center border-r border-gray-200">
              満点
            </div>
            <div className="px-3 py-2"></div>
          </div>

          {/* 項目行 */}
          {category.items.map((item, itemIndex) => (
            <div
              key={itemIndex}
              className="grid grid-cols-[50px_1fr_70px_40px] border-t border-gray-200 hover:bg-gray-50"
            >
              <div className="px-3 py-2 text-sm text-gray-600 text-center border-r border-gray-200 flex items-center justify-center">
                {getGlobalItemNumber(catIndex, itemIndex)}
              </div>
              <div className="px-2 py-1 border-r border-gray-200">
                <Input
                  value={item.content}
                  onChange={(e) => onItemContentChange(catIndex, itemIndex, e.target.value)}
                  className="h-8 text-sm border-0 shadow-none focus-visible:ring-0 bg-transparent"
                  placeholder="評価項目を入力"
                />
              </div>
              <div className="px-2 py-1 border-r border-gray-200 flex items-center justify-center">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={item.maxScore}
                  onChange={(e) => onItemMaxScoreChange(catIndex, itemIndex, parseInt(e.target.value) || 0)}
                  className="w-14 h-8 text-sm text-center border-gray-200"
                />
              </div>
              <div className="flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveItem(catIndex, itemIndex)}
                  disabled={category.items.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {/* 項目追加行 + カテゴリ合計 */}
          <div className="grid grid-cols-[50px_1fr_70px_40px] border-t border-gray-200 bg-gray-50">
            <div className="col-span-2 px-3 py-2 flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onAddItem(catIndex)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                項目を追加
              </Button>
              <span className="ml-auto text-sm font-medium text-gray-600">
                【{category.name}】合計
              </span>
            </div>
            <div className="px-3 py-2 text-center font-semibold text-gray-700 border-l border-gray-200">
              {categoryTotal}
            </div>
            <div className="border-l border-gray-200"></div>
          </div>
        </>
      )}
    </div>
  )
}
