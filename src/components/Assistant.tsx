/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Download, FileText, Image as ImageIcon, Loader2, Mic, MicOff, Send, ShoppingCart, Sparkles, Store, X } from "lucide-react";
import { User } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { useModalA11y } from "../hooks/useModalA11y.js";

interface AssistantProps {
  currentUser: User;
  authHeaders: Record<string, string>;
}

interface AssistantShoppingItem {
  name: string;
  quantity?: string;
  note?: string;
}

interface AssistantFileItem {
  name: string;
  url: string;
  docTitle?: string;
}

interface AssistantAction {
  id: string;
  type: "create_shopping_items" | "download_files" | "send_telegram_report" | "update_gold_store_prices";
  title: string;
  items?: AssistantShoppingItem[];
  files?: AssistantFileItem[];
  period?: "day" | "week" | "month" | "quarter" | "year";
  storeId?: string;
  storeName?: string;
  ringBlisterBuyPrice?: number;
  ringBlisterSellPrice?: number;
  ringPlainBuyPrice?: number;
  ringPlainSellPrice?: number;
  note?: string;
  autoConvert?: boolean;
  status?: "pending" | "running" | "done" | "error";
  error?: string;
}

interface AttachedImage {
  mimeType: string;
  dataBase64: string;
  previewUrl: string;
  fileName: string;
}

const PROMPT_SUGGESTIONS = [
  { label: "💰 Tài sản & lãi lỗ", query: "Báo cáo chi tiết danh mục tài sản gia đình hiện có, giá vốn ban đầu, giá trị hiện tại và tính toán lãi lỗ từng khoản (đặc biệt là vàng nhẫn 24k ép vỉ và nhẫn trơn)" },
  { label: "🏷️ Tiệm vàng tư nhân", query: "Kiểm tra danh sách các tiệm vàng tư nhân đã lưu và các tài sản vàng đang gắn với từng tiệm" },
  { label: "📊 Thu chi tháng này", query: "Báo cáo chi tiết thu chi và các khoản chi lớn nhất trong tháng này" },
  { label: "🎯 Kiểm tra chỉ tiêu", query: "Kiểm tra tình hình hạn mức và chỉ tiêu ngân sách chi tiêu tháng này, có mục nào vượt không?" },
  { label: "📄 Rà soát giấy tờ", query: "Rà soát toàn bộ giấy tờ gia đình, giấy tờ nào sắp hết hạn hoặc đã hết hạn cần làm lại?" },
  { label: "📨 Báo cáo Telegram", query: "Gửi báo cáo thu chi và chỉ tiêu tuần này qua Telegram" }
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  actions?: AssistantAction[];
}

function formatVND(val?: number): string {
  if (typeof val !== "number" || isNaN(val)) return "-";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
}

