import { useState, useEffect } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Plus, Edit2, ToggleLeft, ToggleRight, X, Check } from "lucide-react";
import {
  Location,
  adminGetLocations, adminCreateLocation, adminUpdateLocation, adminDeactivateLocation,
} from "@/app/utils/api";

const LOCATION_TYPES = ["Classroom", "Lab", "Hall", "Library", "Gym", "Other"];

interface FormState {
  name: string;
  type: string;
  capacity: string;
}

const EMPTY_FORM: FormState = { name: "", type: "Classroom", capacity: "" };

export default function LocationsManagement() {
  const [locations, setLocations]     = useState<Location[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [msg, setMsg]                 = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Location | null>(null);
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await adminGetLocations(false);
      setLocations(data);
    } catch {
      setError("Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(loc: Location) {
    setEditTarget(loc);
    setForm({ name: loc.name, type: loc.type, capacity: loc.capacity?.toString() ?? "" });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      };
      if (editTarget) {
        const updated = await adminUpdateLocation(editTarget.id, payload);
        setLocations((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      } else {
        const created = await adminCreateLocation(payload);
        setLocations((prev) => [created, ...prev]);
      }
      setShowModal(false);
      setMsg(editTarget ? "Location updated." : "Location added.");
      setTimeout(() => setMsg(""), 3000);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(loc: Location) {
    try {
      if (loc.is_active) {
        await adminDeactivateLocation(loc.id);
        setLocations((prev) => prev.map((l) => l.id === loc.id ? { ...l, is_active: false } : l));
      } else {
        const updated = await adminUpdateLocation(loc.id, { is_active: true });
        setLocations((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      }
    } catch {
      setError("Failed to update location status.");
    }
  }

  const visible = locations.filter((l) => showInactive || l.is_active);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold mb-2">Locations</h1>
            <p className="text-gray-600">Manage classrooms, labs, and other school spaces</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded" />
              Show inactive
            </label>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={openAdd}
              className="px-4 py-2 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-medium shadow text-sm flex items-center gap-2">
              <Plus size={16} /> Add Location
            </motion.button>
          </div>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
              <button onClick={() => setError("")} className="ml-2 float-right"><X size={14}/></button>
            </motion.div>
          )}
          {msg && (
            <motion.div key="msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MapPin size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No locations yet. Add one to get started.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Capacity</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((loc, idx) => (
                  <tr key={loc.id} className={`border-t border-gray-50 ${idx % 2 ? "bg-gray-50/30" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                          <MapPin size={14} className="text-orange-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{loc.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{loc.type}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{loc.capacity ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        loc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {loc.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(loc)} title="Edit"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggle(loc)} title={loc.is_active ? "Deactivate" : "Reactivate"}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
                          {loc.is_active ? <ToggleRight size={16} className="text-green-500"/> : <ToggleLeft size={16}/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">{editTarget ? "Edit Location" : "Add Location"}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Room 302"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none">
                    {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Capacity</label>
                  <input type="number" min="1" value={form.capacity}
                    onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none" />
                </div>
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">
                  Cancel
                </button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit} disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white rounded-xl font-medium text-sm shadow flex items-center gap-2 disabled:opacity-60">
                  <Check size={14} /> {saving ? "Saving…" : "Save"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
