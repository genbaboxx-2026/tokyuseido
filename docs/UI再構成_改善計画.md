# NiNKU BOXX UI再構成 改善計画

## 目的

「初期構築（制度設計）」と「日常運用」を明確に分離し、ユーザーが今やるべきことに集中できるUI構成にする。

---

## 1. 現状の構造と課題

### 1.1 現在のサイドバー構成

```
運用
├── 概要           → /companies/[companyId]
├── 従業員管理      → /companies/[companyId]/employees
├── 運用           → /companies/[companyId]/operations
└── レポート出力    → /companies/[companyId]/reports

マスタ設定
├── 会社設定        → /companies/[companyId]/settings
└── 等級・賃金・評価（折りたたみ）
    ├── 等級制度    → /companies/[companyId]/grades
    ├── 号俸テーブル → /companies/[companyId]/salary-table
    └── 評価制度    → /companies/[companyId]/evaluations
```

### 1.2 現在の各画面のタブ構成

**号俸テーブル** (`/companies/[companyId]/salary-table`)
- 現基本給設定 → 初期設定用
- 詳細設定 → 初期設定用（パラメータ5つ入力）
- テーブル → 日常確認用
- 改定基準 → 日常運用用

**等級制度** (`/companies/[companyId]/grades`)
- 有効/無効設定 → 初期設定用（等級×職種マトリクス）
- 役割責任 → 初期設定用

**評価制度** (`/companies/[companyId]/evaluations`)
- 360度評価 → テンプレート設定 + 従業員評価セクション（設定と運用が混在）
- 個別評価 → テンプレートマトリクス + 従業員評価セクション（設定と運用が混在）
- 割合設定 → ランク閾値 + 従業員別割合設定

### 1.3 課題一覧

| # | 課題 | 影響 |
|---|------|------|
| 1 | 初期設定と日常運用が同じ画面に混在 | 日常で使わないタブが常に表示され認知負荷が高い |
| 2 | 号俸テーブル4タブのうち2タブは初期設定専用 | 設定完了後は不要なのに毎回目に入る |
| 3 | 評価制度のタブ内にテンプレ設定と評価実行が混在 | 設定を触る人と運用する人が異なる可能性 |
| 4 | 「運用」というメニュー名が曖昧 | 「評価実行」の方が直感的 |
| 5 | 評価→号俸変動→テーブル確認の導線がサイドバーから見えない | フロー全体を把握しにくい |

---

## 2. 改善後の構造

### 2.1 新しいサイドバー構成

```
日常運用
├── 概要（ダッシュボード）  → /companies/[companyId]
├── 従業員管理              → /companies/[companyId]/employees
├── 評価実行                → /companies/[companyId]/operations    ← リネーム
├── 号俸テーブル            → /companies/[companyId]/salary-table  ← 運用系タブのみ表示
└── レポート出力            → /companies/[companyId]/reports

制度設定
├── 会社設定                → /companies/[companyId]/settings
├── 等級制度設定            → /companies/[companyId]/grades         ← ウィザード化
├── 号俸テーブル設定        → /companies/[companyId]/salary-table/setup ← 新ルート
└── 評価制度設定            → /companies/[companyId]/evaluations    ← 設定のみ
```

### 2.2 対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/components/layout/Sidebar.tsx` | サイドバー構成の変更 |
| `src/app/companies/[companyId]/salary-table/page.tsx` | 運用系タブのみ表示に変更 |
| `src/app/companies/[companyId]/salary-table/setup/page.tsx` | **新規作成**: 号俸テーブル設定ウィザード |
| `src/app/companies/[companyId]/grades/page.tsx` | ウィザード形式に変更 |
| `src/app/companies/[companyId]/evaluations/page.tsx` | 設定系のみに変更 |

---

## 3. 実装タスク（優先順位順）

### Phase 1: サイドバー再構成

**対象ファイル:** `src/components/layout/Sidebar.tsx`

**変更内容:**

```typescript
// 変更前
const UI_TEXT = {
  SECTIONS: {
    OPERATIONS: "運用",
    MASTER_SETTINGS: "マスタ設定",
  },
};

// 変更後
const UI_TEXT = {
  SECTIONS: {
    DAILY_OPERATIONS: "日常運用",
    SYSTEM_SETTINGS: "制度設定",
  },
};
```

**新しいナビゲーション構成:**

