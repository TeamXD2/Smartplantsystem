import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus, X, KeyRound, UserX, UserCheck, Users as UsersIcon, SearchX, RefreshCw } from 'lucide-react';
import { fetchUsers, updateUser, createUser } from '../queries/users';
import { resetPassword } from '../queries/account';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { ROLES, BOTANIST_TYPES } from '../roles';
import { useDocumentTitle } from '../hooks';
import { runBulk, plural } from '../utils/bulk';
import { useUnsavedChanges } from '../useUnsavedChanges';
import { useTableView } from '../components/table/useTableView';
import { useSavedViews } from '../components/table/useSavedViews';
import { BulkBar, FilterSelect, Pager, RowCheck, SavedViewsMenu, SortTh, TableToolbar } from '../components/table/TableParts';
import PageHeader from '../components/ui/PageHeader';
import Field from '../components/ui/Field';
import Dialog from '../components/ui/Dialog';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { initialsOf } from '../components/shell/UserMenu';

const ROLE_LIST = Object.values(ROLES);
const NEW_ACCOUNT = { full_name: '', email: '', password: '', role_name: ROLES.BOTANIST, botanist_type: 'Internal' };
const SORTERS = {
  name: (u) => (u.full_name || '').toLowerCase(),
  role: (u) => u.role_name,
  status: (u) => (u.is_active ? 0 : 1),
};
const PRESETS = [
  { id: 'p-all', name: 'Everyone', state: { search: '', values: {} } },
  { id: 'p-active', name: 'Active accounts', state: { search: '', values: { status: 'active' } } },
  { id: 'p-inactive', name: 'Deactivated accounts', state: { search: '', values: { status: 'inactive' } } },
  { id: 'p-botanists', name: 'Botanists', state: { search: '', values: { role: ROLES.BOTANIST } } },
];

