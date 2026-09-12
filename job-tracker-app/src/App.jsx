import { useState, useEffect, useMemo } from "react";
import { Plus, X, ExternalLink, Bell, Search, Trash2, Pencil, LogOut } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const STATUSES = [
  { key: "wishlist", label: "Wishlist" },
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "closed", label: "Closed" },
];

const STATUS_STYLE = {
  wishlist: { bg: "#F3F4F6", text: "#4B5563", dot: "#9CA3AF" },
  applied: { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  screening: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  interview: { bg: "#FFEDD5", text: "#9A3412", dot: "#FB923C" },
  offer: { bg: "#DCFCE7", text: "#166534", dot: "#22C55E" },
  closed: { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
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

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function sendLink() {
    setError("");
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) setError(friendlyAuthError(error));
      else setSent(true);
    } catch (e) {
      setError(friendlyAuthError(e));
    }
  }

  function friendlyAuthError(error) {
    const msg = error?.message || String(error);
    if (/failed to fetch|networkerror|network request failed/i.test(msg)) {
      return isSupabaseConfigured
        ? "Can't reach Supabase. Check your network connection and that your Supabase project is running."
        : "Supabase isn't configured. Copy .env.example to .env, add your project URL and anon key, then restart the dev server.";
    }
    return msg;
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "Arial, sans-serif", textAlign: "center" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Job search tracker</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        Sign in with your email to sync your applications across devices.
      </p>
      {!isSupabaseConfigured && (
        <div style={{ fontSize: 12, color: "#92400E", background: "#FEF3C7", borderRadius: 8, padding: "8px 12px", marginBottom: 16, textAlign: "left" }}>
          Supabase isn't configured — sign-in won't work until you copy <code>.env.example</code> to{" "}
          <code>.env</code> and restart the dev server.
        </div>
      )}
      {sent ? (
        <p style={{ fontSize: 13, color: "#166534" }}>
          Check your inbox for a sign-in link.
        </p>
      ) : (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", borderRadius: 6, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}
          />
          {error && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>{error}</div>}
          <button
            onClick={sendLink}
            style={{ marginTop: 12, width: "100%", padding: "9px 10px", borderRadius: 6, border: "none", background: "#111827", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Send sign-in link
          </button>
        </>
      )}
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
  }, [session]);

  async function fetchJobs() {
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (!error) setJobs(data);
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
    <div style={{ fontFamily: "Arial, sans-serif", color: "#111827", maxWidth: 1400, width: "100%", margin: "0 auto", padding: 20, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Job search tracker</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6B7280" }}>
            {jobs.length} application{jobs.length !== 1 ? "s" : ""} · signed in as {session.user.email}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={openAdd}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={16} /> Add application
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {dueFollowUps.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FEF3C7", color: "#92400E", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          <Bell size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <strong>{dueFollowUps.length} follow-up{dueFollowUps.length !== 1 ? "s" : ""} due soon:</strong>{" "}
            {dueFollowUps.map((j) => j.company).join(", ")}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", flex: "1 1 200px" }}>
          <Search size={15} color="#9CA3AF" />
          <input placeholder="Search company or role" value={query} onChange={(e) => setQuery(e.target.value)} style={{ border: "none", outline: "none", fontSize: 13, width: "100%" }} />
        </div>
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>
          <option>All</option>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div style={{ display: "flex", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", marginLeft: "auto" }}>
          <button
            onClick={() => setView("board")}
            style={{
              border: "none", padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: view === "board" ? "#111827" : "#fff",
              color: view === "board" ? "#fff" : "#4B5563",
            }}
          >
            Board
          </button>
          <button
            onClick={() => setView("table")}
            style={{
              border: "none", padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: view === "table" ? "#111827" : "#fff",
              color: view === "table" ? "#fff" : "#4B5563",
            }}
          >
            Table
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 12 }}>
          <p style={{ margin: 0, fontSize: 14 }}>No applications yet. Add your first one to start tracking.</p>
        </div>
      ) : view === "board" ? (
        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(200px, 1fr))", gap: 12 }}>
          {STATUSES.map((s) => (
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
                background: dropTarget === s.key ? "#EFF6FF" : "#F9FAFB",
                border: dropTarget === s.key ? "2px dashed #3B82F6" : "2px dashed transparent",
                borderRadius: 12,
                padding: 8,
                minHeight: 120,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "0 4px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_STYLE[s.key].dot, display: "inline-block" }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{byStatus[s.key].length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 40 }}>
                {byStatus[s.key].map((job) => {
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
                      style={{
                        background: "#fff",
                        border: "1px solid #E5E7EB",
                        borderRadius: 10,
                        padding: 10,
                        cursor: "grab",
                        opacity: dragging ? 0.4 : 1,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{job.company}</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => openEdit(job)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF" }} aria-label="Edit"><Pencil size={13} /></button>
                          <button onClick={() => removeJob(job.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF" }} aria-label="Delete"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#4B5563", marginTop: 2 }}>{job.role}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: STATUS_STYLE[s.key].bg, color: STATUS_STYLE[s.key].text }}>{job.platform}</span>
                        {job.link && <a href={job.link} target="_blank" rel="noreferrer" style={{ color: "#6B7280" }} aria-label="Open link"><ExternalLink size={12} /></a>}
                      </div>
                      {due !== null && (
                        <div style={{ fontSize: 11, marginTop: 6, color: due <= 0 ? "#DC2626" : due <= 2 ? "#D97706" : "#9CA3AF" }}>
                          Follow up {due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? "today" : `in ${due}d`}
                        </div>
                      )}
                      <select value={job.status} onChange={(e) => moveStatus(job.id, e.target.value)} style={{ marginTop: 8, width: "100%", fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "1px solid #E5E7EB" }}>
                        {STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 960 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#F9FAFB" }}>
                {["Company", "Role", "Platform", "Status", "Applied", "Follow-up", "Contact", "Link", "Notes", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const due = daysUntil(job.follow_up);
                return (
                  <tr key={job.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{job.company}</td>
                    <td style={tdStyle}>{job.role}</td>
                    <td style={tdStyle}>{job.platform}</td>
                    <td style={tdStyle}>
                      <select value={job.status} onChange={(e) => moveStatus(job.id, e.target.value)} style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid #E5E7EB" }}>
                        {STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>{job.date_applied || "—"}</td>
                    <td style={{ ...tdStyle, color: due === null ? "#9CA3AF" : due <= 0 ? "#DC2626" : due <= 2 ? "#D97706" : "#4B5563" }}>
                      {job.follow_up
                        ? `${job.follow_up}${due !== null ? (due < 0 ? ` (${Math.abs(due)}d overdue)` : due === 0 ? " (today)" : ` (in ${due}d)`) : ""}`
                        : "—"}
                    </td>
                    <td style={tdStyle}>{job.contact || "—"}</td>
                    <td style={tdStyle}>
                      {job.link
                        ? <a href={job.link} target="_blank" rel="noreferrer" style={{ color: "#6B7280" }} aria-label="Open link"><ExternalLink size={14} /></a>
                        : "—"}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={job.notes || ""}>
                      {job.notes || "—"}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(job)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF" }} aria-label="Edit"><Pencil size={14} /></button>
                      <button onClick={() => removeJob(job.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", marginLeft: 4 }} aria-label="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "#9CA3AF", fontSize: 13 }}>
              No applications match your search.
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, width: 420, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{form.id ? "Edit application" : "Add application"}</h3>
              <button onClick={() => setModalOpen(false)} style={{ border: "none", background: "none", cursor: "pointer" }} aria-label="Close"><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Company *</label>
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Role *</label>
                <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Platform</label>
                  <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} style={inputStyle}>
                    {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Job link</label>
                <input value={form.link || ""} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Date applied</label>
                  <input type="date" value={form.date_applied || ""} onChange={(e) => setForm({ ...form, date_applied: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Follow-up date</label>
                  <input type="date" value={form.follow_up || ""} onChange={(e) => setForm({ ...form, follow_up: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Contact / referral</label>
                <input value={form.contact || ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Notes</label>
                <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              {saveError && <div style={{ fontSize: 12, color: "#DC2626" }}>{saveError}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 6, justifyContent: "flex-end" }}>
                <button onClick={() => setModalOpen(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={saveForm} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "7px 9px", borderRadius: 6, border: "1px solid #E5E7EB",
  fontSize: 13, marginTop: 3, boxSizing: "border-box", fontFamily: "Arial, sans-serif",
};

const thStyle = {
  padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#6B7280",
  textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 12px", fontSize: 13, color: "#111827", verticalAlign: "middle",
};
