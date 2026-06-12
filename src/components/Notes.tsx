/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Pin, 
  PinOff, 
  Search, 
  Tag as TagIcon, 
  Eye, 
  Lock, 
  Edit3, 
  X,
  Share2
} from "lucide-react";
import { Note, User, UserRole } from "../types.js";
import { motion, AnimatePresence } from "motion/react";

interface NotesProps {
  currentUser: User;
  users: User[];
  notes: Note[];
  onSaveNote: (note: Partial<Note>) => Promise<any>;
  onDeleteNote: (id: string) => Promise<any>;
}

// Light markdown parser to safely render headers, bold, bullet points, checkboxes, and spacing locally
function renderMarkdownHTML(mdText: string) {
  if (!mdText) return <p className="text-slate-500 italic">Ghi chú trống...</p>;
  
  const lines = mdText.split("\n");
  return (
    <div className="space-y-2 font-sans text-xs text-slate-300 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // Headers ###
        if (trimmed.startsWith("### ")) {
          return <h4 key={idx} className="text-xs font-bold text-slate-100 pt-2 border-b border-slate-800 pb-1 flex items-center gap-1.5">{trimmed.replace("### ", "")}</h4>;
        }
        if (trimmed.startsWith("## ")) {
          return <h3 key={idx} className="text-sm font-bold text-sky-400 pt-3 flex items-center gap-1.5">{trimmed.replace("## ", "")}</h3>;
        }
        if (trimmed.startsWith("# ")) {
          return <h2 key={idx} className="text-md font-extrabold text-slate-200 pt-3">{trimmed.replace("# ", "")}</h2>;
        }

        // Checklists [x] / [ ]
        if (trimmed.startsWith("- [x] ") || trimmed.startsWith("- [X] ")) {
          return (
            <div key={idx} className="flex items-center gap-2 text-emerald-400 line-through">
              <input type="checkbox" checked readOnly className="rounded bg-slate-900 border-slate-700 w-3.5 h-3.5 accent-emerald-500 pointer-events-none" />
              <span>{trimmed.substring(6)}</span>
            </div>
          );
        }
        if (trimmed.startsWith("- [ ] ")) {
          return (
            <div key={idx} className="flex items-center gap-2 text-slate-400">
              <input type="checkbox" checked={false} readOnly className="rounded bg-slate-900 border-slate-700 w-3.5 h-3.5 pointer-events-none" />
              <span>{trimmed.substring(6)}</span>
            </div>
          );
        }

        // Bullet list item
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <li key={idx} className="list-disc list-inside ml-2 text-slate-300">
              {trimmed.substring(2)}
            </li>
          );
        }

        // Code codeblocks or inline `code`
        if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
          return (
            <code key={idx} className="bg-slate-950 px-2 py-1 font-mono text-[10px] text-yellow-400 border border-slate-800 rounded block my-1">
              {trimmed.replace(/`/g, "")}
            </code>
          );
        }

        // standard paragraph
        return trimmed === "" ? (
          <div key={idx} className="h-2" />
        ) : (
          <p key={idx} className="text-slate-300 font-sans leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export function Notes({
  currentUser,
  users,
  notes,
  onSaveNote,
  onDeleteNote
}: NotesProps) {
  // Query states
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");

  // Interaction controls
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [readingNote, setReadingNote] = useState<Note | null>(null);
  const [formError, setFormError] = useState("");

  // Editor states
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTagsStr, setFormTagsStr] = useState("");
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formIsShared, setFormIsShared] = useState(true);

  // Compute tags pool
  const tagsPool = useMemo(() => {
    const list = new Set<string>();
    notes.forEach(n => n.tags.forEach(t => list.add(t)));
    return Array.from(list);
  }, [notes]);

  // Compute filtered notes list based on credentials
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      // 1. Search text
      const matchText = 
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        n.content.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchText) return false;

      // 2. Tag filter
      if (tagFilter !== "all" && !n.tags.includes(tagFilter)) return false;

      // 3. Shared scope protection: Guest can only view shared, non-shared are visible only to creator or Admin
      if (currentUser.role === UserRole.GUEST) {
        if (!n.isShared && n.creatorId !== currentUser.id) return false;
      } else {
        if (!n.isShared && n.creatorId !== currentUser.id && currentUser.role !== UserRole.ADMIN) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, searchTerm, tagFilter, currentUser]);

  // Separate Pinned and Unpinned
  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.isPinned), [filteredNotes]);
  const normalNotes = useMemo(() => filteredNotes.filter(n => !n.isPinned), [filteredNotes]);

  // Open note reader modal
  const handleReadNote = (note: Note) => {
    setReadingNote(note);
  };

  // Open editor for creating
  const handleOpenCreateForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormTagsStr("");
    setFormIsPinned(false);
    setFormIsShared(true);
    setEditingNote(null);
    setFormError("");
    setIsEditorOpen(true);
  };

  // Open editor for modifying
  const handleOpenEditForm = (note: Note) => {
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormTagsStr(note.tags.join(", "));
    setFormIsPinned(note.isPinned);
    setFormIsShared(note.isShared);
    setEditingNote(note);
    setFormError("");
    setReadingNote(null); // close the reader so the editor isn't hidden behind it
    setIsEditorOpen(true);
  };

  // Save Note trigger
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formTitle.trim()) {
      setFormError("Vui lòng nhập tựa đề ghi chú!");
      return;
    }

    const payload: Partial<Note> = {
      title: formTitle.trim(),
      content: formContent,
      isPinned: formIsPinned,
      isShared: formIsShared,
      tags: formTagsStr.split(",").map(t => t.trim()).filter(Boolean)
    };

    if (editingNote) {
      payload.id = editingNote.id;
    }

    try {
      await onSaveNote(payload);
      setIsEditorOpen(false);
      setEditingNote(null);
    } catch (err: any) {
      setFormError(err.message || "Lưu ghi chú thất bại");
    }
  };

  // Delete note trigger
  const handleDeleteClick = async (noteId: string) => {
    if (confirm("Gia đình có chắc muốn xóa ghi chú này không? Thao tác không thể phục hồi!")) {
      await onDeleteNote(noteId);
      if (readingNote?.id === noteId) setReadingNote(null);
    }
  };

  // Quick toggle pin state
  const handleTogglePin = async (note: Note) => {
    try {
      await onSaveNote({
        id: note.id,
        isPinned: !note.isPinned
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6" id="notes-module">
      
      {/* Note headers with search */}
      <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4" id="notes-control-header">
        
        {/* Search & Tags triggers */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhãn ghi chú, đề tài gia đình..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <TagIcon className="w-4 h-4 text-slate-500 shrink-0" />
            <select 
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500 min-w-[120px]"
            >
              <option value="all">Mọi thẻ nhãn</option>
              {tagsPool.map(tg => (
                <option key={tg} value={tg}>#{tg}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Create Note Trigger */}
        <button 
          disabled={currentUser.role === UserRole.GUEST}
          onClick={handleOpenCreateForm}
          className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-start md:self-auto shrink-0 shadow-md shadow-sky-500/5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Viết ghi chú mới
        </button>
      </div>

      {/* Grid of Results: Pinned block at top, normal block underneath */}
      {filteredNotes.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center" id="empty-notes">
          <p className="text-sm text-slate-500">Không tìm thấy tài liệu ghi chú nào phù hợp.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* PINNED SECTION */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-3" id="pinned-notes-block">
              <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Pin className="w-4 h-4 text-yellow-400" /> Được ghim ở đầu ({pinnedNotes.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedNotes.map(note => {
                  const creator = users.find(u => u.id === note.creatorId);
                  return (
                    <div 
                      key={note.id}
                      onClick={() => handleReadNote(note)}
                      className="bg-slate-900 border border-yellow-500/30 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/2 px-4.5 py-4 rounded-2xl flex flex-col justify-between space-y-4 cursor-pointer relative group transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-200 line-clamp-1 group-hover:text-sky-400 transition-colors">{note.title}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 font-bold rounded">Pinned</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed font-sans">
                          {note.content.replace(/[#*`\-]/g, "")}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-sans">
                        <span>Lập bởi: {creator ? creator.fullName.split(" ")[0] : "Thành viên"}</span>
                        <span>{new Date(note.updatedAt).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" })}</span>
                      </div>

                      {/* Sticky hover actions */}
                      <div className="absolute right-3.5 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-900 p-1 rounded-lg shadow-md border border-slate-800">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}
                          className="p-1.5 hover:bg-slate-800 rounded text-yellow-400"
                          title="Bỏ ghim"
                        >
                          <PinOff className="w-3.5 h-3.5" />
                        </button>
                        {currentUser.role !== UserRole.GUEST && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenEditForm(note); }}
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-sky-400"
                            title="Chỉnh sửa"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(note.creatorId === currentUser.id || currentUser.role === UserRole.ADMIN) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(note.id); }}
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NORMAL SECTION */}
          {normalNotes.length > 0 && (
            <div className="space-y-4" id="all-notes-block">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ghi chú khác ({normalNotes.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {normalNotes.map(note => {
                  const creator = users.find(u => u.id === note.creatorId);
                  return (
                    <div 
                      key={note.id}
                      onClick={() => handleReadNote(note)}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 hover:shadow-lg px-4.5 py-4 rounded-2xl flex flex-col justify-between space-y-4 cursor-pointer relative group transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-100 line-clamp-1 group-hover:text-sky-400 transition-colors">{note.title}</h4>
                          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            {note.isShared ? <Share2 className="w-3 h-3 text-sky-400/90" /> : <Lock className="w-3 h-3 text-indigo-400" />}
                            {note.isShared ? "Chung" : "Riêng"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed font-sans">
                          {note.content.replace(/[#*`\-]/g, "")}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-sans">
                        <span>Lập bởi: {creator ? creator.fullName.split(" ")[0] : "Thành viên"}</span>
                        <span>{new Date(note.updatedAt).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" })}</span>
                      </div>

                      {/* Hover actions */}
                      <div className="absolute right-3.5 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-900 p-1 rounded-lg shadow-md border border-slate-800">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}
                          className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-yellow-400"
                          title="Ghim đầu trang"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        {currentUser.role !== UserRole.GUEST && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenEditForm(note); }}
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-sky-400"
                            title="Sửa"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(note.creatorId === currentUser.id || currentUser.role === UserRole.ADMIN) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(note.id); }}
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor Modal for Writing / Modifying */}
      {isEditorOpen && (
        <div 
          onClick={() => setIsEditorOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="note-editor-modal"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-sky-400" />
                {editingNote ? `Sửa ghi chú "${editingNote.title}"` : "Soạn thảo tài liệu mới"}
              </h3>
              <button 
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
                  {formError}
                </div>
              )}

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Tựa đề ghi chú <span className="text-rose-400">*</span></label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Công thức nấu ăn cốt lết, Ghi chú bảo hiểm xe máy..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm font-bold"
                />
              </div>

              {/* Content Textarea (Markdown help) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <label className="text-slate-400 block font-semibold font-sans">Nội dung (Hỗ trợ Markdown cơ bản)</label>
                  <span>Dùng ## đề mục | - danh sách | - [ ] việc cần làm</span>
                </div>
                <textarea 
                  rows={8}
                  placeholder={`## Đề Mục Lớn\n- [ ] Việc cần hoàn thành 1\n- [x] Việc đã làm xong rồi 2\n- Danh sách ghi nhận quan trọng`}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
                />
              </div>

              {/* Tags, Pinned and Shared row */}
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Đính nhãn tags (ngăn bằng dấu phẩy)</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Quan trọng, Món ngon, Thiết bị..."
                  value={formTagsStr}
                  onChange={(e) => setFormTagsStr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/40 p-4 border border-slate-800 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold select-none">
                  <input 
                    type="checkbox" 
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>Ghim trực tiếp lên màn hình chính (Pin)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold select-none">
                  <input 
                    type="checkbox" 
                    checked={formIsShared}
                    onChange={(e) => setFormIsShared(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>Chia sẻ công khai cho các thành viên đều xem được</span>
                </label>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold"
                >
                  Đóng lại
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Lưu trữ ghi chú
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reader Modal for viewing Markdown notes */}
      {readingNote && (
        <div 
          onClick={() => setReadingNote(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="note-reader-modal"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono">Đang đọc tài liệu gia đình:</span>
                <h3 className="text-md font-bold text-sky-400 flex items-center gap-1.5">{readingNote.title}</h3>
              </div>
              <button 
                onClick={() => setReadingNote(null)}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Markdown details container */}
            <div className="bg-slate-950 p-4.5 rounded-xl border border-slate-800/80 overflow-y-auto max-h-[350px]">
              {renderMarkdownHTML(readingNote.content)}
            </div>

            {/* Note info footer */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1.5 border-t border-slate-800/60 font-mono">
              <div className="flex gap-2">
                {readingNote.tags.map((tg, i) => (
                  <span key={i} className="text-[10px] text-sky-400/80">#{tg}</span>
                ))}
              </div>
              <span>Cập nhật ngày: {new Date(readingNote.updatedAt).toLocaleDateString("vi-VN", { month: "long", day: "numeric" })}</span>
            </div>

            {/* Reading window footer buttons */}
            <div className="flex justify-between items-center pt-2">
              {(readingNote.creatorId === currentUser.id || currentUser.role === UserRole.ADMIN) ? (
                <button 
                  onClick={() => handleDeleteClick(readingNote.id)}
                  className="px-3.5 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Xóa ghi chú
                </button>
              ) : <div />}

              <div className="flex gap-2.5">
                <button 
                  onClick={() => setReadingNote(null)}
                  className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold text-xs"
                >
                  Đóng cửa sổ
                </button>
                {currentUser.role !== UserRole.GUEST && (
                  <button 
                    onClick={() => handleOpenEditForm(readingNote)}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold transition-all cursor-pointer text-xs"
                  >
                    Chỉnh sửa nội dung
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
