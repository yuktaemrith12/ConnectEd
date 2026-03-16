import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar, Plus, ChevronLeft, ChevronRight, LayoutGrid, List,
  X, Edit, Trash2, Clock, Users, CalendarDays, Eye, EyeOff,
} from "lucide-react";
import {
  adminGetEvents, adminCreateEvent, adminUpdateEvent,
  adminDeleteEvent, adminToggleEventPublish,
  type EventRead, type EventCreatePayload,
} from "@/app/utils/api";

const emptyStateImg = "/images/empty-state.jpg";

type EventType = "Academic" | "Exam" | "Holiday" | "Meeting" | "Other";
type ViewMode = "month" | "list";

const eventTypeConfig: Record<EventType, { label: string; color: string; bgColor: string }> = {
  Academic: { label: "Academic", color: "text-orange-600", bgColor: "bg-orange-100" },
  Exam: { label: "Exam", color: "text-red-600", bgColor: "bg-red-100" },
  Holiday: { label: "Holiday", color: "text-gray-600", bgColor: "bg-gray-100" },
  Meeting: { label: "Meeting", color: "text-blue-600", bgColor: "bg-blue-100" },
  Other: { label: "Other", color: "text-purple-600", bgColor: "bg-purple-100" },
};

const AUDIENCE_OPTIONS = ["All", "Students", "Teachers", "Parents", "Specific Classes"];

function getTypeKey(t: string): EventType {
  return (t as EventType) in eventTypeConfig ? (t as EventType) : "Other";
}

