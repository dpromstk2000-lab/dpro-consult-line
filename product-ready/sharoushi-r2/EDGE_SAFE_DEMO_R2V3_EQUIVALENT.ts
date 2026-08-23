const FRONTEND_VERSION = "SHAROUSHI-PR2-FRONTEND-20260823";
const SOURCE_BASE = "https://dpromstk2000-lab.github.io/dpro-consult-line";
const GATEWAY_BASE = "https://ropwvdnohadwxfbkcopx.supabase.co/functions/v1/dpro-sharoushi-control-gateway-v2";
const ALLOWED = new Set(["index.html","member.html","owner.html","staff.html","owner-ipad.html","system-check.html","demo-guide.html","config.js","runtime-contract.js"]);

function pathOf(req: Request) {
  let p = new URL(req.url).pathname;
  p = p.replace(/^\/functions\/v1\/dpro-sharoushi-safe-demo\/?/, "").replace(/^\/dpro-sharoushi-safe-demo\/?/, "");
  return p || "index.html";
}

function noStore(contentType: string) {
  return new Headers({
    "Content-Type": contentType,
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "X-DPRO-Frontend-Version": FRONTEND_VERSION,
  });
}

function patchConfig(source: string) {
  source = source
    .replace(/const VERSION = "CONSULT-4-CONFIG-20260714";/, `const VERSION = "${FRONTEND_VERSION}";`)
    .replace(/const API_BASE_URL =\s*\n\s*"https:\/\/dpro-consult-line-api\.dpromstk2000\.workers\.dev";/, `const API_BASE_URL =\n    "${GATEWAY_BASE}";`)
    .replace('    LAST_PAGE: "dpro_consult_last_page",', '    LAST_PAGE: "dpro_consult_last_page",\n    STAFF_SESSION: "dpro_consult_staff_session",');

  source = source.replace(
`  function removeAdminCode() {
    try {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
    } catch {
      // 保存領域が利用できない場合も、画面処理を止めない。
    }
  }`,
`  function removeAdminCode() {
    try {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
      localStorage.removeItem(STORAGE_KEYS.STAFF_SESSION);
      sessionStorage.removeItem(STORAGE_KEYS.STAFF_SESSION);
    } catch {
      // 保存領域が利用できない場合も、画面処理を止めない。
    }
  }`);

  const oldAdmin = `    if (admin) {
      const code = String(adminCode || getAdminCode()).trim();

      if (!code) {
        throw new DproApiError(
          "管理コードが保存されていません。管理コード1234を保存してください。",
          401,
        );
      }

      requestHeaders.set("X-Admin-Code", code);
    }`;

  const newAdmin = `    requestHeaders.set("X-DPRO-Demo", "1");

    try {
      const lineToken = window.liff?.getIDToken?.() || "";
      if (lineToken) requestHeaders.set("X-Line-ID-Token", lineToken);
    } catch {
      // LIFF未設定・未ログイン時は通常の顧問先番号+電話番号認証を使う。
    }

    const isStaffPage = /\\/staff\\.html$/.test(window.location.pathname);
    const staffProtected =
      isStaffPage &&
      (
        String(path || "").startsWith("/api/staff/") ||
        [
          API_ENDPOINTS.ADMIN_DOCUMENT_CHECK,
          API_ENDPOINTS.ADMIN_TEMPLATES,
          API_ENDPOINTS.ADMIN_MESSAGE_LOG_COPY,
        ].includes(path)
      );

    if (isStaffPage && path === API_ENDPOINTS.ADMIN_STAFF && admin) {
      const pin = String(adminCode || getAdminCode()).trim();
      if (!pin) {
        throw new DproApiError("担当者PINを入力してください。", 401);
      }
      const authResponse = await fetch(buildApiUrl("/api/staff/session"), {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-DPRO-Demo": "1",
        },
        body: JSON.stringify({ pin }),
        cache: "no-store",
      });
      const authPayload = await authResponse.json().catch(() => null);
      if (!authResponse.ok || !authPayload?.ok || !authPayload?.session_token) {
        throw new DproApiError(
          authPayload?.error || "担当者PINを確認してください。",
          authResponse.status || 401,
          null,
          authPayload,
        );
      }
      sessionStorage.setItem(STORAGE_KEYS.STAFF_SESSION, authPayload.session_token);
      const staff = authPayload.staff || {};
      return {
        ok: true,
        staff: [{
          id: staff.id,
          staff_code: staff.staff_code,
          staff_name: staff.staff_name,
          role: staff.role,
          is_active: true,
          is_bookable: true,
          permissions: staff.permissions || [],
        }],
      };
    }

    if (staffProtected) {
      const session =
        sessionStorage.getItem(STORAGE_KEYS.STAFF_SESSION) ||
        localStorage.getItem(STORAGE_KEYS.STAFF_SESSION) ||
        "";
      if (!session) {
        throw new DproApiError("担当者セッションがありません。再ログインしてください。", 401);
      }
      requestHeaders.set("X-Staff-Session", session);
    } else if (admin) {
      const code = String(adminCode || getAdminCode()).trim();
      if (!code) {
        throw new DproApiError(
          "管理コードが保存されていません。管理コード1234を保存してください。",
          401,
        );
      }
      requestHeaders.set("X-Admin-Code", code);
    }`;

  if (!source.includes(oldAdmin)) throw new Error("CONFIG_PATCH_ANCHOR_NOT_FOUND");
  source = source.replace(oldAdmin, newAdmin);
  return source;
}

function patchHtml(name: string, source: string) {
  source = source.replaceAll("CONSULT-4-CONFIG-20260714", FRONTEND_VERSION);
  if (name === "staff.html") {
    source = source
      .replace("管理コードを入力すると、担当社労士・事務スタッフごとの", "担当者PINを入力すると、ご本人の担当業務を安全に表示します。")
      .replace("面談・相談・手続き・タスクを確認できます。", "デモPIN：田中1001 / 山本1002 / 佐々木1003")
      .replace('placeholder="管理コード"', 'placeholder="担当者PIN（例：1001）"')
      .replace("管理コードを消去", "担当者セッションを消去");
  }
  return source;
}

Deno.serve(async (req: Request) => {
  const name = pathOf(req);
  if (!ALLOWED.has(name)) return new Response("Not Found", { status: 404, headers: noStore("text/plain; charset=utf-8") });
  if (name === "runtime-contract.js") {
    return new Response(`const SHAROUSHI_FRONTEND_VERSION = "${FRONTEND_VERSION}";\nwindow.DPRO_SHAROUSHI_FRONTEND_VERSION = SHAROUSHI_FRONTEND_VERSION;\n`, { status: 200, headers: noStore("application/javascript; charset=utf-8") });
  }
  const upstream = await fetch(`${SOURCE_BASE}/${name}?r2=${Date.now()}`, { cache: "no-store" });
  if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status, headers: noStore(upstream.headers.get("content-type") || "text/plain; charset=utf-8") });
  let text = await upstream.text();
  if (name === "config.js") text = patchConfig(text);
  else if (name.endsWith(".html")) text = patchHtml(name, text);
  const type = name.endsWith(".js") ? "application/javascript; charset=utf-8" : "text/html; charset=utf-8";
  return new Response(text, { status: 200, headers: noStore(type) });
});
