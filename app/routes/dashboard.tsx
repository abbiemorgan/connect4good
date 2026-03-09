import { useState, useCallback, useMemo, useEffect } from "react";
import { Link } from "react-router";
import { collection, addDoc, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Route } from "./+types/dashboard";

// ============================================================
// TYPES
// ============================================================

type Role = "charity" | "company";
type Page =
  | "dashboard"
  | "new_project"
  | "register"
  | "browse"
  | "review";
type ProjectStatusValue =
  | "planning"
  | "ready_to_start"
  | "in_progress"
  | "on_hold"
  | "next_iteration";
type ProjectLifecycle = "open" | "matched";
type VolunteeringType =
  | "in_person"
  | "remote"
  | "hybrid"
  | "event_based"
  | "skills_based"
  | "mentoring";

interface SkillOverlap {
  matched: string[];
  count: number;
  total: number;
}

interface Project {
  id: string;
  charityId: string;
  title: string;
  description: string;
  status: ProjectStatusValue;
  essentialSkills: string[];
  startDate: string;
  endDate: string;
  peopleNeeded: number;
  volunteeringType: VolunteeringType | "";
  additionalInfo: string;
  projectStatus: ProjectLifecycle;
}

interface ProjectWithOverlap extends Project {
  overlap: SkillOverlap;
}

interface Company {
  id: string;
  name: string;
  bio: string;
  offeredSkills: string[];
  status: "available" | "engaged" | "inactive";
  preferredProjectIds: string[];
}

interface ResponseFormData {
  meetingDate: string;
  meetingTime: string;
  meetingNote: string;
  peopleAvailable: number;
  availableFrom: string;
  availableUntil: string;
  description: string;
}

interface CompanyResponse extends ResponseFormData {
  companyId: string;
  projectId: string;
  submittedAt: string;
}

interface RankedResponse extends CompanyResponse {
  companyName: string;
  companyBio: string;
  overlap: SkillOverlap;
}

interface Notification {
  companyId: string;
  projectTitle: string;
}

interface ProjectFormState {
  title: string;
  description: string;
  status: ProjectStatusValue;
  essentialSkills: string[];
  startDate: string;
  endDate: string;
  peopleNeeded: number;
  volunteeringType: VolunteeringType | "";
  additionalInfo: string;
}

interface CompanyFormState {
  name: string;
  bio: string;
  offeredSkills: string[];
}

interface RespondingTo {
  projectId: string;
  companyId: string;
}

// ============================================================
// MATCHING ENGINE
// ============================================================

function getSkillOverlap(
  projectSkills: string[],
  companySkills: string[],
): SkillOverlap {
  const proj = new Set(projectSkills.map((s) => s.toLowerCase()));
  const comp = new Set(companySkills.map((s) => s.toLowerCase()));
  const matched = [...proj].filter((s) => comp.has(s));
  return { matched, count: matched.length, total: proj.size };
}

function getMatchedProjects(
  projects: Project[],
  company: Company,
): ProjectWithOverlap[] {
  return projects
    .filter((p) => p.projectStatus === "open")
    .map((p) => ({ ...p, overlap: getSkillOverlap(p.essentialSkills, company.offeredSkills) }))
    .filter((p) => p.overlap.count > 0)
    .sort((a, b) => b.overlap.count - a.overlap.count);
}

function rankResponses(
  project: Project,
  responses: CompanyResponse[],
  companies: Company[],
): RankedResponse[] {
  return responses
    .filter((r) => r.projectId === project.id)
    .map((r) => {
      const comp = companies.find((c) => c.id === r.companyId);
      return {
        ...r,
        companyName: comp?.name ?? "Unknown",
        companyBio: comp?.bio ?? "",
        overlap: getSkillOverlap(project.essentialSkills, comp?.offeredSkills ?? []),
      };
    })
    .sort((a, b) => b.overlap.count - a.overlap.count);
}

// ============================================================
// CONSTANTS
// ============================================================

const SKILLS: string[] = [
  "Web Development", "Mobile Development", "UI/UX Design", "Data Analysis",
  "Database Management", "Project Management", "Graphic Design", "Copywriting",
  "SEO", "Marketing", "Legal Advice", "Accounting", "Fundraising",
  "Event Planning", "Photography", "Video Production", "Social Media",
  "DevOps", "Cybersecurity", "Training & Mentoring",
  "Interview Prep", "Presentations", "Upskill",
];

