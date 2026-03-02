/**
 * プロフィール画像アップロードAPI
 * POST /api/employees/[id]/upload-image - 画像アップロード
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * プロフィール画像アップロード
 * Base64形式で受け取り、DBに保存
 * 本番環境ではS3等のストレージサービスを使用することを推奨
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    // 従業員存在確認
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      );
    }

    // バリデーション
    if (!body.image) {
      return NextResponse.json(
        { error: "画像データは必須です" },
        { status: 400 }
      );
    }

    // Base64形式の検証（簡易チェック）
    const base64Pattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
    if (!base64Pattern.test(body.image)) {
      return NextResponse.json(
        { error: "無効な画像形式です。PNG、JPEG、GIF、WebPのみ対応しています" },
        { status: 400 }
      );
    }

    // 画像サイズチェック（約2MB制限：Base64は元データの約1.37倍）
    const base64Data = body.image.split(",")[1];
    const sizeInBytes = (base64Data.length * 3) / 4;
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (sizeInBytes > maxSize) {
      return NextResponse.json(
        { error: "画像サイズが大きすぎます。2MB以下の画像を使用してください" },
        { status: 400 }
      );
    }

    // 画像URLとして保存（Base64データURL）
    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        profileImage: body.image,
      },
      select: {
        id: true,
        profileImage: true,
      },
    });

    return NextResponse.json({
      message: "画像をアップロードしました",
      profileImage: updatedEmployee.profileImage,
    });
  } catch (error) {
    console.error("画像アップロードエラー:", error);
    return NextResponse.json(
      { error: "画像のアップロードに失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * プロフィール画像削除
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // 従業員存在確認
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      );
    }

    await prisma.employee.update({
      where: { id },
      data: {
        profileImage: null,
      },
    });

    return NextResponse.json({
      message: "画像を削除しました",
    });
  } catch (error) {
    console.error("画像削除エラー:", error);
    return NextResponse.json(
      { error: "画像の削除に失敗しました" },
      { status: 500 }
    );
  }
}