```typescript
const getCompanyNavConfig = (companyId: string) => ({
  // 日常運用セクション
  dailyOperations: [
    { href: `/companies/${companyId}`, label: "概要", icon: Home, exact: true },
    { href: `/companies/${companyId}/employees`, label: "従業員管理", icon: Users },
    { href: `/companies/${companyId}/operations`, label: "評価実行", icon: Play },
    { href: `/companies/${companyId}/salary-table`, label: "号俸テーブル", icon: Table },
    { href: `/companies/${companyId}/reports`, label: "レポート出力", icon: FileDown },
  ],
  // 制度設定セクション
  systemSettings: [
    { href: `/companies/${companyId}/settings`, label: "会社設定", icon: Settings },
    { href: `/companies/${companyId}/grades`, label: "等級制度設定", icon: Award },
    { href: `/companies/${companyId}/salary-table/setup`, label: "号俸テーブル設定", icon: Sliders },
    { href: `/companies/${companyId}/evaluations`, label: "評価制度設定", icon: ClipboardList },
  ],
});
```

**ポイント:**
- 「等級・賃金・評価」の折りたたみメニューを廃止し、フラットな構成にする
- 「制度設定」セクションはデフォルトで折りたたみ（初回構築中は開いた状態）
- 「号俸テーブル」が日常運用と制度設定の両方にあるが、リンク先が異なる

---

### Phase 2: 号俸テーブル画面の分離

#### 2a. 日常運用側の号俸テーブル画面

**対象ファイル:** `src/app/companies/[companyId]/salary-table/page.tsx`

**変更内容:**
- タブを「テーブル」「改定基準」「現基本給」の3つだけにする
- 「詳細設定」タブを削除
- 右上に「⚙️ 設定を編集」ボタンを配置 → `/companies/[companyId]/salary-table/setup` へ遷移

```
変更前のタブ: [現基本給設定] [詳細設定] [テーブル] [改定基準]
変更後のタブ: [テーブル] [改定基準] [現基本給]  ⚙️設定を編集
```

**具体的な変更:**

1. `activeTab` の state から `"settings"` を削除
2. デフォルトタブを `"table"` に変更
3. TabsList から「詳細設定」タブを削除
4. `activeTab === "settings"` の表示ブロック（SalaryTableInputPanel + SalaryTableRealtimePreview）を削除
5. ヘッダー右側に「設定を編集」リンクボタンを追加

```tsx
// ヘッダー部分の変更
<div className="flex justify-between items-center">
  <div>
    <h1 className="text-2xl font-bold">号俸テーブル</h1>
    <p className="text-muted-foreground">
      号俸テーブルの確認と改定基準の管理を行います
    </p>
  </div>
  <Link href={`/companies/${companyId}/salary-table/setup`}>
    <Button variant="outline" size="sm">
      <Settings className="mr-2 h-4 w-4" />
      設定を編集
    </Button>
  </Link>
</div>
```

6. 号俸テーブル未設定の場合はテーブル画面ではなく、セットアップへの誘導を表示

```tsx
{!activeSalaryTable ? (
  <Card>
    <CardContent className="py-12 text-center">
      <p className="text-muted-foreground mb-4">号俸テーブルが設定されていません</p>
      <Link href={`/companies/${companyId}/salary-table/setup`}>
        <Button>号俸テーブルを設定する</Button>
      </Link>
    </CardContent>
  </Card>
) : (
  // テーブル・改定基準のタブ表示
)}
```

#### 2b. 制度設定側の号俸テーブル設定ウィザード

**新規ファイル:** `src/app/companies/[companyId]/salary-table/setup/page.tsx`

**コンポーネント構成:**

```
SalaryTableSetupPage
├── SalaryTableWizard
│   ├── Step 1: 基本給（MIN）入力
│   ├── Step 2: 号俸帯数入力
│   ├── Step 3: 号俸帯内ステップ数 + 開始/終了ランク入力
│   ├── Step 4: 初期号差 + 号俸帯間増加率 + 丸め設定
│   └── Step 5: プレビュー確認＆保存
└── 戻るボタン → /companies/[companyId]/salary-table
```

**ウィザードの仕様:**

| ステップ | 入力項目 | 説明 |
|---------|---------|------|
| Step 1 | 基本給（MIN） | 号俸1の基本給（例: 180,000円） |
| Step 2 | 号俸帯数 | 全体の号俸帯数（例: 15） |
| Step 3 | 号俸帯内ステップ数、開始ランク、終了ランク | ステップ数（例: 8）、ランク文字（S〜D） |
| Step 4 | 初期号差、号俸帯間増加率、丸め方法、丸め単位 | 号差（例: 1,900円）、増加率（例: 1.05） |
| Step 5 | （入力なし） | テーブルプレビュー + 号俸帯詳細 + 保存ボタン |

