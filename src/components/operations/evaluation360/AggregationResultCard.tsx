"use client"

import Link from "next/link"
import {
  CheckCircle2,
  Lock,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { type Evaluation360Status } from "./Evaluation360Types"

interface ReviewerSummary {
  label: string
  totalScore: number
  maxPossibleScore: number
  percentage: number
}

interface CategoryItem {
  id: string
  content: string
  maxScore: number
  avgScore: number
  scores: { label: string; score: number }[]
}

interface Category {
  id: string
  name: string
  avgScore: number
  maxScore: number
  percentage: number
  items: CategoryItem[]
}

interface Highlight {
  itemId: string
  content: string
  avgScore?: number
  maxScore?: number
  stdDev?: number
}

interface Comment {
  label: string
  comment: string
}

interface Summary {
  summary: {
    reviewerCount: number
    totalAvgScore: number
    totalMaxScore: number
    percentage: number
  }
  reviewerSummaries: ReviewerSummary[]
  categories: Category[]
  highlights: {
    high: Highlight[]
    low: Highlight[]
    highVariance: Highlight[]
  }
  comments: Comment[]
}

interface AggregationResultCardProps {
  currentStatus: Evaluation360Status
  summary: Summary
  companyId: string
  periodId: string
  onReaggregate: () => void
  onComplete: () => void
}

export function AggregationResultCard({
  currentStatus,
  summary,
  companyId,
  periodId,
  onReaggregate,
  onComplete,
}: AggregationResultCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          集計結果
          {currentStatus === "completed" && (
            <Badge className="bg-emerald-100 text-emerald-800">
              <Lock className="h-3 w-3 mr-1" />
              確定済み
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          評価者{summary.summary.reviewerCount}人からの評価を集計しました
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">合計平均</p>
            <p className="text-3xl font-bold text-blue-600">
              {summary.summary.totalAvgScore} / {summary.summary.totalMaxScore}
            </p>
            <p className="text-sm text-blue-600">({summary.summary.percentage}%)</p>
          </div>
          {summary.reviewerSummaries.map((rs, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">{rs.label}</p>
              <p className="text-xl font-bold">{rs.totalScore} / {rs.maxPossibleScore}</p>
              <p className="text-sm text-muted-foreground">({rs.percentage}%)</p>
            </div>
          ))}
        </div>

        <Accordion type="multiple" className="w-full">
          {summary.categories.map((cat) => (
            <AccordionItem key={cat.id} value={cat.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-4">
                  <span>{cat.name}</span>
                  <Badge variant="outline">
                    平均: {cat.avgScore} / {cat.maxScore} ({cat.percentage}%)
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>項目</TableHead>
                      <TableHead className="w-[80px]">満点</TableHead>
                      {summary.reviewerSummaries.map((rs, i) => (
                        <TableHead key={i} className="w-[80px] text-center">{rs.label}</TableHead>
                      ))}
                      <TableHead className="w-[80px] text-center">平均</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cat.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.content}</TableCell>
                        <TableCell>{item.maxScore}</TableCell>
                        {item.scores.map((s, i) => (
                          <TableCell key={i} className="text-center">{s.score}</TableCell>
                        ))}
                        <TableCell className="text-center font-medium">{item.avgScore}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {(summary.highlights.high.length > 0 || summary.highlights.low.length > 0 || summary.highlights.highVariance.length > 0) && (
          <div className="space-y-4">
            <h4 className="font-semibold">ハイライト</h4>
            {summary.highlights.high.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 mb-2">🟢 高評価項目（90%以上）</p>
                <ul className="space-y-1">
                  {summary.highlights.high.map((h) => (
                    <li key={h.itemId} className="text-sm">{h.content} (平均: {h.avgScore}/{h.maxScore})</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.highlights.low.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 mb-2">🔴 低評価項目（60%以下）</p>
                <ul className="space-y-1">
                  {summary.highlights.low.map((h) => (
                    <li key={h.itemId} className="text-sm">{h.content} (平均: {h.avgScore}/{h.maxScore})</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.highlights.highVariance.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-800 mb-2">📊 ばらつきが大きい項目（標準偏差1.0以上）</p>
                <ul className="space-y-1">
                  {summary.highlights.highVariance.map((h) => (
                    <li key={h.itemId} className="text-sm">{h.content} (SD: {h.stdDev})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {summary.comments.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold">コメント一覧</h4>
            {summary.comments.map((c, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium mb-1">{c.label}</p>
                <p className="text-sm text-muted-foreground">{c.comment}</p>
              </div>
            ))}
          </div>
        )}

        {currentStatus === "aggregated" && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">集計やり直し</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>集計をやり直しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    回収フェーズに戻り、評価者の再入力を受け付けます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={onReaggregate}>
                    やり直す
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  確定
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>評価を確定しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    確定後は編集できなくなります。この操作は取り消せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={onComplete}>
                    確定する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {currentStatus === "completed" && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              PDF出力
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/companies/${companyId}/operations/${periodId}`}>
                一覧に戻る
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
