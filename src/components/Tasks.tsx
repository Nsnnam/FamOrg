/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  User as UserIcon, 
  Search, 
  Filter, 
  Tag as TagIcon, 
  Calendar,
  Layers,
  AlertCircle,
  X,
  Share2
} from "lucide-react";
import { Task, TaskStatus, TaskPriority, User, UserRole } from "../types.js";
import { motion, AnimatePresence } from "motion/react";

interface TasksProps {
  currentUser: User;
  users: User[];
  tasks: Task[];
  onSaveTask: (task: Partial<Task>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<any>;
  onAddComment: (taskId: string, content: string) => Promise<any>;
}

export function Tasks({
  currentUser,
  users,
  tasks,
  onSaveTask,
  onDeleteTask,
  onAddComment
}: TasksProps) {
  // Query Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "shared" | "personal">("all");

  // State controls for creation modal & detail modal
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentInput, setCommentInput] = useState("");

  // New task form fields
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("unassigned");
  const [newIsShared, setNewIsShared] = useState(true);
  const [newTagsStr, setNewTagsStr] = useState("");
  const [formError, setFormError] = useState("");

  // Quick action states
  const [savingId, setSavingId] = useState<string | null>(null);

  // Compute final filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Text Search title & description & tags
      const matchText = 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchText) return false;

      // 2. Status
      if (statusFilter !== "all" && task.status !== statusFilter) return false;

      // 3. Assignee
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "unassigned" && task.assigneeId !== null) return false;
        if (assigneeFilter !== "unassigned" && task.assigneeId !== assigneeFilter) return false;
      }

      // 4. Priority
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;

      // 5. Shared vs Personal
      if (scopeFilter === "shared" && !task.isShared) return false;
      if (scopeFilter === "personal") {
        if (task.isShared) return false;
        // Personal tasks should only be visible if created by or assigned to me
        if (task.creatorId !== currentUser.id && task.assigneeId !== currentUser.id) return false;
      }

      // Guest access control: Guests can only see shared tasks AND tasks physically assigned to them
      if (currentUser.role === UserRole.GUEST) {
        if (!task.isShared && task.creatorId !== currentUser.id && task.assigneeId !== currentUser.id) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, searchTerm, statusFilter, assigneeFilter, priorityFilter, scopeFilter, currentUser]);

  // Set selected task details refreshed whenever task edits happen
  const activeTaskDetails = useMemo(() => {
    if (!selectedTask) return null;
    return tasks.find(t => t.id === selectedTask.id) || null;
  }, [tasks, selectedTask]);

  // Save Task Form Handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newTitle.trim()) {
      setFormError("Vui lòng nhập tên công việc!");
      return;
    }

    const payload: Partial<Task> = {
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      status: TaskStatus.TODO,
      dueDate: newDueDate || new Date(Date.now() + 86450000).toISOString().slice(0, 10) + " 17:00",
      assigneeId: newAssignee === "unassigned" ? null : newAssignee,
      isShared: newIsShared,
      tags: newTagsStr.split(",").map(t => t.trim()).filter(Boolean)
    };

    try {
      await onSaveTask(payload);
      // Reset
      setNewTitle("");
      setNewDesc("");
      setNewPriority(TaskPriority.MEDIUM);
      setNewDueDate("");
      setNewAssignee("unassigned");
      setNewIsShared(true);
      setNewTagsStr("");
      setIsNewTaskOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Tạo công việc thất bại");
    }
  };

  // Quick change task status triggers
  const handleUpdateStatus = async (task: Task, newStatus: TaskStatus) => {
    setSavingId(task.id);
    try {
      await onSaveTask({
        id: task.id,
        status: newStatus
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingId(null);
    }
  };

  const handlePostComment = async () => {
    if (!commentInput.trim() || !activeTaskDetails) return;
    try {
      await onAddComment(activeTaskDetails.id, commentInput.trim());
      setCommentInput("");
    } catch (err) {
      console.error("Gửi bình luận thất bại", err);
    }
  };

  const handleDeleteClick = async (taskId: string) => {
    if (confirm("Bạn có tin chắc muốn xóa công việc này không?")) {
      try {
        await onDeleteTask(taskId);
        if (selectedTask?.id === taskId) {
          setSelectedTask(null);
        }
      } catch (err) {
        console.error("Không thể xóa task:", err);
      }
    }
  };

  // Style helper colors
  const priorityColor = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.HIGH: return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case TaskPriority.MEDIUM: return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case TaskPriority.LOW: return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    }
  };

  const statusName = (s: TaskStatus) => {
    switch (s) {
      case TaskStatus.TODO: return "Chưa làm";
      case TaskStatus.IN_PROGRESS: return "Đang làm";
      case TaskStatus.COMPLETED: return "Hoàn thành";
      case TaskStatus.OVERDUE: return "Quá hạn";
    }
  };

  const statusColor = (s: TaskStatus) => {
    switch (s) {
      case TaskStatus.TODO: return "bg-slate-800 text-slate-400 border-slate-700";
      case TaskStatus.IN_PROGRESS: return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case TaskStatus.COMPLETED: return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case TaskStatus.OVERDUE: return "bg-rose-500/10 text-rose-400 border-rose-400/20";
    }
  };

  return (
    <div className="space-y-6" id="tasks-module">
      {/* Search and Quick Filters Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4" id="task-filter-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Tìm kiếm công việc của gia đình, nhãn dán..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none transition-all"
            />
          </div>
          <button 
            disabled={currentUser.role === UserRole.GUEST}
            onClick={() => {
              setFormError("");
              setIsNewTaskOpen(true);
            }}
            className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all self-start md:self-auto shrink-0 shadow-md shadow-sky-500/5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm công việc
          </button>
        </div>

        {/* Advanced Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-xs">
          {/* Status filter */}
          <div>
            <label className="text-slate-500 block mb-1">Trạng thái</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="todo">Chưa làm</option>
              <option value="in_progress">Đang làm</option>
              <option value="completed">Hoàn thành</option>
              <option value="overdue">Quá hạn</option>
            </select>
          </div>

          {/* Assignee filter */}
          <div>
            <label className="text-slate-500 block mb-1">Người nhận việc</label>
            <select 
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">Tất cả thành viên</option>
              <option value="unassigned">Chưa giao việc</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <label className="text-slate-500 block mb-1">Độ ưu tiên</label>
            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">Mọi ưu tiên</option>
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </div>

          {/* Scope filter */}
          <div>
            <label className="text-slate-500 block mb-1">Phạm vi chia sẻ</label>
            <select 
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">Mọi công việc</option>
              <option value="shared">Chia sẻ chung cả nhà</option>
              <option value="personal">Chỉ cá nhân riêng</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="col-span-2 md:col-span-1 flex items-end">
            <button 
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setAssigneeFilter("all");
                setPriorityFilter("all");
                setScopeFilter("all");
              }}
              className="w-full bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-slate-100 p-2 text-slate-400 font-semibold rounded-lg text-center transition-all cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center" id="empty-tasks">
          <p className="text-sm text-slate-500">Không tìm thấy công việc phù hợp với bộ lọc hiển thị.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="tasks-list">
          <AnimatePresence>
            {filteredTasks.map((task) => {
              const assignee = users.find(u => u.id === task.assigneeId);
              const creator = users.find(u => u.id === task.creatorId);

              return (
                <motion.div 
                  key={task.id}
                  layoutId={`task-card-${task.id}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4.5 flex flex-col justify-between space-y-4 hover:shadow-lg transition-all relative group ${savingId === task.id ? "opacity-60 pointer-events-none" : ""}`}
                >
                  <div className="space-y-3">
                    {/* Header line */}
                    <div className="flex items-start justify-between">
                      {/* Priority Tag */}
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 border rounded-lg ${priorityColor(task.priority)}`}>
                        {task.priority === "high" ? "Khẩn cấp" : task.priority === "medium" ? "Trung bình" : "Hàng ngày"}
                      </span>
                      {/* Shared icon */}
                      {task.isShared ? (
                        <span className="flex items-center gap-1 text-[11px] text-sky-400/90 font-medium">
                          <Share2 className="w-3.5 h-3.5" /> Chung
                        </span>
                      ) : (
                        <span className="text-[11px] text-indigo-400/80 font-medium">Cá nhân</span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 
                      onClick={() => setSelectedTask(task)} 
                      className={`text-sm font-bold text-slate-100 hover:text-sky-400 transition-colors cursor-pointer line-clamp-1 ${task.status === TaskStatus.COMPLETED ? "line-through text-slate-500" : ""}`}
                    >
                      {task.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {task.description || "Không có miêu tả công việc."}
                    </p>

                    {/* Tags */}
                    {task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map((tag, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Line with Assignee, Deadline & Status controls */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                    {/* Assignee pill */}
                    <div className="flex items-center gap-1.5 truncate max-w-[45%]">
                      {assignee ? (
                        <>
                          <div className={`w-5 h-5 rounded-full ${assignee.avatarColor} text-slate-950 font-bold text-[9px] flex items-center justify-center shrink-0`}>
                            {assignee.fullName.charAt(0)}
                          </div>
                          <span className="text-slate-400 truncate text-[11px]">{assignee.fullName.split(" ")[0]}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                            <UserIcon className="w-3 h-3 text-slate-500" />
                          </div>
                          <span className="text-slate-500 text-[11px] italic">Chưa giao</span>
                        </>
                      )}
                    </div>

                    {/* Date deadline */}
                    <span className="text-slate-500 text-[10px] flex items-center gap-1 shrink-0 font-mono">
                      <Calendar className="w-3 h-3 text-amber-500/70" />
                      {task.dueDate.split(" ")[0]}
                    </span>

                    {/* Status change selector */}
                    <select
                      value={task.status}
                      onChange={(e) => handleUpdateStatus(task, e.target.value as TaskStatus)}
                      className={`text-[10px] font-semibold border rounded-lg px-2 py-1 focus:outline-none cursor-pointer ${statusColor(task.status)}`}
                    >
                      <option value="todo">Chưa làm</option>
                      <option value="in_progress">Đang làm</option>
                      <option value="completed">Đã xong</option>
                      <option value="overdue">Quá hạn</option>
                    </select>
                  </div>
                  
                  {/* Delete / View Actions buttons in hover mode */}
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-all flex gap-1.5">
                    <button 
                      onClick={() => setSelectedTask(task)} 
                      className="bg-slate-950 hover:bg-slate-800 p-1.5 border border-slate-800 rounded-lg text-slate-400 hover:text-sky-400"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    {currentUser.role !== UserRole.GUEST && (
                      <button 
                        onClick={() => handleDeleteClick(task.id)}
                        className="bg-slate-950 hover:bg-slate-800 p-1.5 border border-slate-800 rounded-lg text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Slideout Detail or Modal for Comments & Comment history logs */}
      {selectedTask && activeTaskDetails && (
        <div 
          onClick={() => setSelectedTask(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="task-details-modal"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="space-y-1">
                <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 border rounded-lg ${priorityColor(activeTaskDetails.priority)}`}>
                  Độ ưu tiên: {activeTaskDetails.priority === "high" ? "Khẩn cấp" : activeTaskDetails.priority === "medium" ? "Trung bình" : "Thấp"}
                </span>
                <h2 className="text-md font-bold text-slate-100">{activeTaskDetails.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 p-2 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Description */}
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Mô tả công việc</span>
                <p className="bg-slate-950 p-3.5 rounded-xl text-slate-300 leading-relaxed border border-slate-800/80">
                  {activeTaskDetails.description || "Không có miêu tả."}
                </p>
              </div>

              {/* Grid of details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950/30 p-4 border border-slate-800 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500">Người tạo:</span>
                  <p className="text-slate-200 mt-0.5 font-medium">
                    {users.find(u => u.id === activeTaskDetails.creatorId)?.fullName || "Người dùng ẩn danh"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Phân công cụ thể:</span>
                  <p className="text-slate-200 mt-0.5 font-medium">
                    {users.find(u => u.id === activeTaskDetails.assigneeId)?.fullName || "Chưa giao cho ai"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Ngày hết hạn:</span>
                  <p className="text-slate-300 mt-0.5 font-mono">
                    {activeTaskDetails.dueDate}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Chế độ chia sẻ:</span>
                  <p className="text-slate-300 mt-0.5">
                    {activeTaskDetails.isShared ? "Công khai với cả gia đình" : "Bảo mật riêng tư"}
                  </p>
                </div>
              </div>

              {/* Interactive Comments system */}
              <div className="space-y-4">
                <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  Bình luận đóng góp ({activeTaskDetails.comments.length})
                </span>

                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                  {activeTaskDetails.comments.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2 text-center">Chưa có bình luận đóng góp nào.</p>
                  ) : (
                    activeTaskDetails.comments.map((comment) => {
                      const commUser = users.find(u => u.id === comment.userId);
                      return (
                        <div key={comment.id} className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-xl space-y-1 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-4 h-4 rounded-full ${commUser?.avatarColor || "bg-slate-700"} flex items-center justify-center text-[8px] text-slate-950 font-bold`}>
                                {commUser?.fullName.charAt(0) || "U"}
                              </span>
                              <span className="font-bold text-slate-300">{comment.username}</span>
                            </div>
                            <span className="text-slate-500 font-mono">{new Date(comment.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-slate-300 font-sans leading-relaxed pl-5">{comment.content}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Send Comment Field */}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Viết phản hồi hoặc kết quả công việc..."
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:border-sky-500 text-xs text-slate-200 outline-none"
                  />
                  <button 
                    onClick={handlePostComment}
                    className="bg-sky-500 hover:bg-sky-400 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Gửi bát
                  </button>
                </div>
              </div>

              {/* Task internal modifications history log */}
              {activeTaskDetails.history && activeTaskDetails.history.length > 0 && (
                <div className="space-y-2 border-t border-slate-800/60 pt-4">
                  <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    Lịch sử thay đổi task
                  </span>
                  <div className="bg-slate-950/20 p-3 rounded-xl space-y-1.5 max-h-[120px] overflow-y-auto">
                    {activeTaskDetails.history.map((hist) => (
                      <div key={hist.id} className="text-[10px] font-mono text-slate-400/90 flex justify-between gap-2 border-b border-slate-800/20 pb-1.5">
                        <span className="text-orange-400/90 font-semibold shrink-0">@{hist.username}</span>
                        <span className="text-left flex-1 font-sans text-slate-400">{hist.action}</span>
                        <span className="text-slate-600 shrink-0">{new Date(hist.createdAt).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-out or Dialog Modal for Creation Form */}
      {isNewTaskOpen && (
        <div 
          onClick={() => setIsNewTaskOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="task-create-modal"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5 text-sky-400" /> Tạo việc mới hằng ngày
              </h3>
              <button 
                onClick={() => setIsNewTaskOpen(false)}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Tên công việc <span className="text-rose-400">*</span></label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Đóng tiền rèm cửa, dọn tủ quần áo..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Nội dung chi tiết</label>
                <textarea 
                  rows={3}
                  placeholder="Điền các nội dung lưu ý, chuẩn bị hàng hóa..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Độ ưu tiên</label>
                  <select 
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="low">Thấp / Thường nhật</option>
                    <option value="medium">Bình thường</option>
                    <option value="high">Cao / Khẩn cấp</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Hạn hoàn thành</label>
                  <input 
                    type="text" 
                    placeholder="YYYY-MM-DD HH:mm (Ví dụ: 2026-06-15 18:00)"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Giao việc cho ai</label>
                  <select 
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="unassigned">Chung (Cả nhà cùng thấy)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Chia sẻ công khai</label>
                  <select 
                    value={newIsShared ? "true" : "false"}
                    onChange={(e) => setNewIsShared(e.target.value === "true")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="true">Chung (Cả gia đình đều xem được)</option>
                    <option value="false font-mono">Riêng tư (Chỉ Admin & người phân công thấy)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Nhãn tag (Cắt nhau bằng dấu phẩy)</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Nhà cửa, Mua sắm, Bé Vy..."
                  value={newTagsStr}
                  onChange={(e) => setNewTagsStr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold"
                >
                  Đóng lại
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Lên nhiệm vụ
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
