/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Trash2, Pencil, X, Calendar, User as UserIcon, Paperclip, ExternalLink, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { FamilyDocument, DocumentFile, DocumentType, DOCUMENT_TYPE_LABELS, User, UserRole } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { optimizeAndUpload } from "../utils/uploadImage.js";
import { useTabFab } from "./FabHost.js";
import { useConfirm } from "./ConfirmDialog.js";
import { useModalA11y } from "../hooks/useModalA11y.js";

interface DocumentsProps {
  currentUser: User;
  users: User[];
  documents: FamilyDocument[];
  onSaveDocument: (doc: Partial<FamilyDocument>) => Promise<any>;
  onDeleteDocument: (id: string) => Promise<any>;
}

const MAX_DOC_FILES = 6;
const DOC_TYPE_ORDER: DocumentType[] = [
  "cccd", "passport", "driver_license", "vehicle_registration", "vehicle_inspection",
  "insurance", "health_insurance", "warranty", "contract", "certificate", "other"
];

// Số ngày còn lại đến hạn (âm = đã quá hạn), theo giờ địa phương.
function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const p = String(dateStr).split("-");
  if (p.length < 3) return null;
  const y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const t = new Date();
  const todayMid = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((target.getTime() - todayMid.getTime()) / 86400000);
}

