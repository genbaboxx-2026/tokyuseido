# NiNKU BOXX - 人事制度プロダクト

## プロジェクト概要
ブルーカラー企業（解体業等）向けの等級制度・評価制度構築Webアプリケーション。
詳細は `NiNKU_BOXX_要件定義書.md` を参照。

## 技術スタック
- フロントエンド: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- バックエンド: Next.js API Routes
- DB: PostgreSQL + Prisma ORM
- 認証: NextAuth.js
- 状態管理: TanStack Query (サーバー状態) + Zustand (クライアント状態)
- テスト: Vitest + Testing Library
- 言語: 全コード TypeScript, UI テキストは日本語

## ディレクトリ構造
```
tokyuseido/
├── CLAUDE.md                    # このファイル
├── NiNKU_BOXX_要件定義書.md      # 要件定義書
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── (auth)/              # 認証関連ページ
│   │   ├── (dashboard)/         # ダッシュボード
│   │   ├── companies/           # 会社管理
│   │   ├── employees/           # 従業員管理
│   │   ├── grades/              # 等級制度
│   │   ├── salary-table/        # 号俸テーブル
│   │   ├── evaluations/         # 評価制度
│   │   └── api/                 # API Routes
│   ├── components/
│   │   ├── ui/                  # shadcn/ui ベースコンポーネント
│   │   ├── forms/               # フォームコンポーネント
│   │   ├── tables/              # テーブル・マトリクス表示
│   │   └── layout/              # レイアウトコンポーネント
│   ├── lib/
│   │   ├── salary-table/        # 号俸テーブル生成ロジック
│   │   ├── evaluation/          # 評価計算ロジック
│   │   ├── grade/               # 等級・昇降格ロジック
│   │   └── utils/               # 共通ユーティリティ
│   ├── prisma/
│   │   ├── schema.prisma        # Prisma スキーマ
│   │   ├── migrations/          # マイグレーション
│   │   └── seed.ts              # シードデータ
│   └── types/                   # 共有 TypeScript 型定義
├── public/
└── tests/
    ├── unit/                    # ユニットテスト
    ├── integration/             # 統合テスト
    └── e2e/                     # E2Eテスト
```

## Agent Teams ルール

### ファイル所有権（コンフリクト防止）
- **DB担当**: `src/prisma/`, `src/types/` のみ編集可
- **API担当**: `src/app/api/`, `src/lib/` のみ編集可
- **UI担当**: `src/app/(auth|dashboard|companies|employees|grades|salary-table|evaluations)/`, `src/components/` のみ編集可
- **テスト担当**: `tests/` のみ編集可

### 型定義の共有フロー
1. DB担当が `src/types/` に型定義を作成
2. 他のチームメイトに型定義完了をメッセージで通知
3. API担当・UI担当はその型定義をimportして使用

### Prisma schemaの変更ルール
- Prisma schemaの変更はDB担当のみが行う
- schema変更後はDB担当がマイグレーション実行まで完了させる
- 他のチームメイトはマイグレーション完了通知後にPrisma Clientを使用

### コーディング規約
- コンポーネントは全て TypeScript (.tsx) で記述
- API Routes は全て TypeScript (.ts) で記述
- 日本語のUIテキストはハードコードせず、定数ファイルにまとめる
- エラーハンドリングは必ず実装する
- console.log はデバッグ後に削除する

## 主要エンティティ
Company, Department, JobCategory, JobType, Grade,
GradeJobTypeConfig, GradeRole, SalaryTable, SalaryTableEntry,
EvaluationCriteria, GradeAdjustmentRule, Employee,
EmployeeGradeHistory, InterviewRecord, EmployeeSalary,
EvaluationPeriod, IndividualEvaluation, EvaluationItem,
EvaluationScore, Evaluation360, EvaluatorAssignment,
Evaluation360Score, Position

---

## 号俸テーブル仕様

### 用語定義（重要）

| 正しい用語 | 意味 | DBカラム名（旧） |
|---|---|---|
| ランク | S1, S2, A1, A2, B1... D8 などの評価ランク | rank |
| 号俸帯 | 号俸の範囲グループ（旧「15T」「15」など） | - |
| 号俸帯数 | 号俸帯をいくつ作るか（例: 15） | totalRanks |
| 号俸帯内ステップ数 | 各号俸帯を何段階に分けるか（例: 8） | rankDivision |
| 号俸帯間増加率 | 号俸帯が上がるごとに号差を何倍にするか | increaseRate |
| 等級 | 正①〜正⑥ | Grade |

### フォーム ↔ DB マッピング

API層で以下のマッピングを行う：

```typescript
// フォーム（新用語） → DB（旧用語）
stepsPerBand     → rankDivision
bandIncreaseRate → increaseRate
salaryBandCount  → totalRanks
```

### 入力パラメータ（5つ）

1. **基本給（MIN）** - ユーザー入力（号俸1の基本給）
2. **初期号差** - 最下位号俸帯の号差（円）
3. **号俸帯間増加率** - 号俸帯が上がるごとに号差を何倍にするか（例: 1.05）
4. **号俸帯内ステップ数** - 各号俸帯内の段階数（例: 8 → S1〜S8）
5. **号俸帯数** - 全体の号俸帯数（例: 15）

※ **基本給（MAX）** は上記パラメータから自動計算される（入力不要）

### 生成アルゴリズム

```
【重要】増加率は「基本給」ではなく「号差（昇給幅）」に掛ける

Step 1: 最下位から積み上げる
- 号俸1（最下位 = D8）の基本給 = baseSalaryMin = 180,000円
- 号俸帯1（最下位）の号差 = initialStepDiff = 1,900円

Step 2: 号俸帯内は等差（足し算）
- 同じ号俸帯内（例：D8→D7→D6→...→D1）は、同じ号差で加算
  D8: 180,000
  D7: 180,000 + 1,900 = 181,900
  D6: 181,900 + 1,900 = 183,800
  ...以降同様

Step 3: 号俸帯が上がると号差が増加率倍になる
- 号俸帯1（D）の号差: 1,900円
- 号俸帯2（C）に上がる時: 号差 = 1,900 × 1.05 = 1,995円
- 号俸帯2（C8→C7→...→C1）は号差1,995円で等差加算
- 号俸帯3（B）に上がる時: 号差 = 1,995 × 1.05 ≒ 2,095円
- ...以降同様
```

### 計算例

パラメータ:
- baseSalaryMin: 180,000円
- initialStepDiff: 1,900円
- bandIncreaseRate: 1.05
- stepsPerBand: 8
- salaryBandCount: 15

結果:
- 総号俸数: 15 × 8 = 120号俸
- 号俸帯1（D）の号差: 1,900円
- 号俸帯15（S）の号差: 約3,762円
- 計算結果MAX: 約510,900円

### 関連ファイル

- `src/lib/salary-table/generator.ts` - 計算ロジック
- `src/lib/salary-table/index.ts` - 定数・バリデーション
- `src/types/salary.ts` - 型定義
- `src/components/salary-table/SalaryTableForm.tsx` - フォームUI
- `src/app/api/salary-tables/` - API Routes
