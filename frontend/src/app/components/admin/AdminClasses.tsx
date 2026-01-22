import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { Eye, Plus, RefreshCw, Search, UserPlus, Users, GraduationCap, BookOpen } from "lucide-react";
import { API_BASE_URL } from "../../config/api";

type Subject = { id: number; name: string };
type Teacher = { id: number; full_name: string; email: string; subject: Subject | null };
type Student = { id: number; full_name: string; email: string; class: { id: number; name: string } | null };

type ClassRow = {
  id: number;
  name: string;
  students_count: number;
  teachers_count: number;
  subjects: string[]; // aggregated subject labels
};

type ClassStudentRow = { id: number; full_name: string; email: string };

export default function AdminClasses() {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // UI state
  const [classSearch, setClassSearch] = useState("");

  // dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeachersOpen, setAssignTeachersOpen] = useState(false);

  // create form
  const [newClassName, setNewClassName] = useState("");

  // assign students form
  const [assignClassId, setAssignClassId] = useState<string>("");
  const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(true);

  // selected class details (below section)
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null);

  const [classStudentsLoading, setClassStudentsLoading] = useState(false);
  const [classStudents, setClassStudents] = useState<ClassStudentRow[]>([]);

  const [classTeachersLoading, setClassTeachersLoading] = useState(false);
  const [classTeachers, setClassTeachers] = useState<Teacher[]>([]);

  // assign teachers form
  const [teacherSearch, setTeacherSearch] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  const authHeaders = useMemo(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    };
  }, [token]);

  const fetchAll = async () => {
    if (!token) {
      toast.error("Missing token. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const [cRes, sRes, tRes, stRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/classes`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/subjects`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/teachers`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/students`, { headers: authHeaders }),
      ]);

      if (!cRes.ok) throw new Error("Failed to load classes");
      if (!sRes.ok) throw new Error("Failed to load subjects");
      if (!tRes.ok) throw new Error("Failed to load teachers");
      if (!stRes.ok) throw new Error("Failed to load students");

      const cls = await cRes.json();
      setClasses(cls);
      setSubjects(await sRes.json());
      setTeachers(await tRes.json());
      setStudents(await stRes.json());

      // keep selected class fresh after refresh
      if (selectedClass) {
        const updated = (cls as ClassRow[]).find((x) => x.id === selectedClass.id);
        if (updated) setSelectedClass(updated);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Cannot reach backend. Is FastAPI running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createClass = async () => {
    const class_name = newClassName.trim();
    if (!class_name) return toast.error("Class name is required");

    // minimal class creation: reusing your existing /admin/class-groups is not ideal for many teachers.
    // If you don't have a plain "create class" endpoint, the easiest safe approach is:
    // - Insert into classes directly with a new endpoint.
    // For now, we’ll create via a very small call to /admin/class-groups using the first subject as placeholder if exists.
    // Better: add a /admin/classes POST endpoint. If you want, I’ll give you that too.
    const fallbackSubjectId = subjects[0]?.id;

    if (!fallbackSubjectId) {
      toast.error("Create at least one subject first (subjects table).");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/class-groups`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ class_name, subject_id: fallbackSubjectId, teacher_user_id: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.detail ?? "Failed to create class");
        return;
      }

      toast.success("Class created");
      setCreateOpen(false);
      setNewClassName("");
      await fetchAll();
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
    }
  };

  const fetchStudentsForClass = async (classId: number) => {
    setClassStudentsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/classes/${classId}/students`, {
        headers: authHeaders,
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error((data as any)?.detail ?? "Failed to load students for class");
        setClassStudents([]);
        return;
      }
      setClassStudents(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
      setClassStudents([]);
    } finally {
      setClassStudentsLoading(false);
    }
  };

  const fetchTeachersForClass = async (classId: number) => {
    setClassTeachersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/classes/${classId}/teachers`, {
        headers: authHeaders,
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error((data as any)?.detail ?? "Failed to load teachers for class");
        setClassTeachers([]);
        return;
      }
      setClassTeachers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
      setClassTeachers([]);
    } finally {
      setClassTeachersLoading(false);
    }
  };

  const openDetails = async (row: ClassRow) => {
    setSelectedClass(row);
    setClassStudents([]);
    setClassTeachers([]);
    await Promise.all([fetchStudentsForClass(row.id), fetchTeachersForClass(row.id)]);
  };

  const openAssignStudentsForClass = (classId: number) => {
    setAssignClassId(String(classId));
    setAssignStudentIds([]);
    setStudentSearch("");
    setShowOnlyUnassigned(true);
    setAssignOpen(true);
  };

  const assignStudents = async () => {
    const class_id = Number(assignClassId);
    const student_ids = assignStudentIds.map((x) => Number(x)).filter(Boolean);

    if (!class_id) return toast.error("Please select a class");
    if (student_ids.length === 0) return toast.error("Please select at least 1 student");

    try {
      const res = await fetch(`${API_BASE_URL}/admin/assign-students`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ class_id, student_ids }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.detail ?? "Failed to assign students");
        return;
      }

      toast.success(`Assigned ${data.assigned ?? student_ids.length} student(s)`);
      setAssignOpen(false);

      await fetchAll();
      if (selectedClass?.id === class_id) {
        await fetchStudentsForClass(class_id);
      }
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
    }
  };

  const openAssignTeachers = () => {
    if (!selectedClass) return toast.error("Select a class first.");
    setTeacherSearch("");
    setSelectedTeacherIds(classTeachers.map((t) => String(t.id))); // preselect currently assigned teachers
    setAssignTeachersOpen(true);
  };

  const assignTeachers = async () => {
    if (!selectedClass) return toast.error("Select a class first.");

    const class_id = selectedClass.id;
    const teacher_ids = selectedTeacherIds.map((x) => Number(x)).filter(Boolean);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/assign-teachers`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ class_id, teacher_ids }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.detail ?? "Failed to assign teachers");
        return;
      }

      toast.success(`Teachers updated (${data.assigned ?? teacher_ids.length})`);
      setAssignTeachersOpen(false);

      await fetchAll();
      await fetchTeachersForClass(class_id);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
    }
  };

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => {
      const subjectsJoined = (c.subjects ?? []).join(" ").toLowerCase();
      return c.name.toLowerCase().includes(q) || subjectsJoined.includes(q);
    });
  }, [classes, classSearch]);

  const classOptions = classes.map((c) => ({ id: c.id, name: c.name }));

  const studentOptions = useMemo(() => {
    const sorted = [...students].sort((a, b) => Number(Boolean(a.class)) - Number(Boolean(b.class)));
    const q = studentSearch.trim().toLowerCase();
    return sorted.filter((s) => {
      if (showOnlyUnassigned && s.class) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.class?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, studentSearch, showOnlyUnassigned]);

  const teacherOptions = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      return (
        t.full_name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.subject?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [teachers, teacherSearch]);

  const subjectsChips = (subjectsArr: string[]) => {
    if (!subjectsArr || subjectsArr.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {subjectsArr.slice(0, 3).map((s) => (
          <Badge key={s} variant="secondary" className="font-normal">
            {s}
          </Badge>
        ))}
        {subjectsArr.length > 3 ? (
          <Badge variant="outline" className="font-normal">
            +{subjectsArr.length - 3}
          </Badge>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Class Allocation
            </CardTitle>
            <CardDescription>
              Classes can have many teachers. Each teacher has one subject. View everything per class below.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(true)}>
              <UserPlus className="mr-2 size-4" />
              Assign Students
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create Class
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search class / subject…"
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchAll}>
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead className="text-right">Teachers</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No classes found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses.map((row) => {
                    const isSelected = selectedClass?.id === row.id;
                    return (
                      <TableRow key={row.id} className={isSelected ? "bg-muted/30" : ""}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{subjectsChips(row.subjects)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.teachers_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.students_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openDetails(row)}>
                              <Eye className="mr-2 size-4" />
                              View
                            </Button>
                            <Button size="sm" onClick={() => openAssignStudentsForClass(row.id)}>
                              <UserPlus className="mr-2 size-4" />
                              Assign
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DETAILS SECTION (fills the empty space aesthetically) */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-5" />
              {selectedClass ? `Class Details — ${selectedClass.name}` : "Class Details"}
            </CardTitle>
            <CardDescription>
              {selectedClass ? "Teachers and students currently allocated to this class." : "Select a class from the table to view details."}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!selectedClass} onClick={() => selectedClass && fetchStudentsForClass(selectedClass.id)}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button variant="outline" disabled={!selectedClass} onClick={openAssignTeachers}>
              <BookOpen className="mr-2 size-4" />
              Assign Teachers
            </Button>
            <Button disabled={!selectedClass} onClick={() => selectedClass && openAssignStudentsForClass(selectedClass.id)}>
              <UserPlus className="mr-2 size-4" />
              Assign Students
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {!selectedClass ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Click <span className="font-medium text-foreground">View</span> on a class to load teachers and students here.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Teachers */}
              <div className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Teachers</div>
                  <Badge variant="secondary">{classTeachers.length}</Badge>
                </div>

                {classTeachersLoading ? (
                  <div className="py-6 text-sm text-muted-foreground">Loading teachers…</div>
                ) : classTeachers.length === 0 ? (
                  <div className="py-6 text-sm text-muted-foreground">No teachers assigned yet.</div>
                ) : (
                  <div className="space-y-2">
                    {classTeachers.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                          <div className="text-sm font-medium">{t.full_name}</div>
                          <div className="text-xs text-muted-foreground">{t.email}</div>
                        </div>
                        <Badge variant="outline" className="font-normal">
                          {t.subject?.name ?? "No subject"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Students */}
              <div className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Students</div>
                  <Badge variant="secondary">{classStudents.length}</Badge>
                </div>

                {classStudentsLoading ? (
                  <div className="py-6 text-sm text-muted-foreground">Loading students…</div>
                ) : classStudents.length === 0 ? (
                  <div className="py-6 text-sm text-muted-foreground">No students assigned yet.</div>
                ) : (
                  <div className="max-h-80 overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.map((st) => (
                          <TableRow key={st.id}>
                            <TableCell className="font-medium">{st.full_name}</TableCell>
                            <TableCell>{st.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE CLASS */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Class</DialogTitle>
            <DialogDescription>Create a class name (teachers/subjects will be assigned afterward).</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Class Name</Label>
            <Input
              placeholder="e.g. Form 3A / CS-3A"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createClass}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ASSIGN TEACHERS */}
      <Dialog open={assignTeachersOpen} onOpenChange={setAssignTeachersOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Teachers</DialogTitle>
            <DialogDescription>
              Select teachers for <span className="font-medium">{selectedClass?.name ?? ""}</span>. Each teacher brings their subject automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search teacher / email / subject…"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
              />
            </div>

            <div className="max-h-80 overflow-auto rounded-md border p-3 space-y-2">
              {teacherOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teachers found.</p>
              ) : (
                teacherOptions.map((t) => {
                  const checked = selectedTeacherIds.includes(String(t.id));
                  return (
                    <label key={t.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTeacherIds((prev) => [...prev, String(t.id)]);
                            } else {
                              setSelectedTeacherIds((prev) => prev.filter((x) => x !== String(t.id)));
                            }
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium">{t.full_name}</div>
                          <div className="text-xs text-muted-foreground">{t.email}</div>
                        </div>
                      </div>

                      <Badge variant="outline" className="font-normal">
                        {t.subject?.name ?? "No subject"}
                      </Badge>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTeachersOpen(false)}>
              Cancel
            </Button>
            <Button onClick={assignTeachers}>Save Teachers</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ASSIGN STUDENTS (unchanged from your working one) */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Students to Class</DialogTitle>
            <DialogDescription>Select a class and assign students (writes to student_profile).</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={assignClassId} onValueChange={setAssignClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Student filter</Label>
                <Select
                  value={showOnlyUnassigned ? "unassigned" : "all"}
                  onValueChange={(v) => setShowOnlyUnassigned(v === "unassigned")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Show only unassigned</SelectItem>
                    <SelectItem value="all">Show all students</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Search students</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name/email/class…"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="max-h-72 overflow-auto rounded-md border p-3 space-y-2">
              {studentOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students match your filters.</p>
              ) : (
                studentOptions.map((st) => {
                  const checked = assignStudentIds.includes(String(st.id));
                  const label = `${st.full_name} (${st.email})${st.class?.name ? ` — current: ${st.class.name}` : ""}`;

                  return (
                    <label key={st.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setAssignStudentIds((prev) => [...prev, String(st.id)]);
                          else setAssignStudentIds((prev) => prev.filter((x) => x !== String(st.id)));
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={assignStudents}>Assign Student(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
