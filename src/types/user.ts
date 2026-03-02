/**
 * ユーザー関連の型定義
 * User, Account, Session, VerificationToken
 */

import type { User as UserModel, Account as AccountModel, Session as SessionModel } from '../generated/prisma';

// ============================================
// Enums
// ============================================

/**
 * ユーザーロール
 */
export type UserRole = 'ADMIN' | 'COMPANY_ADMIN' | 'EVALUATOR' | 'EMPLOYEE';

export const UserRoleLabels: Record<UserRole, string> = {
  ADMIN: 'システム管理者',
  COMPANY_ADMIN: '会社管理者',
  EVALUATOR: '評価者',
  EMPLOYEE: '従業員',
};

// ============================================
// Base Types (Prisma generated types)
// ============================================

export type User = UserModel;
export type Account = AccountModel;
export type Session = SessionModel;

// ============================================
// DTO Types (Data Transfer Objects)
// ============================================

/**
 * ユーザー作成用DTO
 */
export interface CreateUserDto {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
  companyId?: string;
}

/**
 * ユーザー更新用DTO
 */
export interface UpdateUserDto {
  email?: string;
  name?: string;
  role?: UserRole;
  companyId?: string;
  image?: string;
}

/**
 * パスワード変更用DTO
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// ============================================
// Response Types
// ============================================

/**
 * ユーザー一覧レスポンス（パスワードを除く）
 */
export type UserResponse = Omit<User, 'password'>;

/**
 * ユーザー詳細レスポンス（会社情報を含む）
 */
export interface UserWithCompanyResponse extends UserResponse {
  company?: {
    id: string;
    name: string;
  } | null;
}

/**
 * 現在のユーザー情報（セッション用）
 */
export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  companyId: string | null;
  image: string | null;
}

// ============================================
// Query Types
// ============================================

/**
 * ユーザー検索クエリ
 */
export interface UserSearchQuery {
  email?: string;
  name?: string;
  role?: UserRole;
  companyId?: string;
  page?: number;
  limit?: number;
}

// ============================================
// Auth Types
// ============================================

/**
 * ログインリクエスト
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * ログインレスポンス
 */
export interface LoginResponse {
  user: UserResponse;
  accessToken?: string;
}

/**
 * 会員登録リクエスト
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  companyId?: string;
}
