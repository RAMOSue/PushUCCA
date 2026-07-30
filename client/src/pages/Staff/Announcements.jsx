import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import PageLayout from '../../components/layout/PageLayout';
import { UserContext } from '../../../context/userContext';
import { Plus, Edit2, Trash2, Image as ImgIcon } from 'lucide-react';

export default function Announcements() {
  const { user } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', priority: 'Normal', pinned: false, is_published: false });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      // Admin needs all announcements including unpublished
      const res = await axios.get(`/api/announcements?published=false&limit=${limit}&offset=${(page-1)*limit}`);
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnnouncements(); }, [page]);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', content: '', priority: 'Normal', pinned: false, is_published: false });
    setImageFile(null);
    setPreviewUrl(null);
    setIsModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ title: item.title || '', content: item.content || '', priority: item.priority || 'Normal', pinned: !!item.pinned, is_published: !!item.is_published });
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
      fd.append('is_published', form.is_published ? 'true' : 'false');
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

  return (
    <PageLayout title="Announcements">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Announcements</h2>
        <button onClick={openCreate} className="btn btn-primary inline-flex items-center"><Plus className="mr-2"/>Create</button>
      </div>

      <div className="space-y-3">
        {loading && <div>Loading…</div>}
        {!loading && items.length === 0 && <div>No announcements found.</div>}
        {items.map((it) => (
          <div key={it.id} className="p-4 border rounded-md flex items-start gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
              {it.image_url ? <img src={it.image_url} alt="img" className="w-full h-full object-cover" /> : <div className="p-4 text-gray-400"><ImgIcon/></div>}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{it.title}</div>
                  <div className="text-sm text-gray-600">by {it.author?.name || 'Unknown'} • {new Date(it.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(it)} className="btn btn-sm"><Edit2/></button>
                  <button onClick={() => removeItem(it.id)} className="btn btn-sm btn-danger"><Trash2/></button>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-800">{it.content?.slice(0, 300)}</div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <form onSubmit={submitForm} className="bg-white p-6 rounded w-[720px] max-w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{editing ? 'Edit' : 'Create'} Announcement</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-600">Close</button>
            </div>
            <div className="space-y-3">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="input w-full" />
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Content" className="textarea w-full" rows={6} />
              <div className="flex gap-3">
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="select">
                  <option>Normal</option>
                  <option>Important</option>
                  <option>Urgent</option>
                </select>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pinned</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Published</label>
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
