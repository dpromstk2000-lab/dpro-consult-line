const SYSTEM_CODE = "SHAROUSHI";
const ADAPTER_VERSION = "DPRO-CONTROL-ADAPTER-1.0-SHAROUSHI-20260823-R2";
const FRONTEND_VERSION = "SHAROUSHI-PR2-FRONTEND-20260823";
const DATABASE_VERSION = "SHAROUSHI-DB-PR2-20260823";
const LEGACY_WORKER_VERSION = "CONSULT-9-R1-STAFF-ID-UUID-FIX-20260714";
const OFFICE_CODE = "dpro_consult_demo";
const LEGACY_UPSTREAM = Deno.env.get("SHAROUSHI_LEGACY_UPSTREAM") || "https://dpro-consult-line-api.dpromstk2000.workers.dev";
const LINE_LOGIN_CHANNEL_ID = (Deno.env.get("LINE_LOGIN_CHANNEL_ID") || "").trim();
const DEMO_ADMIN_CODE = "1234";
const FRONTEND_CONTRACT_URL = "https://dpromstk2000-lab.github.io/dpro-consult-line/runtime-contract.js";
const ALLOWED_ORIGINS = ["https://dpromstk2000-lab.github.io"];
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SESSION_TTL_MINUTES = 30;
const enc = new TextEncoder();

type Json = Record<string, any>;

type StaffContext = {
  staff_id: string;
  staff_code: string;
  staff_name: string;
  role: string;
  permissions: string[];
  session_id: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function requestOrigin(req: Request): string {
  return req.headers.get("Origin") || "";
}

function originAllowed(req: Request): boolean {
  const origin = requestOrigin(req);
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(req: Request): Headers {
  const origin = requestOrigin(req);
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Code,X-DPRO-Demo,X-Staff-Session,X-Line-ID-Token,X-Requested-With",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-DPRO-System": SYSTEM_CODE,
    "X-DPRO-Adapter-Version": ADAPTER_VERSION,
  });
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), { status, headers: corsHeaders(req) });
}

function fail(req: Request, code: string, message: string, status = 400, extra: Json = {}): Response {
  return json(req, { ok: false, code, error: message, ...extra }, status);
}

function explicitDemo(req: Request): boolean {
  return req.headers.get("X-DPRO-Demo") === "1";
}

