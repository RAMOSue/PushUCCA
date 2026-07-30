import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import PageLayout from '../../components/layout/PageLayout';
import { UserContext } from '../../../context/userContext';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Image as ImgIcon, Pin, Calendar as CalendarIcon, Search, Filter } from 'lucide-react';

function StatCard({ label, value }) {
  return (
    <div className="p-4 bg-surface-container-lowest rounded-md shadow-sm">
      <div className="text-sm text-on-surface-variant">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Badge({ children, color = 'gray' }) {
  const bg = color === 'green' ? 'bg-green-100 text-green-800' : color === 'orange' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bg}`}>{children}</span>;
}

export default function Announcements() {
  const { user } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Composer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', priority: 'Normal', pinned: false, publishNow: true, scheduledAt: '' });
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

  useEffect(() => { fetchAnnouncements(); }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const published = items.filter(i => i.is_published).length;
    const scheduled = items.filter(i => !i.is_published && i.published_at).length;
    const drafts = items.filter(i => !i.is_published && !i.published_at).length;
    return { total, published, scheduled, drafts };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (query && !(it.title||'').toLowerCase().includes(query.toLowerCase()) && !(it.content||'').toLowerCase().includes(query.toLowerCase())) return false;
      if (statusFilter === 'published' && !it.is_published) return false;
      if (statusFilter === 'scheduled' && !(it.published_at && !it.is_published)) return false;
      if (statusFilter === 'draft' && (it.is_published || it.published_at)) return false;
      if (priorityFilter !== 'all' && it.priority !== priorityFilter) return false;
      return true;
    }).sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0) || new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));
  }, [items, query, statusFilter, priorityFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', content: '', priority: 'Normal', pinned: false, publishNow: true, scheduledAt: '' });
    setImageFile(null);
    setPreviewUrl(null);
    setIsModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ title: item.title || '', content: item.content || '', priority: item.priority || 'Normal', pinned: !!item.pinned, publishNow: !!item.is_published, scheduledAt: item.published_at ? new Date(item.published_at).toISOString().slice(0,16) : '' });
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
    try {
      await axios.delete(`/api/announcements/${id}`);
      toast.success('Deleted');
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  }

  async function togglePublish(item) {
    try {
      const fields = { is_published: item.is_published ? false : true };
      if (!item.is_published) fields.published_at = new Date().toISOString();
      await axios.put(`/api/announcements/${item.id}`, fields);
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update publish status');
    }
  }

  async function togglePin(item) {
    try {
      await axios.put(`/api/announcements/${item.id}`, { pinned: !item.pinned });
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update pin status');
    }
  }

  return (
    <PageLayout title="Announcements">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Announcements</h2>
          <p className="text-sm text-on-surface-variant">Create and schedule community updates for staff and borrowers.</p>
        </div>
        {user?.role === 'staff' && (
          <div>
            <button onClick={openCreate} className="btn btn-primary inline-flex items-center"><Plus className="mr-2"/>Create Announcement</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Scheduled" value={stats.scheduled} />
        <StatCard label="Drafts" value={stats.drafts} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex items-center w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input placeholder="Search announcements" value={query} onChange={(e) => setQuery(e.target.value)} className="input pl-10 w-full" />
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          <button title="More filters" className="btn btn-ghost"><Filter/></button>
        </div>
      </div>

      {/* Announcement list */}
      <div className="space-y-4">
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg bg-surface-container-low dark:bg-[#171717] animate-pulse h-36" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-8 rounded-lg bg-surface-container-low border border-outline-variant/10 text-center">
            <div className="text-xl font-semibold mb-2">No announcements yet</div>
            <div className="text-sm text-on-surface-variant mb-4">Create your first announcement to keep the community informed.</div>
            {user?.role === 'staff' && (
              <button onClick={openCreate} className="btn btn-primary inline-flex items-center"><Plus className="mr-2"/>Create Announcement</button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.18 }}
              className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition"
            >
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  {it.author?.avatar_url ? (
                    <img src={it.author.avatar_url} alt={it.author?.name} className="w-full h-full object-cover" />
                  ) : it.image_url ? (
                    <img src={it.image_url} alt="img" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400"><ImgIcon/></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{it.title}</h3>
                    <div className="ml-2 flex items-center gap-2">
                      {it.priority === 'Urgent' && <Badge color="orange">Urgent</Badge>}
                      {it.priority === 'Important' && <Badge color="orange">Important</Badge>}
                      {it.is_published ? <Badge color="green">Published</Badge> : it.published_at ? <Badge color="orange">Scheduled</Badge> : <Badge>Draft</Badge>}
                      {it.pinned && <span title="Pinned" className="text-primary"><Pin className="w-4 h-4"/></span>}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">by {it.author?.name || 'Unknown'} • {new Date(it.created_at).toLocaleString()}</div>
                  {it.published_at && (
                    <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-2"><CalendarIcon className="w-3 h-3"/>{new Date(it.published_at).toLocaleString()}</div>
                  )}
                  <p className="mt-2 text-sm text-gray-800 line-clamp-3">{it.content}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => openEdit(it)} className="btn btn-sm"><Edit2/></button>
                  <button onClick={() => removeItem(it.id)} className="btn btn-sm btn-danger"><Trash2/></button>
                  <button onClick={() => togglePublish(it)} className="btn btn-sm">{it.is_published ? 'Unpublish' : 'Publish'}</button>
                  <button onClick={() => togglePin(it)} className="btn btn-sm">{it.pinned ? 'Unpin' : 'Pin'}</button>
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
              <div className="flex gap-3 items-center">
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