export default function AdminEventsCalendar() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<EventRead | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRead | null>(null);
  const [events, setEvents] = useState<EventRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form refs
  const titleRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);
  const audienceRef = useRef<HTMLSelectElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const publishRef = useRef<HTMLInputElement>(null);

  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await adminGetEvents({ month: currentMonth + 1, year: currentYear });
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, [currentMonth, currentYear]);

  // Calendar helpers
  const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const generateCalendarDays = () => {
    const days: (number | null)[] = [];
    for (let i = 0; i < getFirstDayOfMonth(currentMonth, currentYear); i++) days.push(null);
    for (let d = 1; d <= getDaysInMonth(currentMonth, currentYear); d++) days.push(d);
    return days;
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(ev => ev.start_date <= dateStr && ev.end_date >= dateStr);
  };

  const isToday = (day: number) => {
    const t = new Date();
    return day === t.getDate() && currentMonth === t.getMonth() && currentYear === t.getFullYear();
  };

  const openCreate = () => { setEditingEvent(null); setShowModal(true); };
  const openEdit = (ev: EventRead) => { setEditingEvent(ev); setShowModal(true); };

  const handleSave = async () => {
    const title = titleRef.current?.value.trim() ?? "";
    const type = typeRef.current?.value ?? "Academic";
    const startDate = startDateRef.current?.value ?? "";
    const endDate = endDateRef.current?.value || startDate;
    const startTime = startTimeRef.current?.value || undefined;
    const endTime = endTimeRef.current?.value || undefined;
    const audience = audienceRef.current?.value ?? "All";
    const desc = descRef.current?.value.trim() || undefined;
    const published = publishRef.current?.checked ?? false;

    if (!title || !startDate) return;

    setSaving(true);
    try {
      const payload: EventCreatePayload = {
        title, type, start_date: startDate, end_date: endDate,
        start_time: startTime, end_time: endTime,
        target_audience_type: audience, description: desc,
        published, class_ids: [],
      };
      if (editingEvent) {
        const updated = await adminUpdateEvent(editingEvent.id, payload);
        setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
        setSelectedEvent(updated);
      } else {
        const created = await adminCreateEvent(payload);
        setEvents(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch {
      alert("Failed to save event.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: EventRead) => {
    if (!confirm(`Delete "${ev.title}"?`)) return;
    setDeleting(true);
    try {
      await adminDeleteEvent(ev.id);
      setEvents(prev => prev.filter(e => e.id !== ev.id));
      if (selectedEvent?.id === ev.id) setSelectedEvent(null);
    } catch {
      alert("Failed to delete event.");
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePublish = async (ev: EventRead) => {
    try {
      const updated = await adminToggleEventPublish(ev.id);
      setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
      setSelectedEvent(updated);
    } catch {
      alert("Failed to update event.");
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Events Calendar</h1>
            <p className="text-gray-600">Manage school events and activities</p>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow">
            <Calendar size={20} />
            <Plus size={20} />
            Create Event
          </motion.button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedDate(new Date(currentYear, currentMonth - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </motion.button>
            <div className="text-xl font-semibold min-w-[200px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedDate(new Date(currentYear, currentMonth + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight size={20} />
            </motion.button>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode("month")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${viewMode === "month" ? "bg-white shadow-sm font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <LayoutGrid size={18} /> Month
            </button>
            <button onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-white shadow-sm font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <List size={18} /> List
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar / List */}
          <div className="lg:col-span-2">
            {viewMode === "month" ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                    <div key={d} className="text-center text-sm font-semibold text-gray-600 py-2">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {generateCalendarDays().map((day, index) => {
                    if (day === null) return <div key={`e-${index}`} className="aspect-square" />;
                    const dayEvents = getEventsForDay(day);
                    const today = isToday(day);
                    return (
                      <motion.div key={day} whileHover={{ scale: 1.05 }}
                        onClick={() => dayEvents.length > 0 && setSelectedEvent(dayEvents[0])}
                        className={`aspect-square p-2 rounded-xl border-2 cursor-pointer transition-all ${today ? "border-orange-400 bg-orange-50" : "border-gray-100 hover:border-gray-300 hover:bg-gray-50"}`}>
                        <div className="flex flex-col h-full">
                          <div className={`text-sm font-medium mb-1 ${today ? "text-orange-600" : "text-gray-900"}`}>{day}</div>
                          <div className="flex-1 space-y-1 overflow-hidden">
                            {dayEvents.slice(0, 2).map(ev => {
                              const k = getTypeKey(ev.type);
                              return (
                                <motion.div key={ev.id} whileHover={{ scale: 1.05, y: -2 }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                                  className={`text-xs px-2 py-1 rounded-md ${eventTypeConfig[k].bgColor} ${eventTypeConfig[k].color} font-medium truncate cursor-pointer shadow-sm`}>
                                  {ev.title}
                                </motion.div>
                              );
                            })}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-gray-500 px-2">+{dayEvents.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                  <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
                ) : events.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm">No events this month.</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Event Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Type</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Audience</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {events.map(ev => {
                        const k = getTypeKey(ev.type);
                        return (
                          <motion.tr key={ev.id} whileHover={{ backgroundColor: "#f9fafb" }}
                            className="cursor-pointer" onClick={() => setSelectedEvent(ev)}>
                            <td className="px-6 py-4"><div className="font-medium text-gray-900">{ev.title}</div></td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(ev.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${eventTypeConfig[k].bgColor} ${eventTypeConfig[k].color}`}>
                                {eventTypeConfig[k].label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{ev.target_audience_type}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${ev.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                {ev.published ? <><Eye size={12} /> Published</> : <><EyeOff size={12} /> Draft</>}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                  <Edit size={16} className="text-gray-600" />
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); handleDelete(ev); }}
                                  className="p-2 hover:bg-red-50 rounded-lg transition-colors" disabled={deleting}>
                                  <Trash2 size={16} className="text-red-600" />
                                </motion.button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}
          </div>

          {/* Event Details Panel */}
          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              {selectedEvent ? (
                <motion.div key="event-details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{selectedEvent.title}</h3>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20} className="text-gray-500" />
                      </motion.button>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${eventTypeConfig[getTypeKey(selectedEvent.type)].bgColor} ${eventTypeConfig[getTypeKey(selectedEvent.type)].color}`}>
                      {eventTypeConfig[getTypeKey(selectedEvent.type)].label}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-gray-700">
                      <CalendarDays size={18} className="text-gray-400" />
                      <div className="font-medium">
                        {new Date(selectedEvent.start_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                        {selectedEvent.end_date !== selectedEvent.start_date && (
                          <span className="text-gray-500"> → {new Date(selectedEvent.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        )}
                      </div>
                    </div>
                    {selectedEvent.start_time && (
                      <div className="flex items-center gap-3 text-gray-700">
                        <Clock size={18} className="text-gray-400" />
                        <span className="font-medium">
                          {selectedEvent.start_time}{selectedEvent.end_time ? ` - ${selectedEvent.end_time}` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={18} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Target Audience</span>
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {selectedEvent.target_audience_type}
                    </span>
                  </div>

                  {selectedEvent.description && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                      <p className="text-sm text-gray-600 leading-relaxed">{selectedEvent.description}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-500">
                    <div>Created by <span className="font-medium text-gray-700">{selectedEvent.created_by}</span></div>
                    <div>
                      {new Date(selectedEvent.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => openEdit(selectedEvent)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-orange-200 text-orange-600 rounded-xl font-medium hover:bg-orange-50 transition-colors">
                      <Edit size={18} /> Edit Event
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => handleTogglePublish(selectedEvent)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${selectedEvent.published
                          ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          : "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:shadow-lg"}`}>
                      {selectedEvent.published ? <><EyeOff size={18} /> Unpublish</> : <><Eye size={18} /> Publish Event</>}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => handleDelete(selectedEvent)} disabled={deleting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                      <Trash2 size={18} /> Delete Event
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty-state" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center min-h-[500px]">
                  <img src={emptyStateImg} alt="No event selected" className="w-48 h-48 object-contain mb-4 opacity-80" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Event Selected</h3>
                  <p className="text-sm text-gray-500 max-w-xs">Select a date or event to view details</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Create / Edit Event Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-2xl font-bold">{editingEvent ? "Edit Event" : "Create New Event"}</h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={24} />
                </motion.button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title</label>
                  <input type="text" ref={titleRef} defaultValue={editingEvent?.title}
                    placeholder="Enter event title"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Event Type</label>
                  <select ref={typeRef} defaultValue={editingEvent?.type || "Academic"}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all">
                    <option value="Academic">Academic</option>
                    <option value="Exam">Exam</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                    <input type="date" ref={startDateRef} defaultValue={editingEvent?.start_date}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                    <input type="date" ref={endDateRef} defaultValue={editingEvent?.end_date}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time (Optional)</label>
                    <input type="time" ref={startTimeRef} defaultValue={editingEvent?.start_time ?? ""}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Time (Optional)</label>
                    <input type="time" ref={endTimeRef} defaultValue={editingEvent?.end_time ?? ""}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Target Audience</label>
                  <select ref={audienceRef} defaultValue={editingEvent?.target_audience_type || "All"}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all">
                    {AUDIENCE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea ref={descRef} defaultValue={editingEvent?.description ?? ""} rows={4}
                    placeholder="Enter event description"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-semibold text-gray-900">Publish immediately</div>
                    <div className="text-sm text-gray-600">Make this event visible to the target audience</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" ref={publishRef} defaultChecked={editingEvent?.published ?? false} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors">
                  Cancel
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSave} disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50">
                  {saving ? "Saving…" : editingEvent ? "Update Event" : "Create Event"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