**ウィザードの挙動:**
- 既にテーブルが存在する場合は現在値をデフォルトで表示（編集モード）
- 各ステップで「戻る」「次へ」ボタン
- Step 5のプレビューには `SalaryTableRealtimePreview` コンポーネントを再利用
- 保存後は `/companies/[companyId]/salary-table` にリダイレクト

**既存コンポーネントの再利用:**
- `SalaryTableInputPanel` のフォーム部品をステップごとに分割利用
- `SalaryTableRealtimePreview` をStep 5でそのまま使用
- `calculateSalaryTable()` ロジックはそのまま使用

---

### Phase 3: 評価制度の設定/運用分離

**対象ファイル:** `src/app/companies/[companyId]/evaluations/page.tsx`

**変更内容:**

評価制度ページ（制度設定側）から、運用系の `EmployeeEvaluationSection` を除去し、純粋な設定画面にする。

```
変更前のタブ: [360度評価（テンプレ+運用）] [個別評価（テンプレ+運用）] [割合設定]
変更後のタブ: [360度テンプレート] [個別テンプレート] [割合・ランク設定]
```

**具体的な変更:**

1. タブラベルの変更

```tsx
// 変更前
<TabsTrigger value="360">360度評価</TabsTrigger>
<TabsTrigger value="individual">個別評価</TabsTrigger>
<TabsTrigger value="settings">割合設定</TabsTrigger>

// 変更後
<TabsTrigger value="360">360度テンプレート</TabsTrigger>
<TabsTrigger value="individual">個別テンプレート</TabsTrigger>
<TabsTrigger value="settings">割合・ランク設定</TabsTrigger>
```

2. 360度タブから `EmployeeEvaluationSection` を除去

```tsx
// 変更前
<TabsContent value="360">
  <Evaluation360TemplateSection companyId={companyId} />
  <EmployeeEvaluationSection companyId={companyId} evaluationType="360" />
</TabsContent>

// 変更後
<TabsContent value="360">
  <Evaluation360TemplateSection companyId={companyId} />
</TabsContent>
```

3. 個別評価タブから `EmployeeEvaluationSection` を除去

```tsx
// 変更前
<TabsContent value="individual">
  <EvaluationTemplateMatrixSection companyId={companyId} />
  <EmployeeEvaluationSection companyId={companyId} evaluationType="individual" />
</TabsContent>

// 変更後
<TabsContent value="individual">
  <EvaluationTemplateMatrixSection companyId={companyId} />
</TabsContent>
```

4. 不要なクエリ・状態の削除
   - `employees` のクエリ削除
   - `individualStatuses` のクエリ削除
   - `evaluation360Statuses` のクエリ削除
   - `isIndividualAllCompleted` の計算削除
   - `is360AllCompleted` の計算削除
   - タブの完了チェックアイコン削除

5. ページタイトルの変更

```tsx
// 変更前
<h1>評価制度</h1>
<p>評価テンプレートの管理と従業員の評価を行います</p>

// 変更後
<h1>評価制度設定</h1>
<p>評価テンプレートと割合・ランクの設定を行います</p>
```

**注意:**
- `EmployeeEvaluationSection` コンポーネントは削除しない（運用側で使う可能性があるため残す）
- 運用ダッシュボード（`/operations`）は現状のまま。評価実行は既にこちらで行う設計になっている

---

### Phase 4: 号俸テーブル設定ウィザードの実装

Phase 2b で定義したウィザードの詳細実装。

**新規作成ファイル:**
- `src/app/companies/[companyId]/salary-table/setup/page.tsx`
- `src/components/salary-table/SalaryTableWizard.tsx`

**ウィザードコンポーネントの設計:**

```tsx
interface SalaryTableWizardProps {
  companyId: string
  existingTable?: SalaryTableData  // 既存テーブルがある場合
  grades: Grade[]
  onComplete: () => void           // 保存完了後のコールバック
}

// 各ステップのコンポーネント
function StepBaseSalary({ value, onChange }: StepProps)
function StepBandCount({ value, onChange }: StepProps)
function StepStepsAndRank({ value, onChange }: StepProps)
function StepDiffAndRate({ value, onChange }: StepProps)
function StepPreview({ formData, grades, onSave }: PreviewStepProps)
```

**UI仕様:**
- ステップインジケーター（1/5, 2/5, ... 5/5）を上部に表示
- 各ステップで入力値の説明テキストを表示
- 「戻る」「次へ」ボタン
- Step 5では「保存」ボタン
- 各ステップでバリデーション（次へ進めない制御）
- アニメーション遷移（左右スライド）

---

### Phase 5: 等級制度設定のウィザード化（将来対応可）

