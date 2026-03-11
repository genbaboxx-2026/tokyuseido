# 会社設定ページ UI統一 要件定義

## 概要

会社設定ページ（`/companies/[companyId]/settings`）のUI/UXを統一し、全ての変更を1つの「保存」ボタンで一括保存できるように改修する。

## 現状の課題

| タブ | 現状の保存方式 | 問題点 |
|------|---------------|--------|
| 基本情報 | 編集ボタン→編集モード→保存 | 2ステップ必要 |
| 組織管理 | 追加/編集/削除で即時保存 | 他タブと挙動が異なる |
| 給与設定 | フォーム編集→保存ボタン | 各カード毎に保存ボタン |

## 目標とするUI

```
会社設定                                          [保存]
株式会社サンプル解体の設定を管理します

[基本情報] [組織管理] [給与設定]

（タブコンテンツ）
```

- タイトル横に1つの「保存」ボタンを常に表示
- 全タブの変更を追跡し、変更があれば保存ボタンを有効化
- 保存ボタンを押すと全ての変更を一括保存

---

## 技術仕様

### 1. ファイル構成

```
src/
├── app/companies/[companyId]/settings/
│   └── page.tsx                    # サーバーコンポーネント（データ取得のみ）
├── components/companies/
│   ├── CompanySettingsClient.tsx   # 新規: メインクライアントコンポーネント
│   ├── CompanyBasicInfoForm.tsx    # 新規: 基本情報フォーム
│   ├── PositionManagerEditable.tsx # 新規: 役職管理（編集モード）
│   ├── JobTypeManagerEditable.tsx  # 新規: 職種管理（編集モード）
│   ├── SalarySettingsForm.tsx      # 新規: 給与設定フォーム
│   ├── BonusSettingsForm.tsx       # 新規: 賞与設定フォーム
│   └── index.ts                    # エクスポート追加
└── app/api/companies/[id]/
    └── settings-bulk/
        └── route.ts                # 新規: 一括保存API
```

### 2. データ構造

#### 2.1 ペンディング変更の型定義

```typescript
interface PendingChanges {
  // 基本情報の変更
  basicInfo: {
    name?: string;
    address?: string | null;
    representative?: string | null;
    establishedDate?: string | null;
    businessDescription?: string | null;
    evaluationCycle?: string | null;
  } | null;

  // 役職の変更
  positions: {
    added: { tempId: string; name: string; level: number }[];
    updated: { id: string; name: string; level: number }[];
    deleted: string[];
  } | null;

  // 職種大分類・職種の変更
  jobCategories: {
    added: { tempId: string; name: string }[];
    updated: { id: string; name: string }[];
    deleted: string[];
    jobTypesAdded: { categoryId: string; tempId: string; name: string }[];
    jobTypesUpdated: { id: string; name: string }[];
    jobTypesDeleted: string[];
  } | null;

  // 給与設定の変更
  salarySettings: {
    salaryReflectionMonth?: number | null;
    salaryReflectionDay?: number | null;
    evaluationPeriodStart?: string | null;
    evaluationPeriodEnd?: string | null;
  } | null;

  // 賞与設定の変更
  bonusSettings: {
    added: {
      tempId: string;
      name: string;
      paymentDate: string;
      assessmentStartDate: string;
      assessmentEndDate: string;
      evaluationStartDate: string;
      evaluationEndDate: string;
    }[];
    updated: {
      id: string;
      name: string;
      paymentDate: string;
      assessmentStartDate: string;
      assessmentEndDate: string;
      evaluationStartDate: string;
      evaluationEndDate: string;
    }[];
    deleted: string[];
  } | null;
}
```

---

## 3. コンポーネント詳細仕様

### 3.1 CompanySettingsClient.tsx

**役割**: 全体の状態管理とUI

**Props**:
```typescript
interface CompanySettingsClientProps {
  company: Company;
  bonusSettings: BonusSetting[];
}
```

**機能**:
- `pendingChanges` 状態を管理
- 各子コンポーネントから変更通知を受け取る
- `hasChanges` フラグで保存ボタンの有効/無効を制御
- 保存ボタン押下時に一括保存APIを呼び出し

**UI構造**:
```tsx
<div className="space-y-6">
  <div className="flex items-start justify-between">
    <div>
      <h1>会社設定</h1>
      <p>{company.name}の設定を管理します</p>
    </div>
    <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
      <Save /> 保存
    </Button>
  </div>
  <Tabs>
    <TabsList>
      <TabsTrigger value="basic">基本情報</TabsTrigger>
      <TabsTrigger value="organization">組織管理</TabsTrigger>
      <TabsTrigger value="salary">給与設定</TabsTrigger>
    </TabsList>
    {/* TabsContent... */}
  </Tabs>
</div>
```

---

### 3.2 CompanyBasicInfoForm.tsx

