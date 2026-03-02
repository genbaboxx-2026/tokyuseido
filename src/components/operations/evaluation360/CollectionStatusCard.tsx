"use client"

import Link from "next/link"
import {
  ArrowRight,
  Eye,
  Bell,
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

interface ReviewerAssignment {
  id: string
  reviewerId: string
  reviewer: {
    firstName: string
    lastName: string
  }
  status: string
  submittedAt: string | null
}

interface CollectionStatusCardProps {
  currentStatus: Evaluation360Status
  reviewerAssignments: ReviewerAssignment[]
  submittedCount: number
  totalReviewers: number
  companyId: string
  periodId: string
  employeeId: string
  onAggregate: () => void
}

export function CollectionStatusCard({
  currentStatus,
  reviewerAssignments,
  submittedCount,
  totalReviewers,
  companyId,
  periodId,
  employeeId,
  onAggregate,
}: CollectionStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {currentStatus === "distributing" ? "配布状況" : "回収管理"}
        </CardTitle>
        <CardDescription>
          {currentStatus === "distributing" ? "評価者が入力中です" : "一部の評価が提出されました"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>評価者</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>提出日</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviewerAssignments.map((ra, index) => (
              <TableRow key={ra.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{ra.reviewer.lastName} {ra.reviewer.firstName}</TableCell>
                <TableCell>
                  <Badge
                    variant={ra.status === "submitted" ? "default" : "secondary"}
                    className={
                      ra.status === "submitted" ? "bg-green-100 text-green-800" :
                      ra.status === "in_progress" ? "bg-yellow-100 text-yellow-800" : ""
                    }
                  >
                    {ra.status === "submitted" ? "✅ 提出済み" :
                     ra.status === "in_progress" ? "🟡 入力中" : "⚪ 未着手"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {ra.submittedAt ? new Date(ra.submittedAt).toLocaleDateString("ja-JP") : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {ra.status === "submitted" ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewer/${ra.reviewerId}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          確認
                        </Link>
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewer/${ra.reviewerId}`}>
                            代理入力
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Bell className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {currentStatus === "collecting" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>
                  集計へ進む
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>集計に進みますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    {submittedCount}/{totalReviewers}人が提出済みです。
                    未提出の評価者は集計から除外されます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={onAggregate}>
                    集計開始
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
