import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import {
  Search, Plus, Download,
  Users, GraduationCap, UserCircle, X, Check, Pencil, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  AdminUser, AdminClass, AdminSubject, UserDetail, StudentSearchResult,
  adminGetUsers, adminToggleStatus, adminAssignClass,
  adminGetClasses, adminGetSubjects,
  adminCreateUser, UserCreatePayload,
  adminGetUserDetail, adminUpdateUser, UserUpdatePayload,
  adminDeleteUser, adminResetPassword,
  adminSearchStudents, adminExportUsers,
} from "@/app/utils/api";

type TabId = "student" | "teacher" | "parent";
type AddRole = "student" | "teacher" | "parent";

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "student", label: "Students", icon: GraduationCap },
  { id: "teacher", label: "Teachers", icon: Users },
  { id: "parent", label: "Parents", icon: UserCircle },
];

const AVATAR_COLORS: Record<TabId, string> = {
  student: "from-blue-400 to-blue-600",
  teacher: "from-purple-400 to-purple-600",
  parent: "from-green-400 to-green-600",
};

const RELATIONSHIP_OPTIONS = ["Guardian", "Mother", "Father", "Grandparent", "Other"];

const INPUT_CLS =
  "w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none";

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<TabId>("student");
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  // ── Add User modal ─────────────────────────────────────────────────────────
  const [showAddUser, setShowAddUser] = useState(false);
  const [addRole, setAddRole] = useState<AddRole>("student");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addClassId, setAddClassId] = useState<number | "">("");
  const [addDob, setAddDob] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addSubjectIds, setAddSubjectIds] = useState<number[]>([]);
  const [addBio, setAddBio] = useState("");
  const [addSelectedStudents, setAddSelectedStudents] = useState<StudentSearchResult[]>([]);
  const [addRelationship, setAddRelationship] = useState("Guardian");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ── Student autocomplete (shared — only one modal open at a time) ──────────
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);

  // ── Edit User modal ────────────────────────────────────────────────────────
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editDetail, setEditDetail] = useState<UserDetail | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editClassId, setEditClassId] = useState<number | "">("");
  const [editDob, setEditDob] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSubjectIds, setEditSubjectIds] = useState<number[]>([]);
  const [editBio, setEditBio] = useState("");
  const [editSelectedStudents, setEditSelectedStudents] = useState<StudentSearchResult[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  // password reset (inside edit modal)
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  // ── Delete confirmation ────────────────────────────────────────────────────
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const generatedEmail =
    firstName.trim() && lastName.trim()
      ? `${firstName.trim().toLowerCase()}${lastName.trim()[0].toLowerCase()}@${addRole}.connected.com`
      : "";

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchTerm]);

  useEffect(() => {
    adminGetClasses().then(setClasses).catch(() => { });
    adminGetSubjects().then(setSubjects).catch(() => { });
  }, []);

  // Student autocomplete debounce
  useEffect(() => {
    if (studentQuery.trim().length === 0) {
      setStudentResults([]);
      return;
    }
    const t = setTimeout(() => {
      adminSearchStudents(studentQuery).then(setStudentResults).catch(() => { });
    }, 300);
    return () => clearTimeout(t);
  }, [studentQuery]);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetUsers(activeTab, searchTerm || undefined);
      setUsers(data);
    } catch {
      setError("Failed to load users. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  // ── Status / class handlers ────────────────────────────────────────────────
  async function handleToggleStatus(user: AdminUser) {
    try {
      const updated = await adminToggleStatus(user.id, !user.is_active);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      alert("Failed to update status.");
    }
  }

  async function handleAssignClass(userId: number, classId: number) {
    try {
      const updated = await adminAssignClass(userId, classId);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      alert("Failed to assign class.");
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async function handleExport() {
    try {
      const blob = await adminExportUsers(activeTab, searchTerm || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeTab}s_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed.");
    }
  }

  // ── Add User ───────────────────────────────────────────────────────────────
  function resetAddForm() {
    setFirstName(""); setLastName("");
    setAddRole("student");
    setAddClassId(""); setAddDob(""); setAddPhone(""); setAddAddress("");
    setAddSubjectIds([]); setAddBio("");
    setAddSelectedStudents([]); setAddRelationship("Guardian");
    setStudentQuery(""); setStudentResults([]);
    setCreateError("");
  }

  function toggleAddSubject(id: number) {
    setAddSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const payload: UserCreatePayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: addRole,
      };
      if (addRole === "student") {
        payload.student = {
          class_id: addClassId || null,
          dob: addDob || undefined,
          phone: addPhone || undefined,
          address: addAddress || undefined,
        };
      } else if (addRole === "teacher") {
        payload.teacher = {
          subject_ids: addSubjectIds,
          bio: addBio || undefined,
          phone: addPhone || undefined,
          address: addAddress || undefined,
        };
      } else if (addRole === "parent") {
        payload.parent = {
          student_ids: addSelectedStudents.map((s) => s.id),
          relationship: addRelationship,
          phone: addPhone || undefined,
          address: addAddress || undefined,
        };
      }
      const created = await adminCreateUser(payload);
      if (activeTab === addRole) setUsers((prev) => [created, ...prev]);
      setShowAddUser(false);
      resetAddForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCreateError(msg ?? "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  // ── Edit User ──────────────────────────────────────────────────────────────
  async function openEdit(user: AdminUser) {
    setEditingUser(user);
    setEditLoading(true);
    setEditError("");
    setNewPassword("");
    setResetMsg("");
    setStudentQuery("");
    setStudentResults([]);
    try {
      const detail = await adminGetUserDetail(user.id);
      setEditDetail(detail);
      setEditName(detail.full_name);
      setEditIsActive(detail.is_active);
      const cls = classes.find((c) => c.name === detail.class_name);
      setEditClassId(cls?.id ?? "");
      setEditDob(detail.dob ?? "");
      setEditPhone(detail.phone ?? "");
      setEditAddress(detail.address ?? "");
      setEditSubjectIds(detail.subject_ids ?? []);
      setEditBio(detail.bio ?? "");
      if (detail.role === "parent" && detail.linked_student_ids.length > 0) {
        const allStu = await adminGetUsers("student");
        setEditSelectedStudents(
          allStu
            .filter((s) => detail.linked_student_ids.includes(s.id))
            .map((s) => ({ id: s.id, full_name: s.full_name, class_name: s.class_name }))
        );
      } else {
        setEditSelectedStudents([]);
      }
    } catch {
      setEditError("Failed to load user details.");
    } finally {
      setEditLoading(false);
    }
  }

  function toggleEditSubject(id: number) {
    setEditSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSaveEdit() {
    if (!editingUser || !editDetail) return;
    setEditSaving(true);
    setEditError("");
    try {
      const payload: UserUpdatePayload = {
        full_name: editName.trim() || undefined,
        is_active: editIsActive,
      };
      if (editDetail.role === "student") {
        payload.student = {
          class_id: editClassId || null,
          dob: editDob || undefined,
          phone: editPhone || undefined,
          address: editAddress || undefined,
        };
      } else if (editDetail.role === "teacher") {
        payload.teacher = {
          subject_ids: editSubjectIds,
          bio: editBio || undefined,
          phone: editPhone || undefined,
          address: editAddress || undefined,
        };
      } else if (editDetail.role === "parent") {
        payload.parent = {
          student_ids: editSelectedStudents.map((s) => s.id),
          phone: editPhone || undefined,
          address: editAddress || undefined,
        };
      }
      const updated = await adminUpdateUser(editingUser.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUser(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setEditError(msg ?? "Failed to update user.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!editingUser) return;
    setResetting(true);
    setResetMsg("");
    try {
      await adminResetPassword(editingUser.id, newPassword || "12345");
      setResetMsg("Password reset successfully!");
      setNewPassword("");
    } catch {
      setResetMsg("Failed to reset password.");
    } finally {
      setResetting(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await adminDeleteUser(deletingUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setDeletingUser(null);
    } catch {
      alert("Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Student picker helpers ─────────────────────────────────────────────────
  function pickStudent(
    s: StudentSearchResult,
    selected: StudentSearchResult[],
    setSelected: (v: StudentSearchResult[]) => void
  ) {
    if (!selected.some((x) => x.id === s.id)) setSelected([...selected, s]);
    setStudentQuery("");
    setStudentResults([]);
  }

  function unpickStudent(
    id: number,
    selected: StudentSearchResult[],
    setSelected: (v: StudentSearchResult[]) => void
  ) {
    setSelected(selected.filter((s) => s.id !== id));
  }

  // ── Student picker JSX (called as a function, not a component) ────────────
  function renderStudentPicker(
    selected: StudentSearchResult[],
    setSelected: (v: StudentSearchResult[]) => void
  ) {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Link to Student(s)</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name…"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            className={INPUT_CLS}
          />
          {studentResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-44 overflow-y-auto">
              {studentResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickStudent(s, selected, setSelected)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-orange-50 text-gray-700"
                >
                  <span className="font-medium">{s.full_name}</span>
                  {s.class_name && (
                    <span className="text-gray-400 ml-auto text-xs">{s.class_name}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selected.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-lg text-sm"
              >
                {s.full_name}
                <button onClick={() => unpickStudent(s.id, selected, setSelected)}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-gray-600">Manage students, teachers, and parents</p>
          </div>
          <div className="flex gap-3 items-center">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleExport}
              className="px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <Download size={18} /> Export CSV
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { resetAddForm(); setShowAddUser(true); }}
              className="px-6 py-3 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-medium shadow-lg flex items-center gap-2"
            >
              <Plus size={20} /> Add User
            </motion.button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl p-2 border border-gray-100 shadow-sm">
          <div className="flex gap-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setSearchTerm(""); }}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${activeTab === id
                  ? "bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white shadow-lg"
                  : "text-gray-600 hover:bg-gray-50"
                  }`}
              >
                <Icon size={18} />
                {label}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === id ? "bg-white/20" : "bg-gray-100"}`}>
                  {activeTab === id ? users.length : "—"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={`Search ${activeTab}s by name or email…`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          {loading ? (
            <div className="flex justify-center items-center py-16 text-gray-500">Loading…</div>
          ) : users.length === 0 ? (
            <div className="flex justify-center items-center py-16 text-gray-400">
              No {activeTab}s found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
                    {activeTab === "student" && (
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Class</th>
                    )}
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <motion.tr
                      key={user.id}
                      whileHover={{ backgroundColor: "#f9fafb" }}
                      className="transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 bg-gradient-to-br ${AVATAR_COLORS[activeTab]} rounded-full flex items-center justify-center text-white font-medium text-sm`}>
                            {initials(user.full_name)}
                          </div>
                          <span className="font-medium">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      {activeTab === "student" && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <select
                            value={classes.find((c) => c.name === user.class_name)?.id ?? ""}
                            onChange={(e) => e.target.value && handleAssignClass(user.id, Number(e.target.value))}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                          >
                            <option value="">— unassigned —</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {user.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${user.is_active
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                              }`}
                          >
                            {user.is_active ? "Suspend" : "Activate"}
                          </button>
                          <button
                            onClick={() => openEdit(user)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingUser(user)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Add User Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAddUser(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add New User</h2>
                <button onClick={() => setShowAddUser(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                  <input type="text" placeholder="Emma" value={firstName}
                    onChange={(e) => setFirstName(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                  <input type="text" placeholder="Kumar" value={lastName}
                    onChange={(e) => setLastName(e.target.value)} className={INPUT_CLS} />
                </div>
              </div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(["student", "teacher", "parent"] as AddRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setAddRole(r); setAddSubjectIds([]); setAddSelectedStudents([]); setStudentQuery(""); setStudentResults([]); }}
                    className={`py-2 rounded-xl border-2 text-sm font-medium capitalize transition-all ${addRole === r
                      ? "border-orange-400 bg-orange-50 text-orange-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {generatedEmail && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-5">
                  <p className="text-xs text-blue-500 font-medium mb-0.5">Generated Email</p>
                  <p className="text-sm font-mono text-blue-700">{generatedEmail}</p>
                </div>
              )}

              {/* Student fields */}
              {addRole === "student" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Class</label>
                    <select value={addClassId}
                      onChange={(e) => setAddClassId(e.target.value === "" ? "" : Number(e.target.value))}
                      className={INPUT_CLS}>
                      <option value="">— Unassigned —</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date of Birth</label>
                    <input type="date" value={addDob} onChange={(e) => setAddDob(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                    <input type="text" placeholder="+1 555 0000" value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                    <input type="text" placeholder="123 Main St" value={addAddress}
                      onChange={(e) => setAddAddress(e.target.value)} className={INPUT_CLS} />
                  </div>
                </div>
              )}

              {/* Teacher fields */}
              {addRole === "teacher" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Subjects Taught</label>
                    <div className="grid grid-cols-2 gap-2">
                      {subjects.map((s) => {
                        const on = addSubjectIds.includes(s.id);
                        return (
                          <button key={s.id} onClick={() => toggleAddSubject(s.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${on ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                              }`}>
                            {on && <Check size={13} />}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Bio</label>
                    <textarea rows={2} placeholder="Short bio…" value={addBio}
                      onChange={(e) => setAddBio(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                    <input type="text" placeholder="+1 555 0000" value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                    <input type="text" placeholder="123 Main St" value={addAddress}
                      onChange={(e) => setAddAddress(e.target.value)} className={INPUT_CLS} />
                  </div>
                </div>
              )}

              {/* Parent fields */}
              {addRole === "parent" && (
                <div className="space-y-3">
                  {renderStudentPicker(addSelectedStudents, setAddSelectedStudents)}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Relationship</label>
                    <select value={addRelationship} onChange={(e) => setAddRelationship(e.target.value)} className={INPUT_CLS}>
                      {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                    <input type="text" placeholder="+1 555 0000" value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                    <input type="text" placeholder="123 Main St" value={addAddress}
                      onChange={(e) => setAddAddress(e.target.value)} className={INPUT_CLS} />
                  </div>
                </div>
              )}

              {createError && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">
                  {createError}
                </div>
              )}
              <p className="mt-4 text-xs text-gray-400">
                Default password: <span className="font-mono">12345</span>
              </p>
              <button
                onClick={handleCreate}
                disabled={creating || !firstName.trim() || !lastName.trim()}
                className="mt-4 w-full py-3 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-semibold disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create User"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit User Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setEditingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Edit User</h2>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              {editLoading ? (
                <div className="py-12 text-center text-gray-400">Loading…</div>
              ) : (
                <>
                  {/* Full Name */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                      className={INPUT_CLS} />
                  </div>

                  {/* Status toggle */}
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-sm font-semibold text-gray-700">Account Status</span>
                    <button
                      onClick={() => setEditIsActive((v) => !v)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${editIsActive
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                    >
                      {editIsActive ? "Active" : "Suspended"}
                    </button>
                  </div>

                  {/* Student-specific */}
                  {editDetail?.role === "student" && (
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Class</label>
                        <select value={editClassId}
                          onChange={(e) => setEditClassId(e.target.value === "" ? "" : Number(e.target.value))}
                          className={INPUT_CLS}>
                          <option value="">— Unassigned —</option>
                          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Date of Birth</label>
                        <input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)}
                          className={INPUT_CLS} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                        <input type="text" placeholder="+1 555 0000" value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)} className={INPUT_CLS} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                        <input type="text" placeholder="123 Main St" value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)} className={INPUT_CLS} />
                      </div>
                    </div>
                  )}

                  {/* Teacher-specific */}
                  {editDetail?.role === "teacher" && (
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Subjects Taught</label>
                        <div className="grid grid-cols-2 gap-2">
                          {subjects.map((s) => {
                            const on = editSubjectIds.includes(s.id);
                            return (
                              <button key={s.id} onClick={() => toggleEditSubject(s.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${on ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                  }`}>
                                {on && <Check size={13} />}
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Bio</label>
                        <textarea rows={2} placeholder="Short bio…" value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none resize-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                        <input type="text" placeholder="+1 555 0000" value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)} className={INPUT_CLS} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                        <input type="text" placeholder="123 Main St" value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)} className={INPUT_CLS} />
                      </div>
                    </div>
                  )}

                  {/* Parent-specific */}
                  {editDetail?.role === "parent" && (
                    <div className="space-y-3 mb-4">
                      {renderStudentPicker(editSelectedStudents, setEditSelectedStudents)}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                        <input type="text" placeholder="+1 555 0000" value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)} className={INPUT_CLS} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                        <input type="text" placeholder="123 Main St" value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)} className={INPUT_CLS} />
                      </div>
                    </div>
                  )}

                  {editError && (
                    <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">
                      {editError}
                    </div>
                  )}

                  <button
                    onClick={handleSaveEdit}
                    disabled={editSaving}
                    className="w-full py-3 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-semibold disabled:opacity-60"
                  >
                    {editSaving ? "Saving…" : "Save Changes"}
                  </button>

                  {/* Password Reset section */}
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="text-gray-400">🔑</span> Reset Password
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="New password (blank = 12345)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm"
                      />
                      <button
                        onClick={handleResetPassword}
                        disabled={resetting}
                        className="px-4 py-2 bg-gray-700 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-60 whitespace-nowrap"
                      >
                        {resetting ? "Resetting…" : "Reset"}
                      </button>
                    </div>
                    {resetMsg && (
                      <p className={`mt-2 text-xs font-medium ${resetMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                        {resetMsg}
                      </p>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {deletingUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setDeletingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mx-auto mb-5">
                <Trash2 size={26} className="text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-center mb-2">Delete User?</h2>
              <p className="text-center text-gray-600 text-sm mb-1">
                You are about to delete <span className="font-semibold">{deletingUser.full_name}</span>.
              </p>
              <p className="text-center text-gray-400 text-xs mb-6">
                This is a soft delete — historical records (grades, attendance) are preserved in the database.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingUser(null)}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