**対象ファイル:** `src/app/companies/[companyId]/grades/page.tsx`

現在のタブ構成（有効/無効設定 + 役割責任）をウィザード形式に変更。

```
Step 1: 等級の定義
  - 等級一覧の表示（正1〜正6）
  - 等級の追加・削除
  - 等級の並び順設定

Step 2: 等級×職種マトリクス
  - 現在の「有効/無効設定」タブの内容
  - チェックボックスで有効/無効を設定

Step 3: 役割責任の入力
  - 現在の「役割責任」タブの内容
  - 有効な組み合わせに対して入力

Step 4: 確認＆保存
  - 設定内容のサマリー表示
```

**注意:** 等級は現在Server Component（`async function`）で実装されているため、ウィザード化する際にClient Componentへの変更が必要。工数が大きいため後回しでも可。

---

## 4. ルーティングまとめ

### 変更後のルート一覧

| ルート | 用途 | セクション | 変更種別 |
|--------|------|-----------|---------|
| `/companies/[companyId]` | 概要 | 日常運用 | 変更なし |
| `/companies/[companyId]/employees` | 従業員管理 | 日常運用 | 変更なし |
| `/companies/[companyId]/operations` | 評価実行 | 日常運用 | ラベル変更のみ |
| `/companies/[companyId]/salary-table` | 号俸テーブル（確認） | 日常運用 | タブ構成変更 |
| `/companies/[companyId]/reports` | レポート出力 | 日常運用 | 変更なし |
| `/companies/[companyId]/settings` | 会社設定 | 制度設定 | 変更なし |
| `/companies/[companyId]/grades` | 等級制度設定 | 制度設定 | 将来ウィザード化 |
| `/companies/[companyId]/salary-table/setup` | 号俸テーブル設定 | 制度設定 | **新規作成** |
| `/companies/[companyId]/evaluations` | 評価制度設定 | 制度設定 | 内容絞り込み |

---

## 5. 影響範囲と注意事項

### 削除・移動してよいもの

| 対象 | 判断 | 理由 |
|------|------|------|
| 号俸テーブルの「詳細設定」タブ | ✅ 移動 | `/salary-table/setup` に移動 |
| 評価制度の `EmployeeEvaluationSection` | ✅ 非表示化 | コンポーネント自体は残す（将来利用の可能性） |
| 評価制度の完了チェックロジック | ✅ 削除可 | 運用側（`/operations`）で管理 |

### 削除してはいけないもの

| 対象 | 理由 |
|------|------|
| `SalaryTableInputPanel` コンポーネント | ウィザードで再利用 |
| `SalaryTableRealtimePreview` コンポーネント | ウィザードのStep 5で再利用 |
| `calculateSalaryTable()` ロジック | そのまま使用 |
| `EmployeeEvaluationSection` コンポーネント | 将来利用の可能性 |
| 既存のAPIルート | 全て維持 |

### 注意事項

1. **号俸テーブルの `page.tsx` はサイドバーの2箇所からアクセスされる**
   - 日常運用: `/salary-table` → テーブル + 改定基準タブ
   - 制度設定: `/salary-table/setup` → ウィザード
   - パスが異なるので競合しない

2. **評価制度ページのURL変更なし**
   - `/evaluations` のまま。内容（表示するコンポーネント）だけ変更
   - ブックマーク等に影響なし

3. **既存データへの影響なし**
   - DB構造の変更なし
   - APIの変更なし
   - 純粋にUI/ルーティングの変更のみ

---

## 6. 実装順序（推奨）

```
Phase 1: サイドバー再構成
  ↓ （ここで全体の導線が変わる）
Phase 2a: 号俸テーブル画面の分離（運用側のタブ絞り込み）
  ↓
Phase 2b: 号俸テーブル設定ウィザード新規作成
  ↓
Phase 3: 評価制度の設定/運用分離
  ↓
Phase 4: ウィザードの詳細実装・UX調整
  ↓
Phase 5: 等級制度ウィザード化（将来対応）
```

各Phaseは独立してデプロイ可能。Phase 1 + 2a を先にやるだけでも大きな改善になる。

---

## 7. 完了条件

- [ ] サイドバーが「日常運用」「制度設定」の2セクションに分かれている
- [ ] 号俸テーブルの日常画面から設定タブが消えている
- [ ] 号俸テーブル設定ウィザードが `/salary-table/setup` で動作する
- [ ] 評価制度ページがテンプレート設定のみになっている
- [ ] 既存の運用ダッシュボード（`/operations`）は変更なく動作する
- [ ] 全既存APIが正常に動作する
- [ ] 号俸テーブル未設定時にセットアップへの誘導が表示される
