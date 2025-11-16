import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { UserContext } from '../../context/userContext';
import toast from 'react-hot-toast';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function StaffSchedule() {
  const { user } = useContext(UserContext);
  const [performances, setPerformances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', location: '', start_time: '', end_time: '' });
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filteredPerformances, setFilteredPerformances] = useState([]);

  useEffect(() => {
    fetchPerformances();
  }, []);

  async function fetchPerformances() {
    try {
      setLoading(true);
      const res = await axios.get('/api/performances');
      const data = Array.isArray(res.data) ? res.data : [];
      // Order nearest (earliest upcoming) first
      data.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      setPerformances(data);
    } catch (err) {
      console.error('Failed to load performances:', err.message);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }

  function toLocalInput(datetime) {
    if (!datetime) return '';
    return dayjs(datetime).local().format('YYYY-MM-DDTHH:mm');
  }

  function fromLocalInput(val) {
    if (!val) return null;
    // treat local input as local time and convert to ISO
    return dayjs(val).toISOString();
  }

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', description: '', location: '', start_time: '', end_time: '' });
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({
      title: p.title || '',
      description: p.description || '',
      location: p.location || '',
      start_time: toLocalInput(p.start_time),
      end_time: toLocalInput(p.end_time),
    });
  };

  // Calendar click handler: show performances for the clicked day
  const handleDateClick = (date) => {
    const clicked = new Date(date).toDateString();
    const sameDay = performances.filter(
      (p) => new Date(p.start_time).toDateString() === clicked
    );
    setFilteredPerformances(sameDay);
    setSelectedDate(clicked);
    setIsModalOpen(true);
  };

  // set of dates (string) that have performances
  const performanceDates = new Set(
    performances.map((p) => new Date(p.start_time).toDateString())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title,
        description: form.description,
        location: form.location,
        start_time: fromLocalInput(form.start_time),
        end_time: fromLocalInput(form.end_time),
      };
      if (editing) {
        await axios.put(`/api/performances/${editing}`, payload);
        toast.success('Updated');
      } else {
        await axios.post('/api/performances', payload);
        toast.success('Created');
      }
      fetchPerformances();
      openNew();
    } catch (err) {
      console.error('Save failed:', err.response?.data || err.message);
      toast.error('Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this performance?')) return;
    try {
      await axios.delete(`/api/performances/${id}`);
      toast.success('Deleted');
      fetchPerformances();
    } catch (err) {
      console.error('Delete failed:', err.response?.data || err.message);
      toast.error('Delete failed');
    }
  };

  if (!user || user.role !== 'staff') {
    return <div className="text-center mt-10 text-red-500">❌ Access Denied</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-blue-600">Performance Schedule</h2>
          <button onClick={openNew} className="bg-blue-600 text-white px-3 py-1 rounded">+ New</button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold mb-2">Create / Edit</h3>
            <form onSubmit={handleSubmit} className="space-y-2">
              <input required placeholder="Title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} className="w-full border px-3 py-2 rounded" />
              <input placeholder="Location" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})} className="w-full border px-3 py-2 rounded" />
              <textarea placeholder="Description" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="w-full border px-3 py-2 rounded" rows={3} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">Start</label>
                  <input required type="datetime-local" value={form.start_time} onChange={(e)=>setForm({...form,start_time:e.target.value})} className="w-full border px-2 py-2 rounded" />
                </div>
                <div>
                  <label className="text-xs">End</label>
                  <input required type="datetime-local" value={form.end_time} onChange={(e)=>setForm({...form,end_time:e.target.value})} className="w-full border px-2 py-2 rounded" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded">Save</button>
                <button type="button" onClick={openNew} className="bg-gray-200 px-3 py-1 rounded">Clear</button>
                {editing && <button type="button" onClick={()=>{setEditing(null); openNew();}} className="ml-auto text-sm text-gray-600">Cancel Edit</button>}
              </div>
            </form>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Calendar</h3>
            <div className="mb-4">
              <Calendar
                onClickDay={handleDateClick}
                tileContent={({ date }) =>
                  performanceDates.has(date.toDateString()) ? (
                    <div className="flex justify-center mt-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    </div>
                  ) : null
                }
                tileClassName={({ date }) =>
                  performanceDates.has(date.toDateString()) ? 'bg-blue-50 rounded-full' : null
                }
              />
            </div>

            <h3 className="font-semibold mb-2">Upcoming</h3>
            {loading ? (
              <div className="text-gray-500">Loading…</div>
            ) : (
              <div className="divide-y">
                {performances.map((p) => (
                  <div key={p.id} className="py-3 flex items-center gap-4">
                    <div className="w-28 text-xs text-left">
                      <div className="font-semibold text-sm">{dayjs(p.start_time).format('MMM D')}</div>
                      <div className="text-gray-500">{dayjs(p.start_time).format('h:mm A')} — {dayjs(p.end_time).format('h:mm A')}</div>
                    </div>

                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-800">{p.title}</div>
                      <div className="text-xs text-gray-500">{p.location || '—'}</div>
                      {p.description && <div className="text-sm text-gray-700 mt-1 line-clamp-2">{p.description}</div>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)} title="Edit" className="text-xs text-yellow-700 border border-yellow-100 px-2 py-1 rounded">Edit</button>
                      <button onClick={() => handleDelete(p.id)} title="Delete" className="text-xs text-red-700 border border-red-100 px-2 py-1 rounded">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for performances on selected date */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-4 text-blue-600 text-center">
              Performances on {selectedDate}
            </h2>

            {filteredPerformances.length === 0 ? (
              <p className="text-center text-gray-500">No performances found on this date.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {filteredPerformances.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-4 border-b pb-3">
                    <div className="w-28 text-xs">
                      <div className="font-semibold text-sm">{dayjs(p.start_time).format('MMM D')}</div>
                      <div className="text-gray-500">{dayjs(p.start_time).format('h:mm A')} — {dayjs(p.end_time).format('h:mm A')}</div>
                    </div>

                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-800">{p.title}</div>
                      <div className="text-xs text-gray-500">{p.location || '—'}</div>
                      {p.description && <div className="text-sm text-gray-700 mt-1">{p.description}</div>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button onClick={() => { setIsModalOpen(false); openEdit(p); }} className="text-xs text-yellow-700 border border-yellow-100 px-2 py-1 rounded">Edit</button>
                      <button onClick={() => { if(confirm('Delete this performance?')) { handleDelete(p.id); setIsModalOpen(false); } }} className="text-xs text-red-700 border border-red-100 px-2 py-1 rounded">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
