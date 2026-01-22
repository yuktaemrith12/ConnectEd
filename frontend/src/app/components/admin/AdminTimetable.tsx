import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Plus, Clock, AlertCircle, Edit, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../config/api";

type ClassRow = { id: number; name: string };
type Subject = { id: number; name: string };
type Teacher = { id: number; full_name: string; email: string; subject: Subject | null };

type Slot = {
  id: number;
  day_of_week: number;
  day: string;
  period_no: number;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  subject: { id: number; name: string };
  teacher: { id: number; full_name: string; email: string } | null;
};

type DayBlock = { day: string; day_of_week: number; classes: Slot[] };

const DAYS = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
];

// IMPORTANT: shadcn/radix SelectItem cannot have value="".
// Use "none" for "No teacher" and convert to null in payload.
const NO_TEACHER_VALUE = "none";

export default function AdminTimetable() {
  const token = localStorage.getItem("token");

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    }),
    [token]
  );

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [timetable, setTimetable] = useState<DayBlock[]>([]);
  const [conflictsCount, setConflictsCount] = useState<number>(0);

  // dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // create/edit form
  const [formDay, setFormDay] = useState<string>("1");
  const [formPeriod, setFormPeriod] = useState<string>("1");
  const [formStart, setFormStart] = useState<string>("09:00");
  const [formEnd, setFormEnd] = useState<string>("10:00");
  const [formSubjectId, setFormSubjectId] = useState<string>(""); // required
  const [formTeacherId, setFormTeacherId] = useState<string>(NO_TEACHER_VALUE); // optional
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);

  const fetchBasics = async () => {
    setLoading(true);
    try {
      const [cRes, sRes, tRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/classes`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/subjects`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/teachers`, { headers: authHeaders }),
      ]);

      if (!cRes.ok) throw new Error("Failed to load classes");
      if (!sRes.ok) throw new Error("Failed to load subjects");
      if (!tRes.ok) throw new Error("Failed to load teachers");

      const cls = await cRes.json();
      const subs = await sRes.json();
      const teach = await tRes.json();

      setClasses(cls.map((x: any) => ({ id: x.id, name: x.name })));
      setSubjects(subs);
      setTeachers(teach);

      if (!selectedClassId && cls.length > 0) {
        setSelectedClassId(cls[0].id);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Cannot reach backend. Is FastAPI running?");
    } finally {
      setLoading(false);
    }
  };

  const fetchTimetable = async (classId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/timetable/${classId}`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.detail ?? "Failed to load timetable");
        setTimetable([]);
        return;
      }
      setTimetable(data.timetable ?? []);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
      setTimetable([]);
    }
  };

  const fetchConflicts = async (classId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/timetable/conflicts/${classId}`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConflictsCount(0);
        return;
      }
      setConflictsCount((data.conflicts ?? []).length);
    } catch {
      setConflictsCount(0);
    }
  };

  useEffect(() => {
    fetchBasics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchTimetable(selectedClassId);
      fetchConflicts(selectedClassId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  const resetForm = () => {
    setFormDay("1");
    setFormPeriod("1");
    setFormStart("09:00");
    setFormEnd("10:00");
    setFormSubjectId("");
    setFormTeacherId(NO_TEACHER_VALUE);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEdit = (slot: Slot) => {
    setEditingSlot(slot);
    setFormDay(String(slot.day_of_week));
    setFormPeriod(String(slot.period_no));
    setFormStart(slot.start_time);
    setFormEnd(slot.end_time);
    setFormSubjectId(String(slot.subject.id));
    setFormTeacherId(slot.teacher ? String(slot.teacher.id) : NO_TEACHER_VALUE);
    setIsEditDialogOpen(true);
  };

  // Filter teachers based on chosen subject (since each teacher teaches exactly one subject)
  const filteredTeachers = useMemo(() => {
    if (!formSubjectId) return teachers;
    const sid = Number(formSubjectId);
    return teachers.filter((t) => (t.subject?.id ?? -1) === sid);
  }, [teachers, formSubjectId]);

  // Auto-select a teacher when subject changes (if possible)
  useEffect(() => {
    if (!formSubjectId) {
      setFormTeacherId(NO_TEACHER_VALUE);
      return;
    }

    // If current teacher doesn't match subject, try to pick a matching teacher
    const sid = Number(formSubjectId);
    if (formTeacherId !== NO_TEACHER_VALUE) {
      const current = teachers.find((t) => String(t.id) === formTeacherId);
      if (current?.subject?.id === sid) return;
    }

    const match = teachers.find((t) => t.subject?.id === sid);
    setFormTeacherId(match ? String(match.id) : NO_TEACHER_VALUE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSubjectId]);

  const saveCreate = async () => {
    if (!selectedClassId) return toast.error("No class selected");
    if (!formSubjectId) return toast.error("Select a subject");
    if (formStart >= formEnd) return toast.error("End time must be after start time");

    const payload = {
      class_id: selectedClassId,
      day_of_week: Number(formDay),
      period_no: Number(formPeriod),
      start_time: formStart,
      end_time: formEnd,
      subject_id: Number(formSubjectId),
      teacher_user_id: formTeacherId !== NO_TEACHER_VALUE ? Number(formTeacherId) : null,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/admin/timetable/slot`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          toast.error("Teacher conflict detected. Choose another time/teacher.");
        } else {
          toast.error(data?.detail?.message ?? data?.detail ?? "Failed to create slot");
        }
        return;
      }

      toast.success("Timetable slot created");
      setIsCreateDialogOpen(false);
      await fetchTimetable(selectedClassId);
      await fetchConflicts(selectedClassId);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
    }
  };

  const saveEdit = async () => {
    if (!editingSlot || !selectedClassId) return;
    if (!formSubjectId) return toast.error("Select a subject");
    if (formStart >= formEnd) return toast.error("End time must be after start time");

    const payload = {
      day_of_week: Number(formDay),
      period_no: Number(formPeriod),
      start_time: formStart,
      end_time: formEnd,
      subject_id: Number(formSubjectId),
      teacher_user_id: formTeacherId !== NO_TEACHER_VALUE ? Number(formTeacherId) : null,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/admin/timetable/slot/${editingSlot.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          toast.error("Teacher conflict detected. Choose another time/teacher.");
        } else {
          toast.error(data?.detail?.message ?? data?.detail ?? "Failed to update slot");
        }
        return;
      }

      toast.success("Slot updated");
      setIsEditDialogOpen(false);
      setEditingSlot(null);
      await fetchTimetable(selectedClassId);
      await fetchConflicts(selectedClassId);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
    }
  };

  const deleteSlot = async (slotId: number) => {
    if (!selectedClassId) return;

    const yes = confirm("Delete this timetable slot?");
    if (!yes) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/timetable/slot/${slotId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.detail ?? "Failed to delete slot");
        return;
      }
      toast.success("Slot deleted");
      await fetchTimetable(selectedClassId);
      await fetchConflicts(selectedClassId);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
    }
  };

  const selectedClassName = useMemo(() => {
    if (!selectedClassId) return "";
    return classes.find((c) => c.id === selectedClassId)?.name ?? "";
  }, [classes, selectedClassId]);

  const totalClasses = timetable.reduce((acc, d) => acc + (d.classes?.length ?? 0), 0);
  const uniqueSubjects = new Set(timetable.flatMap((d) => d.classes.map((c) => c.subject.name))).size;
  const uniqueTeachers = new Set(
    timetable.flatMap((d) => d.classes.map((c) => c.teacher?.full_name).filter(Boolean) as string[])
  ).size;

  const canSubmit = Boolean(formSubjectId) && formStart < formEnd && Boolean(formPeriod);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Timetable Management</h2>
          <p className="text-muted-foreground">Create and manage class schedules</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => selectedClassId && fetchTimetable(selectedClassId)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Time Slot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Timetable Slot</DialogTitle>
                <DialogDescription>
                  Create a new class session in the timetable.
                  <span className="block text-xs text-muted-foreground mt-1">
                    Tip: pick a subject first — the teacher list will auto-filter.
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Day</Label>
                  <Select value={formDay} onValueChange={setFormDay}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Period No</Label>
                  <Input
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value)}
                    placeholder="e.g. 1"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Start</Label>
                    <Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>End</Label>
                    <Input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Subject</Label>
                  <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Teacher (optional)</Label>
                  <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TEACHER_VALUE}>No teacher</SelectItem>
                      {(filteredTeachers.length ? filteredTeachers : teachers).map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.full_name} {t.subject?.name ? `— (${t.subject.name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Teachers are filtered by subject because each teacher teaches one subject.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveCreate} disabled={!canSubmit}>
                  Add Slot
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Class Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label>Select Class:</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading classes…</div>
            ) : (
              <Tabs
                value={selectedClassId ? String(selectedClassId) : ""}
                onValueChange={(v) => setSelectedClassId(Number(v))}
                className="flex-1"
              >
                <TabsList className={`grid w-full ${classes.length <= 4 ? "grid-cols-4" : "grid-cols-6"}`}>
                  {classes.map((cls) => (
                    <TabsTrigger key={cls.id} value={String(cls.id)}>
                      {cls.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timetable Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {(timetable.length ? timetable : DAYS.map((d) => ({ day: d.label, day_of_week: d.value, classes: [] }))).map(
          (dayData, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{dayData.day}</CardTitle>
                <CardDescription className="text-xs">
                  {dayData.classes.length} {dayData.classes.length === 1 ? "class" : "classes"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {dayData.classes.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                    No classes scheduled
                  </div>
                ) : (
                  dayData.classes.map((cls) => (
                    <div key={cls.id} className="p-3 rounded-lg border bg-white space-y-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>
                          {cls.start_time} – {cls.end_time}
                        </span>
                        <span className="ml-auto">P{cls.period_no}</span>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium line-clamp-2">{cls.subject.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {cls.teacher?.full_name ?? "No teacher assigned"}
                        </p>
                      </div>

                      <div className="flex gap-1 pt-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs flex-1" onClick={() => openEdit(cls)}>
                          <Edit className="size-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs flex-1" onClick={() => deleteSlot(cls.id)}>
                          <Trash2 className="size-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Timetable Slot</DialogTitle>
            <DialogDescription>Update this class session</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Day</Label>
              <Select value={formDay} onValueChange={setFormDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Period No</Label>
              <Input value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)} inputMode="numeric" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Start</Label>
                <Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>End</Label>
                <Input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Subject</Label>
              <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Teacher (optional)</Label>
              <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEACHER_VALUE}>No teacher</SelectItem>
                  {(filteredTeachers.length ? filteredTeachers : teachers).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.full_name} {t.subject?.name ? `— (${t.subject.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!canSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict Warning */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertCircle className="size-6 text-yellow-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium mb-1">Conflict Detection</h4>
              <p className="text-sm text-muted-foreground">
                Conflicts are checked on Add/Edit. Current conflicts detected for {selectedClassName || "this class"}:{" "}
                <span className="font-medium text-foreground">{conflictsCount}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Overview - {selectedClassName || "—"}</CardTitle>
          <CardDescription>Total class hours and distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Total Classes</p>
              <p className="text-2xl font-bold mt-1">{totalClasses}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Unique Subjects</p>
              <p className="text-2xl font-bold mt-1">{uniqueSubjects}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Teachers Assigned</p>
              <p className="text-2xl font-bold mt-1">{uniqueTeachers}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Avg. Classes/Day</p>
              <p className="text-2xl font-bold mt-1">{(totalClasses / 5).toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
