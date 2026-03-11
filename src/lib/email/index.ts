import { Resend } from "resend";

// Resendクライアント（API KEY未設定時はnull）
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// 環境変数
const EMAIL_FROM = process.env.EMAIL_FROM || "NiNKU BOXX <noreply@ninku.app>";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * メール送信関数
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const { to, subject, html, text } = options;

  if (!resend) {
    console.warn("Resend API key not configured. Email would be sent to:", to);
    console.warn("Subject:", subject);
    return {
      success: true,
      messageId: "dev-mode-" + Date.now(),
    };
  }

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text: text || htmlToText(html),
    });

    if (result.error) {
      console.error("Failed to send email:", result.error);
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// メールテンプレートビルダー
// ============================================

interface EmailTemplateOptions {
  /** ヘッダータイトル */
  title: string;
  /** ヘッダーサブタイトル */
  subtitle: string;
  /** ヘッダー・CTAボタンのグラデーション */
  gradient: string;
  /** コンテンツ本文（HTML） */
  bodyHtml: string;
  /** CTAボタンテキスト */
  ctaText: string;
  /** CTAボタンURL */
  ctaUrl: string;
  /** フッターのリンク色 */
  linkColor: string;
  /** フッターの補足テキスト（任意） */
  footerNote?: string;
}

/**
 * 共通メールHTMLテンプレートビルダー
 */
export function buildEmailHtml(options: EmailTemplateOptions): string {
  const { title, subtitle, gradient, bodyHtml, ctaText, ctaUrl, linkColor, footerNote } = options;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${gradient}; padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${subtitle}</p>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
    ${bodyHtml}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${ctaUrl}" style="display: inline-block; background: ${gradient}; color: white; text-decoration: none; padding: 15px 40px; border-radius: 50px; font-weight: bold; font-size: 16px;">${ctaText}</a>
    </div>

    ${footerNote ? `<p style="font-size: 12px; color: #666;">${footerNote}</p>` : ""}

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; margin-bottom: 0;">
      このメールは NiNKU BOXX から自動送信されています。<br>
      ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：<br>
      <a href="${ctaUrl}" style="color: ${linkColor}; word-break: break-all;">${ctaUrl}</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 日本語日付フォーマットヘルパー
 */
function formatDeadlineJa(deadline: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(deadline);
}

/**
 * 期限までの残り日数と緊急度を計算
 */
function calcUrgency(deadline: Date): { daysLeft: number; urgencyColor: string; urgencyText: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const urgencyColor = daysLeft <= 1 ? "#dc3545" : daysLeft <= 3 ? "#ffc107" : "#28a745";
  const urgencyText = daysLeft <= 0 ? "本日締切" : daysLeft === 1 ? "明日締切" : `残り${daysLeft}日`;
  return { daysLeft, urgencyColor, urgencyText };
}

// ============================================
// 360度評価メール
// ============================================

/**
 * 360度評価依頼メール送信
 */
export interface Evaluation360RequestEmailData {
  reviewerName: string;
  reviewerEmail: string;
  targetEmployees: Array<{
    name: string;
  }>;
  deadline: Date;
  accessUrl: string;
  companyName: string;
}

export async function sendEvaluation360RequestEmail(
  data: Evaluation360RequestEmailData
): Promise<SendEmailResult> {
  const { reviewerName, reviewerEmail, targetEmployees, deadline, accessUrl, companyName } = data;

  const targetList = targetEmployees
    .map((e) => `<li>${e.name}</li>`)
    .join("");

  const formattedDeadline = formatDeadlineJa(deadline);

  const html = buildEmailHtml({
    title: "360度評価のお願い",
    subtitle: companyName,
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    ctaText: "評価を開始する",
    ctaUrl: accessUrl,
    linkColor: "#667eea",
    footerNote: "このリンクはあなた専用です。他の方と共有しないでください。",
    bodyHtml: `
    <p style="margin-top: 0;">${reviewerName} 様</p>

    <p>360度評価へのご協力をお願いいたします。</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
      <p style="margin-top: 0; font-weight: bold; color: #667eea;">評価対象者</p>
      <ul style="margin-bottom: 0; padding-left: 20px;">
        ${targetList}
      </ul>
    </div>

    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <p style="margin: 0; font-weight: bold;">回答期限: ${formattedDeadline}</p>
    </div>

    <p>下記のボタンから評価フォームにアクセスしてください。</p>`,
  });

  return sendEmail({
    to: reviewerEmail,
    subject: `【360度評価】${companyName} - 評価のお願い`,
    html,
  });
}

/**
 * 360度評価リマインダーメール送信
 */
export interface Evaluation360ReminderEmailData {
  reviewerName: string;
  reviewerEmail: string;
  targetEmployees: Array<{
    name: string;
    isCompleted: boolean;
  }>;
  deadline: Date;
  accessUrl: string;
  companyName: string;
}

export async function sendEvaluation360ReminderEmail(
  data: Evaluation360ReminderEmailData
): Promise<SendEmailResult> {
  const { reviewerName, reviewerEmail, targetEmployees, deadline, accessUrl, companyName } = data;

  const pendingEmployees = targetEmployees.filter((e) => !e.isCompleted);
  const pendingList = pendingEmployees.map((e) => `<li>${e.name}</li>`).join("");
  const completedCount = targetEmployees.filter((e) => e.isCompleted).length;

  const formattedDeadline = formatDeadlineJa(deadline);
  const { urgencyColor, urgencyText } = calcUrgency(deadline);

  const html = buildEmailHtml({
    title: "360度評価リマインダー",
    subtitle: companyName,
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    ctaText: "評価を続ける",
    ctaUrl: accessUrl,
    linkColor: "#f5576c",
    bodyHtml: `
    <p style="margin-top: 0;">${reviewerName} 様</p>

    <p>360度評価の回答がまだ完了していない対象者がいます。</p>

    <div style="background: ${urgencyColor}; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-weight: bold; font-size: 18px;">${urgencyText}</p>
      <p style="margin: 5px 0 0 0; font-size: 14px;">期限: ${formattedDeadline}</p>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
      <p style="margin-top: 0; font-weight: bold; color: #f5576c;">未完了の対象者（${pendingEmployees.length}名）</p>
      <ul style="margin-bottom: 0; padding-left: 20px;">
        ${pendingList}
      </ul>
      ${completedCount > 0 ? `<p style="margin-bottom: 0; color: #28a745; font-size: 14px;">✓ ${completedCount}名の評価は完了しています</p>` : ""}
    </div>`,
  });

  return sendEmail({
    to: reviewerEmail,
    subject: `【リマインダー】360度評価 - ${urgencyText}`,
    html,
  });
}

/**
 * HTMLをプレーンテキストに変換（簡易版）
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// 個別評価メール
// ============================================

/**
 * 個別評価 自己評価依頼メール送信
 */
export interface IndividualSelfEvaluationRequestEmailData {
  employeeName: string;
  employeeEmail: string;
  deadline: Date;
  accessUrl: string;
  companyName: string;
  periodName: string;
}

export async function sendIndividualSelfEvaluationRequestEmail(
  data: IndividualSelfEvaluationRequestEmailData
): Promise<SendEmailResult> {
  const { employeeName, employeeEmail, deadline, accessUrl, companyName, periodName } = data;

  const formattedDeadline = formatDeadlineJa(deadline);

  const html = buildEmailHtml({
    title: "自己評価のお願い",
    subtitle: `${companyName} - ${periodName}`,
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    ctaText: "自己評価を開始する",
    ctaUrl: accessUrl,
    linkColor: "#10b981",
    footerNote: "このリンクはあなた専用です。他の方と共有しないでください。",
    bodyHtml: `
    <p style="margin-top: 0;">${employeeName} 様</p>

    <p>個別評価の自己評価期間が始まりました。<br>下記の期限までに自己評価を入力してください。</p>

    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <p style="margin: 0; font-weight: bold;">回答期限: ${formattedDeadline}</p>
    </div>`,
  });

  return sendEmail({
    to: employeeEmail,
    subject: `【自己評価】${companyName} - ${periodName}`,
    html,
  });
}

/**
 * 個別評価 評価者への通知メール送信
 */
export interface IndividualEvaluatorNotificationEmailData {
  evaluatorName: string;
  evaluatorEmail: string;
  targetEmployees: Array<{
    name: string;
  }>;
  deadline: Date;
  accessUrl: string;
  password: string;
  companyName: string;
  periodName: string;
}

export async function sendIndividualEvaluatorNotificationEmail(
  data: IndividualEvaluatorNotificationEmailData
): Promise<SendEmailResult> {
  const { evaluatorName, evaluatorEmail, targetEmployees, deadline, accessUrl, password, companyName, periodName } = data;

  const targetList = targetEmployees.map((e) => `<li>${e.name}</li>`).join("");
  const formattedDeadline = formatDeadlineJa(deadline);

  const html = buildEmailHtml({
    title: "評価入力のお願い",
    subtitle: `${companyName} - ${periodName}`,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    ctaText: "評価を開始する",
    ctaUrl: accessUrl,
    linkColor: "#f59e0b",
    footerNote: "このリンクとパスワードはあなた専用です。他の方と共有しないでください。",
    bodyHtml: `
    <p style="margin-top: 0;">${evaluatorName} 様</p>

    <p>担当従業員の自己評価が完了しました。<br>上長評価の入力をお願いいたします。</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
      <p style="margin-top: 0; font-weight: bold; color: #f59e0b;">評価対象者</p>
      <ul style="margin-bottom: 0; padding-left: 20px;">
        ${targetList}
      </ul>
    </div>

    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <p style="margin: 0; font-weight: bold;">回答期限: ${formattedDeadline}</p>
    </div>

    <div style="background: #e8f4fc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bee5eb;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #0c5460;">アクセスパスワード</p>
      <p style="margin: 0; font-size: 20px; font-family: monospace; background: white; padding: 10px; border-radius: 4px; text-align: center; letter-spacing: 2px;">${password}</p>
    </div>`,
  });

  return sendEmail({
    to: evaluatorEmail,
    subject: `【上長評価】${companyName} - ${periodName}`,
    html,
  });
}

/**
 * 個別評価リマインダーメール送信
 */
export interface IndividualReminderEmailData {
  recipientName: string;
  recipientEmail: string;
  type: "self" | "evaluator";
  pendingItems?: Array<{ employeeName: string }>;
  deadline: Date;
  accessUrl: string;
  companyName: string;
  periodName: string;
}

export async function sendIndividualReminderEmail(
  data: IndividualReminderEmailData
): Promise<SendEmailResult> {
  const { recipientName, recipientEmail, type, pendingItems, deadline, accessUrl, companyName, periodName } = data;

  const formattedDeadline = formatDeadlineJa(deadline);
  const { urgencyColor, urgencyText } = calcUrgency(deadline);

  const titleText = type === "self" ? "自己評価リマインダー" : "上長評価リマインダー";
  const gradientColor = "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";

  let pendingSection = "";
  if (type === "evaluator" && pendingItems && pendingItems.length > 0) {
    const pendingList = pendingItems.map((e) => `<li>${e.employeeName}</li>`).join("");
    pendingSection = `
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
      <p style="margin-top: 0; font-weight: bold; color: #f5576c;">未完了の対象者（${pendingItems.length}名）</p>
      <ul style="margin-bottom: 0; padding-left: 20px;">
        ${pendingList}
      </ul>
    </div>`;
  }

  const html = buildEmailHtml({
    title: titleText,
    subtitle: `${companyName} - ${periodName}`,
    gradient: gradientColor,
    ctaText: "評価を続ける",
    ctaUrl: accessUrl,
    linkColor: "#f5576c",
    bodyHtml: `
    <p style="margin-top: 0;">${recipientName} 様</p>

    <p>${type === "self" ? "自己評価の回答がまだ完了していません。" : "上長評価の入力がまだ完了していない対象者がいます。"}</p>

    <div style="background: ${urgencyColor}; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-weight: bold; font-size: 18px;">${urgencyText}</p>
      <p style="margin: 5px 0 0 0; font-size: 14px;">期限: ${formattedDeadline}</p>
    </div>

    ${pendingSection}`,
  });

  return sendEmail({
    to: recipientEmail,
    subject: `【リマインダー】${type === "self" ? "自己評価" : "上長評価"} - ${urgencyText}`,
    html,
  });
}

export { APP_URL };
