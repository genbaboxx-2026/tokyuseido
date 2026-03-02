/**
 * 号俸テーブルPDF生成コンポーネント
 * @react-pdf/renderer を使用して A4 横向きの号俸テーブルを生成
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
import type { SalaryTableMatrixResponse } from '@/types/salary';

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
    fontSize: 7,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 15,
    borderBottom: '2px solid #333',
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  infoItem: {
    flexDirection: 'row',
    fontSize: 8,
  },
  infoLabel: {
    fontWeight: 700,
    color: '#333',
    marginRight: 4,
  },
  infoValue: {
    color: '#666',
  },
  table: {
    borderWidth: 1,
    borderColor: '#333',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
  },
  tableHeaderCell: {
    padding: 4,
    fontWeight: 700,
    textAlign: 'center',
    color: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#ffffff',
  },
  stepCell: {
    width: 30,
  },
  rankCell: {
    width: 25,
  },
  gradeCell: {
    width: 55,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  tableRowAlt: {
    backgroundColor: '#f9f9f9',
  },
  tableCell: {
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    textAlign: 'center',
    justifyContent: 'center',
  },
  zoneS: {
    backgroundColor: '#fef3c7',
  },
  zoneA: {
    backgroundColor: '#dcfce7',
  },
  zoneB: {
    backgroundColor: '#dbeafe',
  },
  zoneC: {
    backgroundColor: '#fce7f3',
  },
  zoneD: {
    backgroundColor: '#fee2e2',
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 7,
    color: '#999',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendBox: {
    width: 12,
    height: 12,
  },
  legendText: {
    fontSize: 7,
  },
});

// ランクからゾーンを判定
function getZoneFromRank(rank: string): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (rank.startsWith('S')) return 'S';
  if (rank.startsWith('A')) return 'A';
  if (rank.startsWith('B')) return 'B';
  if (rank.startsWith('C')) return 'C';
  return 'D';
}

// ゾーン別スタイル取得
function getZoneStyle(rank: string) {
  const zone = getZoneFromRank(rank);
  switch (zone) {
    case 'S':
      return styles.zoneS;
    case 'A':
      return styles.zoneA;
    case 'B':
      return styles.zoneB;
    case 'C':
      return styles.zoneC;
    case 'D':
      return styles.zoneD;
  }
}

// 金額フォーマット
function formatCurrency(amount: number): string {
  return amount.toLocaleString('ja-JP');
}

// 号俸テーブルPDFドキュメント
interface SalaryTablePDFProps {
  data: SalaryTableMatrixResponse;
}

export function SalaryTablePDF({ data }: SalaryTablePDFProps) {
  const { salaryTable, grades, rows } = data;

  // 等級をレベル順にソート（降順 = 高い等級から）
  const sortedGrades = [...grades].sort((a, b) => b.level - a.level);

  // 動的に等級セル幅を計算
  const gradeCount = sortedGrades.length;
  const gradeCellWidth = gradeCount > 0 ? Math.min(70, Math.floor(700 / gradeCount)) : 55;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>NiNKU BOXX 号俸テーブル</Text>
          <Text style={styles.subtitle}>{salaryTable.name}</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>基本給MAX:</Text>
              <Text style={styles.infoValue}>{formatCurrency(salaryTable.baseSalaryMax)}円</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>基本給MIN:</Text>
              <Text style={styles.infoValue}>{formatCurrency(salaryTable.baseSalaryMin)}円</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>ランク分割数:</Text>
              <Text style={styles.infoValue}>{salaryTable.rankDivision}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>ランク間増加率:</Text>
              <Text style={styles.infoValue}>{(salaryTable.increaseRate * 100).toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        {/* テーブル */}
        <View style={styles.table}>
          {/* テーブルヘッダー */}
          <View style={styles.tableHeader}>
            <View style={[styles.tableHeaderCell, styles.stepCell]}>
              <Text>号俸</Text>
            </View>
            <View style={[styles.tableHeaderCell, styles.rankCell]}>
              <Text>ランク</Text>
            </View>
            {sortedGrades.map((grade, index) => (
              <View
                key={grade.id}
                style={[
                  styles.tableHeaderCell,
                  { width: gradeCellWidth },
                  index === sortedGrades.length - 1 ? { borderRightWidth: 0 } : {},
                ]}
              >
                <Text>{grade.name}</Text>
              </View>
            ))}
          </View>

          {/* テーブルボディ */}
          {rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[
                styles.tableRow,
                rowIndex % 2 === 1 ? styles.tableRowAlt : {},
                getZoneStyle(row.rank),
              ]}
            >
              <View style={[styles.tableCell, styles.stepCell]}>
                <Text>{row.stepNumber}</Text>
              </View>
              <View style={[styles.tableCell, styles.rankCell]}>
                <Text>{row.rank}</Text>
              </View>
              {sortedGrades.map((grade, gradeIndex) => {
                const entry = row.entries.find((e) => e.gradeId === grade.id);
                return (
                  <View
                    key={grade.id}
                    style={[
                      styles.tableCell,
                      { width: gradeCellWidth },
                      gradeIndex === sortedGrades.length - 1 ? { borderRightWidth: 0 } : {},
                    ]}
                  >
                    <Text>{entry ? formatCurrency(entry.baseSalary) : '-'}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* 凡例 */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.zoneS]} />
            <Text style={styles.legendText}>Sゾーン</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.zoneA]} />
            <Text style={styles.legendText}>Aゾーン</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.zoneB]} />
            <Text style={styles.legendText}>Bゾーン</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.zoneC]} />
            <Text style={styles.legendText}>Cゾーン</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.zoneD]} />
            <Text style={styles.legendText}>Dゾーン</Text>
          </View>
        </View>

        {/* フッター */}
        <Text style={styles.footer}>
          NiNKU BOXX - 人事制度プロダクト | Generated at{' '}
          {new Date().toLocaleDateString('ja-JP')} | 単位: 円
        </Text>
      </Page>
    </Document>
  );
}
