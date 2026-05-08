export const calculateDeliveryRate = (issues) => {
  if (!issues || issues.length === 0) return 0;
  const completed = issues.filter(i => i?.fields?.status?.name === 'Done').length;
  return Math.round((completed / issues.length) * 100);
};

export const calculateQualityScore = (issues) => {
  if (!issues || issues.length === 0) return 0;
  const bugs = issues.filter(i => i?.fields?.issuetype?.name === 'Bug').length;
  const total = issues.length;
  return Math.round(((total - bugs) / total) * 100);
};

export const calculateTimeliness = (issue) => {
  if (!issue?.fields?.duedate) return 100;
  const dueDate = new Date(issue.fields.duedate);
  const today = new Date();
  return dueDate >= today ? 100 : 50;
};

export const calculateWorkHours = (worklogs) => {
  if (!worklogs || worklogs.length === 0) return 0;
  return worklogs.reduce((sum, log) => sum + (log.timeSpentSeconds / 3600), 0);
};

export const calculateCompletion = (issues) => {
  if (!issues || issues.length === 0) return 0;
  const done = issues.filter(i => i?.fields?.status?.name === 'Done').length;
  return Math.round((done / issues.length) * 100);
};

export const groupByEmployee = (issues) => {
  const grouped = {};
  issues.forEach(issue => {
    if (!issue?.fields?.assignee) return;
    const assignee = issue.fields.assignee?.displayName || 'Unassigned';
    if (!grouped[assignee]) {
      grouped[assignee] = [];
    }
    grouped[assignee].push(issue);
  });
  return grouped;
};

export const groupByProject = (issues) => {
  const grouped = {};
  issues.forEach(issue => {
    if (!issue?.fields?.project) return;
    const project = issue.fields.project.name;
    if (!grouped[project]) {
      grouped[project] = [];
    }
    grouped[project].push(issue);
  });
  return grouped;
};
