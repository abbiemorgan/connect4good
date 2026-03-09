import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/home";

// ============================================================
// TYPES
// ============================================================

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  essentialSkills: string[];
  startDate: string;
  endDate: string;
  peopleNeeded: number;
  volunteeringType: string;
  additionalInfo: string;
}

interface Company {
  id: string;
  name: string;
  bio: string;
  offeredSkills: string[];
  status: "available" | "unavailable";
  preferredProjectIds: string[];
}

interface MatchResult {
  companyId: string;
  companyName: string;
  overall: number;
  matchedSkills: string[];
  missingSkills: string[];
}

interface MatchNotification {
  companyId: string;
  companyName: string;
  projectTitle: string;
}

// ============================================================
// MATCHING ENGINE
// ============================================================

function computeSkillsScore(
  essential: string[],
  offered: string[],
): { score: number; matched: string[]; missing: string[] } {
  const ess = new Set(essential);
  const off = new Set(offered);
  const matched = [...ess].filter((s) => off.has(s));
  const missing = [...ess].filter((s) => !off.has(s));
  const union = new Set([...ess, ...off]);
  const score = union.size === 0 ? 0 : matched.length / union.size;
  return { score, matched, missing };
}

function runMatching(
  project: Project,
  companies: Company[],
  topN = 5,
): MatchResult[] {
  return companies
    .filter(
      (c) =>
        c.status === "available" &&
        c.preferredProjectIds.includes(project.id),
    )
    .map((c) => {
      const { score, matched, missing } = computeSkillsScore(
        project.essentialSkills,
        c.offeredSkills,
      );
      return {
        companyId: c.id,
        companyName: c.name,
        overall: score,
        matchedSkills: matched,
        missingSkills: missing,
      };
    })
    .sort((a, b) => b.overall - a.overall)
    .slice(0, topN);
}

// ============================================================
// CONSTANTS
// ============================================================

const SKILLS: string[] = [
  "Web Development",
  "Mobile Development",
  "UI/UX Design",
  "Data Analysis",
  "Database Management",
  "Project Management",
  "Graphic Design",
  "Copywriting",
  "SEO",
  "Marketing",
  "Legal Advice",
  "Accounting",
  "Fundraising",
  "Event Planning",
  "Photography",
  "Video Production",
  "Social Media",
  "DevOps",
  "Cybersecurity",
  "Training & Mentoring",
  "Interview Prep",
  "Presentations",
  "Upskill",
];

const STATUSES = [
  { v: "planning", l: "Planning", tw: "bg-purple-100 text-purple-700" },
  {
    v: "ready_to_start",
    l: "Ready to Start",
    tw: "bg-blue-100 text-blue-700",
  },
  {
    v: "in_progress",
    l: "In Progress",
    tw: "bg-yellow-100 text-yellow-700",
  },
  { v: "on_hold", l: "On Hold", tw: "bg-orange-100 text-orange-700" },
  {
    v: "next_iteration",
    l: "Next Iteration",
    tw: "bg-cyan-100 text-cyan-700",
  },
];

const VOL_TYPES = [
  { v: "in_person", l: "In-Person", d: "On-site at charity location" },
  { v: "remote", l: "Remote", d: "Work from anywhere online" },
  { v: "hybrid", l: "Hybrid", d: "Mix of in-person and remote" },
  { v: "event_based", l: "Event-Based", d: "Specific events or one-off days" },
  {
    v: "skills_based",
    l: "Skills-Based",
    d: "Pro-bono professional services",
  },
  { v: "mentoring", l: "Mentoring", d: "Ongoing mentorship or coaching" },
];

const CHAR_LIMIT = 500;
const MIN_SKILLS = 3;
let _uid = 0;
const uid = () => `${++_uid}_${Date.now()}`;

// ============================================================
// SHARED COMPONENTS
// ============================================================