const STATUSES: { v: ProjectStatusValue; l: string; tw: string; dot: string }[] = [
  { v: "planning",       l: "Planning",        tw: "bg-purple-50 text-purple-700 border-purple-300", dot: "bg-purple-500" },
  { v: "ready_to_start", l: "Ready to Start",  tw: "bg-blue-50 text-blue-700 border-blue-300",       dot: "bg-blue-500"   },
  { v: "in_progress",    l: "In Progress",     tw: "bg-yellow-50 text-yellow-700 border-yellow-300", dot: "bg-yellow-500" },
  { v: "on_hold",        l: "On Hold",         tw: "bg-orange-50 text-orange-700 border-orange-300", dot: "bg-orange-500" },
  { v: "next_iteration", l: "Next Iteration",  tw: "bg-cyan-50 text-cyan-700 border-cyan-300",       dot: "bg-cyan-500"   },
];

const VOL_TYPES: { v: VolunteeringType; l: string; d: string }[] = [
  { v: "in_person",   l: "In-Person",    d: "On-site at charity location" },
  { v: "remote",      l: "Remote",       d: "Work from anywhere online" },
  { v: "hybrid",      l: "Hybrid",       d: "Mix of in-person and remote" },
  { v: "event_based", l: "Event-Based",  d: "Specific events or one-off days" },
  { v: "skills_based",l: "Skills-Based", d: "Pro-bono professional services" },
  { v: "mentoring",   l: "Mentoring",    d: "Ongoing mentorship or coaching" },
];

