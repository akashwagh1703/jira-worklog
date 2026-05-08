import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listUsers, upsertUser, updateUser, deleteUser } from '../services/authService';

const ROLES = ['admin', 'manager', 'employee'];

const AdminUsersPage = () => {
  const { user: me, loading: meLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [draft, setDraft] = useState({ email: '', displayName: '', role: 'employee', scope: '*' });

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listUsers();
      if (res?.success === false) {
        setError(res.message || 'Failed to load users');
        setUsers([]);
      } else {
        setUsers(res?.users || []);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!meLoading && me?.role === 'admin') refresh();
  }, [meLoading, me]);

  if (meLoading) return null;

  if (me?.role !== 'admin') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <p className="text-gray-600">You need admin access to view this page.</p>
        <p className="text-xs text-gray-400 mt-2">
          (Phase 3 enforces role server-side via the SSO session. If you logged in via the legacy form, log in via SSO to access admin features.)
        </p>
      </div>
    );
  }

  const formatScope = (scope) => {
    if (!scope || scope.projects === '*' || (Array.isArray(scope.projects) && scope.projects.length === 0)) {
      return <span className="text-xs text-gray-500">All projects</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {scope.projects.map((p) => (
          <span key={p} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{p}</span>
        ))}
      </div>
    );
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const projects = draft.scope.trim() === '' || draft.scope.trim() === '*'
        ? '*'
        : draft.scope.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await upsertUser({
        email:       draft.email.trim().toLowerCase(),
        displayName: draft.displayName.trim() || draft.email,
        role:        draft.role,
        scope:       { projects },
      });
      if (res?.success === false) {
        setError(res.message || 'Failed to save');
        return;
      }
      setMessage(`Saved ${draft.email}`);
      setDraft({ email: '', displayName: '', role: 'employee', scope: '*' });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const handleRoleChange = async (email, role) => {
    setError(null);
    try {
      const res = await updateUser(email, { role });
      if (res?.success === false) {
        setError(res.message || 'Failed');
        return;
      }
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const handleScopeChange = async (email, raw) => {
    setError(null);
    try {
      const projects = raw.trim() === '' || raw.trim() === '*'
        ? '*'
        : raw.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await updateUser(email, { scope: { projects } });
      if (res?.success === false) {
        setError(res.message || 'Failed');
        return;
      }
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const handleDelete = async (email) => {
    if (!confirm(`Delete ${email}? They will lose access on next session check.`)) return;
    setError(null);
    try {
      const res = await deleteUser(email);
      if (res?.success === false) {
        setError(res.message || 'Failed');
        return;
      }
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage who can access the dashboard. Each user gets a role and an optional project scope.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 text-sm space-y-2">
        <div className="font-medium">How scope works (Phase 4)</div>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li><span className="font-mono">*</span> = all projects (full access — admins typically use this).</li>
          <li>
            Otherwise, comma-separate Jira project KEYS or NAMES (e.g.{' '}
            <span className="font-mono">FAMRUT, FMRT, OCAC-FUP</span>). Managers will only see issues, employees, and worklogs in those projects.
          </li>
          <li>
            Scope is enforced server-side: any JQL the user sends is intersected with their scope before it reaches Jira.
            Out-of-scope issue keys are silently filtered (and logged to the audit trail).
          </li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{error}</div>
      )}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">{message}</div>
      )}

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Add or update a user</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="user@esds.co.in"
            required
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <input
            type="text"
            value={draft.displayName}
            onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
            placeholder="Display name (optional)"
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            type="text"
            value={draft.scope}
            onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
            placeholder='Projects (e.g. "FAMRUT,FMRT" or "*")'
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            Save user
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">All users ({users.length})</h3>
          <button onClick={refresh} disabled={loading} className="text-sm text-blue-600 hover:text-blue-800">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    {loading ? 'Loading…' : 'No users yet. Add one above.'}
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.email}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.displayName}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.email, e.target.value)}
                      disabled={u.email === me.email}
                      className="px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-100"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <ScopeEditor
                      initial={u.scope}
                      onSave={(raw) => handleScopeChange(u.email, raw)}
                      formatted={formatScope(u.scope)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(u.email)}
                      disabled={u.email === me.email}
                      className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:hover:text-gray-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ScopeEditor = ({ initial, onSave, formatted }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(
    !initial || initial.projects === '*' ? '*' : (initial.projects || []).join(', ')
  );

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-left">
        {formatted} <span className="text-xs text-blue-600 ml-1">edit</span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="px-2 py-1 border border-gray-200 rounded text-sm w-64"
        placeholder='"*" or "FAMRUT,FMRT"'
      />
      <button
        type="button"
        onClick={async () => { await onSave(value); setEditing(false); }}
        className="text-sm text-blue-600"
      >
        save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-sm text-gray-500"
      >
        cancel
      </button>
    </div>
  );
};

export default AdminUsersPage;
