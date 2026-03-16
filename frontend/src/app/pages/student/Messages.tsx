import { useState, useEffect, useRef, useCallback } from "react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Send,
  MessageSquare,
  CheckCheck,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import {
  msgGetConversations,
  msgGetConversation,
  msgSendMessage,
  msgMarkRead,
  msgGetContacts,
  msgStartConversation,
  type MsgConversation,
  type MsgMessage,
  type MsgContact,
} from "@/app/utils/api";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function StudentMessages() {
  const [conversations, setConversations] = useState<MsgConversation[]>([]);
  const [selected, setSelected] = useState<MsgConversation | null>(null);
  const [messages, setMessages] = useState<MsgMessage[]>([]);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // New chat modal
  const [showNewChat, setShowNewChat] = useState(false);
  const [contacts, setContacts] = useState<MsgContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track selected ID in a ref so polling callbacks always see the latest value
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected?.id]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await msgGetConversations();
      // Zero out unread for the conversation the user is currently viewing
      setConversations(
        data.map((c) => (c.id === selectedIdRef.current ? { ...c, unread_count: 0 } : c))
      );
    } catch {
      // silently ignore poll errors
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoadingConvos(true);
    loadConversations().finally(() => setLoadingConvos(false));
  }, [loadConversations]);

  // Poll for new conversations every 5s
  useEffect(() => {
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selected) return;
    setLoadingMsgs(true);
    msgGetConversation(selected.id)
      .then((detail) => setMessages(detail.messages))
      .finally(() => setLoadingMsgs(false));
    msgMarkRead(selected.id).catch(() => {});
  }, [selected?.id]);

  // Poll messages every 3s — also marks as read so last_read_at stays current
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(async () => {
      try {
        const detail = await msgGetConversation(selected.id);
        setMessages(detail.messages);
        await msgMarkRead(selected.id);
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selected?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selected || sending) return;
    setSending(true);
    try {
      const msg = await msgSendMessage(selected.id, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput("");
      await loadConversations();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = (conv: MsgConversation) => {
    setSelected(conv);
    // Update unread locally
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
  };

  const openNewChat = async () => {
    setShowNewChat(true);
    try {
      const data = await msgGetContacts();
      setContacts(data);
    } catch {
      setContacts([]);
    }
  };

  const handleStartConversation = async (contact: MsgContact) => {
    setShowNewChat(false);
    setContactSearch("");
    try {
      const conv = await msgStartConversation(contact.id);
      await loadConversations();
      setSelected(conv);
    } catch {
      // ignore
    }
  };

  const filtered = conversations.filter(
    (c) =>
      c.other_user_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Messages</h1>
          <p className="text-gray-600">Communicate with your teachers</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)]">
          {/* LEFT — conversations list */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search teachers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                />
              </div>
              <button
                onClick={openNewChat}
                className="p-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors flex-shrink-0"
                title="New message"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConvos ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={24} className="animate-spin text-blue-400" />
                </div>
              ) : filtered.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {filtered.map((conv) => (
                    <motion.div
                      key={conv.id}
                      whileHover={{ backgroundColor: "#f9fafb" }}
                      onClick={() => handleSelectConversation(conv)}
                      className={`p-4 cursor-pointer transition-colors ${
                        selected?.id === conv.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {getInitials(conv.other_user_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold text-gray-900 truncate text-sm">
                              {conv.other_user_name}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {conv.updated_at ? formatTimestamp(conv.updated_at) : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 truncate">
                              {conv.last_message_preview || "No messages yet"}
                            </p>
                            {conv.unread_count > 0 && (
                              <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full font-semibold flex-shrink-0">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare size={28} className="text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">No conversations yet</h3>
                  <p className="text-sm text-gray-500">Tap + to message a teacher</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — chat window */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            {selected ? (
              <>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {getInitials(selected.other_user_name)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{selected.other_user_name}</h3>
                      <p className="text-xs text-gray-500 capitalize">{selected.other_user_role}</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 size={24} className="animate-spin text-blue-400" />
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {messages.map((msg, index) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index < 5 ? index * 0.03 : 0 }}
                          className={`flex ${msg.is_mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                              msg.is_mine
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className={`text-xs ${msg.is_mine ? "text-blue-100" : "text-gray-500"}`}>
                                {formatMessageTime(msg.created_at)}
                              </span>
                              {msg.is_mine && (
                                <CheckCheck size={13} className="text-blue-100" />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type your message..."
                      rows={1}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                    >
                      {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      Send
                    </motion.button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center mb-6"
                >
                  <MessageSquare size={48} className="text-blue-500" />
                </motion.div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-gray-500 max-w-sm">
                  Choose from the list or tap + to start a new chat with a teacher
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewChat(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">New Message</h2>
                <button onClick={() => setShowNewChat(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <div className="p-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search teachers..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                  {filteredContacts.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-8">No teachers found</p>
                  ) : (
                    filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleStartConversation(contact)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 transition-colors text-left"
                      >
                        <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {getInitials(contact.full_name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{contact.full_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{contact.role}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
