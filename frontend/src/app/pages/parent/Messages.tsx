import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import DashboardLayout from "@/app/components/layout/DashboardLayout";
import { Search, Send, MessageSquare, Plus, X, Loader2, CheckCheck } from "lucide-react";
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ParentMessages() {
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
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected?.id]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await msgGetConversations();
      setConversations(
        data.map((c) => (c.id === selectedIdRef.current ? { ...c, unread_count: 0 } : c))
      );
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    setLoadingConvos(true);
    loadConversations().finally(() => setLoadingConvos(false));
  }, [loadConversations]);

  // Poll conversations every 5s
  useEffect(() => {
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Load messages when conversation selected
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

  const filtered = conversations.filter((c) =>
    c.other_user_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <DashboardLayout role="parent">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Messages</h1>
        <p className="text-gray-600">Communicate with teachers about your child</p>
        <p className="text-xs text-gray-400 mt-1">For academic or attendance-related queries only.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-300px)]">
        {/* Left — conversation list */}
        <div className="lg:col-span-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
              />
            </div>
            <button
              onClick={openNewChat}
              className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors flex-shrink-0"
              title="New message"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvos ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-green-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <MessageSquare size={24} className="text-gray-400" />
                </div>
                <p className="font-semibold text-gray-700 text-sm mb-1">No conversations yet</p>
                <p className="text-xs text-gray-500">Tap + to message a teacher</p>
              </div>
            ) : (
              filtered.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-all ${
                    selected?.id === conv.id
                      ? "bg-green-50 border-l-4 border-l-green-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                      {getInitials(conv.other_user_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-gray-800 text-sm truncate">
                          {conv.other_user_name}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {conv.unread_count > 0 && (
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          )}
                          <span className="text-xs text-gray-400">
                            {conv.updated_at ? formatTimestamp(conv.updated_at) : ""}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-green-600 font-medium mb-0.5 capitalize">{conv.other_user_role}</p>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {conv.last_message_preview || "No messages yet"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right — chat view */}
        <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {selected ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold shadow-sm">
                    {getInitials(selected.other_user_name)}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800">{selected.other_user_name}</h2>
                    <p className="text-sm text-green-600 font-medium capitalize">{selected.other_user_role}</p>
                  </div>
                </div>
              </div>

              {/* Message thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={24} className="animate-spin text-green-400" />
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index < 5 ? index * 0.03 : 0 }}
                        className={`flex ${msg.is_mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                            msg.is_mine
                              ? "bg-gradient-to-br from-green-500 to-green-600 text-white"
                              : "bg-white border border-gray-200 text-gray-800"
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <p className={`text-xs ${msg.is_mine ? "text-green-100" : "text-gray-400"}`}>
                              {formatMessageTime(msg.created_at)}
                            </p>
                            {msg.is_mine && <CheckCheck size={12} className="text-green-100" />}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-100 bg-white">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type your message…"
                      rows={1}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-none"
                      style={{ minHeight: "48px", maxHeight: "120px" }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all flex-shrink-0 ${
                      input.trim() && !sending
                        ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:scale-105"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={32} className="text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">No Conversation Selected</h3>
                <p className="text-sm text-gray-500">
                  Select a teacher from the list or tap + to start messaging
                </p>
              </div>
            </div>
          )}
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
                <h2 className="font-semibold text-gray-900">Message a Teacher</h2>
                <button onClick={() => setShowNewChat(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <div className="p-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    type="text"
                    placeholder="Search teachers..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
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
                        className="w-full flex items-center gap-3 p-3 hover:bg-green-50 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
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