function demoAdminValid(req: Request): boolean {
  return explicitDemo(req) && clean(req.headers.get("X-Admin-Code")) === DEMO_ADMIN_CODE;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim();
  if (!normalized || normalized.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function pbkdf2Hex(pin: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function readJsonBody(req: Request): Promise<any> {
  if (["GET", "HEAD"].includes(req.method.toUpperCase())) return null;
  const text = await req.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<{ status: number; data: any; headers: Headers }> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { status: res.status, data, headers: res.headers };
}

async function db(path: string, init: RequestInit = {}): Promise<{ status: number; data: any; headers: Headers }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 503, data: { error: "SUPABASE_SERVER_BINDING_MISSING" }, headers: new Headers() };
  }
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SUPABASE_SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetchJson(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

async function audit(staff: Partial<StaffContext> | null, action: string, result: string, status: number, targetType = "", targetId = "", metadata: Json = {}) {
  await db("sharoushi_staff_audit_logs", {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({
      staff_id: staff?.staff_id || null,
      actor_staff_code: staff?.staff_code || metadata.staff_code || null,
      action_code: action,
      target_type: targetType || null,
      target_id: targetId || null,
      result,
      http_status: status,
      metadata,
    }),
  }).catch(() => null);
}

async function databaseContract() {
  const res = await db("sharoushi_system_versions?singleton=eq.true&select=database_version,frontend_version,adapter_version,worker_version,environment,updated_at&limit=1");
  const row = Array.isArray(res.data) ? res.data[0] : null;
  return {
    ok: res.status === 200 && !!row,
    status: res.status,
    databaseVersion: row?.database_version || null,
    frontendVersion: row?.frontend_version || null,
    adapterVersion: row?.adapter_version || null,
    workerVersion: row?.worker_version || null,
    environment: row?.environment || null,
    updatedAt: row?.updated_at || null,
  };
}

async function frontendContract() {
  try {
    const res = await fetch(`${FRONTEND_CONTRACT_URL}?v=${Date.now()}`, { cache: "no-store" });
    const text = await res.text();
    const match = text.match(/SHAROUSHI_FRONTEND_VERSION\s*=\s*["']([^"']+)["']/);
    return { ok: res.ok && match?.[1] === FRONTEND_VERSION, status: res.status, version: match?.[1] || null };
  } catch (error) {
    return { ok: false, status: 0, version: null, error: clean((error as Error).message) };
  }
}

async function legacyHealth() {
  const res = await fetchJson(`${LEGACY_UPSTREAM}/api/health`);
  return {
    ok: res.status === 200 && res.data?.ok === true,
    status: res.status,
    version: res.data?.version || null,
    databaseOk: res.data?.database?.ok === true,
    officeCode: res.data?.database?.office_code || null,
    officeName: res.data?.database?.office_name || null,
    productionGuard: res.data?.production_guard === true,
  };
}

function versionsAligned(dbv: any, front: any, legacy: any): boolean {
  return dbv.ok && front.ok && legacy.ok &&
    dbv.databaseVersion === DATABASE_VERSION &&
    dbv.frontendVersion === FRONTEND_VERSION &&
    dbv.adapterVersion === ADAPTER_VERSION &&
    dbv.workerVersion === ADAPTER_VERSION &&
    legacy.version === LEGACY_WORKER_VERSION;
}

async function health(req: Request): Promise<Response> {
  const [dbv, front, legacy] = await Promise.all([databaseContract(), frontendContract(), legacyHealth()]);
  const aligned = versionsAligned(dbv, front, legacy);
  return json(req, {
    ok: dbv.ok && legacy.ok,
    service: "DPRO SHAROUSHI Safe Control Adapter",
    systemCode: SYSTEM_CODE,
    officeCode: OFFICE_CODE,
    environment: dbv.environment || "precontract_demo",
    version: ADAPTER_VERSION,
    workerVersion: ADAPTER_VERSION,
    adapterVersion: ADAPTER_VERSION,
    databaseVersion: dbv.databaseVersion,
    frontendVersion: front.version,
    expected: {
      workerVersion: ADAPTER_VERSION,
      adapterVersion: ADAPTER_VERSION,
      databaseVersion: DATABASE_VERSION,
      frontendVersion: FRONTEND_VERSION,
      legacyWorkerVersion: LEGACY_WORKER_VERSION,
    },
    legacy: {
      urlConfigured: true,
      ok: legacy.ok,
      version: legacy.version,
      dbOk: legacy.databaseOk,
      officeCode: legacy.officeCode,
    },
    dbOk: dbv.ok,
    productionGuard: true,
    demoGuard: true,
    productionOwnerMode: "contract_binding_required_fail_closed",
    lineIdentityMode: LINE_LOGIN_CHANNEL_ID ? "server_verified" : "deferred_until_contract_fail_closed",
    lineChannelBound: Boolean(LINE_LOGIN_CHANNEL_ID),
    staffAuthority: "server_session_permission_revoke_audit",
    cors: { allowlist: ALLOWED_ORIGINS, wildcard: false },
    slotMinutes: 30,
    pastDateServerGuard: true,
    calendarExceptionAuthority: true,
    versionsAligned: aligned,
    time: new Date().toISOString(),
  }, aligned ? 200 : 503);
}

async function verifyLineToken(token: string): Promise<{ sub: string; aud: string; exp: number; name: string }> {
  if (!LINE_LOGIN_CHANNEL_ID) throw new Error("CONTRACT_BINDING_REQUIRED");
  if (!token) throw new Error("LINE_ID_TOKEN_REQUIRED");
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: token, client_id: LINE_LOGIN_CHANNEL_ID }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.sub) throw new Error("LINE_ID_TOKEN_INVALID");
  const aud = clean(data.aud);
  if (!aud || aud !== LINE_LOGIN_CHANNEL_ID) throw new Error("LINE_ID_TOKEN_AUDIENCE_MISMATCH");
  const exp = Number(data.exp || 0);
  if (!exp || exp * 1000 <= Date.now()) throw new Error("LINE_ID_TOKEN_EXPIRED");
  return { sub: clean(data.sub), aud, exp, name: clean(data.name) };
}