export default function UsersPage() {
  useDocumentTitle('Users');
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(NEW_ACCOUNT);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [progress, setProgress] = useState(null);

  const load = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const t = useTableView({
    rows: users,
    rowId: (u) => u.user_id,
    defaultSort: { key: 'name', dir: 'asc' },
    sorters: SORTERS,
    searchText: (u) => `${u.full_name} ${u.email}`,
    filters: {
      role: (u, v) => u.role_name === v,
      status: (u, v) => (v === 'active' ? u.is_active : !u.is_active),
    },
  });
  const saved = useSavedViews(`users_${user.user_id}`, PRESETS);

  const createDirty = creating && Boolean(form.full_name || form.email || form.password);
  useUnsavedChanges(createDirty && !busy);

  const selectable = useMemo(() => t.pageRows.filter((u) => u.user_id !== user.user_id), [t.pageRows, user.user_id]);

  async function run(action, success) {
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(err.message);
    }
    load();
  }

  async function changeRole(u, role_name) {
    if (role_name === u.role_name) return;
    const ok = await confirm({
      title: `Make ${u.full_name} ${role_name === ROLES.ADMIN ? 'an' : 'a'} ${role_name}?`,
      message: role_name === ROLES.ADMIN
        ? 'Admins can create accounts, reset passwords and read the audit log.'
        : role_name === ROLES.BOTANIST
          ? 'They start as an External Botanist (edits go through an Officer). You can switch them to Internal afterwards.'
          : 'Their permissions change the next time they use the app.',
      confirmLabel: 'Change role',
      tone: role_name === ROLES.ADMIN ? 'danger' : 'default',
    });
    if (!ok) { load(); return; }
    // A Botanist must be Internal or External - the backend refuses otherwise,
    // and there is deliberately no default (Internal has full edit rights).
    // Start as External (fewer rights); the Admin can switch it to Internal.
    if (role_name === ROLES.BOTANIST) {
      run(() => updateUser(u.user_id, { role_name, botanist_type: 'External' }), `${u.full_name} is now a Botanist (External).`);
    } else {
      run(() => updateUser(u.user_id, { role_name }), `${u.full_name} is now ${role_name === ROLES.ADMIN ? 'an' : 'a'} ${role_name}.`);
    }
  }

  function changeType(u, botanist_type) {
    run(() => updateUser(u.user_id, { botanist_type }), `${u.full_name} is now an ${botanist_type} Botanist.`);
  }

  async function setActive(u, active) {
    if (!active) {
      const ok = await confirm({
        title: `Deactivate ${u.full_name}?`,
        message: 'They are signed out and cannot log in until you reactivate the account. Their records stay.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return;
    }
    run(() => updateUser(u.user_id, { is_active: active }), active ? `${u.full_name} can log in again.` : `${u.full_name} was deactivated.`);
  }

  async function bulkActive(active) {
    const items = t.selectedRows.filter((u) => u.user_id !== user.user_id && u.is_active !== active);
    if (items.length === 0) {
      toast.info(active ? 'The selected accounts are already active.' : 'The selected accounts are already deactivated.');
      return;
    }
    if (!active) {
      const ok = await confirm({
        title: `Deactivate ${plural(items.length, 'account')}?`,
        message: 'They are signed out and cannot log in until you reactivate them.',
        details: <ul className="confirm-list">{items.slice(0, 5).map((u) => <li key={u.user_id}>{u.full_name}</li>)}{items.length > 5 && <li>and {items.length - 5} more</li>}</ul>,
        confirmLabel: `Deactivate ${items.length}`,
        tone: 'danger',
      });
      if (!ok) return;
    }
    setProgress({ done: 0, total: items.length });
    const { done, failed } = await runBulk(items, (u) => updateUser(u.user_id, { is_active: active }), (d, total) => setProgress({ done: d, total }));
    setProgress(null);
    t.clearSelection();
    await load();
    const verb = active ? 'Reactivated' : 'Deactivated';
    if (failed.length === 0) toast.success(`${verb} ${plural(done.length, 'account')}.`);
    else toast.error(`${verb} ${done.length} of ${items.length} accounts.`, { detail: `${failed.length} failed: ${failed[0].message}` });
  }

  async function submitReset(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await resetPassword(resetFor.user_id, tempPassword);
      toast.success(`Temporary password set for ${resetFor.email}.`, { detail: 'Share it with them privately.' });
      setResetFor(null);
      setTempPassword('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await createUser({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_name: form.role_name,
        botanist_type: form.role_name === ROLES.BOTANIST ? form.botanist_type : undefined,
      });
      toast.success(`Account created for ${form.email.trim()}.`, { detail: 'Share the temporary password with them privately.' });
      setForm(NEW_ACCOUNT);
      setCreating(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleCreate() {
    if (creating && createDirty) {
      const ok = await confirm({ title: 'Discard this new account?', message: 'What you typed has not been saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
      if (!ok) return;
      setForm(NEW_ACCOUNT);
    }
    setCreating((c) => !c);
  }

  const working = Boolean(progress);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Everyone who can sign in. There is no public sign-up: accounts are created here."
        actions={(
          <button type="button" className="btn btn-primary btn-sm" onClick={toggleCreate}>
            {creating ? <X size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />} {creating ? 'Close form' : 'Create account'}
          </button>
        )}
      />

      {error && (
        <div className="alert alert-error" role="alert">
          {error} <button type="button" className="link-btn" onClick={load}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
        </div>
      )}

      {creating && (
        <form className="panel panel-form" onSubmit={handleCreate}>
          <h2 className="panel-title">New account</h2>
          <div className="form-grid">
            <Field label="Full name"><input className="input" required maxLength={100} autoFocus value={form.full_name} onChange={(e) => updateForm('full_name', e.target.value)} /></Field>
            <Field label="Email"><input type="email" className="input" required maxLength={150} autoComplete="off" value={form.email} onChange={(e) => updateForm('email', e.target.value)} /></Field>
          </div>
          <div className="form-grid form-grid-3">
            <Field label="Temporary password" hint="8 to 72 characters. Share it with the person privately.">
              <input type="password" className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => updateForm('password', e.target.value)} />
            </Field>
            <Field label="Role">
              <select className="input" value={form.role_name} onChange={(e) => updateForm('role_name', e.target.value)}>
                {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            {form.role_name === ROLES.BOTANIST && (
              <Field label="Botanist type" hint="External botanists send edit requests instead of editing directly.">
                <select className="input" value={form.botanist_type} onChange={(e) => updateForm('botanist_type', e.target.value)}>
                  {BOTANIST_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
      )}

      <TableToolbar
        search={t.search}
        onSearch={t.setSearch}
        placeholder="Search name or email"
        searchLabel="Search users"
        activeFilters={t.activeFilters}
        onClear={t.clearFilters}
        views={(
          <SavedViewsMenu
            views={saved.views}
            onApply={t.applySnapshot}
            onSave={(name) => { const v = saved.save(name, t.snapshot()); if (v) toast.success(`View “${v.name}” saved on this browser.`); return v; }}
            onRemove={saved.remove}
            canSave={t.activeFilters > 0}
          />
        )}
      >
        <FilterSelect label="Role" allLabel="Any role" value={t.values.role} onChange={(v) => t.setFilter('role', v)} options={ROLE_LIST} />
        <FilterSelect label="Account status" allLabel="Any status" value={t.values.status} onChange={(v) => t.setFilter('status', v)} options={[['active', 'Active'], ['inactive', 'Deactivated']]} />
      </TableToolbar>

      <div className="list-meta"><span role="status">{loading ? 'Loading users…' : `${t.filtered.length} of ${t.total} users`}</span></div>

      {loading ? <SkeletonRows rows={6} columns={5} label="Loading users" /> : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">User accounts. Use the column headings to sort.</caption>
            <thead>
              <tr>
                <th scope="col" className="col-check">
                  <RowCheck
                    checked={selectable.length > 0 && selectable.every((u) => t.selected.has(u.user_id))}
                    indeterminate={selectable.some((u) => t.selected.has(u.user_id))}
                    onChange={() => {
                      const all = selectable.every((u) => t.selected.has(u.user_id));
                      selectable.forEach((u) => { if (all === t.selected.has(u.user_id)) t.toggleRow(u.user_id); });
                    }}
                    label="Select all users on this page"
                  />
                </th>
                <SortTh label="Person" sortKey="name" sort={t.sort} onSort={t.toggleSort} />
                <SortTh label="Role" sortKey="role" sort={t.sort} onSort={t.toggleSort} />
                <th scope="col" className="hide-md">Botanist type</th>
                <SortTh label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />
                <th scope="col" className="col-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {t.pageRows.map((u) => {
                const self = u.user_id === user.user_id;
                return (
                  <tr key={u.user_id} className={t.selected.has(u.user_id) ? 'is-selected' : ''}>
                    <td className="col-check">
                      <RowCheck checked={t.selected.has(u.user_id)} onChange={() => t.toggleRow(u.user_id)} label={self ? 'You cannot select your own account' : `Select ${u.full_name}`} />
                      {self && <span className="sr-only">(your account)</span>}
                    </td>
                    <td>
                      <div className="person-cell">
                        <span className="avatar avatar-sm" aria-hidden="true">{initialsOf(u)}</span>
                        <div>
                          <div className="cell-strong">{u.full_name}{self && <span className="you-tag">You</span>}</div>
                          <div className="cell-sub">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select className="input input-compact" aria-label={`Role for ${u.full_name}`} value={u.role_name} disabled={self} onChange={(e) => changeRole(u, e.target.value)}>
                        {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="hide-md">
                      {u.role_name === ROLES.BOTANIST ? (
                        <select className="input input-compact" aria-label={`Botanist type for ${u.full_name}`} value={u.botanist_type || ''} onChange={(e) => changeType(u, e.target.value)}>
                          {!u.botanist_type && <option value="" disabled>Not set</option>}
                          {BOTANIST_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td><span className={u.is_active ? 'tag tag-approved' : 'tag tag-rejected'}>{u.is_active ? 'Active' : 'Deactivated'}</span></td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <button type="button" className="btn btn-outline btn-sm" disabled={self} title={self ? 'Use My account to change your own password' : undefined} onClick={() => { setResetFor(u); setTempPassword(''); }}>
                          <KeyRound size={15} aria-hidden="true" /> Reset password
                        </button>
                        <button type="button" className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-outline'}`} disabled={self} onClick={() => setActive(u, !u.is_active)}>
                          {u.is_active ? <UserX size={15} aria-hidden="true" /> : <UserCheck size={15} aria-hidden="true" />} {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {t.filtered.length === 0 && !error && (
            t.total === 0
              ? <EmptyState icon={UsersIcon} title="No users yet">Create the first account with the button above.</EmptyState>
              : <EmptyState icon={SearchX} title="No users match these filters" action={<button type="button" className="btn btn-outline" onClick={t.clearFilters}>Clear filters</button>}>Try a different name or role.</EmptyState>
          )}
        </div>
      )}

      <BulkBar count={t.selected.size} matching={t.filtered.length} onSelectAll={t.selectAllMatching} onClear={t.clearSelection} busy={working} progress={progress}>
        <button type="button" className="btn btn-danger btn-sm" disabled={working} onClick={() => bulkActive(false)}><UserX size={15} aria-hidden="true" /> Deactivate</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={working} onClick={() => bulkActive(true)}><UserCheck size={15} aria-hidden="true" /> Reactivate</button>
      </BulkBar>

      <Pager page={t.page} pageSize={t.pageSize} total={t.filtered.length} onPage={t.setPage} onPageSize={t.setPageSize} noun="users" />

      <Dialog
        open={Boolean(resetFor)}
        onClose={() => setResetFor(null)}
        title={resetFor ? `Reset password for ${resetFor.full_name}` : ''}
        description="Set a temporary password and share it with them privately. They can change it from My account."
        size="sm"
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={() => setResetFor(null)}>Cancel</button>
            <button type="submit" form="reset-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Set temporary password'}</button>
          </>
        )}
      >
        <form id="reset-form" onSubmit={submitReset}>
          <Field label="Temporary password" hint="8 to 72 characters.">
            <input type="text" className="input" required minLength={8} maxLength={72} autoComplete="off" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} autoFocus />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
