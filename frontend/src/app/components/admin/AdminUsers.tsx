import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import { API_BASE_URL } from "../../config/api";

type Role = "student" | "teacher" | "admin";

type StudentRow = {
  id: number;
  full_name: string;
  email: string;
  status: "active" | "inactive";
  class?: string | null;
};

type TeacherRow = {
  id: number;
  full_name: string;
  email: string;
  status: "active" | "inactive";
  subject?: string | null;
  classes?: string; // comma-separated string from backend
};

type AdminRow = {
  id: number;
  full_name: string;
  email: string;
  status: "active" | "inactive";
};

type ClassItem = { id: number; name: string };
type SubjectItem = { id: number; name: string };

export default function AdminUsers() {
  const token = localStorage.getItem("token");

  const [activeTab, setActiveTab] = useState<Role>("student");
  const [loading, setLoading] = useState(false);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);

  // dropdown data (used by Create User dialog)
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  // Create user dialog state
  const [open, setOpen] = useState(false);
  const [newRole, setNewRole] = useState<Role>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  // student specific
  const [studentClassId, setStudentClassId] = useState<string>("");

  // teacher specific
  const [teacherSubjectId, setTeacherSubjectId] = useState<string>("");
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([]);

  const authHeaders = useMemo(() => {
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  async function fetchUsers(role: Role) {
    if (!authHeaders) {
      toast.error("Missing token. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users?role=${role}`, {
        headers: {
          ...authHeaders,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.detail || `Failed to load ${role}s`);
        return;
      }

      if (role === "student") setStudents(data);
      if (role === "teacher") setTeachers(data);
      if (role === "admin") setAdmins(data);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
    } finally {
      setLoading(false);
    }
  }

  async function fetchDropdowns() {
    // If you don't have these endpoints yet, comment this out and tell me.
    try {
      const [cRes, sRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/classes`, { headers: authHeaders || undefined }),
        fetch(`${API_BASE_URL}/admin/subjects`, { headers: authHeaders || undefined }),
      ]);

      if (cRes.ok) setClasses(await cRes.json());
      if (sRes.ok) setSubjects(await sRes.json());
    } catch {
      // non-fatal (dialog can still work if you type IDs manually, but you asked for dropdowns)
    }
  }

  useEffect(() => {
    fetchUsers(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (open) fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetDialog() {
    setNewRole("student");
    setFullName("");
    setEmail("");
    setTempPassword("");
    setStudentClassId("");
    setTeacherSubjectId("");
    setTeacherClassIds([]);
  }

  async function handleCreateUser() {
    if (!authHeaders) {
      toast.error("Missing token. Please login again.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanName || !cleanEmail || !tempPassword) {
      toast.error("Please fill name, email and temp password.");
      return;
    }

    // role-specific validation
    if (newRole === "student" && !studentClassId) {
      toast.error("Select a class for the student.");
      return;
    }
    if (newRole === "teacher" && !teacherSubjectId) {
      toast.error("Select a subject for the teacher.");
      return;
    }

    const payload: any = {
      role: newRole,
      full_name: cleanName,
      email: cleanEmail,
      password: tempPassword,
    };

    if (newRole === "student") payload.class_id = Number(studentClassId);
    if (newRole === "teacher") {
      payload.subject_id = Number(teacherSubjectId);
      payload.class_ids = teacherClassIds.map((x) => Number(x));
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.detail || "Failed to create user");
        return;
      }

      toast.success("User created!");
      setOpen(false);
      resetDialog();

      // refresh current tab
      fetchUsers(activeTab);
    } catch {
      toast.error("Cannot reach backend. Is FastAPI running?");
    }
  }

  const statusBadge = (status: "active" | "inactive") => (
    <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">
      {status}
    </Badge>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage students, teachers, and admins</CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchUsers(activeTab)}
            disabled={loading}
          >
            Refresh
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>+ Add User</Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Add a new student, teacher, or admin to ConnectEd.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>User Type</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                {/* STUDENT: class dropdown */}
                {newRole === "student" && (
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select value={studentClassId} onValueChange={setStudentClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* TEACHER: subject dropdown + classes multi-select (simple checkbox list) */}
                {newRole === "teacher" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select value={teacherSubjectId} onValueChange={setTeacherSubjectId}>
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

                    <div className="space-y-2">
                      <Label>Classes allocated</Label>
                      <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-2">
                        {classes.map((c) => {
                          const checked = teacherClassIds.includes(String(c.id));
                          return (
                            <label key={c.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTeacherClassIds((prev) => [...prev, String(c.id)]);
                                  } else {
                                    setTeacherClassIds((prev) =>
                                      prev.filter((x) => x !== String(c.id))
                                    );
                                  }
                                }}
                              />
                              {c.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ADMIN: no class/subject */}
                <div className="space-y-2">
                  <Label>Temp Password</Label>
                  <Input
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Enter temporary password"
                    type="password"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    resetDialog();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateUser}>Add User</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Role)}>
          <TabsList>
            <TabsTrigger value="student">Students</TabsTrigger>
            <TabsTrigger value="teacher">Teachers</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
          </TabsList>

          {/* STUDENTS */}
          <TabsContent value="student" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.class || "—"}</TableCell>
                      <TableCell className="text-right">{statusBadge(u.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* TEACHERS */}
          <TabsContent value="teacher" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  teachers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.subject || "—"}</TableCell>
                      <TableCell>{u.classes?.trim() ? u.classes : "—"}</TableCell>
                      <TableCell className="text-right">{statusBadge(u.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ADMINS */}
          <TabsContent value="admin" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell className="text-right">{statusBadge(u.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
