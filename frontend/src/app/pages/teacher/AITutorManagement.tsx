import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  ChevronLeft,
  BookOpen,
  FileText,
  Mic,
  Settings,
  Upload,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Lock,
  Unlock,
  AlertCircle,
  Eye,
} from "lucide-react";
import { TutorIcon, TutorIconPicker } from "@/app/components/ai-tutor/TutorIconPicker";
import type {
  AiTutorRead,
  AiTutorDetail,
  AiTutorChapterRead,
  AiTutorDocumentRead,
  AiTutorTranscriptRead,
  ClassSubjectRead,
} from "@/app/utils/api";
import {
  aiGetTeacherTutors,
  aiCreateTutor,
  aiUpdateTutor,
  aiDeleteTutor,
  aiGetTutor,
  aiGetTeacherClassSubjects,
  aiCreateChapter,
  aiUpdateChapter,
  aiDeleteChapter,
  aiUploadDocuments,
  aiGetDocuments,
  aiUpdateDocument,
  aiDeleteDocument,
  aiGetTranscripts,
  aiApproveTranscript,
  aiRejectTranscript,
} from "@/app/utils/api";

type Tab = "chapters" | "documents" | "transcripts" | "settings";

const DOC_TYPES = [
  { value: "handbook",       label: "Handbook" },
  { value: "curriculum",     label: "Curriculum" },
  { value: "lesson",         label: "Lesson Notes" },
  { value: "worksheet",      label: "Worksheet" },
  { value: "homework",       label: "Homework" },
  { value: "mock_test",      label: "Mock Test" },
  { value: "past_paper",     label: "Past Paper" },
  { value: "marking_scheme", label: "Marking Scheme" },
  { value: "other",          label: "Other" },
];