**役割**: 基本情報の編集フォーム（常に編集可能）

**Props**:
```typescript
interface CompanyBasicInfoFormProps {
  company: {
    name: string;
    address: string | null;
    representative: string | null;
    establishedDate: Date | null;
    businessDescription: string | null;
    evaluationCycle: string | null;
  };
  onChange: (data: PendingChanges["basicInfo"]) => void;
}
```

**フィールド**:
| フィールド | ラベル | 型 | 必須 |
|-----------|--------|-----|------|
| name | 会社名 | text | ○ |
| representative | 代表者 | text | |
| address | 住所 | text | |
| establishedDate | 設立日 | date | |
| evaluationCycle | 評価周期 | select (半期/四半期/年次) | |
| businessDescription | 事業内容 | textarea | |

**動作**:
- 初期値は `company` props から設定
- 値が変更されたら `onChange` を呼び出し
- 初期値と同じ場合は `onChange(null)` を呼び出し（変更なしを通知）

---

### 3.3 PositionManagerEditable.tsx

**役割**: 役職の追加/編集/削除（ペンディング状態で管理）

**Props**:
```typescript
interface PositionManagerEditableProps {
  companyId: string;
  initialPositions: { id: string; name: string; level: number }[];
  onChange: (data: PendingChanges["positions"]) => void;
}
```

**状態管理**:
```typescript
// ローカル状態（表示用）
const [positions, setPositions] = useState(initialPositions);

// ペンディング変更の追跡
const [addedPositions, setAddedPositions] = useState([]);
const [updatedPositions, setUpdatedPositions] = useState([]);
const [deletedPositionIds, setDeletedPositionIds] = useState([]);
```

**UI**:
- 役職一覧をテーブル表示
- 各行に「編集」「削除」ボタン
- 「役職を追加」ボタン
- 追加された項目は視覚的に区別（例: 背景色を薄い緑に）
- 削除された項目は取り消し線で表示、または非表示

**動作**:
- 追加: `addedPositions` に追加、`positions` にも追加（tempId付き）
- 編集: 既存なら `updatedPositions` に追加、追加済みなら `addedPositions` を更新
- 削除: 既存なら `deletedPositionIds` に追加、追加済みなら `addedPositions` から削除
- 変更があれば `onChange` を呼び出し

---

### 3.4 JobTypeManagerEditable.tsx

**役割**: 職種大分類・職種の追加/編集/削除（ペンディング状態で管理）

**Props**:
```typescript
interface JobTypeManagerEditableProps {
  companyId: string;
  initialJobCategories: {
    id: string;
    name: string;
    jobTypes: { id: string; name: string }[];
  }[];
  onChange: (data: PendingChanges["jobCategories"]) => void;
}
```

**UI**:
- 職種大分類ごとにカード表示
- 各職種大分類内に職種をタグ表示
- 「部署を追加」「職種を追加」ボタン
- 編集/削除ボタン

**動作**:
- PositionManagerEditable と同様のペンディング状態管理
- 職種大分類と職種を別々に追跡

---

### 3.5 SalarySettingsForm.tsx

**役割**: 給与設定フォーム

**Props**:
```typescript
interface SalarySettingsFormProps {
  companyId: string;
  initialSettings: {
    salaryReflectionMonth: number | null;
    salaryReflectionDay: number | null;
    evaluationPeriodStart: Date | null;
    evaluationPeriodEnd: Date | null;
  };
  onChange: (data: PendingChanges["salarySettings"]) => void;
}
```

**フィールド**:
| フィールド | ラベル | 型 |
|-----------|--------|-----|
| salaryReflectionMonth | 号俸反映月 | select (1-12) |
| salaryReflectionDay | 号俸反映日 | select (1-31) |
| evaluationPeriodStart | 査定対象期間（開始） | month-day picker |
| evaluationPeriodEnd | 査定対象期間（終了） | month-day picker |

---

### 3.6 BonusSettingsForm.tsx

**役割**: 賞与設定の追加/編集/削除

**Props**:
```typescript
interface BonusSettingsFormProps {
  companyId: string;
  initialBonusSettings: BonusSetting[];
  onChange: (data: PendingChanges["bonusSettings"]) => void;
}
```

**フィールド**（各賞与設定）:
| フィールド | ラベル | 型 | 必須 |
|-----------|--------|-----|------|
| name | 賞与名 | text | ○ |
| paymentDate | 支給日 | date | ○ |
| assessmentStartDate | 査定対象期間（開始） | date | ○ |
| assessmentEndDate | 査定対象期間（終了） | date | ○ |
| evaluationStartDate | 評価実施期間（開始） | date | ○ |
| evaluationEndDate | 評価実施期間（終了） | date | ○ |

---

## 4. API仕様

### 4.1 一括保存API

**エンドポイント**: `PUT /api/companies/[id]/settings-bulk`

