import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useParams } from "react-router";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Clock,
  BookOpen,
  Circle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { parentGetChildEvents, ParentEventItem } from "@/app/utils/api";

// Internal event shape with a parsed Date for calendar logic
interface CalendarEvent {
  id: number;
  title: string;
  type: "exam" | "event";
  date: Date;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
}

function parseEventDate(dateStr: string): Date {
  // dateStr format: "Mar 02, 2026"
  return new Date(dateStr);
}

function toCalendarEvent(item: ParentEventItem): CalendarEvent {
  return {
    id: item.id,
    title: item.title,
    type: item.type === "Exam" ? "exam" : "event",
    date: parseEventDate(item.start_date),
    start_time: item.start_time ?? null,
    end_time: item.end_time ?? null,
    description: item.description ?? null,
  };
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ParentEvents() {
  const { childId } = useParams<{ childId: string }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    if (!childId || childId === "0") { setLoading(false); return; }
    parentGetChildEvents(Number(childId))
      .then(items => setEvents(items.map(toCalendarEvent)))
      .catch(() => setError("Failed to load events."))
      .finally(() => setLoading(false));
  }, [childId]);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const goToPreviousMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const getEventsForDate = (day: number) =>
    events.filter(e =>
      e.date.getDate() === day &&
      e.date.getMonth() === currentMonth &&
      e.date.getFullYear() === currentYear
    );

  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const upcomingEvents = [...events]
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  if (loading) return (
    <DashboardLayout role="parent">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-green-500" size={32} />
      </div>
    </DashboardLayout>
  );

  if (!childId || childId === "0") return (
    <DashboardLayout role="parent">
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No child selected.</p>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout role="parent">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Events & Exams Calendar</h1>
        <p className="text-gray-600">Stay updated on school activities</p>
        <p className="text-xs text-gray-400 mt-1">All dates are provided by the school administration.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Calendar */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight size={20} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {dayNames.map(day => (
                <div key={day} className="text-center py-2 text-xs font-semibold text-gray-500">
                  {day}
                </div>
              ))}

              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const eventsForDay = getEventsForDate(day);
                const hasExam = eventsForDay.some(e => e.type === "exam");
                const hasEvent = eventsForDay.some(e => e.type === "event");
                const todayCell = isToday(day);

                return (
                  <div
                    key={day}
                    className={`aspect-square p-2 rounded-lg border transition-all cursor-pointer ${
                      todayCell
                        ? "bg-green-50 border-green-200"
                        : "border-gray-100 hover:border-green-200 hover:bg-green-50/50"
                    }`}
                    onClick={() => eventsForDay.length > 0 && setSelectedEvent(eventsForDay[0])}
                  >
                    <div className="flex flex-col items-center justify-between h-full">
                      <span className={`text-sm font-medium ${todayCell ? "text-green-700 font-bold" : "text-gray-700"}`}>
                        {day}
                      </span>
                      {(hasExam || hasEvent) && (
                        <div className="flex gap-1">
                          {hasEvent && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                          {hasExam  && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Legend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <h3 className="font-semibold text-gray-800 mb-4">Legend</h3>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Circle size={12} className="text-green-500 fill-green-500" />
                <span className="text-sm text-gray-600">School Event</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle size={12} className="text-blue-500 fill-blue-500" />
                <span className="text-sm text-gray-600">Exam</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Exam schedules may be subject to change. Please check with the school for updates.
            </p>
          </motion.div>
        </div>

        {/* Right Column — Event Details & Upcoming */}
        <div className="space-y-6">
          {/* Event Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <h3 className="font-semibold text-gray-800 mb-4">Event Details</h3>

            {selectedEvent ? (
              <div className="space-y-4">
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    selectedEvent.type === "exam"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {selectedEvent.type === "exam" ? "Exam" : "School Event"}
                  </span>
                </div>

                <h4 className="text-lg font-bold text-gray-800">{selectedEvent.title}</h4>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{formatDate(selectedEvent.date)}</p>
                      {(selectedEvent.start_time || selectedEvent.end_time) && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock size={11} />
                          {selectedEvent.start_time}
                          {selectedEvent.end_time && ` – ${selectedEvent.end_time}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedEvent.type === "exam" && (
                    <div className="flex items-center gap-3">
                      <BookOpen size={16} className="text-gray-400 flex-shrink-0" />
                      <p className="text-sm text-gray-700">Examination</p>
                    </div>
                  )}
                </div>

                {selectedEvent.description && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes from School</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{selectedEvent.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Select an event to view details</p>
              </div>
            )}
          </motion.div>

          {/* Upcoming Events */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <h3 className="font-semibold text-gray-800 mb-4">Upcoming Events & Exams</h3>

            {upcomingEvents.length === 0 ? (
              <div className="text-center py-6">
                <Calendar size={36} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    onClick={() => setSelectedEvent(event)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedEvent?.id === event.id
                        ? "border-green-200 bg-green-50"
                        : "border-gray-100 hover:border-green-200 hover:bg-green-50/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-2 h-2 rounded-full ${event.type === "exam" ? "bg-blue-500" : "bg-green-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-gray-800 text-sm truncate">{event.title}</h4>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${
                            event.type === "exam"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {event.type === "exam" ? "Exam" : "Event"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <MapPin size={10} />
                          {event.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {event.start_time && (
                            <span className="ml-1 text-gray-400">· {event.start_time}</span>
                          )}
                        </p>
                        {event.description && (
                          <p className="text-xs text-gray-600 line-clamp-1">{event.description}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
