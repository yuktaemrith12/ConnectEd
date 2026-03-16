import { useState } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { Sparkles, RefreshCw, Check, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { Checkbox } from "@/app/components/ui/checkbox";

const rubricItems = [
  { id: 1, label: "Clear thesis statement", checked: true },
  { id: 2, label: "Supporting evidence provided", checked: true },
  { id: 3, label: "Proper citation format", checked: false },
  { id: 4, label: "Grammar and spelling", checked: true },
  { id: 5, label: "Conclusion ties to thesis", checked: true },
];

export default function TeacherAIFeedback() {
  const [teacherNotes, setTeacherNotes] = useState("Student showed good understanding but needs work on citations");
  const [generatedFeedback, setGeneratedFeedback] = useState(
    "Great work on your essay! Your thesis statement is clear and well-defined, and you've provided strong supporting evidence throughout your argument. Your grammar and spelling are excellent, and your conclusion effectively ties back to your main thesis.\n\nHowever, I noticed that your citations need improvement. Please review the MLA format guidelines and ensure all sources are properly cited. This is an important skill for academic writing.\n\nOverall, this is a solid effort. Keep up the good work, and focus on refining your citation practices for future assignments.\n\nGrade: B+"
  );
  const [tone, setTone] = useState("balanced");

  const generateFeedback = () => {
    // Mock AI generation
    setGeneratedFeedback("Generating new feedback based on your inputs...");
    setTimeout(() => {
      setGeneratedFeedback(
        "Excellent effort on this assignment! I'm impressed by your clear thesis and strong evidence. Your writing shows great progress in grammar and structure.\n\nOne area for growth: citation formatting. Let's work together on this - I'll share some resources to help you master MLA style.\n\nYou're doing wonderfully! Keep building on these strengths.\n\nGrade: B+"
      );
    }, 1500);
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Feedback Assistant</h1>
            <p className="text-gray-600">Generate personalized feedback drafts for student work</p>
          </div>
        </div>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border-l-4 border-purple-500 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertCircle size={20} className="text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-purple-900">Teacher Approval Required</p>
            <p className="text-sm text-purple-700 mt-1">
              All AI-generated feedback is a draft for your review. Please review, edit, and approve before sending to students.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold mb-4">Input</h3>
              
              {/* Rubric Checklist */}
              <div className="mb-6">
                <Label className="mb-3 block">Rubric Checklist</Label>
                <div className="space-y-3">
                  {rubricItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <Checkbox id={`rubric-${item.id}`} defaultChecked={item.checked} />
                      <label
                        htmlFor={`rubric-${item.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {item.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teacher Notes */}
              <div>
                <Label htmlFor="notes" className="mb-2 block">
                  Your Quick Notes
                </Label>
                <Textarea
                  id="notes"
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                  placeholder="Add your observations or specific points to address..."
                />
              </div>

              {/* Tone Selection */}
              <div>
                <Label className="mb-3 block">Feedback Tone</Label>
                <div className="flex gap-2">
                  {["encouraging", "balanced", "direct"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                        tone === t
                          ? "bg-purple-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateFeedback}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
              >
                <Sparkles size={20} />
                Generate Feedback
              </motion.button>
            </div>
          </motion.div>

          {/* Output Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Generated Feedback Draft</h3>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Regenerate"
                >
                  <RefreshCw size={18} className="text-gray-600" />
                </motion.button>
              </div>
            </div>

            <Textarea
              value={generatedFeedback}
              onChange={(e) => setGeneratedFeedback(e.target.value)}
              rows={16}
              className="resize-none font-normal"
            />

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                className="flex-1 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Shorten
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                className="flex-1 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Change Tone
              </motion.button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-green-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Approve & Save Feedback
            </motion.button>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
