import React, { useState, useEffect, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import PageLayout from '../../components/layout/PageLayout';
import { UserContext } from '../../../context/userContext';
import { useSidebarStore } from '../../../context/sidebarStore';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Image as ImgIcon, Pin, MoreVertical, X } from 'lucide-react';

export default function Announcements() {
  const { user } = useContext(UserContext);
  const { selectedDivision, globalSearchQuery } = useSidebarStore();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const activeDivision = selectedDivision || 'All';
  const [divisions, setDivisions] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Composer state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', priority: 'Normal', pinned: false, publishNow: true, scheduledAt: '', division_id: '' });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Details modal state
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const formatLongDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  };

  const formatLongDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const getPreviewText = (content) => {
    if (!content) return 'No description provided.';
    const plainText = String(content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plainText.length <= 140) return plainText;
    return `${plainText.slice(0, 137)}...`;
  };

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
        setMenuPosition(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
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
      if (globalSearchQuery && !(it.title||'').toLowerCase().includes(globalSearchQuery.toLowerCase()) && !(it.content||'').toLowerCase().includes(globalSearchQuery.toLowerCase())) return false;
      return true;
    }).sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0) || new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));
  }, [items, globalSearchQuery, activeDivision]);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', content: '', priority: 'Normal', pinned: false, publishNow: true, scheduledAt: '', division_id: activeDivisionId });
    setImageFile(null);
    setPreviewUrl(null);
    setIsComposerOpen(true);
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
    setIsComposerOpen(true);
  }

  function openDetails(item) {
    setSelectedAnnouncement(item);
    setIsDetailsOpen(true);
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
      setIsComposerOpen(false);
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
      <div className="mb-3 flex items-center justify-end rounded-xl border border-outline-variant/20 bg-surface-container-low p-2.5 shadow-sm dark:border-gray-700 dark:bg-[#222]">
        {user?.role === 'staff' && (
          <button
            onClick={openCreate}
            className="inline-flex items-center rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary/90 active:translate-y-px dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Announcement
          </button>
        )}
      </div>

      <div className="space-y-3">

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
              role="button"
              tabIndex={0}
              onClick={() => openDetails(it)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openDetails(it);
                }
              }}
              className="group relative overflow-visible rounded-xl border border-outline-variant/10 bg-surface-container-low p-2.5 shadow-sm transition hover:border-primary/30 hover:shadow-md dark:border-gray-700 dark:bg-[#222]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="h-9 w-9 overflow-hidden rounded-lg bg-surface-container-high dark:bg-[#2a2a2a] flex-shrink-0">
                    {it.author?.profile_pic_url ? (
                      <img src={it.author.profile_pic_url} alt={it.author?.name} className="h-full w-full object-cover" />
                    ) : it.image_url ? (
                      <img src={it.image_url} alt={it.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-on-surface-variant"><ImgIcon className="w-3.5 h-3.5"/></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-on-surface">{it.title}</p>
                      {it.pinned && <Pin className="h-3 w-3 text-amber-500" />}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-on-surface-variant line-clamp-2">{getPreviewText(it.content)}</p>
                    <div className="mt-1 text-[11px] text-on-surface-variant">
                      {formatLongDate(it.published_at || it.created_at)} • by {it.author?.name || 'Unknown'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0" data-announcement-menu>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePublish(it);
                      }}
                      disabled={processingId === it.id}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${it.is_published ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600' : 'bg-primary text-on-primary hover:bg-primary/90 dark:bg-blue-600 dark:hover:bg-blue-700'} ${processingId === it.id ? 'cursor-not-allowed opacity-70' : ''}`}
                      title={it.is_published ? 'Unpublish announcement' : 'Publish announcement'}
                    >
                      {it.is_published ? 'Unpublish' : 'Publish'}
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          const left = Math.min(rect.right - 176, window.innerWidth - 192);
                          const nextOpen = openMenuId === it.id ? null : it.id;
                          setOpenMenuId(nextOpen);
                          setMenuPosition(nextOpen ? { top: rect.bottom + 8, left: Math.max(12, left) } : null);
                        }}
                        className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container-high dark:text-gray-300 dark:hover:bg-[#2a2a2a]"
                        title="More actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {!it.is_published && it.published_at && (
                    <div className="max-w-[220px] text-right text-[11px] leading-5 text-on-surface-variant">
                      <div className="font-medium text-on-surface dark:text-gray-200">Scheduled for</div>
                      <div>{formatLongDateTime(it.published_at)}</div>
                    </div>
                  )}

                  {openMenuId === it.id && menuPosition && createPortal(
                    <div
                      className="fixed z-[9999] w-44 overflow-visible rounded-lg border border-outline-variant/20 bg-surface-container-low p-2 shadow-xl dark:border-gray-700 dark:bg-[#222]"
                      style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                      data-announcement-menu
                      role="menu"
                    >
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); openEdit(it); setOpenMenuId(null); setMenuPosition(null); }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high dark:hover:bg-[#2a2a2a]"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); togglePin(it); setOpenMenuId(null); setMenuPosition(null); }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high dark:hover:bg-[#2a2a2a]"
                      >
                        <Pin className="h-4 w-4" />
                        {it.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); removeItem(it.id); setOpenMenuId(null); setMenuPosition(null); }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-[#3b1717]"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Composer modal */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitForm} className="w-[800px] max-w-full rounded-xl bg-white p-6 shadow-2xl dark:bg-[#222]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? 'Edit' : 'Create'} Announcement</h3>
              <button type="button" onClick={() => setIsComposerOpen(false)} className="text-gray-600 dark:text-gray-300">Close</button>
            </div>
            <div className="space-y-3">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="input w-full" />
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Content" className="textarea w-full" rows={6} />
              <div className="flex flex-wrap items-center gap-3">
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
                {previewUrl && <img src={previewUrl} alt="preview" className="h-20 w-32 rounded object-cover" />}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsComposerOpen(false)} className="btn">Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isDetailsOpen && selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="relative flex h-[560px] w-[760px] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#222]">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container-high dark:text-gray-300 dark:hover:bg-[#2a2a2a]"
              aria-label="Close announcement"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="px-5 pb-3 pt-5 text-center">
              <h3 className="text-lg font-semibold text-on-surface dark:text-white">{selectedAnnouncement.title}</h3>
              <div className="mt-1 text-sm text-on-surface-variant dark:text-gray-400">
                <div>{formatLongDate(selectedAnnouncement.published_at || selectedAnnouncement.created_at)}</div>
                <div className="mt-0.5">Published by {selectedAnnouncement.author?.name || 'Unknown'}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 dark:border-gray-700 dark:bg-[#2a2a2a]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">
                    Announcement Details
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-on-surface dark:text-gray-300">
                    {selectedAnnouncement.content || 'No description provided.'}
                  </div>
                </div>

                {selectedAnnouncement.image_url && (
                  <div className="flex justify-center rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 dark:border-gray-700 dark:bg-[#2a2a2a]">
                    <img src={selectedAnnouncement.image_url} alt={selectedAnnouncement.title} className="max-h-72 w-full max-w-[420px] rounded-lg object-contain" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