function fmtBytes(n: number) {
  if (n < 1024)      return `${n} B`;
  if (n < 1024**2)   return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024**2).toFixed(1)} MB`;
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

// Main page component

export default function TeacherAITutorManagement() {
  const [tutors, setTutors]           = useState<AiTutorRead[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedTutor, setSelected]  = useState<AiTutorDetail | null>(null);
  const [activeTab, setActiveTab]     = useState<Tab>("chapters");
  const [showCreate, setShowCreate]   = useState(false);

  // Data for detail view
  const [chapters,    setChapters]    = useState<AiTutorChapterRead[]>([]);
  const [documents,   setDocuments]   = useState<AiTutorDocumentRead[]>([]);
  const [transcripts, setTranscripts] = useState<AiTutorTranscriptRead[]>([]);

  // Modals
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [showUpload,     setShowUpload]     = useState(false);
  const [reviewingTr,    setReviewingTr]    = useState<AiTutorTranscriptRead | null>(null);

  useEffect(() => {
    aiGetTeacherTutors().then(setTutors).finally(() => setLoading(false));
  }, []);

  async function openTutor(tutor: AiTutorRead) {
    const detail = await aiGetTutor(tutor.id);
    setSelected(detail);
    setChapters(detail.chapters);
    setDocuments(detail.documents);
    setActiveTab("chapters");
    const trs = await aiGetTranscripts(tutor.id);
    setTranscripts(trs);
  }

  async function refreshDocs() {
    if (!selectedTutor) return;
    const docs = await aiGetDocuments(selectedTutor.id);
    setDocuments(docs);
  }

  async function refreshTranscripts() {
    if (!selectedTutor) return;
    const trs = await aiGetTranscripts(selectedTutor.id);
    setTranscripts(trs);
  }

  async function toggleActive(tutor: AiTutorRead) {
    const updated = await aiUpdateTutor(tutor.id, { is_active: !tutor.is_active });
    setTutors(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (selectedTutor?.id === updated.id) setSelected(prev => prev ? { ...prev, ...updated } : prev);
  }

  // Render: Tutor grid

  if (!selectedTutor) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">AI Tutor</h1>
              <p className="text-gray-500 mt-1">Manage subject-specific AI tutors for your classes</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-medium shadow hover:bg-purple-700"
            >
              <Plus size={18} /> Create Tutor
            </motion.button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-purple-500" size={32} />
            </div>
          ) : tutors.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm"
            >
              <div className="text-5xl mx-auto mb-4 opacity-30">🤖</div>
              <p className="text-gray-500 font-medium">No tutors yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first AI tutor to get started</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700"
              >
                + Create Tutor
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tutors.map(t => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm cursor-pointer"
                  onClick={() => openTutor(t)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                      <TutorIcon iconId={t.icon_emoji} size={20} className="text-white" fallbackChar={t.subject_name.charAt(0)} />
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleActive(t); }}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                        t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {t.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {t.is_active ? "Active" : "Inactive"}
                    </button>
                  </div>
                  <h3 className="font-semibold text-gray-900">{t.subject_name}</h3>
                  <p className="text-sm text-gray-500">{t.class_name}</p>
                  <div className="mt-3 flex gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><FileText size={12} /> {t.doc_count} docs</span>
                    <span className="flex items-center gap-1"><BookOpen size={12} /> {t.chapter_count} chapters</span>
                  </div>
                  {t.display_name && (
                    <p className="mt-2 text-xs text-gray-400 truncate">{t.display_name}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {showCreate && (
          <CreateTutorModal
            onClose={() => setShowCreate(false)}
            onCreated={async t => {
              setTutors(prev => [t, ...prev]);
              setShowCreate(false);
              await openTutor(t);
            }}
          />
        )}
      </DashboardLayout>
    );
  }

  // Render: Tutor detail

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-4">
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{selectedTutor.display_name || selectedTutor.subject_name}</h1>
            <p className="text-sm text-gray-500">{selectedTutor.class_name} · {selectedTutor.subject_name}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              selectedTutor.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              {selectedTutor.is_active ? "● Active" : "○ Inactive"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {(["chapters","documents","transcripts","settings"] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-purple-600 text-purple-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {activeTab === "chapters" && (
              <ChaptersTab
                tutorId={selectedTutor.id}
                chapters={chapters}
                setChapters={setChapters}
                showAdd={showAddChapter}
                setShowAdd={setShowAddChapter}
              />
            )}
            {activeTab === "documents" && (
              <DocumentsTab
                tutorId={selectedTutor.id}
                chapters={chapters}
                documents={documents}
                onRefresh={refreshDocs}
                showUpload={showUpload}
                setShowUpload={setShowUpload}
              />
            )}
            {activeTab === "transcripts" && (
              <TranscriptsTab
                tutorId={selectedTutor.id}
                chapters={chapters}
                transcripts={transcripts}
                onRefresh={refreshTranscripts}
                reviewing={reviewingTr}
                setReviewing={setReviewingTr}
              />
            )}
            {activeTab === "settings" && (
              <SettingsTab
                tutor={selectedTutor}
                onUpdated={updated => setSelected(prev => prev ? { ...prev, ...updated } : prev)}
                onDelete={() => {
                  aiDeleteTutor(selectedTutor.id).then(() => {
                    setTutors(prev => prev.filter(t => t.id !== selectedTutor.id));
                    setSelected(null);
                  });
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

// Create Tutor Modal

function CreateTutorModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (t: AiTutorRead) => void;
}) {
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRead[]>([]);
  const [selectedIdx, setSelectedIdx]     = useState<number>(0);
  const [displayName, setDisplayName]     = useState("");
  const [activate,    setActivate]        = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error,   setError]               = useState("");

  useEffect(() => {
    aiGetTeacherClassSubjects().then(setClassSubjects);
  }, []);

  async function handleCreate() {
    if (classSubjects.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const cs = classSubjects[selectedIdx];
      const t  = await aiCreateTutor({
        class_id:    cs.class_id,
        subject_id:  cs.subject_id,
        display_name: displayName.trim() || undefined,
        is_active:   activate,
      });
      onCreated(t);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create tutor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <h2 className="text-xl font-bold mb-4">Create AI Tutor</h2>

        {error && (
          <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Class – Subject</label>
            {classSubjects.length === 0 ? (
              <p className="text-sm text-gray-400">Loading your assignments...</p>
            ) : (
              <select
                value={selectedIdx}
                onChange={e => setSelectedIdx(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
              >
                {classSubjects.map((cs, i) => (
                  <option key={i} value={i}>{cs.class_name} — {cs.subject_name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Display Name (optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Grade 10A – Maths Tutor"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Activate immediately</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={loading || classSubjects.length === 0}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Chapters Tab

function ChaptersTab({ tutorId, chapters, setChapters, showAdd, setShowAdd }: {
  tutorId: number;
  chapters: AiTutorChapterRead[];
  setChapters: (c: AiTutorChapterRead[]) => void;
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
}) {
  const grouped = chapters.reduce((acc, c) => {
    const term = c.term || "General";
    if (!acc[term]) acc[term] = [];
    acc[term].push(c);
    return acc;
  }, {} as Record<string, AiTutorChapterRead[]>);

  async function toggleLock(c: AiTutorChapterRead) {
    const updated = await aiUpdateChapter(c.id, { is_unlocked: !c.is_unlocked });
    setChapters(chapters.map(ch => ch.id === updated.id ? updated : ch));
  }

  async function handleDelete(c: AiTutorChapterRead) {
    if (!confirm(`Delete chapter "${c.chapter_name}"?`)) return;
    await aiDeleteChapter(c.id);
    setChapters(chapters.filter(ch => ch.id !== c.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{chapters.length} chapter{chapters.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          <Plus size={14} /> Add Chapter
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <BookOpen size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">No chapters yet. Add your first chapter to organise materials.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([term, chs]) => (
          <div key={term} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="font-semibold text-gray-700 text-sm">{term}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {chs.map(c => (
                <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.chapter_name}</p>
                    {c.topic && <p className="text-xs text-gray-400 truncate">{c.topic}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{c.doc_count} doc{c.doc_count !== 1 ? "s" : ""}</span>
                  <button onClick={() => toggleLock(c)} title={c.is_unlocked ? "Lock" : "Unlock"}>
                    {c.is_unlocked
                      ? <Unlock size={16} className="text-green-500" />
                      : <Lock size={16} className="text-gray-400" />}
                  </button>
                  <button onClick={() => handleDelete(c)}>
                    <Trash2 size={16} className="text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showAdd && (
        <AddChapterModal
          onClose={() => setShowAdd(false)}
          onAdded={c => { setChapters([...chapters, c]); setShowAdd(false); }}
          tutorId={tutorId}
        />
      )}
    </div>
  );
}

function AddChapterModal({ tutorId, onClose, onAdded }: {
  tutorId: number;
  onClose: () => void;
  onAdded: (c: AiTutorChapterRead) => void;
}) {
  const [term, setTerm]       = useState("Term 1");
  const [name, setName]       = useState("");
  const [topic, setTopic]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const c = await aiCreateChapter(tutorId, { term, chapter_name: name.trim(), topic: topic.trim() || undefined });
      onAdded(c);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
      >
        <h3 className="font-bold text-lg">Add Chapter</h3>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Term</label>
          <input value={term} onChange={e => setTerm(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Chapter Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chapter 3: Kinematics" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Topic (optional)</label>
          <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleAdd} disabled={!name.trim() || loading} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />} Add
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Documents Tab

function DocumentsTab({ tutorId, chapters, documents, onRefresh, showUpload, setShowUpload }: {
  tutorId: number;
  chapters: AiTutorChapterRead[];
  documents: AiTutorDocumentRead[];
  onRefresh: () => void;
  showUpload: boolean;
  setShowUpload: (v: boolean) => void;
}) {
  async function toggleEnabled(doc: AiTutorDocumentRead) {
    await aiUpdateDocument(doc.id, { is_enabled: !doc.is_enabled });
    onRefresh();
  }

  async function handleDelete(doc: AiTutorDocumentRead) {
    if (!confirm(`Delete "${doc.original_filename}"?`)) return;
    await aiDeleteDocument(doc.id);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{documents.length} document{documents.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          <Upload size={14} /> Upload Files
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <FileText size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">No documents yet. Upload your first file to build the knowledge base.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {documents.map(doc => (
            <div key={doc.id} className="px-5 py-4 flex items-start gap-3">
              <FileText size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{doc.original_filename}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {DOC_TYPES.find(d => d.value === doc.doc_type)?.label || doc.doc_type}
                  </span>
                  {doc.chapter_name && (
                    <span className="text-xs text-gray-400">Ch: {doc.chapter_name}</span>
                  )}
                  <span className="text-xs text-gray-400">{fmtBytes(doc.file_size_bytes)}</span>
                  <span className="text-xs text-gray-400">Uploaded {fmtDate(doc.created_at)}</span>
                  {doc.is_indexed
                    ? <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Indexed</span>
                    : <span className="text-xs text-amber-600 flex items-center gap-1"><Clock size={12} /> Processing...</span>
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleEnabled(doc)}
                  title={doc.is_enabled ? "Disable" : "Enable"}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${doc.is_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                >
                  {doc.is_enabled ? "Enabled" : "Disabled"}
                </button>
                <button onClick={() => handleDelete(doc)}>
                  <Trash2 size={16} className="text-red-400 hover:text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          tutorId={tutorId}
          chapters={chapters}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

function UploadModal({ tutorId, chapters, onClose, onUploaded }: {
  tutorId: number;
  chapters: AiTutorChapterRead[];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const fileRef               = useRef<HTMLInputElement>(null);
  const [files, setFiles]     = useState<File[]>([]);
  const [docType, setDocType] = useState("lesson");
  const [chapterId, setChap]  = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (files.length === 0) return;
    setLoading(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      fd.append("doc_type", docType);
      if (chapterId) fd.append("chapter_id", String(chapterId));
      await aiUploadDocuments(tutorId, fd);
      onUploaded();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <h3 className="font-bold text-lg">Upload Documents</h3>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 transition-colors"
        >
          <Upload size={24} className="mx-auto text-gray-400 mb-2" />
          {files.length === 0
            ? <p className="text-sm text-gray-400">Click to select files (PDF, PPTX, DOCX, TXT)</p>
            : <p className="text-sm text-gray-700 font-medium">{files.length} file{files.length > 1 ? "s" : ""} selected</p>
          }
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.pptx,.docx,.txt,.md"
            className="hidden"
            onChange={e => setFiles(Array.from(e.target.files || []))}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Document Type</label>
          <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
            {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Chapter (optional)</label>
          <select value={chapterId ?? ""} onChange={e => setChap(e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
            <option value="">— No chapter —</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.term ? `[${c.term}] ` : ""}{c.chapter_name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleUpload} disabled={files.length === 0 || loading} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />} Upload
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Transcripts Tab

function TranscriptsTab({ tutorId, chapters, transcripts, onRefresh, reviewing, setReviewing }: {
  tutorId: number;
  chapters: AiTutorChapterRead[];
  transcripts: AiTutorTranscriptRead[];
  onRefresh: () => void;
  reviewing: AiTutorTranscriptRead | null;
  setReviewing: (t: AiTutorTranscriptRead | null) => void;
}) {
  const pending  = transcripts.filter(t => t.status === "pending");
  const approved = transcripts.filter(t => t.status === "approved");
  const rejected = transcripts.filter(t => t.status === "rejected");

  function statusBadge(s: string) {
    if (s === "approved") return <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle size={12} /> Approved</span>;
    if (s === "rejected") return <span className="flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><XCircle size={12} /> Rejected</span>;
    return <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Clock size={12} /> Pending</span>;
  }

  async function handleReject(tr: AiTutorTranscriptRead) {
    if (!confirm("Reject this transcript?")) return;
    await aiRejectTranscript(tr.id);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {transcripts.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <Mic size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">No transcripts yet. Transcripts from class recordings will appear here for review.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-700 mb-2">Pending Review ({pending.length})</p>
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm divide-y divide-gray-50">
                {pending.map(tr => (
                  <div key={tr.id} className="px-5 py-4 flex items-center gap-3">
                    <Mic size={18} className="text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">Transcript #{tr.id}</p>
                      <p className="text-xs text-gray-400">{fmtDate(tr.created_at)}</p>
                    </div>
                    {statusBadge(tr.status)}
                    <button
                      onClick={() => setReviewing(tr)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <Eye size={12} /> Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {[...approved, ...rejected].length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-2">Reviewed ({approved.length + rejected.length})</p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {[...approved, ...rejected].map(tr => (
                  <div key={tr.id} className="px-5 py-4 flex items-center gap-3">
                    <Mic size={18} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">Transcript #{tr.id}</p>
                      <p className="text-xs text-gray-400">{fmtDate(tr.created_at)}</p>
                    </div>
                    {statusBadge(tr.status)}
                    <button onClick={() => setReviewing(tr)} className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">View</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {reviewing && (
        <ReviewModal
          transcript={reviewing}
          chapters={chapters}
          onClose={() => { setReviewing(null); onRefresh(); }}
          onApproved={() => { setReviewing(null); onRefresh(); }}
          onRejected={() => { setReviewing(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

function ReviewModal({ transcript, chapters, onClose, onApproved, onRejected }: {
  transcript: AiTutorTranscriptRead;
  chapters: AiTutorChapterRead[];
  onClose: () => void;
  onApproved: () => void;
  onRejected: () => void;
}) {
  const [editedText, setEditedText] = useState(transcript.approved_transcript || transcript.raw_transcript || "");
  const [chapterId,  setChapterId]  = useState<number | null>(transcript.chapter_id || null);
  const [loading,    setLoading]    = useState(false);
  const isReadOnly = transcript.status !== "pending";

  async function handleApprove() {
    setLoading(true);
    try {
      await aiApproveTranscript(transcript.id, {
        edited_transcript: editedText.trim() !== transcript.raw_transcript ? editedText : undefined,
        chapter_id: chapterId || undefined,
      });
      onApproved();
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      await aiRejectTranscript(transcript.id);
      onRejected();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-lg">Transcript #{transcript.id}</h3>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            transcript.status === "approved" ? "bg-green-100 text-green-700"
            : transcript.status === "rejected" ? "bg-red-100 text-red-700"
            : "bg-amber-100 text-amber-700"
          }`}>{transcript.status}</span>
        </div>

        <div className="flex-1 overflow-auto p-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Raw Transcript (read-only)</p>
            <div className="bg-gray-50 rounded-xl p-4 h-64 overflow-auto text-sm text-gray-700 whitespace-pre-wrap">
              {transcript.raw_transcript || "No raw transcript available."}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {isReadOnly ? "Approved Version" : "Edit Before Approving"}
            </p>
            <textarea
              value={editedText}
              onChange={e => setEditedText(e.target.value)}
              readOnly={isReadOnly}
              className={`w-full h-64 p-4 rounded-xl border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-purple-500 ${isReadOnly ? "bg-gray-50" : "bg-white"}`}
            />
          </div>
        </div>

        {!isReadOnly && (
          <div className="px-6 pb-2">
            <label className="text-sm font-medium text-gray-700 block mb-1">Assign to Chapter (optional)</label>
            <select value={chapterId ?? ""} onChange={e => setChapterId(e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— No chapter —</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.chapter_name}</option>)}
            </select>
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Close</button>
          {!isReadOnly && (
            <>
              <button onClick={handleReject} disabled={loading} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 disabled:opacity-50">Reject</button>
              <button onClick={handleApprove} disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                {loading && <Loader2 size={14} className="animate-spin" />} Approve & Index
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Settings Tab

const PERSONALITY_OPTIONS = [
  { value: "supportive", label: "Supportive", desc: "Encouraging, patient, builds confidence" },
  { value: "neutral",    label: "Neutral",    desc: "Balanced, objective, matter-of-fact" },
  { value: "strict",     label: "Strict",     desc: "High standards, rigorous, exam-focused" },
];

const STYLE_OPTIONS = [
  { value: "detailed",    label: "Detailed",      desc: "In-depth explanations with context" },
  { value: "step_by_step",label: "Step-by-Step",  desc: "Guided walkthroughs and worked examples" },
  { value: "concise",     label: "Concise",       desc: "Short, direct, key points only" },
];

const TONE_OPTIONS = [
  { value: "friendly",  label: "Friendly",  desc: "Warm, conversational, approachable" },
  { value: "academic",  label: "Academic",  desc: "Formal terminology, scholarly tone" },
  { value: "formal",    label: "Formal",    desc: "Professional, structured, precise" },
];


function OptionGroup({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string; desc: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
              value === opt.value
                ? "border-purple-400 bg-purple-50 text-purple-800"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            <p className="font-medium">{opt.label}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ tutor, onUpdated, onDelete }: {
  tutor: AiTutorDetail;
  onUpdated: (t: Partial<AiTutorRead>) => void;
  onDelete: () => void;
}) {
  const [displayName,      setDisplayName]      = useState(tutor.display_name || "");
  const [systemPrompt,     setSystemPrompt]     = useState(tutor.system_prompt || "");
  const [isActive,         setIsActive]         = useState(tutor.is_active);
  const [personality,      setPersonality]      = useState(tutor.personality || "supportive");
  const [teachingStyle,    setTeachingStyle]    = useState(tutor.teaching_style || "detailed");
  const [tone,             setTone]             = useState(tutor.tone || "friendly");
  const [emphasisTopics,   setEmphasisTopics]   = useState<string[]>(tutor.emphasis_topics || []);
  const [topicInput,       setTopicInput]       = useState("");
  const [iconEmoji,        setIconEmoji]        = useState(tutor.icon_emoji || "");
  const [saving,           setSaving]           = useState(false);
  const [saved,            setSaved]            = useState(false);

  function addTopic() {
    const t = topicInput.trim();
    if (t && !emphasisTopics.includes(t)) {
      setEmphasisTopics(prev => [...prev, t]);
    }
    setTopicInput("");
  }

  function removeTopic(t: string) {
    setEmphasisTopics(prev => prev.filter(x => x !== t));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await aiUpdateTutor(tutor.id, {
        display_name:    displayName.trim() || undefined,
        system_prompt:   systemPrompt.trim() || undefined,
        is_active:       isActive,
        personality,
        teaching_style:  teachingStyle,
        tone,
        emphasis_topics: emphasisTopics.length > 0 ? emphasisTopics : undefined,
        icon_emoji:      iconEmoji || undefined,
      });
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* General */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900">General</h3>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Display Name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700">Tutor is active (visible to students)</span>
        </label>
      </div>

      {/* Tutor Icon */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900">Tutor Icon</h3>
          <p className="text-xs text-gray-400 mt-1">Choose an icon shown on the tutor card.</p>
        </div>
        <TutorIconPicker value={iconEmoji} onChange={setIconEmoji} />
        {iconEmoji && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Selected:</span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <TutorIcon iconId={iconEmoji} size={16} className="text-white" />
            </div>
            <button onClick={() => setIconEmoji("")} className="text-gray-400 hover:text-gray-600">remove</button>
          </div>
        )}
      </div>

      {/* Personality & Style */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        <h3 className="font-semibold text-gray-900">Personality &amp; Teaching Style</h3>
        <OptionGroup label="Personality" options={PERSONALITY_OPTIONS} value={personality} onChange={setPersonality} />
        <OptionGroup label="Teaching Style" options={STYLE_OPTIONS} value={teachingStyle} onChange={setTeachingStyle} />
        <OptionGroup label="Tone" options={TONE_OPTIONS} value={tone} onChange={setTone} />
      </div>

      {/* Emphasis Topics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900">Emphasis Topics</h3>
          <p className="text-xs text-gray-400 mt-1">Topics the tutor will prioritise in its answers.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={topicInput}
            onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTopic())}
            placeholder="e.g. Algebra, Newton's Laws…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={addTopic}
            disabled={!topicInput.trim()}
            className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {emphasisTopics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {emphasisTopics.map(t => (
              <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200">
                {t}
                <button type="button" onClick={() => removeTopic(t)} className="text-purple-400 hover:text-purple-700 ml-0.5">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Custom System Prompt */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">Custom System Prompt</h3>
          <p className="text-xs text-gray-400 mt-1">Optional. Overrides the default persona entirely.</p>
        </div>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={5}
          placeholder="e.g. You are a strict but fair examiner who always provides rigorous feedback..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Settings size={16} />}
        {saved ? "Saved!" : "Save Changes"}
      </button>

      <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
        <h3 className="font-semibold text-red-800 mb-1">Danger Zone</h3>
        <p className="text-sm text-red-600 mb-4">Permanently delete this tutor, all documents, chapters, and chat history.</p>
        <button
          onClick={() => confirm("Delete this tutor and all its data? This cannot be undone.") && onDelete()}
          className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
        >
          Delete Tutor
        </button>
      </div>
    </div>
  );
}
