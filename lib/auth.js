// シンプルな1人用ログイン。
// パスワード(APP_PASSWORD)が合えば、署名付きクッキーを配って以後は素通りさせる。
// サーバーを再起動しても使えるよう、状態はクッキー側に持たせる（サーバーにセッション保存は不要）。

import crypto from "node:crypto";

const SECRET = process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
const APP_PASSWORD = process.env.APP_PASSWORD || "myday"; // 本番では必ず環境変数で上書き
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // ログインは30日もつ

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

// ログイン成功時に配るトークン（発行時刻 + 署名）
export function makeToken() {
  const payload = String(Date.now());
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const ts = Number(payload);
  return Number.isFinite(ts) && Date.now() - ts < MAX_AGE_MS;
}

// パスワード照合（時間差で漏れないよう timingSafeEqual）
export function checkPassword(input) {
  const a = Buffer.from(String(input ?? ""));
  const b = Buffer.from(APP_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// 起動時に、危険なデフォルトのままなら警告する
export function warnIfInsecure(log = console.warn) {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.APP_PASSWORD) log("⚠️  APP_PASSWORD が未設定です。本番では必ず設定してください。");
    if (!process.env.SESSION_SECRET) log("⚠️  SESSION_SECRET が未設定です。本番では必ず設定してください。");
  }
}
