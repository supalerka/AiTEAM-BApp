import React, { useState, useEffect, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://byprrxqoxxomoffweftu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5cHJyeHFveHhvbW9mZndlZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjAzNzksImV4cCI6MjA5NDEzNjM3OX0.D0k3R0VOJzMECsKfvBzXVFXnNBBaNfNCiOHrsZp5uHM";


// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const sb = (() => {
  const base = (token) => ({
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    Prefer: "return=representation",
  });

  const getToken = () => {
    try {
      const s = localStorage.getItem("sb_session");
      return s ? JSON.parse(s).access_token : null;
    } catch { return null; }
  };

  // Helper: build auth headers. Pass explicit token for cases where
  // it's already resolved (e.g. loadPermissionsFromDB); omit to use localStorage.
  const authHeaders = (token, extra = {}) => ({
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || getToken() || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  });

  const auth = {
    signIn: async ({ email, password }) => {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: base(),
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (r.ok && d.access_token) localStorage.setItem("sb_session", JSON.stringify(d));
      return r.ok ? { data: d, error: null } : { data: null, error: d };
    },
    signOut: () => localStorage.removeItem("sb_session"),
    getSession: () => {
      try { const s = localStorage.getItem("sb_session"); return s ? JSON.parse(s) : null; }
      catch { return null; }
    },
    resetPassword: async (email) => {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST", headers: base(), body: JSON.stringify({ email }),
      });
      return r.ok ? { error: null } : { error: await r.json() };
    },
  };

  const db = {
    list: async (table, search = "", searchCols = []) => {
      const baseTable = table.split("?")[0];
      const noOrder = ["company_settings"].includes(baseTable);
      let url = `${SUPABASE_URL}/rest/v1/${baseTable}?select=*`;
      if (!noOrder) url += `&order=created_at.desc`;
      if (search && searchCols.length) {
        const q = searchCols.map(c => `${c}.ilike.*${search}*`).join(",");
        url += `&or=(${q})`;
      }
      const r = await fetch(url, { headers: base(getToken()) });
      return r.ok ? await r.json() : [];
    },
    insert: async (table, data) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST", headers: base(getToken()), body: JSON.stringify(data),
      });
      const d = await r.json();
      return r.ok ? { data: d, error: null } : { data: null, error: d };
    },
    update: async (table, id, data) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: "PATCH", headers: base(getToken()), body: JSON.stringify(data),
      });
      const d = await r.json();
      return r.ok ? { data: d, error: null } : { data: null, error: d };
    },
    delete: async (table, id) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: "DELETE", headers: base(getToken()),
      });
      return { error: r.ok ? null : await r.json() };
    },
  };

  return { auth, db, h: authHeaders };
})();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n, d = 2) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });

const errMsg = (e) => {
  if (!e) return "";
  const m = e.message || e.msg || JSON.stringify(e);
  if (m.includes("already registered")) return "อีเมลนี้ถูกลงทะเบียนแล้ว";
  if (m.includes("Invalid login")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("Email not confirmed")) return "กรุณายืนยันอีเมลก่อนเข้าใช้งาน";
  if (m.includes("Password should")) return "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
  return m;
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  sidebar: { width: 240, minHeight: "100vh", background: "#0F6E56", display: "flex", flexDirection: "column", flexShrink: 0 },
  sidebarLogo: { padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  sidebarLogoTitle: { fontSize: 16, fontWeight: 600, color: "#fff", margin: 0 },
  sidebarLogoSub: { fontSize: 11, color: "rgba(255,255,255,0.5)", margin: "2px 0 0" },
  sidebarMenu: { padding: "12px 0", flex: 1 },
  sidebarSection: { fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", padding: "12px 20px 6px", letterSpacing: "0.08em", textTransform: "uppercase" },
  navItem: (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "9px 20px",
    cursor: "pointer", fontSize: 13, fontWeight: active ? 500 : 400,
    color: active ? "#fff" : "rgba(255,255,255,0.65)",
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    borderLeft: active ? "3px solid #fff" : "3px solid transparent",
    transition: "all 0.15s",
  }),
  main: { flex: 1, background: "#F8F9FA", minHeight: "100vh", display: "flex", flexDirection: "column" },
  topbar: { background: "#fff", borderBottom: "1px solid #E9ECEF", padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  content: { padding: 28, flex: 1 },
  pageTitle: { fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" },
  pageSub: { fontSize: 13, color: "#6c757d", margin: "0 0 24px" },
  card: { background: "#fff", border: "1px solid #E9ECEF", borderRadius: 12, padding: "20px 24px" },
  btn: (variant = "primary") => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: "pointer", border: "none", transition: "all 0.15s",
    background: variant === "primary" ? "#0F6E56" : variant === "danger" ? "#fff" : "#fff",
    color: variant === "primary" ? "#fff" : variant === "danger" ? "#dc3545" : "#495057",
    boxShadow: variant !== "primary" ? "inset 0 0 0 1px #dee2e6" : "none",
  }),
  input: { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #dee2e6", borderRadius: 8, background: "#fff", color: "#1a1a1a", outline: "none", boxSizing: "border-box" },
  label: { fontSize: 12, fontWeight: 500, color: "#495057", display: "block", marginBottom: 5 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6c757d", borderBottom: "2px solid #E9ECEF", textTransform: "uppercase", letterSpacing: "0.05em" },
  td: { padding: "12px 14px", borderBottom: "1px solid #F1F3F5", color: "#343a40", verticalAlign: "middle" },
  badge: (color) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 20,
    fontSize: 11, fontWeight: 500,
    background: color === "green" ? "#d1fae5" : color === "blue" ? "#dbeafe" : "#f3f4f6",
    color: color === "green" ? "#065f46" : color === "blue" ? "#1e40af" : "#374151",
  }),
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "#fff", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" },
};

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Alert({ type, msg }) {
  if (!msg) return null;
  const colors = { error: { bg: "#fff5f5", border: "#feb2b2", text: "#c53030" }, success: { bg: "#f0fff4", border: "#9ae6b4", text: "#276749" } };
  const c = colors[type] || colors.error;
  return <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: c.text }}>{msg}</div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div style={S.modal} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#adb5bd", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", width: 260 }}>
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#adb5bd", fontSize: 15 }}>🔍</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "ค้นหา..."} style={{ ...S.input, paddingLeft: 32 }} />
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "#adb5bd" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14, margin: 0 }}>{text}</p>
    </div>
  );
}

// ─── ROLE & PERMISSION ───────────────────────────────────────────────────────
const ROLES = {
  admin:   { label: "Admin",   color: "#dc3545", bg: "#fee2e2", desc: "เข้าถึงได้ทุกอย่าง" },
  sales:   { label: "Sales",   color: "#0369a1", bg: "#dbeafe", desc: "ใบเสนอราคา + ลูกค้า" },
  finance: { label: "Finance", color: "#6b21a8", bg: "#f3e8ff", desc: "Invoice + Receipt + Export" },
  viewer:  { label: "Viewer",  color: "#495057", bg: "#f1f3f5", desc: "ดูได้อย่างเดียว" },
};

const ROLE_ORDER = ["admin", "sales", "finance", "viewer"];

const PAGE_LIST = ["home","customers","products","services","quotations","invoices","receipts","docnumbers","chatbot","export","settings","users"];

// fallback ถ้า DB ยังไม่โหลด
const DEFAULT_PERMISSIONS = {
  home:       ["full","full","full","full"],
  customers:  ["full","full","read","read"],
  products:   ["full","read","read","read"],
  services:   ["full","read","read","read"],
  quotations: ["full","full","read","read"],
  invoices:   ["full","read","full","read"],
  receipts:   ["full","read","full","read"],
  docnumbers: ["full","none","none","none"],
  chatbot:    ["full","full","full","none"],
  export:     ["full","none","full","none"],
  settings:   ["full","none","none","none"],
  users:      ["full","none","none","none"],
};

// permissions state — เริ่มจาก fallback แล้วแทนที่ด้วยข้อมูลจาก DB
let _permissions = { ...DEFAULT_PERMISSIONS };
let _permListeners = [];
const getPermissions = () => _permissions;
const setPermissions = (data) => { _permissions = data; _permListeners.forEach(fn => fn(data)); };
const onPermissionsChange = (fn) => { _permListeners.push(fn); return () => { _permListeners = _permListeners.filter(f => f !== fn); }; };

const canAccess = (role, page) => {
  const idx = ROLE_ORDER.indexOf(role);
  if (idx === -1) return false;
  if (role === "admin") return true; // admin เสมอ full
  const perm = getPermissions()[page];
  if (!perm) return true;
  return perm[idx] !== "none";
};

const canWrite = (role, page) => {
  const idx = ROLE_ORDER.indexOf(role);
  if (idx === -1) return false;
  if (role === "admin") return true;
  const perm = getPermissions()[page];
  if (!perm) return true;
  return perm[idx] === "full";
};

// โหลด permissions จาก DB ครั้งเดียวตอนเริ่มต้น
async function loadPermissionsFromDB(token) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions?select=role,page,level`, {
      headers: sb.h(token)
    });
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return;
    // เริ่มจาก DEFAULT แล้ว override ด้วยค่าจาก DB
    // ไม่ reset เป็น none ทั้งหมดก่อน เพราะถ้า DB ไม่มีบาง page จะทำให้ access ผิดพลาด
    const map = { ...DEFAULT_PERMISSIONS };
    rows.forEach(({ role, page, level }) => {
      if (!map[page]) map[page] = ["full","none","none","none"];
      const idx = ROLE_ORDER.indexOf(role);
      if (idx >= 0) map[page][idx] = level;
    });
    setPermissions(map);
  } catch(e) { /* ใช้ fallback */ }
}

// ─── useProfile hook ──────────────────────────────────────────────────────────
function useProfile(session, onForceLogout) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!session) { setProfile(null); setProfileLoading(false); return; }
    const uid = session?.user?.id || session?.id;
    if (!uid) { setProfileLoading(false); return; }
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${uid}&select=*`, {
        headers: sb.h(token)
      }).then(r => r.json()),
      loadPermissionsFromDB(token)
    ])
      .then(([data]) => {
        if (Array.isArray(data) && data.length > 0) {
          const p = data[0];
          // ถ้า admin ปิดสถานะ user นี้ → force logout ทันที
          if (p.is_active === false) {
            onForceLogout?.();
            return;
          }
          setProfile(p);
        } else {
          setProfile({ id: uid, full_name: session?.user?.email || "ผู้ใช้งาน", position: "", role: "viewer" });
        }
      })
      .catch(() => setProfile({ id: uid, full_name: "", position: "", role: "viewer" }))
      .finally(() => setProfileLoading(false));
  }, [session]);

  return { profile, profileLoading };
}

