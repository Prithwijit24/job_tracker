import { useState, useEffect, useMemo } from "react";
import {
  Plus, X, ExternalLink, Bell, Search, Trash2, Pencil, LogOut,
  LayoutGrid, Table2, Briefcase, Globe, GripVertical,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const FONT = "'Plus Jakarta Sans','Inter',system-ui,-apple-system,'Segoe UI',sans-serif";

const STATUSES = [
  { key: "wishlist", label: "Wishlist" },
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "closed", label: "Closed" },
];

const STATUS_STYLE = {
  wishlist: { bg: "#CFFAFE", text: "#0E7490", dot: "#06B6D4", accent: "#06B6D4", soft: "#ECFEFF" },
  applied: { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6", accent: "#3B82F6", soft: "#EFF6FF" },
  screening: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B", accent: "#F59E0B", soft: "#FFFBEB" },
  interview: { bg: "#F3E8FF", text: "#7E22CE", dot: "#A855F7", accent: "#A855F7", soft: "#FAF5FF" },
  offer: { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E", accent: "#22C55E", soft: "#F0FDF4" },
  closed: { bg: "#E2E8F0", text: "#475569", dot: "#334155", accent: "#334155", soft: "#F1F5F9" },
};

const PLATFORMS = ["Naukri", "LinkedIn", "Indeed", "Company site", "Referral", "Instahyre", "Cutshort", "Wellfound", "Other"];

const emptyForm = {
  id: null,
  company: "",
  role: "",
  platform: "Naukri",
  link: "",
  date_applied: new Date().toISOString().slice(0, 10),
  status: "applied",
  follow_up: "",
  contact: "",
  notes: "",
};

const GLOBAL_CSS = `
@keyframes jtFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes jtPop { from { opacity: 0; transform: scale(.96) translateY(10px); } to { opacity: 1; transform: none; } }
.jt-card { animation: jtFadeUp .35s ease both; transition: transform .15s ease, box-shadow .15s ease; }
.jt-card:hover { transform: translateY(-2px); box-shadow: 0 14px 26px -14px rgba(99,102,241,.45); }
.jt-btn-primary { background: #007AFF; transition: background .15s ease, transform .1s ease; }
.jt-btn-primary:hover { background: #0071E3; }
.jt-btn-primary:active { transform: scale(.98); }
.jt-icon-btn { transition: background .15s ease, color .15s ease; border-radius: 8px; padding: 4px; }
.jt-icon-btn:hover { background: #EEF2FF; color: #6D28D9 !important; }
.jt-input { transition: border-color .15s ease, box-shadow .15s ease; }
.jt-input:focus { outline: none; border-color: #A855F7 !important; box-shadow: 0 0 0 3px rgba(168,85,247,.18); }
.jt-table-row { transition: background .12s ease; }
.jt-table-row:hover { background: #F8FAFF !important; }
.jt-modal { animation: jtPop .22s ease both; }
.jt-gradient-text { background: linear-gradient(92deg,#6366F1,#A855F7 50%,#EC4899); -webkit-background-clip: text; background-clip: text; color: transparent; }
.jt-stat { animation: jtFadeUp .4s ease both; transition: transform .15s ease, box-shadow .15s ease; }
.jt-stat:hover { transform: translateY(-2px); box-shadow: 0 14px 26px -16px rgba(15,23,42,.25); }
.jt-sites-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 640px) { .jt-sites-grid { grid-template-columns: 1fr; } }
.jt-site-card { animation: jtFadeUp .35s ease both; transition: transform .15s ease, box-shadow .15s ease; cursor: pointer; }
.jt-site-card:hover { transform: translateY(-2px); box-shadow: 0 14px 26px -14px rgba(99,102,241,.45); }
`;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target - today) / 86400000);
}

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

// Whitelist columns from the jobs table and normalize empty strings to null
// (Postgres date columns reject "" with "invalid input syntax for type date").
function toPayload(form) {
  return {
    company: form.company.trim(),
    role: form.role.trim(),
    platform: form.platform,
    link: emptyToNull(form.link?.trim() || ""),
    date_applied: emptyToNull(form.date_applied),
    status: form.status,
    follow_up: emptyToNull(form.follow_up),
    contact: emptyToNull(form.contact),
    notes: emptyToNull(form.notes),
  };
}

function followUpColor(due) {
  if (due === null) return "#9CA3AF";
  if (due <= 0) return "#DC2626";
  if (due <= 2) return "#D97706";
  return "#64748B";
}

