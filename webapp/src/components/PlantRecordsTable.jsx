import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, X, Eye, History, Trash2, Download, Globe2, EyeOff, Database, SearchX, Pencil, Leaf, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAllPlants } from '../queries/usePlants';
import { registerPlant, deletePlant, setVisibility } from '../queries/plants';
import { submitRequest } from '../queries/requests';
import { relativeTime, exactTime } from '../hooks';
import { downloadCsv } from '../utils/csv';
import { PLANT_COLUMNS } from '../utils/exportColumns';
import { runBulk, plural } from '../utils/bulk';
import { useTableView } from './table/useTableView';
import { useSavedViews } from './table/useSavedViews';
import { BulkBar, FilterChip, FilterSelect, Pager, RowCheck, SavedViewsMenu, SortTh, TableToolbar } from './table/TableParts';
import RowMenu from './table/RowMenu';
import PlantForm from './PlantForm';
import EditPanel from './EditPanel';
import PublishPanel from './PublishPanel';
import HistoryPanel from './HistoryPanel';
import BulkPublishDialog from './BulkPublishDialog';
import StatusTag from './StatusTag';
import SpecimenName from './ui/SpecimenName';
import EmptyState from './ui/EmptyState';
import { SkeletonRows } from './ui/Skeleton';

const NONE = '__none';
const SORTERS = {
  name: (r) => (r.common_name || r.scientific_name || '').toLowerCase(),
  family: (r) => r.family,
  by: (r) => r.registered_by_name,
  status: (r) => r.publication_status,
  updated: (r) => (r.updated_at ? new Date(r.updated_at).getTime() : null),
};
const DEFAULT_SORT = { key: 'updated', dir: 'desc' };

