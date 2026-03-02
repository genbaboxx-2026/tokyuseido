/**
 * 評価シートPDF生成コンポーネント
 * @react-pdf/renderer を使用して A4 形式の評価シートを生成
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { EvaluationSheet, EvaluationRating } from '@/types/evaluation';

// Noto Sans JP フォントの登録（日本語対応）
Font.register({
  family: 'NotoSansJP',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFJUj75vN0g.ttf',
      fontWeight: 700,
    },
  ],
});

// スタイル定義
const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 9,
    padding: 30,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 15,
    borderBottom: '2px solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    color: '#666',
  },
  infoSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    width: 80,
    fontWeight: 700,
    color: '#333',
  },
  infoValue: {
    flex: 1,
    color: '#000',
  },
  categorySection: {
    marginBottom: 15,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: 700,
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: 6,
    marginBottom: 0,
  },
  table: {
    borderWidth: 1,
    borderColor: '#ccc',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tableHeaderCell: {
    padding: 5,
    fontWeight: 700,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ccc',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: 28,
  },
  tableCell: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#eee',
    justifyContent: 'center',
  },
  itemCell: {
    width: 120,
  },
  scoreCell: {
    width: 40,
    textAlign: 'center',
  },
  previousCell: {
    width: 40,
    textAlign: 'center',
  },
  commentCell: {
    flex: 1,
    fontSize: 8,
  },
  summary: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f9ff',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#2563eb',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
});

// 評価レートの表示ラベル
const ratingLabels: Record<EvaluationRating, string> = {
  S: 'S（非常に優秀）',
  A: 'A（優秀）',
  B: 'B（標準）',
  C: 'C（要改善）',
  D: 'D（不十分）',
};

// 評価シートPDFドキュメント
interface EvaluationSheetPDFProps {
  data: EvaluationSheet;
}

export function EvaluationSheetPDF({ data }: EvaluationSheetPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>NiNKU BOXX 評価シート</Text>
          <Text style={styles.subtitle}>対象期間: {data.period.name}</Text>
        </View>

        {/* 基本情報 */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>被評価者:</Text>
            <Text style={styles.infoValue}>
              {data.employee.name}（{data.employee.employeeCode}）
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>所属:</Text>
            <Text style={styles.infoValue}>{data.employee.department}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>等級 / 職種:</Text>
            <Text style={styles.infoValue}>
              {data.employee.grade} / {data.employee.jobType}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>評価者:</Text>
            <Text style={styles.infoValue}>{data.evaluator.name}</Text>
          </View>
        </View>

        {/* 評価カテゴリ別テーブル */}
        {data.categories.map((category, categoryIndex) => (
          <View key={categoryIndex} style={styles.categorySection} wrap={false}>
            <Text style={styles.categoryTitle}>【{category.name}】</Text>
            <View style={styles.table}>
              {/* テーブルヘッダー */}
              <View style={styles.tableHeader}>
                <View style={[styles.tableHeaderCell, styles.itemCell]}>
                  <Text>評価項目</Text>
                </View>
                <View style={[styles.tableHeaderCell, styles.scoreCell]}>
                  <Text>自己</Text>
                </View>
                <View style={[styles.tableHeaderCell, styles.scoreCell]}>
                  <Text>上司</Text>
                </View>
                <View style={[styles.tableHeaderCell, styles.previousCell]}>
                  <Text>前回</Text>
                </View>
                <View style={[styles.tableHeaderCell, styles.commentCell, { borderRightWidth: 0 }]}>
                  <Text>コメント</Text>
                </View>
              </View>

              {/* テーブルボディ */}
              {category.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.itemCell]}>
                    <Text>{item.name}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.scoreCell]}>
                    <Text>{item.selfScore !== null ? item.selfScore : '-'}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.scoreCell]}>
                    <Text>{item.evaluatorScore !== null ? item.evaluatorScore : '-'}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.previousCell]}>
                    <Text>{item.previousScore !== null ? item.previousScore : '-'}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.commentCell, { borderRightWidth: 0 }]}>
                    <Text>{item.comment || ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* 合計・最終評価 */}
        <View style={styles.summary}>
          <Text style={{ fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
            評価サマリー
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>合計スコア</Text>
              <Text style={styles.summaryValue}>
                {data.totalScore !== null ? data.totalScore.toFixed(1) : '-'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>評価レート</Text>
              <Text style={styles.summaryValue}>
                {data.finalRating ? ratingLabels[data.finalRating] : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* フッター */}
        <Text style={styles.footer}>
          NiNKU BOXX - 人事制度プロダクト | Generated at {new Date().toLocaleDateString('ja-JP')}
        </Text>
      </Page>
    </Document>
  );
}