function SkillPicker({
  selected,
  onChange,
  label,
  sub,
  minRequired,
}: {
  selected: string[];
  onChange: (s: string[]) => void;
  label: string;
  sub?: string;
  minRequired?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
      </label>
      {sub && <p className="text-xs text-gray-500 mb-2">{sub}</p>}
      <div className="flex flex-wrap gap-2 mt-2">
        {SKILLS.map((skill) => {
          const on = selected.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              onClick={() =>
                onChange(
                  on
                    ? selected.filter((s) => s !== skill)
                    : [...selected, skill],
                )
              }
              className={`px-3 py-1 rounded-full text-xs border transition-all duration-150 ${
                on
                  ? "bg-emerald-600 border-emerald-600 text-white font-bold"
                  : "bg-white border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600"
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

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "#059669" : pct >= 40 ? "#ca8a04" : "#dc2626";
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="text-xs font-bold tabular-nums w-9 text-right"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.v === status) ?? STATUSES[0];
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${s.tw}`}
    >
      {s.l}
    </span>
  );
}

// ============================================================
// EMPTY FORM
// ============================================================

const emptyProjectForm = (): Omit<Project, "id"> => ({
  title: "",
  description: "",
  status: "planning",
  essentialSkills: [],
  startDate: "",
  endDate: "",
  peopleNeeded: 1,
  volunteeringType: "remote",
  additionalInfo: "",
});

// ============================================================
// META
// ============================================================

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard – Connect 4 Good" }];
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Dashboard() {
  const [role, setRole] = useState<"charity" | "company" | null>(null);
  const [tab, setTab] = useState("projects");

  // Charity state
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProjectForm());
  const [matchResults, setMatchResults] = useState<
    Record<string, MatchResult[]>
  >({});
  const [selectedMatches, setSelectedMatches] = useState<
    Record<string, string>
  >({});

  // Company state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [myCompany, setMyCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    bio: "",
    offeredSkills: [] as string[],
  });
  const [notifications, setNotifications] = useState<MatchNotification[]>([]);

  // ---- charity handlers ----

  function addProject() {
    if (
      !projectForm.title.trim() ||
      projectForm.essentialSkills.length < MIN_SKILLS
    )
      return;
    setProjects((prev) => [...prev, { id: uid(), ...projectForm }]);
    setProjectForm(emptyProjectForm());
    setShowProjectForm(false);
  }

  function findMatches(project: Project) {
    const results = runMatching(project, companies);
    setMatchResults((prev) => ({ ...prev, [project.id]: results }));
    setTab("matches");
  }

  function selectMatch(projectId: string, companyId: string) {
    const project = projects.find((p) => p.id === projectId);
    const company = companies.find((c) => c.id === companyId);
    if (!project || !company) return;
    setSelectedMatches((prev) => ({ ...prev, [projectId]: companyId }));
    setNotifications((prev) => [
      ...prev,
      {
        companyId,
        companyName: company.name,
        projectTitle: project.title,
      },
    ]);
  }

  // ---- company handlers ----

  function registerCompany() {
    if (
      !companyForm.name.trim() ||
      companyForm.offeredSkills.length < MIN_SKILLS
    )
      return;
    const c: Company = {
      id: uid(),
      name: companyForm.name.trim(),
      bio: companyForm.bio.trim(),
      offeredSkills: companyForm.offeredSkills,
      status: "available",
      preferredProjectIds: [],
    };
    setCompanies((prev) => [...prev, c]);
    setMyCompany(c);
    setTab("browse");
  }

  function toggleInterest(projectId: string) {
    if (!myCompany) return;
    const already = myCompany.preferredProjectIds.includes(projectId);
    const updated: Company = {
      ...myCompany,
      preferredProjectIds: already
        ? myCompany.preferredProjectIds.filter((id) => id !== projectId)
        : [...myCompany.preferredProjectIds, projectId],
    };
    setMyCompany(updated);
    setCompanies((prev) => prev.map((c) => (c.id === myCompany.id ? updated : c)));
  }

  // ============================================================
  // ROLE SELECTION
  // ============================================================

  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex flex-col items-center justify-center px-4 py-16">
        <Link
          to="/"
          className="mb-10 flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Home
        </Link>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 mb-4 shadow-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7 text-white"
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome to the Platform
          </h1>
          <p className="text-gray-500">Select your role to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button
            onClick={() => { setRole("charity"); setTab("projects"); }}
            className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center text-center border border-emerald-100 hover:shadow-xl hover:border-emerald-300 transition-all duration-200 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-emerald-600"
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              I&apos;m a Charity
            </h2>
            <p className="text-sm text-gray-500">
              Post volunteering projects and find the perfect company match
            </p>
          </button>

          <button
            onClick={() => { setRole("company"); setTab("browse"); }}
            className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center text-center border border-teal-100 hover:shadow-xl hover:border-teal-300 transition-all duration-200 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-teal-600"
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              I&apos;m a Company
            </h2>
            <p className="text-sm text-gray-500">
              Browse charity projects and offer your team&apos;s CSRF days
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // CHARITY DASHBOARD
  // ============================================================

  if (role === "charity") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 text-white"
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
              <span className="font-bold text-gray-800 text-sm">
                Connect 4 Good
              </span>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                Charity
              </span>
            </div>
            <button
              onClick={() => setRole(null)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Switch role
            </button>
          </div>

          {/* Tabs */}
          <div className="max-w-5xl mx-auto px-4 flex">
            {[
              { id: "projects", label: "Projects", count: projects.length },
              {
                id: "matches",
                label: "Matches",
                count: Object.keys(matchResults).length,
              },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-1.5 bg-emerald-100 text-emerald-600 text-xs px-1.5 py-0.5 rounded-full">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          {/* ── PROJECTS TAB ── */}
          {tab === "projects" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-800">
                  Your Projects
                </h2>
                <button
                  onClick={() => setShowProjectForm((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  New Project
                </button>
              </div>

              {/* Create project form */}
              {showProjectForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-5">
                    Create a New Project
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Project Title{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={projectForm.title}
                        onChange={(e) =>
                          setProjectForm((f) => ({
                            ...f,
                            title: e.target.value,
                          }))
                        }
                        placeholder="e.g. Rebuild our donation portal"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={projectForm.description}
                        onChange={(e) => {
                          if (e.target.value.length <= CHAR_LIMIT)
                            setProjectForm((f) => ({
                              ...f,
                              description: e.target.value,
                            }));
                        }}
                        rows={3}
                        placeholder="What does this project involve?"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                      />
                      <p className="text-right text-xs text-gray-400 mt-1">
                        {projectForm.description.length}/{CHAR_LIMIT}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={projectForm.status}
                          onChange={(e) =>
                            setProjectForm((f) => ({
                              ...f,
                              status: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          {STATUSES.map((s) => (
                            <option key={s.v} value={s.v}>
                              {s.l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Volunteering Type
                        </label>
                        <select
                          value={projectForm.volunteeringType}
                          onChange={(e) =>
                            setProjectForm((f) => ({
                              ...f,
                              volunteeringType: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          {VOL_TYPES.map((t) => (
                            <option key={t.v} value={t.v}>
                              {t.l} — {t.d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={projectForm.startDate}
                          onChange={(e) =>
                            setProjectForm((f) => ({
                              ...f,
                              startDate: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={projectForm.endDate}
                          onChange={(e) =>
                            setProjectForm((f) => ({
                              ...f,
                              endDate: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          People Needed
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={projectForm.peopleNeeded}
                          onChange={(e) =>
                            setProjectForm((f) => ({
                              ...f,
                              peopleNeeded: parseInt(e.target.value) || 1,
                            }))
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                    </div>

                    <SkillPicker
                      label="Essential Skills"
                      sub="Select the skills volunteers must have"
                      selected={projectForm.essentialSkills}
                      onChange={(s) =>
                        setProjectForm((f) => ({ ...f, essentialSkills: s }))
                      }
                      minRequired={MIN_SKILLS}
                    />

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Additional Information
                      </label>
                      <textarea
                        value={projectForm.additionalInfo}
                        onChange={(e) =>
                          setProjectForm((f) => ({
                            ...f,
                            additionalInfo: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Anything else companies should know?"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={addProject}
                        disabled={
                          !projectForm.title.trim() ||
                          projectForm.essentialSkills.length < MIN_SKILLS
                        }
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        Create Project
                      </button>
                      <button
                        onClick={() => {
                          setShowProjectForm(false);
                          setProjectForm(emptyProjectForm());
                        }}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Projects list */}
              {projects.length === 0 && !showProjectForm ? (
                <div className="text-center py-24 text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-12 h-12 mx-auto mb-4 opacity-30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm font-medium">No projects yet</p>
                  <p className="text-xs mt-1">
                    Create your first project to start finding volunteer
                    companies
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((p) => {
                    const volType = VOL_TYPES.find(
                      (t) => t.v === p.volunteeringType,
                    );
                    const isMatched = !!selectedMatches[p.id];
                    return (
                      <div
                        key={p.id}
                        className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <h3 className="font-semibold text-gray-800">
                                {p.title}
                              </h3>
                              <StatusBadge status={p.status} />
                              {isMatched && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                                  Matched
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <p className="text-sm text-gray-500 mb-3 leading-relaxed">
                                {p.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {p.essentialSkills.map((s) => (
                                <span
                                  key={s}
                                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                              {p.startDate && (
                                <span>
                                  📅 {p.startDate} →{" "}
                                  {p.endDate || "TBD"}
                                </span>
                              )}
                              <span>
                                👥 {p.peopleNeeded} volunteer
                                {p.peopleNeeded !== 1 ? "s" : ""} needed
                              </span>
                              {volType && <span>🏷 {volType.l}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => findMatches(p)}
                            className="shrink-0 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-xl border border-emerald-200 transition-colors"
                          >
                            Find Matches
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── MATCHES TAB ── */}
          {tab === "matches" && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-6">
                Company Matches
              </h2>
              {Object.keys(matchResults).length === 0 ? (
                <div className="text-center py-24 text-gray-400">
                  <p className="text-sm font-medium">No matches run yet</p>
                  <p className="text-xs mt-1">
                    Click &ldquo;Find Matches&rdquo; on a project to see
                    suitable companies
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(matchResults).map(
                    ([projectId, results]) => {
                      const project = projects.find(
                        (p) => p.id === projectId,
                      );
                      if (!project) return null;
                      return (
                        <div
                          key={projectId}
                          className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                        >
                          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                            <h3 className="font-semibold text-gray-800">
                              {project.title}
                            </h3>
                            <StatusBadge status={project.status} />
                          </div>

                          {results.length === 0 ? (
                            <p className="px-5 py-8 text-sm text-gray-400">
                              No companies have expressed interest in this
                              project yet.
                            </p>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {results.map((r, i) => {
                                const isSelected =
                                  selectedMatches[projectId] ===
                                  r.companyId;
                                const alreadyChosen =
                                  !!selectedMatches[projectId];
                                return (
                                  <div
                                    key={r.companyId}
                                    className={`px-5 py-4 flex items-center gap-4 ${isSelected ? "bg-emerald-50" : ""}`}
                                  >
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                      #{i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-gray-800 text-sm mb-1">
                                        {r.companyName}
                                      </p>
                                      <ScoreBar value={r.overall} />
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {r.matchedSkills.map((s) => (
                                          <span
                                            key={s}
                                            className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded font-medium"
                                          >
                                            ✓ {s}
                                          </span>
                                        ))}
                                        {r.missingSkills.map((s) => (
                                          <span
                                            key={s}
                                            className="px-1.5 py-0.5 bg-red-50 text-red-400 text-[10px] rounded font-medium"
                                          >
                                            ✗ {s}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        selectMatch(
                                          projectId,
                                          r.companyId,
                                        )
                                      }
                                      disabled={alreadyChosen}
                                      className={`shrink-0 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                                        isSelected
                                          ? "bg-emerald-500 text-white cursor-default"
                                          : alreadyChosen
                                            ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                            : "bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200"
                                      }`}
                                    >
                                      {isSelected ? "✓ Selected" : "Select"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============================================================
  // COMPANY — REGISTRATION
  // ============================================================

  if (!myCompany) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full border border-gray-200">
          <button
            onClick={() => setRole(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-3 mb-7">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-teal-600"
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
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Register your Company
              </h2>
              <p className="text-sm text-gray-500">Connect 4 Good</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyForm.name}
                onChange={(e) =>
                  setCompanyForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Short Bio
              </label>
              <textarea
                value={companyForm.bio}
                onChange={(e) =>
                  setCompanyForm((f) => ({ ...f, bio: e.target.value }))
                }
                rows={2}
                placeholder="A brief description of what your company does"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            </div>

            <SkillPicker
              label="Skills your team can offer"
              sub="Select all skills your volunteers can contribute"
              selected={companyForm.offeredSkills}
              onChange={(s) =>
                setCompanyForm((f) => ({ ...f, offeredSkills: s }))
              }
              minRequired={MIN_SKILLS}
            />

            <button
              onClick={registerCompany}
              disabled={
                !companyForm.name.trim() ||
                companyForm.offeredSkills.length < MIN_SKILLS
              }
              className="w-full py-3 px-6 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md transition-colors focus:outline-none focus:ring-4 focus:ring-teal-300"
            >
              Register Company
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // COMPANY DASHBOARD
  // ============================================================

  const myNotifs = notifications.filter((n) => n.companyId === myCompany.id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-white"
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
            <span className="font-bold text-gray-800 text-sm">
              Connect 4 Good
            </span>
            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
              Company
            </span>
            <span className="text-sm text-gray-600 font-medium hidden sm:inline">
              {myCompany.name}
            </span>
          </div>
          <button
            onClick={() => setRole(null)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Switch role
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex">
          {[
            {
              id: "browse",
              label: "Browse Projects",
              count: projects.length,
            },
            {
              id: "interests",
              label: "My Interests",
              count: myCompany.preferredProjectIds.length,
            },
            {
              id: "notifications",
              label: "Notifications",
              count: myNotifs.length,
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1.5 bg-teal-100 text-teal-600 text-xs px-1.5 py-0.5 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* ── BROWSE PROJECTS ── */}
        {tab === "browse" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              Open Projects
            </h2>
            {projects.length === 0 ? (
              <div className="text-center py-24 text-gray-400">
                <p className="text-sm font-medium">
                  No projects available yet
                </p>
                <p className="text-xs mt-1">
                  Check back soon as charities post new projects
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((p) => {
                  const volType = VOL_TYPES.find(
                    (t) => t.v === p.volunteeringType,
                  );
                  const interested =
                    myCompany.preferredProjectIds.includes(p.id);
                  const skillMatch = computeSkillsScore(
                    p.essentialSkills,
                    myCompany.offeredSkills,
                  );
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className="font-semibold text-gray-800">
                              {p.title}
                            </h3>
                            <StatusBadge status={p.status} />
                          </div>
                          {p.description && (
                            <p className="text-sm text-gray-500 mb-3 leading-relaxed">
                              {p.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {p.essentialSkills.map((s) => {
                              const have =
                                myCompany.offeredSkills.includes(s);
                              return (
                                <span
                                  key={s}
                                  className={`px-2 py-0.5 text-xs rounded-full ${
                                    have
                                      ? "bg-emerald-50 text-emerald-700 font-medium"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {have ? "✓ " : ""}
                                  {s}
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-3">
                            {p.startDate && (
                              <span>
                                📅 {p.startDate} →{" "}
                                {p.endDate || "TBD"}
                              </span>
                            )}
                            <span>
                              👥 {p.peopleNeeded} volunteer
                              {p.peopleNeeded !== 1 ? "s" : ""} needed
                            </span>
                            {volType && <span>🏷 {volType.l}</span>}
                          </div>
                          <div className="flex items-center gap-2 max-w-xs">
                            <span className="text-xs text-gray-500 shrink-0">
                              Your match:
                            </span>
                            <ScoreBar value={skillMatch.score} />
                          </div>
                        </div>
                        <button
                          onClick={() => toggleInterest(p.id)}
                          className={`shrink-0 px-4 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                            interested
                              ? "bg-teal-500 text-white border-teal-500 hover:bg-teal-600"
                              : "bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200"
                          }`}
                        >
                          {interested ? "✓ Interested" : "Express Interest"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MY INTERESTS ── */}
        {tab === "interests" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              Projects I&apos;m Interested In
            </h2>
            {myCompany.preferredProjectIds.length === 0 ? (
              <div className="text-center py-24 text-gray-400">
                <p className="text-sm font-medium">No interests yet</p>
                <p className="text-xs mt-1">
                  Browse projects and click &ldquo;Express Interest&rdquo; to
                  get matched
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects
                  .filter((p) =>
                    myCompany.preferredProjectIds.includes(p.id),
                  )
                  .map((p) => {
                    const isMatched =
                      selectedMatches[p.id] === myCompany.id;
                    return (
                      <div
                        key={p.id}
                        className={`bg-white rounded-2xl shadow-sm border p-5 ${
                          isMatched
                            ? "border-emerald-300"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-gray-800">
                                {p.title}
                              </h3>
                              <StatusBadge status={p.status} />
                              {isMatched && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                                  Matched!
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <p className="text-sm text-gray-500">
                                {p.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => toggleInterest(p.id)}
                            className="shrink-0 px-3 py-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Withdraw
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab === "notifications" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              Notifications
            </h2>
            {myNotifs.length === 0 ? (
              <div className="text-center py-24 text-gray-400">
                <p className="text-sm font-medium">No notifications yet</p>
                <p className="text-xs mt-1">
                  You&apos;ll be notified when a charity selects your company
                  for a project
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myNotifs.map((n, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl shadow-sm border border-emerald-200 px-5 py-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5 text-emerald-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        You&apos;ve been matched!
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        A charity has selected your company for{" "}
                        <span className="font-medium text-emerald-600">
                          &ldquo;{n.projectTitle}&rdquo;
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