export function Documents({ currentUser, users, documents, onSaveDocument, onDeleteDocument }: DocumentsProps) {
  const [type, setType] = useState<DocumentType>("cccd");
  const [title, setTitle] = useState("");
  const [titleManual, setTitleManual] = useState(false); // người dùng đã tự sửa tên?
  const [ownerId, setOwnerId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  // Trình xem ảnh (lightbox): ảnh của một giấy tờ + vị trí đang xem.
  const [viewer, setViewer] = useState<{ files: DocumentFile[]; index: number; title: string } | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const closeViewer = () => setViewer(null);
  const viewerPrev = () => setViewer(v => v ? { ...v, index: (v.index - 1 + v.files.length) % v.files.length } : v);
  const viewerNext = () => setViewer(v => v ? { ...v, index: (v.index + 1) % v.files.length } : v);
  useModalA11y(!!viewer, closeViewer, viewerRef);

  // Mũi tên trái/phải để chuyển ảnh trong lightbox.
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") viewerPrev();
      else if (e.key === "ArrowRight") viewerNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer]);

  const canManageDocument = (doc: FamilyDocument) =>
    doc.creatorId === currentUser.id ||
    doc.ownerId === currentUser.id ||
    (doc.isShared && currentUser.role === UserRole.ADMIN);

  useTabFab({ id: "documents", color: "emerald", title: "Thêm giấy tờ", icon: FileText, onClick: () => {
    resetForm();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }});

  // Tự tạo tên giấy tờ từ loại + chủ sở hữu, vd: "CCCD của Ba", "Đăng kiểm xe".
  const autoTitle = (t: DocumentType, oId: string) => {
    const label = DOCUMENT_TYPE_LABELS[t];
    const owner = users.find(u => u.id === oId);
    return owner ? `${label} của ${owner.fullName}` : label;
  };

  // Khi đổi loại/chủ sở hữu mà người dùng chưa tự gõ tên thì cập nhật tên gợi ý.
  useEffect(() => {
    if (!titleManual) setTitle(autoTitle(type, ownerId));
  }, [type, ownerId, titleManual, users]);

  const resetForm = () => {
    setType("cccd"); setTitle(""); setTitleManual(false); setOwnerId(""); setDocumentNumber("");
    setIssuer(""); setIssueDate(""); setExpiryDate(""); setNotes("");
    setIsShared(false); setFiles([]); setEditingId(null); setError("");
  };

  const startEdit = (doc: FamilyDocument) => {
    setType(doc.type);
    setTitle(doc.title);
    // Nếu tên trùng tên tự sinh thì vẫn cho cập nhật theo loại/chủ sở hữu; ngược lại giữ nguyên.
    setTitleManual(doc.title !== autoTitle(doc.type, doc.ownerId || ""));
    setOwnerId(doc.ownerId || "");
    setDocumentNumber(doc.documentNumber || "");
    setIssuer(doc.issuer || "");
    setIssueDate(doc.issueDate || "");
    setExpiryDate(doc.expiryDate || "");
    setNotes(doc.notes || "");
    setIsShared(doc.isShared);
    setFiles(doc.files || []);
    setEditingId(doc.id);
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // cho phép chọn lại cùng tệp
    if (picked.length === 0) return;
    if (files.length + picked.length > MAX_DOC_FILES) {
      setError(`Mỗi giấy tờ chỉ đính kèm tối đa ${MAX_DOC_FILES} ảnh.`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const added: DocumentFile[] = [];
      for (const file of picked) {
        const up = await optimizeAndUpload(file, "documents", {
          maxSourceBytes: 25 * 1024 * 1024,
          targetBytes: 1000 * 1024,
          maxSizes: [1600, 1280, 1024, 768],
          qualities: [0.86, 0.78, 0.68, 0.58],
          backgroundColor: "#ffffff"
        });
        added.push({
          id: `docfile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          url: up.url,
          sizeKb: up.sizeKb,
          createdAt: new Date().toISOString()
        });
      }
      setFiles(prev => [...prev, ...added]);
    } catch (err: any) {
      setError(err.message || "Không tải được ảnh giấy tờ.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const finalTitle = title.trim() || autoTitle(type, ownerId);
    setSaving(true);
    try {
      await onSaveDocument({
        id: editingId || undefined,
        type,
        title: finalTitle,
        ownerId: ownerId || undefined,
        documentNumber: documentNumber.trim() || undefined,
        issuer: issuer.trim() || undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        notes: notes.trim() || undefined,
        isShared,
        files
      });
      resetForm();
    } catch (err: any) {
      setError(err.message || "Không lưu được giấy tờ.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: FamilyDocument) => {
    const ok = await confirm({
      title: "Xóa giấy tờ?",
      message: `Xóa "${doc.title}"? Ảnh/scan đính kèm cũng sẽ bị xóa và không thể khôi phục.`,
      confirmLabel: "Xóa",
      tone: "danger"
    });
    if (!ok) return;
    try {
      await onDeleteDocument(doc.id);
      if (editingId === doc.id) resetForm();
    } catch (err) {
      console.error("Không xóa được giấy tờ", err);
    }
  };

  const sorted = useMemo(() => {
    const list = filterType === "all" ? documents : documents.filter(d => d.type === filterType);
    // Sắp xếp: sắp/đã hết hạn lên trước, rồi tới có HSD xa, cuối cùng là không có HSD.
    return [...list].sort((a, b) => {
      const da = daysUntil(a.expiryDate);
      const db = daysUntil(b.expiryDate);
      if (da === null && db === null) return a.title.localeCompare(b.title);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [documents, filterType]);

  const expiringCount = useMemo(
    () => documents.filter(d => { const n = daysUntil(d.expiryDate); return n !== null && n <= 30; }).length,
    [documents]
  );

  const expiryBadge = (dateStr?: string) => {
    const n = daysUntil(dateStr);
    if (n === null) return null;
    if (n < 0) return { text: `Đã hết hạn ${-n} ngày`, cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" };
    if (n === 0) return { text: "Hết hạn hôm nay", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" };
    if (n <= 30) return { text: `Còn ${n} ngày`, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    return { text: `HSD ${dateStr}`, cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  };

  return (
    <div className="space-y-6" id="documents-module">
      {/* Form thêm/sửa */}
      <div ref={formRef} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" /> {editingId ? "Sửa giấy tờ" : "Kho giấy tờ gia đình"}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {expiringCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> {expiringCount} sắp/đã hết hạn
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-mono">{documents.length} giấy tờ</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs">
          <select value={type} onChange={(e) => setType(e.target.value as DocumentType)} className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-indigo-500">
            {DOC_TYPE_ORDER.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
          </select>
          <div className="md:col-span-4 relative">
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleManual(e.target.value.trim() !== ""); }}
              placeholder="Tên tự tạo từ loại + chủ sở hữu (có thể sửa)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 pr-16 text-slate-200 outline-none focus:border-indigo-500"
            />
            {titleManual && (
              <button
                type="button"
                onClick={() => { setTitleManual(false); setTitle(autoTitle(type, ownerId)); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 bg-slate-800 rounded-md px-1.5 py-0.5 cursor-pointer"
                title="Quay lại tên tự tạo"
              >
                Tự tạo
              </button>
            )}
          </div>

          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-indigo-500">
            <option value="">Chủ sở hữu (tùy chọn)</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Số giấy tờ" className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-indigo-500" />
          <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Nơi cấp" className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-indigo-500" />

          <div className="md:col-span-3 space-y-1">
            <label className="text-slate-500 text-[10px] block">Ngày cấp</label>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full min-w-0 box-border appearance-none bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-indigo-500 font-mono" />
          </div>
          <div className="md:col-span-3 space-y-1">
            <label className="text-slate-500 text-[10px] block">Ngày hết hạn (để nhắc)</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full min-w-0 box-border appearance-none bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-indigo-500 font-mono" />
          </div>

          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú thêm..." className="md:col-span-4 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-indigo-500" />
          <select value={isShared ? "true" : "false"} onChange={(e) => setIsShared(e.target.value === "true")} className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-indigo-500">
            <option value="false">Riêng tư (người tạo & chủ sở hữu)</option>
            <option value="true">Chia sẻ (người lớn trong nhà)</option>
          </select>

          {/* Đính kèm ảnh/scan */}
          <div className="md:col-span-6 bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-400 font-semibold flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5 text-indigo-400" /> Ảnh/scan đính kèm ({files.length}/{MAX_DOC_FILES})</label>
              <label className={`text-[11px] font-bold rounded-lg px-2.5 py-1 cursor-pointer flex items-center gap-1 ${uploading || files.length >= MAX_DOC_FILES ? "bg-slate-800 text-slate-600 cursor-not-allowed" : "bg-slate-800 hover:bg-slate-700 text-indigo-400"}`}>
                <Plus className="w-3 h-3" /> {uploading ? "Đang tải..." : "Thêm ảnh"}
                <input type="file" accept="image/*" multiple disabled={uploading || files.length >= MAX_DOC_FILES} onChange={handleFilePick} className="hidden" />
              </label>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map(f => (
                  <div key={f.id} className="relative group">
                    <img src={f.url} alt={f.fileName} className="w-16 h-16 object-cover rounded-lg border border-slate-700" />
                    <button type="button" onClick={() => removeFile(f.id)} className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 cursor-pointer" title="Gỡ ảnh">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-6 flex items-center gap-2">
            <button disabled={saving || uploading} type="submit" className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white rounded-xl px-4 py-2.5 font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <Plus className="w-4 h-4" /> {editingId ? "Lưu thay đổi" : "Thêm giấy tờ"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl px-4 py-2.5 font-bold cursor-pointer">
                Hủy
              </button>
            )}
          </div>
        </form>
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
      </div>

      {/* Bộ lọc loại */}
      {documents.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Lọc:</span>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 outline-none focus:border-indigo-500">
            <option value="all">Tất cả loại</option>
            {DOC_TYPE_ORDER.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      )}

      {/* Danh sách */}
      {sorted.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center">
          <p className="text-sm text-slate-500">Chưa có giấy tờ nào. Thêm CCCD, đăng kiểm, bảo hiểm... để được nhắc khi sắp hết hạn.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {sorted.map(doc => {
              const owner = users.find(u => u.id === doc.ownerId);
              const badge = expiryBadge(doc.expiryDate);
              const canManage = canManageDocument(doc);
              return (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                        {DOCUMENT_TYPE_LABELS[doc.type]}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100 mt-1.5 truncate">{doc.title}</h4>
                    </div>
                    {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(doc)} className="p-1.5 text-slate-500 hover:text-amber-400 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer" title="Sửa">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(doc)} className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer" title="Xóa">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-400">
                    {doc.documentNumber && <p>Số: <span className="text-slate-200 font-mono">{doc.documentNumber}</span></p>}
                    {owner && <p className="flex items-center gap-1"><UserIcon className="w-3 h-3 text-slate-500" /> {owner.fullName}</p>}
                    {doc.issuer && <p className="text-slate-500">Nơi cấp: {doc.issuer}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {badge && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 ${badge.cls}`}>
                        <Calendar className="w-3 h-3" /> {badge.text}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold ${doc.isShared ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                      {doc.isShared ? "Chia sẻ" : "Riêng tư"}
                    </span>
                  </div>

                  {doc.files && doc.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {doc.files.map((f, i) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setViewer({ files: doc.files, index: i, title: doc.title })}
                          className="relative group cursor-pointer"
                          title={`Xem ${f.fileName}`}
                        >
                          <img src={f.url} alt={f.fileName} className="w-14 h-14 object-cover rounded-lg border border-slate-700" />
                          <span className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/40 rounded-lg flex items-center justify-center transition-colors">
                            <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {doc.notes && <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800 pt-2">{doc.notes}</p>}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Trình xem ảnh giấy tờ */}
      {viewer && viewer.files[viewer.index] && (
        <div onClick={closeViewer} className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[60] p-4" id="document-photo-viewer">
          <div ref={viewerRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Xem ảnh giấy tờ" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col outline-none">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">{viewer.title}</p>
                <p className="text-[11px] text-slate-500 tabular-nums truncate">
                  {viewer.files[viewer.index].fileName}
                  {viewer.files.length > 1 && ` • ${viewer.index + 1}/${viewer.files.length}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={viewer.files[viewer.index].url} target="_blank" rel="noreferrer" aria-label="Mở ảnh gốc" title="Mở ảnh gốc trong tab mới" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center">
                  <ExternalLink className="size-4" />
                </a>
                <button type="button" onClick={closeViewer} aria-label="Đóng" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-slate-950 flex items-center justify-center p-3 relative">
              <img src={viewer.files[viewer.index].url} alt={viewer.files[viewer.index].fileName} className="max-h-[72vh] max-w-full object-contain rounded-lg" />
              {viewer.files.length > 1 && (
                <>
                  <button type="button" onClick={viewerPrev} aria-label="Ảnh trước" className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 flex items-center justify-center border border-slate-700">
                    <ChevronLeft className="size-5" />
                  </button>
                  <button type="button" onClick={viewerNext} aria-label="Ảnh sau" className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 flex items-center justify-center border border-slate-700">
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