const distinct = (rows, key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

// variant="staff":    Officer / Admin - every record; publish, edit, delete directly.
// variant="botanist": a Botanist's own records; edit (directly or as a request,
//                     depending on Internal / External) and request deletion.
// All permission rules live in the backend; this only chooses which buttons to show.
export default function PlantRecordsTable({ variant = 'staff' }) {
  const staff = variant === 'staff';
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const { rows, loading, error, capped, reload } = useAllPlants({ mine: !staff });

  const [open, setOpen] = useState(null); // { id, kind: 'edit' | 'publish' | 'history' }
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total } while a bulk action runs
  const panelDirty = useRef(false);
  const addDirty = useRef(false);

  const t = useTableView({
    rows,
    rowId: (r) => r.plant_id,
    defaultSort: DEFAULT_SORT,
    sorters: SORTERS,
    initialSearch: params.get('q') || '',
    initialFilters: params.get('status') ? { status: params.get('status') } : {},
    searchText: (r) => [r.scientific_name, r.common_name, r.family, r.genus, r.species, r.qr_code, r.registered_by_name].filter(Boolean).join(' '),
    filters: {
      status: (r, v) => r.publication_status === v,
      family: (r, v) => (v === NONE ? !r.family : r.family === v),
      conservation: (r, v) => (v === NONE ? !r.conservation_status : r.conservation_status === v),
      location: (r, v) => r.location_visibility === v,
      by: (r, v) => r.registered_by_name === v,
      noPhoto: (r) => !r.cover_photo_url,
      noGps: (r) => r.latitude == null || r.longitude == null,
    },
  });

  // Links from the dashboard, the search palette and "Add record" arrive as ?q= / ?status= / ?new=1.
  const paramKey = params.toString();
  useEffect(() => {
    const q = params.get('q') || '';
    const status = params.get('status') || '';
    if (q !== t.search) t.setSearch(q);
    if (status !== (t.values.status || '')) t.setFilter('status', status);
    if (params.get('new') === '1' && staff) {
      setAdding(true);
      const p = new URLSearchParams(params);
      p.delete('new');
      setParams(p, { replace: true });
    }
  }, [paramKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const presets = useMemo(() => (staff
    ? [
      { id: 'p-all', name: 'All records', state: { search: '', values: {} } },
      { id: 'p-research', name: 'Needs publishing', state: { search: '', values: { status: 'Under Research' } } },
      { id: 'p-published', name: 'Published', state: { search: '', values: { status: 'Published' } } },
      { id: 'p-nophoto', name: 'Missing a photo', state: { search: '', values: { noPhoto: true } } },
      { id: 'p-nogps', name: 'Missing GPS', state: { search: '', values: { noGps: true } } },
    ]
    : [
      { id: 'p-all', name: 'All my records', state: { search: '', values: {} } },
      { id: 'p-research', name: 'Waiting to be published', state: { search: '', values: { status: 'Under Research' } } },
      { id: 'p-nophoto', name: 'Missing a photo', state: { search: '', values: { noPhoto: true } } },
      { id: 'p-nogps', name: 'Missing GPS', state: { search: '', values: { noGps: true } } },
    ]), [staff]);
  const saved = useSavedViews(`records_${staff ? 'staff' : 'botanist'}_${user.user_id}`, presets);

  const families = useMemo(() => distinct(rows, 'family'), [rows]);
  const statuses = useMemo(() => distinct(rows, 'conservation_status'), [rows]);
  const people = useMemo(() => distinct(rows, 'registered_by_name'), [rows]);

  // ---- opening and closing the row panels, without losing unsaved edits
  async function guardDirty() {
    if (!panelDirty.current) return true;
    const ok = await confirm({
      title: 'Discard your changes?',
      message: 'The record you are editing has changes that are not saved yet.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    });
    if (ok) panelDirty.current = false;
    return ok;
  }

  async function toggle(id, kind) {
    const same = open && open.id === id && open.kind === kind;
    if (open && open.kind === 'edit' && !(await guardDirty())) return;
    setOpen(same ? null : { id, kind });
  }

  async function toggleAdd() {
    if (adding && addDirty.current) {
      const ok = await confirm({ title: 'Discard this new record?', message: 'What you typed has not been saved yet.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
      if (!ok) return;
    }
    setAdding((a) => !a);
  }

  async function finished(message) {
    panelDirty.current = false;
    setOpen(null);
    await reload();
    toast.success(message);
  }

  // ---- single-record actions
  async function remove(plant) {
    const name = plant.common_name || plant.scientific_name;
    const ok = await confirm({
      title: staff ? `Delete “${name}”?` : `Request deletion of “${name}”?`,
      message: staff
        ? 'The record and its photos are removed for good. This cannot be undone.'
        : 'An Officer will review your request. The record stays until they approve it.',
      confirmLabel: staff ? 'Delete record' : 'Send request',
      tone: staff ? 'danger' : 'default',
    });
    if (!ok) return;
    try {
      if (staff) await deletePlant(plant.plant_id); else await submitRequest({ plantId: plant.plant_id, type: 'DELETE' });
      await reload();
      toast.success(staff ? 'Record deleted.' : 'Deletion request sent. An Officer will review it.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function addRecord(payload, imageFile) {
    const result = await registerPlant(payload, imageFile);
    reload();
    return result;
  }

  // ---- bulk actions
  function report(verb, { done, failed }, total) {
    if (failed.length === 0) {
      toast.success(`${verb} ${plural(done.length, 'record')}.`);
    } else {
      toast.error(`${verb} ${done.length} of ${total} records.`, { detail: `${failed.length} failed: ${failed[0].message}` });
    }
  }

  async function bulk(action, verb, items = t.selectedRows) {
    setProgress({ done: 0, total: items.length });
    const result = await runBulk(items, action, (done, total) => setProgress({ done, total }));
    setProgress(null);
    t.clearSelection();
    await reload();
    report(verb, result, items.length);
  }

  function exportSelected() {
    downloadCsv(`species-selected-${new Date().toISOString().slice(0, 10)}.csv`, PLANT_COLUMNS, t.selectedRows);
    toast.success(`Exported ${plural(t.selectedRows.length, 'record')} to CSV.`);
  }

  function bulkPublish({ location, area }) {
    setPublishing(false);
    bulk((r) => setVisibility(r.plant_id, {
      publication_status: 'Published',
      location_visibility: location,
      general_location: location === 'Approximate' ? area : r.general_location || null,
    }), 'Published');
  }

  async function bulkUnpublish() {
    const n = t.selectedRows.length;
    const ok = await confirm({
      title: `Unpublish ${plural(n, 'record')}?`,
      message: 'They disappear from the public catalog and go back to Under Research. Visitors with a QR code will no longer see them.',
      confirmLabel: 'Unpublish',
    });
    if (!ok) return;
    bulk((r) => setVisibility(r.plant_id, { publication_status: 'Under Research', location_visibility: r.location_visibility || 'Hidden', general_location: r.general_location || null }), 'Unpublished');
  }

  async function bulkDelete() {
    const items = t.selectedRows;
    const names = items.slice(0, 5).map((r) => r.common_name || r.scientific_name);
    const ok = await confirm({
      title: staff ? `Delete ${plural(items.length, 'record')}?` : `Request deletion of ${plural(items.length, 'record')}?`,
      message: staff ? 'These records and their photos are removed for good. This cannot be undone.' : 'An Officer reviews each request. The records stay until they approve.',
      details: <ul className="confirm-list">{names.map((n) => <li key={n}>{n}</li>)}{items.length > 5 && <li>and {items.length - 5} more</li>}</ul>,
      confirmLabel: staff ? `Delete ${items.length}` : `Send ${items.length} requests`,
      tone: staff ? 'danger' : 'default',
    });
    if (!ok) return;
    bulk((r) => (staff ? deletePlant(r.plant_id) : submitRequest({ plantId: r.plant_id, type: 'DELETE' })), staff ? 'Deleted' : 'Requested deletion of', items);
  }

  const columns = staff ? 7 : 6;
  const busy = Boolean(progress);
  const anyPublished = t.selectedRows.some((r) => r.publication_status === 'Published');
  const anyResearch = t.selectedRows.some((r) => r.publication_status !== 'Published');

  const addButton = staff && (
    <button type="button" className="btn btn-primary btn-sm" onClick={toggleAdd}>
      {adding ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} {adding ? 'Close form' : 'Add record'}
    </button>
  );

  return (
    <div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error} <button type="button" className="link-btn" onClick={reload}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
        </div>
      )}

      {staff && adding && (
        <div className="panel panel-form">
          <h2 className="panel-title">New species record</h2>
          <PlantForm submitLabel="Add record" onSubmit={addRecord} onDirtyChange={(d) => { addDirty.current = d; }} />
        </div>
      )}

      <TableToolbar
        search={t.search}
        onSearch={t.setSearch}
        placeholder="Search name, family, QR code or botanist"
        searchLabel="Search records"
        activeFilters={t.activeFilters}
        onClear={t.clearFilters}
        views={(
          <SavedViewsMenu
            views={saved.views}
            onApply={t.applySnapshot}
            onSave={(name) => { const v = saved.save(name, t.snapshot()); if (v) toast.success(`View “${v.name}” saved on this browser.`); return v; }}
            onRemove={saved.remove}
            canSave={t.activeFilters > 0 || t.sort !== DEFAULT_SORT}
          />
        )}
      >
        <FilterSelect label="Status" allLabel="All statuses" value={t.values.status} onChange={(v) => t.setFilter('status', v)} options={['Under Research', 'Published']} />
        <FilterSelect label="Family" allLabel="All families" value={t.values.family} onChange={(v) => t.setFilter('family', v)} options={[...families, [NONE, 'No family set']]} />
        <FilterSelect label="Conservation status" allLabel="All conservation" value={t.values.conservation} onChange={(v) => t.setFilter('conservation', v)} options={[...statuses, [NONE, 'Not assessed']]} />
        {staff && <FilterSelect label="Location shown" allLabel="All locations" value={t.values.location} onChange={(v) => t.setFilter('location', v)} options={['Hidden', 'Approximate', 'Public']} />}
        {staff && <FilterSelect label="Registered by" allLabel="Anyone" value={t.values.by} onChange={(v) => t.setFilter('by', v)} options={people} />}
        <FilterChip label="Missing photo" active={Boolean(t.values.noPhoto)} onChange={(v) => t.setFilter('noPhoto', v)} />
        <FilterChip label="Missing GPS" active={Boolean(t.values.noGps)} onChange={(v) => t.setFilter('noGps', v)} />
      </TableToolbar>

      <div className="list-meta">
        <span role="status">{loading && rows.length === 0 ? 'Loading records…' : `${t.filtered.length} of ${t.total} records`}</span>
        {capped && <span className="muted">Showing the first 2,000 records.</span>}
        {addButton}
      </div>

      {loading && rows.length === 0 ? (
        <SkeletonRows rows={7} columns={5} label="Loading records" />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="data-table records-table">
            <caption className="sr-only">{staff ? 'Species records' : 'My species records'}. Use the column headings to sort.</caption>
            <thead>
              <tr>
                <th scope="col" className="col-check"><RowCheck checked={t.allOnPage} indeterminate={t.someOnPage} onChange={t.togglePage} label="Select all records on this page" /></th>
                <SortTh label="Species" sortKey="name" sort={t.sort} onSort={t.toggleSort} />
                <SortTh label="Family" sortKey="family" sort={t.sort} onSort={t.toggleSort} className="hide-sm" />
                {staff && <SortTh label="Registered by" sortKey="by" sort={t.sort} onSort={t.toggleSort} className="hide-md" />}
                <SortTh label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} className="hide-sm" />
                <SortTh label="Updated" sortKey="updated" sort={t.sort} onSort={t.toggleSort} className="hide-md" />
                <th scope="col" className="col-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {t.pageRows.map((p) => {
                const isOpen = open && open.id === p.plant_id;
                const name = p.common_name || p.scientific_name;
                return (
                  <Fragment key={p.plant_id}>
                    <tr className={t.selected.has(p.plant_id) ? 'is-selected' : ''}>
                      <td className="col-check"><RowCheck checked={t.selected.has(p.plant_id)} onChange={() => t.toggleRow(p.plant_id)} label={`Select ${name}`} /></td>
                      <td>
                        <div className="record-cell">
                          {p.cover_photo_url
                            ? <img className="thumb" src={p.cover_photo_url} alt="" width="44" height="44" loading="lazy" />
                            : <span className="thumb thumb-empty" title="No photo yet"><Leaf size={18} aria-hidden="true" /></span>}
                          <div>
                            <SpecimenName common={p.common_name} scientific={p.scientific_name} qr={p.qr_code} />
                            <div className="show-sm status-inline"><StatusTag status={p.publication_status} /></div>
                          </div>
                        </div>
                      </td>
                      <td className="hide-sm">{p.family || <span className="muted">—</span>}</td>
                      {staff && <td className="hide-md">{p.registered_by_name}</td>}
                      <td className="hide-sm">
                        <StatusTag status={p.publication_status} />
                        {p.publication_status === 'Published' && <div className="cell-sub">Location: {p.location_visibility}</div>}
                      </td>
                      <td className="hide-md"><time dateTime={p.updated_at} title={exactTime(p.updated_at)}>{relativeTime(p.updated_at)}</time></td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <button type="button" className="btn btn-outline btn-sm" aria-expanded={isOpen && open.kind === 'edit'} aria-label={`${isOpen && open.kind === 'edit' ? 'Close editor for' : 'Edit'} ${name}`} onClick={() => toggle(p.plant_id, 'edit')}>
                            {isOpen && open.kind === 'edit' ? <X size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />} <span className="btn-label">{isOpen && open.kind === 'edit' ? 'Close' : 'Edit'}</span>
                          </button>
                          <RowMenu
                            label={`More actions for ${name}`}
                            items={[
                              staff && { label: p.publication_status === 'Published' ? 'Visibility' : 'Publish', icon: p.publication_status === 'Published' ? Eye : Globe2, onClick: () => toggle(p.plant_id, 'publish') },
                              { label: 'History', icon: History, onClick: () => toggle(p.plant_id, 'history') },
                              { label: staff ? 'Delete' : 'Request deletion', icon: Trash2, danger: true, onClick: () => remove(p) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="panel-row">
                        <td colSpan={columns}>
                          {open.kind === 'edit' && <EditPanel plantId={p.plant_id} onDone={finished} onDirtyChange={(d) => { panelDirty.current = d; }} />}
                          {open.kind === 'publish' && <PublishPanel plant={p} onDone={finished} />}
                          {open.kind === 'history' && <HistoryPanel plantId={p.plant_id} />}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {t.filtered.length === 0 && !loading && !error && (
            t.total === 0 ? (
              <EmptyState
                icon={Database}
                title={staff ? 'No species records yet' : 'You have not registered any plants yet'}
                action={staff ? <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Add the first record</button> : <Link to="/register" className="btn btn-primary"><Plus size={16} aria-hidden="true" /> Register a plant</Link>}
              >
                {staff ? 'Botanists register plants in the field. You can also add one here.' : 'Registered plants appear here with their status.'}
              </EmptyState>
            ) : (
              <EmptyState icon={SearchX} title="No records match these filters" action={<button type="button" className="btn btn-outline" onClick={t.clearFilters}>Clear filters</button>}>
                Try removing a filter, or search for a different name.
              </EmptyState>
            )
          )}
        </div>
      )}

      <BulkBar count={t.selected.size} matching={t.filtered.length} onSelectAll={t.selectAllMatching} onClear={t.clearSelection} busy={busy} progress={progress}>
        {staff && anyResearch && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => setPublishing(true)}><Globe2 size={15} aria-hidden="true" /> Publish</button>}
        {staff && anyPublished && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={bulkUnpublish}><EyeOff size={15} aria-hidden="true" /> Unpublish</button>}
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={exportSelected}><Download size={15} aria-hidden="true" /> Export CSV</button>
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={bulkDelete}><Trash2 size={15} aria-hidden="true" /> {staff ? 'Delete' : 'Request deletion'}</button>
      </BulkBar>

      <Pager page={t.page} pageSize={t.pageSize} total={t.filtered.length} onPage={t.setPage} onPageSize={t.setPageSize} />
      <BulkPublishDialog open={publishing} count={t.selectedRows.length} onClose={() => setPublishing(false)} onConfirm={bulkPublish} />
    </div>
  );
}
