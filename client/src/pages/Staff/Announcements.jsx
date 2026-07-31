import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import PageLayout from '../../components/layout/PageLayout';
import { UserContext } from '../../../context/userContext';
import { useSidebarStore } from '../../../context/sidebarStore';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Image as ImgIcon, Pin, Search, MoreVertical } from 'lucide-react';

function Badge({ children, color = 'gray' }) {
  const bg = color === 'green' ? 'bg-green-100 text-green-800' : color === 'orange' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bg}`}>{children}</span>;
}

export default function Announcements() {
  const { user } = useContext(UserContext);
  const { selectedDivision, setSelectedDivision } = useSidebarStore();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const activeDivision = selectedDivision || 'All';
  const [divisions, setDivisions] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Composer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', priority: 'Normal', pinned: false, publishNow: true, scheduledAt: '', division_id: '' });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      // Staff should see all announcements (published + drafts + scheduled)
      const res = await axios.get('/api/announcements?published=false&limit=200');
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const fetchDivisions = async () => {
    try {
      const res = await axios.get('/api/inventory/divisions');
      const active = Array.isArray(res.data)
        ? res.data.filter((division) => (division.status || 'Active').toLowerCase() !== 'inactive')
        : [];
      setDivisions(active);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchDivisions();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-announcement-menu]')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeDivisionId = useMemo(() => {
    if (activeDivision === 'All') return '';
    return divisions.find((division) => (division.name || '').toLowerCase() === activeDivision.toLowerCase())?.id || '';
  }, [activeDivision, divisions]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      // If a specific division tab is active, show that division's announcements
      // plus any global announcements (those without a division assigned).
      if (activeDivision !== 'All') {
        const isGlobal = !it.division_id && !(it.division_name);
        const matchesDivision = (it.division_name || '').toLowerCase() === activeDivision.toLowerCase();
        if (!isGlobal && !matchesDivision) return false;
      }
      if (query && !(it.title||'').toLowerCase().includes(query.toLowerCase()) && !(it.content||'').toLowerCase().includes(query.toLowerCase())) return false;
      if (statusFilter === 'published' && !it.is_published) return false;
      if (statusFilter === 'scheduled' && !(it.published_at && !it.is_published)) return false;
      if (statusFilter === 'draft' && (it.is_published || it.published_at)) return false;
      if (priorityFilter !== 'all' && it.priority !== priorityFilter) return false;
      return true;
    }).sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0) || new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));
  }, [items, query, statusFilter, priorityFilter, activeDivision]);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', content: '', priority: 'Normal', pinned: false, publishNow: true, scheduledAt: '', division_id: '' });
    setImageFile(null);
    setPreviewUrl(null);
    setIsModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      title: item.title || '',
      content: item.content || '',
      priority: item.priority || 'Normal',
      pinned: !!item.pinned,
      publishNow: !!item.is_published,
      scheduledAt: item.published_at ? new Date(item.published_at).toISOString().slice(0,16) : '',
      division_id: item.division_id || '',
    });
    setPreviewUrl(item.image_url || null);
    setIsModalOpen(true);
  }

  function onFileChange(e) {
    const f = e.target.files?.[0] || null;
    setImageFile(f);
    if (f) setPreviewUrl(URL.createObjectURL(f));
  }

  async function submitForm(e) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('content', form.content || '');
      fd.append('priority', form.priority || 'Normal');
      fd.append('pinned', form.pinned ? 'true' : 'false');
      const divisionId = editing ? form.division_id : activeDivisionId;
      fd.append('division_id', divisionId || '');

      if (form.publishNow) {
        fd.append('is_published', 'true');
      } else if (form.scheduledAt) {
        fd.append('is_published', 'false');
        fd.append('published_at', new Date(form.scheduledAt).toISOString());
      } else {
        fd.append('is_published', 'false');
      }

      if (imageFile) fd.append('image', imageFile);

      if (editing) {
        await axios.put(`/api/announcements/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Announcement updated');
      } else {
        await axios.post('/api/announcements', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Announcement created');
      }
      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Save failed');
    }
  }

  async function removeItem(id) {
    if (!confirm('Delete this announcement?')) return;
    setProcessingId(id);
    try {
      await axios.delete(`/api/announcements/${id}`);
      toast.success('Deleted');
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setProcessingId(null);
    }
  }

  async function togglePublish(item) {
    setProcessingId(item.id);
    try {
      const fields = { is_published: item.is_published ? false : true };
      if (!item.is_published) fields.published_at = new Date().toISOString();
      await axios.put(`/api/announcements/${item.id}`, fields);
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update publish status');
    } finally {
      setProcessingId(null);
    }
  }

  async function togglePin(item) {
    setProcessingId(item.id);
    try {
      await axios.put(`/api/announcements/${item.id}`, { pinned: !item.pinned });
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update pin status');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <PageLayout title="Announcements">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low dark:border-gray-700 dark:bg-[#222] p-1 shadow-sm">
          {['All','Dulimbay','Budjong','Kayam'].map((tab) => {
            const isActive = activeDivision === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedDivision(tab)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${isActive ? 'bg-primary text-white shadow-sm dark:bg-blue-600' : 'text-on-surface-variant hover:bg-surface-container-high dark:text-gray-300 dark:hover:bg-[#2a2a2a]'}`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {user?.role === 'staff' && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={openCreate}
              disabled={activeDivision === 'All'}
              className="btn btn-primary inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="mr-2" />
              Create Announcement
            </button>
           
          </div>
        )}
      </div>

      <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 shadow-sm mb-4 dark:border-gray-700 dark:bg-[#222]">
        <div className="grid gap-4 lg:grid-cols-[1.8fr_auto]">
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              placeholder="Search announcements"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-10 w-full bg-transparent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="select">
              <option value="all">All priorities</option>
              <option value="Normal">Normal</option>
              <option value="Important">Important</option>
              <option value="Urgent">Urgent</option>
            </select>
            
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="hidden grid-cols-[1.8fr_120px_100px_100px_160px] gap-4 rounded-t-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-xs uppercase tracking-[0.12em] text-on-surface-variant md:grid">
          <div>Announcement</div>
          <div>Division</div>
          <div>Priority</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 h-28" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-8 text-center">
            <div className="text-xl font-semibold mb-2">No announcements yet</div>
            <div className="text-sm text-on-surface-variant mb-4">Create your first announcement to keep the community informed.</div>
            {user?.role === 'staff' && (
              <button onClick={openCreate} className="btn btn-primary inline-flex items-center"><Plus className="mr-2"/>Create Announcement</button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((it) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.18 }}
              className="grid gap-4 rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 shadow-sm hover:shadow-md transition dark:border-gray-700 dark:bg-[#222] md:grid-cols-[1.8fr_120px_100px_100px_160px]"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-surface-container-high dark:bg-[#2a2a2a] flex-shrink-0">
                  {it.author?.profile_pic_url ? (
                    <img src={it.author.profile_pic_url} alt={it.author?.name} className="h-full w-full object-cover" />
                  ) : it.image_url ? (
                    <img src={it.image_url} alt={it.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-on-surface-variant"><ImgIcon className="w-5 h-5"/></div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface truncate">{it.title}</p>
                  <p className="mt-1 text-sm text-on-surface-variant line-clamp-2">{it.content || 'No description provided.'}</p>
                  <div className="mt-1 text-xs text-on-surface-variant">
                    by {it.author?.name || 'Unknown'} • {new Date(it.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="text-sm text-on-surface">{it.division_name || 'Unassigned'}</div>
              <div>
                {it.priority === 'Urgent' ? <Badge color="orange">Urgent</Badge> : it.priority === 'Important' ? <Badge color="orange">Important</Badge> : <Badge>{it.priority || 'Normal'}</Badge>}
              </div>
              <div>
                {it.is_published ? <Badge color="green">Published</Badge> : it.published_at ? <Badge color="orange">Scheduled</Badge> : <Badge>Draft</Badge>}
                {it.published_at && <div className="mt-2 text-xs text-on-surface-variant">{new Date(it.published_at).toLocaleDateString()}</div>}
              </div>
              <div className="flex items-center justify-end gap-2">
                
                <button
                  type="button"
                  onClick={() => togglePublish(it)}
                  disabled={processingId === it.id}
                  className={`btn btn-sm ${it.is_published ? 'btn-secondary' : 'btn-primary'} ${processingId === it.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                  title={it.is_published ? 'Unpublish announcement' : 'Publish announcement'}
                >
                  {it.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <div className="relative" data-announcement-menu>
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === it.id ? null : it.id)}
                    className="btn btn-ghost btn-sm p-2"
                    title="More actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {openMenuId === it.id && (
                    <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-lg border border-outline-variant/20 bg-surface-container-low p-2 shadow-lg dark:border-gray-700 dark:bg-[#222]">
                      <button
                        type="button"
                        onClick={() => { openEdit(it); setOpenMenuId(null); }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high dark:hover:bg-[#2a2a2a]"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { togglePin(it); setOpenMenuId(null); }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high dark:hover:bg-[#2a2a2a]"
                      >
                        <Pin className="h-4 w-4" />
                        {it.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { removeItem(it.id); setOpenMenuId(null); }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-[#3b1717]"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Composer modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={submitForm} className="bg-white p-6 rounded w-[800px] max-w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{editing ? 'Edit' : 'Create'} Announcement</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-600">Close</button>
            </div>
            <div className="space-y-3">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="input w-full" />
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Content" className="textarea w-full" rows={6} />
              <div className="flex flex-wrap gap-3 items-center">
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="select">
                  <option>Normal</option>
                  <option>Important</option>
                  <option>Urgent</option>
                </select>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin</label>
                <label className="flex items-center gap-2"><input type="radio" name="publishMode" checked={form.publishNow} onChange={() => setForm({ ...form, publishNow: true, scheduledAt: '' })} /> Publish now</label>
                <label className="flex items-center gap-2"><input type="radio" name="publishMode" checked={!form.publishNow} onChange={() => setForm({ ...form, publishNow: false })} /> Schedule</label>
                {!form.publishNow && (
                  <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input" />
                )}
              </div>
              <div className="flex items-center gap-4">
                <input type="file" accept="image/*" onChange={onFileChange} />
                {previewUrl && <img src={previewUrl} alt="preview" className="w-32 h-20 object-cover rounded" />}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn">Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </PageLayout>
  );
}
