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

  const formattedDeadline = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(deadline);

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">360度評価のお願い</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${companyName}</p>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
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

    <p>下記のボタンから評価フォームにアクセスしてください。</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${accessUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 50px; font-weight: bold; font-size: 16px;">評価を開始する</a>
    </div>

    <p style="font-size: 12px; color: #666;">このリンクはあなた専用です。他の方と共有しないでください。</p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; margin-bottom: 0;">
      このメールは NiNKU BOXX から自動送信されています。<br>
      ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：<br>
      <a href="${accessUrl}" style="color: #667eea; word-break: break-all;">${accessUrl}</a>
    </p>
  </div>
</body>
</html>
  `.trim();

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

  const formattedDeadline = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(deadline);

  // 期限までの日数を計算
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const urgencyColor = daysLeft <= 1 ? "#dc3545" : daysLeft <= 3 ? "#ffc107" : "#28a745";
  const urgencyText = daysLeft <= 0 ? "本日締切" : daysLeft === 1 ? "明日締切" : `残り${daysLeft}日`;

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">360度評価リマインダー</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${companyName}</p>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
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
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${accessUrl}" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 50px; font-weight: bold; font-size: 16px;">評価を続ける</a>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; margin-bottom: 0;">
      このメールは NiNKU BOXX から自動送信されています。<br>
      <a href="${accessUrl}" style="color: #f5576c; word-break: break-all;">${accessUrl}</a>
    </p>
  </div>
</body>
</html>
  `.trim();

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

export { APP_URL };
