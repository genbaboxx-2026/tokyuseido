/**
 * メールテンプレートビルダーの回帰テスト
 * family_tag: dry-violation
 */
import { describe, it, expect } from 'vitest'
import { buildEmailHtml } from '@/lib/email'

describe('buildEmailHtml（DRY回帰テスト）', () => {
  const baseOptions = {
    title: 'テストタイトル',
    subtitle: 'テスト会社',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    bodyHtml: '<p>テスト本文</p>',
    ctaText: '開始する',
    ctaUrl: 'https://example.com/test',
    linkColor: '#667eea',
  }

  it('DOCTYPE、html lang="ja"、metaタグを含む', () => {
    const html = buildEmailHtml(baseOptions)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="ja">')
    expect(html).toContain('<meta charset="UTF-8">')
    expect(html).toContain('viewport')
  })

  it('ヘッダーにタイトルとサブタイトルを含む', () => {
    const html = buildEmailHtml(baseOptions)
    expect(html).toContain('テストタイトル')
    expect(html).toContain('テスト会社')
  })

  it('グラデーションがヘッダーとCTAボタンに適用される', () => {
    const html = buildEmailHtml(baseOptions)
    const gradientOccurrences = html.split(baseOptions.gradient).length - 1
    // ヘッダー + CTAボタン = 2箇所
    expect(gradientOccurrences).toBe(2)
  })

  it('CTAボタンのテキストとURLが正しい', () => {
    const html = buildEmailHtml(baseOptions)
    expect(html).toContain('開始する')
    expect(html).toContain('href="https://example.com/test"')
  })

  it('フッターに自動送信メッセージとURLフォールバックを含む', () => {
    const html = buildEmailHtml(baseOptions)
    expect(html).toContain('NiNKU BOXX から自動送信されています')
    expect(html).toContain('ボタンが機能しない場合')
    expect(html).toContain(`color: ${baseOptions.linkColor}`)
  })

  it('footerNoteが指定されている場合に表示される', () => {
    const html = buildEmailHtml({
      ...baseOptions,
      footerNote: 'このリンクはあなた専用です。',
    })
    expect(html).toContain('このリンクはあなた専用です。')
  })

  it('footerNoteが未指定の場合はfooterNote部分が出力されない', () => {
    const html = buildEmailHtml(baseOptions)
    expect(html).not.toContain('このリンクはあなた専用です')
  })

  it('本文HTMLがそのまま挿入される', () => {
    const html = buildEmailHtml(baseOptions)
    expect(html).toContain('<p>テスト本文</p>')
  })
})
