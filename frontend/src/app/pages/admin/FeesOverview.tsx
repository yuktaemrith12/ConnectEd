import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  DollarSign, AlertCircle, CheckCircle, Clock, FileText,
  Download, Search, Eye, Receipt, Edit, X, TrendingUp, Filter, Plus, Trash2,
} from "lucide-react";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  adminGetFeeStats, adminGetFeeTrend, adminGetFeeStudents,
  adminRecordPayment, adminGetClasses, adminGetAcademicPeriods,
  adminCreateFeePlan, adminCreateFeePlansBulk, adminExportFeesCsv,
  adminSearchStudents,
  type FeeStats, type FeeTrendPoint, type FeeStudentRead,
  type AdminClass, type AcademicPeriodRead, type StudentSearchResult,
} from "@/app/utils/api";

type PaymentStatus = "paid" | "partial" | "unpaid" | "overdue";

const statusConfig: Record<PaymentStatus, { label: string; color: string; bgColor: string }> = {
  paid: { label: "Paid", color: "text-green-700", bgColor: "bg-green-100" },
  partial: { label: "Partially Paid", color: "text-amber-700", bgColor: "bg-amber-100" },
  unpaid: { label: "Unpaid", color: "text-red-700", bgColor: "bg-red-100" },
  overdue: { label: "Overdue", color: "text-red-800", bgColor: "bg-red-200" },
};

// Default empty installment row for the create-plan modal
const emptyInstallment = () => ({ amount: "", due_date: "" });