const CHAR_LIMIT = 500;
const MIN_SKILLS = 3;
let _uid = 0;
const uid = (p: string) => `${p}_${++_uid}_${Date.now()}`;
const toKey = (s: string) =>
  s.toLowerCase().replace(/ /g, "_").replace(/\//g, "_");
const toLabel = (k: string) => k.replace(/_/g, " ");

// ============================================================
// SHARED COMPONENTS
// ============================================================

function SkillPicker({
  selected, onChange, label, sub, minRequired,
}: {
  selected: string[];
  onChange: (s: string[]) => void;
  label: string;
  sub?: string;
  minRequired?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 tracking-wide mb-1">
        {label}
      </label>
      {sub && <p className="text-xs text-gray-400 mb-2">{sub}</p>}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {SKILLS.map((skill) => {
          const k = toKey(skill);
          const on = selected.includes(k);
          return (
            <button
              key={skill}
              type="button"
              onClick={() =>
                onChange(on ? selected.filter((s) => s !== k) : [...selected, k])
              }
              className={`px-3 py-1 rounded-full text-xs border transition-all duration-150 ${
                on
                  ? "bg-gray-900 border-gray-900 text-white font-bold"
                  : "bg-white border-gray-300 text-gray-500 hover:border-gray-400"
              }`}
            >
              {skill}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-gray-400">{selected.length} selected</span>
        {minRequired !== undefined && selected.length < minRequired && (
          <span className="text-red-500 font-semibold">
            Minimum {minRequired} required
          </span>
        )}
      </div>
    </div>
  );
}

function SkillTag({
  skill,
  highlight = false,
}: {
  skill: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
        highlight
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {toLabel(skill)}
    </span>
  );
}

function StatusBadge({ status }: { status: ProjectStatusValue }) {
  const s = STATUSES.find((x) => x.v === status) ?? STATUSES[0];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${s.tw}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.l}
    </span>
  );
}

function LifecycleBadge({ status }: { status: ProjectLifecycle }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
        status === "matched"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {status}
    </span>
  );
}

function StatCard({
  label, value, color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center flex-1 min-w-[80px]">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-gray-400 font-semibold mt-0.5">
        {label}
      </div>
    </div>
  );
}

// ============================================================
// RESPONSE FORM
// ============================================================

function ProjectResponseForm({
  project,
  company,
  onSubmit,
  onCancel,
}: {
  project: Project;
  company: Company;
  onSubmit: (r: CompanyResponse) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ResponseFormData>({
    meetingDate: "", meetingTime: "", meetingNote: "",
    peopleAvailable: 1, availableFrom: "", availableUntil: "",
    description: "",
  });

  const vol = VOL_TYPES.find((v) => v.v === project.volunteeringType);
  const overlap = getSkillOverlap(project.essentialSkills, company.offeredSkills);
  const isValid =
    !!(form.meetingDate && form.meetingTime && form.peopleAvailable >= 1
      && form.availableFrom && form.availableUntil && form.description.trim());

  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm p-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-100">
        <div>
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">
            Responding as {company.name}
          </p>
          <h2 className="text-xl font-bold text-gray-900">{project.title}</h2>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 text-xl px-2 transition-colors"
        >
          ×
        </button>
      </div>

      <p className="text-sm text-gray-500 leading-relaxed mb-4">
        {project.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {project.essentialSkills.map((s) => (
          <SkillTag
            key={s}
            skill={s}
            highlight={overlap.matched.includes(s.toLowerCase())}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-semibold mb-2">
        <span>{project.startDate} → {project.endDate}</span>
        <span>{project.peopleNeeded} volunteer{project.peopleNeeded !== 1 ? "s" : ""}</span>
        {vol && <span>{vol.l}</span>}
      </div>
      <p className="text-xs font-semibold text-emerald-600 mb-8">
        {overlap.count} of {overlap.total} skills matched
      </p>

      <div className="space-y-6">
        {/* Meeting request */}
        <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-xl p-5">
          <label className="block text-sm font-bold text-emerald-800 mb-1">
            Request a Meeting
          </label>
          <p className="text-xs text-emerald-700/70 mb-4">
            Propose an initial meeting to discuss the project with the charity
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Preferred Date
              </p>
              <input
                type="date"
                value={form.meetingDate}
                onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Preferred Time
              </p>
              <input
                type="time"
                value={form.meetingTime}
                onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">
              Meeting Note{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </p>
            <input
              type="text"
              value={form.meetingNote}
              onChange={(e) => setForm({ ...form, meetingNote: e.target.value })}
              placeholder="e.g. Happy to do a video call or meet at your offices"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
            />
          </div>
        </div>

        {/* Availability */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            Your Availability
          </label>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                People Available
              </p>
              <input
                type="number"
                min={1}
                max={100}
                value={form.peopleAvailable}
                onChange={(e) =>
                  setForm({ ...form, peopleAvailable: Math.max(1, parseInt(e.target.value) || 1) })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                Available From
              </p>
              <input
                type="date"
                value={form.availableFrom}
                onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                Available Until
              </p>
              <input
                type="date"
                value={form.availableUntil}
                onChange={(e) => setForm({ ...form, availableUntil: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* Offer description */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            What We Can Offer
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Describe how your team can support this project
          </p>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder="e.g. Our team of 5 developers can build the website using React and Node.js..."
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (isValid)
                onSubmit({
                  ...form,
                  companyId: company.id,
                  projectId: project.id,
                  submittedAt: new Date().toISOString(),
                });
            }}
            disabled={!isValid}
            className="flex-1 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold shadow-sm transition-colors"
          >
            Submit Response &amp; Request Meeting
          </button>
          <button
            onClick={onCancel}
            className="py-3 px-6 rounded-xl border border-gray-200 bg-white text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// META
// ============================================================

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard – Connect 4 Good" }];
}

// ============================================================
// EMPTY FORMS
// ============================================================

const emptyProj = (): ProjectFormState => ({
  title: "", description: "", status: "planning",
  essentialSkills: [], startDate: "", endDate: "",
  peopleNeeded: 1, volunteeringType: "", additionalInfo: "",
});

const emptyComp = (): CompanyFormState => ({
  name: "", bio: "", offeredSkills: [],
});

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Dashboard() {
  const [role, setRole] = useState<Role | null>(null);
  const [page, setPage] = useState<Page>("dashboard");

  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [responses, setResponses] = useState<CompanyResponse[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [respondingTo, setRespondingTo] = useState<RespondingTo | null>(null);
  const [loading, setLoading] = useState(true);

  const [projForm, setProjForm] = useState<ProjectFormState>(emptyProj());
  const [compForm, setCompForm] = useState<CompanyFormState>(emptyComp());

  // Real-time Firestore subscriptions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)),
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "companies"), (snap) => {
      setCompanies(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Company)),
      );
    });
    return unsub;
  }, []);

  const projValid =
    !!(projForm.title.trim() && projForm.description.trim()
      && projForm.essentialSkills.length >= MIN_SKILLS
      && projForm.startDate && projForm.endDate && projForm.volunteeringType);

  const createProject = useCallback(async () => {
    if (!projValid) return;
    await addDoc(collection(db, "projects"), {
      charityId: "charity_user",
      ...projForm,
      volunteeringType: projForm.volunteeringType as VolunteeringType,
      projectStatus: "open" as ProjectLifecycle,
    });
    setProjForm(emptyProj());
    setPage("dashboard");
  }, [projForm, projValid]);

  const createCompany = useCallback(async () => {
    if (!compForm.name.trim() || compForm.offeredSkills.length === 0) return;
    await addDoc(collection(db, "companies"), {
      ...compForm,
      status: "available" as const,
      preferredProjectIds: [],
    });
    setCompForm(emptyComp());
    setPage("dashboard");
  }, [compForm]);

  const submitResponse = useCallback((response: CompanyResponse) => {
    setResponses((p) => [...p, response]);
    setCompanies((p) =>
      p.map((c) =>
        c.id === response.companyId
          ? { ...c, preferredProjectIds: [...new Set([...c.preferredProjectIds, response.projectId])] }
          : c,
      ),
    );
    setRespondingTo(null);
  }, []);

  const selectMatch = useCallback(
    async (projId: string, compId: string) => {
      setSelectedMatches((p) => ({ ...p, [projId]: compId }));
      const proj = projects.find((p) => p.id === projId);
      setNotifications((p) => [
        ...p,
        { companyId: compId, projectTitle: proj?.title ?? "" },
      ]);
      await updateDoc(doc(db, "projects", projId), {
        projectStatus: "matched" as ProjectLifecycle,
      });
    },
    [projects],
  );

  const compNotifs = useMemo<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    notifications.forEach((n) => {
      if (!m[n.companyId]) m[n.companyId] = [];
      m[n.companyId].push(n.projectTitle);
    });
    return m;
  }, [notifications]);

  const openProjects = projects.filter((p) => p.projectStatus === "open");

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <svg className="animate-spin w-8 h-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  function navigate(p: Page) {
    setPage(p);
    setRespondingTo(null);
  }

  function switchRole() {
    setRole(null);
    setPage("dashboard");
    setRespondingTo(null);
  }

  // ============================================================
  // ROLE SELECTION
  // ============================================================

  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500 mb-6 shadow-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-gray-800 dark:text-white tracking-tight mb-3">
            Connect 4 Good
          </h1>
          <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mb-3">
            Your workforce. Their mission. Where skills meet purpose.
          </p>
          <p className="text-base text-gray-600 dark:text-gray-300 max-w-lg mx-auto leading-relaxed">
            We bridge the gap between companies with willing hands and charities
            with meaningful work — turning volunteer days into real impact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Charity column */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 flex flex-col items-center text-center border border-emerald-100 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mb-5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-emerald-600 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
              I&apos;m a Charity
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
              Register your charity and connect with companies whose employees
              want to volunteer their time and skills for your cause.
            </p>
            <button
              onClick={() => { setRole("charity"); setPage("dashboard"); }}
              className="mt-auto w-full py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-300 text-center"
            >
              Register as a Charity
            </button>
          </div>

          {/* Company column */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 flex flex-col items-center text-center border border-teal-100 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300">
            <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center mb-5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-teal-600 dark:text-teal-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
              I&apos;m a Company
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
              Register your company and find meaningful charities where your team
              can spend their CSRF volunteering days making a real difference.
            </p>
            <button
              onClick={() => { setRole("company"); setPage("dashboard"); }}
              className="mt-auto w-full py-3 px-6 rounded-xl bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-300 text-center"
            >
              Register as a Company
            </button>
          </div>
        </div>

        <p className="mt-10 text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{" "}
          <a
            href="#"
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            Sign in
          </a>
        </p>
      </div>
    );
  }

  const isCharity = role === "charity";
  const hasResponses = responses.length > 0;

  type NavItem = { k: Page; l: string; special?: boolean };
  const navItems: NavItem[] = isCharity
    ? [
        { k: "dashboard", l: "Dashboard" },
        { k: "new_project", l: "New Project" },
        ...(hasResponses
          ? [{ k: "review" as Page, l: `Review Responses (${responses.length})`, special: true }]
          : []),
      ]
    : [
        { k: "dashboard", l: "Dashboard" },
        { k: "register", l: "Register Team" },
        { k: "browse", l: "Browse Projects" },
      ];

  // ============================================================
  // SHARED LAYOUT WRAPPER
  // ============================================================

  const accentTw = isCharity
    ? "bg-slate-900 text-white"
    : "bg-emerald-700 text-white";
  const ringTw = isCharity ? "focus:ring-slate-400" : "focus:ring-emerald-400";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors hidden sm:inline">
                Connect 4 Good
              </span>
            </Link>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${accentTw}`}>
              {isCharity ? "Charity" : "Company"}
            </span>
            <h1 className="text-base font-bold text-gray-900 hidden sm:block">
              {isCharity ? "Project Hub" : "Partnership Hub"}
            </h1>
          </div>
          <button
            onClick={switchRole}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Switch Role
          </button>
        </div>

        {/* Nav */}
        <div className="max-w-3xl mx-auto px-4 pb-0 flex gap-1 flex-wrap">
          {navItems.map((n) => (
            <button
              key={n.k}
              onClick={() => navigate(n.k)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                n.special
                  ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                  : page === n.k
                  ? isCharity
                    ? "border-slate-900 text-slate-900"
                    : "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {n.l}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* ====================================================
            CHARITY: DASHBOARD
        ==================================================== */}
        {isCharity && page === "dashboard" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="flex gap-3 flex-wrap">
              <StatCard label="Projects"  value={projects.length} color="#0f2942" />
              <StatCard label="Open"      value={openProjects.length} color="#2563eb" />
              <StatCard label="Responses" value={responses.length} color="#7c3aed" />
              <StatCard
                label="Matched"
                value={projects.filter((p) => p.projectStatus === "matched").length}
                color="#16a34a"
              />
            </div>

            {/* Confirmed matches banner */}
            {Object.keys(selectedMatches).length > 0 && (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5">
                <p className="text-sm font-bold text-emerald-800 mb-3">
                  Confirmed Matches
                </p>
                {Object.entries(selectedMatches).map(([projId, compId]) => {
                  const proj = projects.find((p) => p.id === projId);
                  const comp = companies.find((c) => c.id === compId);
                  return (
                    <div
                      key={projId}
                      className="py-2 border-b border-emerald-200 last:border-0 text-sm text-emerald-900"
                    >
                      <strong>{proj?.title}</strong> matched with{" "}
                      <strong>{comp?.name}</strong>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Project list */}
            {projects.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
                <p className="text-sm">No projects yet.</p>
                <button
                  onClick={() => navigate("new_project")}
                  className="mt-3 text-sm font-semibold text-slate-700 underline underline-offset-2"
                >
                  Create your first proposal
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => {
                  const vol = VOL_TYPES.find((v) => v.v === p.volunteeringType);
                  const projResponses = responses.filter(
                    (r) => r.projectId === p.id,
                  );
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-bold text-gray-900">{p.title}</h3>
                        <div className="flex gap-2 shrink-0">
                          <StatusBadge status={p.status} />
                          <LifecycleBadge status={p.projectStatus} />
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed mb-3">
                        {p.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {p.essentialSkills.map((s) => (
                          <SkillTag key={s} skill={s} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-semibold">
                        {p.startDate && (
                          <span>
                            {p.startDate} → {p.endDate}
                          </span>
                        )}
                        <span>
                          {p.peopleNeeded} volunteer
                          {p.peopleNeeded !== 1 ? "s" : ""}
                        </span>
                        {vol && <span>{vol.l}</span>}
                        {projResponses.length > 0 && (
                          <span className="text-purple-600">
                            {projResponses.length} response
                            {projResponses.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {p.additionalInfo && (
                        <div className="mt-3 pl-3 border-l-2 border-gray-200 text-xs text-gray-500 leading-relaxed">
                          {p.additionalInfo}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ====================================================
            CHARITY: NEW PROJECT
        ==================================================== */}
        {isCharity && page === "new_project" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-7">
              New Project Proposal
            </h2>
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-bold text-gray-700 tracking-wide mb-1">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projForm.title}
                  onChange={(e) =>
                    setProjForm({ ...projForm, title: e.target.value })
                  }
                  placeholder="e.g. Community Digital Literacy Programme"
                  maxLength={120}
                  className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 ${ringTw} bg-gray-50`}
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-sm font-bold text-gray-700 tracking-wide">
                    Project Description <span className="text-red-500">*</span>
                  </label>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      projForm.description.length >= CHAR_LIMIT
                        ? "text-red-500"
                        : projForm.description.length > CHAR_LIMIT * 0.85
                        ? "text-yellow-500"
                        : "text-gray-400"
                    }`}
                  >
                    {projForm.description.length}/{CHAR_LIMIT}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={projForm.description}
                  onChange={(e) => {
                    if (e.target.value.length <= CHAR_LIMIT)
                      setProjForm({ ...projForm, description: e.target.value });
                  }}
                  placeholder="Describe your project goals, what support you need, and expected outcomes..."
                  className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 ${ringTw} resize-none bg-gray-50`}
                />
                {/* Progress bar */}
                <div className="h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      projForm.description.length >= CHAR_LIMIT
                        ? "bg-red-500"
                        : "bg-slate-700"
                    }`}
                    style={{
                      width: `${Math.min((projForm.description.length / CHAR_LIMIT) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-bold text-gray-700 tracking-wide mb-2">
                  Project Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setProjForm({ ...projForm, status: s.v })}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                        projForm.status === s.v
                          ? s.tw
                          : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <SkillPicker
                label="Essential Skills"
                sub="Select the skills needed for this project (minimum 3)"
                selected={projForm.essentialSkills}
                onChange={(s) => setProjForm({ ...projForm, essentialSkills: s })}
                minRequired={MIN_SKILLS}
              />

              {/* Dates + headcount */}
              <div>
                <label className="block text-sm font-bold text-gray-700 tracking-wide mb-2">
                  Estimated Support Required
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Start Date</p>
                    <input
                      type="date"
                      value={projForm.startDate}
                      onChange={(e) =>
                        setProjForm({ ...projForm, startDate: e.target.value })
                      }
                      className={`w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 ${ringTw}`}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">End Date</p>
                    <input
                      type="date"
                      value={projForm.endDate}
                      onChange={(e) =>
                        setProjForm({ ...projForm, endDate: e.target.value })
                      }
                      className={`w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 ${ringTw}`}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">People Needed</p>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={projForm.peopleNeeded}
                      onChange={(e) =>
                        setProjForm({
                          ...projForm,
                          peopleNeeded: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className={`w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 ${ringTw}`}
                    />
                  </div>
                </div>
              </div>

              {/* Volunteering type */}
              <div>
                <label className="block text-sm font-bold text-gray-700 tracking-wide mb-2">
                  Type of Volunteering <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {VOL_TYPES.map((v) => (
                    <button
                      key={v.v}
                      type="button"
                      onClick={() =>
                        setProjForm({ ...projForm, volunteeringType: v.v })
                      }
                      className={`text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                        projForm.volunteeringType === v.v
                          ? "border-slate-900 bg-slate-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`text-xs font-bold mb-0.5 ${
                          projForm.volunteeringType === v.v
                            ? "text-slate-900"
                            : "text-gray-700"
                        }`}
                      >
                        {v.l}
                      </div>
                      <div className="text-[10px] text-gray-400">{v.d}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional info */}
              <div>
                <label className="block text-sm font-bold text-gray-700 tracking-wide mb-1">
                  Additional Information
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Any other details, requirements, or context for companies
                </p>
                <textarea
                  rows={3}
                  value={projForm.additionalInfo}
                  onChange={(e) =>
                    setProjForm({ ...projForm, additionalInfo: e.target.value })
                  }
                  placeholder="e.g. We'd prefer a team with prior experience working with vulnerable communities..."
                  className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 ${ringTw} resize-none bg-gray-50`}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={createProject}
                  disabled={!projValid}
                  className="flex-1 py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold shadow-sm transition-colors"
                >
                  Create Project
                </button>
                <button
                  onClick={() => {
                    setProjForm(emptyProj());
                    navigate("dashboard");
                  }}
                  className="py-3 px-6 rounded-xl border border-gray-200 bg-white text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            CHARITY: REVIEW RESPONSES
        ==================================================== */}
        {isCharity && page === "review" && (
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-gray-900">
                Company Responses
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Review responses from interested companies and select your match.
              </p>
            </div>

            {projects
              .filter((p) => responses.some((r) => r.projectId === p.id))
              .map((proj) => {
                const ranked = rankResponses(proj, responses, companies);
                return (
                  <div
                    key={proj.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Project header */}
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">{proj.title}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {ranked.length} response
                        {ranked.length !== 1 ? "s" : ""} ·{" "}
                        {proj.essentialSkills.map(toLabel).join(", ")}
                      </p>
                    </div>

                    <div className="p-5 space-y-4">
                      {ranked.map((r, i) => {
                        const chosen = selectedMatches[proj.id] === r.companyId;
                        const locked = !!selectedMatches[proj.id];
                        const rankColors = [
                          "bg-slate-900 text-white",
                          "bg-slate-600 text-white",
                          "bg-gray-300 text-gray-700",
                        ];
                        return (
                          <div
                            key={r.companyId}
                            className={`rounded-xl border-2 p-5 transition-all ${
                              chosen
                                ? "border-emerald-400 bg-emerald-50"
                                : "border-gray-100 bg-gray-50"
                            }`}
                          >
                            {/* Company header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${rankColors[i] ?? "bg-gray-200 text-gray-600"}`}
                                >
                                  {i + 1}
                                </span>
                                <span className="font-bold text-gray-900">
                                  {r.companyName}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-emerald-600 tabular-nums">
                                {r.overlap.count}/{r.overlap.total} skills
                              </span>
                            </div>

                            {r.companyBio && (
                              <p className="text-xs italic text-gray-500 mb-3 ml-9">
                                {r.companyBio}
                              </p>
                            )}

                            {/* Meeting block */}
                            <div className="ml-9 bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-3 mb-3">
                              <p className="text-[11px] font-bold text-cyan-700 mb-1">
                                Meeting Requested
                              </p>
                              <p className="text-xs text-gray-700">
                                {r.meetingDate} at {r.meetingTime}
                                {r.meetingNote && (
                                  <span className="text-gray-400">
                                    {" "}— {r.meetingNote}
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Availability */}
                            <div className="ml-9 flex flex-wrap gap-4 text-xs text-gray-400 font-semibold mb-3">
                              <span>{r.peopleAvailable} people available</span>
                              <span>
                                {r.availableFrom} → {r.availableUntil}
                              </span>
                            </div>

                            {/* Offer description */}
                            <div className="ml-9 pl-3 border-l-2 border-gray-200 text-xs text-gray-600 leading-relaxed mb-3">
                              {r.description}
                            </div>

                            {/* Skill match */}
                            <div className="ml-9 flex flex-wrap gap-1.5 mb-4">
                              {proj.essentialSkills.map((s) => (
                                <SkillTag
                                  key={s}
                                  skill={s}
                                  highlight={r.overlap.matched.includes(
                                    s.toLowerCase(),
                                  )}
                                />
                              ))}
                            </div>

                            {/* Action */}
                            <div className="ml-9">
                              {chosen ? (
                                <p className="text-center text-sm font-bold text-emerald-700 py-1">
                                  ✓ Matched
                                </p>
                              ) : !locked ? (
                                <button
                                  onClick={() =>
                                    selectMatch(proj.id, r.companyId)
                                  }
                                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
                                >
                                  Select {r.companyName}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {!projects.some((p) =>
              responses.some((r) => r.projectId === p.id),
            ) && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
                <p className="text-sm">No responses yet.</p>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => navigate("dashboard")}
                className="px-6 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ====================================================
            COMPANY: DASHBOARD
        ==================================================== */}
        {!isCharity && page === "dashboard" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="flex gap-3 flex-wrap">
              <StatCard label="Your Companies"  value={companies.length}  color="#16a34a" />
              <StatCard label="Open Projects"   value={openProjects.length} color="#2563eb" />
              <StatCard label="Responses Sent"  value={responses.length}   color="#7c3aed" />
            </div>

            {/* Match notifications */}
            {Object.keys(compNotifs).length > 0 && (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5">
                <p className="text-sm font-bold text-emerald-800 mb-3">
                  You&apos;ve Been Matched!
                </p>
                {Object.entries(compNotifs).map(([cid, titles]) => {
                  const comp = companies.find((c) => c.id === cid);
                  return titles.map((t, i) => (
                    <div
                      key={`${cid}-${i}`}
                      className="py-2 border-b border-emerald-200 last:border-0 text-sm text-emerald-900"
                    >
                      <strong>{comp?.name}</strong> has been selected for{" "}
                      <strong>&ldquo;{t}&rdquo;</strong>
                    </div>
                  ));
                })}
              </div>
            )}

            {/* Company cards */}
            {companies.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
                <p className="text-sm">No companies registered yet.</p>
                <button
                  onClick={() => navigate("register")}
                  className="mt-3 text-sm font-semibold text-emerald-700 underline underline-offset-2"
                >
                  Register your company
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {companies.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                  >
                    <h3 className="font-bold text-gray-900 mb-1">{c.name}</h3>
                    {c.bio && (
                      <p className="text-sm text-gray-500 leading-relaxed mb-3">
                        {c.bio}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {c.offeredSkills.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-xs rounded-full font-semibold"
                        >
                          {toLabel(s)}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 font-semibold">
                      {c.offeredSkills.length} skill
                      {c.offeredSkills.length !== 1 ? "s" : ""} offered
                      {c.preferredProjectIds.length > 0 && (
                        <span className="text-emerald-600">
                          {" "}· Responded to {c.preferredProjectIds.length} project
                          {c.preferredProjectIds.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================================================
            COMPANY: REGISTER
        ==================================================== */}
        {!isCharity && page === "register" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-7">
              Register Team
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 tracking-wide mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={compForm.name}
                  onChange={(e) =>
                    setCompForm({ ...compForm, name: e.target.value })
                  }
                  placeholder="e.g. TechForGood Ltd"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 tracking-wide mb-1">
                  Company Bio
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Tell charities a bit about your company and what drives you
                </p>
                <textarea
                  rows={3}
                  value={compForm.bio}
                  onChange={(e) =>
                    setCompForm({ ...compForm, bio: e.target.value })
                  }
                  placeholder="e.g. We're a London-based tech consultancy passionate about using technology for social good..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none bg-gray-50"
                />
              </div>

              <SkillPicker
                label="Skills You Can Offer"
                sub="Select all skills your team can provide"
                selected={compForm.offeredSkills}
                onChange={(s) =>
                  setCompForm({ ...compForm, offeredSkills: s })
                }
              />

              <div className="flex gap-3">
                <button
                  onClick={createCompany}
                  disabled={
                    !compForm.name.trim() || compForm.offeredSkills.length === 0
                  }
                  className="flex-1 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold shadow-sm transition-colors"
                >
                  Register
                </button>
                <button
                  onClick={() => {
                    setCompForm(emptyComp());
                    navigate("dashboard");
                  }}
                  className="py-3 px-6 rounded-xl border border-gray-200 bg-white text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            COMPANY: BROWSE + RESPONSE FORM
        ==================================================== */}
        {!isCharity && page === "browse" && (
          <div className="space-y-5">
            {companies.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
                <p className="text-sm">
                  Register a company first to browse projects.
                </p>
                <button
                  onClick={() => navigate("register")}
                  className="mt-3 text-sm font-semibold text-emerald-700 underline underline-offset-2"
                >
                  Register now
                </button>
              </div>
            ) : respondingTo ? (
              (() => {
                const proj = projects.find(
                  (p) => p.id === respondingTo.projectId,
                );
                const comp = companies.find(
                  (c) => c.id === respondingTo.companyId,
                );
                if (!proj || !comp) return null;
                return (
                  <ProjectResponseForm
                    project={proj}
                    company={comp}
                    onSubmit={submitResponse}
                    onCancel={() => setRespondingTo(null)}
                  />
                );
              })()
            ) : (
              companies.map((comp) => {
                const matched = getMatchedProjects(projects, comp);
                const alreadyResponded = new Set(
                  responses
                    .filter((r) => r.companyId === comp.id)
                    .map((r) => r.projectId),
                );
                return (
                  <div
                    key={comp.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">{comp.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Projects matching your skills ({matched.length} found)
                      </p>
                    </div>

                    {matched.length === 0 ? (
                      <p className="px-5 py-8 text-sm text-gray-400">
                        No projects match your current skills yet.
                      </p>
                    ) : (
                      <div className="p-4 space-y-3">
                        {matched.map((proj) => {
                          const responded = alreadyResponded.has(proj.id);
                          const vol = VOL_TYPES.find(
                            (v) => v.v === proj.volunteeringType,
                          );
                          return (
                            <div
                              key={proj.id}
                              className={`rounded-xl border p-4 transition-all ${
                                responded
                                  ? "border-emerald-200 bg-emerald-50"
                                  : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <h4 className="font-bold text-sm text-gray-900 mb-1">
                                {proj.title}
                              </h4>
                              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                                {proj.description}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {proj.essentialSkills.map((s) => (
                                  <SkillTag
                                    key={s}
                                    skill={s}
                                    highlight={proj.overlap.matched.includes(
                                      s.toLowerCase(),
                                    )}
                                  />
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-semibold mb-3">
                                {proj.startDate && (
                                  <span>
                                    {proj.startDate} → {proj.endDate}
                                  </span>
                                )}
                                <span>{proj.peopleNeeded} people</span>
                                {vol && <span>{vol.l}</span>}
                                <span className="text-emerald-600 font-bold">
                                  {proj.overlap.count}/{proj.overlap.total}{" "}
                                  skills matched
                                </span>
                              </div>

                              {responded ? (
                                <p className="text-center text-xs font-bold text-emerald-700 py-1">
                                  ✓ Response Submitted
                                </p>
                              ) : (
                                <button
                                  onClick={() =>
                                    setRespondingTo({
                                      projectId: proj.id,
                                      companyId: comp.id,
                                    })
                                  }
                                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
                                >
                                  Respond to Project
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