**リクエストボディ**: `PendingChanges` 型

**処理フロー**:
```typescript
// トランザクションで一括処理
await prisma.$transaction(async (tx) => {
  // 1. 基本情報の更新
  if (pendingChanges.basicInfo) {
    await tx.company.update({
      where: { id },
      data: pendingChanges.basicInfo,
    });
  }

  // 2. 役職の処理
  if (pendingChanges.positions) {
    // 削除
    for (const positionId of pendingChanges.positions.deleted) {
      await tx.position.delete({ where: { id: positionId } });
    }
    // 更新
    for (const pos of pendingChanges.positions.updated) {
      await tx.position.update({
        where: { id: pos.id },
        data: { name: pos.name, level: pos.level },
      });
    }
    // 追加
    for (const pos of pendingChanges.positions.added) {
      await tx.position.create({
        data: { companyId: id, name: pos.name, level: pos.level },
      });
    }
  }

  // 3. 職種大分類・職種の処理
  if (pendingChanges.jobCategories) {
    // 職種の削除（先に実行）
    for (const jobTypeId of pendingChanges.jobCategories.jobTypesDeleted) {
      await tx.jobType.delete({ where: { id: jobTypeId } });
    }
    // 職種大分類の削除
    for (const categoryId of pendingChanges.jobCategories.deleted) {
      await tx.jobCategory.delete({ where: { id: categoryId } });
    }
    // 職種大分類の更新
    for (const cat of pendingChanges.jobCategories.updated) {
      await tx.jobCategory.update({
        where: { id: cat.id },
        data: { name: cat.name },
      });
    }
    // 職種大分類の追加（IDマッピング用にMapを使用）
    const categoryIdMap = new Map<string, string>();
    for (const cat of pendingChanges.jobCategories.added) {
      const created = await tx.jobCategory.create({
        data: { companyId: id, name: cat.name },
      });
      categoryIdMap.set(cat.tempId, created.id);
    }
    // 職種の更新
    for (const jt of pendingChanges.jobCategories.jobTypesUpdated) {
      await tx.jobType.update({
        where: { id: jt.id },
        data: { name: jt.name },
      });
    }
    // 職種の追加
    for (const jt of pendingChanges.jobCategories.jobTypesAdded) {
      const realCategoryId = categoryIdMap.get(jt.categoryId) || jt.categoryId;
      await tx.jobType.create({
        data: { jobCategoryId: realCategoryId, name: jt.name },
      });
    }
  }

  // 4. 給与設定の更新
  if (pendingChanges.salarySettings) {
    await tx.company.update({
      where: { id },
      data: {
        salaryReflectionMonth: pendingChanges.salarySettings.salaryReflectionMonth,
        salaryReflectionDay: pendingChanges.salarySettings.salaryReflectionDay,
        evaluationPeriodStart: pendingChanges.salarySettings.evaluationPeriodStart
          ? new Date(pendingChanges.salarySettings.evaluationPeriodStart)
          : null,
        evaluationPeriodEnd: pendingChanges.salarySettings.evaluationPeriodEnd
          ? new Date(pendingChanges.salarySettings.evaluationPeriodEnd)
          : null,
      },
    });
  }

  // 5. 賞与設定の処理
  if (pendingChanges.bonusSettings) {
    // 削除
    for (const bonusId of pendingChanges.bonusSettings.deleted) {
      await tx.bonusSetting.delete({ where: { id: bonusId } });
    }
    // 更新
    for (const bonus of pendingChanges.bonusSettings.updated) {
      await tx.bonusSetting.update({
        where: { id: bonus.id },
        data: {
          name: bonus.name,
          paymentDate: new Date(bonus.paymentDate),
          assessmentStartDate: new Date(bonus.assessmentStartDate),
          assessmentEndDate: new Date(bonus.assessmentEndDate),
          evaluationStartDate: new Date(bonus.evaluationStartDate),
          evaluationEndDate: new Date(bonus.evaluationEndDate),
        },
      });
    }
    // 追加
    for (const bonus of pendingChanges.bonusSettings.added) {
      await tx.bonusSetting.create({
        data: {
          companyId: id,
          name: bonus.name,
          paymentDate: new Date(bonus.paymentDate),
          assessmentStartDate: new Date(bonus.assessmentStartDate),
          assessmentEndDate: new Date(bonus.assessmentEndDate),
          evaluationStartDate: new Date(bonus.evaluationStartDate),
          evaluationEndDate: new Date(bonus.evaluationEndDate),
        },
      });
    }
  }
});
```

**レスポンス**:
- 成功: `200 OK` `{ success: true }`
- エラー: `400/500` `{ error: "エラーメッセージ" }`

---

## 5. 削除するファイル/コード