export default function AdminFeesOverview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<FeeStudentRead | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [paying, setPaying] = useState(false);

  // Create plan modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"single" | "bulk">("single");
  const [createStudentQuery, setCreateStudentQuery] = useState("");
  const [createStudentResults, setCreateStudentResults] = useState<StudentSearchResult[]>([]);
  const [selectedCreateStudent, setSelectedCreateStudent] = useState<StudentSearchResult | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const createSearchRef = useRef<HTMLDivElement>(null);
  const [createClassId, setCreateClassId] = useState("all");
  const [createBase, setCreateBase] = useState("");
  const [createDiscount, setCreateDiscount] = useState("0");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createPeriodId, setCreatePeriodId] = useState("");
  const [createInstallments, setCreateInstallments] = useState([emptyInstallment()]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [stats, setStats] = useState<FeeStats | null>(null);
  const [trend, setTrend] = useState<FeeTrendPoint[]>([]);
  const [students, setStudents] = useState<FeeStudentRead[]>([]);
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriodRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t] = await Promise.all([adminGetFeeStats(), adminGetFeeTrend()]);
      setStats(s);
      setTrend(t);
    } catch {
      setError("Failed to load fee analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {};
      if (searchQuery) params.search = searchQuery;
      if (filterClass !== "all") params.class_id = parseInt(filterClass);
      if (filterStatus !== "all") params.status = filterStatus;
      const data = await adminGetFeeStudents(params as Parameters<typeof adminGetFeeStudents>[0]);
      setStudents(data);
    } catch {
      setStudents([]);
    }
  }, [searchQuery, filterClass, filterStatus]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => {
    adminGetClasses().then(setClasses).catch(() => { });
    adminGetAcademicPeriods().then(setPeriods).catch(() => { });
  }, []);

  // Student search debounce for Create Plan modal
  useEffect(() => {
    if (createStudentQuery.trim().length === 0) {
      setCreateStudentResults([]);
      setShowCreateDropdown(false);
      return;
    }
    const t = setTimeout(() => {
      adminSearchStudents(createStudentQuery)
        .then((results) => { setCreateStudentResults(results); setShowCreateDropdown(true); })
        .catch(() => setCreateStudentResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [createStudentQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (createSearchRef.current && !createSearchRef.current.contains(e.target as Node)) {
        setShowCreateDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pieData = stats
    ? [
      { name: "Paid", value: stats.fully_paid_count, color: "#10b981" },
      { name: "Partial / Unpaid", value: stats.total_students - stats.fully_paid_count - stats.overdue_count, color: "#f59e0b" },
      { name: "Overdue", value: stats.overdue_count, color: "#ef4444" },
    ]
    : [];

  const handleRecordPayment = async () => {
    if (!selectedStudent || !payAmount) return;
    setPaying(true);
    try {
      const updated = await adminRecordPayment({
        fee_plan_id: selectedStudent.fee_plan_id,
        amount_paid: parseFloat(payAmount),
        payment_method: payMethod,
      });
      setStudents(prev => prev.map(s => s.fee_plan_id === updated.fee_plan_id ? updated : s));
      setSelectedStudent(updated);
      setShowPayModal(false);
      setPayAmount("");
      loadAll();
    } catch {
      alert("Failed to record payment.");
    } finally {
      setPaying(false);
    }
  };

  const resetCreateForm = () => {
    setCreateMode("single");
    setCreateStudentQuery("");
    setCreateStudentResults([]);
    setSelectedCreateStudent(null);
    setShowCreateDropdown(false);
    setCreateClassId("all");
    setCreateBase("");
    setCreateDiscount("0");
    setCreateDueDate("");
    setCreatePeriodId("");
    setCreateInstallments([emptyInstallment()]);
    setCreateError(null);
    setCreateSuccess(null);
  };

  const handleCreatePlan = async () => {
    setCreateError(null);
    setCreateSuccess(null);
    if (!createBase || !createDueDate) {
      setCreateError("Base amount and due date are required.");
      return;
    }
    const installments = createInstallments
      .filter(i => i.amount && i.due_date)
      .map(i => ({ amount: parseFloat(i.amount), due_date: i.due_date }));

    setCreating(true);
    try {
      if (createMode === "single") {
        if (!selectedCreateStudent) { setCreateError("Please search and select a student."); setCreating(false); return; }
        await adminCreateFeePlan({
          student_id: selectedCreateStudent.id,
          base_amount: parseFloat(createBase),
          discount_amount: parseFloat(createDiscount || "0"),
          due_date: createDueDate,
          academic_period_id: createPeriodId ? parseInt(createPeriodId) : undefined,
          installments,
        });
        setCreateSuccess("Fee plan created successfully.");
      } else {
        const result = await adminCreateFeePlansBulk({
          class_id: createClassId !== "all" ? parseInt(createClassId) : undefined,
          base_amount: parseFloat(createBase),
          discount_amount: parseFloat(createDiscount || "0"),
          due_date: createDueDate,
          academic_period_id: createPeriodId ? parseInt(createPeriodId) : undefined,
          installments,
        });
        setCreateSuccess(`Created ${result.created} plans, skipped ${result.skipped} duplicates.`);
      }
      loadStudents();
      loadAll();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail ?? "Failed to create fee plan.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Fees Overview</h1>
            <p className="text-gray-600">Track and manage fee payments</p>
          </div>
          <div className="flex gap-3">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-orange-200 text-orange-600 rounded-xl font-medium hover:bg-orange-50 transition-colors">
              <Plus size={20} />
              Create Plan
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={async () => {
                try {
                  const params: Record<string, string | number> = {};
                  if (searchQuery) params.search = searchQuery;
                  if (filterClass !== "all") params.class_id = parseInt(filterClass);
                  if (filterStatus !== "all") params.status = filterStatus;
                  const blob = await adminExportFeesCsv(params as Parameters<typeof adminExportFeesCsv>[0]);
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "fees_report.csv";
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch {
                  alert("Failed to generate report.");
                }
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow">
              <FileText size={20} />
              <Download size={20} />
              Generate Report
            </motion.button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
            whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-orange-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl"><DollarSign className="text-orange-600" size={24} /></div>
              <div className="flex items-center gap-1 text-green-600 text-sm"><TrendingUp size={16} /><span>+12%</span></div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm">Total Fees Collected</p>
              <p className="text-3xl font-bold">{loading ? "—" : `Rs ${(stats?.total_collected ?? 0).toLocaleString()}`}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-amber-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-xl"><AlertCircle className="text-amber-600" size={24} /></div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm">Outstanding Payments</p>
              <p className="text-3xl font-bold">{loading ? "—" : `Rs ${(stats?.total_outstanding ?? 0).toLocaleString()}`}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-green-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl"><CheckCircle className="text-green-600" size={24} /></div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm">Students Fully Paid</p>
              <p className="text-3xl font-bold">
                {loading ? "—" : stats?.fully_paid_count ?? 0}{" "}
                {stats && stats.total_students > 0 && (
                  <span className="text-lg text-gray-500">
                    ({Math.round((stats.fully_paid_count / stats.total_students) * 100)}%)
                  </span>
                )}
              </p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-red-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-red-100 rounded-xl"><Clock className="text-red-600" size={24} /></div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm">Overdue Accounts</p>
              <p className="text-3xl font-bold">{loading ? "—" : stats?.overdue_count ?? 0}</p>
            </div>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold mb-6">Fee Collection Trend</h3>
            {trend.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No payment data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Amount"]} />
                  <Line type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={3}
                    dot={{ fill: "#f97316", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold mb-6">Payment Status Distribution</h3>
            {pieData.every(d => d.value === 0) ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No fee plans yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle"
                    formatter={(value, entry: any) => (
                      <span className="text-sm text-gray-700">{value}: <strong>{entry.payload.value}</strong></span>
                    )} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Student Fees Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold mb-4">Student Fee Records</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Search by name or student ID..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
                    className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer">
                    <option value="all">All Classes</option>
                    {classes.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer">
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partially Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {students.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                {loading ? "Loading…" : "No fee records found. Create fee plans to see data here."}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Class</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Total Fee</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Amount Paid</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Outstanding</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => {
                    const st: PaymentStatus =
                      student.is_overdue && student.status !== "paid" ? "overdue"
                        : student.status in statusConfig ? student.status as PaymentStatus
                          : "unpaid";
                    return (
                      <motion.tr key={student.fee_plan_id} whileHover={{ backgroundColor: "#f9fafb" }} className="cursor-pointer transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{student.name}</div>
                          {student.academic_period && (
                            <div className="text-xs text-gray-400 mt-0.5">{student.academic_period}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{student.student_code}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{student.class_name}</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">Rs {student.total_fee.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-medium text-green-600">Rs {student.amount_paid.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-medium text-red-600">Rs {student.outstanding_balance.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusConfig[st].bgColor} ${statusConfig[st].color}`}>
                              {statusConfig[st].label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                              onClick={() => setSelectedStudent(student)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View Details">
                              <Eye size={16} className="text-gray-600" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Download Receipt">
                              <Receipt size={16} className="text-gray-600" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                              onClick={() => { setSelectedStudent(student); setShowPayModal(true); }}
                              className="p-2 hover:bg-orange-50 rounded-lg transition-colors" title="Record Payment">
                              <Edit size={16} className="text-orange-600" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>

      {/* Fee Details Modal */}
      <AnimatePresence>
        {selectedStudent && !showPayModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedStudent(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, x: 100 }} animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.95, opacity: 0, x: 100 }} onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
                  <p className="text-sm text-gray-600">{selectedStudent.student_code} • {selectedStudent.class_name}</p>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={24} />
                </motion.button>
              </div>
              <div className="p-6 space-y-6">
                {/* Fee summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Total Fee</p>
                    <p className="text-xl font-bold">Rs {selectedStudent.total_fee.toLocaleString()}</p>
                    {selectedStudent.discount_amount > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        -Rs {selectedStudent.discount_amount.toLocaleString()} discount
                      </p>
                    )}
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Paid</p>
                    <p className="text-xl font-bold text-green-600">Rs {selectedStudent.amount_paid.toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Outstanding</p>
                    <p className="text-xl font-bold text-red-600">Rs {selectedStudent.outstanding_balance.toLocaleString()}</p>
                  </div>
                </div>

                {/* Installment schedule */}
                {selectedStudent.installments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold mb-3">Installment Schedule</h3>
                    <div className="space-y-2">
                      {selectedStudent.installments.map((inst, i) => (
                        <div key={inst.id}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border ${inst.is_overdue ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Installment {i + 1}</span>
                            <span className="ml-3 text-sm text-gray-500">
                              Due {new Date(inst.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">Rs {inst.amount.toLocaleString()}</span>
                            {inst.is_overdue && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Overdue</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold mb-4">Payment History</h3>
                  {selectedStudent.payment_history.length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.payment_history.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                          <div>
                            <p className="font-medium text-gray-900">Rs {payment.amount.toLocaleString()}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(payment.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {" "}&middot; {payment.payment_method}
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Completed</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No payment history available</div>
                  )}
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                  <Receipt size={48} className="text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Receipt preview will appear here</p>
                </div>
              </div>
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPayModal(true)}
                  className="px-6 py-2.5 border-2 border-orange-200 text-orange-600 font-medium rounded-xl hover:bg-orange-50 transition-colors">
                  Record Payment
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                  <Download size={18} />
                  Download Receipt
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {showPayModal && selectedStudent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPayModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold">Record Payment</h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowPayModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={22} />
                </motion.button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Student: <strong>{selectedStudent.name}</strong></p>
                  <p className="text-sm text-gray-600">Outstanding: <strong className="text-red-600">Rs {selectedStudent.outstanding_balance.toLocaleString()}</strong></p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                  <input type="number" min="1" max={selectedStudent.outstanding_balance} value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all">
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Card</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPayModal(false)}
                  className="px-5 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors">
                  Cancel
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleRecordPayment} disabled={paying || !payAmount}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50">
                  {paying ? "Saving…" : "Save Payment"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Fee Plan Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold">Create Fee Plan</h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={22} />
                </motion.button>
              </div>

              <div className="p-6 space-y-5">
                {/* Mode toggle */}
                <div className="flex rounded-xl overflow-hidden border border-gray-200">
                  {(["single", "bulk"] as const).map((m) => (
                    <button key={m} onClick={() => setCreateMode(m)}
                      className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${createMode === m ? "bg-orange-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                      {m === "single" ? "Single Student" : "Bulk (Class / School)"}
                    </button>
                  ))}
                </div>

                {/* Target */}
                {createMode === "single" ? (
                  <div ref={createSearchRef}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Search Student</label>
                    {selectedCreateStudent ? (
                      <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-2 border-orange-300 rounded-xl">
                        <div>
                          <span className="font-medium text-gray-900">{selectedCreateStudent.full_name}</span>
                          {selectedCreateStudent.class_name && (
                            <span className="ml-2 text-sm text-gray-500">({selectedCreateStudent.class_name})</span>
                          )}
                          <span className="ml-2 text-xs text-gray-400">ID: {selectedCreateStudent.id}</span>
                        </div>
                        <button onClick={() => { setSelectedCreateStudent(null); setCreateStudentQuery(""); }}
                          className="p-1 hover:bg-orange-100 rounded-lg transition-colors text-gray-500 hover:text-red-500">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" value={createStudentQuery}
                          onChange={(e) => setCreateStudentQuery(e.target.value)}
                          onFocus={() => createStudentResults.length > 0 && setShowCreateDropdown(true)}
                          placeholder="Type student name or ID..."
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                        {showCreateDropdown && createStudentResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                            {createStudentResults.map((s) => (
                              <button key={s.id}
                                onClick={() => { setSelectedCreateStudent(s); setCreateStudentQuery(""); setShowCreateDropdown(false); setCreateStudentResults([]); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors text-gray-700">
                                <span className="font-medium">{s.full_name}</span>
                                <span className="text-gray-400 text-xs">{s.class_name ?? "No class"} · ID: {s.id}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {showCreateDropdown && createStudentQuery.trim().length > 0 && createStudentResults.length === 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 px-4 py-3 text-sm text-gray-400">
                            No students found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Class</label>
                    <select value={createClassId} onChange={(e) => setCreateClassId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all">
                      <option value="all">All Students (whole school)</option>
                      {classes.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Academic Period */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Academic Period <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select value={createPeriodId} onChange={(e) => setCreatePeriodId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all">
                    <option value="">— None —</option>
                    {periods.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                  </select>
                </div>

                {/* Base amount + Discount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Base Amount</label>
                    <input type="number" min="0" value={createBase} onChange={(e) => setCreateBase(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Discount</label>
                    <input type="number" min="0" value={createDiscount} onChange={(e) => setCreateDiscount(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                  </div>
                </div>
                {createBase && (
                  <p className="text-sm text-gray-500 -mt-2">
                    Total: <strong>Rs {(parseFloat(createBase || "0") - parseFloat(createDiscount || "0")).toLocaleString()}</strong>
                  </p>
                )}

                {/* Due date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                  <input type="date" value={createDueDate} onChange={(e) => setCreateDueDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                </div>

                {/* Installments */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-gray-700">Installments <span className="text-gray-400 font-normal">(optional)</span></label>
                    <button onClick={() => setCreateInstallments(prev => [...prev, emptyInstallment()])}
                      className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium">
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {createInstallments.map((inst, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="number" min="0" placeholder="Amount" value={inst.amount}
                          onChange={(e) => setCreateInstallments(prev => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                        <input type="date" value={inst.due_date}
                          onChange={(e) => setCreateInstallments(prev => prev.map((x, i) => i === idx ? { ...x, due_date: e.target.value } : x))}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                        {createInstallments.length > 1 && (
                          <button onClick={() => setCreateInstallments(prev => prev.filter((_, i) => i !== idx))}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {createError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>}
                {createSuccess && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{createSuccess}</p>}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors">
                  Cancel
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleCreatePlan} disabled={creating || !createBase || !createDueDate}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50">
                  {creating ? "Creating…" : createMode === "single" ? "Create Plan" : "Create for Class"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