// ─── UserManagementPage ───────────────────────────────────────────────────────
function UserManagementPage({ currentProfile }) {
  const [tab, setTab] = useState("users"); // "users" | "permissions"
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [permMap, setPermMap] = useState(getPermissions());
  const [permSaving, setPermSaving] = useState(false);

  // Sync permMap กับ _permissions ทุกครั้งที่มีการเปลี่ยนแปลง (รวมถึงหลัง save)
  useEffect(() => {
    return onPermissionsChange(data => setPermMap({ ...data }));
  }, []);

  const load = async () => {
    setLoading(true);
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=*&order=created_at.asc`, {
      headers: sb.h(token)
    });
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const PAGE_LABELS = { home: "🏠 หน้าหลัก", customers: "👥 ลูกค้า", products: "📦 สินค้า", services: "🔧 บริการ", quotations: "📄 ใบเสนอราคา", invoices: "🧾 ใบแจ้งหนี้", receipts: "✅ ใบเสร็จ", docnumbers: "🔢 เลขเอกสาร", chatbot: "🤖 AI Chatbot", export: "📦 Export/Import", settings: "⚙️ ตั้งค่า", users: "👤 จัดการผู้ใช้" };
  const LEVEL_OPTIONS = [{ v: "full", label: "✅ เต็ม", color: "#0F6E56" }, { v: "read", label: "👁 ดูได้", color: "#0369a1" }, { v: "none", label: "— ไม่เห็น", color: "#adb5bd" }];

  const handlePermChange = (page, roleIdx, level) => {
    if (ROLE_ORDER[roleIdx] === "admin") return; // admin ล็อคเสมอ
    setPermMap(prev => {
      const next = { ...prev };
      next[page] = [...(next[page] || ["full","none","none","none"])];
      next[page][roleIdx] = level;
      return next;
    });
  };

  const handleSavePerms = async () => {
    setPermSaving(true);
    setSavedMsg("");
    try {
      const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
      const headers = sb.h(token);

      // Step 1: ลบ rows เดิมทั้งหมดของ non-admin roles
      const deleteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/role_permissions?role=neq.admin`,
        { method: "DELETE", headers }
      );
      if (!deleteRes.ok) {
        const err = await deleteRes.json().catch(() => ({}));
        throw new Error(err.message || `DELETE failed: ${deleteRes.status}`);
      }

      // Step 2: สร้าง rows ใหม่จาก permMap ปัจจุบัน
      const rows = [];
      PAGE_LIST.forEach(page => {
        ROLE_ORDER.forEach((role, idx) => {
          if (role === "admin") return;
          rows.push({
            role,
            page,
            level: permMap[page]?.[idx] || "none",
            updated_at: new Date().toISOString(),
          });
        });
      });

      // Step 3: Insert ใหม่ทั้งหมดในครั้งเดียว
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions`, {
        method: "POST",
        headers: sb.h(token, { Prefer: "return=minimal" }),
        body: JSON.stringify(rows),
      });
      if (!insertRes.ok) {
        const err = await insertRes.json().catch(() => ({}));
        throw new Error(err.message || `INSERT failed: ${insertRes.status}`);
      }

      // Step 4: Reload จาก DB เพื่อยืนยันค่าที่บันทึกจริง
      await loadPermissionsFromDB(token);
      setSavedMsg("บันทึกสิทธิ์แล้ว ✓");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setSavedMsg("❌ บันทึกไม่สำเร็จ: " + e.message);
    } finally {
      setPermSaving(false);
    }
  };

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openEdit = (u) => { setForm({ ...u }); setError(""); setModal({ mode: "edit" }); };
  const openInvite = () => { setForm({ email: "", full_name: "", role: "viewer", position: "" }); setError(""); setModal({ mode: "invite" }); };

  const handleInvite = async () => {
    if (!form.email) { setError("กรุณากรอกอีเมล"); return; }
    if (!form.full_name) { setError("กรุณากรอกชื่อ"); return; }
    if (!form.role) { setError("กรุณาเลือก Role"); return; }
    setSaving(true); setError("");
    // เรียกผ่าน Netlify function เพราะต้องใช้ SUPABASE_SERVICE_ROLE_KEY (admin key)
    // ไม่สามารถเรียก Supabase /auth/v1/invite จาก frontend ได้โดยตรง
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        position: form.position || "",
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (res.ok && d.success) {
      setModal(null);
      setSavedMsg(`ส่งคำเชิญไปที่ ${form.email} แล้ว ✓`);
      setTimeout(() => setSavedMsg(""), 4000);
      load();
    } else {
      setError(d.error || "ส่งคำเชิญไม่สำเร็จ");
    }
  };

  const handleSave = async () => {
    if (!form.full_name) { setError("กรุณากรอกชื่อ"); return; }
    if (!form.role) { setError("กรุณาเลือก Role"); return; }
    setSaving(true); setError("");
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const payload = { full_name: form.full_name, position: form.position || "", role: form.role, is_active: form.is_active !== false, updated_at: new Date().toISOString() };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${form.id}`, {
      method: "PATCH",
      headers: sb.h(token, { Prefer: "return=minimal" }),
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (res.ok) {
      setModal(null);
      setSavedMsg("บันทึกแล้ว ✓");
      setTimeout(() => setSavedMsg(""), 2000);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.message || "บันทึกไม่สำเร็จ");
    }
  };

  const handleToggleActive = async (u) => {
    if (u.id === currentProfile?.id) { alert("ไม่สามารถปิดใช้งานตัวเองได้"); return; }
    // Confirm ก่อนปิดสถานะ เพราะจะ force logout user นั้นทันที
    if (u.is_active) {
      const ok = window.confirm(`ปิดใช้งาน "${u.full_name}" ?
User จะถูก logout ออกจากระบบทันทีเมื่อระบบ re-check (ภายใน 60 วินาที)`);
      if (!ok) return;
    }
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${u.id}`, {
      method: "PATCH",
      headers: sb.h(token, { Prefer: "return=minimal" }),
      body: JSON.stringify({ is_active: !u.is_active, updated_at: new Date().toISOString() })
    });
    load();
  };

  return (
    <div>
      <h1 style={S.pageTitle}>👤 จัดการผู้ใช้งาน</h1>
      <p style={S.pageSub}>{"กำหนด Role และสิทธิ์การเข้าถึงสำหรับแต่ละผู้ใช้"}</p>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ k: "users", label: "👥 ผู้ใช้งาน" }, { k: "permissions", label: "🔐 สิทธิ์แต่ละ Role" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: "8px 20px", borderRadius: 8, border: "1.5px solid", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
              background: tab === t.k ? "#0F6E56" : "#fff", borderColor: tab === t.k ? "#0F6E56" : "#dee2e6", color: tab === t.k ? "#fff" : "#495057" }}>
            {t.label}
          </button>
        ))}
        {savedMsg && <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12, color: "#0F6E56", fontWeight: 600 }}>{savedMsg}</span>}
      </div>

      {/* ─── Tab: สิทธิ์ Role ─── */}
      {tab === "permissions" && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>กำหนดสิทธิ์แต่ละ Role</div>
              <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 2 }}>Admin มีสิทธิ์เต็มเสมอ ไม่สามารถเปลี่ยนได้</div>
            </div>
            <button onClick={handleSavePerms} disabled={permSaving} style={{ ...S.btn("primary"), padding: "8px 20px" }}>
              {permSaving ? "⏳ กำลังบันทึก..." : "💾 บันทึกสิทธิ์"}
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, textAlign: "left", minWidth: 160 }}>หน้า / ฟีเจอร์</th>
                  {ROLE_ORDER.map(r => (
                    <th key={r} style={{ ...S.th, textAlign: "center", minWidth: 130 }}>
                      <span style={{ background: ROLES[r].bg, color: ROLES[r].color, padding: "2px 12px", borderRadius: 12, fontWeight: 600 }}>{ROLES[r].label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAGE_LIST.map((page, pi) => (
                  <tr key={page} style={{ background: pi % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ ...S.td, fontWeight: 500, color: "#495057" }}>{PAGE_LABELS[page] || page}</td>
                    {ROLE_ORDER.map((role, ri) => {
                      const isAdmin = role === "admin";
                      const cur = isAdmin ? "full" : (permMap[page]?.[ri] || "none");
                      return (
                        <td key={role} style={{ ...S.td, textAlign: "center" }}>
                          {isAdmin ? (
                            <span style={{ color: "#0F6E56", fontWeight: 700, fontSize: 12 }}>✅ เต็ม (ล็อค)</span>
                          ) : (
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              {LEVEL_OPTIONS.map(opt => (
                                <button key={opt.v} onClick={() => handlePermChange(page, ri, opt.v)}
                                  style={{ padding: "3px 8px", borderRadius: 6, border: `1.5px solid ${cur === opt.v ? opt.color : "#dee2e6"}`,
                                    background: cur === opt.v ? opt.color : "#fff",
                                    color: cur === opt.v ? "#fff" : "#adb5bd",
                                    fontSize: 11, cursor: "pointer", fontWeight: cur === opt.v ? 600 : 400,
                                    transition: "all 0.1s" }}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 11, color: "#92400e" }}>
            💡 การเปลี่ยนสิทธิ์มีผลทันทีหลังบันทึก — ผู้ใช้ที่ login อยู่จะเห็นสิทธิ์ใหม่หลัง logout แล้ว login ใหม่
          </div>
        </div>
      )}

      {/* ─── Tab: ผู้ใช้งาน ─── */}
      {tab === "users" && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>ผู้ใช้งานทั้งหมด ({users.length} คน)</div>
              <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 2 }}>เพิ่มผู้ใช้ใหม่โดยส่งคำเชิญทางอีเมล — ผู้ใช้จะตั้งรหัสผ่านเองผ่านลิงก์ในอีเมล</div>
            </div>
            <button onClick={openInvite} style={{ ...S.btn("primary"), padding: "8px 18px", fontSize: 13 }}>
              ✉️ เชิญผู้ใช้ใหม่
            </button>
          </div>
          {loading
            ? <div style={{ textAlign: "center", padding: 32, color: "#adb5bd" }}>{"กำลังโหลด..."}</div>
            : users.length === 0
              ? <div style={{ textAlign: "center", padding: 32, color: "#adb5bd" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{"👤"}</div>
                  <div>{"ยังไม่มีข้อมูลผู้ใช้"}</div>
                </div>
              : <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>{"ชื่อ / ตำแหน่ง"}</th>
                      <th style={S.th}>{"Role"}</th>
                      <th style={S.th}>{"สถานะ"}</th>
                      <th style={S.th}>{"แก้ไขล่าสุด"}</th>
                      <th style={S.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const roleObj = ROLES[u.role] || ROLES.viewer;
                      const isSelf = u.id === currentProfile?.id;
                      return (
                        <tr key={u.id}>
                          <td style={S.td}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {u.full_name || "—"}
                              {isSelf && <span style={{ marginLeft: 6, fontSize: 10, background: "#f0fff4", color: "#0F6E56", border: "1px solid #9ae6b4", borderRadius: 10, padding: "1px 7px" }}>{"คุณ"}</span>}
                            </div>
                            {u.position && <div style={{ fontSize: 11, color: "#6c757d", marginTop: 2 }}>{u.position}</div>}
                          </td>
                          <td style={S.td}>
                            <span style={{ background: roleObj.bg, color: roleObj.color, padding: "3px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{roleObj.label}</span>
                          </td>
                          <td style={S.td}>
                            <span style={{ background: u.is_active ? "#d1fae5" : "#fee2e2", color: u.is_active ? "#065f46" : "#991b1b", padding: "3px 12px", borderRadius: 12, fontSize: 12 }}>
                              {u.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                            </span>
                          </td>
                          <td style={{ ...S.td, fontSize: 11, color: "#adb5bd" }}>
                            {u.updated_at ? new Date(u.updated_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => openEdit(u)} style={{ ...S.btn("ghost"), padding: "4px 12px", fontSize: 12 }}>{"✏️ แก้ไข"}</button>
                              <button onClick={() => handleToggleActive(u)} disabled={isSelf}
                                style={{ ...S.btn(u.is_active ? "danger" : "ghost"), padding: "4px 12px", fontSize: 12, opacity: isSelf ? 0.4 : 1 }}>
                                {u.is_active ? "ปิด" : "เปิด"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
          }
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
            {"💡 เพิ่ม user ใหม่: Supabase → Authentication → Users → Add user → กรอก email + password แล้วรัน SQL insert ใน user_profiles"}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {modal?.mode === "invite" && (
        <Modal title="✉️ เชิญผู้ใช้ใหม่เข้าระบบ" onClose={() => setModal(null)}>
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
            ระบบจะส่งอีเมลคำเชิญไปให้ผู้ใช้ — ผู้ใช้จะกดลิงก์และตั้งรหัสผ่านด้วยตัวเอง<br />
            Role ที่กำหนดที่นี่จะมีผลทันทีเมื่อผู้ใช้ยืนยันบัญชี
          </div>
          <Alert type="error" msg={error} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>อีเมล <span style={{ color: "#dc3545" }}>*</span></label>
              <input type="email" value={form.email || ""} onChange={setF("email")} style={S.input} placeholder="employee@company.com" />
            </div>
            <div>
              <label style={S.label}>ชื่อ-นามสกุล <span style={{ color: "#dc3545" }}>*</span></label>
              <input value={form.full_name || ""} onChange={setF("full_name")} style={S.input} placeholder="สมชาย ใจดี" />
            </div>
            <div>
              <label style={S.label}>ตำแหน่งงาน</label>
              <input value={form.position || ""} onChange={setF("position")} style={S.input} placeholder="Sales Manager, บัญชี ฯลฯ" />
            </div>
            <div>
              <label style={S.label}>Role <span style={{ color: "#dc3545" }}>*</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ROLE_ORDER.map(r => {
                  const roleObj = ROLES[r];
                  const isSelected = form.role === r;
                  const disabled = r === "admin";
                  return (
                    <div key={r} onClick={() => !disabled && setForm(f => ({ ...f, role: r }))}
                      style={{ padding: "12px 14px", borderRadius: 10, border: `2px solid ${isSelected ? roleObj.color : "#dee2e6"}`,
                        background: isSelected ? roleObj.bg : "#fff", cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.4 : 1, transition: "all 0.15s" }}>
                      <div style={{ fontWeight: 700, color: isSelected ? roleObj.color : "#495057", marginBottom: 2 }}>{roleObj.label}</div>
                      <div style={{ fontSize: 11, color: "#6c757d" }}>{roleObj.desc}</div>
                      {disabled && <div style={{ fontSize: 10, color: "#adb5bd", marginTop: 2 }}>กำหนดตรง DB เท่านั้น</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button style={S.btn("ghost")} onClick={() => setModal(null)} disabled={saving}>ยกเลิก</button>
            <button style={S.btn("primary")} onClick={handleInvite} disabled={saving}>
              {saving ? "⏳ กำลังส่งคำเชิญ..." : "✉️ ส่งคำเชิญ"}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {modal?.mode === "edit" && (
        <Modal title={`✏️ แก้ไข: ${form.full_name}`} onClose={() => setModal(null)}>
          <Alert type="error" msg={error} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>ชื่อ-นามสกุล <span style={{ color: "#dc3545" }}>*</span></label>
              <input value={form.full_name || ""} onChange={setF("full_name")} style={S.input} placeholder="สมชาย ใจดี" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>ตำแหน่งงาน</label>
              <input value={form.position || ""} onChange={setF("position")} style={S.input} placeholder="Sales Manager, บัญชี ฯลฯ" />
              <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 3 }}>ตำแหน่งนี้จะแสดงในใบเสนอราคาอัตโนมัติ</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>Role <span style={{ color: "#dc3545" }}>*</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ROLE_ORDER.map(r => {
                  const roleObj = ROLES[r];
                  const isSelected = form.role === r;
                  const isSelfAdmin = form.id === currentProfile?.id && currentProfile?.role === "admin";
                  const disabled = isSelfAdmin && r !== "admin";
                  return (
                    <div key={r} onClick={() => !disabled && setForm(f => ({ ...f, role: r }))}
                      style={{ padding: "12px 14px", borderRadius: 10, border: `2px solid ${isSelected ? roleObj.color : "#dee2e6"}`,
                        background: isSelected ? roleObj.bg : "#fff", cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.5 : 1, transition: "all 0.15s" }}>
                      <div style={{ fontWeight: 700, color: isSelected ? roleObj.color : "#495057", marginBottom: 2 }}>{roleObj.label}</div>
                      <div style={{ fontSize: 11, color: "#6c757d" }}>{roleObj.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button style={S.btn("ghost")} onClick={() => setModal(null)} disabled={saving}>ยกเลิก</button>
            <button style={S.btn("primary")} onClick={handleSave} disabled={saving}>
              {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึก"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── AUTH PAGE ────────────────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [mode] = useState("login"); // login only
  const [form, setForm] = useState({ email: "", password: "", name: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (resetMode) {
      if (!form.email) return setError("กรุณากรอกอีเมล");
      setLoading(true);
      const { error: err } = await sb.auth.resetPassword(form.email);
      setLoading(false);
      return err ? setError(errMsg(err)) : setSuccess("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว");
    }
    if (!form.email || !form.password) return setError("กรุณากรอกอีเมลและรหัสผ่าน");
    setLoading(true);
    const { data, error: err } = await sb.auth.signIn({ email: form.email, password: form.password });
    setLoading(false);
    err ? setError(errMsg(err)) : onLogin(data);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: 1, background: "#0F6E56", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 56px" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 12 }}>ระบบบริหารธุรกิจ<br />ครบวงจร</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.8, maxWidth: 300 }}>ใบเสนอราคา · ใบแจ้งหนี้ · ใบเสร็จ<br />Master Data · AI Chatbot · Export</p>

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          {["📄 Document Engine พร้อม Auto-fill", "💱 รองรับ USD / THB", "🤖 AI Chatbot วิเคราะห์ข้อมูล", "📦 Export JSON & XLSX"].map(t => (
            <div key={t} style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{ width: 460, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 52px", background: "#fff" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, color: "#1a1a1a" }}>{resetMode ? "รีเซ็ตรหัสผ่าน" : "เข้าสู่ระบบ"}</h2>
        <p style={{ fontSize: 13, color: "#6c757d", marginBottom: 16 }}>สำหรับทีมงานภายในองค์กรเท่านั้น</p>
        {!resetMode && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
            🔐 ระบบนี้เปิดใช้งานเฉพาะบัญชีที่ได้รับคำเชิญจาก Admin เท่านั้น<br />
            หากยังไม่มีบัญชี กรุณาติดต่อผู้ดูแลระบบขององค์กร
          </div>
        )}
        <Alert type="error" msg={error} />
        <Alert type="success" msg={success} />
        <form onSubmit={handleSubmit}>

          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>อีเมล</label>
            <input type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" style={S.input} />
          </div>
          {!resetMode && (
            <div style={{ marginBottom: 6 }}>
              <label style={S.label}>รหัสผ่าน</label>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="••••••••" style={{ ...S.input, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#adb5bd" }}>{showPass ? "🙈" : "👁"}</button>
              </div>
            </div>
          )}

          {mode === "login" && (
            <div style={{ textAlign: "right", marginBottom: 18 }}>
              <button type="button" onClick={() => { setResetMode(!resetMode); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", fontSize: 12, color: "#0F6E56", cursor: "pointer" }}>{resetMode ? "← กลับ" : "ลืมรหัสผ่าน?"}</button>
            </div>
          )}
          <button type="submit" disabled={loading} style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "11px 0", fontSize: 14, marginTop: 8 }}>
            {loading ? "กำลังดำเนินการ..." : resetMode ? "ส่งลิงก์รีเซ็ต" : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardHome({ userName: name = "ผู้ใช้งาน" }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "อรุณสวัสดิ์" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";

  const [stats, setStats] = useState(null);
  const [recentDocs, setRecentDocs] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Summary stats
        const sRes = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_summary?select=*`, {
          headers: sb.h()
        });
        const sData = await sRes.json();
        if (Array.isArray(sData) && sData.length > 0) setStats(sData[0]);

        // Recent documents (last 5 each)
        const [qts, invs, recs] = await Promise.all([
          sb.db.list("quotations"),
          sb.db.list("invoices"),
          sb.db.list("receipts"),
        ]);
        const allDocs = [
          ...(qts || []).slice(0, 3).map(d => ({ ...d, _type: "quotation" })),
          ...(invs || []).slice(0, 3).map(d => ({ ...d, _type: "invoice" })),
          ...(recs || []).slice(0, 3).map(d => ({ ...d, _type: "receipt" })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
        setRecentDocs(allDocs);

        // Pending invoices
        const pendRes = await fetch(`${SUPABASE_URL}/rest/v1/invoices?status=in.(draft,sent,partial)&order=created_at.desc&select=*&limit=5`, {
          headers: sb.h()
        });
        const pendData = await pendRes.json();
        if (Array.isArray(pendData)) setPendingInvoices(pendData);

        // Monthly invoice totals (last 6 months)
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const label = d.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
          const monthInvs = (invs || []).filter(inv => inv.doc_date?.startsWith(`${y}-${m}`));
          const monthRecs = (recs || []).filter(r => r.doc_date?.startsWith(`${y}-${m}`));
          months.push({
            label,
            invoiceTotal: monthInvs.reduce((s, inv) => s + (parseFloat(inv.total) || 0), 0),
            receiptTotal: monthRecs.reduce((s, r) => s + (parseFloat(r.total) || 0), 0),
          });
        }
        setMonthlyData(months);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { label: "ใบเสนอราคาทั้งหมด", value: stats?.total_quotations || 0, sub: `อนุมัติแล้ว ${stats?.approved_quotations || 0}`, icon: "📄", color: "#0F6E56", bg: "#d1fae5" },
    { label: "ใบแจ้งหนี้ทั้งหมด", value: stats?.total_invoices || 0, sub: `ออกใบเสร็จครบ ${stats?.paid_invoices || 0}`, icon: "🧾", color: "#1e40af", bg: "#dbeafe" },
    { label: "ใบเสร็จรับเงิน", value: stats?.total_receipts || 0, sub: `฿${fmt(stats?.total_receipt_amount || 0)}`, icon: "✅", color: "#065f46", bg: "#ecfdf5" },
    { label: "ลูกค้าทั้งหมด", value: stats?.total_customers || 0, sub: "ใน Master Data", icon: "👥", color: "#6b21a8", bg: "#f3e8ff" },
  ];

  const docTypeStyle = {
    quotation: { label: "QT", color: "#0F6E56", bg: "#d1fae5" },
    invoice: { label: "INV", color: "#1e40af", bg: "#dbeafe" },
    receipt: { label: "REC", color: "#065f46", bg: "#ecfdf5" },
  };

  const statusStyle = {
    draft: { label: "ร่าง", color: "#6c757d" },
    sent: { label: "ส่งแล้ว", color: "#1e40af" },
    approved: { label: "อนุมัติ", color: "#065f46" },
    paid: { label: "ออกใบเสร็จครบ", color: "#065f46" },
    partial: { label: "ออกใบเสร็จบางส่วน", color: "#d97706" },
    cancelled: { label: "ยกเลิก", color: "#dc3545" },
  };

  // Simple bar chart using divs
  const maxVal = Math.max(...monthlyData.map(m => Math.max(m.invoiceTotal, m.receiptTotal)), 1);

  return (
    <div>
      <h1 style={S.pageTitle}>{greet}, {name} 👋</h1>
      <p style={S.pageSub}>ภาพรวมธุรกิจของคุณวันนี้</p>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, background: s.bg, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{loading ? "..." : s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#343a40", marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 1 }}>{loading ? "" : s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Monthly Chart */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#343a40" }}>ยอดเงิน 6 เดือนย้อนหลัง</h3>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#6c757d" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#1e40af", display: "inline-block" }} />Invoice</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#6c757d" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#065f46", display: "inline-block" }} />Receipt</span>
            </div>
          </div>
          {loading ? <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>กำลังโหลด...</div> : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, paddingBottom: 28, position: "relative" }}>
              {monthlyData.map((m, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: "calc(100% - 20px)" }}>
                    <div style={{ flex: 1, background: "#1e40af", borderRadius: "3px 3px 0 0", height: `${Math.max((m.invoiceTotal / maxVal) * 100, m.invoiceTotal > 0 ? 4 : 0)}%`, minHeight: m.invoiceTotal > 0 ? 3 : 0, transition: "height 0.3s" }} title={`฿${fmt(m.invoiceTotal)}`} />
                    <div style={{ flex: 1, background: "#065f46", borderRadius: "3px 3px 0 0", height: `${Math.max((m.receiptTotal / maxVal) * 100, m.receiptTotal > 0 ? 4 : 0)}%`, minHeight: m.receiptTotal > 0 ? 3 : 0, transition: "height 0.3s" }} title={`฿${fmt(m.receiptTotal)}`} />
                  </div>
                  <div style={{ fontSize: 10, color: "#adb5bd", marginTop: 4, textAlign: "center" }}>{m.label}</div>
                </div>
              ))}
              {monthlyData.every(m => m.invoiceTotal === 0 && m.receiptTotal === 0) && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#adb5bd", fontSize: 13 }}>ยังไม่มีข้อมูล</div>
              )}
            </div>
          )}
        </div>

        {/* Pending Invoices */}
        <div style={S.card}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#343a40" }}>Invoice ค้างชำระ</h3>
          {loading ? <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>กำลังโหลด...</div>
            : pendingInvoices.length === 0 ? <EmptyState icon="✅" text="ไม่มี Invoice ค้างชำระ" />
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingInvoices.map(inv => {
                  const st = statusStyle[inv.status] || statusStyle.draft;
                  return (
                    <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f8f9fa", borderRadius: 8, fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 500, color: "#1e40af" }}>{inv.doc_number}</div>
                        <div style={{ fontSize: 11, color: "#6c757d", marginTop: 2 }}>{inv.customer_name}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600, color: "#343a40" }}>฿{fmt(inv.total)}</div>
                        {inv.paid_amount > 0 && <div style={{ fontSize: 11, color: "#065f46" }}>ชำระแล้ว ฿{fmt(inv.paid_amount)}</div>}
                        <div style={{ fontSize: 12, color: "#dc3545", fontWeight: 500 }}>
                          คงเหลือ ฿{fmt((parseFloat(inv.total) || 0) - (parseFloat(inv.paid_amount) || 0))}
                        </div>
                        <div style={{ fontSize: 11, color: st.color, marginTop: 2 }}>{st.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Recent Documents */}
      <div style={S.card}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#343a40" }}>เอกสารล่าสุด</h3>
        {loading ? <div style={{ textAlign: "center", padding: 32, color: "#adb5bd" }}>กำลังโหลด...</div>
          : recentDocs.length === 0 ? <EmptyState icon="📋" text="ยังไม่มีเอกสาร" />
          : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>ประเภท</th>
                  <th style={S.th}>เลขที่</th>
                  <th style={S.th}>ลูกค้า</th>
                  <th style={S.th}>วันที่</th>
                  <th style={{ ...S.th, textAlign: "right" }}>ยอดรวม</th>
                  <th style={S.th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((doc, i) => {
                  const dt = docTypeStyle[doc._type];
                  const st = statusStyle[doc.status] || statusStyle.draft;
                  return (
                    <tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={S.td}><span style={{ ...S.badge("green"), background: dt.bg, color: dt.color }}>{dt.label}</span></td>
                      <td style={S.td}><span style={{ fontWeight: 500, color: dt.color }}>{doc.doc_number}</span></td>
                      <td style={S.td}>{doc.customer_name || "—"}</td>
                      <td style={S.td}>{doc.doc_date ? new Date(doc.doc_date).toLocaleDateString("th-TH") : "—"}</td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: 500 }}>฿{fmt(doc.total)}</td>
                      <td style={S.td}><span style={{ fontSize: 12, color: st.color, fontWeight: 500 }}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      {/* Revenue Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20 }}>
        {[
          { label: "มูลค่าใบเสนอราคารวม", value: stats?.total_quotation_amount, color: "#0F6E56", icon: "📄" },
          { label: "มูลค่าใบแจ้งหนี้รวม", value: stats?.total_invoice_amount, color: "#1e40af", icon: "🧾" },
          { label: "รับชำระแล้วรวม", value: stats?.total_receipt_amount, color: "#065f46", icon: "💰" },
        ].map(s => (
          <div key={s.label} style={{ ...S.card, textAlign: "center", padding: "20px 24px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>฿{loading ? "..." : fmt(s.value || 0)}</div>
            <div style={{ fontSize: 12, color: "#6c757d", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CUSTOMER CONTACTS MODULE ─────────────────────────────────────────────────
// Parse PostgreSQL array format to JS array
const parseDocTypes = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    // Handle "{quotation,invoice}" format
    return val.replace(/^{|}$/g, "").split(",").filter(Boolean);
  }
  return [];
};
function CustomerPage({ onSelectForDoc, readOnly }) {
  const [view, setView] = useState("list"); // "list" | "detail"
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  if (view === "detail" && selectedCustomer) {
    return <CustomerDetail customer={selectedCustomer} readOnly={readOnly} onBack={() => { setView("list"); setSelectedCustomer(null); }} />;
  }

  return <CustomerListPage readOnly={readOnly} onOpenDetail={(c) => { setSelectedCustomer(c); setView("detail"); }} />;
}

function CustomerListPage({ onOpenDetail, readOnly }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deactivateId, setDeactivateId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const searchParam = search ? `&or=(code.ilike.*${search}*,name_th.ilike.*${search}*,name_en.ilike.*${search}*,tax_id.ilike.*${search}*)` : "";
    const activeParam = showInactive ? "" : "&is_active=neq.false";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=*&order=created_at.desc${activeParam}${searchParam}`, {
      headers: sb.h(token)
    });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search, showInactive]);

  useEffect(() => { load(); }, [load]);

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name_th) { setError("กรุณากรอกรหัสและชื่อลูกค้า"); return; }
    setSaving(true); setError("");
    const payload = { ...form };
    delete payload.id;
    const { error: err } = modal.mode === "add"
      ? await sb.db.insert("customers", payload)
      : await sb.db.update("customers", form.id, payload);
    setSaving(false);
    if (err) { setError(err.message || JSON.stringify(err)); return; }
    setModal(null); load();
  };

  const handleDeactivate = async (id, activate = false) => {
    await sb.db.update("customers", id, { is_active: activate });
    setDeactivateId(null); load();
  };
  const { sorted: sortedRows, Th: SortTh } = useSortable(rows, "code", "asc");

  return (
    <div>
      <h1 style={S.pageTitle}>👥 ลูกค้า</h1>
      <p style={S.pageSub}>จัดการข้อมูลลูกค้าและผู้ติดต่อ</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาลูกค้า..." />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6c757d", cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ accentColor: "#0F6E56" }} />
            แสดงที่ปิดใช้งาน
          </label>
        </div>
        {!readOnly && <button style={S.btn("primary")} onClick={() => {
          const codes = rows.map(r => r.code || "").filter(c => /^C\d+$/.test(c));
          const maxNum = codes.length > 0 ? Math.max(...codes.map(c => parseInt(c.slice(1)) || 0)) : 0;
          const nextCode = `C${String(maxNum + 1).padStart(4, "0")}`;
          setForm({ code: nextCode }); setError(""); setModal({ mode: "add" });
        }}>+ เพิ่มลูกค้า</button>}
      </div>
      <div style={S.card}>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>กำลังโหลด...</div>
          : rows.length === 0 ? <EmptyState icon="👥" text="ยังไม่มีข้อมูลลูกค้า" />
          : (
            <table style={S.table}>
              <thead>
                <tr>
                  <SortTh k="code">รหัส</SortTh>
                  <SortTh k="name_th">ชื่อลูกค้า</SortTh>
                  <SortTh k="tax_id">เลขภาษี</SortTh>
                  <SortTh k="branch">สาขา</SortTh>
                  <SortTh k="credit_days">เครดิต</SortTh>
                  <th style={S.th}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => (
                  <tr key={row.id} onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={S.td}><span style={{ fontWeight: 500, color: "#0F6E56" }}>{row.code}</span></td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 500 }}>{row.name_th}</div>
                      {row.name_en && <div style={{ fontSize: 11, color: "#adb5bd" }}>{row.name_en}</div>}
                    </td>
                    <td style={S.td}>{row.tax_id || <span style={{ color: "#dee2e6" }}>—</span>}</td>
                    <td style={S.td}>{row.branch || <span style={{ color: "#dee2e6" }}>—</span>}</td>
                    <td style={S.td}>{row.credit_days ? `${row.credit_days} วัน` : <span style={{ color: "#dee2e6" }}>—</span>}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {row.is_active === false && <span style={{ fontSize: 10, fontWeight: 700, color: "#dc3545", background: "#fee2e2", borderRadius: 4, padding: "2px 6px" }}>ปิดใช้งาน</span>}
                        <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12 }} onClick={() => onOpenDetail(row)}>📋 รายละเอียด</button>
                        {!readOnly && <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12 }} onClick={() => { setForm({ ...row }); setError(""); setModal({ mode: "edit" }); }}>✏️</button>}
                        {!readOnly && (row.is_active === false
                          ? <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12, color: "#065f46" }} onClick={() => handleDeactivate(row.id, true)}>✅ เปิดใช้งาน</button>
                          : <button style={{ ...S.btn("danger"), padding: "5px 10px", fontSize: 12 }} onClick={() => setDeactivateId(row.id)}>🚫 ปิดใช้งาน</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {modal && (
        <Modal title={modal.mode === "add" ? "เพิ่มลูกค้า" : "แก้ไขลูกค้า"} onClose={() => setModal(null)}>
          <Alert type="error" msg={error} />
          <div style={{ background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#065f46" }}>
            💡 หลังบันทึกแล้ว กด <strong>📋 รายละเอียด</strong> เพื่อเพิ่มผู้ติดต่อของลูกค้ารายนี้
          </div>
          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {CUSTOMER_FIELDS.map(f => (
                <div key={f.key} style={{ gridColumn: f.fullWidth ? "1 / -1" : "auto" }}>
                  <label style={S.label}>{f.label}{f.required && <span style={{ color: "#dc3545" }}>*</span>}</label>
                  {f.type === "textarea" ? (
                    <textarea value={form[f.key] || ""} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} rows={3} style={{ ...S.input, resize: "vertical" }} placeholder={f.placeholder} />
                  ) : f.type === "select" ? (
                    <select value={form[f.key] || ""} onChange={setF(f.key)} style={S.input}>
                      <option value="">เลือก...</option>
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input type={f.type || "text"} value={form[f.key] || ""} onChange={setF(f.key)} placeholder={f.placeholder || ""} style={S.input} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button type="button" style={S.btn("ghost")} onClick={() => setModal(null)}>ยกเลิก</button>
              <button type="submit" style={S.btn("primary")} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deactivateId && (
        <Modal title="ยืนยันการปิดใช้งาน" onClose={() => setDeactivateId(null)}>
          <p style={{ fontSize: 14, color: "#495057", marginBottom: 8 }}>ต้องการปิดใช้งานลูกค้านี้?</p>
          <p style={{ fontSize: 13, color: "#6c757d", marginBottom: 20 }}>ลูกค้าจะไม่แสดงในรายการปกติ แต่เอกสารเก่ายังคงอยู่ครบถ้วน สามารถเปิดใช้งานคืนได้ทุกเมื่อ</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button style={S.btn("ghost")} onClick={() => setDeactivateId(null)}>ยกเลิก</button>
            <button style={S.btn("danger")} onClick={() => handleDeactivate(deactivateId, false)}>ปิดใช้งาน</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CustomerDetail({ customer, onBack }) {
  const [tab, setTab] = useState("info");
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactModal, setContactModal] = useState(null);
  const [contactForm, setContactForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [contactSearch, setContactSearch] = useState("");
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [globalContactSearch, setGlobalContactSearch] = useState("");
  const [globalContacts, setGlobalContacts] = useState([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customer_contacts?customer_id=eq.${customer.id}&order=is_primary.desc,created_at.asc&select=*`, {
      headers: sb.h()
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      // Parse doc_types from PostgreSQL array format "{quotation,invoice}" to JS array
      setContacts(data.map(c => ({
        ...c,
        doc_types: parseDocTypes(c.doc_types)
      })));
    }
    setLoadingContacts(false);
  }, [customer.id]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const setF = (k) => (e) => setContactForm(f => ({ ...f, [k]: e.target.value }));

  const searchGlobalContacts = async (q) => {
    if (!q || q.length < 2) { setGlobalContacts([]); return; }
    setSearchingGlobal(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customer_contacts?name=ilike.*${q}*&select=*,customers(name_th,code)&limit=10`, {
      headers: sb.h()
    });
    const data = await res.json();
    if (Array.isArray(data)) setGlobalContacts(data.map(c => ({ ...c, doc_types: parseDocTypes(c.doc_types) })));
    setSearchingGlobal(false);
  };

  const importContact = (c) => {
    setContactForm({
      name: c.name,
      position: c.position || "",
      phone: c.phone || "",
      email: c.email || "",
      line_id: c.line_id || "",
      note: c.note || "",
      doc_types: c.doc_types || [],
      is_primary: contacts.length === 0,
    });
    setShowContactSearch(false);
    setGlobalContactSearch("");
    setGlobalContacts([]);
    setContactModal({ mode: "add" });
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!contactForm.name) { setError("กรุณากรอกชื่อ"); return; }

    // Check for duplicate - same name AND (same phone or same email)
    if (contactModal.mode === "add") {
      const dupName = contactForm.name.trim().toLowerCase();
      const dupPhone = contactForm.phone?.trim();
      const dupEmail = contactForm.email?.trim().toLowerCase();
      const isDuplicate = contacts.some(c => {
        const sameName = c.name?.trim().toLowerCase() === dupName;
        if (!sameName) return false;
        // Same name + same phone (if both have phone)
        if (dupPhone && c.phone?.trim() && c.phone.trim() === dupPhone) return true;
        // Same name + same email (if both have email)
        if (dupEmail && c.email?.trim().toLowerCase() && c.email.trim().toLowerCase() === dupEmail) return true;
        return false;
      });
      if (isDuplicate) {
        setError(`พบข้อมูลซ้ำ — ชื่อ "${contactForm.name}" และเบอร์/อีเมลเดียวกันมีอยู่แล้วในบริษัทนี้`);
        return;
      }
    }

    setSaving(true); setError("");
    const payload = { ...contactForm, customer_id: customer.id, doc_types: contactForm.doc_types || [] };
    delete payload.id;

    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const hdrs = sb.h(token, { Prefer: "return=representation" });

    // If set as primary, unset all others first
    if (contactForm.is_primary) {
      const others = contacts.filter(c => c.id !== contactForm.id && c.is_primary);
      for (const c of others) {
        await fetch(`${SUPABASE_URL}/rest/v1/customer_contacts?id=eq.${c.id}`, {
          method: "PATCH", headers: hdrs, body: JSON.stringify({ is_primary: false })
        });
      }
    }

    if (contactModal.mode === "add") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/customer_contacts`, {
        method: "POST", headers: hdrs, body: JSON.stringify(payload)
      });
      if (!res.ok) { const e = await res.json(); setSaving(false); setError(e.message || JSON.stringify(e)); return; }
    } else {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/customer_contacts?id=eq.${contactForm.id}`, {
        method: "PATCH", headers: hdrs, body: JSON.stringify(payload)
      });
      if (!res.ok) { const e = await res.json(); setSaving(false); setError(e.message || JSON.stringify(e)); return; }
    }

    setSaving(false); setContactModal(null); loadContacts();
  };

  const handleDeleteContact = async () => {
    await sb.db.delete("customer_contacts", deleteId);
    setDeleteId(null); loadContacts();
  };

  const setPrimary = async (contactId) => {
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const headers = sb.h(token, { Prefer: "return=representation" });
    // Unset all first
    const others = contacts.filter(c => c.id !== contactId && c.is_primary);
    for (const c of others) {
      await fetch(`${SUPABASE_URL}/rest/v1/customer_contacts?id=eq.${c.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ is_primary: false })
      });
    }
    // Set the chosen one
    await fetch(`${SUPABASE_URL}/rest/v1/customer_contacts?id=eq.${contactId}`, {
      method: "PATCH", headers, body: JSON.stringify({ is_primary: true })
    });
    loadContacts();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button style={S.btn("ghost")} onClick={onBack}>← กลับ</button>
        <div>
          <h1 style={{ ...S.pageTitle, margin: 0 }}>👥 {customer.name_th}</h1>
          <div style={{ fontSize: 12, color: "#adb5bd" }}>{customer.code}{customer.branch ? ` · ${customer.branch}` : ""}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#f8f9fa", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {[{ key: "info", label: "📋 ข้อมูลทั่วไป" }, { key: "contacts", label: `👤 คนติดต่อ (${contacts.length})` }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: tab === t.key ? "#fff" : "transparent",
              color: tab === t.key ? "#1a1a1a" : "#adb5bd",
              boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 14 }}>ข้อมูลบริษัท</div>
            {[
              ["รหัสลูกค้า", customer.code],
              ["ชื่อ (ไทย)", customer.name_th],
              ["ชื่อ (อังกฤษ)", customer.name_en],
              ["เลขประจำตัวผู้เสียภาษี", customer.tax_id],
              ["สาขา", customer.branch],
              ["เครดิต", customer.credit_days ? `${customer.credit_days} วัน` : "—"],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #f1f3f5", fontSize: 13 }}>
                <span style={{ color: "#6c757d", minWidth: 160 }}>{label}</span>
                <span style={{ color: "#343a40", fontWeight: val ? 500 : 400 }}>{val || <span style={{ color: "#dee2e6" }}>—</span>}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 14 }}>ที่อยู่</div>
              <p style={{ fontSize: 13, color: "#495057", lineHeight: 1.7, margin: 0 }}>{customer.address || <span style={{ color: "#dee2e6" }}>—</span>}</p>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 14 }}>การวางบิล</div>
              {[
                ["วิธีวางบิล", customer.billing_method],
                ["หมายเหตุ", customer.billing_note],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #f1f3f5", fontSize: 13 }}>
                  <span style={{ color: "#6c757d", minWidth: 100 }}>{label}</span>
                  <span style={{ color: "#343a40" }}>{val || <span style={{ color: "#dee2e6" }}>—</span>}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SearchBar value={contactSearch} onChange={setContactSearch} placeholder="ค้นหาชื่อ ตำแหน่ง เบอร์..." />
            <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
              <button style={S.btn("ghost")} onClick={() => { setShowContactSearch(true); setGlobalContactSearch(""); setGlobalContacts([]); }}>
                🔍 ค้นหาจากระบบ
              </button>
              <button style={S.btn("primary")} onClick={() => { setContactForm({ is_primary: contacts.length === 0, doc_types: [] }); setError(""); setContactModal({ mode: "add" }); }}>
                + เพิ่มใหม่
              </button>
            </div>
          </div>

          {loadingContacts ? <div style={{ textAlign: "center", padding: 32, color: "#adb5bd" }}>กำลังโหลด...</div>
            : contacts.length === 0 ? <EmptyState icon="👤" text="ยังไม่มีผู้ติดต่อ" />
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {contacts.filter(c => !contactSearch || c.name?.includes(contactSearch) || c.position?.includes(contactSearch) || c.phone?.includes(contactSearch) || c.email?.includes(contactSearch)).map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: c.is_primary ? "#f0fff4" : "#f8f9fa", borderRadius: 10, border: c.is_primary ? "1px solid #9ae6b4" : "1px solid transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: c.is_primary ? "#0F6E56" : "#dee2e6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", flexShrink: 0 }}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{c.name}</span>
                          {c.is_primary && <span style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", background: "#d1fae5", borderRadius: 4, padding: "1px 6px" }}>PRIMARY</span>}
                          {(c.doc_types || []).map(dt => (
                            <span key={dt} style={{ fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "1px 6px",
                              background: dt === "quotation" ? "#d1fae5" : dt === "invoice" ? "#dbeafe" : "#ecfdf5",
                              color: dt === "quotation" ? "#0F6E56" : dt === "invoice" ? "#1e40af" : "#065f46" }}>
                              {dt === "quotation" ? "📄 QT" : dt === "invoice" ? "🧾 INV" : "✅ REC"}
                            </span>
                          ))}
                        </div>
                        {c.position && <div style={{ fontSize: 12, color: "#6c757d" }}>{c.position}</div>}
                        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "#6c757d" }}>
                          {c.phone && <span>📞 {c.phone}</span>}
                          {c.email && <span>✉️ {c.email}</span>}
                          {c.line_id && <span>💬 {c.line_id}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {!c.is_primary && (
                        <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 11 }} onClick={() => setPrimary(c.id)}>⭐ ตั้งเป็น Primary</button>
                      )}
                      <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12 }} onClick={() => { setContactForm({ ...c, is_primary: c.is_primary }); setError(""); setContactModal({ mode: "edit" }); }}>✏️</button>
                      <button style={{ ...S.btn("danger"), padding: "5px 10px", fontSize: 12 }} onClick={() => setDeleteId(c.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Global Contact Search Modal */}
      {showContactSearch && (
        <Modal title="🔍 ค้นหาผู้ติดต่อจากระบบ" onClose={() => setShowContactSearch(false)}>
          <p style={{ fontSize: 13, color: "#6c757d", marginBottom: 12 }}>ค้นหาจากผู้ติดต่อทั้งหมดในระบบ — เลือกแล้วจะนำข้อมูลมากรอกให้อัตโนมัติ</p>
          <input
            value={globalContactSearch}
            onChange={e => { setGlobalContactSearch(e.target.value); searchGlobalContacts(e.target.value); }}
            placeholder="พิมพ์ชื่อที่ต้องการค้นหา..."
            style={{ ...S.input, marginBottom: 12 }}
            autoFocus
          />
          {searchingGlobal && <div style={{ textAlign: "center", padding: 16, color: "#adb5bd", fontSize: 13 }}>กำลังค้นหา...</div>}
          {globalContacts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {globalContacts.map(c => (
                <div key={c.id} onClick={() => importContact(c)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f8f9fa", borderRadius: 10, cursor: "pointer", border: "1px solid #dee2e6" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0fff4"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f8f9fa"}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                    {c.position && <div style={{ fontSize: 12, color: "#6c757d" }}>{c.position}</div>}
                    <div style={{ fontSize: 12, color: "#adb5bd", marginTop: 2 }}>
                      {c.customers?.name_th && `📍 ${c.customers.name_th} (${c.customers.code})`}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      {c.phone && <span style={{ fontSize: 11, color: "#495057" }}>📞 {c.phone}</span>}
                      {c.email && <span style={{ fontSize: 11, color: "#495057" }}>✉️ {c.email}</span>}
                    </div>
                  </div>
                  <button style={{ ...S.btn("primary"), padding: "5px 14px", fontSize: 12, flexShrink: 0 }}>เลือก</button>
                </div>
              ))}
            </div>
          )}
          {globalContactSearch.length >= 2 && !searchingGlobal && globalContacts.length === 0 && (
            <div style={{ textAlign: "center", padding: 24, color: "#adb5bd", fontSize: 13 }}>ไม่พบผู้ติดต่อที่ค้นหา</div>
          )}
        </Modal>
      )}

      {/* Contact Modal */}
      {contactModal && (
        <Modal title={contactModal.mode === "add" ? "เพิ่มผู้ติดต่อ" : "แก้ไขผู้ติดต่อ"} onClose={() => setContactModal(null)}>
          <Alert type="error" msg={error} />
          <form onSubmit={handleSaveContact}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={S.label}>ชื่อ-นามสกุล<span style={{ color: "#dc3545" }}>*</span></label>
                <input value={contactForm.name || ""} onChange={setF("name")} placeholder="คุณสมชาย ใจดี" style={S.input} />
              </div>
              <div>
                <label style={S.label}>ตำแหน่ง</label>
                <input value={contactForm.position || ""} onChange={setF("position")} placeholder="ผู้จัดการฝ่ายจัดซื้อ" style={S.input} />
              </div>
              <div>
                <label style={S.label}>โทรศัพท์</label>
                <input value={contactForm.phone || ""} onChange={setF("phone")} placeholder="081-000-0000" style={S.input} />
              </div>
              <div>
                <label style={S.label}>อีเมล</label>
                <input type="email" value={contactForm.email || ""} onChange={setF("email")} placeholder="contact@company.com" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Line ID</label>
                <input value={contactForm.line_id || ""} onChange={setF("line_id")} placeholder="@lineid" style={S.input} />
              </div>
              <div>
                <label style={S.label}>หมายเหตุ</label>
                <input value={contactForm.note || ""} onChange={setF("note")} placeholder="ติดต่อวันทำการเท่านั้น" style={S.input} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={S.label}>แสดงในเอกสาร</label>
                <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                  {[
                    { key: "quotation", label: "📄 ใบเสนอราคา" },
                    { key: "invoice", label: "🧾 ใบแจ้งหนี้" },
                    { key: "receipt", label: "✅ ใบเสร็จ" },
                  ].map(dt => {
                    const checked = (contactForm.doc_types || []).includes(dt.key);
                    return (
                      <label key={dt.key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13,
                        padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${checked ? "#0F6E56" : "#dee2e6"}`,
                        background: checked ? "#f0fff4" : "#fff", color: checked ? "#0F6E56" : "#495057" }}>
                        <input type="checkbox" checked={checked}
                          onChange={e => {
                            const cur = contactForm.doc_types || [];
                            setContactForm(f => ({ ...f, doc_types: e.target.checked ? [...cur, dt.key] : cur.filter(k => k !== dt.key) }));
                          }}
                          style={{ accentColor: "#0F6E56" }} />
                        {dt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={contactForm.is_primary || false}
                    onChange={e => setContactForm(f => ({ ...f, is_primary: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: "#0F6E56" }} />
                  <span style={{ color: "#495057" }}>ตั้งเป็นผู้ติดต่อหลัก (Primary)</span>
                </label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button type="button" style={S.btn("ghost")} onClick={() => setContactModal(null)}>ยกเลิก</button>
              <button type="submit" style={S.btn("primary")} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <Modal title="ยืนยันการลบ" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 14, color: "#495057", marginBottom: 20 }}>ต้องการลบผู้ติดต่อนี้ใช่หรือไม่?</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button style={S.btn("ghost")} onClick={() => setDeleteId(null)}>ยกเลิก</button>
            <button style={S.btn("danger")} onClick={handleDeleteContact}>ลบ</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── CONTACT PICKER (for QT/Invoice/Receipt forms) ────────────────────────────
function ContactPicker({ customerId, customerName, value, onChange, onSaveNew, docType }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", position: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    fetch(`${SUPABASE_URL}/rest/v1/customer_contacts?customer_id=eq.${customerId}&order=is_primary.desc,name.asc&select=*`, {
      headers: sb.h()
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        const parsed = data.map(c => ({ ...c, doc_types: parseDocTypes(c.doc_types) }));
        setContacts(parsed);
        // Auto-select only if nothing selected yet
        // Prefer: contact that matches docType + is primary, then docType match, then primary, then first
        if (!value?.name) {
          const match = parsed.find(c => c.is_primary && docType && (c.doc_types || []).includes(docType))
            || parsed.find(c => docType && (c.doc_types || []).includes(docType))
            || parsed.find(c => c.is_primary);
          if (match) onChange({ id: match.id, name: match.name, phone: match.phone || "", email: match.email || "" });
        }
      }
      setLoading(false);
    });
    // Reset search when customer changes
    setPickerSearch("");
  }, [customerId]);

  const handleSaveNew = async () => {
    if (!newContact.name) return;
    // Check duplicate - same name AND same phone or email
    const dupName = newContact.name.trim().toLowerCase();
    const dupPhone = newContact.phone?.trim();
    const dupEmail = newContact.email?.trim().toLowerCase();
    const isDuplicate = contacts.some(c => {
      const sameName = c.name?.trim().toLowerCase() === dupName;
      if (!sameName) return false;
      if (dupPhone && c.phone?.trim() && c.phone.trim() === dupPhone) return true;
      if (dupEmail && c.email?.trim().toLowerCase() && c.email.trim().toLowerCase() === dupEmail) return true;
      return false;
    });
    if (isDuplicate) {
      alert(`พบข้อมูลซ้ำ — ชื่อ "${newContact.name}" และเบอร์/อีเมลเดียวกันมีอยู่แล้วในบริษัทนี้`);
      return;
    }
    setSaving(true);
    const shouldBePrimary = contacts.length === 0;
    // If this will be primary, unset others first
    if (shouldBePrimary) {
      for (const c of contacts) {
        if (c.is_primary) await sb.db.update("customer_contacts", c.id, { is_primary: false });
      }
    }
    const payload = { ...newContact, customer_id: customerId, is_primary: shouldBePrimary, doc_types: newContact.doc_types || [] };
    const { data, error } = await sb.db.insert("customer_contacts", payload);
    if (!error) {
      const saved = data?.[0];
      setContacts(prev => [...prev, saved || { ...payload, id: Date.now() }]);
      onChange({ id: saved?.id || null, name: newContact.name, phone: newContact.phone || "", email: newContact.email || "" });
      setShowAdd(false);
      setNewContact({ name: "", position: "", phone: "", email: "" });
      if (onSaveNew) onSaveNew();
    }
    setSaving(false);
  };

  const setNF = (k) => (e) => setNewContact(f => ({ ...f, [k]: e.target.value }));

  if (!customerId) return null;

  return (
    <div style={{ gridColumn: "1 / -1", background: "#f8f9fa", borderRadius: 10, padding: "14px 16px", border: "1px solid #dee2e6" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#495057", marginBottom: 10 }}>👤 ผู้ติดต่อลูกค้า</div>

      {loading ? <div style={{ fontSize: 12, color: "#adb5bd" }}>กำลังโหลด...</div> : (
        <>
          {contacts.length > 0 && (
            <div style={{ marginBottom: showAdd ? 12 : 0 }}>
              {contacts.length > 3 && (
                <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                  placeholder="ค้นหาชื่อหรือตำแหน่ง..." style={{ ...S.input, marginBottom: 10, fontSize: 12, padding: "7px 12px" }} />
              )}
              {(() => {
                const filtered = contacts.filter(c => !pickerSearch || c.name?.includes(pickerSearch) || c.position?.includes(pickerSearch));
                const matched = filtered.filter(c => !docType || (c.doc_types || []).includes(docType));
                const unmatched = docType ? filtered.filter(c => !(c.doc_types || []).includes(docType)) : [];

                const ContactCard = (c) => {
                  const selected = value?.id === c.id || (!value?.id && value?.name === c.name);
                  return (
                    <div key={c.id} onClick={() => onChange({ id: c.id, name: c.name, phone: c.phone || "", email: c.email || "" })}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8,
                        border: `1.5px solid ${selected ? "#0F6E56" : "#dee2e6"}`,
                        background: selected ? "#f0fff4" : "#fff", cursor: "pointer", fontSize: 13, transition: "all 0.15s" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: selected ? "#0F6E56" : "#e9ecef",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                        color: selected ? "#fff" : "#6c757d", fontWeight: 600, flexShrink: 0 }}>
                        {c.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 500, color: selected ? "#0F6E56" : "#343a40" }}>{c.name}</span>
                          {c.is_primary && <span style={{ fontSize: 9, background: "#d1fae5", color: "#0F6E56", borderRadius: 3, padding: "1px 4px", fontWeight: 700 }}>PRIMARY</span>}
                        </div>
                        {c.position && <div style={{ fontSize: 11, color: "#adb5bd" }}>{c.position}</div>}
                        {c.phone && <div style={{ fontSize: 11, color: "#6c757d" }}>📞 {c.phone}</div>}
                      </div>
                      {selected && <span style={{ color: "#0F6E56", fontSize: 16 }}>✓</span>}
                    </div>
                  );
                };

                return (
                  <>
                    {matched.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: unmatched.length > 0 ? 10 : 0 }}>
                        {matched.map(c => ContactCard(c))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#adb5bd", padding: "6px 0", marginBottom: 8 }}>
                        ยังไม่มีผู้ติดต่อที่กำหนดสำหรับเอกสารนี้ — กรุณาตั้งค่าใน Customer Master
                      </div>
                    )}
                    {unmatched.length > 0 && (
                      <details>
                        <summary style={{ fontSize: 12, color: "#adb5bd", cursor: "pointer", userSelect: "none", listStyle: "none", padding: "4px 0" }}>
                          ▸ ดูผู้ติดต่ออื่น ({unmatched.length} คน ที่ไม่ได้กำหนดสำหรับเอกสารนี้)
                        </summary>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, opacity: 0.7 }}>
                          {unmatched.map(c => ContactCard(c))}
                        </div>
                      </details>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {!showAdd ? (
            <button type="button" onClick={() => setShowAdd(true)}
              style={{ marginTop: contacts.length > 0 ? 10 : 0, padding: "6px 14px", borderRadius: 8, border: "1px dashed #0F6E56", background: "transparent", color: "#0F6E56", fontSize: 12, cursor: "pointer" }}>
              + เพิ่มผู้ติดต่อใหม่ {customerId ? `(บันทึกใน ${customerName || "ลูกค้า"})` : ""}
            </button>
          ) : (
            <div style={{ background: "#fff", borderRadius: 8, padding: "14px 16px", border: "1px solid #dee2e6", marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#495057", marginBottom: 10 }}>เพิ่มผู้ติดต่อใหม่ (จะบันทึกเข้าระบบด้วย)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ ...S.label, fontSize: 11 }}>ชื่อ-นามสกุล*</label>
                  <input value={newContact.name} onChange={setNF("name")} placeholder="คุณสมชาย" style={{ ...S.input, padding: "7px 10px", fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ ...S.label, fontSize: 11 }}>ตำแหน่ง</label>
                  <input value={newContact.position} onChange={setNF("position")} placeholder="ผู้จัดการ" style={{ ...S.input, padding: "7px 10px", fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ ...S.label, fontSize: 11 }}>โทรศัพท์</label>
                  <input value={newContact.phone} onChange={setNF("phone")} placeholder="081-000-0000" style={{ ...S.input, padding: "7px 10px", fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ ...S.label, fontSize: 11 }}>อีเมล</label>
                  <input value={newContact.email} onChange={setNF("email")} placeholder="email@co.th" style={{ ...S.input, padding: "7px 10px", fontSize: 12 }} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ ...S.label, fontSize: 11 }}>แสดงในเอกสาร</label>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {[{ key: "quotation", label: "📄 QT" }, { key: "invoice", label: "🧾 INV" }, { key: "receipt", label: "✅ REC" }].map(dt => {
                      const checked = (newContact.doc_types || []).includes(dt.key);
                      return (
                        <label key={dt.key} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12,
                          padding: "4px 10px", borderRadius: 6, border: `1px solid ${checked ? "#0F6E56" : "#dee2e6"}`,
                          background: checked ? "#f0fff4" : "#fff", color: checked ? "#0F6E56" : "#6c757d" }}>
                          <input type="checkbox" checked={checked}
                            onChange={e => {
                              const cur = newContact.doc_types || [];
                              setNewContact(f => ({ ...f, doc_types: e.target.checked ? [...cur, dt.key] : cur.filter(k => k !== dt.key) }));
                            }}
                            style={{ accentColor: "#0F6E56" }} />
                          {dt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleSaveNew} disabled={!newContact.name || saving}
                  style={{ ...S.btn("primary"), padding: "6px 16px", fontSize: 12 }}>{saving ? "กำลังบันทึก..." : "💾 บันทึกและเลือก"}</button>
                <button type="button" onClick={() => setShowAdd(false)} style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 12 }}>ยกเลิก</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SEARCHABLE CUSTOMER SELECT ───────────────────────────────────────────────
function SearchableCustomerSelect({ value, onChange, customers, onCustomerAdded }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newCust, setNewCust] = useState({ code: "", name_th: "", name_en: "", tax_id: "", address: "", phone: "", email: "", branch: "", credit_days: 30 });
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState("");
  const ref = React.useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-generate next customer code when modal opens
  const openModal = () => {
    const codes = customers.map(c => c.code || "").filter(c => /^C\d+$/.test(c));
    const maxNum = codes.length > 0 ? Math.max(...codes.map(c => parseInt(c.replace("C", "")) || 0)) : 0;
    const nextCode = `C${String(maxNum + 1).padStart(4, "0")}`;
    setNewCust({ code: nextCode, name_th: "", name_en: "", tax_id: "", address: "", phone: "", email: "", branch: "", credit_days: 30 });
    setCodeError("");
    setShowModal(true);
    setOpen(false);
  };

  const filtered = customers.filter(c =>
    c.is_active !== false && (
      !search ||
      c.name_th?.toLowerCase().includes(search.toLowerCase()) ||
      c.name_en?.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase()) ||
      c.tax_id?.includes(search)
    )
  ).slice(0, 50);

  const selected = customers.find(c => c.id === value);

  const validateCode = (code) => {
    if (!code) return "กรุณาระบุรหัสลูกค้า";
    if (customers.some(c => c.code?.toLowerCase() === code.toLowerCase())) return `รหัส "${code}" มีอยู่แล้วในระบบ`;
    return "";
  };

  const handleSaveNew = async () => {
    const err = validateCode(newCust.code);
    if (err) { setCodeError(err); return; }
    if (!newCust.name_th) return;
    setSaving(true);
    const { data, error } = await sb.db.insert("customers", { ...newCust });
    if (!error && data?.[0]) {
      onCustomerAdded?.(data[0]);
      onChange(data[0]);
      setShowModal(false);
    } else if (error) {
      setCodeError(error.message || "บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  };

  const setN = (k) => (e) => {
    const v = e.target.value;
    setNewCust(f => ({ ...f, [k]: v }));
    if (k === "code") setCodeError(validateCode(v));
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <div onClick={() => { setOpen(!open); setSearch(""); }}
        style={{ ...S.input, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "#fff", userSelect: "none" }}>
        <span style={{ color: selected ? "#1a1a1a" : "#adb5bd", fontSize: 13 }}>
          {selected ? `${selected.code} — ${selected.name_th}` : "— เลือกหรือค้นหาลูกค้า —"}
        </span>
        <span style={{ color: "#adb5bd", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "#fff", border: "1px solid #dee2e6", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f3f5" }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="พิมพ์ชื่อ รหัส หรือเลขภาษี..."
              style={{ ...S.input, border: "1px solid #dee2e6", fontSize: 13 }}
              onClick={e => e.stopPropagation()} />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 16px", color: "#adb5bd", fontSize: 13, textAlign: "center" }}>
                ไม่พบลูกค้า "{search}"
              </div>
            ) : (
              filtered.map(c => (
                <div key={c.id} onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                  style={{ padding: "10px 16px", cursor: "pointer", fontSize: 13,
                    background: value === c.id ? "#f0fff4" : "#fff", borderBottom: "1px solid #f8f9fa" }}
                  onMouseEnter={e => e.currentTarget.style.background = value === c.id ? "#f0fff4" : "#f8f9fa"}
                  onMouseLeave={e => e.currentTarget.style.background = value === c.id ? "#f0fff4" : "#fff"}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 500, color: "#0F6E56", marginRight: 8 }}>{c.code}</span>
                      <span style={{ color: "#1a1a1a" }}>{c.name_th}</span>
                      {c.branch && <span style={{ marginLeft: 6, fontSize: 11, color: "#6c757d" }}>({c.branch})</span>}
                    </div>
                    {value === c.id && <span style={{ color: "#0F6E56" }}>✓</span>}
                  </div>
                  {c.tax_id && <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 2 }}>เลขภาษี: {c.tax_id}</div>}
                </div>
              ))
            )}
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid #f1f3f5", background: "#f8f9fa" }}>
            <button onClick={openModal}
              style={{ background: "none", border: "none", color: "#0F6E56", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0 }}>
              ➕ เพิ่มลูกค้าใหม่เข้า Master
            </button>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showModal && (
        <Modal title="➕ เพิ่มลูกค้าใหม่เข้า Master" onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* รหัสลูกค้า */}
            <div>
              <label style={S.label}>รหัสลูกค้า <span style={{ color: "#dc3545" }}>*</span></label>
              <input value={newCust.code} onChange={setN("code")} style={{ ...S.input, borderColor: codeError ? "#dc3545" : undefined, fontFamily: "monospace" }} />
              {codeError
                ? <div style={{ fontSize: 11, color: "#dc3545", marginTop: 3 }}>⚠ {codeError}</div>
                : <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 3 }}>รหัสที่มีอยู่: {customers.length} รายการ</div>
              }
            </div>
            {/* เครดิต */}
            <div>
              <label style={S.label}>เครดิต (วัน)</label>
              <input type="number" value={newCust.credit_days} onChange={setN("credit_days")} style={S.input} min="0" />
            </div>
            {/* ชื่อ TH */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>ชื่อบริษัท (ภาษาไทย) <span style={{ color: "#dc3545" }}>*</span></label>
              <input value={newCust.name_th} onChange={setN("name_th")} placeholder="บริษัท ตัวอย่าง จำกัด" style={S.input} />
            </div>
            {/* ชื่อ EN */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>ชื่อบริษัท (ภาษาอังกฤษ)</label>
              <input value={newCust.name_en} onChange={setN("name_en")} placeholder="Example Co., Ltd." style={S.input} />
            </div>
            {/* เลขภาษี */}
            <div>
              <label style={S.label}>เลขประจำตัวผู้เสียภาษี</label>
              <input value={newCust.tax_id} onChange={setN("tax_id")} placeholder="0-0000-00000-00-0" style={S.input} />
            </div>
            {/* สาขา */}
            <div>
              <label style={S.label}>สาขา</label>
              <input value={newCust.branch} onChange={setN("branch")} placeholder="สำนักงานใหญ่" style={S.input} />
            </div>
            {/* ที่อยู่ */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>ที่อยู่</label>
              <textarea value={newCust.address} onChange={setN("address")} rows={3} placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" style={{ ...S.input, resize: "vertical" }} />
            </div>
            {/* โทรศัพท์ */}
            <div>
              <label style={S.label}>โทรศัพท์</label>
              <input value={newCust.phone} onChange={setN("phone")} placeholder="02-000-0000" style={S.input} />
            </div>
            {/* อีเมล */}
            <div>
              <label style={S.label}>อีเมล</label>
              <input type="email" value={newCust.email} onChange={setN("email")} placeholder="info@company.com" style={S.input} />
            </div>
          </div>
          {/* แสดงจำนวนลูกค้าทั้งหมด — ไม่แสดงรายชื่อรหัสเพราะรกเมื่อมีเยอะ */}
          <div style={{ marginTop: 14, fontSize: 11, color: "#adb5bd", textAlign: "right" }}>
            ลูกค้าในระบบทั้งหมด {customers.length} ราย
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button style={S.btn("ghost")} onClick={() => setShowModal(false)} disabled={saving}>ยกเลิก</button>
            <button style={S.btn("primary")} onClick={handleSaveNew}
              disabled={!newCust.name_th || !!codeError || saving}>
              {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกและเลือกลูกค้านี้"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PRODUCT / SERVICE MASTER PAGE ───────────────────────────────────────────
function ProductServicePage({ type, readOnly }) {
  const isProduct = type === "products";
  const title = isProduct ? "สินค้า" : "บริการ";
  const icon = isProduct ? "📦" : "🔧";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  // Separate states for each field to avoid the undefined issue
  const [fCode, setFCode] = useState("");
  const [fNameTh, setFNameTh] = useState("");
  const [fNameEn, setFNameEn] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fPriceTHB, setFPriceTHB] = useState("");
  const [fPriceUSD, setFPriceUSD] = useState("");
  const [fTags, setFTags] = useState([]);
  const [fTagInput, setFTagInput] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fEditId, setFEditId] = useState(null);
  const [fxRate, setFxRate] = useState(36);
  const [fxUpdated, setFxUpdated] = useState("");
  const [fxLoading, setFxLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await sb.db.list(type, search, ["code", "name_th", "name_en"]);
    setRows(data);
    setLoading(false);
  }, [type, search]);

  useEffect(() => { load(); }, [load]);

  const fetchFxRate = async () => {
    setFxLoading(true);
    try {
      // Try multiple sources for reliability
      let rate = null;
      let dateStr = "";

      // Source 1: Exchange Rate API (no key needed, CORS friendly)
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data?.rates?.THB) {
        rate = parseFloat(data.rates.THB.toFixed(4));
        const d = new Date(data.time_last_update_utc);
        dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
      }

      if (rate) {
        setFxRate(rate);
        setFxUpdated(`อัปเดต: ${dateStr}`);
      } else {
        setFxUpdated("ดึงข้อมูลไม่ได้ ใช้ค่าเดิม");
      }
    } catch (e) {
      setFxUpdated("ดึงข้อมูลไม่ได้ ใช้ค่าเดิม");
    }
    setFxLoading(false);
  };

  const filteredRaw = rows.filter(r => {
    if (filterTag) {
      const rowTags = (r.tags || "").toLowerCase();
      if (!rowTags.includes(filterTag.toLowerCase())) return false;
    }
    if (filterPriceMin && parseFloat(r.price_thb) < parseFloat(filterPriceMin)) return false;
    if (filterPriceMax && parseFloat(r.price_thb) > parseFloat(filterPriceMax)) return false;
    return true;
  });
  const { sorted: filtered, Th: SortTh } = useSortable(filteredRaw, "code", "asc");

  const openAdd = () => {
    // auto-generate next code: P#### for products, S#### for services
    const prefix = isProduct ? "P" : "S";
    const regex = isProduct ? /^P\d+$/ : /^S\d+$/;
    const codes = rows.map(r => r.code || "").filter(c => regex.test(c));
    const maxNum = codes.length > 0 ? Math.max(...codes.map(c => parseInt(c.slice(1)) || 0)) : 0;
    const nextCode = `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
    setFCode(nextCode); setFNameTh(""); setFNameEn(""); setFUnit("");
    setFPriceTHB(""); setFPriceUSD(""); setFTags([]); setFTagInput("");
    setFDescription(""); setFEditId(null); setError("");
    setModal("form");
    fetchFxRate();
  };

  const openEdit = (row) => {
    setFCode(row.code || ""); setFNameTh(row.name_th || "");
    setFNameEn(row.name_en || ""); setFUnit(row.unit || "");
    setFPriceTHB(row.price_thb ?? ""); setFPriceUSD(row.price_usd ?? "");
    setFTags(row.tags ? row.tags.split(",").map(t => t.trim()).filter(Boolean) : []);
    setFTagInput("");
    setFDescription(row.description || "");
    setFEditId(row.id); setError("");
    setModal("form");
    fetchFxRate();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fCode) { setError("กรุณากรอกรหัส"); return; }
    if (!fNameTh) { setError("กรุณากรอกชื่อ"); return; }
    setSaving(true); setError("");

    const payload = {
      code: fCode, name_th: fNameTh, name_en: fNameEn, unit: fUnit,
      price_thb: fPriceTHB === "" ? null : parseFloat(fPriceTHB),
      price_usd: fPriceUSD === "" ? null : parseFloat(fPriceUSD),
      description: fDescription,
      ...(isProduct ? { tags: fTags.join(",") } : {}),
    };

    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const hdrs = sb.h(token, { Prefer: "return=representation" });

    try {
      if (fEditId) {
        // Use Prefer: return=minimal to avoid empty array issue
        const patchHeaders = { ...hdrs, Prefer: "return=minimal" };
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${type}?id=eq.${fEditId}`, {
          method: "PATCH", headers: patchHeaders, body: JSON.stringify(payload)
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
          setSaving(false); setError(e.message || JSON.stringify(e)); return;
        }
      } else {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${type}`, {
          method: "POST", headers: hdrs, body: JSON.stringify(payload)
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
          setSaving(false); setError(e.message || JSON.stringify(e)); return;
        }
      }
    } catch (e) {
      setSaving(false); setError(e.message || "เกิดข้อผิดพลาด"); return;
    }

    setSaving(false);
    setModal(null); load();
  };

  const handleDelete = async () => {
    await sb.db.delete(type, deleteId);
    setDeleteId(null); load();
  };

  return (
    <div>
      <h1 style={S.pageTitle}>{icon} {title}</h1>
      <p style={S.pageSub}>จัดการข้อมูล{title}ทั้งหมด</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder={`ค้นหา${title}...`} />
        {!readOnly && <button style={S.btn("primary")} onClick={openAdd}>+ เพิ่ม{title}</button>}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {isProduct && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#adb5bd", fontWeight: 500 }}>Tag:</span>
            <input value={filterTag} onChange={e => setFilterTag(e.target.value)}
              placeholder="เช่น on prem, cloud..." style={{ ...S.input, width: 150, padding: "4px 10px", fontSize: 12 }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#adb5bd", fontWeight: 500 }}>ราคา (฿):</span>
          <input type="number" value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)}
            placeholder="ต่ำสุด" style={{ ...S.input, width: 90, padding: "4px 8px", fontSize: 12 }} />
          <span style={{ fontSize: 11, color: "#adb5bd" }}>—</span>
          <input type="number" value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)}
            placeholder="สูงสุด" style={{ ...S.input, width: 90, padding: "4px 8px", fontSize: 12 }} />
        </div>
        {(filterTag || filterPriceMin || filterPriceMax) && (
          <button onClick={() => { setFilterTag(""); setFilterPriceMin(""); setFilterPriceMax(""); }}
            style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 11 }}>✕ ล้าง</button>
        )}
        <span style={{ fontSize: 11, color: "#adb5bd", marginLeft: "auto" }}>
          แสดง {filtered.length} / {rows.length} รายการ
        </span>
      </div>

      <div style={S.card}>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>กำลังโหลด...</div>
          : filtered.length === 0 ? <EmptyState icon={icon} text={search || filterTag || filterPriceMin || filterPriceMax ? "ไม่พบรายการที่ค้นหา" : `ยังไม่มีข้อมูล${title}`} />
          : (
            <table style={{ ...S.table, tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: 90 }} />
                <col style={{ width: 180 }} />
                <col />
                <col style={{ width: 70 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                {isProduct && <col style={{ width: 140 }} />}
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr>
                  <SortTh k="code">รหัส</SortTh>
                  <SortTh k="name_th">ชื่อ</SortTh>
                  <th style={S.th}>รายละเอียด</th>
                  <SortTh k="unit">หน่วย</SortTh>
                  <SortTh k="price_thb" style={{ textAlign: "right" }}>ราคา (฿)</SortTh>
                  <SortTh k="price_usd" style={{ textAlign: "right" }}>ราคา ($)</SortTh>
                  {isProduct && <th style={S.th}>Tags</th>}
                  <th style={S.th}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={S.td}><span style={{ fontWeight: 500, color: "#0F6E56", fontSize: 12 }}>{row.code}</span></td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{row.name_th}</div>
                      {row.name_en && <div style={{ fontSize: 11, color: "#adb5bd" }}>{row.name_en}</div>}
                    </td>
                    <td style={S.td}>
                      {row.description ? (
                        <div style={{ fontSize: 12, color: "#6c757d", lineHeight: 1.5,
                          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical", cursor: "pointer" }}
                          title={row.description}>
                          {row.description}
                        </div>
                      ) : <span style={{ color: "#dee2e6" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, fontSize: 12 }}>{row.unit || <span style={{ color: "#dee2e6" }}>—</span>}</td>
                    <td style={{ ...S.td, textAlign: "right", fontSize: 13 }}>{row.price_thb ? fmt(row.price_thb) : <span style={{ color: "#dee2e6" }}>—</span>}</td>
                    <td style={{ ...S.td, textAlign: "right", fontSize: 12, color: "#6c757d" }}>{row.price_usd ? fmt(row.price_usd, 4) : <span style={{ color: "#dee2e6" }}>—</span>}</td>
                    {isProduct && <td style={S.td}>
                      {row.tags ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {row.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                            <span key={t} style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 10, background: "#f1f3f5", color: "#495057", border: "1px solid #dee2e6" }}>{t}</span>
                          ))}
                        </div>
                      ) : <span style={{ color: "#dee2e6" }}>—</span>}
                    </td>}
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {!readOnly && <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => openEdit(row)}>✏️</button>}
                        {!readOnly && <button style={{ ...S.btn("danger"), padding: "4px 8px", fontSize: 11 }} onClick={() => setDeleteId(row.id)}>🗑️</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* Form Modal */}
      {modal === "form" && (
        <Modal title={fEditId ? `แก้ไข${title}` : `เพิ่ม${title}`} onClose={() => setModal(null)}>
          <Alert type="error" msg={error} />
          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>รหัส<span style={{ color: "#dc3545" }}>*</span></label>
                <input value={fCode} onChange={e => setFCode(e.target.value)} placeholder={isProduct ? "P0001" : "S0001"} style={S.input} />
              </div>
              <div>
                <label style={S.label}>ชื่อ (ไทย)<span style={{ color: "#dc3545" }}>*</span></label>
                <input value={fNameTh} onChange={e => setFNameTh(e.target.value)} placeholder={isProduct ? "สินค้าตัวอย่าง" : "บริการตัวอย่าง"} style={S.input} />
              </div>
              <div>
                <label style={S.label}>ชื่อ (อังกฤษ)</label>
                <input value={fNameEn} onChange={e => setFNameEn(e.target.value)} placeholder={isProduct ? "Sample Product" : "Sample Service"} style={S.input} />
              </div>
              <div>
                <label style={S.label}>หน่วย</label>
                <input value={fUnit} onChange={e => setFUnit(e.target.value)} placeholder={isProduct ? "ชิ้น, กล่อง" : "งาน, ครั้ง"} style={S.input} />
              </div>
              {/* FX Rate bar */}
              <div style={{ gridColumn: "1 / -1", background: "#f8f9fa", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#6c757d", fontWeight: 500 }}>อัตราแลกเปลี่ยน:</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#495057" }}>1 USD =</span>
                  <input type="number" value={fxRate} onChange={e => setFxRate(parseFloat(e.target.value) || 36)}
                    style={{ ...S.input, width: 90, padding: "4px 8px", fontSize: 13, fontWeight: 600, color: "#0F6E56", textAlign: "center" }} />
                  <span style={{ fontSize: 12, color: "#495057" }}>THB</span>
                </div>
                <button type="button" onClick={fetchFxRate} disabled={fxLoading}
                  style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #dee2e6", background: "#fff", fontSize: 11, cursor: "pointer", color: "#495057" }}>
                  {fxLoading ? "⏳" : "🔄 อัปเดต"}
                </button>
                {fxUpdated && <span style={{ fontSize: 11, color: "#adb5bd" }}>{fxUpdated}</span>}
              </div>
              <div>
                <label style={S.label}>ราคา (บาท)</label>
                <input type="number" value={fPriceTHB}
                  onChange={e => {
                    setFPriceTHB(e.target.value);
                    if (e.target.value && fxRate) setFPriceUSD((parseFloat(e.target.value) / fxRate).toFixed(4));
                  }}
                  placeholder="1000.00" style={S.input} />
              </div>
              <div>
                <label style={S.label}>ราคา (USD)</label>
                <input type="number" value={fPriceUSD}
                  onChange={e => {
                    setFPriceUSD(e.target.value);
                    if (e.target.value && fxRate) setFPriceTHB((parseFloat(e.target.value) * fxRate).toFixed(2));
                  }}
                  placeholder="28.00" style={S.input} />
              </div>
              {isProduct && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={S.label}>Tags <span style={{ fontSize: 11, color: "#adb5bd", fontWeight: 400 }}>(พิมพ์แล้วกด Enter หรือ , เพื่อเพิ่ม)</span></label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 10px", border: "1px solid #dee2e6", borderRadius: 8, background: "#fff", minHeight: 40, alignItems: "center", cursor: "text" }}
                    onClick={e => e.currentTarget.querySelector("input")?.focus()}>
                    {fTags.map(t => (
                      <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 12, background: "#f0fff4", color: "#0F6E56", border: "1px solid #9ae6b4" }}>
                        {t}
                        <button type="button" onClick={() => setFTags(prev => prev.filter(x => x !== t))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#0F6E56", fontSize: 14, lineHeight: 1, padding: 0, display: "flex" }}>×</button>
                      </span>
                    ))}
                    <input
                      value={fTagInput}
                      onChange={e => setFTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          const val = fTagInput.trim().replace(/,/g, "");
                          if (val && !fTags.includes(val)) setFTags(prev => [...prev, val]);
                          setFTagInput("");
                        } else if (e.key === "Backspace" && !fTagInput && fTags.length > 0) {
                          setFTags(prev => prev.slice(0, -1));
                        }
                      }}
                      onBlur={() => {
                        const val = fTagInput.trim().replace(/,/g, "");
                        if (val && !fTags.includes(val)) setFTags(prev => [...prev, val]);
                        setFTagInput("");
                      }}
                      placeholder={fTags.length === 0 ? "เช่น on prem, cloud, enterprise..." : ""}
                      style={{ border: "none", outline: "none", fontSize: 13, flex: 1, minWidth: 140, background: "transparent", color: "#1a1a1a" }}
                    />
                  </div>
                </div>
              )}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={S.label}>รายละเอียด</label>
                <textarea
                  value={fDescription}
                  onChange={e => setFDescription(e.target.value)}
                  rows={4}
                  placeholder={isProduct ? "สเปก คำอธิบาย หรือข้อมูลเพิ่มเติม" : "ขอบเขตงาน เงื่อนไข หรือข้อมูลเพิ่มเติม"}
                  style={{ ...S.input, resize: "vertical" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button type="button" style={S.btn("ghost")} onClick={() => setModal(null)}>ยกเลิก</button>
              <button type="submit" style={S.btn("primary")} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <Modal title="ยืนยันการลบ" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 14, color: "#495057", marginBottom: 20 }}>ต้องการลบ{title}นี้ใช่หรือไม่?</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button style={S.btn("ghost")} onClick={() => setDeleteId(null)}>ยกเลิก</button>
            <button style={S.btn("danger")} onClick={handleDelete}>ลบ</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── FIELD CONFIGS ────────────────────────────────────────────────────────────
const CUSTOMER_FIELDS = [
  { key: "code", label: "รหัสลูกค้า", required: true, placeholder: "C0001" },
  { key: "name_th", label: "ชื่อ (ไทย)", required: true, placeholder: "บริษัท ตัวอย่าง จำกัด" },
  { key: "name_en", label: "ชื่อ (อังกฤษ)", placeholder: "Example Co., Ltd." },
  { key: "tax_id", label: "เลขประจำตัวผู้เสียภาษี", placeholder: "0-0000-00000-00-0" },
  { key: "branch", label: "สาขา / Branch", placeholder: "สำนักงานใหญ่, สาขาที่ 001" },
  { key: "address", label: "ที่อยู่", type: "textarea", fullWidth: true, placeholder: "เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" },
  { key: "credit_days", label: "เครดิต (วัน)", type: "number", placeholder: "30" },
  { key: "billing_method", label: "วิธีการวางบิล", type: "select", fullWidth: false,
    options: [
      { value: "end_of_month", label: "วางบิลสิ้นเดือน" },
      { value: "specific_date", label: "วางบิลตามวันที่กำหนด" },
      { value: "on_delivery", label: "วางบิลเมื่อส่งงาน/สินค้า" },
      { value: "immediate", label: "วางบิลทันที" },
      { value: "other", label: "อื่นๆ" },
    ]
  },
  { key: "billing_note", label: "หมายเหตุการวางบิล", type: "textarea", fullWidth: true, placeholder: "เช่น วางบิลทุกวันที่ 25 ของเดือน" },
];

const PRODUCT_FIELDS = [
  { key: "code", label: "รหัสสินค้า", required: true, placeholder: "P0001" },
  { key: "name_th", label: "ชื่อสินค้า (ไทย)", required: true, placeholder: "สินค้าตัวอย่าง" },
  { key: "name_en", label: "ชื่อสินค้า (อังกฤษ)", placeholder: "Sample Product" },
  { key: "unit", label: "หน่วย", placeholder: "ชิ้น, กล่อง, ชุด" },
  { key: "price_thb", label: "ราคา (บาท)", type: "number", placeholder: "1000.00" },
  { key: "price_usd", label: "ราคา (USD)", type: "number", placeholder: "28.00" },
  { key: "tags", label: "Tags", placeholder: "on prem, cloud, enterprise" },
  { key: "description", label: "รายละเอียดสินค้า", type: "textarea", fullWidth: true, placeholder: "คำอธิบายสินค้า สเปก หรือข้อมูลเพิ่มเติม" },
];

const SERVICE_FIELDS = [
  { key: "code", label: "รหัสบริการ", required: true, placeholder: "S0001" },
  { key: "name_th", label: "ชื่อบริการ (ไทย)", required: true, placeholder: "บริการติดตั้ง" },
  { key: "name_en", label: "ชื่อบริการ (อังกฤษ)", placeholder: "Installation Service" },
  { key: "unit", label: "หน่วย", placeholder: "งาน, ครั้ง, เดือน" },
  { key: "price_thb", label: "ราคา (บาท)", type: "number", placeholder: "5000.00" },
  { key: "price_usd", label: "ราคา (USD)", type: "number", placeholder: "140.00" },
  { key: "description", label: "รายละเอียดบริการ", type: "textarea", fullWidth: true, placeholder: "คำอธิบายบริการ ขอบเขตงาน หรือข้อมูลเพิ่มเติม" },
];

// ─── SORTABLE TABLE ───────────────────────────────────────────────────────────
function useSortable(data, defaultKey = "created_at", defaultDir = "desc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...(data || [])].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (va == null) va = "";
    if (vb == null) vb = "";
    // Number comparison
    const na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
    // Date comparison
    if (typeof va === "string" && va.match(/^\d{4}-/)) {
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    // String comparison
    return sortDir === "asc"
      ? String(va).localeCompare(String(vb), "th")
      : String(vb).localeCompare(String(va), "th");
  });

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <span style={{ color: "#dee2e6", marginLeft: 4, fontSize: 10 }}>⇅</span>;
    return <span style={{ color: "#0F6E56", marginLeft: 4, fontSize: 10 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const Th = ({ k, children, style = {} }) => (
    <th style={{ ...S.th, cursor: "pointer", userSelect: "none", ...style }}
      onClick={() => toggleSort(k)}>
      {children}<SortIcon k={k} />
    </th>
  );

  return { sorted, sortKey, sortDir, toggleSort, Th };
}

// ─── DOCUMENT FILTER BAR ──────────────────────────────────────────────────────
function DocFilterBar({ filters, onChange, statusOptions, showCustomer = true, customers = [] }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const QUICK_RANGES = [
    {
      label: "เดือนนี้",
      get: () => {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth()+1, 0);
        return { date_from: ymd(from), date_to: ymd(to) };
      }
    },
    {
      label: "ไตรมาสนี้",
      get: () => {
        const q = Math.floor(now.getMonth() / 3);
        const from = new Date(now.getFullYear(), q * 3, 1);
        const to = new Date(now.getFullYear(), q * 3 + 3, 0);
        return { date_from: ymd(from), date_to: ymd(to) };
      }
    },
    {
      label: "ปีนี้",
      get: () => ({
        date_from: `${now.getFullYear()}-01-01`,
        date_to: `${now.getFullYear()}-12-31`,
      })
    },
    {
      label: "เดือนที่แล้ว",
      get: () => {
        const from = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const to = new Date(now.getFullYear(), now.getMonth(), 0);
        return { date_from: ymd(from), date_to: ymd(to) };
      }
    },
  ];

  const activeQuick = QUICK_RANGES.find(r => {
    const range = r.get();
    return filters.date_from === range.date_from && filters.date_to === range.date_to;
  });

  const hasFilter = filters.status || filters.customer_id || filters.date_from || filters.date_to;
  const filterCount = [filters.status, filters.customer_id, filters.date_from].filter(Boolean).length;

  return (
    <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>

      {/* Quick range buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#adb5bd", fontWeight: 500, marginRight: 4 }}>ช่วงเวลา:</span>
        {QUICK_RANGES.map(r => {
          const active = activeQuick?.label === r.label;
          return (
            <button key={r.label} onClick={() => onChange({ ...filters, ...r.get() })}
              style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${active ? "#0F6E56" : "#dee2e6"}`,
                background: active ? "#0F6E56" : "#fff", color: active ? "#fff" : "#495057",
                fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>
              {r.label}
            </button>
          );
        })}
        {(filters.date_from || filters.date_to) && (
          <button onClick={() => onChange({ ...filters, date_from: "", date_to: "" })}
            style={{ padding: "4px 10px", borderRadius: 20, border: "1px solid #dee2e6",
              background: "transparent", color: "#adb5bd", fontSize: 11, cursor: "pointer" }}>
            ✕ ล้างวันที่
          </button>
        )}
      </div>

      {/* Filter controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        {/* Status */}
        <div>
          <label style={{ ...S.label, fontSize: 11 }}>สถานะ</label>
          <select value={filters.status || ""} onChange={e => onChange({ ...filters, status: e.target.value })}
            style={{ ...S.input, width: 140, fontSize: 12, padding: "6px 10px" }}>
            <option value="">ทุกสถานะ</option>
            {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Customer */}
        {showCustomer && (
          <div>
            <label style={{ ...S.label, fontSize: 11 }}>ลูกค้า</label>
            <select value={filters.customer_id || ""} onChange={e => onChange({ ...filters, customer_id: e.target.value })}
              style={{ ...S.input, width: 200, fontSize: 12, padding: "6px 10px" }}>
              <option value="">ลูกค้าทั้งหมด</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name_th}</option>)}
            </select>
          </div>
        )}

        {/* Date From */}
        <div>
          <label style={{ ...S.label, fontSize: 11 }}>จากวันที่</label>
          <input type="date" value={filters.date_from || ""} onChange={e => onChange({ ...filters, date_from: e.target.value })}
            style={{ ...S.input, width: 140, fontSize: 12, padding: "6px 10px" }} />
        </div>

        {/* Date To */}
        <div>
          <label style={{ ...S.label, fontSize: 11 }}>ถึงวันที่</label>
          <input type="date" value={filters.date_to || ""} onChange={e => onChange({ ...filters, date_to: e.target.value })}
            style={{ ...S.input, width: 140, fontSize: 12, padding: "6px 10px" }} />
        </div>

        {/* Clear all */}
        {hasFilter && (
          <button onClick={() => onChange({})}
            style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 12, alignSelf: "flex-end" }}>
            ✕ ล้างทั้งหมด
          </button>
        )}

        {/* Active filter summary */}
        {hasFilter && (
          <div style={{ alignSelf: "flex-end", fontSize: 11, color: "#0F6E56", fontWeight: 500, padding: "6px 0" }}>
            {filterCount} ตัวกรอง
            {activeQuick && <span style={{ marginLeft: 6, color: "#adb5bd" }}>· {activeQuick.label}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const applyDocFilters = (rows, filters, customers) => {
  return rows.filter(r => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.customer_id && r.customer_id !== filters.customer_id) return false;
    const docDate = r.doc_date ? r.doc_date.slice(0, 10) : "";
    if (filters.date_from && docDate < filters.date_from) return false;
    if (filters.date_to && docDate > filters.date_to) return false;
    return true;
  });
};

function QuotationList({ onNew, onEdit, onConvertToInvoice, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [customers, setCustomers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, custs] = await Promise.all([
      sb.db.list("quotations", search, ["doc_number", "customer_name"]),
      sb.db.list("customers"),
    ]);
    setRows(data || []);
    setCustomers(custs || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const statusLabel = { draft: { label: "ร่าง", color: "gray" }, sent: { label: "ส่งแล้ว", color: "blue" }, approved: { label: "อนุมัติ", color: "green" }, cancelled: { label: "ยกเลิก", color: "red" } };
  const filtered = applyDocFilters(rows, filters, customers);
  const { sorted: sortedRows, Th: SortTh } = useSortable(filtered, "doc_date", "desc");

  return (
    <div>
      <h1 style={S.pageTitle}>📄 ใบเสนอราคา</h1>
      <p style={S.pageSub}>จัดการใบเสนอราคาทั้งหมด</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาเลขที่ หรือชื่อลูกค้า..." />
        {onNew && <button style={S.btn("primary")} onClick={onNew}>+ สร้างใบเสนอราคา</button>}
      </div>
      <DocFilterBar filters={filters} onChange={setFilters} customers={customers}
        statusOptions={[
          { value: "draft", label: "ร่าง" },
          { value: "sent", label: "ส่งแล้ว" },
          { value: "approved", label: "อนุมัติ" },
          { value: "cancelled", label: "ยกเลิก" },
        ]} />
      <div style={S.card}>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>กำลังโหลด...</div>
          : filtered.length === 0 ? <EmptyState icon="📄" text={Object.keys(filters).length > 0 ? "ไม่พบเอกสารที่ตรงกับตัวกรอง" : "ยังไม่มีใบเสนอราคา"} />
          : (
            <table style={S.table}>
              <thead>
                <tr>
                  <SortTh k="doc_number">เลขที่</SortTh>
                  <SortTh k="doc_date">วันที่</SortTh>
                  <SortTh k="customer_name">ลูกค้า</SortTh>
                  <SortTh k="subtotal" style={{ textAlign: "right" }}>ก่อน VAT</SortTh>
                  <SortTh k="total" style={{ textAlign: "right" }}>ยอดรวม (THB)</SortTh>
                  <SortTh k="currency">สกุลเงิน</SortTh>
                  <SortTh k="status">สถานะ</SortTh>
                  <th style={S.th}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(r => {
                  const st = statusLabel[r.status] || statusLabel.draft;
                  return (
                    <tr key={r.id} onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={S.td}><span style={{ fontWeight: 500, color: "#0F6E56" }}>{r.doc_number}</span></td>
                      <td style={S.td}>{r.doc_date ? new Date(r.doc_date).toLocaleDateString("th-TH") : "—"}</td>
                      <td style={S.td}>{r.customer_name || "—"}</td>
                      <td style={{ ...S.td, textAlign: "right", color: "#495057" }}>{fmt(parseFloat(r.total||0) - parseFloat(r.vat_amount||0))}</td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: 500 }}>{fmt(r.total)}</td>
                      <td style={S.td}><span style={S.badge("blue")}>{r.currency || "THB"}</span></td>
                      <td style={S.td}><span style={S.badge(st.color)}>{st.label}</span></td>
                      <td style={S.td}>
                        <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12 }} onClick={() => onEdit(r)}>✏️ เปิด</button>
                      {onNew && !["cancelled"].includes(r.status) && onConvertToInvoice && (
                        <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12, color: "#1e40af", borderColor: "#1e40af" }}
                          onClick={() => onConvertToInvoice(r)}>🧾 → Invoice</button>
                      )}
                      {onNew && !["paid", "cancelled"].includes(r.status) && (
                        <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 11, color: "#adb5bd" }} onClick={async () => {
                          const confirmed = prompt(`พิมพ์ "ยกเลิก" เพื่อยืนยันการยกเลิก ${r.doc_number}`);
                          if (confirmed !== "ยกเลิก") return;
                          await sb.db.update("quotations", r.id, { status: "cancelled" });
                          load();
                        }}>✕</button>
                      )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}

// Parse metadata that was packed into the note field as [meta:{...}]
const parseDocMeta = (note) => {
  try {
    const m = (note || "").match(/\[meta:(\{.*?\})\]/);
    return m ? JSON.parse(m[1]) : {};
  } catch { return {}; }
};
const stripDocMeta = (note) => (note || "").replace(/\n?\[meta:\{.*?\}\]/g, "").trimEnd();

function QuotationForm({ doc, onBack, userName = "ผู้ใช้งาน", userEmail = "", userPosition = "" }) {
  const isNew = !doc?.id;
  const isLocked = !isNew && ["sent", "approved", "cancelled"].includes(doc?.status);
  const [unlocked, setUnlocked] = useState(false);
  const isReadOnly = isLocked && !unlocked;
  const _meta = parseDocMeta(doc?.note);
  const [header, setHeader] = useState({
    doc_number: doc?.doc_number || "",
    doc_date: doc?.doc_date || new Date().toISOString().slice(0, 10),
    valid_days: doc?.valid_days || 30,
    currency: doc?.currency || "THB",
    fx_rate: doc?.fx_rate || 36,
    discount_percent: doc?.discount_percent || 0,
    discount_type: _meta.discount_type || "percent",   // "percent" | "amount" — stored in note[meta]
    item_disc_mode: _meta.item_disc_mode || "percent", // "percent" | "amount" — stored in note[meta]
    show_disc_col: _meta.show_disc_col !== false,      // toggle column — stored in note[meta]
    vat_percent: doc?.vat_percent || 7,
    wht_percent: _meta.wht_percent ?? doc?.wht_percent ?? 0, // stored in note[meta]
    note: stripDocMeta(doc?.note) || "",
    status: doc?.status || "draft",
    customer_id: doc?.customer_id || "",
    customer_name: doc?.customer_name || "",
    customer_address: doc?.customer_address || "",
    customer_tax_id: doc?.customer_tax_id || "",
    customer_contact: doc?.customer_contact || "",
    customer_phone: doc?.customer_phone || "",
    customer_email: doc?.customer_email || "",
    customer_branch: doc?.customer_branch || "",
    contact_id: doc?.contact_id || null,
  });
  const [items, setItems] = useState([]);
  const itemsRef = React.useRef([]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [previewCurrency, setPreviewCurrency] = useState("THB");
  const [itemSearch, setItemSearch] = useState("");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxUpdated, setFxUpdated] = useState("");

  // recalculate price_thb ของทุก item เมื่อ FX rate เปลี่ยน
  // เรียกโดยตรงจาก handleFxChange แทน useEffect เพื่อหลีกเลี่ยง string/number comparison issue
  const recalcItemsByFx = (newFx) => {
    const fx = parseFloat(newFx) || 36;
    setItems(prev => prev.map(item => {
      const priceUSD = parseFloat(item.price_usd) || 0;
      if (priceUSD === 0) return item; // ไม่มีราคา USD — ไม่ต้องเปลี่ยน
      const itemFx = item.item_fx_rate != null ? parseFloat(item.item_fx_rate) || fx : fx;
      const priceTHB = parseFloat((priceUSD * itemFx).toFixed(2));
      const qty = parseFloat(item.qty) || 1;
      const mode = header.item_disc_mode || "percent";
      const discPct = parseFloat(item.discount_percent) || 0;
      const discAmt = parseFloat(item.discount_amount) || 0;
      const lineTHB = mode === "percent"
        ? priceTHB * qty * (1 - discPct / 100)
        : Math.max(0, priceTHB * qty - discAmt);
      const lineUSD = mode === "percent"
        ? priceUSD * qty * (1 - discPct / 100)
        : Math.max(0, priceUSD * qty - discAmt / itemFx);
      return { ...item, price_thb: priceTHB, line_total_thb: lineTHB, line_total_usd: lineUSD };
    }));
  };


  const fetchFxRate = async () => {
    setFxLoading(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data?.rates?.THB) {
        const rate = parseFloat(data.rates.THB.toFixed(4));
        const d = new Date(data.time_last_update_utc);
        const dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        setHeader(h => ({ ...h, fx_rate: rate }));
        setItems(itemsRef.current.map(item => {
          const usd = parseFloat(String(item.price_usd));
          if (!usd || usd <= 0) return item;
          const itemFxOverride = item.item_fx_rate != null ? parseFloat(String(item.item_fx_rate)) : null;
          const fx = itemFxOverride && itemFxOverride > 0 ? itemFxOverride : rate;
          const thb = parseFloat((usd * fx).toFixed(2));
          const qty = parseFloat(String(item.qty)) || 1;
          const discPct = parseFloat(String(item.discount_percent)) || 0;
          return { ...item, price_thb: thb, line_total_thb: parseFloat((thb * qty * (1 - discPct / 100)).toFixed(2)), line_total_usd: parseFloat((usd * qty * (1 - discPct / 100)).toFixed(4)) };
        }));
        setFxUpdated(`อัปเดต: ${dateStr}`);
      } else { setFxUpdated("ดึงข้อมูลไม่ได้"); }
    } catch { setFxUpdated("ดึงข้อมูลไม่ได้"); }
    setFxLoading(false);
  };

  useEffect(() => {
    sb.db.list("customers").then(setCustomers);
    sb.db.list("products").then(setProducts);
    sb.db.list("services").then(setServices);
    // Load default VAT rate from settings
    if (!doc?.id) {
      sb.db.list("company_settings").then(rows => {
        if (rows?.length > 0 && rows[0].vat_rate != null) {
          setHeader(h => ({ ...h, vat_percent: rows[0].vat_rate }));
        }
      });
    }
    // Preview next doc number (not consumed yet)
    if (!doc?.id && !header.doc_number) {
      previewNextDocNumber("quotation").then(num => { if (num) setHeader(h => ({ ...h, doc_number: num, _docNumberPreview: true })); });
    }
    if (doc?.id) {
      fetch(`${SUPABASE_URL}/rest/v1/quotation_items?quotation_id=eq.${doc.id}&order=item_order.asc&select=*`, {
        headers: sb.h()
      }).then(r => r.json()).then(data => { if (Array.isArray(data)) setItems(data.map(i => ({ ...i, _id: i.id }))); });
    }
  }, [doc]);

  const setH = (k) => (e) => setHeader(h => ({ ...h, [k]: e.target.value }));


  const selectCustomer = (c) => {
    setHeader(h => ({ ...h, customer_id: c.id, customer_name: c.name_th, customer_address: c.address || "", customer_tax_id: c.tax_id || "", customer_branch: c.branch || "", customer_contact: "", customer_phone: "", customer_email: c.email || "", contact_id: null }));
  };

  const addItem = (src, type) => {
    const fxRate = parseFloat(header.fx_rate) || 36;
    const priceUSD = parseFloat(src.price_usd) || 0;
    // USD เป็นหลัก: คำนวณ THB จาก USD × FX rate ณ ตอนนี้
    // ถ้าไม่มี price_usd ใน master ให้ใช้ price_thb เดิม
    const priceTHB = priceUSD > 0
      ? parseFloat((priceUSD * fxRate).toFixed(2))
      : parseFloat(src.price_thb) || 0;
    setItems(prev => [...prev, {
      _id: Date.now(), item_type: type, ref_id: src.id,
      code: src.code, name_th: src.name_th, name_en: src.name_en || "",
      description: src.description || "", unit: src.unit || "",
      qty: 1, price_thb: priceTHB, price_usd: priceUSD,
      discount_percent: 0, discount_amount: 0, item_fx_rate: null,
      line_total_thb: priceTHB, line_total_usd: priceUSD,
      _usd_manual: priceUSD > 0, // mark ว่า USD เป็นหลัก เพื่อให้ recalc ถูกเมื่อ FX เปลี่ยน
    }]);
    setShowItemPicker(false);
    setItemSearch("");
  };

  const addManualItem = () => {
    setItems(prev => [...prev, { _id: Date.now(), item_type: "product", code: "", name_th: "", name_en: "", description: "", unit: "", qty: 1, price_thb: 0, price_usd: 0, discount_percent: 0, discount_amount: 0, item_fx_rate: null, line_total_thb: 0, line_total_usd: 0 }]);
  };

  const updateItem = (idx, k, v) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [k]: v };
      const qty = parseFloat(k === "qty" ? v : updated.qty) || 0;
      let priceTHB = parseFloat(k === "price_thb" ? v : updated.price_thb) || 0;
      const priceUSD = parseFloat(k === "price_usd" ? v : updated.price_usd) || 0;
      // ใช้ FX rate ของบรรทัดนี้ก่อน ถ้าไม่มีค่อย fallback ไปค่ากลาง
      const itemFx = k === "item_fx_rate" ? v : updated.item_fx_rate;
      const effectiveFx = parseFloat(itemFx ?? header.fx_rate) || parseFloat(header.fx_rate) || 36;
      // auto-convert: ถ้าแก้ price_thb ให้คำนวณ USD อัตโนมัติ
      if (k === "price_thb" && !updated._usd_manual) {
        updated.price_usd = effectiveFx > 0 ? parseFloat((priceTHB / effectiveFx).toFixed(4)) : updated.price_usd;
      }
      if (k === "price_usd") { updated._usd_manual = true; }
      // เมื่อ item_fx_rate เปลี่ยน: ถ้ามี USD → recalc THB จาก USD×newFx, ถ้าไม่มี → recalc USD จาก THB/newFx
      if (k === "item_fx_rate") {
        if (updated._usd_manual && priceUSD > 0) {
          priceTHB = effectiveFx > 0 ? parseFloat((priceUSD * effectiveFx).toFixed(2)) : priceTHB;
          updated.price_thb = priceTHB;
        } else {
          updated.price_usd = effectiveFx > 0 ? parseFloat((priceTHB / effectiveFx).toFixed(4)) : updated.price_usd;
        }
        if (v === null) { updated._usd_manual = false; }
      }
      const mode = header.item_disc_mode || "percent";
      const discPct = parseFloat(k === "discount_percent" ? v : updated.discount_percent) || 0;
      const discAmtVal = parseFloat(k === "discount_amount" ? v : updated.discount_amount) || 0;
      const finalPriceUSD = parseFloat(updated.price_usd) || 0;
      if (mode === "percent") {
        updated.line_total_thb = priceTHB * qty * (1 - discPct / 100);
        updated.line_total_usd = finalPriceUSD * qty * (1 - discPct / 100);
      } else {
        updated.line_total_thb = Math.max(0, priceTHB * qty - discAmtVal);
        updated.line_total_usd = Math.max(0, finalPriceUSD * qty - discAmtVal / effectiveFx);
      }
      return updated;
    }));
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const saveItemToMaster = async (item, idx) => {
    if (!item.name_th) { alert("กรุณากรอกชื่อสินค้า/บริการก่อน"); return; }
    const type = item.item_type === "service" ? "services" : "products";
    const prefix = type === "products" ? "P" : "S";

    // Auto-generate code แบบ P0001 / S0001 ถ้าไม่ได้กรอกมา หรือ format ไม่ถูก
    const codeRaw = item.code?.trim() || "";
    const codeRegex = prefix === "P" ? /^P\d{4,}$/ : /^S\d{4,}$/;
    let code = codeRaw;
    if (!code || !codeRegex.test(code)) {
      const existing = await sb.db.list(type);
      const regex = prefix === "P" ? /^P\d+$/ : /^S\d+$/;
      const codes = (existing || []).map(r => r.code || "").filter(c => regex.test(c));
      const maxNum = codes.length > 0 ? Math.max(...codes.map(c => parseInt(c.slice(1)) || 0)) : 0;
      code = `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
    }

    const payload = { code, name_th: item.name_th, name_en: item.name_en || "", unit: item.unit || "", price_thb: item.price_thb || 0, price_usd: item.price_usd || 0, description: item.description || "", tags: "" };
    const { data, error: err } = await sb.db.insert(type, payload);
    if (err) { alert("บันทึกไม่สำเร็จ: " + (err.message || JSON.stringify(err))); return; }
    const savedId = data?.[0]?.id;
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ref_id: savedId, code } : it));
    alert(`✅ บันทึก "${item.name_th}" (${code}) ลงใน ${type === "products" ? "สินค้า" : "บริการ"} Master เรียบร้อย`);
  };

  // Calculations
  const subtotalTHB = items.reduce((s, i) => s + (parseFloat(i.line_total_thb) || 0), 0);
  const subtotalUSD = items.reduce((s, i) => s + (parseFloat(i.line_total_usd) || 0), 0);
  const fxRate = parseFloat(header.fx_rate) || 36;
  const billDiscType = header.discount_type || "percent";
  const discAmt = billDiscType === "percent"
    ? subtotalTHB * (parseFloat(header.discount_percent) || 0) / 100
    : parseFloat(header.discount_percent) || 0;
  const discAmtUSD = billDiscType === "percent"
    ? subtotalUSD * (parseFloat(header.discount_percent) || 0) / 100
    : (parseFloat(header.discount_percent) || 0) / fxRate;
  const afterDisc = Math.max(0, subtotalTHB - discAmt);
  const afterDiscUSD = Math.max(0, subtotalUSD - discAmtUSD);
  const vatAmt = afterDisc * (parseFloat(header.vat_percent) || 0) / 100;
  const vatAmtUSD = afterDiscUSD * (parseFloat(header.vat_percent) || 0) / 100;
  const whtAmt = afterDisc * (parseFloat(header.wht_percent) || 0) / 100;
  const whtAmtUSD = afterDiscUSD * (parseFloat(header.wht_percent) || 0) / 100;
  const total = afterDisc + vatAmt - whtAmt;
  const totalUSD = afterDiscUSD + vatAmtUSD - whtAmtUSD;

  const handleSave = async (status) => {
    if (!header.customer_name) return setError("กรุณาระบุลูกค้า");
    if (items.length === 0) return setError("กรุณาเพิ่มรายการสินค้า/บริการอย่างน้อย 1 รายการ");
    setSaving(true); setError("");
    const { _docNumberPreview: _dpq, customer_branch_custom: _cbqq, ...headerClean } = header;
    let finalDocNumber = headerClean.doc_number;
    if (isNew && header._docNumberPreview) {
      const realNum = await generateDocNumber("quotation");
      if (realNum) finalDocNumber = realNum;
    }
    const branchVal = header.customer_branch === "custom" ? (header.customer_branch_custom || "") : header.customer_branch;
    // Whitelist เฉพาะ columns ที่มีใน quotations table จริงๆ
    const payload = {
      doc_number: finalDocNumber,
      status: status || header.status,
      customer_id: headerClean.customer_id || null,
      customer_name: headerClean.customer_name || "",
      customer_address: headerClean.customer_address || "",
      customer_tax_id: headerClean.customer_tax_id || "",
      customer_branch: branchVal || "",
      customer_contact: headerClean.customer_contact || "",
      customer_phone: headerClean.customer_phone || "",
      customer_email: headerClean.customer_email || "",
      contact_id: headerClean.contact_id || null,
      doc_date: headerClean.doc_date || null,
      valid_days: headerClean.valid_days || 30,
      currency: headerClean.currency || "THB",
      fx_rate: parseFloat(headerClean.fx_rate) || 36,
      note: (headerClean.note || "") + `\n[meta:${JSON.stringify({ discount_type: headerClean.discount_type || "percent", item_disc_mode: headerClean.item_disc_mode || "percent", show_disc_col: headerClean.show_disc_col !== false, wht_percent: parseFloat(headerClean.wht_percent) || 0, wht_amount: whtAmt })}]`,
      discount_percent: parseFloat(headerClean.discount_percent) || 0,
      discount_amount: discAmt,
      vat_percent: parseFloat(headerClean.vat_percent) || 0,
      subtotal: subtotalTHB,
      vat_amount: vatAmt,
      total,
    };
    let qId = doc?.id;
    if (isNew) {
      const { data, error: err } = await sb.db.insert("quotations", payload);
      if (err) { setSaving(false); return setError(err.message || JSON.stringify(err)); }
      qId = data[0]?.id;
    } else {
      const { error: err } = await sb.db.update("quotations", doc.id, payload);
      if (err) { setSaving(false); return setError(err.message || JSON.stringify(err)); }
      await fetch(`${SUPABASE_URL}/rest/v1/quotation_items?quotation_id=eq.${doc.id}`, { method: "DELETE", headers: sb.h() });
    }
    if (qId && items.length > 0) {
      const lineItems = items.map((item, i) => ({
        quotation_id: qId, item_order: i,
        item_type: item.item_type, ref_id: item.ref_id || null,
        code: item.code, name_th: item.name_th, name_en: item.name_en,
        description: item.description, unit: item.unit, qty: item.qty,
        price_thb: item.price_thb, price_usd: item.price_usd,
        item_fx_rate: item.item_fx_rate ?? null,
        discount_percent: item.discount_percent || 0,
        discount_amount: item.discount_amount || 0,
        line_total_thb: item.line_total_thb, line_total_usd: item.line_total_usd,
      }));
      const { error: itemErr } = await sb.db.insert("quotation_items", lineItems);
      if (itemErr) { setSaving(false); return setError("บันทึกรายการสินค้าไม่สำเร็จ: " + (itemErr.message || JSON.stringify(itemErr))); }
    }
    setSaving(false);
    onBack();
  };

  const filteredItems = [...products.map(p => ({ ...p, _type: "product" })), ...services.map(s => ({ ...s, _type: "service" }))].filter(i => !itemSearch || i.name_th?.includes(itemSearch) || i.code?.includes(itemSearch));

  if (preview) return <QuotationPreview header={{ ...header, _userPosition: userPosition }} items={items} subtotalTHB={subtotalTHB} subtotalUSD={subtotalUSD} discAmt={discAmt} discAmtUSD={discAmtUSD} vatAmt={vatAmt} vatAmtUSD={vatAmtUSD} whtAmt={whtAmt} whtAmtUSD={whtAmtUSD} total={total} totalUSD={totalUSD} currency={previewCurrency} onClose={() => setPreview(false)} onChangeCurrency={setPreviewCurrency} userName={userName} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button style={S.btn("ghost")} onClick={onBack}>← กลับ</button>
        <h1 style={{ ...S.pageTitle, margin: 0 }}>{isNew ? "📄 สร้างใบเสนอราคา" : `📄 ${header.doc_number}`}</h1>
      </div>
      <Alert type="error" msg={error} />

      {isReadOnly && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>เอกสารนี้ถูกล็อกการแก้ไข</div>
              <div style={{ fontSize: 12, color: "#b45309" }}>สถานะ "{doc?.status}" — กด เปิดแก้ไข ถ้าต้องการแก้ไข</div>
            </div>
          </div>
          <button type="button" onClick={() => { const c = prompt("พิมพ์ \"แก้ไข\" เพื่อยืนยันการเปิดแก้ไขเอกสาร"); if (c === "แก้ไข") setUnlocked(true); }}
            style={{ ...S.btn("ghost"), borderColor: "#f59e0b", color: "#92400e", fontSize: 12 }}>
            🔓 เปิดแก้ไข
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ ...S.card, marginBottom: 16, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? "none" : "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 14 }}>ข้อมูลเอกสาร</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div>
            <label style={S.label}>
              เลขที่เอกสาร
              {header._docNumberPreview && <span style={{ marginLeft: 6, fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>● ตัวอย่าง (จะออกจริงตอนบันทึก)</span>}
            </label>
            <input value={header.doc_number} onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9); setHeader(h => ({ ...h, doc_number: v, _docNumberPreview: false })); }} maxLength={9} style={{ ...S.input, borderColor: header._docNumberPreview ? "#fbbf24" : undefined, fontFamily: "monospace", letterSpacing: "0.05em" }} />
          </div>
          <div><label style={S.label}>วันที่</label><input type="date" value={header.doc_date} onChange={setH("doc_date")} style={S.input} /></div>
          <div><label style={S.label}>ใช้ได้ (วัน)</label><input type="number" value={header.valid_days} onChange={setH("valid_days")} style={S.input} /></div>
          <div><label style={S.label}>สถานะ</label>
            <select value={header.status} onChange={setH("status")} style={S.input}>
              <option value="draft">ร่าง</option>
              <option value="sent">ส่งแล้ว</option>
              <option value="approved">อนุมัติ</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>

          <div>
            <label style={S.label}>อัตราแลกเปลี่ยน (1 USD = ? THB)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" value={header.fx_rate} onChange={e => {
                const newFx = parseFloat(e.target.value) || 36;
                setHeader(h => ({ ...h, fx_rate: newFx }));
                // อัปเดต price_thb ทุก item ที่มี price_usd > 0 โดยใช้ newFx
                const updated = itemsRef.current.map(item => {
                  const usd = parseFloat(String(item.price_usd));
                  if (!usd || usd <= 0) return item; // THB-only item ไม่ต้องเปลี่ยน
                  const itemFxOverride = item.item_fx_rate != null ? parseFloat(String(item.item_fx_rate)) : null;
                  const fx = itemFxOverride && itemFxOverride > 0 ? itemFxOverride : newFx;
                  const thb = parseFloat((usd * fx).toFixed(2));
                  const qty = parseFloat(String(item.qty)) || 1;
                  const discPct = parseFloat(String(item.discount_percent)) || 0;
                  return { ...item, price_thb: thb, line_total_thb: parseFloat((thb * qty * (1 - discPct / 100)).toFixed(2)), line_total_usd: parseFloat((usd * qty * (1 - discPct / 100)).toFixed(4)) };
                });
                setItems(updated);
              }} style={{ ...S.input, flex: 1 }} placeholder="36" />
              <button type="button" onClick={fetchFxRate} disabled={fxLoading}
                style={{ ...S.btn("ghost"), padding: "7px 10px", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>
                {fxLoading ? "⏳" : "🔄"}
              </button>
            </div>
            {fxUpdated && <div style={{ fontSize: 10, color: "#adb5bd", marginTop: 3 }}>{fxUpdated}</div>}
          </div>
          <div>
            <label style={S.label}>ส่วนลดท้ายบิล</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" value={header.discount_percent} onChange={setH("discount_percent")} style={{ ...S.input, flex: 1 }} placeholder="0" min="0" />
              <select value={header.discount_type || "percent"} onChange={setH("discount_type")} style={{ ...S.input, width: 72, padding: "9px 6px", flexShrink: 0 }}>
                <option value="percent">%</option>
                <option value="amount">฿</option>
              </select>
            </div>
          </div>
          <div><label style={S.label}>VAT (%)</label><input type="number" value={header.vat_percent} onChange={setH("vat_percent")} style={S.input} placeholder="7" /></div>
          <div>
            <label style={S.label}>WHT หัก ณ ที่จ่าย (%)</label>
            <select value={header.wht_percent || 0} onChange={setH("wht_percent")} style={S.input}>
              <option value={0}>ไม่หัก</option>
              <option value={1}>1%</option>
              <option value={3}>3%</option>
              <option value={5}>5%</option>
            </select>
          </div>
          <div>
            <label style={S.label}>ส่วนลดรายการ (mode)</label>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              {[{ v: "percent", l: "% ต่อรายการ" }, { v: "amount", l: "฿ ต่อรายการ" }].map(m => (
                <button key={m.v} type="button" onClick={() => setHeader(h => ({ ...h, item_disc_mode: m.v }))}
                  style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: "1px solid", fontSize: 12, cursor: "pointer",
                    background: (header.item_disc_mode || "percent") === m.v ? "#0F6E56" : "#fff",
                    borderColor: (header.item_disc_mode || "percent") === m.v ? "#0F6E56" : "#dee2e6",
                    color: (header.item_disc_mode || "percent") === m.v ? "#fff" : "#495057" }}>
                  {m.l}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <input type="checkbox" id="show_disc" checked={header.show_disc_col !== false}
                onChange={e => setHeader(h => ({ ...h, show_disc_col: e.target.checked }))}
                style={{ accentColor: "#0F6E56" }} />
              <label htmlFor="show_disc" style={{ fontSize: 12, color: "#6c757d", cursor: "pointer" }}>แสดงคอลัมน์ส่วนลด</label>
            </div>
          </div>
        </div>
      </div>

      {/* Customer */}
      <div style={{ ...S.card, marginBottom: 16, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? "none" : "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>ข้อมูลลูกค้า</div>
          <SearchableCustomerSelect
            value={header.customer_id}
            onChange={(c) => selectCustomer(c)}
            customers={customers}
            onCustomerAdded={(c) => setCustomers(prev => [c, ...prev])}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={S.label}>ชื่อลูกค้า<span style={{ color: "#dc3545" }}>*</span></label><input value={header.customer_name} onChange={setH("customer_name")} style={S.input} /></div>
          <div><label style={S.label}>เลขประจำตัวผู้เสียภาษี</label><input value={header.customer_tax_id} onChange={setH("customer_tax_id")} style={S.input} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={S.label}>ที่อยู่</label><textarea value={header.customer_address} onChange={setH("customer_address")} rows={2} style={{ ...S.input, resize: "vertical" }} /></div>
          <div><label style={S.label}>โทรศัพท์</label><input value={header.customer_phone} onChange={setH("customer_phone")} style={S.input} /></div>
          <div><label style={S.label}>สาขา / Branch</label>
            <input value={header.customer_branch || ""} onChange={setH("customer_branch")} placeholder="ดึงจาก Master อัตโนมัติ หรือพิมพ์เอง" style={S.input} />
          </div>
          <ContactPicker
            customerId={header.customer_id}
            customerName={header.customer_name}
            value={header.customer_contact ? { name: header.customer_contact, phone: header.customer_phone } : null}
            onChange={(c) => setHeader(h => ({ ...h, contact_id: c.id || null, customer_contact: c.name, customer_phone: c.phone || h.customer_phone }))}
            docType="quotation"
          />
        </div>
      </div>

      {/* Line Items */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>รายการสินค้า/บริการ</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("ghost")} onClick={addManualItem}>+ เพิ่มรายการเอง</button>
            <button style={S.btn("primary")} onClick={() => setShowItemPicker(true)}>+ เลือกจาก Master</button>
          </div>
        </div>

        {showItemPicker && (
          <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>เลือกสินค้า/บริการ</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#adb5bd" }} onClick={() => setShowItemPicker(false)}>✕</button>
            </div>
            <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="พิมพ์ค้นหา..." style={{ ...S.input, marginBottom: 10 }} />
            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredItems.map(item => (
                <div key={item.id} onClick={() => addItem(item, item._type)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#fff", borderRadius: 8, cursor: "pointer", border: "1px solid #dee2e6" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0fff4"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <div>
                    <span style={S.badge(item._type === "product" ? "blue" : "green")}>{item._type === "product" ? "สินค้า" : "บริการ"}</span>
                    <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500 }}>{item.code}</span>
                    <span style={{ marginLeft: 6, fontSize: 13, color: "#495057" }}>{item.name_th}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#6c757d" }}>฿{fmt(item.price_thb)}</span>
                </div>
              ))}
              {filteredItems.length === 0 && <div style={{ textAlign: "center", padding: 16, color: "#adb5bd", fontSize: 13 }}>ไม่พบรายการ</div>}
            </div>
          </div>
        )}

        {items.length === 0 ? <EmptyState icon="📦" text="ยังไม่มีรายการ กด + เพื่อเพิ่ม" />
          : (
            <table style={{ ...S.table, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={S.th}>#</th>
                  <th style={S.th}>รหัส</th>
                  <th style={S.th}>ชื่อ</th>
                  <th style={S.th}>หน่วย</th>
                  <th style={{ ...S.th, textAlign: "right" }}>จำนวน</th>
                  <th style={{ ...S.th, textAlign: "right" }}>ราคา (THB)</th>
                  <th style={{ ...S.th, textAlign: "right" }}>FX (1$=฿)</th>
                  <th style={{ ...S.th, textAlign: "right" }}>ราคา (USD)</th>
                  {header.show_disc_col !== false && (
                    <th style={{ ...S.th, textAlign: "right" }}>
                      ส่วนลด{(header.item_disc_mode || "percent") === "percent" ? " %" : " (฿)"}
                    </th>
                  )}
                  <th style={{ ...S.th, textAlign: "right" }}>รวม (THB)</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item._id || item.id}>
                    <td style={S.td}>{idx + 1}</td>
                    <td style={S.td}><input value={item.code || ""} onChange={e => updateItem(idx, "code", e.target.value)} style={{ ...S.input, width: 70, padding: "4px 8px" }} /></td>
                    <td style={S.td}><input value={item.name_th || ""} onChange={e => updateItem(idx, "name_th", e.target.value)} style={{ ...S.input, width: 160, padding: "4px 8px", marginBottom: 3 }} />
                      <textarea value={item.description || ""} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="รายละเอียด..." rows={2} style={{ ...S.input, width: 160, padding: "4px 8px", fontSize: 11, resize: "vertical", display: "block" }} />
                    </td>
                    <td style={S.td}><input value={item.unit || ""} onChange={e => updateItem(idx, "unit", e.target.value)} style={{ ...S.input, width: 60, padding: "4px 8px" }} /></td>
                    <td style={S.td}><input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} style={{ ...S.input, width: 60, padding: "4px 8px", textAlign: "right" }} /></td>
                    <td style={S.td}><input type="number" value={item.price_thb} onChange={e => updateItem(idx, "price_thb", e.target.value)} style={{ ...S.input, width: 90, padding: "4px 8px", textAlign: "right" }} /></td>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <input type="number" value={item.item_fx_rate ?? header.fx_rate} onChange={e => updateItem(idx, "item_fx_rate", e.target.value)}
                          style={{ ...S.input, width: 72, padding: "4px 6px", textAlign: "right", fontFamily: "monospace",
                            background: item.item_fx_rate != null && item.item_fx_rate != header.fx_rate ? "#fffbeb" : undefined,
                            borderColor: item.item_fx_rate != null && item.item_fx_rate != header.fx_rate ? "#fbbf24" : undefined }} />
                        {item.item_fx_rate != null && item.item_fx_rate != header.fx_rate && (
                          <button type="button" title="รีเซ็ตเป็นค่ากลาง" onClick={() => updateItem(idx, "item_fx_rate", null)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#f59e0b", fontSize: 13, padding: 0 }}>↩</button>
                        )}
                      </div>
                    </td>
                    <td style={S.td}><input type="number" value={item.price_usd} onChange={e => updateItem(idx, "price_usd", e.target.value)} style={{ ...S.input, width: 80, padding: "4px 8px", textAlign: "right" }} /></td>
                    {header.show_disc_col !== false && (
                      <td style={S.td}>
                        {(header.item_disc_mode || "percent") === "percent"
                          ? <input type="number" value={item.discount_percent || 0} onChange={e => updateItem(idx, "discount_percent", e.target.value)} style={{ ...S.input, width: 65, padding: "4px 8px", textAlign: "right" }} min="0" max="100" />
                          : <input type="number" value={item.discount_amount || 0} onChange={e => updateItem(idx, "discount_amount", e.target.value)} style={{ ...S.input, width: 80, padding: "4px 8px", textAlign: "right" }} min="0" />
                        }
                      </td>
                    )}
                    <td style={{ ...S.td, textAlign: "right", fontWeight: 500 }}>{fmt(item.line_total_thb)}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {!item.ref_id && (
                          <button
                            title="บันทึกลง Master"
                            onClick={() => saveItemToMaster(item, idx)}
                            style={{ background: "none", border: "1px solid #dee2e6", borderRadius: 4, cursor: "pointer", color: "#0F6E56", fontSize: 11, padding: "2px 6px", whiteSpace: "nowrap" }}
                          >💾</button>
                        )}
                        {item.ref_id && <span title="ดึงจาก Master" style={{ fontSize: 11, color: "#adb5bd" }}>📦</span>}
                        <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc3545", fontSize: 16 }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        {/* Summary */}
        {items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <div style={{ width: 340, fontSize: 13 }}>
              {(() => {
                const billDiscType = header.discount_type || "percent";
                const discLabel = discAmt > 0
                  ? (billDiscType === "percent" ? `ส่วนลดท้ายบิล (${header.discount_percent}%)` : `ส่วนลดท้ายบิล (฿${fmt(header.discount_percent)})`)
                  : null;
                const rows = [
                  { label: "ยอดรวมก่อนหักส่วนลด", thb: subtotalTHB, usd: subtotalUSD, color: "#495057" },
                  discLabel && { label: discLabel, thb: -discAmt, usd: -discAmtUSD, color: "#dc3545" },
                  { label: `VAT (${header.vat_percent || 0}%)`, thb: vatAmt, usd: vatAmtUSD, color: "#495057" },
                  (parseFloat(header.wht_percent) || 0) > 0 && { label: `WHT หัก ณ ที่จ่าย (${header.wht_percent}%)`, thb: -whtAmt, usd: -whtAmtUSD, color: "#6b21a8" },
                ].filter(Boolean);
                return rows.map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f3f5", color: row.color }}>
                    <span>{row.label}</span>
                    <span>{row.thb < 0 ? "-" : ""}฿{fmt(Math.abs(row.thb))} / ${fmt(Math.abs(row.usd), 2)}</span>
                  </div>
                ));
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 700, fontSize: 15, color: "#0F6E56" }}>
                <span>ยอดสุทธิ</span>
                <span>฿{fmt(total)} / ${fmt(totalUSD)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Note */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <label style={S.label}>หมายเหตุ</label>
        <textarea value={header.note} onChange={setH("note")} rows={3} style={{ ...S.input, resize: "vertical" }} placeholder="เงื่อนไขการชำระเงิน ข้อตกลงพิเศษ ฯลฯ" />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={S.btn("ghost")} onClick={onBack}>ยกเลิก</button>
        <button style={S.btn("ghost")} onClick={() => setPreview(true)}>👁 Preview / Print</button>
        {!isReadOnly && <>
          <button style={S.btn("ghost")} onClick={() => handleSave("draft")} disabled={saving}>💾 บันทึกร่าง</button>
          <button style={S.btn("primary")} onClick={() => handleSave("sent")} disabled={saving}>{saving ? "กำลังบันทึก..." : "✅ บันทึก & ส่ง"}</button>
        </>}
      </div>
    </div>
  );
}

function QuotationPreview({ header, items, subtotalTHB, subtotalUSD, discAmt, discAmtUSD, vatAmt, vatAmtUSD, whtAmt = 0, whtAmtUSD = 0, total, totalUSD, currency, onClose, onChangeCurrency, userName = "ผู้ใช้งาน" }) {
  const showTHB = currency === "THB" || currency === "BOTH";
  const showUSD = currency === "USD" || currency === "BOTH";
  const [company, setCompany] = useState(null);

  useEffect(() => {
    sb.db.list("company_settings").then(rows => {
      if (rows && rows.length > 0) setCompany(rows[0]);
    });
  }, []);

  const docDate = header.doc_date
    ? new Date(header.doc_date).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
    : "—";
  const expireDate = header.doc_date && header.valid_days
    ? new Date(new Date(header.doc_date).getTime() + header.valid_days * 86400000).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
    : `${header.valid_days} วัน`;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={S.btn("ghost")} onClick={onClose}>← กลับแก้ไข</button>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#495057" }}>Preview ใบเสนอราคา</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#adb5bd" }}>แสดงราคา:</span>
          {["THB", "USD", "BOTH"].map(c => (
            <button key={c} onClick={() => onChangeCurrency(c)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                background: currency === c ? "#0F6E56" : "#fff",
                borderColor: currency === c ? "#0F6E56" : "#dee2e6",
                color: currency === c ? "#fff" : "#495057" }}>
              {c === "BOTH" ? "THB + USD" : c}
            </button>
          ))}
          <button onClick={() => window.print()}
            style={{ padding: "7px 18px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", background: "#0F6E56", color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
            🖨️ พิมพ์
          </button>
        </div>
      </div>

      {/* Document */}
      <div id="print-area" style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 16, maxWidth: 900, margin: "0 auto", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

        {/* Green top bar */}
        <div style={{ background: "#0F6E56", height: 6 }} />

        <div style={{ padding: "36px 48px" }}>

          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>

            {/* LEFT — Company */}
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flex: 1, paddingRight: 40 }}>
              {company?.logo_url && (
                <img src={company.logo_url} alt="logo"
                  style={{ maxWidth: 100, maxHeight: 64, objectFit: "contain", flexShrink: 0 }}
                  onError={e => { e.target.style.display = "none"; }} />
              )}
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 2 }}>
                  {company?.name_th || "ชื่อบริษัทของคุณ"}
                </div>
                {company?.name_en && (
                  <div style={{ fontSize: 12, color: "#6c757d", marginBottom: 8 }}>{company.name_en}</div>
                )}
                {company?.address_th && (
                  <div style={{ fontSize: 12, color: "#495057", lineHeight: 1.65, maxWidth: 300, marginBottom: 8 }}>{company.address_th}</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                  {company?.tax_id && (
                    <div style={{ color: "#adb5bd", fontSize: 11, marginTop: 4, paddingTop: 6, borderTop: "1px solid #f1f3f5" }}>
                      เลขประจำตัวผู้เสียภาษี: {company.tax_id}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT — Doc info + Contact */}
            <div style={{ textAlign: "right", minWidth: 240, flexShrink: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#0F6E56", letterSpacing: "-0.02em", lineHeight: 1 }}>ใบเสนอราคา</div>
              <div style={{ fontSize: 12, color: "#adb5bd", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Quotation</div>

              {(company?.contact_name || company?.contact_phone) && (
              <div style={{ background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 10, padding: "14px 16px", textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  ผู้ติดต่อ · Contact
                </div>
                {company?.contact_name && (
                  <div style={{ fontWeight: 600, color: "#1a1a1a", fontSize: 13, marginBottom: 4 }}>
                    {company.contact_name}
                  </div>
                )}
                {company?.contact_phone && (
                  <div style={{ fontSize: 12, color: "#495057" }}>📱 {company.contact_phone}</div>
                )}
              </div>
            )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "linear-gradient(to right, #0F6E56, #e9ecef)", marginBottom: 24 }} />

          {/* Customer + Doc Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28, alignItems: "start" }}>
            {/* Left - customer */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>ชื่อลูกค้า</div>
              <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "16px 20px", fontSize: 13 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 4 }}>
                  {header.customer_name}
                  {header.customer_branch && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "#065f46" }}>({header.customer_branch})</span>}
                </div>
                {header.customer_tax_id && <div style={{ color: "#6c757d", fontSize: 12, marginBottom: 4 }}>เลขประจำตัวผู้เสียภาษี: {header.customer_tax_id}</div>}
                {header.customer_address && <div style={{ color: "#495057", lineHeight: 1.65, marginBottom: 4 }}>{header.customer_address}</div>}
                {header.customer_contact && <div style={{ color: "#6c757d", fontSize: 12 }}>ผู้ติดต่อ: {header.customer_contact}{header.customer_phone ? ` · ${header.customer_phone}` : ""}</div>}
              </div>
            </div>
            {/* Right - doc summary + contact */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>รายละเอียดเอกสาร</div>
                <div style={{ background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 10, padding: "16px 20px", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #9ae6b4" }}>
                    <span style={{ color: "#6c757d", fontSize: 12 }}>เลขที่เอกสาร</span>
                    <span style={{ fontWeight: 700, color: "#0F6E56" }}>{header.doc_number}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#6c757d", fontSize: 12 }}>วันที่</span>
                    <span style={{ color: "#495057" }}>{header.doc_date ? new Date(header.doc_date).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) : "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#6c757d", fontSize: 12 }}>หมดอายุ</span>
                    <span style={{ color: "#495057" }}>{expireDate}</span>
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
            <thead>
              <tr>
                {["#", "รายการ", "จำนวน", "หน่วย",
                  ...(showTHB ? ["ราคา/หน่วย (฿)"] : []),
                  ...(showUSD ? ["ราคา/หน่วย ($)"] : []),
                  ...(header.show_disc_col !== false ? ["ส่วนลด"] : []),
                  ...(showTHB ? ["รวม (฿)"] : []),
                  ...(showUSD ? ["รวม ($)"] : []),
                ].map(h => (
                  <th key={h} style={{
                    padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#fff",
                    background: "#0F6E56", letterSpacing: "0.04em",
                    textAlign: ["#", "จำนวน", "หน่วย"].includes(h) ? "center"
                      : h.includes("฿") || h.includes("$") || h === "ส่วนลด" ? "right" : "left"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", color: "#adb5bd", fontSize: 12, background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{i + 1}</td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <div style={{ fontWeight: 600, color: "#1a1a1a" }}>{item.name_th}</div>
                    {item.name_en && <div style={{ fontSize: 11, color: "#6c757d", marginTop: 1 }}>{item.name_en}</div>}
                    {item.description && <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 2 }}>{item.description}</div>}
                  </td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{fmt(item.qty, 0)}</td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", color: "#6c757d", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{item.unit}</td>
                  {showTHB && <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{fmt(item.price_thb)}</td>}
                  {showUSD && <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>${fmt(item.price_usd, 4)}</td>}
                  {header.show_disc_col !== false && (
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", color: "#dc3545", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      {(header.item_disc_mode || "percent") === "percent"
                        ? (item.discount_percent > 0 ? `${item.discount_percent}%` : <span style={{ color: "#dee2e6" }}>—</span>)
                        : (item.discount_amount > 0 ? `฿${fmt(item.discount_amount)}` : <span style={{ color: "#dee2e6" }}>—</span>)
                      }
                    </td>
                  )}
                  {showTHB && <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", fontWeight: 600, color: "#1a1a1a", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{fmt(item.line_total_thb)}</td>}
                  {showUSD && <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", fontWeight: 600, color: "#1a1a1a", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>${fmt(item.line_total_usd)}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom: Bank + Totals */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 24 }}>
            {/* Bank */}
            {(company?.bank_name || company?.bank_account_no) ? (
              <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "14px 18px", fontSize: 12, color: "#495057", flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>ข้อมูลการชำระเงิน</div>
                {company.bank_name && <div style={{ marginBottom: 3 }}>🏦 {company.bank_name}{company.bank_branch ? ` · สาขา ${company.bank_branch}` : ""}</div>}
                {company.bank_account_no && <div style={{ marginBottom: 3 }}>เลขบัญชี: <strong>{company.bank_account_no}</strong></div>}
                {company.bank_account_name && <div>ชื่อบัญชี: {company.bank_account_name}</div>}
              </div>
            ) : <div style={{ flex: 1 }} />}

            {/* Totals */}
            <div style={{ minWidth: 300, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f3f5", color: "#6c757d" }}>
                <span>ยอดรวมก่อนหักส่วนลด</span>
                <span>{showTHB && `฿${fmt(subtotalTHB)}`}{showTHB && showUSD && " / "}{showUSD && `$${fmt(subtotalUSD)}`}</span>
              </div>
              {discAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f3f5", color: "#dc3545" }}>
                  <span>{(header.discount_type || "percent") === "percent" ? `ส่วนลด (${header.discount_percent}%)` : `ส่วนลด (฿${fmt(header.discount_percent)})`}</span>
                  <span>-{showTHB && `฿${fmt(discAmt)}`}{showTHB && showUSD && " / "}{showUSD && `-$${fmt(discAmtUSD)}`}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f3f5", color: "#6c757d" }}>
                <span>VAT ({header.vat_percent}%)</span>
                <span>{showTHB && `฿${fmt(vatAmt)}`}{showTHB && showUSD && " / "}{showUSD && `$${fmt(vatAmtUSD)}`}</span>
              </div>
              {(parseFloat(header.wht_percent) || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f3f5", color: "#6b21a8" }}>
                  <span>หัก ณ ที่จ่าย ({header.wht_percent}%)</span>
                  <span>-{showTHB && `฿${fmt(whtAmt)}`}{showTHB && showUSD && " / "}{showUSD && `-$${fmt(whtAmtUSD)}`}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", fontWeight: 700, fontSize: 16, color: "#fff", background: "#0F6E56", borderRadius: 8, marginTop: 8 }}>
                <span>ยอดสุทธิ</span>
                <span>{showTHB && `฿${fmt(total)}`}{showTHB && showUSD && " / "}{showUSD && `$${fmt(totalUSD)}`}</span>
              </div>
            </div>
          </div>

          {/* Note */}
          {header.note && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#92400e", marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>หมายเหตุ</div>
              <div style={{ lineHeight: 1.65 }}>{header.note}</div>
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 32, paddingTop: 24, borderTop: "1px solid #f1f3f5" }}>
            {/* ผู้เสนอราคา — ใช้ชื่อผู้ login */}
            <div style={{ textAlign: "center" }}>
              <div style={{ height: 48, borderBottom: "1.5px solid #dee2e6", marginBottom: 10 }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: "#343a40" }}>ผู้เสนอราคา</div>
              <div style={{ fontSize: 12, color: "#495057", marginTop: 2 }}>{header._proposerName || userName}</div>
              {(header._proposerPosition || header._userPosition || company?.contact_title) && (
                <div style={{ fontSize: 11, color: "#6c757d", marginTop: 1 }}>{header._proposerPosition || header._userPosition || company?.contact_title}</div>
              )}
              <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 4 }}>วันที่ ___________________</div>
            </div>
            {/* ผู้มีอำนาจอนุมัติ / ลูกค้า */}
            <div style={{ textAlign: "center" }}>
              <div style={{ height: 48, borderBottom: "1.5px solid #dee2e6", marginBottom: 10 }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: "#343a40" }}>ผู้มีอำนาจอนุมัติ / ลูกค้า</div>
              <div style={{ fontSize: 12, color: "#adb5bd", marginTop: 2, height: 16 }}>&nbsp;</div>
              {/* บรรทัดว่างให้ลูกค้าเขียน */}
              <div style={{ marginTop: 10, marginBottom: 4, borderBottom: "1px dashed #dee2e6", height: 22 }} />
              <div style={{ fontSize: 11, color: "#adb5bd" }}>(ตำแหน่ง / หน่วยงาน)</div>
              <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 12 }}>วันที่ ___________________</div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div style={{ background: "#f8f9fa", borderTop: "1px solid #e9ecef", padding: "12px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#adb5bd" }}>
          <span>{company?.name_th}</span>
          <span>{header.doc_number} · {docDate}</span>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#print-area) { display: none !important; }
          #print-area { box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}

// ─── INVOICE MODULE ───────────────────────────────────────────────────────────
const DOC_TYPES = {
  full: { label: "ใบแจ้งหนี้/ใบกำกับภาษี/ใบส่งของ", labelEn: "Invoice / Tax Invoice / Delivery", color: "#1e40af", bg: "#dbeafe" },
  invoice: { label: "ใบแจ้งหนี้/วางบิล", labelEn: "Invoice", color: "#065f46", bg: "#d1fae5" },
};

const STATUS_INV = {
  draft: { label: "ร่าง", color: "gray" },
  sent: { label: "ส่งแล้ว", color: "blue" },
  partial: { label: "ชำระบางส่วน", color: "amber" },
  paid: { label: "ออกใบเสร็จครบ", color: "green" },
  cancelled: { label: "ยกเลิก", color: "red" },
};

// ─── INVOICE STATUS BADGE (for Receipt list) ──────────────────────────────────
function InvoiceStatusBadge({ invoiceId }) {
  const [status, setStatus] = React.useState(null);

  React.useEffect(() => {
    if (!invoiceId) return;
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const hdrs = sb.h(token);
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoiceId}&select=doc_number,total,vat_amount,status`, { headers: hdrs }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/receipts?invoice_id=eq.${invoiceId}&status=neq.cancelled&select=total,subtotal,vat_amount`, { headers: hdrs }).then(r => r.json()),
    ]).then(([invData, recData]) => {
      if (!Array.isArray(invData) || invData.length === 0) return;
      const inv = invData[0];
      const totalPaid = Array.isArray(recData) ? recData.reduce((s, r) => s + (parseFloat(r.total) || 0), 0) : 0;
      // Use subtotal (before VAT) from receipts directly
      const paidBeforeVat = Array.isArray(recData) ? recData.reduce((s, r) => {
        const rSubtotal = parseFloat(r.subtotal);
        if (!isNaN(rSubtotal) && rSubtotal > 0) return s + rSubtotal;
        // fallback: subtract VAT from total
        return s + (parseFloat(r.total) || 0) - (parseFloat(r.vat_amount) || 0);
      }, 0) : 0;
      const invTotal = parseFloat(inv.total) || 0;
      const invVat = parseFloat(inv.vat_amount || 0);
      const invBeforeVat = invTotal - invVat;
      const isFull = totalPaid >= invTotal && totalPaid > 0;
      setStatus({ doc_number: inv.doc_number, beforeVat: invBeforeVat, total: invTotal, paid: paidBeforeVat, isFull });
    });
  }, [invoiceId]);

  if (!status) return <span style={{ color: "#adb5bd", fontSize: 11 }}>...</span>;

  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ color: "#6c757d" }}>{status.doc_number}</div>
      {status.isFull
        ? <span style={{ color: "#065f46", fontWeight: 600 }}>✅ ครบแล้ว</span>
        : <span style={{ color: "#d97706", fontWeight: 600 }}>ค้าง ฿{fmt(status.beforeVat - status.paid)}</span>
      }
    </div>
  );
}

// ─── RECEIPT LIST FOR INVOICE (popup in INV list) ────────────────────────────
function InvoiceReceiptList({ invoiceId, onClose }) {
  const [receipts, setReceipts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    fetch(`${SUPABASE_URL}/rest/v1/receipts?invoice_id=eq.${invoiceId}&order=created_at.asc&select=*`, {
      headers: sb.h(token)
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setReceipts(data);
      setLoading(false);
    });
  }, [invoiceId]);

  return (
    <Modal title="ใบเสร็จที่ออกสำหรับ Invoice นี้" onClose={onClose}>
      {loading ? <div style={{ textAlign: "center", padding: 20, color: "#adb5bd" }}>กำลังโหลด...</div>
        : receipts.length === 0 ? <EmptyState icon="✅" text="ยังไม่มีใบเสร็จ" />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {receipts.map(r => {
              const rt = RECEIPT_TYPES[r.receipt_number_type || r.doc_type] || RECEIPT_TYPES.receipt_service;
              return (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f8f9fa", borderRadius: 8, fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#065f46" }}>{r.doc_number}</div>
                    <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 2 }}>
                      {new Date(r.doc_date).toLocaleDateString("th-TH")} · {rt.label}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#6c757d" }}>ก่อน VAT ฿{fmt(r.subtotal != null ? r.subtotal : (parseFloat(r.total||0) - parseFloat(r.vat_amount||0)))}</div>
                    <div style={{ fontWeight: 600, color: "#343a40" }}>฿{fmt(r.total)}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid #dee2e6", paddingTop: 10, display: "flex", justifyContent: "flex-end", fontSize: 13 }}>
              <span style={{ color: "#6c757d", marginRight: 12 }}>รวมชำระแล้ว</span>
              <span style={{ fontWeight: 700, color: "#065f46" }}>฿{fmt(receipts.reduce((s, r) => s + (parseFloat(r.total) || 0), 0))}</span>
            </div>
          </div>
        )}
    </Modal>
  );
}

function InvoiceList({ onNew, onEdit, onConvertToReceipt }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [customers, setCustomers] = useState([]);
  const [receiptPopup, setReceiptPopup] = useState(null); // invoice_id

  const load = useCallback(async () => {
    setLoading(true);
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const hdrs = sb.h(token);

    // Load invoices via sb.db.list (handles auth properly)
    const [invoiceList, recRes, custs] = await Promise.all([
      sb.db.list("invoices", search, ["doc_number", "customer_name", "customer_po"]),
      fetch(`${SUPABASE_URL}/rest/v1/receipts?select=invoice_id,total&status=neq.cancelled`, { headers: hdrs }).then(r => r.json()),
      customers.length === 0 ? sb.db.list("customers") : Promise.resolve(customers),
    ]);

    // Sum receipts per invoice
    const recByInv = {};
    if (Array.isArray(recRes)) {
      recRes.forEach(r => {
        if (r.invoice_id) recByInv[r.invoice_id] = (recByInv[r.invoice_id] || 0) + (parseFloat(r.total) || 0);
      });
    }

    // Merge real paid_amount
    const merged = (invoiceList || []).map(inv => {
      const realPaid = recByInv[inv.id] || 0;
      const invTotal = parseFloat(inv.total) || 0;
      const realStatus = inv.status === "cancelled" ? "cancelled"
        : realPaid >= invTotal && realPaid > 0 ? "paid"
        : realPaid > 0 ? "partial"
        : inv.status;
      return { ...inv, paid_amount: realPaid, status: realStatus };
    });

    setRows(merged);
    if (customers.length === 0) setCustomers(custs || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const fetchFxRate = async () => {
    setFxLoading(true);
    try {
      // Try multiple sources for reliability
      let rate = null;
      let dateStr = "";

      // Source 1: Exchange Rate API (no key needed, CORS friendly)
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data?.rates?.THB) {
        rate = parseFloat(data.rates.THB.toFixed(4));
        const d = new Date(data.time_last_update_utc);
        dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
      }

      if (rate) {
        setFxRate(rate);
        setFxUpdated(`อัปเดต: ${dateStr}`);
      } else {
        setFxUpdated("ดึงข้อมูลไม่ได้ ใช้ค่าเดิม");
      }
    } catch (e) {
      setFxUpdated("ดึงข้อมูลไม่ได้ ใช้ค่าเดิม");
    }
    setFxLoading(false);
  };

  const filtered = applyDocFilters(rows, filters, customers);
  const { sorted: sortedRows, Th: SortTh } = useSortable(filtered, "doc_date", "desc");

  return (
    <div>
      <h1 style={S.pageTitle}>🧾 ใบแจ้งหนี้</h1>
      <p style={S.pageSub}>จัดการใบแจ้งหนี้และใบกำกับภาษีทั้งหมด</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาเลขที่ ลูกค้า หรือ PO..." />
        {onNew && <button style={S.btn("primary")} onClick={onNew}>+ สร้างใบแจ้งหนี้</button>}
      </div>
      <DocFilterBar filters={filters} onChange={setFilters} customers={customers}
        statusOptions={[
          { value: "draft", label: "ร่าง" },
          { value: "sent", label: "ส่งแล้ว" },
          { value: "partial", label: "ออกใบเสร็จบางส่วน" },
          { value: "paid", label: "ออกใบเสร็จครบ" },
          { value: "cancelled", label: "ยกเลิก" },
        ]} />
      <div style={S.card}>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>กำลังโหลด...</div>
          : filtered.length === 0 ? <EmptyState icon="🧾" text={Object.keys(filters).length > 0 ? "ไม่พบเอกสารที่ตรงกับตัวกรอง" : "ยังไม่มีใบแจ้งหนี้"} />
          : (
            <table style={S.table}>
              <thead>
                <tr>
                  <SortTh k="doc_number">เลขที่</SortTh>
                  <SortTh k="doc_type">ประเภท</SortTh>
                  <SortTh k="doc_date">วันที่</SortTh>
                  <SortTh k="customer_name">ลูกค้า</SortTh>
                  <SortTh k="customer_po">Customer PO</SortTh>
                  <SortTh k="quotation_number">อ้างอิง QT</SortTh>
                  <SortTh k="subtotal" style={{ textAlign: "right" }}>ก่อน VAT</SortTh>
                  <SortTh k="total" style={{ textAlign: "right" }}>ยอดรวม</SortTh>
                  <SortTh k="paid_amount" style={{ textAlign: "right" }}>ชำระแล้ว</SortTh>
                  <th style={{ ...S.th, textAlign: "right" }}>คงเหลือ</th>
                  <SortTh k="status">สถานะ</SortTh>
                  <th style={S.th}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(r => {
                  const dt = DOC_TYPES[r.doc_type] || DOC_TYPES.invoice;
                  const st = STATUS_INV[r.status] || STATUS_INV.draft;
                  return (
                    <tr key={r.id} onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={S.td}><span style={{ fontWeight: 500, color: "#1e40af" }}>{r.doc_number}</span></td>
                      <td style={S.td}><span style={{ ...S.badge("blue"), background: dt.bg, color: dt.color, fontSize: 11 }}>{dt.label}</span></td>
                      <td style={S.td}>{r.doc_date ? new Date(r.doc_date).toLocaleDateString("th-TH") : "—"}</td>
                      <td style={S.td}>{r.customer_name || "—"}</td>
                      <td style={S.td}><span style={{ fontSize: 12, color: "#6c757d" }}>{r.customer_po || "—"}</span></td>
                      <td style={S.td}><span style={{ fontSize: 12, color: "#6c757d" }}>{r.quotation_number || "—"}</span></td>
                      {(() => {
                        const vatAmt = parseFloat(r.vat_amount || 0);
                        const total = parseFloat(r.total || 0);
                        const beforeVat = total - vatAmt;
                        const paidTotal = parseFloat(r.paid_amount || 0);
                        // Convert paid to before-VAT equivalent
                        const vatRate = total > 0 ? vatAmt / total : 0;
                        const paidBeforeVat = vatRate > 0 ? paidTotal / (1 + vatAmt / beforeVat) : paidTotal;
                        const remainBeforeVat = beforeVat - paidBeforeVat;
                        const isFullyPaid = r.status === "paid" || paidTotal >= total;
                        return (<>
                          <td style={{ ...S.td, textAlign: "right", color: "#495057" }}>฿{fmt(beforeVat)}</td>
                          <td style={{ ...S.td, textAlign: "right", fontWeight: 500 }}>฿{fmt(total)}</td>
                          <td style={{ ...S.td, textAlign: "right", color: "#065f46" }}>
                            {paidTotal > 0 ? `฿${fmt(paidBeforeVat)}` : <span style={{ color: "#dee2e6" }}>—</span>}
                          </td>
                          <td style={{ ...S.td, textAlign: "right" }}>
                            {r.status === "cancelled" ? <span style={{ color: "#dee2e6" }}>—</span>
                              : isFullyPaid ? <span style={{ color: "#065f46", fontSize: 11, fontWeight: 600 }}>✅ ออกใบเสร็จครบ</span>
                              : paidTotal === 0 ? <span style={{ color: "#adb5bd" }}>—</span>
                              : <span style={{ color: "#dc3545", fontWeight: 600 }}>฿{fmt(remainBeforeVat)}</span>}
                          </td>
                        </>);
                      })()}
                      <td style={S.td}><span style={S.badge(st.color)}>{st.label}</span></td>
                      <td style={S.td}>
                        <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12 }} onClick={() => onEdit(r)}>✏️ เปิด</button>
                      <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12, color: "#065f46" }} onClick={() => setReceiptPopup(r.id)}>✅ ใบเสร็จ</button>
                      {onNew && onConvertToReceipt && (() => {
                        const paid = parseFloat(r.paid_amount || 0);
                        const total = parseFloat(r.total || 0);
                        const isFullyPaid = r.status === "paid" || (paid > 0 && paid >= total);
                        if (isFullyPaid || r.status === "cancelled") return null;
                        return (
                          <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12, color: "#065f46", borderColor: "#065f46" }}
                            onClick={() => onConvertToReceipt(r)}>✅ → ใบเสร็จ</button>
                        );
                      })()}
                      {onNew && !["paid", "cancelled"].includes(r.status) && (
                        <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 11, color: "#adb5bd" }} onClick={async () => {
                          const confirmed = prompt(`พิมพ์ "ยกเลิก" เพื่อยืนยันการยกเลิก ${r.doc_number}`);
                          if (confirmed !== "ยกเลิก") return;
                          await sb.db.update("invoices", r.id, { status: "cancelled" });
                          load();
                        }}>✕</button>
                      )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
      {receiptPopup && <InvoiceReceiptList invoiceId={receiptPopup} onClose={() => setReceiptPopup(null)} />}
    </div>
  );
}

function InvoiceForm({ doc, onBack }) {
  const isNew = !doc?.id;
  const isLocked = !isNew && ["sent", "paid", "cancelled"].includes(doc?.status);
  const [unlocked, setUnlocked] = useState(false);
  const isReadOnly = isLocked && !unlocked;
  const [header, setHeader] = useState({
    doc_number: doc?.doc_number || "",
    doc_type: doc?.doc_type || "full",
    invoice_number_type: doc?.invoice_number_type || "invoice_product",
    doc_date: doc?.doc_date || new Date().toISOString().slice(0, 10),
    customer_po: doc?.customer_po || "",
    quotation_id: doc?.quotation_id || "",
    quotation_number: doc?.quotation_number || "",
    currency: doc?.currency || "THB",
    fx_rate: doc?.fx_rate || 36,
    discount_percent: doc?.discount_percent || 0,
    vat_percent: doc?.vat_percent || 7,
    note: doc?.note || "",
    status: doc?.status || "draft",
    customer_id: doc?.customer_id || "",
    customer_name: doc?.customer_name || "",
    customer_address: doc?.customer_address || "",
    customer_tax_id: doc?.customer_tax_id || "",
    customer_contact: doc?.customer_contact || "",
    customer_phone: doc?.customer_phone || "",
    customer_email: doc?.customer_email || "",
    customer_branch: doc?.customer_branch || "",
    contact_id: doc?.contact_id || null,
  });
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [quotations, setQuotations] = useState([]);

  useEffect(() => {
    sb.db.list("customers").then(setCustomers);
    sb.db.list("products").then(setProducts);
    sb.db.list("services").then(setServices);
    sb.db.list("quotations").then(setQuotations);
    // Load default VAT rate from settings
    if (!doc?.id) {
      sb.db.list("company_settings").then(rows => {
        if (rows?.length > 0 && rows[0].vat_rate != null) {
          setHeader(h => ({ ...h, vat_percent: rows[0].vat_rate }));
        }
      });
    }
    // Convert from Quotation if triggered from QT list
    if (doc?._convertFromQT) {
      const qt = doc._convertFromQT;
      setHeader(h => ({
        ...h,
        customer_id: qt.customer_id, customer_name: qt.customer_name,
        customer_address: qt.customer_address || "", customer_tax_id: qt.customer_tax_id || "",
        customer_branch: qt.customer_branch || "", customer_po: qt.customer_po || "",
        currency: qt.currency, fx_rate: qt.fx_rate,
        discount_percent: qt.discount_percent, vat_percent: qt.vat_percent,
        note: stripDocMeta(qt.note) || "", quotation_id: qt.id, quotation_number: qt.doc_number,
      }));
    }
    if (!doc?.id && !header.doc_number) {
      previewNextDocNumber(header.invoice_number_type || "invoice_product").then(num => { if (num) setHeader(h => ({ ...h, doc_number: num, _docNumberPreview: true })); });
    }
    if (doc?.id) {
      fetch(`${SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.${doc.id}&order=item_order.asc&select=*`, {
        headers: sb.h()
      }).then(r => r.json()).then(data => { if (Array.isArray(data)) setItems(data.map(i => ({ ...i, _id: i.id }))); });
    }
  }, [doc]);

  // แยก useEffect สำหรับดึง QT items ตอน convert เพื่อหลีกเลี่ยง race condition
  useEffect(() => {
    if (!doc?._convertFromQT?.id) return;
    const qtId = doc._convertFromQT.id;
    fetch(`${SUPABASE_URL}/rest/v1/quotation_items?quotation_id=eq.${qtId}&order=item_order.asc&select=*`, {
      headers: sb.h()
    }).then(r => r.json()).then(qtItems => {
      if (Array.isArray(qtItems) && qtItems.length > 0) {
        setItems(qtItems.map(i => ({
          _id: Date.now() + Math.random(),
          item_type: i.item_type, ref_id: i.ref_id || null,
          code: i.code, name_th: i.name_th, name_en: i.name_en || "",
          description: i.description || "", unit: i.unit || "",
          qty: i.qty, price_thb: i.price_thb, price_usd: i.price_usd,
          discount_percent: i.discount_percent || 0, discount_amount: i.discount_amount || 0,
          line_total_thb: i.line_total_thb, line_total_usd: i.line_total_usd,
        })));
      }
    }).catch(() => {});
  }, [doc?._convertFromQT?.id]);


  const setH = (k) => (e) => setHeader(h => ({ ...h, [k]: e.target.value }));

  const selectCustomer = (c) => setHeader(h => ({ ...h, customer_id: c.id, customer_name: c.name_th, customer_address: c.address || "", customer_tax_id: c.tax_id || "", customer_contact: "", customer_phone: "", customer_email: c.email || "", customer_branch: c.branch || "", contact_id: null }));

  const convertFromQuotation = async (qtId) => {
    const qt = quotations.find(q => q.id === qtId);
    if (!qt) return;
    setHeader(h => ({
      ...h, quotation_id: qt.id, quotation_number: qt.doc_number,
      customer_id: qt.customer_id, customer_name: qt.customer_name,
      customer_address: qt.customer_address, customer_tax_id: qt.customer_tax_id,
      customer_contact: qt.customer_contact, customer_phone: qt.customer_phone,
      customer_email: qt.customer_email, currency: qt.currency,
      fx_rate: qt.fx_rate, discount_percent: qt.discount_percent,
      vat_percent: qt.vat_percent, note: stripDocMeta(qt.note) || "",
    }));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/quotation_items?quotation_id=eq.${qtId}&order=item_order.asc&select=*`, {
      headers: sb.h()
    });
    const qtItems = await res.json();
    if (Array.isArray(qtItems)) setItems(qtItems.map(i => ({
      _id: Date.now() + Math.random(),
      item_type: i.item_type, ref_id: i.ref_id || null,
      code: i.code, name_th: i.name_th, name_en: i.name_en || "",
      description: i.description || "", unit: i.unit || "",
      qty: i.qty, price_thb: i.price_thb, price_usd: i.price_usd,
      discount_percent: i.discount_percent || 0, discount_amount: i.discount_amount || 0,
      line_total_thb: i.line_total_thb, line_total_usd: i.line_total_usd,
    })));
  };

  const addItem = (src, type) => {
    const fxRate = parseFloat(header.fx_rate) || 36;
    const priceUSD = parseFloat(src.price_usd) || 0;
    const priceTHB = priceUSD > 0
      ? parseFloat((priceUSD * fxRate).toFixed(2))
      : parseFloat(src.price_thb) || 0;
    setItems(prev => [...prev, { _id: Date.now(), item_type: type, ref_id: src.id, code: src.code, name_th: src.name_th, name_en: src.name_en || "", description: src.description || "", unit: src.unit || "", qty: 1, price_thb: priceTHB, price_usd: priceUSD, item_fx_rate: null, discount_percent: 0, discount_amount: 0, line_total_thb: priceTHB, line_total_usd: priceUSD }]);
    setShowItemPicker(false); setItemSearch("");
  };

  const addManualItem = () => setItems(prev => [...prev, { _id: Date.now(), item_type: "product", code: "", name_th: "", name_en: "", description: "", unit: "", qty: 1, price_thb: 0, price_usd: 0, discount_percent: 0, line_total_thb: 0, line_total_usd: 0 }]);

  const updateItem = (idx, k, v) => setItems(prev => prev.map((item, i) => {
    if (i !== idx) return item;
    const u = { ...item, [k]: v };
    const qty = parseFloat(k === "qty" ? v : u.qty) || 0;
    const pTHB = parseFloat(k === "price_thb" ? v : u.price_thb) || 0;
    const pUSD = parseFloat(k === "price_usd" ? v : u.price_usd) || 0;
    const disc = parseFloat(k === "discount_percent" ? v : u.discount_percent) || 0;
    u.line_total_thb = pTHB * qty * (1 - disc / 100);
    u.line_total_usd = pUSD * qty * (1 - disc / 100);
    return u;
  }));

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotalTHB = items.reduce((s, i) => s + (parseFloat(i.line_total_thb) || 0), 0);
  const subtotalUSD = items.reduce((s, i) => s + (parseFloat(i.line_total_usd) || 0), 0);
  const discAmt = subtotalTHB * (parseFloat(header.discount_percent) || 0) / 100;
  const discAmtUSD = subtotalUSD * (parseFloat(header.discount_percent) || 0) / 100;
  const afterDisc = subtotalTHB - discAmt;
  const afterDiscUSD = subtotalUSD - discAmtUSD;
  const vatAmt = afterDisc * (parseFloat(header.vat_percent) || 0) / 100;
  const vatAmtUSD = afterDiscUSD * (parseFloat(header.vat_percent) || 0) / 100;
  const total = afterDisc + vatAmt;
  const totalUSD = afterDiscUSD + vatAmtUSD;

  const handleSave = async (status) => {
    if (!header.customer_name) return setError("กรุณาระบุลูกค้า");
    if (items.length === 0) return setError("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
    setSaving(true); setError("");
    const { _docNumberPreview: _dpi, ...headerCleanI } = header;
    let finalDocNumberI = headerCleanI.doc_number;
    if (isNew && header._docNumberPreview) {
      const realNum = await generateDocNumber(header.invoice_number_type || "invoice_product");
      if (realNum) finalDocNumberI = realNum;
    }
    const payload = {
      doc_number: finalDocNumberI,
      status: status || header.status,
      customer_id: headerCleanI.customer_id || null,
      customer_name: headerCleanI.customer_name || "",
      customer_address: headerCleanI.customer_address || "",
      customer_tax_id: headerCleanI.customer_tax_id || "",
      customer_branch: headerCleanI.customer_branch || "",
      customer_contact: headerCleanI.customer_contact || "",
      customer_phone: headerCleanI.customer_phone || "",
      customer_email: headerCleanI.customer_email || "",
      contact_id: headerCleanI.contact_id || null,
      doc_date: headerCleanI.doc_date || null,
      currency: headerCleanI.currency || "THB",
      fx_rate: parseFloat(headerCleanI.fx_rate) || 36,
      note: headerCleanI.note || "",
      discount_percent: parseFloat(headerCleanI.discount_percent) || 0,
      discount_amount: discAmt,
      vat_percent: parseFloat(headerCleanI.vat_percent) || 0,
      subtotal: subtotalTHB,
      vat_amount: vatAmt,
      total,
      paid_amount: parseFloat(headerCleanI.paid_amount) || 0,
      invoice_number_type: headerCleanI.invoice_number_type || "invoice_product",
      updated_at: new Date().toISOString(),
    };
    let invId = doc?.id;
    if (isNew) {
      const { data, error: err } = await sb.db.insert("invoices", payload);
      if (err) { setSaving(false); return setError(err.message || JSON.stringify(err)); }
      invId = data[0]?.id;
    } else {
      const { error: err } = await sb.db.update("invoices", doc.id, payload);
      if (err) { setSaving(false); return setError(err.message || JSON.stringify(err)); }
      await fetch(`${SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.${doc.id}`, { method: "DELETE", headers: sb.h() });
    }
    if (invId && items.length > 0) {
      const lineItems = items.map((item, i) => ({
        invoice_id: invId, item_order: i,
        item_type: item.item_type, ref_id: item.ref_id || null,
        code: item.code, name_th: item.name_th, name_en: item.name_en,
        description: item.description, unit: item.unit, qty: item.qty,
        price_thb: item.price_thb, price_usd: item.price_usd,
        item_fx_rate: item.item_fx_rate ?? null,
        discount_percent: item.discount_percent || 0,
        discount_amount: item.discount_amount || 0,
        line_total_thb: item.line_total_thb, line_total_usd: item.line_total_usd,
      }));
      const { error: itemErr } = await sb.db.insert("invoice_items", lineItems);
      if (itemErr) { setSaving(false); return setError("บันทึกรายการสินค้าไม่สำเร็จ: " + (itemErr.message || JSON.stringify(itemErr))); }
    }
    setSaving(false);
    onBack();
  };

  const filteredItems = [...products.map(p => ({ ...p, _type: "product" })), ...services.map(s => ({ ...s, _type: "service" }))].filter(i => !itemSearch || i.name_th?.includes(itemSearch) || i.code?.includes(itemSearch));

  if (preview) return <InvoicePreview header={header} items={items} subtotalTHB={subtotalTHB} subtotalUSD={subtotalUSD} discAmt={discAmt} discAmtUSD={discAmtUSD} vatAmt={vatAmt} vatAmtUSD={vatAmtUSD} total={total} totalUSD={totalUSD} onClose={() => setPreview(false)} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button style={S.btn("ghost")} onClick={onBack}>← กลับ</button>
        <h1 style={{ ...S.pageTitle, margin: 0 }}>{isNew ? "🧾 สร้างใบแจ้งหนี้" : `🧾 ${header.doc_number}`}</h1>
      </div>
      <Alert type="error" msg={error} />

      {isReadOnly && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>เอกสารนี้ถูกล็อกการแก้ไข</div>
              <div style={{ fontSize: 12, color: "#b45309" }}>สถานะ "{doc?.status}"</div>
            </div>
          </div>
          <button type="button" onClick={() => { const c = prompt("พิมพ์ \"แก้ไข\" เพื่อยืนยันการเปิดแก้ไขเอกสาร"); if (c === "แก้ไข") setUnlocked(true); }}
            style={{ ...S.btn("ghost"), borderColor: "#f59e0b", color: "#92400e", fontSize: 12 }}>
            🔓 เปิดแก้ไข
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ ...S.card, marginBottom: 16, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? "none" : "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 14 }}>ข้อมูลเอกสาร</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div>
            <label style={S.label}>
              เลขที่เอกสาร
              {header._docNumberPreview && <span style={{ marginLeft: 6, fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>● ตัวอย่าง (จะออกจริงตอนบันทึก)</span>}
            </label>
            <input value={header.doc_number} onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9); setHeader(h => ({ ...h, doc_number: v, _docNumberPreview: false })); }} maxLength={9} style={{ ...S.input, borderColor: header._docNumberPreview ? "#fbbf24" : undefined, fontFamily: "monospace", letterSpacing: "0.05em" }} />
          </div>
          <div>
            <label style={S.label}>ประเภทเลขที่ (TX/IV)</label>
            <select value={header.invoice_number_type || "invoice_product"} onChange={async e => {
              const t = e.target.value;
              // Sync doc_type with number type
              const syncedDocType = t === "invoice_product" ? "full" : "invoice";
              setHeader(h => ({ ...h, invoice_number_type: t, doc_type: syncedDocType }));
              if (!doc?.id) {
                const num = await previewNextDocNumber(t);
                if (num) setHeader(h => ({ ...h, invoice_number_type: t, doc_type: syncedDocType, doc_number: num, _docNumberPreview: true }));
              }
            }} style={S.input}>
              <option value="invoice_product">TX — ใบแจ้งหนี้/ใบกำกับภาษี/ใบส่งของ</option>
              <option value="invoice_service">IV — ใบแจ้งหนี้/วางบิล</option>
            </select>
          </div>
          <div><label style={S.label}>วันที่</label><input type="date" value={header.doc_date} onChange={setH("doc_date")} style={S.input} /></div>
          <div><label style={S.label}>Customer PO</label><input value={header.customer_po} onChange={setH("customer_po")} placeholder="PO-XXXX" style={S.input} /></div>
          <div>
            <label style={S.label}>ดึงข้อมูลจากใบเสนอราคา</label>
            <select value={header.quotation_id} onChange={e => { setH("quotation_id")(e); if (e.target.value) convertFromQuotation(e.target.value); }} style={S.input}>
              <option value="">— เลือก QT เพื่อ import ข้อมูล —</option>
              {quotations.map(q => <option key={q.id} value={q.id}>{q.doc_number} — {q.customer_name}</option>)}
            </select>
            {header.quotation_number && <div style={{ fontSize: 11, color: "#0F6E56", marginTop: 4 }}>✓ นำเข้าข้อมูลจาก {header.quotation_number} แล้ว (ไม่แสดงในเอกสาร)</div>}
          </div>
          <div><label style={S.label}>สกุลเงิน</label>
            <select value={header.currency} onChange={setH("currency")} style={S.input}>
              <option value="THB">THB</option><option value="USD">USD</option>
            </select>
          </div>
          <div><label style={S.label}>อัตราแลกเปลี่ยน</label><input type="number" value={header.fx_rate} onChange={setH("fx_rate")} style={S.input} /></div>
          <div><label style={S.label}>ส่วนลด (%)</label><input type="number" value={header.discount_percent} onChange={setH("discount_percent")} style={S.input} /></div>
          <div><label style={S.label}>VAT (%)</label><input type="number" value={header.vat_percent} onChange={setH("vat_percent")} style={S.input} /></div>
          <div><label style={S.label}>สถานะ</label>
            <select value={header.status} onChange={setH("status")} style={S.input}>
              {Object.entries(STATUS_INV).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Customer */}
      <div style={{ ...S.card, marginBottom: 16, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? "none" : "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>ข้อมูลลูกค้า</div>
          <SearchableCustomerSelect
            value={header.customer_id}
            onChange={(c) => selectCustomer(c)}
            customers={customers}
            onCustomerAdded={(c) => setCustomers(prev => [c, ...prev])}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={S.label}>ชื่อลูกค้า*</label><input value={header.customer_name} onChange={setH("customer_name")} style={S.input} /></div>
          <div><label style={S.label}>เลขภาษี</label><input value={header.customer_tax_id} onChange={setH("customer_tax_id")} style={S.input} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={S.label}>ที่อยู่</label><textarea value={header.customer_address} onChange={setH("customer_address")} rows={2} style={{ ...S.input, resize: "vertical" }} /></div>
          <div><label style={S.label}>โทรศัพท์</label><input value={header.customer_phone} onChange={setH("customer_phone")} style={S.input} /></div>
          <div><label style={S.label}>สาขา / Branch</label>
            <input value={header.customer_branch || ""} onChange={setH("customer_branch")} placeholder="ดึงจาก Master อัตโนมัติ หรือพิมพ์เอง" style={S.input} />
          </div>
          <ContactPicker
            customerId={header.customer_id}
            customerName={header.customer_name}
            value={header.customer_contact ? { name: header.customer_contact, phone: header.customer_phone } : null}
            onChange={(c) => setHeader(h => ({ ...h, contact_id: c.id || null, customer_contact: c.name, customer_phone: c.phone || h.customer_phone }))}
            docType="invoice"
          />
        </div>
      </div>

      {/* Line Items */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>รายการสินค้า/บริการ</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("ghost")} onClick={addManualItem}>+ เพิ่มรายการเอง</button>
            <button style={S.btn("primary")} onClick={() => setShowItemPicker(true)}>+ เลือกจาก Master</button>
          </div>
        </div>
        {showItemPicker && (
          <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>เลือกสินค้า/บริการ</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#adb5bd" }} onClick={() => setShowItemPicker(false)}>✕</button>
            </div>
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="พิมพ์ค้นหา..." style={{ ...S.input, marginBottom: 10 }} />
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredItems.map(item => (
                <div key={item.id} onClick={() => addItem(item, item._type)}
                  style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderRadius: 8, cursor: "pointer", border: "1px solid #dee2e6" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0fff4"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <div>
                    <span style={S.badge(item._type === "product" ? "blue" : "green")}>{item._type === "product" ? "สินค้า" : "บริการ"}</span>
                    <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500 }}>{item.code}</span>
                    <span style={{ marginLeft: 6, fontSize: 13 }}>{item.name_th}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#6c757d" }}>฿{fmt(item.price_thb)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {items.length === 0 ? <EmptyState icon="📦" text="ยังไม่มีรายการ" /> : (
          <table style={{ ...S.table, fontSize: 12 }}>
            <thead>
              <tr>
                {["#", "รหัส", "ชื่อ", "หน่วย", "จำนวน", "ราคา (THB)", "ส่วนลด%", "รวม (THB)", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item._id || item.id}>
                  <td style={S.td}>{idx + 1}</td>
                  <td style={S.td}><input value={item.code || ""} onChange={e => updateItem(idx, "code", e.target.value)} style={{ ...S.input, width: 70, padding: "4px 8px" }} /></td>
                  <td style={S.td}>
                    <input value={item.name_th || ""} onChange={e => updateItem(idx, "name_th", e.target.value)} style={{ ...S.input, width: 160, padding: "4px 8px", marginBottom: 3 }} />
                    <textarea value={item.description || ""} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." rows={2} style={{ ...S.input, width: 160, padding: "4px 8px", fontSize: 11, resize: "vertical", display: "block" }} />
                  </td>
                  <td style={S.td}><input value={item.unit || ""} onChange={e => updateItem(idx, "unit", e.target.value)} style={{ ...S.input, width: 60, padding: "4px 8px" }} /></td>
                  <td style={S.td}><input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} style={{ ...S.input, width: 60, padding: "4px 8px", textAlign: "right" }} /></td>
                  <td style={S.td}><input type="number" value={item.price_thb} onChange={e => updateItem(idx, "price_thb", e.target.value)} style={{ ...S.input, width: 90, padding: "4px 8px", textAlign: "right" }} /></td>
                  <td style={S.td}><input type="number" value={item.discount_percent} onChange={e => updateItem(idx, "discount_percent", e.target.value)} style={{ ...S.input, width: 60, padding: "4px 8px", textAlign: "right" }} /></td>
                  <td style={{ ...S.td, textAlign: "right", fontWeight: 500 }}>{fmt(item.line_total_thb)}</td>
                  <td style={S.td}><button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc3545", fontSize: 16 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <div style={{ width: 300, fontSize: 13 }}>
              {[["ยอดรวม", subtotalTHB], [`ส่วนลด (${header.discount_percent}%)`, -discAmt], [`VAT (${header.vat_percent}%)`, vatAmt]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f3f5", color: "#495057" }}>
                  <span>{label}</span><span>{fmt(val)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", fontWeight: 700, fontSize: 15, color: "#fff", background: "#1e40af", borderRadius: 8, marginTop: 8 }}>
                <span>ยอดสุทธิ</span><span>฿{fmt(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...S.card, marginBottom: 20 }}>
        <label style={S.label}>หมายเหตุ</label>
        <textarea value={header.note} onChange={setH("note")} rows={3} style={{ ...S.input, resize: "vertical" }} />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={S.btn("ghost")} onClick={onBack}>ยกเลิก</button>
        <button style={S.btn("ghost")} onClick={() => setPreview(true)}>👁 Preview / Print</button>
        <button style={S.btn("ghost")} onClick={() => handleSave("draft")} disabled={saving}>💾 บันทึกร่าง</button>
        <button style={S.btn("primary")} onClick={() => handleSave("sent")} disabled={saving}>{saving ? "กำลังบันทึก..." : "✅ บันทึก & ส่ง"}</button>
      </div>
    </div>
  );
}

function InvoicePreview({ header, items, subtotalTHB, subtotalUSD, discAmt, discAmtUSD, vatAmt, vatAmtUSD, total, totalUSD, onClose }) {
  const [company, setCompany] = useState(null);
  useEffect(() => { sb.db.list("company_settings").then(rows => { if (rows?.length > 0) setCompany(rows[0]); }); }, []);
  const dt = DOC_TYPES[header.doc_type] || DOC_TYPES.invoice;
  const docDate = header.doc_date ? new Date(header.doc_date).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={S.btn("ghost")} onClick={onClose}>← กลับแก้ไข</button>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#495057" }}>Preview {dt.label}</span>
        </div>
        <button onClick={() => window.print()} style={{ padding: "7px 18px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", background: "#1e40af", color: "#fff" }}>🖨️ พิมพ์</button>
      </div>

      {["original", "copy"].map((printType) => (
      <div key={printType} className={`print-page ${printType === "copy" ? "print-page-copy" : ""}`} style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 16, maxWidth: 900, margin: printType === "copy" ? "32px auto 0" : "0 auto", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ background: "#1e40af", height: 6 }} />
        <div style={{ padding: "36px 48px" }}>

          {/* Copy label top-right */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <div style={{ border: `1px solid ${printType === "original" ? "#1e40af" : "#adb5bd"}`, borderRadius: 4, padding: "2px 7px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: printType === "original" ? "#1e40af" : "#6c757d", letterSpacing: "0.03em" }}>
                {printType === "original" ? "ต้นฉบับ / Original · สำหรับลูกค้า" : "สำเนา / Copy"}
              </div>
            </div>
          </div>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 24, borderBottom: "2px solid #1e40af" }}>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flex: 1, paddingRight: 40 }}>
              {company?.logo_url && <img src={company.logo_url} alt="logo" style={{ maxWidth: 100, maxHeight: 64, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />}
              <div style={{ fontSize: 13 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{company?.name_th || "บริษัทของคุณ"}</div>
                {company?.name_en && <div style={{ fontSize: 12, color: "#6c757d", marginBottom: 6 }}>{company.name_en}</div>}
                {company?.address_th && <div style={{ fontSize: 12, color: "#495057", lineHeight: 1.65, maxWidth: 300, marginBottom: 6 }}>{company.address_th}</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                  {company?.tax_id && <div style={{ color: "#adb5bd", fontSize: 11, marginTop: 4 }}>เลขประจำตัวผู้เสียภาษี: {company.tax_id}</div>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 240 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#1e40af", letterSpacing: "-0.02em", marginTop: 16 }}>{dt.label}</div>
              <div style={{ fontSize: 12, color: "#adb5bd", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>{dt.labelEn}</div>
              {header.customer_po && (
                <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <div style={{ display: "flex", gap: 12 }}><span style={{ color: "#adb5bd", fontSize: 11 }}>PO</span><span style={{ color: "#495057" }}>{header.customer_po}</span></div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
              {/* Left - customer details */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>ชื่อลูกค้า</div>
                <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "16px 20px", fontSize: 13, height: "100%", boxSizing: "border-box" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 4 }}>
                    {header.customer_name}
                    {header.customer_branch && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "#1e40af" }}>({header.customer_branch})</span>}
                  </div>
                  {header.customer_tax_id && <div style={{ color: "#6c757d", fontSize: 12, marginBottom: 4 }}>เลขประจำตัวผู้เสียภาษี: {header.customer_tax_id}</div>}
                  {header.customer_address && <div style={{ color: "#495057", lineHeight: 1.65, marginBottom: 4 }}>{header.customer_address}</div>}
                  {header.customer_contact && <div style={{ color: "#6c757d", fontSize: 12 }}>ผู้ติดต่อ: {header.customer_contact}{header.customer_phone ? ` · ${header.customer_phone}` : ""}</div>}
                </div>
              </div>
              {/* Right - doc summary */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>รายละเอียดเอกสาร</div>
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "16px 20px", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #bfdbfe" }}>
                    <span style={{ color: "#6c757d", fontSize: 12 }}>เลขที่เอกสาร</span>
                    <span style={{ fontWeight: 700, color: "#1e40af" }}>{header.doc_number}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#6c757d", fontSize: 12 }}>วันที่ออกเอกสาร</span>
                    <span style={{ color: "#495057" }}>{header.doc_date ? new Date(header.doc_date).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) : "—"}</span>
                  </div>
                  {header.customer_po && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#6c757d", fontSize: 12 }}>Customer PO</span>
                      <span style={{ color: "#495057" }}>{header.customer_po}</span>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
            <thead>
              <tr>
                {["#", "รายการ", "จำนวน", "หน่วย", "ราคา/หน่วย (฿)", "ส่วนลด", "รวม (฿)"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#fff", background: "#1e40af", textAlign: ["#", "จำนวน", "หน่วย"].includes(h) ? "center" : h.includes("฿") || h === "ส่วนลด" ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", color: "#adb5bd", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{i + 1}</td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <div style={{ fontWeight: 600 }}>{item.name_th}</div>
                    {item.name_en && <div style={{ fontSize: 11, color: "#6c757d" }}>{item.name_en}</div>}
                    {item.description && <div style={{ fontSize: 11, color: "#adb5bd" }}>{item.description}</div>}
                  </td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{fmt(item.qty, 0)}</td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", color: "#6c757d", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{item.unit}</td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{fmt(item.price_thb)}</td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", color: item.discount_percent > 0 ? "#dc3545" : "#dee2e6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}</td>
                  <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", fontWeight: 600, background: i % 2 === 0 ? "#fff" : "#fafafa" }}>{fmt(item.line_total_thb)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals + Bank */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 24 }}>
            {(company?.bank_name || company?.bank_account_no) ? (
              <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "14px 18px", fontSize: 12, color: "#495057", flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>ข้อมูลการชำระเงิน</div>
                {company.bank_name && <div style={{ marginBottom: 3 }}>🏦 {company.bank_name}{company.bank_branch ? ` · สาขา ${company.bank_branch}` : ""}</div>}
                {company.bank_account_no && <div style={{ marginBottom: 3 }}>เลขบัญชี: <strong>{company.bank_account_no}</strong></div>}
                {company.bank_account_name && <div>ชื่อบัญชี: {company.bank_account_name}</div>}
              </div>
            ) : <div style={{ flex: 1 }} />}
            <div style={{ minWidth: 300, fontSize: 13 }}>
              {[["ยอดรวม", subtotalTHB], [`ส่วนลด (${header.discount_percent}%)`, -discAmt], [`VAT (${header.vat_percent}%)`, vatAmt]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f3f5", color: "#6c757d" }}>
                  <span>{label}</span><span>฿{fmt(Math.abs(val))}{val < 0 ? " (ลด)" : ""}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", fontWeight: 700, fontSize: 16, color: "#fff", background: "#1e40af", borderRadius: 8, marginTop: 8 }}>
                <span>ยอดสุทธิ</span><span>฿{fmt(total)}</span>
              </div>
              {header.paid_amount > 0 && parseFloat(header.paid_amount) < total && (
                <div style={{ marginTop: 8, padding: "10px 16px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#92400e" }}>ชำระแล้ว</span>
                  <span style={{ color: "#92400e", fontWeight: 600 }}>฿{fmt(header.paid_amount)}</span>
                </div>
              )}
              {header.paid_amount > 0 && parseFloat(header.paid_amount) < total && (
                <div style={{ padding: "10px 16px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>ยอดคงเหลือ</span>
                  <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 15 }}>฿{fmt(total - parseFloat(header.paid_amount))}</span>
                </div>
              )}
            </div>
          </div>

          {header.note && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#92400e", marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, textTransform: "uppercase" }}>หมายเหตุ</div>
              <div>{header.note}</div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 48, paddingTop: 28, borderTop: "2px solid #e9ecef" }}>
            {/* Box 1 — ผู้รับสินค้า */}
            <div style={{ border: "1px solid #dee2e6", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", lineHeight: 1.6 }}>ได้รับสินค้าตามรายการข้างต้น</div>
                <div style={{ fontSize: 11, color: "#1e40af" }}>ไว้เรียบร้อยแล้ว</div>
              </div>
              <div style={{ padding: "16px 20px 20px", textAlign: "center" }}>
                <div style={{ height: 64 }} />
                <div style={{ borderBottom: "1.5px solid #495057", marginBottom: 12, marginLeft: 8, marginRight: 8 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: "#343a40", marginBottom: 12 }}>ผู้รับสินค้า / Authorized By</div>
                <div style={{ fontSize: 11, color: "#adb5bd", borderBottom: "1px dashed #dee2e6", paddingBottom: 8, marginBottom: 4 }}>ชื่อ-นามสกุล ____________________</div>
                <div style={{ fontSize: 11, color: "#adb5bd" }}>ลงวันที่ ________________________</div>
              </div>
            </div>

            {/* Box 2 — ผู้รับวางบิล */}
            <div style={{ border: "1px solid #dee2e6", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", lineHeight: 1.6 }}>ผู้รับใบแจ้งหนี้ / รับวางบิล</div>
                <div style={{ fontSize: 11, color: "#1e40af" }}>Received By</div>
              </div>
              <div style={{ padding: "16px 20px 20px", textAlign: "center" }}>
                <div style={{ height: 64 }} />
                <div style={{ borderBottom: "1.5px solid #495057", marginBottom: 12, marginLeft: 8, marginRight: 8 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: "#343a40", marginBottom: 12 }}>ลายมือชื่อ / Signature</div>
                <div style={{ fontSize: 11, color: "#adb5bd", borderBottom: "1px dashed #dee2e6", paddingBottom: 8, marginBottom: 8 }}>วันที่ ________________________</div>
                <div style={{ fontSize: 11, color: "#adb5bd" }}>กำหนดชำระเงิน ___________________</div>
              </div>
            </div>

            {/* Box 3 — ในนามบริษัท */}
            <div style={{ border: "1px solid #bfdbfe", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#1e40af", padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.6 }}>ในนามบริษัท / On Behalf of</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#93c5fd" }}>{company?.name_th || ""}</div>
              </div>
              <div style={{ padding: "16px 20px 20px", textAlign: "center", background: "#eff6ff" }}>
                <div style={{ height: 64 }} />
                <div style={{ borderBottom: "1.5px solid #1e40af", marginBottom: 12, marginLeft: 8, marginRight: 8 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1e40af", marginBottom: 16 }}>ผู้มีอำนาจลงนาม / Authorized Signatory</div>
                <div style={{ fontSize: 11, color: "#6c757d" }}>วันที่ ________________________</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ background: "#f8f9fa", borderTop: "1px solid #e9ecef", padding: "12px 48px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#adb5bd" }}>
          <span>{company?.name_th}</span>
          <span>{header.doc_number} · {docDate} · {printType === "original" ? "ต้นฉบับ" : "สำเนา"}</span>
        </div>
      </div>
      ))}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body > * { display: none !important; }
          body { margin: 0 !important; }
          .print-page {
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            page-break-after: always;
          }
          .print-page-copy { page-break-before: always; }
          #print-area { font-size: 11pt !important; }
        }
      `}</style>
    </div>
  );
}

// ─── RECEIPT MODULE ───────────────────────────────────────────────────────────
const RECEIPT_TYPES = {
  receipt_service: { label: "ใบเสร็จรับเงิน/ใบกำกับภาษี", labelEn: "Receipt / Tax Invoice", color: "#6b21a8", bg: "#f3e8ff", prefix: "RE" },
  receipt_product: { label: "ใบเสร็จรับเงิน", labelEn: "Receipt", color: "#065f46", bg: "#d1fae5", prefix: "RS" },
  // Legacy fallbacks for old data
  receipt: { label: "ใบเสร็จรับเงิน", labelEn: "Receipt", color: "#065f46", bg: "#d1fae5", prefix: "RS" },
  receipt_tax: { label: "ใบเสร็จรับเงิน/ใบกำกับภาษี", labelEn: "Receipt / Tax Invoice", color: "#6b21a8", bg: "#f3e8ff", prefix: "RE" },
};

const PAYMENT_METHODS = {
  transfer: "โอนเงิน",
  cash: "เงินสด",
  cheque: "เช็ค",
  credit_card: "บัตรเครดิต",
};

function ReceiptList({ onNew, onEdit }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [customers, setCustomers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, custs] = await Promise.all([
      sb.db.list("receipts", search, ["doc_number", "customer_name", "invoice_number"]),
      customers.length === 0 ? sb.db.list("customers") : Promise.resolve(customers),
    ]);
    setRows(data);
    if (customers.length === 0) setCustomers(custs || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const fetchFxRate = async () => {
    setFxLoading(true);
    try {
      // Try multiple sources for reliability
      let rate = null;
      let dateStr = "";

      // Source 1: Exchange Rate API (no key needed, CORS friendly)
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data?.rates?.THB) {
        rate = parseFloat(data.rates.THB.toFixed(4));
        const d = new Date(data.time_last_update_utc);
        dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
      }

      if (rate) {
        setFxRate(rate);
        setFxUpdated(`อัปเดต: ${dateStr}`);
      } else {
        setFxUpdated("ดึงข้อมูลไม่ได้ ใช้ค่าเดิม");
      }
    } catch (e) {
      setFxUpdated("ดึงข้อมูลไม่ได้ ใช้ค่าเดิม");
    }
    setFxLoading(false);
  };

  const filtered = applyDocFilters(rows, filters, customers);
  const { sorted: sortedRows, Th: SortTh } = useSortable(filtered, "doc_date", "desc");

  return (
    <div>
      <h1 style={S.pageTitle}>✅ ใบเสร็จรับเงิน</h1>
      <p style={S.pageSub}>จัดการใบเสร็จรับเงินและใบกำกับภาษีทั้งหมด</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาเลขที่ ลูกค้า หรือ Invoice..." />
        {onNew && <button style={S.btn("primary")} onClick={onNew}>+ สร้างใบเสร็จ</button>}
      </div>
      <DocFilterBar filters={filters} onChange={setFilters} customers={customers}
        statusOptions={[
          { value: "paid", label: "ชำระแล้ว" },
          { value: "cancelled", label: "ยกเลิก" },
        ]} />
      <div style={S.card}>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>กำลังโหลด...</div>
          : filtered.length === 0 ? <EmptyState icon="✅" text={Object.keys(filters).length > 0 ? "ไม่พบเอกสารที่ตรงกับตัวกรอง" : "ยังไม่มีใบเสร็จ"} />
          : (
            <table style={S.table}>
              <thead>
                <tr>
                  <SortTh k="doc_number">เลขที่</SortTh>
                  <SortTh k="doc_type">ประเภท</SortTh>
                  <SortTh k="doc_date">วันที่</SortTh>
                  <SortTh k="customer_name">ลูกค้า</SortTh>
                  <SortTh k="invoice_number">อ้างอิง Invoice</SortTh>
                  <th style={S.th}>สถานะ Invoice</th>
                  <SortTh k="payment_method">วิธีชำระ</SortTh>
                  <SortTh k="subtotal" style={{ textAlign: "right" }}>ก่อน VAT</SortTh>
                  <SortTh k="total" style={{ textAlign: "right" }}>ยอดรวม</SortTh>
                  <th style={S.th}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(r => {
                  const rt = RECEIPT_TYPES[r.doc_type] || RECEIPT_TYPES.receipt;
                  return (
                    <tr key={r.id} onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={S.td}><span style={{ fontWeight: 500, color: "#065f46" }}>{r.doc_number}</span></td>
                      <td style={S.td}><span style={{ ...S.badge("green"), background: rt.bg, color: rt.color, fontSize: 11 }}>{rt.label}</span></td>
                      <td style={S.td}>{r.doc_date ? new Date(r.doc_date).toLocaleDateString("th-TH") : "—"}</td>
                      <td style={S.td}>{r.customer_name || "—"}</td>
                      <td style={S.td}><span style={{ fontSize: 12, color: "#6c757d" }}>{r.invoice_number || "—"}</span></td>
                      <td style={S.td}>
                        {r.invoice_id ? (
                          <InvoiceStatusBadge invoiceId={r.invoice_id} />
                        ) : <span style={{ color: "#dee2e6" }}>—</span>}
                      </td>
                      <td style={S.td}><span style={{ fontSize: 12 }}>{PAYMENT_METHODS[r.payment_method] || r.payment_method || "—"}</span></td>
                      <td style={{ ...S.td, textAlign: "right", color: "#495057" }}>฿{fmt(r.subtotal != null ? r.subtotal : (parseFloat(r.total||0) - parseFloat(r.vat_amount||0)))}</td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: 500 }}>฿{fmt(r.total)}</td>
                      <td style={S.td}>
                        {onNew && <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 12 }} onClick={() => {
                        const confirmed = prompt(`พิมพ์ "แก้ไข" เพื่อเปิดแก้ไขใบเสร็จ ${r.doc_number}`);
                        if (confirmed === "แก้ไข") onEdit(r);
                      }}>✏️ แก้ไข</button>}
                      {onNew && <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 11, color: "#adb5bd" }} onClick={async () => {
                        const confirmed = prompt(`พิมพ์ "ลบ" เพื่อยืนยันการลบใบเสร็จ ${r.doc_number}`);
                        if (confirmed !== "ลบ") return;
                        const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
                        const hdrs = sb.h(token);
                        await fetch(`${SUPABASE_URL}/rest/v1/receipt_items?receipt_id=eq.${r.id}`, { method: "DELETE", headers: hdrs });
                        await fetch(`${SUPABASE_URL}/rest/v1/receipts?id=eq.${r.id}`, { method: "DELETE", headers: hdrs });
                        load();
                      }}>🗑️</button>}
                      {onNew && !["paid", "cancelled"].includes(r.status) && (
                        <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 11, color: "#adb5bd" }} onClick={async () => {
                          const confirmed = prompt(`พิมพ์ "ยกเลิก" เพื่อยืนยันการยกเลิก ${r.doc_number}`);
                          if (confirmed !== "ยกเลิก") return;
                          await sb.db.update("receipts", r.id, { status: "cancelled" });
                          load();
                        }}>✕</button>
                      )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}

function ReceiptForm({ doc, onBack }) {
  const isNew = !doc?.id;
  const isLocked = !isNew && ["paid", "cancelled"].includes(doc?.status);
  const [unlocked, setUnlocked] = useState(false);
  const isReadOnly = isLocked && !unlocked;
  const [header, setHeader] = useState({
    doc_number: doc?.doc_number || "",
    doc_type: doc?.doc_type || "receipt_service",
    receipt_number_type: doc?.receipt_number_type || doc?.doc_type || "receipt_service",
    doc_date: doc?.doc_date || new Date().toISOString().slice(0, 10),
    invoice_id: doc?.invoice_id || "",
    invoice_number: doc?.invoice_number || "",
    customer_po: doc?.customer_po || "",
    payment_method: doc?.payment_method || "transfer",
    currency: doc?.currency || "THB",
    fx_rate: doc?.fx_rate || 36,
    discount_percent: doc?.discount_percent || 0,
    vat_percent: doc?.vat_percent || 7,
    note: doc?.note || "",
    status: doc?.status || "paid",
    customer_id: doc?.customer_id || "",
    customer_name: doc?.customer_name || "",
    customer_address: doc?.customer_address || "",
    customer_tax_id: doc?.customer_tax_id || "",
    customer_contact: doc?.customer_contact || "",
    customer_phone: doc?.customer_phone || "",
    customer_branch: doc?.customer_branch || "",
    contact_id: doc?.contact_id || null,
  });
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState("");

  useEffect(() => {
    sb.db.list("customers").then(setCustomers);
    sb.db.list("products").then(setProducts);
    sb.db.list("services").then(setServices);
    // Load invoices with real paid_amount from receipts
    (async () => {
      const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
      const hdrs = sb.h(token);
      const [invData, recData] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/invoices?select=*&order=created_at.desc`, { headers: hdrs }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/receipts?select=invoice_id,total,subtotal,vat_amount&status=neq.cancelled`, { headers: hdrs }).then(r => r.json()),
      ]);
      const recByInv = {};
      const recSubtotalByInv = {};
      if (Array.isArray(recData)) recData.forEach(r => {
        if (r.invoice_id) {
          recByInv[r.invoice_id] = (recByInv[r.invoice_id] || 0) + (parseFloat(r.total) || 0);
          const rSub = parseFloat(r.subtotal) > 0 ? parseFloat(r.subtotal) : (parseFloat(r.total)||0) - (parseFloat(r.vat_amount)||0);
          recSubtotalByInv[r.invoice_id] = (recSubtotalByInv[r.invoice_id] || 0) + rSub;
        }
      });
      const merged = Array.isArray(invData) ? invData.map(inv => {
        const realPaid = recByInv[inv.id] || 0;
        const realPaidBeforeVat = recSubtotalByInv[inv.id] || 0;
        const realStatus = inv.status === "cancelled" ? "cancelled"
          : realPaid >= (parseFloat(inv.total) || 0) && realPaid > 0 ? "paid"
          : realPaid > 0 ? "partial" : inv.status;
        return { ...inv, paid_amount: realPaid, paid_before_vat: realPaidBeforeVat, status: realStatus };
      }) : [];
      setInvoices(merged);
    })();
    // Load default VAT rate from settings
    if (!doc?.id) {
      sb.db.list("company_settings").then(rows => {
        if (rows?.length > 0 && rows[0].vat_rate != null) {
          setHeader(h => ({ ...h, vat_percent: rows[0].vat_rate }));
        }
      });
    }
    // Convert from Invoice if triggered from INV list
    if (doc?._convertFromINV) {
      const inv = doc._convertFromINV;
      const remaining = (parseFloat(inv.total) || 0) - (parseFloat(inv.paid_amount) || 0);
      const isPart = inv.status === "partial";
      // TX prefix → RS (receipt_product), IV prefix → RE (receipt_service)
      const invDocNum = inv.doc_number || "";
      const recType = invDocNum.startsWith("TX") ? "receipt_product" : "receipt_service";
      const invVatAmt = parseFloat(inv.vat_amount || 0);
      const invTotal = parseFloat(inv.total || 0);
      const invBeforeVat = invTotal - invVatAmt;
      const paidAmt = parseFloat(inv.paid_amount || 0);
      const paidBeforeVat = invBeforeVat > 0 && invVatAmt > 0
        ? paidAmt * (invBeforeVat / invTotal)
        : paidAmt;
      const remainBeforeVat = invBeforeVat - paidBeforeVat;
      setHeader(h => ({
        ...h,
        invoice_id: inv.id, invoice_number: inv.doc_number,
        customer_id: inv.customer_id, customer_name: inv.customer_name,
        customer_address: inv.customer_address || "", customer_tax_id: inv.customer_tax_id || "",
        customer_branch: inv.customer_branch || "", customer_po: inv.customer_po || "",
        currency: inv.currency, fx_rate: inv.fx_rate,
        discount_percent: isPart ? 0 : (inv.discount_percent || 0),
        vat_percent: inv.vat_percent, note: stripDocMeta(inv.note) || "",
        receipt_number_type: recType, doc_type: recType,
      }));
      previewNextDocNumber(recType).then(num => {
        if (num) setHeader(h => ({ ...h, doc_number: num, _docNumberPreview: true }));
      });
      // Load items
      fetch(`${SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.${inv.id}&order=item_order.asc&select=*`, {
        headers: sb.h()
      }).then(r => r.json()).then(invItems => {
        if (Array.isArray(invItems)) {
          if (isPart) {
            setItems([{ _id: Date.now(), item_type: "service", code: inv.doc_number,
              name_th: `ชำระตาม ${inv.doc_number} (ยอดคงเหลือ)`,
              description: `ก่อน VAT ฿${fmt(invBeforeVat)} | ชำระแล้ว ฿${fmt(paidBeforeVat)} | คงเหลือ ฿${fmt(remainBeforeVat)}`,
              unit: "งวด", qty: 1, price_thb: remainBeforeVat, price_usd: 0,
              discount_percent: 0, line_total_thb: remainBeforeVat, line_total_usd: 0 }]);
          } else {
            setItems(invItems.map(i => ({ ...i, _id: Date.now() + Math.random(), id: undefined })));
          }
        }
      });
    }
    if (!doc?.id && !header.doc_number) {
      // TX prefix → RS (receipt_product), IV prefix → RE (receipt_service)
      const invDocNum = doc?._convertFromINV?.doc_number || "";
      const recType = invDocNum.startsWith("TX") ? "receipt_product" : "receipt_service";
      previewNextDocNumber(recType).then(num => {
        if (num) setHeader(h => ({ ...h, doc_number: num, receipt_number_type: recType, doc_type: recType, _docNumberPreview: true }));
      });
    }
    if (doc?.id) {
      fetch(`${SUPABASE_URL}/rest/v1/receipt_items?receipt_id=eq.${doc.id}&order=item_order.asc&select=*`, {
        headers: sb.h()
      }).then(r => r.json()).then(data => { if (Array.isArray(data)) setItems(data.map(i => ({ ...i, _id: i.id }))); });
    }
  }, [doc]);

  const setH = (k) => (e) => setHeader(h => ({ ...h, [k]: e.target.value }));

  const selectCustomer = (c) => setHeader(h => ({ ...h, customer_id: c.id, customer_name: c.name_th, customer_address: c.address || "", customer_tax_id: c.tax_id || "", customer_contact: c.contact_name || "", customer_phone: c.phone || "", customer_branch: c.branch || "" }));

  const convertFromInvoice = async (invId) => {
    const inv = invoices.find(i => i.id === invId);
    if (!inv) return;
    const remaining = (parseFloat(inv.total) || 0) - (parseFloat(inv.paid_amount) || 0);
    const isPart = inv.status === "partial";
    // TX prefix → RS (receipt_product), IV prefix → RE (receipt_service)
    const invDocNum = inv.doc_number || "";
    const recType = invDocNum.startsWith("TX") ? "receipt_product" : "receipt_service";
    setHeader(h => ({
      ...h, invoice_id: inv.id, invoice_number: inv.doc_number,
      receipt_number_type: recType, doc_type: recType,
      customer_id: inv.customer_id, customer_name: inv.customer_name,
      customer_address: inv.customer_address || "", customer_tax_id: inv.customer_tax_id || "",
      customer_contact: inv.customer_contact || "", customer_phone: inv.customer_phone || "",
      customer_branch: inv.customer_branch || "", customer_po: inv.customer_po || "",
      currency: inv.currency, fx_rate: inv.fx_rate,
      discount_percent: isPart ? 0 : (inv.discount_percent || 0),
      vat_percent: inv.vat_percent,
      note: stripDocMeta(inv.note) || "",
    }));
    // อัพเดทเลขที่เอกสารให้ตรงกับประเภทใหม่
    if (!doc?.id) {
      previewNextDocNumber(recType).then(num => {
        if (num) setHeader(h => ({ ...h, doc_number: num, _docNumberPreview: true }));
      });
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.${invId}&order=item_order.asc&select=*`, {
      headers: sb.h()
    });
    const invItems = await res.json();
    if (Array.isArray(invItems)) {
      if (isPart) {
        // Calculate before-VAT amounts
        const invVatAmt = parseFloat(inv.vat_amount || 0);
        const invTotalAmt = parseFloat(inv.total || 0);
        const invBeforeVat = invTotalAmt - invVatAmt;
        const paidAmt = parseFloat(inv.paid_amount || 0);
        const paidBeforeVat = invTotalAmt > 0 ? paidAmt * (invBeforeVat / invTotalAmt) : paidAmt;
        const remainBeforeVat = invBeforeVat - paidBeforeVat;
        setItems([{
          _id: Date.now(), item_type: "service", code: inv.doc_number,
          name_th: `ชำระตาม ${inv.doc_number} (ยอดคงเหลือ)`,
          name_en: `Payment for ${inv.doc_number} (remaining balance)`,
          description: `ก่อน VAT ฿${fmt(invBeforeVat)} | ชำระแล้ว ฿${fmt(paidBeforeVat)} | คงเหลือ ฿${fmt(remainBeforeVat)}`,
          unit: "งวด", qty: 1,
          price_thb: remainBeforeVat, price_usd: 0,
          discount_percent: 0, line_total_thb: remainBeforeVat, line_total_usd: 0
        }]);
      } else {
        setItems(invItems.map(i => ({ ...i, _id: Date.now() + Math.random(), id: undefined })));
      }
    }
  };

  const addItem = (src, type) => {
    const fxRate = parseFloat(header.fx_rate) || 36;
    const priceTHB = parseFloat(src.price_thb) || 0;
    const priceUSD = parseFloat(src.price_usd) || (priceTHB / fxRate);
    setItems(prev => [...prev, { _id: Date.now(), item_type: type, ref_id: src.id, code: src.code, name_th: src.name_th, name_en: src.name_en || "", description: src.description || "", unit: src.unit || "", qty: 1, price_thb: priceTHB, price_usd: priceUSD, discount_percent: 0, line_total_thb: priceTHB, line_total_usd: priceUSD }]);
    setShowItemPicker(false); setItemSearch("");
  };

  const addManualItem = () => setItems(prev => [...prev, { _id: Date.now(), item_type: "product", code: "", name_th: "", unit: "", qty: 1, price_thb: 0, price_usd: 0, discount_percent: 0, line_total_thb: 0, line_total_usd: 0 }]);

  const updateItem = (idx, k, v) => setItems(prev => prev.map((item, i) => {
    if (i !== idx) return item;
    const u = { ...item, [k]: v };
    const qty = parseFloat(k === "qty" ? v : u.qty) || 0;
    const pTHB = parseFloat(k === "price_thb" ? v : u.price_thb) || 0;
    const pUSD = parseFloat(k === "price_usd" ? v : u.price_usd) || 0;
    const disc = parseFloat(k === "discount_percent" ? v : u.discount_percent) || 0;
    u.line_total_thb = pTHB * qty * (1 - disc / 100);
    u.line_total_usd = pUSD * qty * (1 - disc / 100);
    return u;
  }));

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotalTHB = items.reduce((s, i) => s + (parseFloat(i.line_total_thb) || 0), 0);
  const discAmt = subtotalTHB * (parseFloat(header.discount_percent) || 0) / 100;
  const afterDisc = subtotalTHB - discAmt;
  const vatAmt = afterDisc * (parseFloat(header.vat_percent) || 0) / 100;
  const total = afterDisc + vatAmt;

  const handleSave = async () => {
    if (!header.customer_name) return setError("กรุณาระบุลูกค้า");
    if (items.length === 0) return setError("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
    setSaving(true); setError("");
    const { _docNumberPreview: _dpr, ...headerCleanR } = header;
    let finalDocNumberR = headerCleanR.doc_number;
    if (isNew && header._docNumberPreview) {
      const recType = header.receipt_number_type || "receipt_service";
      const realNum = await generateDocNumber(recType);
      if (realNum) finalDocNumberR = realNum;
    }
    const payload = {
      doc_number: finalDocNumberR,
      status: headerCleanR.status || "draft",
      receipt_number_type: headerCleanR.receipt_number_type || "receipt_service",
      customer_id: headerCleanR.customer_id || null,
      customer_name: headerCleanR.customer_name || "",
      customer_address: headerCleanR.customer_address || "",
      customer_tax_id: headerCleanR.customer_tax_id || "",
      customer_branch: headerCleanR.customer_branch || "",
      customer_contact: headerCleanR.customer_contact || "",
      customer_phone: headerCleanR.customer_phone || "",
      customer_email: headerCleanR.customer_email || "",
      contact_id: headerCleanR.contact_id || null,
      invoice_id: headerCleanR.invoice_id || null,
      doc_date: headerCleanR.doc_date || null,
      currency: headerCleanR.currency || "THB",
      fx_rate: parseFloat(headerCleanR.fx_rate) || 36,
      note: headerCleanR.note || "",
      payment_method: headerCleanR.payment_method || "",
      discount_percent: parseFloat(headerCleanR.discount_percent) || 0,
      discount_amount: discAmt,
      vat_percent: parseFloat(headerCleanR.vat_percent) || 0,
      subtotal: subtotalTHB,
      vat_amount: vatAmt,
      total,
      updated_at: new Date().toISOString(),
    };
    let recId = doc?.id;
    if (isNew) {
      const { data, error: err } = await sb.db.insert("receipts", payload);
      if (err) { setSaving(false); return setError(err.message || JSON.stringify(err)); }
      recId = data[0]?.id;
    } else {
      const { error: err } = await sb.db.update("receipts", doc.id, payload);
      if (err) { setSaving(false); return setError(err.message || JSON.stringify(err)); }
      await fetch(`${SUPABASE_URL}/rest/v1/receipt_items?receipt_id=eq.${doc.id}`, { method: "DELETE", headers: sb.h() });
    }
    if (recId && items.length > 0) {
      const lineItems = items.map((item, i) => ({
        receipt_id: recId, item_order: i,
        item_type: item.item_type, ref_id: item.ref_id || null,
        code: item.code, name_th: item.name_th, name_en: item.name_en,
        description: item.description, unit: item.unit, qty: item.qty,
        price_thb: item.price_thb, price_usd: item.price_usd,
        discount_percent: item.discount_percent || 0,
        line_total_thb: item.line_total_thb, line_total_usd: item.line_total_usd,
      }));
      const { error: itemErr } = await sb.db.insert("receipt_items", lineItems);
      if (itemErr) { setSaving(false); return setError("บันทึกรายการสินค้าไม่สำเร็จ: " + (itemErr.message || JSON.stringify(itemErr))); }
    }

    // Auto-update Invoice paid_amount if linked
    if (header.invoice_id) {
      const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
      const hdrs = sb.h(token);

      // Get all receipts for this invoice
      const recRes = await fetch(`${SUPABASE_URL}/rest/v1/receipts?invoice_id=eq.${header.invoice_id}&status=neq.cancelled&select=total`, { headers: hdrs });
      const recData = await recRes.json();
      const totalPaid = Array.isArray(recData) ? recData.reduce((s, r) => s + (parseFloat(r.total) || 0), 0) : 0;

      // Get invoice total
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${header.invoice_id}&select=total`, { headers: hdrs });
      const invData = await invRes.json();
      const invTotal = Array.isArray(invData) && invData.length > 0 ? parseFloat(invData[0].total) || 0 : 0;

      // Determine new status
      const newStatus = totalPaid <= 0 ? "sent" : totalPaid >= invTotal ? "paid" : "partial";

      await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${header.invoice_id}`, {
        method: "PATCH", headers: { ...hdrs, Prefer: "return=minimal" },
        body: JSON.stringify({ paid_amount: totalPaid, status: newStatus })
      });
    }

    setSaving(false);
    onBack();
  };

  const filteredItems = [...products.map(p => ({ ...p, _type: "product" })), ...services.map(s => ({ ...s, _type: "service" }))].filter(i => !itemSearch || i.name_th?.includes(itemSearch) || i.code?.includes(itemSearch));

  if (preview) return <ReceiptPreview header={header} items={items} subtotalTHB={subtotalTHB} discAmt={discAmt} vatAmt={vatAmt} total={total} onClose={() => setPreview(false)} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button style={S.btn("ghost")} onClick={onBack}>← กลับ</button>
        <h1 style={{ ...S.pageTitle, margin: 0 }}>{isNew ? "✅ สร้างใบเสร็จรับเงิน" : `✅ ${header.doc_number}`}</h1>
      </div>
      <Alert type="error" msg={error} />

      {isReadOnly && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>เอกสารนี้ถูกล็อกการแก้ไข</div>
              <div style={{ fontSize: 12, color: "#b45309" }}>สถานะ "{doc?.status}" — ส่งให้ลูกค้าแล้วหรืออนุมัติแล้ว</div>
            </div>
          </div>
          <button onClick={() => { const c = prompt("พิมพ์ \"แก้ไข\" เพื่อยืนยันการเปิดแก้ไขเอกสาร"); if (c === "แก้ไข") setUnlocked(true); }}
            style={{ ...S.btn("ghost"), borderColor: "#f59e0b", color: "#92400e", fontSize: 12 }}>
            🔓 เปิดแก้ไข
          </button>
        </div>
      )}

      <div style={{ ...S.card, marginBottom: 16, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? "none" : "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 14 }}>ข้อมูลเอกสาร</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div>
            <label style={S.label}>
              เลขที่เอกสาร
              {header._docNumberPreview && <span style={{ marginLeft: 6, fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>● ตัวอย่าง (จะออกจริงตอนบันทึก)</span>}
            </label>
            <input value={header.doc_number} onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9); setHeader(h => ({ ...h, doc_number: v, _docNumberPreview: false })); }} maxLength={9} style={{ ...S.input, borderColor: header._docNumberPreview ? "#fbbf24" : undefined, fontFamily: "monospace", letterSpacing: "0.05em" }} />
          </div>
          <div>
            <label style={S.label}>ประเภทเอกสาร / เลขที่ (RS/RE)</label>
            {header.invoice_id ? (
              // Locked to match invoice type
              <div style={{ ...S.input, background: "#f8f9fa", color: "#495057", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "#0F6E56" }}>
                  {header.receipt_number_type === "receipt_product" ? "RS — ใบเสร็จรับเงิน (สินค้า)" : "RE — ใบเสร็จรับเงิน/ใบกำกับภาษี (บริการ)"}
                </span>
                <span style={{ fontSize: 11, color: "#adb5bd" }}>🔒 กำหนดตามประเภท Invoice</span>
              </div>
            ) : (
              <select value={header.receipt_number_type || "receipt_service"} onChange={async e => {
                const t = e.target.value;
                const rt = RECEIPT_TYPES[t];
                setHeader(h => ({ ...h, receipt_number_type: t, doc_type: t }));
                if (!doc?.id) {
                  const num = await previewNextDocNumber(t);
                  if (num) setHeader(h => ({ ...h, receipt_number_type: t, doc_type: t, doc_number: num, _docNumberPreview: true }));
                }
              }} style={S.input}>
                <option value="receipt_product">RS — ใบเสร็จรับเงิน (สินค้า)</option>
                <option value="receipt_service">RE — ใบเสร็จรับเงิน/ใบกำกับภาษี (บริการ)</option>
              </select>
            )}
          </div>
          <div><label style={S.label}>วันที่</label><input type="date" value={header.doc_date} onChange={setH("doc_date")} style={S.input} /></div>
          <div><label style={S.label}>วิธีชำระเงิน</label>
            <select value={header.payment_method} onChange={setH("payment_method")} style={S.input}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Convert จาก Invoice</label>
            <select value={header.invoice_id} onChange={async e => {
              const invId = e.target.value;
              setHeader(h => ({ ...h, invoice_id: invId }));
              if (invId) {
                await convertFromInvoice(invId);
              } else {
                // Clear invoice link, allow manual RS/RE selection
                setHeader(h => ({ ...h, invoice_id: "", invoice_number: "" }));
              }
            }} style={S.input}>
              <option value="">— เลือก Invoice ที่ยังค้างชำระ —</option>
              {invoices
                .filter(i => {
                  if (["cancelled"].includes(i.status)) return false;
                  const paid = parseFloat(i.paid_amount || 0);
                  const total = parseFloat(i.total || 0);
                  if (i.status === "paid" || (paid > 0 && paid >= total)) return false;
                  return true;
                })
                .map(i => {
                  const paid = parseFloat(i.paid_amount || 0);
                  const total = parseFloat(i.total || 0);
                  const vatAmt = parseFloat(i.vat_amount || 0);
                  const beforeVat = total - vatAmt;
                  const paidBeforeVat = parseFloat(i.paid_before_vat) || (total > 0 && beforeVat > 0 ? paid * (beforeVat / total) : paid);
                  const remainBeforeVat = beforeVat - paidBeforeVat;
                  const isPart = paid > 0 && paid < total;
                  return (
                    <option key={i.id} value={i.id}>
                      {i.doc_number} — {i.customer_name} | {isPart ? `คงเหลือ ฿${fmt(remainBeforeVat)}` : `฿${fmt(beforeVat)}`} (ก่อน VAT)
                    </option>
                  );
                })
              }
            </select>
            {header.invoice_number && (
              <div style={{ fontSize: 11, color: "#065f46", marginTop: 4 }}>
                ✓ นำเข้าจาก {header.invoice_number} แล้ว
                {header.invoice_id && (() => {
                  const inv = invoices.find(i => i.id === header.invoice_id);
                  if (!inv || !inv.paid_amount) return null;
                  const invTotal = parseFloat(inv.total) || 0;
                  const invVat = parseFloat(inv.vat_amount || 0);
                  const invBeforeVat = invTotal - invVat;
                  const paidBeforeVat = parseFloat(inv.paid_before_vat) || 0;
                  const remaining = invBeforeVat - paidBeforeVat;
                  return <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 600 }}>ยอดคงเหลือ ฿{fmt(remaining)}</span>;
                })()}
              </div>
            )}
          </div>
          <div><label style={S.label}>Customer PO</label><input value={header.customer_po} onChange={setH("customer_po")} placeholder="PO-XXXX" style={S.input} /></div>
          <div><label style={S.label}>VAT (%)</label><input type="number" value={header.vat_percent} onChange={setH("vat_percent")} style={S.input} /></div>
          <div><label style={S.label}>ส่วนลด (%)</label><input type="number" value={header.discount_percent} onChange={setH("discount_percent")} style={S.input} /></div>
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>ข้อมูลลูกค้า</div>
          <SearchableCustomerSelect
            value={header.customer_id}
            onChange={(c) => selectCustomer(c)}
            customers={customers}
            onCustomerAdded={(c) => setCustomers(prev => [c, ...prev])}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={S.label}>ชื่อลูกค้า*</label><input value={header.customer_name} onChange={setH("customer_name")} style={S.input} /></div>
          <div><label style={S.label}>เลขภาษี</label><input value={header.customer_tax_id} onChange={setH("customer_tax_id")} style={S.input} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={S.label}>ที่อยู่</label><textarea value={header.customer_address} onChange={setH("customer_address")} rows={2} style={{ ...S.input, resize: "vertical" }} /></div>
          <div><label style={S.label}>สาขา / Branch</label><input value={header.customer_branch || ""} onChange={setH("customer_branch")} placeholder="สำนักงานใหญ่ / สาขาที่..." style={S.input} /></div>
          <ContactPicker
            customerId={header.customer_id}
            customerName={header.customer_name}
            value={header.customer_contact ? { name: header.customer_contact, phone: header.customer_phone } : null}
            onChange={(c) => setHeader(h => ({ ...h, contact_id: c.id || null, customer_contact: c.name, customer_phone: c.phone || h.customer_phone }))}
            docType="receipt"
          />
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>รายการสินค้า/บริการ</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("ghost")} onClick={addManualItem}>+ เพิ่มรายการเอง</button>
            <button style={S.btn("primary")} onClick={() => setShowItemPicker(true)}>+ เลือกจาก Master</button>
          </div>
        </div>
        {showItemPicker && (
          <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>เลือกสินค้า/บริการ</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#adb5bd" }} onClick={() => setShowItemPicker(false)}>✕</button>
            </div>
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="พิมพ์ค้นหา..." style={{ ...S.input, marginBottom: 10 }} />
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredItems.map(item => (
                <div key={item.id} onClick={() => addItem(item, item._type)}
                  style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderRadius: 8, cursor: "pointer", border: "1px solid #dee2e6" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0fff4"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <div>
                    <span style={S.badge(item._type === "product" ? "blue" : "green")}>{item._type === "product" ? "สินค้า" : "บริการ"}</span>
                    <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500 }}>{item.code}</span>
                    <span style={{ marginLeft: 6, fontSize: 13 }}>{item.name_th}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#6c757d" }}>฿{fmt(item.price_thb)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {items.length === 0 ? <EmptyState icon="📦" text="ยังไม่มีรายการ" /> : (
          <table style={{ ...S.table, fontSize: 12 }}>
            <thead>
              <tr>{["#", "รหัส", "ชื่อ", "หน่วย", "จำนวน", "ราคา (THB)", "ส่วนลด%", "รวม (THB)", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item._id || item.id}>
                  <td style={S.td}>{idx + 1}</td>
                  <td style={S.td}><input value={item.code || ""} onChange={e => updateItem(idx, "code", e.target.value)} style={{ ...S.input, width: 70, padding: "4px 8px" }} /></td>
                  <td style={S.td}>
                    <input value={item.name_th || ""} onChange={e => updateItem(idx, "name_th", e.target.value)} style={{ ...S.input, width: 160, padding: "4px 8px", marginBottom: 3 }} />
                    <textarea value={item.description || ""} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." rows={2} style={{ ...S.input, width: 160, padding: "4px 8px", fontSize: 11, resize: "vertical", display: "block" }} />
                  </td>
                  <td style={S.td}><input value={item.unit || ""} onChange={e => updateItem(idx, "unit", e.target.value)} style={{ ...S.input, width: 60, padding: "4px 8px" }} /></td>
                  <td style={S.td}><input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} style={{ ...S.input, width: 60, padding: "4px 8px", textAlign: "right" }} /></td>
                  <td style={S.td}><input type="number" value={item.price_thb} onChange={e => updateItem(idx, "price_thb", e.target.value)} style={{ ...S.input, width: 90, padding: "4px 8px", textAlign: "right" }} /></td>
                  <td style={S.td}><input type="number" value={item.discount_percent} onChange={e => updateItem(idx, "discount_percent", e.target.value)} style={{ ...S.input, width: 60, padding: "4px 8px", textAlign: "right" }} /></td>
                  <td style={{ ...S.td, textAlign: "right", fontWeight: 500 }}>{fmt(item.line_total_thb)}</td>
                  <td style={S.td}><button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc3545", fontSize: 16 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <div style={{ width: 300, fontSize: 13 }}>
              {[["ยอดรวม", subtotalTHB], [`ส่วนลด (${header.discount_percent}%)`, -discAmt], [`VAT (${header.vat_percent}%)`, vatAmt]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f3f5", color: "#495057" }}>
                  <span>{label}</span><span>฿{fmt(Math.abs(val))}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", fontWeight: 700, fontSize: 15, color: "#fff", background: "#065f46", borderRadius: 8, marginTop: 8 }}>
                <span>ยอดสุทธิ</span><span>฿{fmt(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...S.card, marginBottom: 20 }}>
        <label style={S.label}>หมายเหตุ</label>
        <textarea value={header.note} onChange={setH("note")} rows={3} style={{ ...S.input, resize: "vertical" }} />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={S.btn("ghost")} onClick={onBack}>ยกเลิก</button>
        <button style={S.btn("ghost")} onClick={() => setPreview(true)}>👁 Preview / Print</button>
        {!isReadOnly && (
          <button style={S.btn("primary")} onClick={handleSave} disabled={saving}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
        )}
        {isReadOnly && (
          <button style={{ ...S.btn("ghost"), color: "#92400e", borderColor: "#f59e0b" }} onClick={() => {
            const confirmed = prompt(`พิมพ์ "แก้ไข" เพื่อยืนยัน`);
            if (confirmed === "แก้ไข") setUnlocked(true);
          }}>🔓 เปิดแก้ไข</button>
        )}
      </div>
    </div>
  );
}

function ReceiptPreview({ header, items, subtotalTHB, discAmt, vatAmt, total, onClose }) {
  const [company, setCompany] = useState(null);
  useEffect(() => { sb.db.list("company_settings").then(rows => { if (rows?.length > 0) setCompany(rows[0]); }); }, []);
  const rtKey = header.receipt_number_type || header.doc_type || "receipt_service";
  const rt = RECEIPT_TYPES[rtKey] || RECEIPT_TYPES.receipt_service;
  const docDate = header.doc_date ? new Date(header.doc_date).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={S.btn("ghost")} onClick={onClose}>← กลับแก้ไข</button>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#495057" }}>Preview {rt.label}</span>
        </div>
        <button onClick={() => window.print()} style={{ padding: "7px 18px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", background: "#065f46", color: "#fff" }}>🖨️ พิมพ์</button>
      </div>

      {["original", "copy"].map(printType => (
        <div key={printType} className={`print-page ${printType === "copy" ? "print-page-copy" : ""}`}
          style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 16, maxWidth: 900, margin: printType === "copy" ? "32px auto 0" : "0 auto", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ background: "#065f46", height: 6 }} />
          <div style={{ padding: "36px 48px" }}>

            {/* Copy label */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <div style={{ border: `1px solid ${printType === "original" ? "#065f46" : "#adb5bd"}`, borderRadius: 4, padding: "2px 7px" }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: printType === "original" ? "#065f46" : "#6c757d" }}>
                  {printType === "original" ? "ต้นฉบับ / Original · สำหรับลูกค้า" : "สำเนา / Copy"}
                </div>
              </div>
            </div>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 24, borderBottom: "2px solid #065f46" }}>
              {/* LEFT — Company */}
              <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flex: 1, paddingRight: 40 }}>
                {company?.logo_url && <img src={company.logo_url} alt="logo" style={{ maxWidth: 100, maxHeight: 64, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />}
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{company?.name_th || "บริษัทของคุณ"}</div>
                  {company?.name_en && <div style={{ fontSize: 12, color: "#6c757d", marginBottom: 6 }}>{company.name_en}</div>}
                  {company?.address_th && <div style={{ fontSize: 12, color: "#495057", lineHeight: 1.65, maxWidth: 300, marginBottom: 6 }}>{company.address_th}</div>}
                  {company?.tax_id && <div style={{ color: "#adb5bd", fontSize: 11 }}>เลขประจำตัวผู้เสียภาษี: {company.tax_id}</div>}
                </div>
              </div>
              {/* RIGHT — Doc title only */}
              <div style={{ textAlign: "right", minWidth: 240 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#065f46", letterSpacing: "-0.02em", marginTop: 16 }}>{rt.label}</div>
                <div style={{ fontSize: 12, color: "#adb5bd", letterSpacing: "0.08em", textTransform: "uppercase" }}>{rt.labelEn}</div>
              </div>
            </div>

            {/* Customer + Doc Detail */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              {/* Left — Customer */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#065f46", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>ชื่อลูกค้า</div>
                <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "16px 20px", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 4 }}>
                    {header.customer_name}
                    {header.customer_branch && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "#065f46" }}>({header.customer_branch})</span>}
                  </div>
                  {header.customer_tax_id && <div style={{ color: "#6c757d", fontSize: 12, marginBottom: 4 }}>เลขประจำตัวผู้เสียภาษี: {header.customer_tax_id}</div>}
                  {header.customer_address && <div style={{ color: "#495057", lineHeight: 1.65, marginBottom: 4 }}>{header.customer_address}</div>}
                  {header.customer_contact && <div style={{ color: "#6c757d", fontSize: 12 }}>ผู้ติดต่อ: {header.customer_contact}</div>}
                </div>
              </div>
              {/* Right — Doc detail */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#065f46", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>รายละเอียดเอกสาร</div>
                <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 10, padding: "16px 20px", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #6ee7b7" }}>
                    <span style={{ color: "#6c757d", fontSize: 12 }}>เลขที่เอกสาร</span>
                    <span style={{ fontWeight: 700, color: "#065f46" }}>{header.doc_number}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#6c757d", fontSize: 12 }}>วันที่รับชำระ</span>
                    <span style={{ color: "#495057" }}>{docDate}</span>
                  </div>
                  {header.invoice_number && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#6c757d", fontSize: 12 }}>อ้างอิง Invoice</span>
                      <span style={{ color: "#065f46", fontWeight: 500 }}>{header.invoice_number}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#6c757d", fontSize: 12 }}>วิธีชำระเงิน</span>
                    <span style={{ fontWeight: 600, color: "#065f46" }}>{PAYMENT_METHODS[header.payment_method] || header.payment_method}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
              <thead>
                <tr>
                  {["#", "รายการ", "จำนวน", "หน่วย", "ราคา/หน่วย (฿)", "ส่วนลด", "รวม (฿)"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#fff", background: "#065f46", textAlign: ["#", "จำนวน", "หน่วย"].includes(h) ? "center" : h.includes("฿") || h === "ส่วนลด" ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", color: "#adb5bd", background: i % 2 === 0 ? "#fff" : "#f8fffe" }}>{i + 1}</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", background: i % 2 === 0 ? "#fff" : "#f8fffe" }}>
                      <div style={{ fontWeight: 600 }}>{item.name_th}</div>
                      {item.name_en && <div style={{ fontSize: 11, color: "#6c757d" }}>{item.name_en}</div>}
                      {item.description && <div style={{ fontSize: 11, color: "#adb5bd" }}>{item.description}</div>}
                    </td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", background: i % 2 === 0 ? "#fff" : "#f8fffe" }}>{fmt(item.qty, 0)}</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "center", color: "#6c757d", background: i % 2 === 0 ? "#fff" : "#f8fffe" }}>{item.unit}</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", background: i % 2 === 0 ? "#fff" : "#f8fffe" }}>{fmt(item.price_thb)}</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", color: item.discount_percent > 0 ? "#dc3545" : "#dee2e6", background: i % 2 === 0 ? "#fff" : "#f8fffe" }}>{item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f3f5", textAlign: "right", fontWeight: 600, background: i % 2 === 0 ? "#fff" : "#f8fffe" }}>{fmt(item.line_total_thb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals + Bank */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 24 }}>
              {(company?.bank_name || company?.bank_account_no) ? (
                <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "14px 18px", fontSize: 12, color: "#495057", flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#065f46", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>ข้อมูลการชำระเงิน</div>
                  {company.bank_name && <div style={{ marginBottom: 3 }}>🏦 {company.bank_name}{company.bank_branch ? ` · สาขา ${company.bank_branch}` : ""}</div>}
                  {company.bank_account_no && <div style={{ marginBottom: 3 }}>เลขบัญชี: <strong>{company.bank_account_no}</strong></div>}
                  {company.bank_account_name && <div>ชื่อบัญชี: {company.bank_account_name}</div>}
                </div>
              ) : <div style={{ flex: 1 }} />}
              <div style={{ minWidth: 300, fontSize: 13 }}>
                {[["ยอดรวม", subtotalTHB], [`ส่วนลด (${header.discount_percent}%)`, discAmt], [`VAT (${header.vat_percent}%)`, vatAmt]].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f3f5", color: "#6c757d" }}>
                    <span>{label}</span><span>฿{fmt(val)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", fontWeight: 700, fontSize: 16, color: "#fff", background: "#065f46", borderRadius: 8, marginTop: 8 }}>
                  <span>ยอดสุทธิ</span><span>฿{fmt(total)}</span>
                </div>
              </div>
            </div>

            {header.note && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#92400e", marginBottom: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, textTransform: "uppercase" }}>หมายเหตุ</div>
                <div>{header.note}</div>
              </div>
            )}

            {/* 3 Signature Boxes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 48, paddingTop: 28, borderTop: "2px solid #e9ecef" }}>
              {/* Box 1 — ผู้รับใบเสร็จ */}
              <div style={{ border: "1px solid #dee2e6", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: "#ecfdf5", borderBottom: "1px solid #6ee7b7", padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", lineHeight: 1.6 }}>ผู้รับใบเสร็จ</div>
                  <div style={{ fontSize: 11, color: "#065f46" }}>Receipt Received By</div>
                </div>
                <div style={{ padding: "16px 20px 20px", textAlign: "center" }}>
                  <div style={{ height: 64 }} />
                  <div style={{ borderBottom: "1.5px solid #495057", marginBottom: 12, marginLeft: 8, marginRight: 8 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#343a40", marginBottom: 12 }}>ลายมือชื่อ / Signature</div>
                  <div style={{ fontSize: 11, color: "#adb5bd", borderBottom: "1px dashed #dee2e6", paddingBottom: 8, marginBottom: 4 }}>ชื่อ-นามสกุล ____________________</div>
                  <div style={{ fontSize: 11, color: "#adb5bd" }}>วันที่ ________________________</div>
                </div>
              </div>

              {/* Box 2 — ผู้รับเงิน */}
              <div style={{ border: "1px solid #dee2e6", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: "#ecfdf5", borderBottom: "1px solid #6ee7b7", padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", lineHeight: 1.6 }}>ผู้รับเงิน</div>
                  <div style={{ fontSize: 11, color: "#065f46" }}>Received By</div>
                </div>
                <div style={{ padding: "16px 20px 20px", textAlign: "center" }}>
                  <div style={{ height: 64 }} />
                  <div style={{ borderBottom: "1.5px solid #495057", marginBottom: 12, marginLeft: 8, marginRight: 8 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#343a40", marginBottom: 12 }}>ลายมือชื่อ / Signature</div>
                  <div style={{ fontSize: 11, color: "#adb5bd", borderBottom: "1px dashed #dee2e6", paddingBottom: 8, marginBottom: 4 }}>ชื่อ-นามสกุล ____________________</div>
                  <div style={{ fontSize: 11, color: "#adb5bd" }}>วันที่ ________________________</div>
                </div>
              </div>

              {/* Box 3 — ในนามบริษัท */}
              <div style={{ border: "1px solid #6ee7b7", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: "#065f46", padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.6 }}>ในนามบริษัท / On Behalf of</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#6ee7b7" }}>{company?.name_th || ""}</div>
                </div>
                <div style={{ padding: "16px 20px 20px", textAlign: "center", background: "#ecfdf5" }}>
                  <div style={{ height: 64 }} />
                  <div style={{ borderBottom: "1.5px solid #065f46", marginBottom: 12, marginLeft: 8, marginRight: 8 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#065f46", marginBottom: 12 }}>ผู้มีอำนาจลงนาม / Authorized Signatory</div>
                  <div style={{ fontSize: 11, color: "#6c757d" }}>วันที่ ________________________</div>
                </div>
              </div>
            </div>

          </div>
          <div style={{ background: "#f8f9fa", borderTop: "1px solid #e9ecef", padding: "12px 48px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#adb5bd" }}>
            <span>{company?.name_th}</span>
            <span>{header.doc_number} · {docDate} · {printType === "original" ? "ต้นฉบับ" : "สำเนา"}</span>
          </div>
        </div>
      ))}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body > * { display: none !important; }
          body { margin: 0 !important; }
          .print-page { display: block !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; width: 100% !important; page-break-after: always; }
          .print-page-copy { page-break-before: always; }
        }
      `}</style>
    </div>
  );
}

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────
function ExportImportPage() {
  const [exporting, setExporting] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState("");

  const TABLES = [
    { key: "customers", label: "ลูกค้า", icon: "👥", color: "#6b21a8", bg: "#f3e8ff" },
    { key: "products", label: "สินค้า", icon: "📦", color: "#1e40af", bg: "#dbeafe" },
    { key: "services", label: "บริการ", icon: "🔧", color: "#065f46", bg: "#ecfdf5" },
    { key: "quotations", label: "ใบเสนอราคา", icon: "📄", color: "#0F6E56", bg: "#d1fae5" },
    { key: "quotation_items", label: "รายการใบเสนอราคา", icon: "📋", color: "#0F6E56", bg: "#d1fae5" },
    { key: "invoices", label: "ใบแจ้งหนี้", icon: "🧾", color: "#1e40af", bg: "#dbeafe" },
    { key: "invoice_items", label: "รายการใบแจ้งหนี้", icon: "📋", color: "#1e40af", bg: "#dbeafe" },
    { key: "receipts", label: "ใบเสร็จรับเงิน", icon: "✅", color: "#065f46", bg: "#ecfdf5" },
    { key: "receipt_items", label: "รายการใบเสร็จ", icon: "📋", color: "#065f46", bg: "#ecfdf5" },
  ];

  const fetchTable = async (table) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc`, {
      headers: sb.h()
    });
    return res.json();
  };

  const exportJSON = async (table, label) => {
    setExporting(e => ({ ...e, [table]: true }));
    try {
      const data = await fetchTable(table);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${table}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(`Export ${label} ล้มเหลว`); }
    setExporting(e => ({ ...e, [table]: false }));
  };

  const exportXLSX = async (table, label) => {
    setExporting(e => ({ ...e, [`${table}_xlsx`]: true }));
    try {
      const data = await fetchTable(table);
      if (!data || data.length === 0) { setError(`ไม่มีข้อมูลใน ${label}`); setExporting(e => ({ ...e, [`${table}_xlsx`]: false })); return; }
      const headers = Object.keys(data[0]);
      const rows = data.map(row => headers.map(h => row[h] ?? ""));
      const csvContent = [headers, ...rows].map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""')+'"').join(",")).join("\n");

      const BOM = "﻿";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${table}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(`Export ${label} ล้มเหลว`); }
    setExporting(e => ({ ...e, [`${table}_xlsx`]: false }));
  };

  const exportAll = async () => {
    setExporting({ all: true });
    try {
      const allData = {};
      for (const t of TABLES) {
        allData[t.key] = await fetchTable(t.key);
      }
      allData._exported_at = new Date().toISOString();
      allData._version = "1.0";
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `full_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError("Export ทั้งหมดล้มเหลว"); }
    setExporting({});
  };

  const importJSON = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setError(""); setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const results = {};
      const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;

      // Check if it's a full backup or single table
      const isFullBackup = TABLES.some(t => Array.isArray(data[t.key]));

      if (isFullBackup) {
        for (const t of TABLES) {
          if (Array.isArray(data[t.key]) && data[t.key].length > 0) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${t.key}`, {
              method: "POST",
              headers: sb.h(token, { Prefer: "resolution=ignore-duplicates" }),
              body: JSON.stringify(data[t.key])
            });
            results[t.label] = res.ok ? `✅ ${data[t.key].length} รายการ` : `❌ Error ${res.status}`;
          }
        }
      } else if (Array.isArray(data) && data.length > 0) {
        // Single table - try to detect which one
        const sample = data[0];
        const detectedTable = TABLES.find(t => {
          if (t.key === "customers" && sample.tax_id !== undefined) return true;
          if (t.key === "products" && sample.price_thb !== undefined && (sample.tags !== undefined || sample.vat_type !== undefined)) return true;
          if (t.key === "services" && sample.price_thb !== undefined && sample.tags === undefined && sample.vat_type === undefined) return true;
          if (t.key === "quotations" && sample.valid_days !== undefined) return true;
          if (t.key === "invoices" && sample.doc_type !== undefined && sample.customer_po !== undefined) return true;
          if (t.key === "receipts" && sample.payment_method !== undefined) return true;
          return false;
        });
        if (detectedTable) {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/${detectedTable.key}`, {
            method: "POST",
            headers: sb.h(token, { Prefer: "resolution=ignore-duplicates" }),
            body: JSON.stringify(data)
          });
          results[detectedTable.label] = res.ok ? `✅ ${data.length} รายการ` : `❌ Error ${res.status}`;
        } else {
          setError("ไม่สามารถระบุประเภทข้อมูลได้ กรุณาใช้ไฟล์ full backup");
        }
      }
      setImportResult(results);
    } catch (err) { setError("ไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์ JSON ที่ export จากระบบนี้เท่านั้น"); }
    setImporting(false);
    e.target.value = "";
  };

  return (
    <div>
      <h1 style={S.pageTitle}>📦 Export / Import</h1>
      <p style={S.pageSub}>สำรองข้อมูลและนำเข้าข้อมูลในรูปแบบ JSON และ CSV</p>

      <Alert type="error" msg={error} />

      {/* Full Backup */}
      <div style={{ ...S.card, marginBottom: 20, background: "linear-gradient(135deg, #f0fff4, #ecfdf5)", border: "1px solid #6ee7b7" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#065f46", marginBottom: 4 }}>💾 Full Backup — ทุกตารางในไฟล์เดียว</div>
            <div style={{ fontSize: 13, color: "#6c757d" }}>Export ข้อมูลทั้งหมด: ลูกค้า สินค้า บริการ QT Invoice Receipt รวมเป็นไฟล์ JSON เดียว</div>
          </div>
          <button onClick={exportAll} disabled={exporting.all}
            style={{ ...S.btn("primary"), padding: "10px 24px", background: "#065f46", flexShrink: 0, marginLeft: 24 }}>
            {exporting.all ? "กำลัง Export..." : "⬇️ Export ทั้งหมด"}
          </button>
        </div>
      </div>

      {/* Individual Tables */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#343a40", marginBottom: 16 }}>Export แยกตาราง</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {TABLES.map(t => (
            <div key={t.key} style={{ background: t.bg, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.color }}>{t.label}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => exportJSON(t.key, t.label)} disabled={exporting[t.key]}
                  style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.color}`, background: "#fff", color: t.color, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                  {exporting[t.key] ? "..." : "JSON"}
                </button>
                <button onClick={() => exportXLSX(t.key, t.label)} disabled={exporting[`${t.key}_xlsx`]}
                  style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.color}`, background: "#fff", color: t.color, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                  {exporting[`${t.key}_xlsx`] ? "..." : "CSV"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Import */}
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#343a40", marginBottom: 8 }}>📥 Import ข้อมูล</div>
        <p style={{ fontSize: 13, color: "#6c757d", marginBottom: 16, lineHeight: 1.6 }}>
          รองรับเฉพาะไฟล์ JSON ที่ Export จากระบบนี้เท่านั้น — ทั้งแบบ Full Backup และแบบแยกตาราง<br />
          ข้อมูลที่มี ID ซ้ำจะถูกข้ามไป (ไม่ overwrite ข้อมูลเดิม)
        </p>
        <label style={{ display: "inline-block", padding: "10px 20px", background: "#f8f9fa", border: "2px dashed #dee2e6", borderRadius: 10, cursor: "pointer", fontSize: 13, color: "#495057", textAlign: "center" }}>
          {importing ? "กำลัง Import..." : "📂 คลิกเพื่อเลือกไฟล์ JSON"}
          <input type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} disabled={importing} />
        </label>

        {importResult && (
          <div style={{ marginTop: 16, background: "#f8f9fa", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#343a40" }}>ผลลัพธ์การ Import:</div>
            {Object.entries(importResult).map(([label, result]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f3f5", fontSize: 13 }}>
                <span style={{ color: "#495057" }}>{label}</span>
                <span style={{ color: result.startsWith("✅") ? "#065f46" : "#dc3545" }}>{result}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI CHATBOT ───────────────────────────────────────────────────────────────
function ChatbotPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "สวัสดีครับ! ผมคือ AI Assistant ของระบบ ถามเรื่องข้อมูลธุรกิจ ยอดขาย ลูกค้า หรือเอกสารต่างๆ ได้เลยครับ 😊" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bizContext, setBizContext] = useState(null);
  const messagesEndRef = React.useRef(null);

  // Load AI settings from localStorage
  const getAISettings = () => {
    try {
      const saved = localStorage.getItem("ai_settings");
      return saved ? JSON.parse(saved) : { enabledContext: ["customers", "invoices", "products"], maxHistory: 10, systemPrompt: null };
    } catch { return { enabledContext: ["customers", "invoices", "products"], maxHistory: 10, systemPrompt: null }; }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Load business context for AI
    const loadContext = async () => {
      const aiSettings = getAISettings();
      const enabled = aiSettings.enabledContext || ["customers", "invoices", "products"];
      const fetch_ = (table) => enabled.includes(table) ? sb.db.list(table) : Promise.resolve([]);
      const [customers, products, services, quotations, invoices, receipts] = await Promise.all([
        fetch_("customers"),
        fetch_("products"),
        fetch_("services"),
        fetch_("quotations"),
        fetch_("invoices"),
        fetch_("receipts"),
      ]);
      setBizContext({
        customers: customers?.length || 0,
        products: products?.length || 0,
        services: services?.length || 0,
        quotations: quotations?.length || 0,
        invoices: invoices?.length || 0,
        receipts: receipts?.length || 0,
        totalInvoiceAmount: (invoices || []).reduce((s, i) => s + (parseFloat(i.total) || 0), 0),
        totalReceiptAmount: (receipts || []).reduce((s, i) => s + (parseFloat(i.total) || 0), 0),
        pendingInvoices: (invoices || []).filter(i => ["draft", "sent", "partial"].includes(i.status)).length,
        recentCustomers: (customers || []).slice(0, 5).map(c => c.name_th).join(", "),
        recentInvoices: (invoices || []).slice(0, 5).map(i => `${i.doc_number} (${i.customer_name}) ฿${fmt(i.total)} [${i.status}]`).join(", "),
        topProducts: (products || []).slice(0, 5).map(p => `${p.name_th} ฿${fmt(p.price_thb)}`).join(", "),
      });
    };
    loadContext();
  }, []);

  const buildSystemPrompt = () => {
    const aiSettings = getAISettings();
    const basePrompt = aiSettings.systemPrompt || "คุณคือ AI Assistant สำหรับระบบบริหารธุรกิจ ตอบเป็นภาษาไทยเสมอ กระชับและตรงประเด็น";
    if (!bizContext) return basePrompt;
    return basePrompt + `

ข้อมูลธุรกิจปัจจุบัน:
- ลูกค้า: ${bizContext.customers} ราย (ตัวอย่าง: ${bizContext.recentCustomers || "ยังไม่มี"})
- สินค้า: ${bizContext.products} รายการ (ตัวอย่าง: ${bizContext.topProducts || "ยังไม่มี"})
- บริการ: ${bizContext.services} รายการ
- ใบเสนอราคา: ${bizContext.quotations} ใบ
- ใบแจ้งหนี้: ${bizContext.invoices} ใบ (รอชำระ ${bizContext.pendingInvoices} ใบ)
- ใบเสร็จ: ${bizContext.receipts} ใบ
- มูลค่าใบแจ้งหนี้รวม: ฿${fmt(bizContext.totalInvoiceAmount)}
- รับชำระแล้วรวม: ฿${fmt(bizContext.totalReceiptAmount)}
- Invoice ล่าสุด: ${bizContext.recentInvoices || "ยังไม่มี"}

ช่วยวิเคราะห์ข้อมูล แนะนำการดำเนินธุรกิจ และตอบคำถามเกี่ยวกับระบบได้`;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const aiSettings = getAISettings();
      const history = messages.slice(-(aiSettings.maxHistory || 10)).map(m => ({ role: m.role, content: m.content }));
      // เรียกผ่าน Netlify serverless function เพื่อซ่อน API key
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: [...history, { role: "user", content: userMsg }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const reply = data.content?.[0]?.text || "ขออภัย ไม่สามารถตอบได้ในขณะนี้";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ไม่สามารถเชื่อมต่อ AI ได้: ${err.message}\n\nกรุณาตรวจสอบว่าตั้งค่า ANTHROPIC_API_KEY ใน Netlify Environment Variables แล้ว` }]);
    }
    setLoading(false);
  };

  const SUGGESTIONS = [
    "สรุปยอดขายให้หน่อย",
    "Invoice ค้างชำระมีกี่ใบ",
    "แนะนำวิธีติดตามลูกค้า",
    "วิเคราะห์สถานะธุรกิจ",
    "สินค้าที่มีอยู่มีอะไรบ้าง",
    "ยอดรับชำระกับยอดแจ้งหนี้ต่างกันเท่าไหร่",
  ];

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      <h1 style={S.pageTitle}>🤖 AI Chatbot</h1>
      <p style={{ ...S.pageSub, marginBottom: 12 }}>ถามข้อมูลธุรกิจ วิเคราะห์ยอดขาย หรือขอคำแนะนำได้เลย</p>

      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: bizContext ? "#22c55e" : "#f59e0b" }} />
        <span style={{ fontSize: 12, color: "#6c757d" }}>
          {bizContext ? `โหลดข้อมูลธุรกิจแล้ว — ลูกค้า ${bizContext.customers} ราย · Invoice ${bizContext.invoices} ใบ · ใบเสร็จ ${bizContext.receipts} ใบ` : "กำลังโหลดข้อมูลธุรกิจ..."}
        </span>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", background: "#fff", border: "1px solid #e9ecef", borderRadius: "12px 12px 0 0", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-start" }}>
            {msg.role === "assistant" && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0F6E56", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🤖</div>
            )}
            <div style={{
              maxWidth: "72%", padding: "12px 16px", borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
              background: msg.role === "user" ? "#0F6E56" : "#f8f9fa",
              color: msg.role === "user" ? "#fff" : "#343a40",
              fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap",
            }}>
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e9ecef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>👤</div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0F6E56", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
            <div style={{ padding: "12px 16px", background: "#f8f9fa", borderRadius: "4px 16px 16px 16px", fontSize: 14, color: "#adb5bd" }}>
              กำลังคิด...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      <div style={{ background: "#fff", borderLeft: "1px solid #e9ecef", borderRight: "1px solid #e9ecef", padding: "10px 16px", display: "flex", gap: 8, overflowX: "auto", flexWrap: "nowrap" }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setInput(s); }}
            style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #dee2e6", background: "#fff", fontSize: 12, color: "#495057", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: "0 0 12px 12px", padding: "12px 16px", display: "flex", gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="พิมพ์คำถามที่นี่... (Enter เพื่อส่ง)"
          style={{ ...S.input, flex: 1, borderRadius: 20, padding: "10px 16px" }}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}
          style={{ padding: "10px 20px", borderRadius: 20, border: "none", background: input.trim() && !loading ? "#0F6E56" : "#dee2e6", color: input.trim() && !loading ? "#fff" : "#adb5bd", fontSize: 14, fontWeight: 500, cursor: input.trim() && !loading ? "pointer" : "not-allowed", flexShrink: 0 }}>
          ส่ง →
        </button>
      </div>
    </div>
  );
}

// ─── DOCUMENT NUMBERING SYSTEM ────────────────────────────────────────────────
const DOC_CONFIGS = {
  quotation:        { prefix: "QT", label: "ใบเสนอราคา",                    refTable: "quotations" },
  invoice_product:  { prefix: "TX", label: "ใบแจ้งหนี้ (สินค้า)",           refTable: "invoices" },
  invoice_service:  { prefix: "IV", label: "ใบแจ้งหนี้ (บริการ)",           refTable: "invoices" },
  receipt_product:  { prefix: "RS", label: "ใบเสร็จรับเงิน (สินค้า)",                  refTable: "receipts" },
  receipt_service:  { prefix: "RE", label: "ใบเสร็จรับเงิน/ใบกำกับภาษี (บริการ)",      refTable: "receipts" },
};

const getYYMM = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return { yy, mm };
};

const buildDocNumber = (prefix, yy, mm, num, digits = 3) =>
  `${prefix}${yy}${mm}${String(num).padStart(digits, "0")}`;

// format: prefix(2) + YY(2) + MM(2) + running(3) = 9 digits total
const getDocDigits = (docType) => 3;

const callAtomicSequence = async (docType, status = "used") => {
  const config = DOC_CONFIGS[docType];
  if (!config) return null;
  const { yy, mm } = getYYMM();
  const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_next_doc_number`, {
      method: "POST",
      headers: sb.h(token),
      body: JSON.stringify({ p_prefix: config.prefix, p_doc_type: docType, p_year_2digit: yy, p_month_2digit: mm, p_status: status })
    });
    if (!res.ok) { console.error("Sequence error:", await res.text()); return null; }
    const docNumber = await res.json();
    return docNumber;
  } catch (e) { console.error("Sequence error:", e); return null; }
};

// Preview next number WITHOUT consuming it
const previewNextDocNumber = async (docType) => {
  const config = DOC_CONFIGS[docType];
  if (!config) return "";
  const { yy, mm } = getYYMM();
  const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/doc_sequences?prefix=eq.${config.prefix}&year_2digit=eq.${yy}&month_2digit=eq.${mm}&select=last_number`,
      { headers: sb.h(token) }
    );
    const data = await res.json();
    const lastNum = Array.isArray(data) && data.length > 0 ? data[0].last_number : 0;
    return buildDocNumber(config.prefix, yy, mm, lastNum + 1, getDocDigits(docType));
  } catch (e) { return ""; }
};

const generateDocNumber = (docType) => callAtomicSequence(docType, "used");
const reserveDocNumber = (docType) => callAtomicSequence(docType, "reserved");

// ─── DOC NUMBER MANAGEMENT PAGE ───────────────────────────────────────────────
function ManualReserveForm({ onDone }) {
  const [docType, setDocType] = useState("quotation");
  const [customNum, setCustomNum] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState("auto"); // auto = next in sequence, manual = custom number
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  const handleReserve = async () => {
    setSaving(true); setResult("");
    let docNumber;
    if (mode === "auto") {
      docNumber = await reserveDocNumber(docType);
    } else {
      if (!customNum.trim()) { setSaving(false); return; }
      docNumber = customNum.trim().toUpperCase();
      // Log as reserved manually
      const config = DOC_CONFIGS[docType];
      const { yy, mm } = getYYMM();
      const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/doc_number_log`, {
        method: "POST",
        headers: sb.h(token, { Prefer: "return=representation" }),
        body: JSON.stringify({ doc_number: docNumber, prefix: config.prefix, doc_type: docType, year_2digit: yy, month_2digit: mm, running_number: 0, status: "reserved", ref_table: config.refTable, note: note || "จองนอกระบบ" })
      });
      if (!res.ok) { setResult("❌ เกิดข้อผิดพลาด หรือเลขนี้มีอยู่แล้ว"); setSaving(false); return; }
    }
    if (docNumber) {
      setResult(`✅ จองเลขที่ ${docNumber} เรียบร้อย`);
      setCustomNum(""); setNote("");
      onDone?.();
    } else {
      setResult("❌ เกิดข้อผิดพลาด");
    }
    setSaving(false);
    setTimeout(() => setResult(""), 4000);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
      <div>
        <label style={S.label}>ประเภทเอกสาร</label>
        <select value={docType} onChange={e => setDocType(e.target.value)} style={{ ...S.input, width: 220, fontSize: 12, padding: "6px 10px" }}>
          {Object.entries(DOC_CONFIGS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label style={S.label}>วิธีจอง</label>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ value: "auto", label: "🔢 เลขถัดไปอัตโนมัติ" }, { value: "manual", label: "✏️ ระบุเลขเอง" }].map(m => (
            <button key={m.value} onClick={() => setMode(m.value)}
              style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${mode === m.value ? "#0F6E56" : "#dee2e6"}`, background: mode === m.value ? "#f0fff4" : "#fff", color: mode === m.value ? "#0F6E56" : "#495057", fontSize: 12, fontWeight: mode === m.value ? 600 : 400, cursor: "pointer" }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {mode === "manual" && (
        <div>
          <label style={S.label}>เลขที่เอกสาร</label>
          <input value={customNum} onChange={e => setCustomNum(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9))} placeholder="เช่น TX2506001" maxLength={9} style={{ ...S.input, width: 160, fontSize: 12, padding: "6px 10px" }} />
        </div>
      )}
      <div>
        <label style={S.label}>หมายเหตุ (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น สำหรับลูกค้า ABC" style={{ ...S.input, width: 200, fontSize: 12, padding: "6px 10px" }} />
      </div>
      <button onClick={handleReserve} disabled={saving || (mode === "manual" && !customNum.trim())}
        style={{ ...S.btn("primary"), padding: "7px 20px", background: "#f59e0b", alignSelf: "flex-end" }}>
        {saving ? "กำลังจอง..." : "📌 จองเลข"}
      </button>
      {result && <div style={{ alignSelf: "flex-end", fontSize: 13, fontWeight: 500, color: result.startsWith("✅") ? "#065f46" : "#dc3545" }}>{result}</div>}
    </div>
  );
}

function DocNumberPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState({});
  const [sequences, setSequences] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { yy, mm } = getYYMM();
  const [recycleModal, setRecycleModal] = useState(null);
  const [recycling, setRecycling] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const load = async () => {
    setLoading(true);
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const headers = sb.h(token);
    const [logRes, seqRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/doc_number_log?order=created_at.desc&limit=200&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/doc_sequences?order=updated_at.desc&select=*`, { headers }),
    ]);
    const [logData, seqData] = await Promise.all([logRes.json(), seqRes.json()]);
    if (Array.isArray(logData)) setLogs(logData);
    if (Array.isArray(seqData)) setSequences(seqData);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReserve = async (docType) => {
    setReserving(r => ({ ...r, [docType]: true }));
    const num = await reserveDocNumber(docType);
    await load();
    setReserving(r => ({ ...r, [docType]: false }));
    if (num) alert(`จองเลขที่ ${num} เรียบร้อยแล้ว\nนำเลขนี้ไปใช้กับเอกสารที่ต้องการได้เลย`);
  };

  const handleVoid = async (id, docNumber) => {
    if (!confirm(`ยืนยันการยกเลิกเลขที่ ${docNumber}?\n\nเลขนี้จะถูกบันทึกว่า "ยกเลิก" และสามารถนำกลับมาใช้ใหม่ได้ในภายหลัง`)) return;
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    await fetch(`${SUPABASE_URL}/rest/v1/doc_number_log?id=eq.${id}`, {
      method: "PATCH",
      headers: sb.h(token),
      body: JSON.stringify({ status: "voided", updated_at: new Date().toISOString() })
    });
    load();
  };

  const handleRecycle = async (mode) => {
    if (!recycleModal) return;
    setRecycling(true);
    const token = sb.auth.getSession()?.access_token || SUPABASE_ANON_KEY;
    const newStatus = mode === "use" ? "used" : "reserved";
    await fetch(`${SUPABASE_URL}/rest/v1/doc_number_log?id=eq.${recycleModal.id}`, {
      method: "PATCH",
      headers: sb.h(token),
      body: JSON.stringify({ status: newStatus, updated_at: new Date().toISOString() })
    });
    setRecycling(false);
    setRecycleModal(null);
    load();
  };

  const statusStyle = {
    used:     { label: "ใช้แล้ว",  bg: "#dbeafe", color: "#1e40af", icon: "✅" },
    reserved: { label: "จองไว้",   bg: "#fef3c7", color: "#92400e", icon: "📌" },
    voided:   { label: "ยกเลิก",  bg: "#fee2e2", color: "#991b1b", icon: "🚫" },
  };

  const filteredLogs = logs.filter(l => {
    if (filterType && l.doc_type !== filterType) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const getNextPreview = (docType) => {
    const config = DOC_CONFIGS[docType];
    const seq = sequences.find(s => s.prefix === config.prefix && s.year_2digit === yy && s.month_2digit === mm);
    const next = seq ? seq.last_number + 1 : 1;
    return buildDocNumber(config.prefix, yy, mm, next, getDocDigits(docType));
  };

  // Group DOC_CONFIGS by category
  const docGroups = [
    {
      label: "ใบเสนอราคา", icon: "📄", color: "#0F6E56", bg: "#d1fae5",
      types: ["quotation"],
    },
    {
      label: "ใบแจ้งหนี้", icon: "🧾", color: "#1e40af", bg: "#dbeafe",
      types: ["invoice_product", "invoice_service"],
    },
    {
      label: "ใบเสร็จรับเงิน", icon: "✅", color: "#6b21a8", bg: "#f3e8ff",
      types: ["receipt_product", "receipt_service"],
    },
  ];

  const DOC_HINTS = {
    quotation:       "ออกให้ลูกค้าก่อนยืนยันคำสั่งซื้อ",
    invoice_product: "ใบแจ้งหนี้สินค้า — prefix TX (มีภาษีมูลค่าเพิ่ม/ส่งของ)",
    invoice_service: "ใบแจ้งหนี้บริการ — prefix IV (วางบิลทั่วไป)",
    receipt_product: "ออกเมื่อรับชำระจาก TX — prefix RS",
    receipt_service: "ออกเมื่อรับชำระจาก IV — prefix RE (พร้อมใบกำกับภาษี)",
  };

  const statCounts = { used: 0, reserved: 0, voided: 0 };
  logs.forEach(l => { if (statCounts[l.status] !== undefined) statCounts[l.status]++; });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h1 style={S.pageTitle}>🔢 จัดการเลขที่เอกสาร</h1>
          <p style={S.pageSub}>ระบบออกเลขอัตโนมัติ — ไม่ซ้ำ ไม่ข้าม ทุกประเภทเอกสาร</p>
        </div>
        <button onClick={() => setShowGuide(g => !g)}
          style={{ ...S.btn("ghost"), fontSize: 12, padding: "6px 14px", marginTop: 4 }}>
          {showGuide ? "ซ่อนคำอธิบาย ▲" : "❓ วิธีใช้งาน ▼"}
        </button>
      </div>

      {/* Guide Panel */}
      {showGuide && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#166534", marginBottom: 12 }}>📖 วิธีอ่านเลขที่เอกสาร</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #bbf7d0" }}>
              <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "#0F6E56", letterSpacing: 2 }}>TX2505001</div>
              <div style={{ fontSize: 11, color: "#6c757d", marginTop: 4 }}>
                <span style={{ color: "#1e40af", fontWeight: 600 }}>TX</span> = ประเภท ·{" "}
                <span style={{ color: "#0F6E56", fontWeight: 600 }}>25</span> = ปี 2025 ·{" "}
                <span style={{ color: "#6b21a8", fontWeight: 600 }}>05</span> = เดือน 5 ·{" "}
                <span style={{ color: "#dc3545", fontWeight: 600 }}>001</span> = ลำดับ
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 12, color: "#495057", lineHeight: 1.7 }}>
                <b>ระบบออกเลขอัตโนมัติ</b> ทุกครั้งที่บันทึกเอกสารใหม่<br />
                เลขจะไม่ซ้ำและไม่ข้ามลำดับ แม้มีหลายคนใช้พร้อมกัน<br />
                เลขจะ <b>รีเซ็ตทุกต้นเดือน</b> (001 ใหม่ทุกเดือน)
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { action: "📌 จองเลข", desc: "ล็อคเลขถัดไปไว้ก่อน สำหรับเอกสารที่ต้องออกนอกระบบ หรือต้องการใช้เลขนี้แน่นอน" },
              { action: "🚫 Void เลข", desc: "ยกเลิกเลขที่ออกผิด หรือเลขที่จองไว้แต่ไม่ได้ใช้ เลขที่ void แล้วสามารถนำกลับมาใช้ได้" },
              { action: "♻️ นำมาใช้", desc: "นำเลขที่ถูก Void กลับมาใช้งานได้อีกครั้ง โดยเปลี่ยนสถานะเป็น จองไว้ หรือ ใช้แล้ว" },
            ].map(({ action, desc }) => (
              <div key={action} style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0F6E56", marginBottom: 4 }}>{action}</div>
                <div style={{ fontSize: 11, color: "#6c757d", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "ใช้แล้วเดือนนี้", value: logs.filter(l => l.status === "used" && l.year_2digit === yy && l.month_2digit === mm).length, ...statusStyle.used },
          { label: "จองไว้รอใช้", value: statCounts.reserved, ...statusStyle.reserved },
          { label: "ยกเลิกสะสม", value: statCounts.voided, ...statusStyle.voided },
        ].map(({ label, value, bg, color, icon }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 11, color, opacity: 0.8, fontWeight: 500 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Next number cards grouped */}
      {docGroups.map(group => (
        <div key={group.label} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>{group.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: group.color }}>{group.label}</span>
            <div style={{ flex: 1, height: 1, background: "#e9ecef", marginLeft: 4 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${group.types.length}, 1fr)`, gap: 14 }}>
            {group.types.map(docType => {
              const config = DOC_CONFIGS[docType];
              const nextNum = getNextPreview(docType);
              return (
                <div key={docType} style={{ ...S.card, border: `1.5px solid ${group.bg}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ background: group.bg, borderRadius: 10, padding: "10px 14px", textAlign: "center", minWidth: 64, flexShrink: 0 }}>
                    <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 18, color: group.color }}>{config.prefix}</div>
                    <div style={{ fontSize: 9, color: group.color, opacity: 0.7, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>prefix</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#343a40", marginBottom: 2 }}>{config.label}</div>
                    <div style={{ fontSize: 11, color: "#6c757d", marginBottom: 10, lineHeight: 1.5 }}>{DOC_HINTS[docType]}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, color: "#adb5bd", fontWeight: 500, marginBottom: 1 }}>เลขถัดไป</div>
                        <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 16, color: "#0F6E56", letterSpacing: 1 }}>{nextNum}</div>
                      </div>
                      <button onClick={() => handleReserve(docType)} disabled={reserving[docType]}
                        style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, border: "1px solid #f59e0b", background: "#fffbeb", color: "#92400e", fontSize: 12, fontWeight: 500, cursor: reserving[docType] ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                        {reserving[docType] ? "⏳ กำลังจอง..." : "📌 จองเลข"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Manual reserve form */}
      <div style={{ ...S.card, marginBottom: 20, border: "1.5px dashed #dee2e6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#343a40" }}>จองเลขแบบระบุเอง</span>
        </div>
        <div style={{ fontSize: 12, color: "#6c757d", marginBottom: 16 }}>
          สำหรับจองเลขที่ต้องการใช้กับเอกสารนอกระบบ เช่น เอกสาร PDF ที่พิมพ์ออกนอก app
        </div>
        <ManualReserveForm onDone={load} />
      </div>

      {/* Log table */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#343a40" }}>ประวัติเลขที่เอกสารทั้งหมด</div>
            <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 2 }}>แสดง 200 รายการล่าสุด</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ ...S.input, width: 190, fontSize: 12, padding: "6px 10px" }}>
              <option value="">📂 ทุกประเภทเอกสาร</option>
              {Object.entries(DOC_CONFIGS).map(([k, v]) => (
                <option key={k} value={k}>{v.prefix} — {v.label}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ ...S.input, width: 140, fontSize: 12, padding: "6px 10px" }}>
              <option value="">🔍 ทุกสถานะ</option>
              <option value="used">✅ ใช้แล้ว</option>
              <option value="reserved">📌 จองไว้</option>
              <option value="voided">🚫 ยกเลิก</option>
            </select>
            <button onClick={load} style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 12 }} title="โหลดข้อมูลใหม่">🔄</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#adb5bd" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 13 }}>กำลังโหลดข้อมูล...</div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#adb5bd" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔢</div>
            <div style={{ fontSize: 13 }}>ยังไม่มีประวัติเลขที่เอกสาร</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>เริ่มสร้างเอกสารแรกเพื่อให้ระบบออกเลขอัตโนมัติ</div>
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>เลขที่เอกสาร</th>
                <th style={S.th}>ประเภท</th>
                <th style={S.th}>เดือน/ปี</th>
                <th style={{ ...S.th, textAlign: "center" }}>ลำดับ</th>
                <th style={S.th}>สถานะ</th>
                <th style={S.th}>วันที่ออก</th>
                <th style={S.th}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const st = statusStyle[log.status] || statusStyle.used;
                const config = DOC_CONFIGS[log.doc_type];
                return (
                  <tr key={log.id} onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={S.td}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#0F6E56", letterSpacing: 1 }}>{log.doc_number}</span>
                    </td>
                    <td style={S.td}>
                      <div style={{ fontSize: 12, color: "#343a40", fontWeight: 500 }}>{config?.label || log.doc_type}</div>
                      <div style={{ fontSize: 10, color: "#adb5bd", marginTop: 1 }}>prefix: {config?.prefix || "—"}</div>
                    </td>
                    <td style={S.td}><span style={{ fontSize: 12, color: "#6c757d" }}>20{log.year_2digit} / {log.month_2digit}</span></td>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 13, color: "#495057" }}>#{String(log.running_number).padStart(3, "0")}</span>
                    </td>
                    <td style={S.td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td style={S.td}><span style={{ fontSize: 12, color: "#6c757d" }}>{new Date(log.created_at).toLocaleDateString("th-TH")}</span></td>
                    <td style={S.td}>
                      {log.status === "reserved" && (
                        <button onClick={() => handleVoid(log.id, log.doc_number)}
                          title="ยกเลิกการจองเลขนี้"
                          style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 11 }}>
                          🚫 ยกเลิกจอง
                        </button>
                      )}
                      {log.status === "used" && !log.ref_id && (
                        <button onClick={() => handleVoid(log.id, log.doc_number)}
                          title="Void เลขนี้ (เอกสารไม่มีใน system)"
                          style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 11 }}>
                          🚫 Void
                        </button>
                      )}
                      {log.status === "used" && log.ref_id && (
                        <span style={{ fontSize: 11, color: "#adb5bd", fontStyle: "italic" }}>มีเอกสารผูกอยู่</span>
                      )}
                      {log.status === "voided" && (
                        <button onClick={() => setRecycleModal({ id: log.id, doc_number: log.doc_number, doc_type: log.doc_type })}
                          title="นำเลขนี้กลับมาใช้ใหม่"
                          style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 11, color: "#0F6E56", borderColor: "#0F6E56" }}>
                          ♻️ นำมาใช้
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recycle Modal */}
      {recycleModal && (
        <Modal title={`♻️ นำเลขที่ ${recycleModal.doc_number} กลับมาใช้`} onClose={() => setRecycleModal(null)}>
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400e" }}>
            เลขนี้เคยถูก Void ไปแล้ว — ประเภท: <b>{DOC_CONFIGS[recycleModal.doc_type]?.label || recycleModal.doc_type}</b>
          </div>
          <p style={{ fontSize: 13, color: "#495057", marginBottom: 14, fontWeight: 500 }}>ต้องการนำกลับมาใช้อย่างไร?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <div style={{ border: "2px solid #86efac", borderRadius: 10, padding: "14px 16px", cursor: "pointer", background: "#f0fff4" }}
              onClick={() => !recycling && handleRecycle("reserve")}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F6E56", marginBottom: 4 }}>📌 จองเลขนี้กลับมา (Reserved)</div>
              <div style={{ fontSize: 12, color: "#6c757d" }}>นำไปใช้กับเอกสารใหม่ในภายหลัง ระบบจะไม่ออกเลขนี้ซ้ำอีก</div>
            </div>
            <div style={{ border: "2px solid #bfdbfe", borderRadius: 10, padding: "14px 16px", cursor: "pointer", background: "#eff6ff" }}
              onClick={() => !recycling && handleRecycle("use")}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>✅ ทำเครื่องหมายว่าใช้แล้ว (Used)</div>
              <div style={{ fontSize: 12, color: "#6c757d" }}>สำหรับเอกสารที่ออกด้วยเลขนี้ไปแล้วนอกระบบ</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button style={S.btn("ghost")} onClick={() => setRecycleModal(null)} disabled={recycling}>ปิด</button>
          </div>
          {recycling && <p style={{ fontSize: 12, color: "#adb5bd", marginTop: 10, textAlign: "center" }}>⏳ กำลังดำเนินการ...</p>}
        </Modal>
      )}
    </div>
  );
}

function SField({ label, fieldKey, type, placeholder, fullWidth, textarea, value, onChange }) {
  return (
    <div style={{ gridColumn: fullWidth ? "1 / -1" : "auto" }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#495057", display: "block", marginBottom: 5 }}>{label}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(fieldKey, e.target.value)} rows={3} placeholder={placeholder || ""} style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #dee2e6", borderRadius: 8, background: "#fff", color: "#1a1a1a", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
        : <input type={type || "text"} value={value} onChange={e => onChange(fieldKey, e.target.value)} placeholder={placeholder || ""} style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #dee2e6", borderRadius: 8, background: "#fff", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }} />
      }
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage() {
  const [form, setForm] = useState({
    name_th: "", name_en: "", tax_id: "",
    address_th: "", address_en: "",
    phone: "", email: "", website: "",
    contact_name: "", contact_position: "",
    bank_name: "", bank_branch: "", bank_account_no: "", bank_account_name: "",
    logo_url: "",
  });
  const [settingId, setSettingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("company");
  const [vat_rate, set_vat_rate] = useState("7");

  useEffect(() => {
    sb.db.list("company_settings").then(rows => {
      if (rows && rows.length > 0) {
        const { created_at, updated_at, ...rest } = rows[0];
        setSettingId(rows[0].id);
        setForm(rest);
        if (rest.vat_rate != null) set_vat_rate(String(rest.vat_rate));
      }
      setLoading(false);
    });
  }, []);

  const handleChange = useCallback((k, v) => {
    setForm(f => ({ ...f, [k]: v }));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    const { id, created_at, updated_at, ...payload } = form;
    payload.vat_rate = parseFloat(vat_rate) || 0;
    payload.updated_at = new Date().toISOString();
    const { error: err } = settingId
      ? await sb.db.update("company_settings", settingId, payload)
      : await sb.db.insert("company_settings", payload);
    setSaving(false);
    if (err) { setError(err.message || JSON.stringify(err)); return; }
    setSuccess("บันทึกข้อมูลเรียบร้อยแล้ว ✓");
    setTimeout(() => setSuccess(""), 3000);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#adb5bd" }}>กำลังโหลด...</div>;

  return (
    <div>
      <h1 style={S.pageTitle}>⚙️ ตั้งค่าระบบ</h1>
      <p style={S.pageSub}>จัดการข้อมูลบริษัทและการตั้งค่าต่างๆ ของระบบ</p>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#f8f9fa", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
        {[{ key: "company", label: "🏢 ข้อมูลบริษัท" }, { key: "ai", label: "🤖 AI Chatbot" }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
              background: activeTab === tab.key ? "#fff" : "transparent",
              color: activeTab === tab.key ? "#1a1a1a" : "#adb5bd",
              boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "company" && <>
      <p style={{ fontSize: 13, color: "#6c757d", marginBottom: 20 }}>ข้อมูลนี้จะแสดงในเอกสารทุกใบ เช่น ใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ</p>
      <Alert type="error" msg={error} />
      {success && <Alert type="success" msg={success} />}
      <form onSubmit={handleSave}>
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 16 }}>🏢 ข้อมูลบริษัท</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SField label="ชื่อบริษัท (ภาษาไทย)" fieldKey="name_th" placeholder="บริษัท ตัวอย่าง จำกัด" value={form.name_th || ""} onChange={handleChange} />
            <SField label="ชื่อบริษัท (ภาษาอังกฤษ)" fieldKey="name_en" placeholder="Example Co., Ltd." value={form.name_en || ""} onChange={handleChange} />
            <SField label="เลขประจำตัวผู้เสียภาษี" fieldKey="tax_id" placeholder="0-0000-00000-00-0" value={form.tax_id || ""} onChange={handleChange} />
            <div />
            <SField label="ที่อยู่ (ภาษาไทย)" fieldKey="address_th" textarea fullWidth placeholder="เลขที่ ถนน แขวง เขต จังหวัด รหัสไปรษณีย์" value={form.address_th || ""} onChange={handleChange} />
            <SField label="ที่อยู่ (ภาษาอังกฤษ)" fieldKey="address_en" textarea fullWidth placeholder="No., Street, District, Province, Postcode" value={form.address_en || ""} onChange={handleChange} />
            <SField label="โทรศัพท์" fieldKey="phone" placeholder="02-000-0000" value={form.phone || ""} onChange={handleChange} />
            <SField label="อีเมล" fieldKey="email" type="email" placeholder="info@company.com" value={form.email || ""} onChange={handleChange} />
            <SField label="เว็บไซต์" fieldKey="website" placeholder="https://www.company.com" value={form.website || ""} onChange={handleChange} />
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 16 }}>👤 ข้อมูลผู้ติดต่อ</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SField label="ชื่อผู้ติดต่อ" fieldKey="contact_name" placeholder="คุณสมชาย ใจดี" value={form.contact_name || ""} onChange={handleChange} />
            <SField label="ตำแหน่ง" fieldKey="contact_position" placeholder="ผู้จัดการฝ่ายขาย" value={form.contact_position || ""} onChange={handleChange} />
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 16 }}>🏦 ข้อมูลธนาคาร</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SField label="ธนาคาร" fieldKey="bank_name" placeholder="ธนาคารกสิกรไทย" value={form.bank_name || ""} onChange={handleChange} />
            <SField label="สาขา" fieldKey="bank_branch" placeholder="สีลม" value={form.bank_branch || ""} onChange={handleChange} />
            <SField label="เลขบัญชี" fieldKey="bank_account_no" placeholder="000-0-00000-0" value={form.bank_account_no || ""} onChange={handleChange} />
            <SField label="ชื่อบัญชี" fieldKey="bank_account_name" placeholder="บริษัท ตัวอย่าง จำกัด" value={form.bank_account_name || ""} onChange={handleChange} />
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 16 }}>🧾 ภาษีมูลค่าเพิ่ม (VAT)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, alignItems: "center" }}>
            <div>
              <label style={S.label}>อัตรา VAT (%)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="number" value={vat_rate} onChange={e => set_vat_rate(e.target.value)}
                  min="0" max="100" step="0.5" style={{ ...S.input, width: 100 }} />
                <span style={{ fontSize: 13, color: "#6c757d" }}>%</span>
              </div>
            </div>
            <div style={{ padding: "10px 16px", background: "#f8f9fa", borderRadius: 8, fontSize: 13 }}>
              <div style={{ color: "#6c757d", marginBottom: 4 }}>เอกสารใหม่จะใช้อัตรา VAT นี้เป็นค่า default อัตโนมัติ</div>
              <div style={{ color: "#0F6E56", fontWeight: 500 }}>ตัวอย่าง: ราคา ฿100 + VAT {vat_rate}% = ฿{(100 * (1 + parseFloat(vat_rate || 0) / 100)).toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 16 }}>🖼️ โลโก้บริษัท</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "start" }}>
            <div>
              <label style={S.label}>URL รูปโลโก้</label>
              <input value={form.logo_url || ""} onChange={e => handleChange("logo_url", e.target.value)} placeholder="https://..." style={S.input} />
              <p style={{ fontSize: 11, color: "#adb5bd", marginTop: 6 }}>อัปโหลดรูปไปที่ Supabase Storage หรือ imgur.com แล้ววาง URL ที่นี่</p>
            </div>
            {form.logo_url && (
              <div style={{ border: "1px solid #dee2e6", borderRadius: 8, padding: 8, background: "#f8f9fa" }}>
                <img src={form.logo_url} alt="logo" style={{ maxWidth: 120, maxHeight: 80, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" style={{ ...S.btn("primary"), padding: "10px 28px", fontSize: 14 }} disabled={saving}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
          </button>
        </div>
      </form>
      </>}

      {activeTab === "ai" && <AISettingsPanel />}
    </div>
  );
}

// ─── AI SETTINGS PANEL ────────────────────────────────────────────────────────
function AISettingsPanel() {
  const DEFAULT_SYSTEM = `คุณคือ AI Assistant สำหรับระบบบริหารธุรกิจ ตอบเป็นภาษาไทยเสมอ กระชับและตรงประเด็น

บทบาท:
- ช่วยวิเคราะห์ข้อมูลธุรกิจจากข้อมูลที่ให้มา
- ตอบคำถามเกี่ยวกับ ลูกค้า สินค้า ยอดขาย Invoice ใบเสร็จ
- แนะนำการดำเนินธุรกิจและการติดตามลูกค้า
- ไม่สร้างข้อมูลที่ไม่มีในระบบ
- ไม่ตอบเรื่องที่ไม่เกี่ยวกับธุรกิจ`;

  const CONTEXT_OPTIONS = [
    { key: "customers", label: "รายชื่อลูกค้า", desc: "ชื่อ เลขภาษี เครดิต" },
    { key: "products", label: "รายการสินค้า", desc: "รหัส ชื่อ ราคา" },
    { key: "services", label: "รายการบริการ", desc: "รหัส ชื่อ ราคา" },
    { key: "invoices", label: "ใบแจ้งหนี้", desc: "เลขที่ ลูกค้า ยอด สถานะ" },
    { key: "quotations", label: "ใบเสนอราคา", desc: "เลขที่ ลูกค้า ยอด สถานะ" },
    { key: "receipts", label: "ใบเสร็จ", desc: "เลขที่ ลูกค้า ยอด" },
  ];

  const loadSaved = () => {
    try {
      const saved = localStorage.getItem("ai_settings");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };

  const saved = loadSaved();
  const [systemPrompt, setSystemPrompt] = useState(saved?.systemPrompt || DEFAULT_SYSTEM);
  const [enabledContext, setEnabledContext] = useState(saved?.enabledContext || ["customers", "invoices", "products"]);
  const [maxHistory, setMaxHistory] = useState(saved?.maxHistory || 10);
  const [savedMsg, setSavedMsg] = useState("");

  const toggleContext = (key) => {
    setEnabledContext(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    localStorage.setItem("ai_settings", JSON.stringify({ systemPrompt, enabledContext, maxHistory }));
    setSavedMsg("บันทึกแล้ว ✓");
    setTimeout(() => setSavedMsg(""), 2000);
  };

  const handleReset = () => {
    setSystemPrompt(DEFAULT_SYSTEM);
    setEnabledContext(["customers", "invoices", "products"]);
    setMaxHistory(10);
  };

  return (
    <div>
      {/* Current Status */}
      <div style={{ ...S.card, marginBottom: 16, background: "#f0fff4", border: "1px solid #9ae6b4" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46", marginBottom: 12 }}>📊 สถานะปัจจุบัน</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Model", value: "Claude Sonnet 4", icon: "🧠" },
            { label: "ภาษา", value: "ภาษาไทย", icon: "🇹🇭" },
            { label: "ประวัติแชท", value: `${maxHistory} ข้อความ`, icon: "💬" },
            { label: "ข้อมูลที่ส่งให้ AI", value: `${enabledContext.length} หมวด`, icon: "📦" },
            { label: "System Prompt", value: `${systemPrompt.length} ตัวอักษร`, icon: "📝" },
            { label: "สถานะ", value: "พร้อมใช้งาน", icon: "✅" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", borderRadius: 8 }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: "#6c757d" }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46" }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Context Data */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 6 }}>📦 ข้อมูลที่ส่งให้ AI รู้</div>
        <p style={{ fontSize: 12, color: "#6c757d", marginBottom: 14 }}>เลือกว่าจะให้ AI เข้าถึงข้อมูลหมวดไหนบ้าง ข้อมูลมากขึ้น = AI ตอบได้แม่นยำขึ้น แต่ใช้ token มากขึ้น</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {CONTEXT_OPTIONS.map(opt => {
            const on = enabledContext.includes(opt.key);
            return (
              <div key={opt.key} onClick={() => toggleContext(opt.key)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${on ? "#0F6E56" : "#dee2e6"}`, background: on ? "#f0fff4" : "#fff", cursor: "pointer", transition: "all 0.15s" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${on ? "#0F6E56" : "#dee2e6"}`, background: on ? "#0F6E56" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {on && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: on ? "#0F6E56" : "#495057" }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: "#adb5bd" }}>{opt.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 12 }}>💬 จำนวนประวัติแชท</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <input type="range" min={2} max={20} step={2} value={maxHistory} onChange={e => setMaxHistory(Number(e.target.value))}
            style={{ flex: 1, accentColor: "#0F6E56" }} />
          <div style={{ minWidth: 80, textAlign: "center", padding: "6px 14px", background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#0F6E56" }}>
            {maxHistory} ข้อความ
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#adb5bd", marginTop: 8 }}>AI จะจำบทสนทนาย้อนหลังกี่ข้อความ — มากขึ้นจำบริบทได้ดีขึ้น แต่ใช้ token มากขึ้น</p>
      </div>

      {/* System Prompt */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>📝 System Prompt (บทบาทของ AI)</div>
          <button onClick={handleReset} style={{ ...S.btn("ghost"), padding: "4px 12px", fontSize: 12 }}>↺ รีเซ็ต</button>
        </div>
        <p style={{ fontSize: 12, color: "#6c757d", marginBottom: 10 }}>กำหนดบทบาท ขอบเขต และพฤติกรรมของ AI Chatbot</p>
        <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
          rows={10} style={{ ...S.input, resize: "vertical", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }} />
        <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 6 }}>
          {systemPrompt.length} ตัวอักษร · ข้อมูลธุรกิจจาก Supabase จะถูกเพิ่มต่อท้ายอัตโนมัติ
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {savedMsg && <span style={{ color: "#065f46", fontSize: 13, fontWeight: 500 }}>✓ {savedMsg}</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={handleSave} style={{ ...S.btn("primary"), padding: "10px 28px" }}>💾 บันทึกการตั้งค่า</button>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR NAV ──────────────────────────────────────────────────────────────
const NAV = [
  { section: "หลัก" },
  { key: "home", icon: "🏠", label: "หน้าหลัก" },
  { section: "Master Data" },
  { key: "customers", icon: "👥", label: "ลูกค้า" },
  { key: "products", icon: "📦", label: "สินค้า" },
  { key: "services", icon: "🔧", label: "บริการ" },
  { section: "เอกสาร" },
  { key: "quotations", icon: "📄", label: "ใบเสนอราคา" },
  { key: "invoices", icon: "🧾", label: "ใบแจ้งหนี้" },
  { key: "receipts", icon: "✅", label: "ใบเสร็จ" },
  { section: "เครื่องมือ" },
  { key: "docnumbers", icon: "🔢", label: "เลขที่เอกสาร" },
  { key: "chatbot", icon: "🤖", label: "AI Chatbot" },
  { key: "export", icon: "📦", label: "Export / Import" },
  { key: "settings", icon: "⚙️", label: "ตั้งค่า" },
  { key: "users", icon: "👤", label: "จัดการผู้ใช้" },
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(() => sb.auth.getSession());
  const [page, setPage] = useState("home");
  const [quotationDoc, setQuotationDoc] = useState(null);
  const [quotationRefreshKey, setQuotationRefreshKey] = useState(0);
  const [invoiceDoc, setInvoiceDoc] = useState(null);
  const [receiptDoc, setReceiptDoc] = useState(null);

  const handleLogin = (data) => setSession(data);
  const handleLogout = useCallback(() => { sb.auth.signOut(); setSession(null); }, []);

  const { profile, profileLoading } = useProfile(session, handleLogout);

  // Re-check is_active ทุก 60 วินาที เพื่อ logout ทันทีถ้า admin ปิดสถานะขณะ login อยู่
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      const uid = session?.user?.id || session?.id;
      if (!uid) return;
      const token = sb.auth.getSession()?.access_token;
      if (!token) return;
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${uid}&select=is_active`,
          { headers: sb.h(token) }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].is_active === false) {
          handleLogout();
        }
      } catch { /* ignore network errors */ }
    }, 60000); // ทุก 60 วินาที
    return () => clearInterval(interval);
  }, [session, handleLogout]);
  // Force re-render เมื่อ permissions เปลี่ยน (เช่น หลัง admin save สิทธิ์)
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return onPermissionsChange(() => forceUpdate(n => n + 1));
  }, []);

  if (!session) return <AuthPage onLogin={handleLogin} />;
  if (profileLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#6c757d" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div>กำลังโหลดข้อมูลผู้ใช้...</div>
      </div>
    </div>
  );

  const role = profile?.role || "viewer";
  const userName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email || "ผู้ใช้งาน";
  const userPosition = profile?.position || "";
  const userEmail = session?.user?.email || "";

  // ถ้า page ที่อยู่ไม่มีสิทธิ์ ให้ redirect กลับ home
  const safePage = canAccess(role, page) ? page : "home";

  const renderPage = () => {
    if (!canAccess(role, safePage)) return <DashboardHome userName={userName} />;
    const ro = !canWrite(role, safePage); // readOnly flag
    switch (safePage) {
      case "home": return <DashboardHome userName={userName} />;
      case "customers": return <CustomerPage readOnly={ro} />;
      case "products": return <ProductServicePage type="products" readOnly={ro} />;
      case "services": return <ProductServicePage type="services" readOnly={ro} />;
      case "quotations":
        return quotationDoc !== null
          ? <QuotationForm doc={quotationDoc} onBack={() => { setQuotationDoc(null); setQuotationRefreshKey(k => k + 1); }} userName={userName} userEmail={userEmail} userPosition={userPosition} />
          : <QuotationList onNew={ro ? null : () => setQuotationDoc({})} onEdit={(r) => setQuotationDoc(r)}
              refreshKey={quotationRefreshKey}
              onConvertToInvoice={canWrite(role,"invoices") ? (qt) => { setPage("invoices"); setInvoiceDoc({ _convertFromQT: qt }); } : null} />;
      case "invoices":
        return invoiceDoc !== null
          ? <InvoiceForm doc={invoiceDoc} onBack={() => setInvoiceDoc(null)} />
          : <InvoiceList onNew={ro ? null : () => setInvoiceDoc({})} onEdit={(r) => setInvoiceDoc(r)}
              onConvertToReceipt={canWrite(role,"receipts") ? (inv) => { setPage("receipts"); setReceiptDoc({ _convertFromINV: inv }); } : null} />;
      case "receipts":
        return receiptDoc !== null
          ? <ReceiptForm doc={receiptDoc} onBack={() => setReceiptDoc(null)} />
          : <ReceiptList onNew={ro ? null : () => setReceiptDoc({})} onEdit={(r) => setReceiptDoc(r)} />;
      case "docnumbers": return <DocNumberPage />;
      case "chatbot": return <ChatbotPage />;
      case "export": return <ExportImportPage />;
      case "settings": return <SettingsPage />;
      case "users": return <UserManagementPage currentProfile={profile} />;
      default: return <DashboardHome userName={userName} />;
    }
  };

  return (
    <div style={{ display: "flex", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "100vh" }}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <p style={S.sidebarLogoTitle}>📊 BizSystem</p>
          <p style={S.sidebarLogoSub}>ระบบบริหารธุรกิจ</p>
        </div>
        <div style={S.sidebarMenu}>
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} style={S.sidebarSection}>{item.section}</div>
            ) : (
              <div key={item.key} style={S.navItem(page === item.key)} onClick={() => { setPage(item.key); setQuotationDoc(null); setInvoiceDoc(null); setReceiptDoc(null); }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            )
          )}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "rgba(255,255,255,0.7)", cursor: "pointer", width: "100%" }}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#495057" }}>
            {NAV.find(n => n.key === page)?.icon} {NAV.find(n => n.key === page)?.label || "หน้าหลัก"}
          </div>
          <div style={{ fontSize: 12, color: "#adb5bd" }}>v1.0 · {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <div style={S.content}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
