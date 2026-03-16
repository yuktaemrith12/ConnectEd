import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion } from "motion/react";
import { useParams } from "react-router";
import {
  CheckCircle2,
  DollarSign,
  CreditCard,
  Calendar,
  Info,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
} from "lucide-react";
import { parentGetChildFees, ParentFeeStatus } from "@/app/utils/api";

const feeNotes = [
  "Please ensure all term fees are cleared before the end of the academic term.",
  "Late payment charges may apply for payments received after the due date.",
  "For payment queries, please contact the administration office.",
];

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    paid:    { label: "Paid",    cls: "bg-green-100 text-green-700",  Icon: CheckCircle2 },
    partial: { label: "Partial", cls: "bg-amber-100 text-amber-700",  Icon: Clock },
    unpaid:  { label: "Unpaid",  cls: "bg-red-100 text-red-700",     Icon: XCircle },
    overdue: { label: "Overdue", cls: "bg-red-100 text-red-700",     Icon: AlertCircle },
    no_plan: { label: "No Plan", cls: "bg-gray-100 text-gray-500",   Icon: Info },
  };
  const { label, cls, Icon } = map[status] ?? map["no_plan"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${cls}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}

export default function ParentFees() {
  const { childId } = useParams<{ childId: string }>();
  const [fees, setFees] = useState<ParentFeeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    if (!childId || childId === "0") { setLoading(false); return; }
    parentGetChildFees(Number(childId))
      .then(setFees)
      .catch(() => setError("Failed to load fee information."))
      .finally(() => setLoading(false));
  }, [childId]);

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

  const history = fees?.payment_history ?? [];
  const visibleHistory = showAllHistory ? history : history.slice(0, 5);

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Fee Management</h1>
          <p className="text-gray-600 mb-3">View and manage fee payments</p>
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
            <Info size={16} className="text-blue-600" />
            <span className="text-sm text-blue-700">
              All fee information is provided by the school administration.
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* No fee plan state */}
        {!fees || !fees.has_plan ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center"
          >
            <DollarSign size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">No fee plan assigned</p>
            <p className="text-sm text-gray-400 mt-1">
              Contact the school administration for fee details.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Section 1: Fee Overview Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    fees.status === "paid"
                      ? "bg-gradient-to-br from-green-500 to-green-600"
                      : fees.status === "overdue"
                      ? "bg-gradient-to-br from-red-500 to-red-600"
                      : "bg-gradient-to-br from-amber-500 to-amber-600"
                  }`}>
                    {fees.status === "paid"
                      ? <CheckCircle2 size={24} className="text-white" />
                      : fees.status === "overdue"
                      ? <AlertCircle size={24} className="text-white" />
                      : <Clock size={24} className="text-white" />}
                  </div>
                </div>
                <StatusChip status={fees.status} />
                <p className="text-sm text-gray-600 font-medium mt-3">Current Fee Status</p>
                {fees.academic_period && (
                  <p className="text-xs text-gray-400 mt-1">{fees.academic_period}</p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <DollarSign size={24} className="text-white" />
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-800 mb-1">
                  Rs {fees.total_fee.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 font-medium">Total Fees</p>
                <p className="text-xs text-gray-400 mt-1">
                  Paid: Rs {fees.amount_paid.toLocaleString()}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    fees.outstanding_balance === 0
                      ? "bg-gradient-to-br from-green-500 to-green-600"
                      : "bg-gradient-to-br from-red-500 to-red-600"
                  }`}>
                    <CreditCard size={24} className="text-white" />
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-800 mb-1">
                  Rs {fees.outstanding_balance.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 font-medium">Outstanding Balance</p>
                <p className="text-xs text-gray-400 mt-1">
                  {fees.outstanding_balance === 0
                    ? "All fees cleared"
                    : fees.due_date
                    ? `Due: ${fees.due_date}`
                    : "Amount pending"}
                </p>
              </motion.div>
            </div>

            {/* Section 2: Payment Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full" />
                  Fee Plan Summary
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <motion.tr
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        Total Fee
                        {fees.academic_period && (
                          <span className="ml-2 text-xs text-gray-400">({fees.academic_period})</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800 text-right">
                        Rs {fees.total_fee.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">—</td>
                    </motion.tr>
                    <motion.tr
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">Amount Paid</td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-700 text-right">
                        Rs {fees.amount_paid.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          <CheckCircle2 size={12} /> Received
                        </span>
                      </td>
                    </motion.tr>
                    <motion.tr
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        Outstanding Balance
                        {fees.due_date && (
                          <span className={`ml-2 text-xs ${fees.is_overdue ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                            {fees.is_overdue ? "OVERDUE · " : "Due: "}
                            {fees.due_date}
                          </span>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold text-right ${
                        fees.outstanding_balance > 0 ? "text-red-600" : "text-gray-800"
                      }`}>
                        Rs {fees.outstanding_balance.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusChip status={fees.status} />
                      </td>
                    </motion.tr>
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Section 3: Payment History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full" />
                Payment History
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleHistory.map((payment, index) => (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.05 }}
                        className="p-4 bg-gradient-to-r from-gray-50 to-transparent rounded-xl border border-gray-100 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-800">
                              {payment.payment_method}
                            </p>
                            {payment.transaction_id && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Ref: {payment.transaction_id}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Calendar size={12} />
                              {payment.date}
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-sm font-bold text-gray-800">
                              Rs {payment.amount.toLocaleString()}
                            </p>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 mt-1">
                              <CheckCircle2 size={10} /> Paid
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  {history.length > 5 && (
                    <button
                      onClick={() => setShowAllHistory(v => !v)}
                      className="mt-4 text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      {showAllHistory ? "Show less" : `View all ${history.length} payments`}
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}

        {/* Section 4: Payment Notes (always shown) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100 shadow-sm"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
            <Info size={20} className="text-amber-600" />
            Important Notes
          </h3>
          <div className="space-y-3">
            {feeNotes.map((note, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-white/60 rounded-lg">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700">{note}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
