// Single source of truth for which Jira projects this dashboard reports on.
//
// Phase 1 storage: browser localStorage (admin-editable in Settings -> Allowed Projects).
// Phase 2+ will replace this with a backend-driven, per-manager scope (DB).
//
// Empty list / null === no restriction, show all projects the user has access to.

const STORAGE_KEY = 'allowedProjects';

// Backwards-compatible default: the original Famrut team's 7 projects.
// On a fresh install, this seeds the dashboard so behavior matches the old hardcoded list.
// Admins can edit this in Settings.
export const DEFAULT_ALLOWED_PROJECTS = [
  'ANE-2.0–VCCO-Advancing North East-2.0',
  'FAMRUT',
  'FMRT',
  'OCAC-FUP',
  'OCACFUP',
  'NERACE_NEDFI',
  'NERACE',
];

export const getAllowedProjects = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fall through to default on JSON parse errors
  }
  return DEFAULT_ALLOWED_PROJECTS;
};

export const setAllowedProjects = (projects) => {
  const arr = Array.isArray(projects) ? projects : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
};

export const resetAllowedProjects = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// Build a JQL `project IN (...)` clause from the configured list.
// Returns '' when there is no restriction so callers can safely concatenate.
export const buildProjectJqlClause = () => {
  const projects = getAllowedProjects();
  if (!projects || projects.length === 0) return '';
  const escaped = projects.map((p) => p.replace(/"/g, '\\"'));
  return `project IN ("${escaped.join('", "')}")`;
};

// True when a Jira project (by name) is part of the configured scope.
// When scope is empty/null we treat everything as in-scope.
export const isProjectAllowed = (projectName) => {
  const projects = getAllowedProjects();
  if (!projects || projects.length === 0) return true;
  return projects.includes(projectName);
};