export function Assistant({ currentUser, authHeaders }: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachment, setAttachment] = useState<AttachedImage | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Chào ${currentUser.fullName}. Mình có thể kiểm tra danh mục tài sản, tính lãi lỗ vàng nhẫn/tiệm tư nhân, rà soát thu chi, chỉ tiêu, giấy tờ và hỗ trợ bạn mọi lúc.`
    }
  ]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort?.();
      }
    };
  }, []);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closePanel = useCallback(() => setOpen(false), []);
  useModalA11y(open, closePanel, panelRef);

  const updateAction = (actionId: string, patch: Partial<AssistantAction>) => {
    setMessages(prev => prev.map(msg => {
      if (!msg.actions) return msg;
      return {
        ...msg,
        actions: msg.actions.map(action => action.id === actionId ? { ...action, ...patch } : action)
      };
    }));
  };

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = compressedDataUrl.replace(/^data:[^;]+;base64,/, "");
        setAttachment({
          mimeType: "image/jpeg",
          dataBase64: base64,
          previewUrl: compressedDataUrl,
          fileName: file.name
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleImageFile(file);
          break;
        }
      }
    }
  }, [handleImageFile]);

  const sendQuestion = async (rawQuestion: string, attachedFile = attachment) => {
    const question = rawQuestion.trim();
    if ((!question && !attachedFile) || loading) return;

    const userMsgContent = question || (attachedFile ? "📸 [Ảnh bảng giá / biên nhận]" : "");
    setMessages(prev => [...prev, {
      role: "user",
      content: userMsgContent,
      imageUrl: attachedFile?.previewUrl
    }]);
    setInput("");
    setAttachment(null);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          message: question || "Trích xuất giá vàng và phân tích bảng giá từ ảnh này",
          file: attachedFile ? {
            mimeType: attachedFile.mimeType,
            dataBase64: attachedFile.dataBase64
          } : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI assistant đang bận");

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer || "Mình đã chuẩn bị gợi ý cho bạn.",
        actions: Array.isArray(data.actions) ? data.actions : []
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: err.message || "Chưa gọi được AI assistant."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(input, attachment);
  };

  const startVoiceInput = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Bạn hãy thử Chrome hoặc Edge, hoặc nhập bằng bàn phím."
      }]);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event?.error === "aborted") return;
      const message = event?.error === "not-allowed"
        ? "Bạn cần cấp quyền micro cho trình duyệt để dùng nhập giọng nói."
        : "Mình chưa nghe rõ. Bạn thử nói lại hoặc nhập bằng bàn phím nhé.";
      setMessages(prev => [...prev, { role: "assistant", content: message }]);
    };
    recognition.onresult = (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
      if (!transcript) return;
      setInput(transcript);
      void sendQuestion(transcript, attachment);
    };

    recognition.start();
  };

  const runAction = async (action: AssistantAction) => {
    if (action.status === "running" || action.status === "done") return;

    if (action.type === "download_files") {
      const files = action.files || [];
      for (const f of files) {
        const link = document.createElement("a");
        link.href = f.url;
        link.download = f.name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      updateAction(action.id, { status: "done" });
      return;
    }

    if (action.type === "send_telegram_report") {
      updateAction(action.id, { status: "running", error: "" });
      try {
        const res = await fetch("/api/reports/send-telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ period: action.period || "week" })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Gửi báo cáo qua Telegram thất bại.");
        updateAction(action.id, { status: "done" });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ Đã gửi báo cáo tài chính ${action.period === "day" ? "hôm nay" : action.period === "week" ? "tuần này" : action.period === "month" ? "tháng này" : "quý này"} qua Telegram thành công.`
        }]);
      } catch (err: any) {
        updateAction(action.id, { status: "error", error: err.message || "Gửi Telegram thất bại." });
      }
      return;
    }

    if (action.type === "create_shopping_items") {
      updateAction(action.id, { status: "running", error: "" });
      try {
        const items = (action.items || []).filter(item => item.name.trim());
        if (items.length === 0) {
          throw new Error("Không có món hợp lệ để thêm.");
        }

        for (const item of items) {
          const res = await fetch("/api/shopping", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              name: item.name.trim(),
              quantity: item.quantity?.trim() || "",
              note: item.note?.trim() || "Thêm bởi AI assistant"
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `Không thêm được "${item.name}"`);
          }
        }

        updateAction(action.id, { status: "done", error: "" });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Xong, mình đã thêm ${items.length} món vào danh sách đi chợ.`
        }]);
      } catch (err: any) {
        updateAction(action.id, {
          status: "error",
          error: err.message || "Không thể thực hiện hành động này."
        });
      }
      return;
    }

    if (action.type === "update_gold_store_prices") {
      if (!action.storeId) {
        updateAction(action.id, { status: "error", error: "Không tìm thấy tiệm vàng tương ứng trong hệ thống." });
        return;
      }
      updateAction(action.id, { status: "running", error: "" });
      try {
        const res = await fetch(`/api/finance/gold-stores/${action.storeId}/prices`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            prices: {
              ringBlisterBuyPrice: action.ringBlisterBuyPrice,
              ringBlisterSellPrice: action.ringBlisterSellPrice,
              ringPlainBuyPrice: action.ringPlainBuyPrice,
              ringPlainSellPrice: action.ringPlainSellPrice
            },
            note: action.note || "Cập nhật qua Trợ lý AI",
            autoConvertAssets: action.autoConvert !== false
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Cập nhật bảng giá thất bại.");
        updateAction(action.id, { status: "done" });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ Đã cập nhật bảng giá tiệm vàng **${action.storeName || "tư nhân"}** thành công! Hệ thống đã tự động quy đổi giá trị cho **${data.updatedAssetsCount || 0}** tài sản liên quan.`
        }]);
      } catch (err: any) {
        updateAction(action.id, { status: "error", error: err.message || "Cập nhật giá vàng thất bại." });
      }
      return;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-full w-12 h-12 shadow-2xl shadow-sky-500/20 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
        title="AI assistant"
      >
        <Bot className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              onPaste={handlePaste}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              role="dialog"
              aria-modal="true"
              aria-label="Trợ lý AI"
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden outline-none flex flex-col max-h-[90vh] sm:max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-100 block leading-tight">AI assistant gia đình</span>
                    <span className="text-[10px] text-slate-400">Hỗ trợ tài sản, giá vàng, thu chi & giấy tờ</span>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`text-xs leading-relaxed rounded-2xl px-3 py-2 max-w-[90%] whitespace-pre-line ${
                      msg.role === "user"
                        ? "ml-auto bg-sky-500 text-slate-950 font-medium shadow-xs"
                        : "bg-slate-950 border border-slate-800 text-slate-300"
                    }`}
                  >
                    {msg.imageUrl && (
                      <div className="mb-2 rounded-xl overflow-hidden border border-slate-700/60 max-w-[240px]">
                        <img src={msg.imageUrl} alt="Ảnh gửi lên" className="w-full h-auto max-h-48 object-cover" />
                      </div>
                    )}

                    <div>{msg.content}</div>

                    {/* Actions */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 space-y-2 whitespace-normal">
                        {msg.actions.map(action => (
                          <div key={action.id} className="border border-slate-800 bg-slate-900/90 rounded-xl p-3 space-y-2.5">
                            {/* 1. Đi chợ */}
                            {action.type === "create_shopping_items" && (
                              <>
                                <div className="flex items-start gap-2">
                                  <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-100">{action.title}</p>
                                    <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                                      {(action.items || []).map((item, itemIndex) => (
                                        <li key={`${action.id}_${itemIndex}`} className="flex gap-1.5">
                                          <span className="text-slate-600">-</span>
                                          <span>
                                            {item.name}
                                            {item.quantity ? <span className="text-slate-500"> ({item.quantity})</span> : null}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>

                                {action.status === "error" && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-rose-400">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{action.error}</span>
                                  </div>
                                )}

                                {action.status === "done" ? (
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Đã thêm vào Đi chợ</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void runAction(action)}
                                    disabled={action.status === "running"}
                                    className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 rounded-lg px-3 py-2 text-[11px] font-bold transition-all cursor-pointer"
                                  >
                                    {action.status === "running" ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <ShoppingCart className="w-3.5 h-3.5" />
                                    )}
                                    {action.status === "running" ? "Đang thêm..." : `Thêm ${(action.items || []).length} món vào Đi chợ`}
                                  </button>
                                )}
                              </>
                            )}

                            {/* 2. Tải tệp */}
                            {action.type === "download_files" && (
                              <>
                                <div className="flex items-start gap-2">
                                  <FileText className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-100">{action.title}</p>
                                    <div className="mt-2 space-y-1.5">
                                      {(action.files || []).map((file, fileIdx) => (
                                        <div key={fileIdx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-medium text-slate-200 truncate">{file.name}</p>
                                            {file.docTitle && <p className="text-[10px] text-slate-400 truncate">{file.docTitle}</p>}
                                          </div>
                                          <a
                                            href={file.url}
                                            download={file.name}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="shrink-0 flex items-center gap-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-md px-2 py-1 text-[10px] font-bold cursor-pointer"
                                          >
                                            <Download className="w-3 h-3" /> Tải về
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void runAction(action)}
                                  className="w-full flex items-center justify-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer mt-1"
                                >
                                  <Download className="w-3.5 h-3.5" /> Tải tất cả tệp ({ (action.files || []).length })
                                </button>
                              </>
                            )}

                            {/* 3. Báo cáo Telegram */}
                            {action.type === "send_telegram_report" && (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Send className="w-4 h-4 text-sky-400 shrink-0" />
                                    <span className="font-bold text-slate-100 text-[11px]">{action.title}</span>
                                  </div>
                                  {action.status === "done" ? (
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã gửi
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => void runAction(action)}
                                      disabled={action.status === "running"}
                                      className="bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 rounded-lg px-2.5 py-1 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      {action.status === "running" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                      Gửi ngay
                                    </button>
                                  )}
                                </div>
                                {action.status === "error" && (
                                  <p className="text-[10px] text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {action.error}</p>
                                )}
                              </>
                            )}

                            {/* 4. Cập nhật bảng giá tiệm vàng tư nhân */}
                            {action.type === "update_gold_store_prices" && (
                              <div className="space-y-2.5">
                                <div className="flex items-start gap-2">
                                  <Store className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-100 text-xs">{action.title}</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      Tiệm vàng: <span className="font-semibold text-slate-200">{action.storeName}</span>
                                    </p>

                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                                      {(action.ringBlisterBuyPrice || action.ringBlisterSellPrice) && (
                                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                                          <span className="text-amber-800 dark:text-amber-300 font-bold block mb-1">Nhẫn ép vỉ 24K</span>
                                          <div className="text-slate-400 space-y-0.5">
                                            <div className="flex justify-between">
                                              <span>Mua vào:</span>
                                              <span className="text-slate-200 font-mono font-medium">{formatVND(action.ringBlisterBuyPrice)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Bán ra:</span>
                                              <span className="text-slate-200 font-mono font-medium">{formatVND(action.ringBlisterSellPrice)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {(action.ringPlainBuyPrice || action.ringPlainSellPrice) && (
                                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                                          <span className="text-amber-800 dark:text-amber-300 font-bold block mb-1">Nhẫn trơn 24K</span>
                                          <div className="text-slate-400 space-y-0.5">
                                            <div className="flex justify-between">
                                              <span>Mua vào:</span>
                                              <span className="text-slate-200 font-mono font-medium">{formatVND(action.ringPlainBuyPrice)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Bán ra:</span>
                                              <span className="text-slate-200 font-mono font-medium">{formatVND(action.ringPlainSellPrice)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {action.note && (
                                      <p className="text-[10px] text-slate-400 mt-1.5 italic">Ghi chú: {action.note}</p>
                                    )}
                                  </div>
                                </div>

                                {action.status === "error" && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{action.error}</span>
                                  </div>
                                )}

                                {action.status === "done" ? (
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 rounded-lg p-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Đã cập nhật bảng giá & tự động quy đổi tài sản thành công!</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void runAction(action)}
                                    disabled={action.status === "running" || !action.storeId}
                                    className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 rounded-lg px-3 py-2 text-[11px] font-bold transition-all cursor-pointer shadow-xs"
                                  >
                                    {action.status === "running" ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Sparkles className="w-3.5 h-3.5" />
                                    )}
                                    {action.status === "running" ? "Đang cập nhật & quy đổi..." : "Cập nhật bảng giá & quy đổi tài sản"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="text-xs text-slate-400 flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 w-fit">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    Trợ lý đang phân tích và tính toán...
                  </div>
                )}
              </div>

              {/* Gợi ý câu hỏi nhanh (Tài sản & Lãi lỗ, Tiệm vàng, Chỉ tiêu, Thu chi...) */}
              <div className="px-3 py-2 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-slate-950/40">
                {PROMPT_SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={loading}
                    onClick={() => void sendQuestion(s.query, attachment)}
                    className="shrink-0 text-[11px] font-medium bg-slate-800/90 hover:bg-sky-500/20 hover:text-sky-300 text-slate-300 border border-slate-700/60 rounded-full px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Preview ảnh đính kèm */}
              {attachment && (
                <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={attachment.previewUrl}
                      alt="Preview"
                      className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-200 truncate font-medium">{attachment.fileName}</p>
                      <p className="text-[10px] text-sky-400">Đã đính kèm ảnh (Ctrl+V để đổi ảnh khác)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded-md cursor-pointer transition-colors"
                    title="Gỡ ảnh"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Form nhập câu hỏi & nút ảnh, mic */}
              <form onSubmit={ask} className="p-3 border-t border-slate-800 flex items-center gap-2 shrink-0">
                {/* Ẩn input file */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                    e.target.value = "";
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="shrink-0 p-2 text-slate-400 hover:text-sky-400 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-60"
                  title="Gửi ảnh bảng giá tiệm vàng hoặc hóa đơn"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={startVoiceInput}
                  disabled={loading}
                  className={`shrink-0 p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-60 ${
                    isListening
                      ? "bg-rose-500 text-slate-950 border-rose-400 animate-pulse"
                      : "bg-slate-950 text-slate-400 hover:text-slate-100 border-slate-800 hover:bg-slate-800"
                  }`}
                  title={isListening ? "Dừng nghe" : "Nhập bằng giọng nói"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isListening
                      ? "Đang nghe giọng nói..."
                      : attachment
                      ? "Ghi chú thêm hoặc ấn gửi để phân tích ảnh..."
                      : "Hỏi: tài sản, lãi lỗ vàng, giá tiệm vàng, chỉ tiêu..."
                  }
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500 min-w-0"
                />

                <button
                  disabled={loading || (!input.trim() && !attachment)}
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 rounded-xl p-2 cursor-pointer transition-colors"
                  title="Gửi"
                >
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
