import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import {
  createAdminSession,
  deleteAdminSessionByHash,
  getAdminSessionWithUserByHash,
  getAdminUserByEmail,
  touchAdminSession,
  upsertBootstrapAdmin,
  type AdminUserAccountRecord,
} from "@dm-bot/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const ADMIN_SESSION_COOKIE = "dm_admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashPassword(password, salt)}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const [salt, expected] = storedHash.split(":");

  if (!salt || !expected) {
    return false;
  }

  const actualBuffer = Buffer.from(hashPassword(password, salt), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function hashSessionToken(sessionSecret: string, token: string) {
  return createHash("sha256").update(`${sessionSecret}:${token}`).digest("hex");
}

function buildCookieValue(name: string, value: string, maxAgeSeconds: number, secure: boolean) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function buildClearedCookieValue(name: string, secure: boolean) {
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function parseCookies(request: FastifyRequest) {
  const header = request.headers.cookie ?? "";
  const cookies = new Map<string, string>();

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");

    if (!rawKey || rest.length === 0) {
      continue;
    }

    cookies.set(rawKey, decodeURIComponent(rest.join("=")));
  }

  return cookies;
}

function requestIp(request: FastifyRequest) {
  return request.ip || null;
}

export async function ensureBootstrapAdmin(app: FastifyInstance) {
  const email = app.config.adminBootstrapEmail;
  const password = app.config.adminBootstrapPassword;

  if (!email || !password) {
    return null;
  }

  return upsertBootstrapAdmin({
    email,
    displayName: app.config.adminBootstrapDisplayName ?? "Bootstrap Admin",
    role: app.config.adminBootstrapRole ?? "super_admin",
    passwordHash: createPasswordHash(password),
  });
}

export async function getAdminAuthContext(app: FastifyInstance, request: FastifyRequest): Promise<{
  adminUser: AdminUserAccountRecord;
  sessionId: string;
} | null> {
  const token = parseCookies(request).get(ADMIN_SESSION_COOKIE);

  if (!token) {
    return null;
  }

  const sessionTokenHash = hashSessionToken(app.config.sessionSecret, token);
  const context = await getAdminSessionWithUserByHash(sessionTokenHash);

  if (!context || context.adminUser.status !== "active") {
    return null;
  }

  await touchAdminSession(context.session.id);

  return {
    adminUser: context.adminUser,
    sessionId: context.session.id,
  };
}

export async function requireAdminAuth(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
  const context = await getAdminAuthContext(app, request);

  if (!context) {
    reply.code(401);
    return null;
  }

  return context;
}

export async function loginAdmin(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  email: string,
  password: string,
) {
  await ensureBootstrapAdmin(app);

  const adminUser = await getAdminUserByEmail(email.trim().toLowerCase());

  if (!adminUser || adminUser.status !== "active" || !verifyPassword(password, adminUser.password_hash)) {
    reply.code(401);
    return {
      error: "Invalid email or password",
    };
  }

  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = hashSessionToken(app.config.sessionSecret, rawToken);

  await createAdminSession({
    adminUserId: adminUser.id,
    sessionTokenHash: hashedToken,
    ipAddress: requestIp(request),
    userAgent: request.headers["user-agent"] ?? null,
    expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
  });

  reply.header(
    "Set-Cookie",
    buildCookieValue(
      ADMIN_SESSION_COOKIE,
      rawToken,
      Math.floor(ADMIN_SESSION_TTL_MS / 1000),
      app.config.cookieSecure,
    ),
  );

  return {
    authenticated: true,
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
      displayName: adminUser.display_name,
      role: adminUser.role,
    },
  };
}

export async function logoutAdmin(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
  const token = parseCookies(request).get(ADMIN_SESSION_COOKIE);

  if (token) {
    await deleteAdminSessionByHash(hashSessionToken(app.config.sessionSecret, token));
  }

  reply.header("Set-Cookie", buildClearedCookieValue(ADMIN_SESSION_COOKIE, app.config.cookieSecure));

  return {
    authenticated: false,
  };
}