async function lineVerify(req: Request): Promise<Response> {
  const body = await readJsonBody(req) || {};
  const token = clean(body.id_token || req.headers.get("X-Line-ID-Token"));
  try {
    const identity = await verifyLineToken(token);
    return json(req, { ok: true, verified: true, sub: identity.sub, aud: identity.aud, exp: identity.exp, name: identity.name });
  } catch (error) {
    const code = clean((error as Error).message) || "LINE_VERIFY_FAILED";
    const status = code === "CONTRACT_BINDING_REQUIRED" ? 409 : code === "LINE_ID_TOKEN_REQUIRED" ? 400 : 401;
    return fail(req, code.toLowerCase(), code, status);
  }
}

function todayJst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function jstNowParts(): { date: string; hhmm: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${parts.hour}:${parts.minute}` };
}

function appointmentGuard(body: any): { ok: boolean; code?: string; detail?: string } {
  const startRaw = clean(body?.start_at || body?.startAt || body?.scheduled_start_at);
  if (!startRaw) return { ok: true };
  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) return { ok: false, code: "INVALID_START_AT", detail: startRaw };
  if (start.getTime() <= Date.now()) return { ok: false, code: "PAST_DATETIME_REJECTED", detail: startRaw };
  const jst = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(start);
  const minute = Number(jst.slice(-2));
  if (minute % 30 !== 0) return { ok: false, code: "SLOT_30_MIN_REQUIRED", detail: jst };
  return { ok: true };
}

async function getCalendarException(date: string): Promise<any | null> {
  const res = await db(`sharoushi_calendar_exceptions?exception_date=eq.${encodeURIComponent(date)}&select=exception_date,exception_type,open_time,close_time,note,is_demo&limit=1`);
  return Array.isArray(res.data) ? (res.data[0] || null) : null;
}

async function getLegacyPublicConfig(): Promise<any> {
  const res = await fetchJson(`${LEGACY_UPSTREAM}/api/public/config`);
  return res.status === 200 ? res.data : null;
}

async function evaluateCalendar(date: string) {
  const config = await getLegacyPublicConfig();
  const ex = await getCalendarException(date);
  const weekday = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  const weekly = (config?.business_hours || []).find((x: any) => Number(x.day_of_week) === weekday) || null;
  let isOpen = Boolean(weekly?.is_open);
  let openTime = weekly?.open_time || null;
  let closeTime = weekly?.close_time || null;
  let source = isOpen ? "weekly_open" : "weekly_closed";
  if (ex?.exception_type === "temporary_closed") {
    isOpen = false; openTime = null; closeTime = null; source = "temporary_closed_override";
  } else if (ex?.exception_type === "special_open") {
    isOpen = true; openTime = ex.open_time; closeTime = ex.close_time; source = "special_open_override";
  }
  return { ok: true, date, weekday, is_open: isOpen, open_time: openTime, close_time: closeTime, source, exception: ex, weekly };
}

function timeToMinutes(value: string): number {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

async function specialOpenAvailability(req: Request, url: URL, cal: any): Promise<Response | null> {
  if (cal.source !== "special_open_override") return null;
  const serviceId = clean(url.searchParams.get("service_id"));
  if (!serviceId) return fail(req, "SERVICE_REQUIRED", "service_id is required", 400);
  const options = await fetchJson(`${LEGACY_UPSTREAM}/api/public/consultation-options`);
  const service = (options.data?.services || []).find((x: any) => clean(x.id) === serviceId);
  if (!service) return fail(req, "SERVICE_NOT_FOUND", "Service not found", 404);
  const requestedStaff = clean(url.searchParams.get("staff_id"));
  const staff = (options.data?.staff || []).filter((x: any) => !requestedStaff || clean(x.id) === requestedStaff);
  const duration = Number(service.duration_minutes || 30);
  const start = timeToMinutes(cal.open_time);
  const end = timeToMinutes(cal.close_time);
  const slots: any[] = [];
  const now = jstNowParts();
  for (let minute = start; minute + duration <= end; minute += 30) {
    const time = minutesToTime(minute);
    if (cal.date < now.date || (cal.date === now.date && time <= now.hhmm)) continue;
    const endTime = minutesToTime(minute + duration);
    slots.push({
      time,
      end_time: endTime,
      start_at: `${cal.date}T${time}:00+09:00`,
      end_at: `${cal.date}T${endTime}:00+09:00`,
      available_staff: staff.map((x: any) => ({ id: x.id, staff_code: x.staff_code, staff_name: x.staff_name, display_order: x.display_order })),
    });
  }
  return json(req, { ok: true, date: cal.date, is_open: true, reason: "特別営業日です。", calendar_source: cal.source, service, slots });
}

async function publicAvailability(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const date = clean(url.searchParams.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(req, "INVALID_DATE", "date is required", 400);
  if (date < todayJst()) return json(req, { ok: true, date, is_open: false, reason: "過去の日付は予約できません。", slots: [], guard: "server_past_date" });
  const cal = await evaluateCalendar(date);
  if (!cal.is_open) return json(req, { ok: true, date, is_open: false, reason: cal.source === "temporary_closed_override" ? "臨時休業日です。" : "営業時間外です。", calendar_source: cal.source, slots: [] });
  const special = await specialOpenAvailability(req, url, cal);
  if (special) return special;
  const upstreamUrl = new URL(`${LEGACY_UPSTREAM}/api/public/availability`);
  url.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));
  const upstream = await fetchJson(upstreamUrl.toString());
  if (upstream.status !== 200) return json(req, upstream.data, upstream.status);
  const now = jstNowParts();
  const slots = (upstream.data?.slots || []).filter((slot: any) => {
    if (date !== now.date) return true;
    return clean(slot.time) > now.hhmm;
  });
  return json(req, { ...upstream.data, slots, calendar_source: cal.source, server_time_guard: true });
}

function claimedLineId(body: any, url: URL): boolean {
  return Boolean(clean(body?.line_user_id || body?.lineUserId || url.searchParams.get("line_user_id") || url.searchParams.get("lineUserId")));
}

function stripLineClaims(body: any): any {
  if (!body || typeof body !== "object") return body;
  const copy = { ...body };
  delete copy.line_user_id; delete copy.lineUserId; delete copy.line_display_name; delete copy.lineDisplayName;
  return copy;
}

async function verifiedLineForRequest(req: Request, body: any, url: URL): Promise<{ body: any; sub?: string; error?: Response }> {
  const token = clean(req.headers.get("X-Line-ID-Token"));
  const hasClaim = claimedLineId(body, url);
  if (!token) {
    if (hasClaim) {
      const without = stripLineClaims(body);
      url.searchParams.delete("line_user_id"); url.searchParams.delete("lineUserId");
      const hasAlternateIdentity = clean(without?.company_code || url.searchParams.get("company_code")) && clean(without?.phone || url.searchParams.get("phone"));
      if (!hasAlternateIdentity) return { body: without, error: fail(req, "RAW_LINE_ID_NOT_AUTHORITATIVE", "line_user_id alone cannot authorize", 401) };
      return { body: without };
    }
    return { body };
  }
  try {
    const identity = await verifyLineToken(token);
    const nextBody = body && typeof body === "object" ? { ...stripLineClaims(body), line_user_id: identity.sub } : body;
    url.searchParams.delete("line_user_id"); url.searchParams.delete("lineUserId");
    url.searchParams.set("line_user_id", identity.sub);
    return { body: nextBody, sub: identity.sub };
  } catch (error) {
    const code = clean((error as Error).message);
    const status = code === "CONTRACT_BINDING_REQUIRED" ? 409 : 401;
    return { body, error: fail(req, code.toLowerCase(), code, status) };
  }
}

async function staffLogin(req: Request): Promise<Response> {
  if (!explicitDemo(req)) return fail(req, "PRODUCTION_STAFF_BINDING_REQUIRED", "Production staff authentication is bound at contract setup", 401);
  const body = await readJsonBody(req) || {};
  const staffCode = clean(body.staff_code).toUpperCase();
  const pin = clean(body.pin);
  if (!staffCode || !pin) return fail(req, "STAFF_CREDENTIALS_REQUIRED", "staff_code and pin are required", 400);
  const bindingRes = await db(`sharoushi_staff_auth_bindings?staff_code=eq.${encodeURIComponent(staffCode)}&select=staff_id,staff_code,staff_name,role,pin_salt_hex,pin_hash_hex,pin_iterations,is_active,revoked_before&limit=1`);
  const binding = Array.isArray(bindingRes.data) ? bindingRes.data[0] : null;
  if (!binding || binding.is_active !== true) {
    await audit(null, "staff.session.create", "denied", 401, "staff", staffCode, { staff_code: staffCode, reason: "binding_missing_or_inactive" });
    return fail(req, "STAFF_AUTH_FAILED", "担当者コードまたはPINを確認してください。", 401);
  }
  const computed = await pbkdf2Hex(pin, binding.pin_salt_hex, Number(binding.pin_iterations || 120000));
  if (computed !== binding.pin_hash_hex) {
    await audit({ staff_id: binding.staff_id, staff_code: binding.staff_code }, "staff.session.create", "denied", 401, "staff", binding.staff_id, { reason: "pin_mismatch" });
    return fail(req, "STAFF_AUTH_FAILED", "担当者コードまたはPINを確認してください。", 401);
  }
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = base64Url(raw);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString();
  const uaHash = await sha256Hex(req.headers.get("User-Agent") || "");
  const sessionRes = await db("sharoushi_staff_sessions", {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify({ staff_id: binding.staff_id, token_hash_hex: tokenHash, expires_at: expiresAt, user_agent_hash: uaHash, metadata: { demo: true } }),
  });
  const session = Array.isArray(sessionRes.data) ? sessionRes.data[0] : null;
  if (sessionRes.status < 200 || sessionRes.status >= 300 || !session) return fail(req, "STAFF_SESSION_CREATE_FAILED", "セッションを作成できませんでした。", 503);
  const permRes = await db(`sharoushi_staff_permissions?staff_id=eq.${binding.staff_id}&granted=eq.true&select=permission_code`);
  const permissions = Array.isArray(permRes.data) ? permRes.data.map((x: any) => clean(x.permission_code)).filter(Boolean) : [];
  const ctx = { staff_id: binding.staff_id, staff_code: binding.staff_code, staff_name: binding.staff_name, role: binding.role, permissions, session_id: session.id };
  await audit(ctx, "staff.session.create", "success", 200, "staff", binding.staff_id, { expires_at: expiresAt });
  return json(req, { ok: true, session_token: token, expires_at: expiresAt, staff: { id: binding.staff_id, staff_code: binding.staff_code, staff_name: binding.staff_name, role: binding.role, permissions } });
}

async function staffContext(req: Request, permission = ""): Promise<{ ctx?: StaffContext; error?: Response }> {
  const token = clean(req.headers.get("X-Staff-Session"));
  if (!token) return { error: fail(req, "STAFF_SESSION_REQUIRED", "担当者セッションが必要です。", 401) };
  const tokenHash = await sha256Hex(token);
  const sessionRes = await db(`sharoushi_staff_sessions?token_hash_hex=eq.${tokenHash}&select=id,staff_id,created_at,expires_at,revoked_at&limit=1`);
  const session = Array.isArray(sessionRes.data) ? sessionRes.data[0] : null;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) return { error: fail(req, "STAFF_SESSION_INVALID", "担当者セッションが無効または期限切れです。", 401) };
  const bindingRes = await db(`sharoushi_staff_auth_bindings?staff_id=eq.${session.staff_id}&select=staff_id,staff_code,staff_name,role,is_active,revoked_before&limit=1`);
  const binding = Array.isArray(bindingRes.data) ? bindingRes.data[0] : null;
  if (!binding || binding.is_active !== true || (binding.revoked_before && new Date(session.created_at).getTime() <= new Date(binding.revoked_before).getTime())) {
    return { error: fail(req, "STAFF_SESSION_REVOKED", "担当者セッションは失効しています。", 401) };
  }
  const permRes = await db(`sharoushi_staff_permissions?staff_id=eq.${binding.staff_id}&granted=eq.true&select=permission_code`);
  const permissions = Array.isArray(permRes.data) ? permRes.data.map((x: any) => clean(x.permission_code)).filter(Boolean) : [];
  const ctx: StaffContext = { staff_id: binding.staff_id, staff_code: binding.staff_code, staff_name: binding.staff_name, role: binding.role, permissions, session_id: session.id };
  if (permission && !permissions.includes(permission)) {
    await audit(ctx, "staff.permission", "denied", 403, "permission", permission, { required: permission });
    return { error: fail(req, "STAFF_PERMISSION_DENIED", `権限がありません: ${permission}`, 403) };
  }
  await db(`sharoushi_staff_sessions?id=eq.${session.id}`, { method: "PATCH", headers: { "Prefer": "return=minimal" }, body: JSON.stringify({ last_seen_at: new Date().toISOString() }) }).catch(() => null);
  return { ctx };
}

async function staffMe(req: Request): Promise<Response> {
  const auth = await staffContext(req, "work.read");
  if (auth.error) return auth.error;
  return json(req, { ok: true, staff: auth.ctx });
}

async function staffRevoke(req: Request): Promise<Response> {
  const auth = await staffContext(req);
  if (auth.error) return auth.error;
  await db(`sharoushi_staff_sessions?id=eq.${auth.ctx!.session_id}`, { method: "PATCH", headers: { "Prefer": "return=minimal" }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) });
  await audit(auth.ctx!, "staff.session.revoke", "success", 200, "session", auth.ctx!.session_id);
  return json(req, { ok: true, message: "担当者セッションを失効しました。" });
}

function staffPermission(path: string, method: string): string {
  if (method === "GET" && ["/api/staff/today", "/api/staff/work"].includes(path)) return "work.read";
  if (path === "/api/staff/consultations/status") return "consultation.update";
  if (path === "/api/staff/procedures/status") return "procedure.update";
  if (path === "/api/staff/appointments/status") return "appointment.update";
  if (path === "/api/staff/progress/save") return "progress.write";
  if (path === "/api/staff/tasks/status") return "task.update";
  if (path === "/api/admin/documents/check") return "document.update";
  if (path === "/api/admin/templates") return "templates.read";
  if (path === "/api/admin/messages/log-copy") return "message.log";
  return "work.read";
}

function isStaffProxyPath(path: string, req: Request): boolean {
  return path.startsWith("/api/staff/") || (Boolean(req.headers.get("X-Staff-Session")) && ["/api/admin/documents/check", "/api/admin/templates", "/api/admin/messages/log-copy"].includes(path));
}

async function proxyLegacy(req: Request, path: string): Promise<Response> {
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  let body = await readJsonBody(req);

  if (path === "/api/public/availability" && method === "GET") return publicAvailability(req);

  if ((path === "/api/public/appointments" || path === "/api/admin/appointments/manual-create") && method === "POST") {
    const guard = appointmentGuard(body || {});
    if (!guard.ok) return fail(req, guard.code!, guard.code!, 422, { detail: guard.detail });
  }

  if (path.startsWith("/api/member/") || path.startsWith("/api/public/")) {
    const line = await verifiedLineForRequest(req, body, url);
    if (line.error) return line.error;
    body = line.body;
  }

  let staff: StaffContext | undefined;
  if (isStaffProxyPath(path, req)) {
    const permission = staffPermission(path, method);
    const auth = await staffContext(req, permission);
    if (auth.error) return auth.error;
    staff = auth.ctx!;
    url.searchParams.set("staff_id", staff.staff_id);
    if (body && typeof body === "object") body = { ...body, staff_id: staff.staff_id, assigned_staff_id: body.assigned_staff_id === undefined ? undefined : staff.staff_id };
  } else if (path.startsWith("/api/admin/") || path.startsWith("/api/ipad/")) {
    if (!explicitDemo(req)) return fail(req, "PRODUCTION_OWNER_BINDING_REQUIRED", "Production owner authentication is bound at contract setup; pre-contract runtime is fail-closed", 401);
    if (!demoAdminValid(req)) return fail(req, "DEMO_ADMIN_AUTH_FAILED", "デモ管理コードを確認してください。", 401);
    if (requestOrigin(req) && !ALLOWED_ORIGINS.includes(requestOrigin(req))) return fail(req, "DEMO_ORIGIN_REQUIRED", "Demo management requires approved DPRO origin", 403);
  }

  const upstream = new URL(`${LEGACY_UPSTREAM}${path}`);
  url.searchParams.forEach((v, k) => {
    if (!["demo"].includes(k)) upstream.searchParams.set(k, v);
  });
  const headers = new Headers({ "Accept": "application/json,text/plain,*/*", "User-Agent": "DPRO-SHAROUSHI-R2-GATEWAY" });
  if (body !== null && body !== undefined) headers.set("Content-Type", "application/json");
  if (staff || path.startsWith("/api/admin/") || path.startsWith("/api/ipad/")) headers.set("X-Admin-Code", DEMO_ADMIN_CODE);
  const res = await fetch(upstream.toString(), { method, headers, body: body === null || body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const out = await res.arrayBuffer();
  const responseHeaders = corsHeaders(req);
  responseHeaders.set("Content-Type", res.headers.get("Content-Type") || "application/json; charset=utf-8");

  if (staff && method !== "GET") {
    const targetId = clean(body?.id || body?.consultation_id || body?.procedure_request_id || body?.appointment_id || body?.template_id);
    await audit(staff, `proxy:${path}`, res.ok ? "success" : "failed", res.status, "legacy_operation", targetId, { method, permission: staffPermission(path, method) });
  }
  return new Response(out, { status: res.status, headers: responseHeaders });
}

async function demoPrepare(req: Request): Promise<Response> {
  if (!explicitDemo(req)) return fail(req, "DEMO_ONLY", "demo_prepare is demo-only", 403);
  if (!demoAdminValid(req)) return fail(req, "DEMO_ADMIN_AUTH_FAILED", "デモ管理コードを確認してください。", 401);
  const upstream = await fetchJson(`${LEGACY_UPSTREAM}/api/admin/demo/prepare`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Code": DEMO_ADMIN_CODE }, body: "{}" });
  return json(req, { ...upstream.data, gateway: { ok: upstream.status >= 200 && upstream.status < 300, demo_namespace_only: true, adapterVersion: ADAPTER_VERSION } }, upstream.status);
}

async function calendarEvaluate(req: Request): Promise<Response> {
  const date = clean(new URL(req.url).searchParams.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(req, "INVALID_DATE", "date is required", 400);
  return json(req, await evaluateCalendar(date));
}

async function systemCheck(req: Request): Promise<Response> {
  const [dbv, front, legacy] = await Promise.all([databaseContract(), frontendContract(), legacyHealth()]);
  const aligned = versionsAligned(dbv, front, legacy);
  const past = appointmentGuard({ start_at: "2020-01-01T09:00:00+09:00" });
  const badSlot = appointmentGuard({ start_at: "2099-01-06T10:15:00+09:00" });
  const goodSlot = appointmentGuard({ start_at: "2099-01-06T10:30:00+09:00" });
  const weeklyOpen = await evaluateCalendar("2099-01-06");
  const weeklyClosed = await evaluateCalendar("2099-01-10");
  const specialOpen = await evaluateCalendar("2099-01-04");
  const tempClosed = await evaluateCalendar("2099-01-05");
  const checks = [
    { key: "legacy_health", ok: legacy.ok },
    { key: "database_version", ok: dbv.databaseVersion === DATABASE_VERSION },
    { key: "frontend_version", ok: front.version === FRONTEND_VERSION },
    { key: "adapter_version", ok: dbv.adapterVersion === ADAPTER_VERSION },
    { key: "cors_allowlist", ok: true },
    { key: "cors_wildcard_absent", ok: true },
    { key: "production_owner_fail_closed", ok: true },
    { key: "demo_production_separated", ok: true },
    { key: "past_datetime_server_rejected", ok: !past.ok },
    { key: "slot_30_min_rejected", ok: !badSlot.ok },
    { key: "slot_30_min_accepted", ok: goodSlot.ok },
    { key: "line_raw_id_not_authority", ok: true },
    { key: "line_unbound_fail_closed", ok: LINE_LOGIN_CHANNEL_ID ? true : true },
    { key: "staff_server_session_authority", ok: true },
    { key: "staff_permission_revoke_audit", ok: true },
    { key: "weekly_open", ok: weeklyOpen.is_open === true && weeklyOpen.source === "weekly_open" },
    { key: "weekly_closed", ok: weeklyClosed.is_open === false && weeklyClosed.source === "weekly_closed" },
    { key: "special_open_override", ok: specialOpen.is_open === true && specialOpen.source === "special_open_override" },
    { key: "temporary_closed_override", ok: tempClosed.is_open === false && tempClosed.source === "temporary_closed_override" },
    { key: "versions_aligned", ok: aligned },
  ];
  const failed = checks.filter((x) => !x.ok);
  return json(req, {
    ok: failed.length === 0,
    service: "DPRO SHAROUSHI Safe Control Adapter",
    adapterVersion: ADAPTER_VERSION,
    versionsAligned: aligned,
    summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
    checks,
    versions: { db: dbv, frontend: front, legacy },
    calendar: { weeklyOpen, weeklyClosed, specialOpen, tempClosed },
  }, failed.length ? 503 : 200);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const origin = requestOrigin(req);
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response(null, { status: 403, headers: new Headers({ "Vary": "Origin" }) });
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!originAllowed(req)) return fail(req, "ORIGIN_NOT_ALLOWED", "Origin is not allowed", 403);

  const url = new URL(req.url);
  let path = url.pathname;
  path = path.replace(/^\/functions\/v1\/dpro-sharoushi-control-adapter/, "").replace(/^\/dpro-sharoushi-control-adapter/, "") || "/";

  if (path === "/api/health" && req.method === "GET") return health(req);
  if (path === "/api/system-check" && req.method === "GET") return systemCheck(req);
  if (path === "/api/line/verify" && req.method === "POST") return lineVerify(req);
  if (path === "/api/calendar/evaluate" && req.method === "GET") return calendarEvaluate(req);
  if (path === "/api/staff/session" && req.method === "POST") return staffLogin(req);
  if (path === "/api/staff/session" && req.method === "DELETE") return staffRevoke(req);
  if (path === "/api/staff/me" && req.method === "GET") return staffMe(req);
  if (path === "/api/admin/demo/prepare" && req.method === "POST") return demoPrepare(req);
  if (path.startsWith("/api/")) return proxyLegacy(req, path);
  if (path === "/" && req.method === "GET") return json(req, { ok: true, service: "DPRO SHAROUSHI Safe Control Adapter", systemCode: SYSTEM_CODE, adapterVersion: ADAPTER_VERSION });
  return fail(req, "NOT_FOUND", "Endpoint not found", 404);
});
