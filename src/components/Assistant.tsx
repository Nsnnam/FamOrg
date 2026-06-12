/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { User } from "../types.js";
import { motion, AnimatePresence } from "motion/react";

interface AssistantProps {
  currentUser: User;
  authHeaders: Record<string, string>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function Assistant({ currentUser, authHeaders }: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: `Chào ${currentUser.fullName}. Mình có thể tóm tắt task, lịch, chi tiêu, thuốc và gợi ý việc nên xử lý hôm nay.` }
  ]);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ message: question })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI assistant đang bận");
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: err.message || "Chưa gọi được AI assistant." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-full w-12 h-12 shadow-2xl shadow-sky-500/20 flex items-center justify-center"
        title="AI assistant"
      >
        <Bot className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-end p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-bold text-slate-100">AI assistant</span>
                </div>
                <button onClick={() => setOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="h-80 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`text-xs leading-relaxed rounded-2xl px-3 py-2 max-w-[88%] whitespace-pre-line ${msg.role === "user" ? "ml-auto bg-sky-500 text-slate-950 font-semibold" : "bg-slate-950 border border-slate-800 text-slate-300"}`}>
                    {msg.content}
                  </div>
                ))}
                {loading && <div className="text-xs text-slate-500">Đang suy nghĩ...</div>}
              </div>

              <form onSubmit={ask} className="p-3 border-t border-slate-800 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Hỏi: hôm nay cần làm gì?"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
                />
                <button disabled={loading} type="submit" className="bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 rounded-xl px-3 py-2">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