### 5.1 削除するコンポーネント
- `src/components/companies/CompanyCard.tsx` の編集モード機能
- `src/components/companies/PositionManager.tsx` の即時保存ロジック
- `src/components/companies/JobTypeManager.tsx` の即時保存ロジック
- `src/components/companies/SalarySettingManager.tsx`（SalarySettingsFormに置き換え）
- `src/components/companies/BonusSettingManager.tsx`（BonusSettingsFormに置き換え）
- `src/components/companies/SalaryTabPanel.tsx`（不要になる）

### 5.2 削除するAPI（オプション）
以下のAPIは個別保存用なので、一括保存に統一後は不要になる可能性あり。ただし、他の箇所で使用されている場合は残す。
- `PUT /api/companies/[id]/salary-settings`
- `POST/PUT/DELETE /api/companies/[id]/bonus-settings`
- `POST/PUT/DELETE /api/companies/[id]/positions`
- `POST/PUT/DELETE /api/companies/[id]/job-categories`
- `POST/PUT/DELETE /api/companies/[id]/job-types`

---

## 6. UI/UXガイドライン

### 6.1 変更の視覚的フィードバック

| 状態 | 視覚表現 |
|------|----------|
| 追加された項目 | 背景色: `bg-green-50` |
| 編集された項目 | 背景色: `bg-yellow-50` |
| 削除された項目 | 取り消し線 + 背景色: `bg-red-50` |

### 6.2 保存ボタンの状態

| 状態 | 表示 |
|------|------|
| 変更なし | disabled、グレーアウト |
| 変更あり | enabled、プライマリカラー |
| 保存中 | disabled、「保存中...」テキスト、スピナー表示 |

### 6.3 エラー処理

- バリデーションエラー: 該当フィールドの下に赤字で表示
- API エラー: アラートダイアログで表示
- ネットワークエラー: リトライ可能なトーストで表示

---

## 7. テスト観点

### 7.1 単体テスト
- 各フォームコンポーネントの入力/変更検知
- `onChange` コールバックの呼び出し確認
- バリデーションロジック

### 7.2 統合テスト
- タブ間の移動で状態が保持されること
- 保存ボタンの有効/無効が正しく切り替わること
- 一括保存APIが正しいデータを送信すること

### 7.3 E2Eテスト
- 基本情報の編集→保存→リロード→反映確認
- 役職の追加/編集/削除→保存→リロード→反映確認
- 職種の追加/編集/削除→保存→リロード→反映確認
- 給与設定の編集→保存→リロード→反映確認
- 賞与設定の追加/編集/削除→保存→リロード→反映確認

---

## 8. 実装順序

1. **API実装** (`settings-bulk/route.ts`)
2. **CompanyBasicInfoForm** - 最もシンプル
3. **SalarySettingsForm** - 既存ロジックを流用
4. **BonusSettingsForm** - 追加/削除ロジック含む
5. **PositionManagerEditable** - 追加/編集/削除
6. **JobTypeManagerEditable** - 親子関係あり、最も複雑
7. **CompanySettingsClient** - 統合
8. **page.tsx の更新** - 最後に統合

---

## 9. 既存コードの参照先

| 新規コンポーネント | 参考にする既存コード |
|-------------------|---------------------|
| CompanyBasicInfoForm | `src/components/companies/CompanyForm.tsx` |
| PositionManagerEditable | `src/components/companies/PositionManager.tsx` |
| JobTypeManagerEditable | `src/components/companies/JobTypeManager.tsx` |
| SalarySettingsForm | `src/components/companies/SalarySettingManager.tsx` |
| BonusSettingsForm | `src/components/companies/BonusSettingManager.tsx` |

---

## 10. 注意事項

1. **トランザクション**: 一括保存は必ずトランザクションで実行し、部分的な保存を防ぐ
2. **tempId**: 新規追加項目には一時的なID（`crypto.randomUUID()`）を付与し、親子関係のマッピングに使用
3. **削除の順序**: 外部キー制約があるため、子（JobType）を先に削除してから親（JobCategory）を削除
4. **既存APIとの互換性**: 他の画面で使用されている可能性があるため、既存APIは削除せず残す
5. **リロード vs 状態更新**: 保存成功後は `window.location.reload()` でリロードし、サーバーから最新データを取得

---

## 11. 完了条件

- [ ] 会社設定ページで「保存」ボタンが常にタイトル横に表示される
- [ ] 基本情報タブで編集ボタンなしで直接編集できる
- [ ] 組織管理タブで追加/編集/削除が保存ボタンを押すまで確定しない
- [ ] 給与設定タブで変更が保存ボタンを押すまで確定しない
- [ ] 変更がない場合は保存ボタンが無効化される
- [ ] 保存ボタンを押すと全ての変更が一括でDBに保存される
- [ ] 保存成功後、画面に最新のデータが表示される
- [ ] エラー時に適切なメッセージが表示される
