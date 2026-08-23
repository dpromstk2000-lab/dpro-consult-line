/**
 * DPRO 士業・相談予約 LINE
 * STEP CONSULT-4
 * 共通設定・共通ユーティリティ
 * Version: CONSULT-4-CONFIG-20260714
 *
 * GitHub配置ファイル名:
 * config.js
 *
 * 注意:
 * ・SUPABASE_SERVICE_ROLE_KEYは絶対にここへ書かないでください。
 * ・管理コードはデモ用です。本番公開時は認証方式を再設計します。
 * ・各HTMLでは、このconfig.jsを先に読み込んでください。
 *
 * 読み込み例:
 * <script src="./config.js?v=CONSULT-4-CONFIG-20260714"></script>
 */

(() => {
  "use strict";

  const VERSION = "SHAROUSHI-PR2-FRONTEND-20260823";
  const API_BASE_URL =
    "https://ropwvdnohadwxfbkcopx.supabase.co/functions/v1/dpro-sharoushi-control-gateway-v2";
  const GITHUB_PAGES_BASE_URL =
    "https://dpromstk2000-lab.github.io/dpro-consult-line";
  const OFFICE_CODE = "dpro_consult_demo";
  const DEFAULT_ADMIN_CODE = "1234";
  const APP_NAME = "DPRO 社労士・顧問先対応 LINE";
  const OFFICE_NAME = "DPRO社会保険労務士事務所";
  const TIMEZONE = "Asia/Tokyo";
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

  const STORAGE_KEYS = Object.freeze({
    ADMIN_CODE: "dpro_consult_admin_code",
    LINE_USER_ID: "dpro_consult_line_user_id",
    COMPANY_CODE: "dpro_consult_company_code",
    CONTACT_PHONE: "dpro_consult_contact_phone",
    LAST_PAGE: "dpro_consult_last_page",
    STAFF_SESSION: "dpro_consult_staff_session",
  });

  const PAGE_URLS = Object.freeze({
    INDEX: `${GITHUB_PAGES_BASE_URL}/index.html`,
    MEMBER: `${GITHUB_PAGES_BASE_URL}/member.html`,
    OWNER: `${GITHUB_PAGES_BASE_URL}/owner.html`,
    STAFF: `${GITHUB_PAGES_BASE_URL}/staff.html`,
    OWNER_IPAD: `${GITHUB_PAGES_BASE_URL}/owner-ipad.html`,
    SYSTEM_CHECK: `${GITHUB_PAGES_BASE_URL}/system-check.html`,
  });

  const API_ENDPOINTS = Object.freeze({
    ROOT: "/",
    HEALTH: "/api/health",

    PUBLIC_CONFIG: "/api/public/config",
    PUBLIC_OPTIONS: "/api/public/consultation-options",
    PUBLIC_AVAILABILITY: "/api/public/availability",
    PUBLIC_CONSULTATIONS: "/api/public/consultations",
    PUBLIC_PROCEDURE_REQUESTS: "/api/public/procedure-requests",
    PUBLIC_APPOINTMENTS: "/api/public/appointments",
    PUBLIC_CONTACT: "/api/public/contact",
    PUBLIC_CHANGE_REQUEST: "/api/public/change-request",
    PUBLIC_CANCEL_REQUEST: "/api/public/cancel-request",
    MEMBER_PROFILE: "/api/member/profile",

    ADMIN_DEMO_PREPARE: "/api/admin/demo/prepare",
    ADMIN_DASHBOARD: "/api/admin/dashboard",
    ADMIN_DAY: "/api/admin/day",
    ADMIN_SEARCH: "/api/admin/search",
    ADMIN_COMPANY_DETAIL: "/api/admin/company-detail",
    ADMIN_CONTACT_DETAIL: "/api/admin/contact-detail",
    ADMIN_CONSULTATION_DETAIL: "/api/admin/consultation-detail",
    ADMIN_PROCEDURE_DETAIL: "/api/admin/procedure-detail",
    ADMIN_APPOINTMENT_DETAIL: "/api/admin/appointment-detail",
    ADMIN_TEMPLATES: "/api/admin/templates",
    ADMIN_STAFF: "/api/admin/staff",

    ADMIN_CONSULTATION_MANUAL_CREATE:
      "/api/admin/consultations/manual-create",
    ADMIN_PROCEDURE_MANUAL_CREATE:
      "/api/admin/procedure-requests/manual-create",
    ADMIN_APPOINTMENT_MANUAL_CREATE:
      "/api/admin/appointments/manual-create",

    ADMIN_CONSULTATION_STATUS: "/api/admin/consultations/status",
    ADMIN_PROCEDURE_STATUS: "/api/admin/procedures/status",
    ADMIN_APPOINTMENT_STATUS: "/api/admin/appointments/status",
    ADMIN_DOCUMENT_CHECK: "/api/admin/documents/check",
    ADMIN_PROGRESS_SAVE: "/api/admin/progress/save",
    ADMIN_TASK_STATUS: "/api/admin/tasks/status",
    ADMIN_MESSAGE_LOG_COPY: "/api/admin/messages/log-copy",
    ADMIN_SETTINGS_SAVE: "/api/admin/settings/save",

    STAFF_TODAY: "/api/staff/today",
    STAFF_WORK: "/api/staff/work",
    STAFF_CONSULTATION_STATUS: "/api/staff/consultations/status",
    STAFF_PROCEDURE_STATUS: "/api/staff/procedures/status",
    STAFF_APPOINTMENT_STATUS: "/api/staff/appointments/status",
    STAFF_PROGRESS_SAVE: "/api/staff/progress/save",
    STAFF_TASK_STATUS: "/api/staff/tasks/status",

    IPAD_TODAY: "/api/ipad/today",
    IPAD_APPOINTMENT_STATUS: "/api/ipad/appointments/status",
  });

  class DproApiError extends Error {
    constructor(message, status = 0, details = null, payload = null) {
      super(message);
      this.name = "DproApiError";
      this.status = status;
      this.details = details;
      this.payload = payload;
    }
  }

  function buildApiUrl(path, query = {}) {
    const normalizedPath = String(path || "").startsWith("/")
      ? String(path)
      : `/${String(path || "")}`;

    const url = new URL(`${API_BASE_URL}${normalizedPath}`);

    Object.entries(query || {}).forEach(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        Number.isNaN(value)
      ) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null && item !== "") {
            url.searchParams.append(key, String(item));
          }
        });
        return;
      }

      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  function buildPageUrl(pageName, query = {}) {
    const baseUrl = PAGE_URLS[pageName] || pageName;

    if (!baseUrl) {
      throw new Error("画面URLが指定されていません。");
    }

    const url = new URL(baseUrl, window.location.href);

    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  function getAdminCode() {
    try {
      return (
        localStorage.getItem(STORAGE_KEYS.ADMIN_CODE) ||
        sessionStorage.getItem(STORAGE_KEYS.ADMIN_CODE) ||
        ""
      ).trim();
    } catch {
      return "";
    }
  }

  function hasAdminCode() {
    return Boolean(getAdminCode());
  }

  function saveAdminCode(adminCode, options = {}) {
    const normalized = String(adminCode || "").trim();

    if (!normalized) {
      throw new Error("管理コードを入力してください。");
    }

    const useSessionStorage = options.sessionOnly === true;

    try {
      if (useSessionStorage) {
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_CODE, normalized);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
      } else {
        localStorage.setItem(STORAGE_KEYS.ADMIN_CODE, normalized);
        sessionStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
      }
    } catch (error) {
      throw new Error(
        `管理コードを保存できませんでした。${error?.message || ""}`,
      );
    }

    return normalized;
  }

  function saveDefaultDemoAdminCode() {
    return saveAdminCode(DEFAULT_ADMIN_CODE);
  }

  function removeAdminCode() {
    try {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
      localStorage.removeItem(STORAGE_KEYS.STAFF_SESSION);
      sessionStorage.removeItem(STORAGE_KEYS.STAFF_SESSION);
    } catch {
      // 保存領域が利用できない場合も、画面処理を止めない。
    }
  }

  function requireSavedAdminCode() {
    const adminCode = getAdminCode();

    if (!adminCode) {
      throw new DproApiError(
        "管理コードが保存されていません。管理コード1234を保存してください。",
        401,
      );
    }

    return adminCode;
  }

  function setStoredValue(key, value) {
    if (!Object.values(STORAGE_KEYS).includes(key)) {
      throw new Error("保存キーが許可されていません。");
    }

    try {
      if (value === undefined || value === null || value === "") {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, String(value));
      }
    } catch {
      // 端末設定などでlocalStorageが使えない場合は無視する。
    }
  }

  function getStoredValue(key) {
    if (!Object.values(STORAGE_KEYS).includes(key)) {
      return "";
    }

    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  async function apiFetch(path, options = {}) {
    const {
      method = "GET",
      query = {},
      body,
      admin = false,
      adminCode,
      timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
      headers = {},
      signal,
    } = options;

    const requestHeaders = new Headers(headers);
    requestHeaders.set("Accept", "application/json");

    if (body !== undefined) {
      requestHeaders.set("Content-Type", "application/json");
    }

    requestHeaders.set("X-DPRO-Demo", "1");
    try { const lineToken = window.liff?.getIDToken?.() || ""; if (lineToken) requestHeaders.set("X-Line-ID-Token", lineToken); } catch {}
    const isStaffPage = /\/staff\.html$/.test(window.location.pathname);
    const staffProtected = isStaffPage && (String(path || "").startsWith("/api/staff/") || [API_ENDPOINTS.ADMIN_DOCUMENT_CHECK,API_ENDPOINTS.ADMIN_TEMPLATES,API_ENDPOINTS.ADMIN_MESSAGE_LOG_COPY].includes(path));
    if (isStaffPage && path === API_ENDPOINTS.ADMIN_STAFF && admin) {
      const pin = String(adminCode || getAdminCode()).trim();
      if (!pin) throw new DproApiError("担当者PINを入力してください。", 401);
      const staffCode = ({"1001":"SR-STAFF-001","1002":"SR-STAFF-002","1003":"SR-STAFF-003"})[pin] || "";
      if (!staffCode) throw new DproApiError("デモ担当者PINを確認してください。", 401);
      const authResponse = await fetch(buildApiUrl("/api/staff/session"), {method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json","X-DPRO-Demo":"1"},body:JSON.stringify({ staff_code: staffCode, pin }),cache:"no-store"});
      const authPayload = await authResponse.json().catch(() => null);
      if (!authResponse.ok || !authPayload?.ok || !authPayload?.session_token) throw new DproApiError(authPayload?.error || "担当者PINを確認してください。",authResponse.status || 401,null,authPayload);
      sessionStorage.setItem(STORAGE_KEYS.STAFF_SESSION, authPayload.session_token);
      const staff = authPayload.staff || {};
      return {ok:true,staff:[{id:staff.id,staff_code:staff.staff_code,staff_name:staff.staff_name,role:staff.role,is_active:true,is_bookable:true,permissions:staff.permissions || []}]};
    }
    if (staffProtected) { const session = sessionStorage.getItem(STORAGE_KEYS.STAFF_SESSION) || localStorage.getItem(STORAGE_KEYS.STAFF_SESSION) || ""; if (!session) throw new DproApiError("担当者セッションがありません。再ログインしてください。", 401); requestHeaders.set("X-Staff-Session", session); } else if (admin) { const code = String(adminCode || getAdminCode()).trim(); if (!code) throw new DproApiError("管理コードが保存されていません。管理コード1234を保存してください。",401); requestHeaders.set("X-Admin-Code", code); }

    const timeoutController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      timeoutController.abort(
        new DOMException("API通信がタイムアウトしました。", "TimeoutError"),
      );
    }, timeoutMs);

    if (signal) {
      if (signal.aborted) {
        timeoutController.abort(signal.reason);
      } else {
        signal.addEventListener(
          "abort",
          () => timeoutController.abort(signal.reason),
          { once: true },
        );
      }
    }

    let response;

    try {
      response = await fetch(buildApiUrl(path, query), {
        method: String(method).toUpperCase(),
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: timeoutController.signal,
        cache: "no-store",
      });
    } catch (error) {
      if (
        error?.name === "AbortError" ||
        error?.name === "TimeoutError" ||
        timeoutController.signal.aborted
      ) {
        throw new DproApiError(
          "API通信がタイムアウトしました。時間をおいて再度お試しください。",
          408,
          error?.message || null,
        );
      }

      throw new DproApiError(
        "APIへ接続できませんでした。Worker URLや通信環境を確認してください。",
        0,
        error?.message || null,
      );
    } finally {
      window.clearTimeout(timeoutId);
    }

    const rawText = await response.text();
    let payload = null;

    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = {
          ok: response.ok,
          message: rawText,
        };
      }
    }

    if (!response.ok || payload?.ok === false) {
      const message =
        payload?.error ||
        payload?.message ||
        `API処理に失敗しました。（HTTP ${response.status}）`;

      throw new DproApiError(
        message,
        response.status,
        payload?.details || null,
        payload,
      );
    }

    return payload;
  }

  function normalizePhone(value) {
    if (value === undefined || value === null) {
      return "";
    }

    let phone = String(value)
      .normalize("NFKC")
      .replace(/[‐‑‒–—―ー−]/g, "-")
      .replace(/[^0-9+]/g, "");

    if (!phone) {
      return "";
    }

    if (phone.startsWith("+81")) {
      const domestic = phone.slice(3);
      phone = domestic.startsWith("0") ? domestic : `0${domestic}`;
    }

    return phone.replace(/^\+/, "");
  }

  function formatPhone(value) {
    const phone = normalizePhone(value);

    if (/^0\d{9}$/.test(phone)) {
      return `${phone.slice(0, 2)}-${phone.slice(2, 6)}-${phone.slice(6)}`;
    }

    if (/^0\d{10}$/.test(phone)) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }

    return phone;
  }

  function normalizeLineBreaks(value) {
    return String(value ?? "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
  }

  async function copyText(value) {
    const text = normalizeLineBreaks(value);

    if (!text) {
      throw new Error("コピーする文面がありません。");
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return text;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("文面をコピーできませんでした。");
    }

    return text;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getQueryParam(name, fallback = "") {
    const value = new URLSearchParams(window.location.search).get(name);
    return value === null ? fallback : value;
  }

  function setQueryParams(params = {}, options = {}) {
    const url = new URL(window.location.href);

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, String(value));
      }
    });

    if (options.replace === false) {
      window.history.pushState({}, "", url);
    } else {
      window.history.replaceState({}, "", url);
    }

    return url.toString();
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value, options = {}) {
    if (!value) {
      return options.fallback || "—";
    }

    const date =
      /^\d{4}-\d{2}-\d{2}$/.test(String(value))
        ? new Date(`${value}T12:00:00+09:00`)
        : parseDate(value);

    if (!date) {
      return options.fallback || String(value);
    }

    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: options.weekday === false ? undefined : "short",
    }).format(date);
  }

  function formatDateTime(value, options = {}) {
    const date = parseDate(value);

    if (!date) {
      return options.fallback || "—";
    }

    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: TIMEZONE,
      year: options.year === false ? undefined : "numeric",
      month: "numeric",
      day: "numeric",
      weekday: options.weekday === false ? undefined : "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatTime(value, fallback = "—") {
    const date = parseDate(value);

    if (!date) {
      return fallback;
    }

    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function todayJst() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function addDays(dateString, days) {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString))
      ? new Date(`${dateString}T12:00:00+09:00`)
      : parseDate(dateString);

    if (!base) {
      return "";
    }

    base.setDate(base.getDate() + Number(days || 0));

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(base);
  }

  function isPastDate(dateString) {
    if (!dateString) {
      return false;
    }

    return String(dateString) < todayJst();
  }

  function statusLabel(type, status) {
    const maps = {
      consultation: {
        new: "新着",
        reviewing: "確認中",
        waiting_client: "顧問先返信待ち",
        reply_preparing: "回答準備中",
        answered: "回答済み",
        meeting_required: "面談必要",
        converted_to_procedure: "手続きへ移行",
        completed: "完了",
        closed: "終了",
      },
      procedure: {
        received: "受付済み",
        checking: "確認中",
        waiting_documents: "書類待ち",
        documents_received: "書類受領済み",
        preparing: "準備中",
        submitted: "提出済み",
        waiting_authority: "処理待ち",
        completed: "完了",
        cancelled: "キャンセル",
        closed: "終了",
      },
      appointment: {
        reserved: "予約受付",
        confirmed: "予約確定",
        arrived: "来所済み",
        in_meeting: "面談中",
        completed: "面談完了",
        change_requested: "日程変更希望",
        cancel_requested: "キャンセル希望",
        cancelled: "キャンセル",
        no_show: "無断キャンセル",
      },
      document: {
        not_checked: "未確認",
        guided: "案内済み",
        partially_received: "一部受領",
        received: "受領済み",
        additional_required: "追加確認",
        not_required: "不要",
      },
      task: {
        open: "未対応",
        in_progress: "対応中",
        completed: "完了",
        cancelled: "取消",
      },
      company: {
        active: "契約中",
        trial: "試用中",
        paused: "休止中",
        ended: "契約終了",
      },
    };

    return maps[type]?.[status] || status || "—";
  }

  function showToast(message, options = {}) {
    const text = String(message || "").trim();

    if (!text || typeof document === "undefined") {
      return;
    }

    const type = options.type || "success";
    const duration = Number(options.duration || 2600);
    const toastId = "dpro-consult-common-toast";
    let toast = document.getElementById(toastId);

    if (!toast) {
      toast = document.createElement("div");
      toast.id = toastId;
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      Object.assign(toast.style, {
        position: "fixed",
        left: "50%",
        bottom: "24px",
        transform: "translateX(-50%) translateY(24px)",
        zIndex: "99999",
        maxWidth: "calc(100vw - 32px)",
        padding: "13px 18px",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: "700",
        lineHeight: "1.5",
        color: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.24)",
        opacity: "0",
        transition: "opacity .2s ease, transform .2s ease",
        pointerEvents: "none",
        textAlign: "center",
      });
      document.body.appendChild(toast);
    }

    const backgrounds = {
      success: "#13795b",
      error: "#b42318",
      warning: "#9a6700",
      info: "#175cd3",
    };

    toast.style.background = backgrounds[type] || backgrounds.success;
    toast.textContent = text;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";

    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(24px)";
    }, duration);
  }

  function setButtonLoading(button, loading, options = {}) {
    if (!button) {
      return;
    }

    const loadingText = options.loadingText || "処理中...";
    const originalTextKey = "dproOriginalText";

    if (loading) {
      if (!button.dataset[originalTextKey]) {
        button.dataset[originalTextKey] = button.textContent;
      }
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = loadingText;
      return;
    }

    button.disabled = false;
    button.removeAttribute("aria-busy");

    if (button.dataset[originalTextKey]) {
      button.textContent = button.dataset[originalTextKey];
      delete button.dataset[originalTextKey];
    }
  }

  async function withButtonLoading(button, callback, options = {}) {
    setButtonLoading(button, true, options);

    try {
      return await callback();
    } finally {
      setButtonLoading(button, false, options);
    }
  }

  function downloadTextFile(filename, content, mimeType = "text/plain") {
    const blob = new Blob([String(content ?? "")], {
      type: `${mimeType};charset=UTF-8`,
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const config = Object.freeze({
    VERSION,
    API_BASE_URL,
    GITHUB_PAGES_BASE_URL,
    OFFICE_CODE,
    DEFAULT_ADMIN_CODE,
    APP_NAME,
    OFFICE_NAME,
    TIMEZONE,
    DEFAULT_REQUEST_TIMEOUT_MS,
    STORAGE_KEYS,
    PAGE_URLS,
    API_ENDPOINTS,

    DproApiError,

    buildApiUrl,
    buildPageUrl,
    apiFetch,

    getAdminCode,
    hasAdminCode,
    saveAdminCode,
    saveDefaultDemoAdminCode,
    removeAdminCode,
    requireSavedAdminCode,

    setStoredValue,
    getStoredValue,

    normalizePhone,
    formatPhone,
    normalizeLineBreaks,
    copyText,
    escapeHtml,

    getQueryParam,
    setQueryParams,

    formatDate,
    formatDateTime,
    formatTime,
    todayJst,
    addDays,
    isPastDate,
    statusLabel,

    showToast,
    setButtonLoading,
    withButtonLoading,
    downloadTextFile,
  });

  Object.defineProperty(window, "DPRO_CONSULT", {
    value: config,
    writable: false,
    configurable: false,
    enumerable: true,
  });

  window.dispatchEvent(
    new CustomEvent("dpro-consult-config-ready", {
      detail: {
        version: VERSION,
        officeCode: OFFICE_CODE,
        apiBaseUrl: API_BASE_URL,
      },
    }),
  );
})();