function followUpLabel(job) {
  const due = daysUntil(job.follow_up);
  if (due === null) return null;
  return due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? "today" : `in ${due}d`;
}

// ---- Job sites helpers (second tab) ----

// Normalize user input ("google.com", "www.naukri.com/jobs") to a full https URL.
function normalizeSiteUrl(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Extract the hostname for logo lookup + display.
function getSiteDomain(url) {
  try {
    return new URL(normalizeSiteUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Auto-fetch the site's logo via Google's favicon service (no API key needed).
function getSiteLogoUrl(url, size = 128) {
  const domain = getSiteDomain(url);
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Countdown that blocks resends while active
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendLink() {
    if (sending || cooldown > 0) return;
    setError("");
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      // Redirect back to wherever the app is actually running (localhost in
      // dev, the Vercel URL in production) instead of Supabase's default
      // Site URL. This URL must be allowlisted in Supabase Auth settings.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setError(friendlyAuthError(error));
        // Back off on rate limits instead of letting users hammer resend
        if (/rate limit|too many|over.*limit/i.test(error?.message || "")) setCooldown(60);
      } else {
        setSent(true);
        setCooldown(60);
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setSending(false);
    }
  }

  async function signInWithGoogle() {
    if (oauthLoading) return;
    setError("");
    setOauthLoading(true);
    try {
      // OAuth sends no emails, so email rate limits never apply.
      // Returns to wherever the app runs; must be allowlisted in Supabase.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          // Force the "choose an account" screen instead of auto-using
          // the browser's default Google account
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setError(friendlyAuthError(error));
        setOauthLoading(false);
      }
      // On success the browser redirects to Google — no further action here.
    } catch (e) {
      setError(friendlyAuthError(e));
      setOauthLoading(false);
    }
  }

  function friendlyAuthError(error) {
    const msg = error?.message || String(error);
    if (/provider is not enabled|unsupported provider/i.test(msg)) {
      return "Google sign-in isn't enabled yet. Follow the setup steps in the README, or use email instead.";
    }
    if (/rate limit|too many requests|over email send limit/i.test(msg)) {
      return "Too many sign-in attempts — Supabase is temporarily rate-limiting this email. Wait a few minutes, then try again.";
    }
    if (/failed to fetch|networkerror|network request failed/i.test(msg)) {
      return isSupabaseConfigured
        ? "Can't reach Supabase. Check your network connection and that your Supabase project is running."
        : "Supabase isn't configured. Copy .env.example to .env, add your project URL and anon key, then restart the dev server.";
    }
    return msg;
  }

  return (
    <div style={{ maxWidth: 400, margin: "90px auto", fontFamily: FONT, padding: "0 16px" }}>
      <div style={{ background: "rgba(255,255,255,.9)", backdropFilter: "blur(12px)", borderRadius: 24, padding: 36, textAlign: "center", boxShadow: "0 24px 60px -24px rgba(99,102,241,.4)", border: "1px solid rgba(255,255,255,.8)" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, margin: "0 auto 16px", background: "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 24px -8px rgba(30,58,138,.55)" }}>
          <Briefcase size={28} color="#fff" />
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", color: "#1E3A8A" }}>Job search tracker</h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 22px" }}>
          Sign in with your email to sync your applications across devices.
        </p>
        {!isSupabaseConfigured && (
          <div style={{ fontSize: 12, color: "#92400E", background: "linear-gradient(90deg,#FFFBEB,#FEF3C7)", border: "1px solid #FCD34D", borderRadius: 10, padding: "8px 12px", marginBottom: 16, textAlign: "left" }}>
            Supabase isn't configured — sign-in won't work until you copy <code>.env.example</code> to{" "}
            <code>.env</code> and restart the dev server.
          </div>
        )}
        {sent ? (
          <p style={{ fontSize: 14, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px" }}>
            Check your inbox for a sign-in link.
          </p>
        ) : (
          <>
            <button
              onClick={signInWithGoogle}
              disabled={oauthLoading}
              style={{ width: "100%", padding: "11px 10px", borderRadius: 12, border: "1.5px solid #E2E8F0", background: "#fff", color: "#0F172A", fontSize: 14, fontWeight: 700, cursor: oauthLoading ? "not-allowed" : "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: oauthLoading ? 0.6 : 1 }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z" />
                <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
              </svg>
              {oauthLoading ? "Redirecting…" : "Continue with Google"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "#94A3B8", fontSize: 12, fontWeight: 700 }}>
              <span style={{ flex: 1, height: 1, background: "#E2E8F0" }} /> OR <span style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
            </div>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              className="jt-input"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E2E8F0", fontSize: 14, boxSizing: "border-box", fontFamily: FONT }}
            />
            {error && <div style={{ fontSize: 12, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px", marginTop: 10 }}>{error}</div>}
            <button
              onClick={sendLink}
              disabled={sending || cooldown > 0}
              className="jt-btn-primary"
              style={{ marginTop: 14, width: "100%", padding: "12px 10px", borderRadius: 12, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: sending || cooldown > 0 ? "not-allowed" : "pointer", fontFamily: FONT, opacity: sending || cooldown > 0 ? 0.6 : 1 }}
            >
              {sending ? "Sending…" : cooldown > 0 ? `Retry in ${cooldown}s` : "Send sign-in link"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [saveError, setSaveError] = useState("");
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [view, setView] = useState("board");
  const [activeTab, setActiveTab] = useState("tracker");
  const [sites, setSites] = useState([]);
  const [siteForm, setSiteForm] = useState({ id: null, name: "", url: "" });
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteSaveError, setSiteSaveError] = useState("");
  const [brokenLogos, setBrokenLogos] = useState({});
  const [dragSiteId, setDragSiteId] = useState(null);
  const [siteDropTarget, setSiteDropTarget] = useState(null);
  const [lastSiteDragEnd, setLastSiteDragEnd] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchJobs();
    fetchSites();
  }, [session]);

  async function fetchJobs() {
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (!error) setJobs(data);
  }

  async function fetchSites() {
    // Prefer position order (drag-reorder); fall back gracefully if the
    // column doesn't exist yet (user hasn't run the migration).
    let { data, error } = await supabase
      .from("job_sites")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      if (/relation .* does not exist|could not find the table/i.test(error.message || "")) {
        return;
      }
      if (/column .*position.* does not exist|position/i.test(error.message || "")) {
        const retry = await supabase.from("job_sites").select("*").order("created_at", { ascending: false });
        if (!retry.error) setSites(retry.data || []);
        return;
      }
      console.error("Failed to fetch job sites:", error.message);
      return;
    }
    setSites(data || []);
  }

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      const matchesQuery =
        !query ||
        (j.company || "").toLowerCase().includes(query.toLowerCase()) ||
        (j.role || "").toLowerCase().includes(query.toLowerCase());
      const matchesPlatform = platformFilter === "All" || j.platform === platformFilter;
      return matchesQuery && matchesPlatform;
    });
  }, [jobs, query, platformFilter]);

  const byStatus = useMemo(() => {
    const map = {};
    STATUSES.forEach((s) => (map[s.key] = []));
    filtered.forEach((j) => {
      if (map[j.status]) map[j.status].push(j);
    });
    return map;
  }, [filtered]);

  const dueFollowUps = useMemo(() => {
    return jobs.filter((j) => {
      const d = daysUntil(j.follow_up);
      return d !== null && d <= 2 && j.status !== "closed" && j.status !== "offer";
    });
  }, [jobs]);

  const stats = useMemo(() => {
    const count = (key) => jobs.filter((j) => j.status === key).length;
    return [
      { label: "Total", value: jobs.length, color: "#6366F1", bg: "#EEF2FF" },
      { label: "In pipeline", value: jobs.filter((j) => j.status !== "closed").length, color: "#3B82F6", bg: "#EFF6FF" },
      { label: "Interviews", value: count("interview"), color: "#A855F7", bg: "#FAF5FF" },
      { label: "Offers", value: count("offer"), color: "#22C55E", bg: "#F0FDF4" },
      { label: "Follow-ups due", value: dueFollowUps.length, color: "#F59E0B", bg: "#FFFBEB" },
    ];
  }, [jobs, dueFollowUps]);

  function openAdd() {
    setForm({ ...emptyForm });
    setSaveError("");
    setModalOpen(true);
  }

  function openEdit(job) {
    setForm({ ...job });
    setSaveError("");
    setModalOpen(true);
  }

  async function saveForm() {
    if (!form.company.trim() || !form.role.trim()) {
      setSaveError("Company and role are required.");
      return;
    }
    if (!session?.user?.id && !form.id) {
      setSaveError("You are not signed in.");
      return;
    }
    const payload = toPayload(form);
    let error;
    if (form.id) {
      ({ error } = await supabase.from("jobs").update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase
        .from("jobs")
        .insert([{ ...payload, user_id: session.user.id }]));
    }
    if (error) {
      setSaveError(error.message);
      return;
    }
    setModalOpen(false);
    fetchJobs();
  }

  async function removeJob(id) {
    await supabase.from("jobs").delete().eq("id", id);
    fetchJobs();
  }

  function openAddSite() {
    setSiteForm({ id: null, name: "", url: "" });
    setSiteSaveError("");
    setSiteModalOpen(true);
  }

  function openEditSite(site) {
    setSiteForm({ id: site.id, name: site.name, url: site.url });
    setSiteSaveError("");
    setSiteModalOpen(true);
  }

  async function saveSite() {
    const name = (siteForm.name || "").trim();
    const url = normalizeSiteUrl(siteForm.url);
    if (!name || !getSiteDomain(url)) {
      setSiteSaveError("Enter a name and a valid website (e.g. naukri.com).");
      return;
    }
    if (!session?.user?.id && !siteForm.id) {
      setSiteSaveError("You are not signed in.");
      return;
    }
    const payload = { name, url };
    let error;
    if (siteForm.id) {
      ({ error } = await supabase.from("job_sites").update(payload).eq("id", siteForm.id));
    } else {
      // Append new sites at the end of the custom order.
      const withPosition = { ...payload, user_id: session.user.id, position: sites.length };
      ({ error } = await supabase.from("job_sites").insert([withPosition]));
      if (error && /column .*position/i.test(error.message || "")) {
        // Column not migrated yet — retry without position.
        ({ error } = await supabase
          .from("job_sites")
          .insert([{ ...payload, user_id: session.user.id }]));
      }
    }
    if (error) {
      setSiteSaveError(
        /relation .* does not exist|could not find the table/i.test(error.message || "")
          ? "The job_sites table doesn't exist yet. Run the updated supabase_schema.sql in Supabase SQL Editor, then try again."
          : error.message
      );
      return;
    }
    setSiteModalOpen(false);
    fetchSites();
  }

  async function removeSite(id) {
    await supabase.from("job_sites").delete().eq("id", id);
    fetchSites();
  }

  function openSiteInNewTab(site) {
    // Opens in a new tab so the site's own login cookies persist —
    // once you log in there, the browser keeps you logged in.
    const url = normalizeSiteUrl(site.url);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function reorderSites(draggedId, targetId) {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const fromIdx = sites.findIndex((s) => s.id === draggedId);
    const toIdx = sites.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...sites];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setSites(next);
    persistSiteOrder(next);
  }

  async function persistSiteOrder(ordered) {
    // Persist the new order; ignore position-column errors for unmigrated DBs
    // (order still works locally until the user runs the new SQL).
    try {
      await Promise.all(
        ordered.map((site, idx) =>
          supabase.from("job_sites").update({ position: idx }).eq("id", site.id)
        )
      );
    } catch (e) {
      console.error("Failed to persist site order:", e?.message || e);
    }
  }

  function handleSiteDrop(e, targetId) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || dragSiteId;
    setDragSiteId(null);
    setSiteDropTarget(null);
    if (id) reorderSites(id, targetId);
  }

  async function moveStatus(id, status) {
    const job = jobs.find((j) => j.id === id);
    if (!job || job.status === status) return;
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
    if (error) fetchJobs(); // revert to server state on failure
  }

  function handleDrop(e, status) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setDropTarget(null);
    if (id) moveStatus(id, status);
  }

  if (checkingSession) return null;
  if (!session) return <LoginScreen />;

  return (
    <div style={{ fontFamily: FONT, color: "#0F172A", minHeight: "100vh", background: "radial-gradient(1000px 420px at 8% -5%, #DDD6FE 0%, transparent 60%), radial-gradient(900px 400px at 92% 0%, #FBCFE8 0%, transparent 55%), radial-gradient(900px 520px at 50% 110%, #BFDBFE 0%, transparent 60%), #F8FAFF" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ maxWidth: 1400, width: "100%", margin: "0 auto", padding: 20, boxSizing: "border-box" }}>

        {/* Header */}
        <div style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(12px)", borderRadius: 20, padding: "18px 22px", marginBottom: 16, boxShadow: "0 16px 40px -24px rgba(99,102,241,.35)", border: "1px solid rgba(255,255,255,.9)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 15, background: "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 22px -8px rgba(30,58,138,.55)", flexShrink: 0 }}>
              <Briefcase size={24} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.3, color: "#1E3A8A" }}>Job search tracker</h2>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
                {jobs.length} application{jobs.length !== 1 ? "s" : ""} · signed in as {session.user.email}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={activeTab === "tracker" ? openAdd : openAddSite}
              className="jt-btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 7, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, boxShadow: "0 10px 20px -8px rgba(0,122,255,.55)" }}
            >
              <Plus size={16} /> {activeTab === "tracker" ? "Add application" : "Add job site"}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#475569", fontFamily: FONT }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        {/* Tabs: Applications / Job sites */}
        <div style={{ display: "flex", background: "rgba(255,255,255,.85)", backdropFilter: "blur(12px)", borderRadius: 16, padding: 4, marginBottom: 16, border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 10px 24px -20px rgba(15,23,42,.3)", gap: 4 }}>
          <button
            onClick={() => setActiveTab("tracker")}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, border: "none", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
              background: activeTab === "tracker" ? "#007AFF" : "transparent",
              color: activeTab === "tracker" ? "#fff" : "#64748B",
              boxShadow: activeTab === "tracker" ? "0 6px 14px -6px rgba(0,122,255,.6)" : "none",
            }}
          >
            <Briefcase size={14} /> Applications
          </button>
          <button
            onClick={() => setActiveTab("sites")}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, border: "none", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
              background: activeTab === "sites" ? "#007AFF" : "transparent",
              color: activeTab === "sites" ? "#fff" : "#64748B",
              boxShadow: activeTab === "sites" ? "0 6px 14px -6px rgba(0,122,255,.6)" : "none",
            }}
          >
            <Globe size={14} /> Job sites
          </button>
        </div>

        {activeTab === "sites" ? (
          <div>
            <div style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(12px)", borderRadius: 14, padding: "12px 16px", marginBottom: 12, border: "1px solid rgba(255,255,255,.9)", fontSize: 13, color: "#64748B" }}>
              {sites.length} saved site{sites.length !== 1 ? "s" : ""} · click a tile to open it in a new tab, drag to reorder. Log in once on each site and your browser keeps you logged in.
            </div>
            {sites.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 16px", color: "#94A3B8", border: "2px dashed #C4B5FD", borderRadius: 20, background: "rgba(255,255,255,.6)" }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, margin: "0 auto 14px", background: "linear-gradient(135deg,#EEF2FF,#FAF5FF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Globe size={26} color="#A855F7" />
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600, color: "#64748B" }}>No job sites yet. Save Naukri, LinkedIn, etc. for one-click access.</p>
                <button onClick={openAddSite} className="jt-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  <Plus size={16} /> Add your first job site
                </button>
              </div>
            ) : (
              <div className="jt-sites-grid">
                {sites.map((site, idx) => {
                  const logo = getSiteLogoUrl(site.url);
                  const logoKey = `${site.id}:${logo}`;
                  const logoBroken = brokenLogos[logoKey];
                  const dragging = dragSiteId === site.id;
                  const isDropTarget = siteDropTarget === site.id;
                  return (
                    <div
                      key={site.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", site.id);
                        setDragSiteId(site.id);
                      }}
                      onDragEnd={() => {
                        setDragSiteId(null);
                        setSiteDropTarget(null);
                        setLastSiteDragEnd(Date.now());
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        setSiteDropTarget(site.id);
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget)) return;
                        setSiteDropTarget((t) => (t === site.id ? null : t));
                      }}
                      onDrop={(e) => handleSiteDrop(e, site.id)}
                      onClick={() => {
                        // Suppress the click that fires right after a drag.
                        if (Date.now() - lastSiteDragEnd < 200) return;
                        openSiteInNewTab(site);
                      }}
                      className="jt-site-card"
                      title={`${site.name} — ${site.url} (drag to reorder)`}
                      style={{ animationDelay: `${Math.min(idx, 8) * 45}ms`, background: isDropTarget ? "#EEF2FF" : "#fff", border: isDropTarget ? "2px dashed #6366F1" : "1px solid #F1F5F9", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12, boxShadow: isDropTarget ? "0 0 0 4px #E0E7FF" : "0 4px 12px -6px rgba(15,23,42,.15)", opacity: dragging ? 0.4 : 1, cursor: "grab" }}
                    >
                      <div style={{ color: "#CBD5E1", flexShrink: 0, cursor: "grab", display: "flex" }} title="Drag to reorder">
                        <GripVertical size={16} />
                      </div>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: "#F8FAFF", border: "1px solid #EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {logo && !logoBroken ? (
                          <img
                            src={logo}
                            alt={`${site.name} logo`}
                            width={32}
                            height={32}
                            loading="lazy"
                            draggable={false}
                            onError={() => setBrokenLogos((prev) => ({ ...prev, [logoKey]: true }))}
                            style={{ objectFit: "contain", pointerEvents: "none" }}
                          />
                        ) : (
                          <span style={{ fontSize: 22, fontWeight: 800, color: "#6366F1" }}>
                            {(site.name || "?").trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site.name}</div>
                        <div style={{ fontSize: 12, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getSiteDomain(site.url)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEditSite(site)} className="jt-icon-btn" style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8" }} aria-label="Edit site"><Pencil size={14} /></button>
                        <button onClick={() => removeSite(site.id)} className="jt-icon-btn" style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8" }} aria-label="Delete site"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
          {stats.map((s, i) => (
            <div key={s.label} className="jt-stat" style={{ animationDelay: `${i * 60}ms`, background: "rgba(255,255,255,.85)", backdropFilter: "blur(8px)", borderRadius: 16, padding: "12px 16px", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 10px 24px -18px rgba(15,23,42,.3)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, boxShadow: `0 0 0 4px ${s.bg}`, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {dueFollowUps.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "linear-gradient(90deg,#FFFBEB,#FEF3C7)", border: "1px solid #FCD34D", color: "#92400E", borderRadius: 14, padding: "12px 16px", marginBottom: 16, fontSize: 13, boxShadow: "0 10px 24px -18px rgba(245,158,11,.5)" }}>
            <Bell size={17} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <strong>{dueFollowUps.length} follow-up{dueFollowUps.length !== 1 ? "s" : ""} due soon:</strong>{" "}
              {dueFollowUps.map((j) => j.company).join(", ")}
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(12px)", borderRadius: 16, padding: 12, marginBottom: 16, border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 10px 24px -20px rgba(15,23,42,.3)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "8px 12px", flex: "1 1 220px", background: "#fff" }}>
            <Search size={16} color="#A855F7" />
            <input placeholder="Search company or role" value={query} onChange={(e) => setQuery(e.target.value)} className="jt-input" style={{ border: "none", outline: "none", fontSize: 13, width: "100%", fontFamily: FONT, background: "transparent" }} />
          </div>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="jt-input" style={{ border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "8px 12px", fontSize: 13, fontFamily: FONT, background: "#fff", fontWeight: 600, color: "#475569" }}>
            <option>All</option>
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 12, padding: 3, marginLeft: "auto" }}>
            <button
              onClick={() => setView("board")}
              style={{
                display: "flex", alignItems: "center", gap: 6, border: "none", padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                background: view === "board" ? "#007AFF" : "transparent",
                color: view === "board" ? "#fff" : "#64748B",
                boxShadow: view === "board" ? "0 6px 14px -6px rgba(0,122,255,.6)" : "none",
              }}
            >
              <LayoutGrid size={14} /> Board
            </button>
            <button
              onClick={() => setView("table")}
              style={{
                display: "flex", alignItems: "center", gap: 6, border: "none", padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                background: view === "table" ? "#007AFF" : "transparent",
                color: view === "table" ? "#fff" : "#64748B",
                boxShadow: view === "table" ? "0 6px 14px -6px rgba(0,122,255,.6)" : "none",
              }}
            >
              <Table2 size={14} /> Table
            </button>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 16px", color: "#94A3B8", border: "2px dashed #C4B5FD", borderRadius: 20, background: "rgba(255,255,255,.6)" }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, margin: "0 auto 14px", background: "linear-gradient(135deg,#EEF2FF,#FAF5FF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Briefcase size={26} color="#A855F7" />
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#64748B" }}>No applications yet. Add your first one to start tracking.</p>
          </div>
        ) : view === "board" ? (
          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(200px, 1fr))", gap: 12 }}>
              {STATUSES.map((s) => {
                const st = STATUS_STYLE[s.key];
                const isTarget = dropTarget === s.key;
                return (
                  <div
                    key={s.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDropTarget(s.key);
                    }}
                    onDragLeave={(e) => {
                      // Ignore leave events when moving between children of the same column
                      if (e.currentTarget.contains(e.relatedTarget)) return;
                      setDropTarget((t) => (t === s.key ? null : t));
                    }}
                    onDrop={(e) => handleDrop(e, s.key)}
                    style={{
                      background: isTarget ? "#fff" : st.soft,
                      border: isTarget ? `2px dashed ${st.accent}` : `1px solid ${st.bg}`,
                      borderRadius: 16,
                      padding: 10,
                      minHeight: 140,
                      transition: "background .15s ease, border .15s ease",
                      boxShadow: isTarget ? `0 0 0 4px ${st.bg}` : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, padding: "2px 4px" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: st.dot, boxShadow: `0 0 0 3px ${st.bg}`, display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{s.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: st.text, background: "#fff", border: `1px solid ${st.bg}`, borderRadius: 999, padding: "1px 8px", marginLeft: "auto" }}>{byStatus[s.key].length}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 40 }}>
                      {byStatus[s.key].map((job, idx) => {
                        const due = daysUntil(job.follow_up);
                        const dragging = dragId === job.id;
                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", job.id);
                              setDragId(job.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDropTarget(null);
                            }}
                            className="jt-card"
                            style={{
                              animationDelay: `${Math.min(idx, 8) * 45}ms`,
                              background: "#fff",
                              border: "1px solid #F1F5F9",
                              borderLeft: `4px solid ${st.accent}`,
                              borderRadius: 14,
                              padding: 12,
                              cursor: "grab",
                              opacity: dragging ? 0.4 : 1,
                              boxShadow: "0 4px 12px -6px rgba(15,23,42,.15)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 6 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>{job.company}</div>
                              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                                <button onClick={() => openEdit(job)} className="jt-icon-btn" style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3AF" }} aria-label="Edit"><Pencil size={13} /></button>
                                <button onClick={() => removeJob(job.id)} className="jt-icon-btn" style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8" }} aria-label="Delete"><Trash2 size={13} /></button>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, fontWeight: 500 }}>{job.role}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: st.bg, color: st.text }}>{job.platform}</span>
                              {job.link && <a href={job.link} target="_blank" rel="noreferrer" style={{ color: "#94A3B8" }} aria-label="Open link"><ExternalLink size={13} /></a>}
                            </div>
                            {due !== null && (
                              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 7, color: followUpColor(due) }}>
                                Follow up {followUpLabel(job)}
                              </div>
                            )}
                            <select value={job.status} onChange={(e) => moveStatus(job.id, e.target.value)} className="jt-input" style={{ marginTop: 9, width: "100%", fontSize: 11, fontWeight: 600, padding: "5px 7px", borderRadius: 8, border: "1.5px solid #F1F5F9", background: st.soft, color: st.text, fontFamily: FONT }}>
                              {STATUSES.map((stt) => <option key={stt.key} value={stt.key}>{stt.label}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 18, background: "#fff", boxShadow: "0 16px 40px -28px rgba(15,23,42,.3)", border: "1px solid #F1F5F9" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 960 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "linear-gradient(90deg,#EEF2FF,#FAF5FF,#FDF2F8)" }}>
                  {["Company", "Role", "Platform", "Status", "Applied", "Follow-up", "Contact", "Link", "Notes", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const due = daysUntil(job.follow_up);
                  const st = STATUS_STYLE[job.status] || STATUS_STYLE.wishlist;
                  return (
                    <tr key={job.id} className="jt-table-row" style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ ...tdStyle, fontWeight: 800 }}>{job.company}</td>
                      <td style={{ ...tdStyle, color: "#475569" }}>{job.role}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#F1F5F9", color: "#475569", whiteSpace: "nowrap" }}>{job.platform}</span>
                      </td>
                      <td style={tdStyle}>
                        <select value={job.status} onChange={(e) => moveStatus(job.id, e.target.value)} className="jt-input" style={{ fontSize: 12, fontWeight: 700, padding: "5px 8px", borderRadius: 8, border: `1.5px solid ${st.bg}`, background: st.soft, color: st.text, fontFamily: FONT }}>
                          {STATUSES.map((stt) => <option key={stt.key} value={stt.key}>{stt.label}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>{job.date_applied || "—"}</td>
                      <td style={{ ...tdStyle, color: followUpColor(due), fontWeight: due !== null && due <= 2 ? 700 : 400, whiteSpace: "nowrap" }}>
                        {job.follow_up ? `${job.follow_up}${due !== null ? ` (${followUpLabel(job)})` : ""}` : "—"}
                      </td>
                      <td style={tdStyle}>{job.contact || "—"}</td>
                      <td style={tdStyle}>
                        {job.link
                          ? <a href={job.link} target="_blank" rel="noreferrer" style={{ color: "#A855F7" }} aria-label="Open link"><ExternalLink size={14} /></a>
                          : "—"}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#64748B" }} title={job.notes || ""}>
                        {job.notes || "—"}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <button onClick={() => openEdit(job)} className="jt-icon-btn" style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8" }} aria-label="Edit"><Pencil size={14} /></button>
                        <button onClick={() => removeJob(job.id)} className="jt-icon-btn" style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8", marginLeft: 4 }} aria-label="Delete"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 16px", color: "#94A3B8", fontSize: 13, fontWeight: 600 }}>
                No applications match your search.
              </div>
            )}
          </div>
        )}
        </>
        )}

        {modalOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(30,27,75,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <div className="jt-modal" style={{ background: "#fff", borderRadius: 20, padding: 24, width: 440, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px -24px rgba(76,29,149,.5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 className="jt-gradient-text" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{form.id ? "Edit application" : "Add application"}</h3>
                <button onClick={() => setModalOpen(false)} className="jt-icon-btn" style={{ border: "none", background: "#F1F5F9", cursor: "pointer", color: "#64748B", borderRadius: 10, padding: 6 }} aria-label="Close"><X size={16} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Company *</label>
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="jt-input" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Role *</label>
                  <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="jt-input" style={inputStyle} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Platform</label>
                    <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="jt-input" style={inputStyle}>
                      {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="jt-input" style={inputStyle}>
                      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Job link</label>
                  <input value={form.link || ""} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" className="jt-input" style={inputStyle} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Date applied</label>
                    <input type="date" value={form.date_applied || ""} onChange={(e) => setForm({ ...form, date_applied: e.target.value })} className="jt-input" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Follow-up date</label>
                    <input type="date" value={form.follow_up || ""} onChange={(e) => setForm({ ...form, follow_up: e.target.value })} className="jt-input" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Contact / referral</label>
                  <input value={form.contact || ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="jt-input" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="jt-input" style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                {saveError && <div style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px" }}>{saveError}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => setModalOpen(false)} style={{ padding: "10px 18px", borderRadius: 12, border: "1.5px solid #E2E8F0", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#475569", fontFamily: FONT }}>Cancel</button>
                  <button onClick={saveForm} className="jt-btn-primary" style={{ padding: "10px 22px", borderRadius: 12, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {siteModalOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(30,27,75,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <div className="jt-modal" style={{ background: "#fff", borderRadius: 20, padding: 24, width: 400, maxWidth: "100%", boxShadow: "0 32px 80px -24px rgba(76,29,149,.5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 className="jt-gradient-text" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{siteForm.id ? "Edit job site" : "Add job site"}</h3>
                <button onClick={() => setSiteModalOpen(false)} className="jt-icon-btn" style={{ border: "none", background: "#F1F5F9", cursor: "pointer", color: "#64748B", borderRadius: 10, padding: 6 }} aria-label="Close"><X size={16} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="e.g. Naukri" className="jt-input" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Website *</label>
                  <input value={siteForm.url} onChange={(e) => setSiteForm({ ...siteForm, url: e.target.value })} placeholder="e.g. naukri.com" className="jt-input" style={inputStyle} />
                </div>
                {getSiteDomain(siteForm.url) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFF", border: "1px solid #EEF2FF", borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", border: "1px solid #EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      <img src={getSiteLogoUrl(siteForm.url, 64)} alt="Site logo preview" width={24} height={24} loading="lazy" style={{ objectFit: "contain" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>
                      Logo auto-fetched for <strong style={{ color: "#0F172A" }}>{getSiteDomain(siteForm.url)}</strong>
                    </div>
                  </div>
                )}
                {siteSaveError && <div style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px" }}>{siteSaveError}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => setSiteModalOpen(false)} style={{ padding: "10px 18px", borderRadius: 12, border: "1.5px solid #E2E8F0", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#475569", fontFamily: FONT }}>Cancel</button>
                  <button onClick={saveSite} className="jt-btn-primary" style={{ padding: "10px 22px", borderRadius: 12, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#A78BFA", fontWeight: 600 }}>
          Built with React + Supabase
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 700, color: "#475569" };

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E2E8F0",
  fontSize: 13, marginTop: 4, boxSizing: "border-box", fontFamily: FONT, background: "#fff", color: "#0F172A",
};

const thStyle = {
  padding: "12px 14px", fontSize: 11, fontWeight: 800, color: "#7C3AED",
  textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "11px 14px", fontSize: 13, color: "#0F172A", verticalAlign: "middle",
};
