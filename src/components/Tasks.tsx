/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from "react";
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
  Share2,
  Pencil,
  CheckSquare
} from "lucide-react";
import { Task, TaskStatus, TaskPriority, User, UserRole, RewardPointEntry, RecurrenceType, isLimitedViewer, isAdultRole } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { Avatar } from "./Avatar.js";
import { ShimmerLine, Reveal, IconChip, staggerDelay } from "./Lively.js";
import { useConfirm } from "./ConfirmDialog.js";
import { DateTimePicker24 } from "./DateTimePicker24.js";
import { useModalA11y } from "../hooks/useModalA11y.js";
import { useTabFab } from "./FabHost.js";

// Parse "YYYY-MM-DD HH:mm" hoặc ISO về Date (null nếu không hợp lệ)
const parseTaskDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(String(value).replace(" ", "T"));
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Task được coi là quá hạn nếu: status đã là overdue, hoặc chưa hoàn thành mà đã qua dueDate
const isTaskOverdue = (task: Task) => {
  if (task.status === TaskStatus.COMPLETED) return false;
  if (task.status === TaskStatus.OVERDUE) return true;
  const due = parseTaskDate(task.dueDate);
  return due !== null && due.getTime() < Date.now();
};

// Trạng thái hiển thị thực tế (suy ra quá hạn động, không cần DB cập nhật status)
const effectiveStatus = (task: Task): TaskStatus =>
  isTaskOverdue(task) ? TaskStatus.OVERDUE : task.status;

interface TasksProps {
  currentUser: User;
  users: User[];
  tasks: Task[];
  rewardEntries: RewardPointEntry[];
  rewardTotals: Record<string, number>;
  onAddReward: (entry: Partial<RewardPointEntry>) => Promise<any>;
  onSaveTask: (task: Partial<Task>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<any>;
  onAddComment: (taskId: string, content: string) => Promise<any>;
}

export function Tasks({
  currentUser,
  users,
  tasks,
  rewardEntries,
  rewardTotals,
  onAddReward,
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
  const [completedWindowDays, setCompletedWindowDays] = useState<"7" | "30" | "90" | "all">("30");

  // State controls for creation modal & detail modal
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  // New task form fields
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("unassigned");
  const [newIsShared, setNewIsShared] = useState(true);
  const [newTagsStr, setNewTagsStr] = useState("");
  const [newRewardPoints, setNewRewardPoints] = useState(0);
  const [newRecurrenceType, setNewRecurrenceType] = useState<RecurrenceType>("none");
  const [newRecurrenceEndDate, setNewRecurrenceEndDate] = useState("");
  const [newRotationMemberIds, setNewRotationMemberIds] = useState<string[]>([]);
  const [manualRewardUser, setManualRewardUser] = useState("");
  const [manualRewardPoints, setManualRewardPoints] = useState(0);
  const [manualRewardReason, setManualRewardReason] = useState("");
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

      // 2. Status (dùng trạng thái suy luận để bộ lọc "Quá hạn" bắt được task đã qua hạn)
      if (statusFilter !== "all" && effectiveStatus(task) !== statusFilter) return false;

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

      // Limited viewers (Child & Guest) only see shared tasks AND tasks they created or are assigned to
      if (isLimitedViewer(currentUser.role)) {
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

  const childUsers = useMemo(() => users.filter(u => u.role === UserRole.CHILD), [users]);

  // Adults manage any task; a Child may edit only tasks they created or are assigned to. Only adults can delete.
  const canEditTask = (task: Task) =>
    isAdultRole(currentUser.role) ||
    (currentUser.role === UserRole.CHILD && (task.creatorId === currentUser.id || task.assigneeId === currentUser.id));
  const canDeleteTask = (_task: Task) => isAdultRole(currentUser.role);

  const resetTaskForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewPriority(TaskPriority.MEDIUM);
    setNewDueDate("");
    setNewAssignee("unassigned");
    setNewIsShared(true);
    setNewTagsStr("");
    setNewRewardPoints(0);
    setNewRecurrenceType("none");
    setNewRecurrenceEndDate("");
    setNewRotationMemberIds([]);
  };

  // Open the modal in "create" mode (clean form)
  const handleOpenCreate = () => {
    resetTaskForm();
    setEditingTaskId(null);
    setFormError("");
    setIsNewTaskOpen(true);
  };

  // Nút nổi thêm nhanh — ẩn khi đang mở modal hoặc tài khoản khách
  useTabFab(
    currentUser.role !== UserRole.GUEST && !isNewTaskOpen
      ? { id: "tasks", color: "sky", title: "Thêm công việc mới", icon: CheckSquare, onClick: handleOpenCreate }
      : null
  );

  // Open the modal in "edit" mode, pre-filled from an existing task
  const handleOpenEditTask = (task: Task) => {
    setNewTitle(task.title);
    setNewDesc(task.description || "");
    setNewPriority(task.priority);
    setNewDueDate(task.dueDate || "");
    setNewAssignee(task.assigneeId || "unassigned");
    setNewIsShared(task.isShared);
    setNewTagsStr((task.tags || []).join(", "));
    setNewRewardPoints(task.rewardPoints || 0);
    setNewRecurrenceType(task.recurrenceType || "none");
    setNewRecurrenceEndDate(task.recurrenceEndDate || "");
    setNewRotationMemberIds(task.rotationMemberIds || []);
    setEditingTaskId(task.id);
    setFormError("");
    setSelectedTask(null); // close detail modal if it was open
    setIsNewTaskOpen(true);
  };

  const handleCloseTaskForm = () => {
    setIsNewTaskOpen(false);
    setEditingTaskId(null);
  };

  // Escape-to-close + scroll lock + focus trap for the two modals
  const detailRef = React.useRef<HTMLDivElement | null>(null);
  const formRef = React.useRef<HTMLDivElement | null>(null);
  const closeDetail = useCallback(() => setSelectedTask(null), []);
  const closeForm = useCallback(() => { setIsNewTaskOpen(false); setEditingTaskId(null); }, []);
  useModalA11y(!!selectedTask, closeDetail, detailRef);
  useModalA11y(isNewTaskOpen, closeForm, formRef);

  // Save Task Form Handler (create or edit)
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
      dueDate: newDueDate || new Date(Date.now() + 86450000).toISOString().slice(0, 10) + " 17:00",
      assigneeId: newAssignee === "unassigned" ? null : newAssignee,
      isShared: newIsShared,
      tags: newTagsStr.split(",").map(t => t.trim()).filter(Boolean),
      rewardPoints: Number(newRewardPoints) || 0,
      recurrenceType: newRecurrenceType,
      recurrenceInterval: 1,
      recurrenceEndDate: newRecurrenceEndDate || undefined,
      // Chỉ gửi danh sách xoay vòng khi task có lặp lại; ngược lại xoá cấu hình cũ.
      rotationMemberIds: newRecurrenceType !== "none" ? newRotationMemberIds : []
    };

    if (editingTaskId) {
      payload.id = editingTaskId; // update existing task (keeps current status)
    } else {
      payload.status = TaskStatus.TODO;
    }

    try {
      await onSaveTask(payload);
      resetTaskForm();
      setEditingTaskId(null);
      setIsNewTaskOpen(false);
    } catch (err: any) {
      setFormError(err.message || (editingTaskId ? "Cập nhật công việc thất bại" : "Tạo công việc thất bại"));
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

  const handleManualReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRewardUser || !manualRewardPoints) return;
    try {
      await onAddReward({
        userId: manualRewardUser,
        points: Number(manualRewardPoints),
        reason: manualRewardReason || "Thuong them"
      });
      setManualRewardPoints(0);
      setManualRewardReason("");
    } catch (err) {
      console.error("Khong cap nhat diem thuong", err);
    }
  };

  const handleDeleteClick = async (taskId: string) => {
    const ok = await confirm({
      title: "Xóa công việc?",
      message: "Công việc này sẽ bị xóa khỏi danh sách task gia đình. Bạn có chắc chắn muốn tiếp tục không?",
      confirmLabel: "Xóa công việc",
      cancelLabel: "Đóng lại",
      tone: "danger"
    });
    if (!ok) return;

    try {
      await onDeleteTask(taskId);
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error("Không thể xóa task:", err);
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

  const priorityLabel = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.HIGH: return "Khẩn cấp";
      case TaskPriority.MEDIUM: return "Trung bình";
      case TaskPriority.LOW: return "Hàng ngày";
    }
  };

  const recurrenceLabel = (type?: RecurrenceType) => {
    if (!type || type === "none") return "";
    if (type === "daily") return "Lặp ngày";
    if (type === "weekly") return "Lặp tuần";
    return "Lặp tháng";
  };

  const priorityRank: Record<TaskPriority, number> = {
    [TaskPriority.HIGH]: 0,
    [TaskPriority.MEDIUM]: 1,
    [TaskPriority.LOW]: 2
  };

  const sortedTasks = (items: Task[]) => {
    return [...items].sort((a, b) => {
      if (a.status === TaskStatus.COMPLETED && b.status !== TaskStatus.COMPLETED) return 1;
      if (a.status !== TaskStatus.COMPLETED && b.status === TaskStatus.COMPLETED) return -1;
      const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    });
  };

  const completedReferenceDate = (task: Task) => {
    return parseTaskDate(task.completedAt) ||
      parseTaskDate(task.updatedAt) ||
      parseTaskDate(task.dueDate) ||
      parseTaskDate(task.createdAt);
  };

  const shouldShowCompletedTask = (task: Task) => {
    if (task.status !== TaskStatus.COMPLETED) return true;
    if (completedWindowDays === "all") return true;
    const referenceDate = completedReferenceDate(task);
    if (!referenceDate) return false;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - Number(completedWindowDays));
    return referenceDate.getTime() >= cutoff.getTime();
  };

  const boardTasks = useMemo(() => {
    return filteredTasks.filter(shouldShowCompletedTask);
  }, [filteredTasks, completedWindowDays]);

  const hiddenCompletedCount = useMemo(() => {
    return filteredTasks.filter(task => task.status === TaskStatus.COMPLETED && !shouldShowCompletedTask(task)).length;
  }, [filteredTasks, completedWindowDays]);

  const boardStats = useMemo(() => {
    const active = boardTasks.filter(t => t.status !== TaskStatus.COMPLETED);
    return {
      total: boardTasks.length,
      active: active.length,
      high: active.filter(t => t.priority === TaskPriority.HIGH).length,
      unassigned: boardTasks.filter(t => !t.assigneeId).length
    };
  }, [boardTasks]);

  const kanbanColumns = [
    {
      status: TaskStatus.TODO,
      title: "Chưa làm",
      hint: "Việc cần nhận và sắp xếp",
      icon: Layers,
      headerClass: "border-slate-700 text-slate-300",
      accentClass: "bg-slate-500"
    },
    {
      status: TaskStatus.IN_PROGRESS,
      title: "Đang làm",
      hint: "Đang được xử lý",
      icon: Clock,
      headerClass: "border-sky-500/30 text-sky-300",
      accentClass: "bg-sky-500"
    },
    {
      status: TaskStatus.OVERDUE,
      title: "Quá hạn",
      hint: "Cần xử lý sớm",
      icon: AlertCircle,
      headerClass: "border-rose-500/30 text-rose-300",
      accentClass: "bg-rose-500"
    },
    {
      status: TaskStatus.COMPLETED,
      title: "Hoàn thành",
      hint: "Đã xong trong gia đình",
      icon: CheckCircle,
      headerClass: "border-emerald-500/30 text-emerald-300",
      accentClass: "bg-emerald-500"
    }
  ];

  const visibleKanbanColumns = statusFilter === "all"
    ? kanbanColumns
    : kanbanColumns.filter(column => column.status === statusFilter);

  const quickNextStatus = (task: Task): { label: string; status: TaskStatus } => {
    if (task.status === TaskStatus.COMPLETED) return { label: "Mở lại", status: TaskStatus.TODO };
    // Task quá hạn (kể cả khi đang ở todo/in_progress) → hành động chính là hoàn thành
    if (isTaskOverdue(task)) return { label: "Hoàn thành", status: TaskStatus.COMPLETED };
    if (task.status === TaskStatus.TODO) return { label: "Bắt đầu", status: TaskStatus.IN_PROGRESS };
    return { label: "Hoàn thành", status: TaskStatus.COMPLETED };
  };

  return (
    <div className="space-y-6" id="tasks-module">
      {/* Search and Quick Filters Header */}
      <Reveal className="relative overflow-hidden bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4" id="task-filter-panel">
        <ShimmerLine accent="sky" />
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
            onClick={handleOpenCreate}
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
                setCompletedWindowDays("30");
              }}
              className="w-full bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-slate-100 p-2 text-slate-400 font-semibold rounded-lg text-center transition-all cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </Reveal>

      {childUsers.length > 0 && (
        <Reveal delay={0.06} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4" id="child-reward-panel">
          <ShimmerLine accent="amber" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Điểm thưởng cho trẻ</h3>
              <p className="text-[11px] text-slate-500">Task có điểm sẽ tự cộng khi trẻ hoàn thành. Có thể cộng/trừ thủ công khi cần.</p>
            </div>
            {isAdultRole(currentUser.role) && (
              <form onSubmit={handleManualReward} className="grid grid-cols-1 sm:grid-cols-[160px_100px_1fr_auto] gap-2 text-xs">
                <select value={manualRewardUser} onChange={(e) => setManualRewardUser(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                  <option value="">Chọn trẻ</option>
                  {childUsers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
                <input type="number" value={manualRewardPoints || ""} onChange={(e) => setManualRewardPoints(Number(e.target.value))} placeholder="+/- điểm" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none" />
                <input value={manualRewardReason} onChange={(e) => setManualRewardReason(e.target.value)} placeholder="Lý do" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none" />
                <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl px-3 py-2 font-bold">Cập nhật</button>
              </form>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {childUsers.map(child => {
              const recent = rewardEntries.filter(e => e.userId === child.id).slice(0, 3);
              return (
                <div key={child.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{child.fullName}</span>
                    <span className="text-lg font-extrabold text-amber-400">{rewardTotals[child.id] || 0}</span>
                  </div>
                  <div className="space-y-1">
                    {recent.length === 0 ? (
                      <p className="text-[10px] text-slate-500">Chưa có lịch sử điểm.</p>
                    ) : recent.map(entry => (
                      <p key={entry.id} className="text-[10px] text-slate-500 truncate">
                        {entry.points > 0 ? "+" : ""}{entry.points} • {entry.reason}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* Tasks List Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center" id="empty-tasks">
          <p className="text-sm text-slate-500">Không tìm thấy công việc phù hợp với bộ lọc hiển thị.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4" id="tasks-kanban-board">
            <Reveal delay={0.1} className="relative overflow-hidden flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <ShimmerLine accent="sky" />
              <div className="flex items-center gap-2.5">
                <IconChip accent="sky"><Layers className="w-4 h-4" /></IconChip>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 text-balance">Bảng công việc gia đình</h3>
                  <p className="text-[11px] text-slate-500 text-pretty">Sắp xếp theo trạng thái, ưu tiên và hạn xử lý để cả nhà nhìn là biết việc nào cần làm trước.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                  <span className="block text-slate-500">Tổng</span>
                  <span className="font-extrabold text-slate-100 tabular-nums">{boardStats.total}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                  <span className="block text-slate-500">Đang mở</span>
                  <span className="font-extrabold text-sky-400 tabular-nums">{boardStats.active}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                  <span className="block text-slate-500">Khẩn cấp</span>
                  <span className="font-extrabold text-rose-400 tabular-nums">{boardStats.high}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                  <span className="block text-slate-500">Chưa giao</span>
                  <span className="font-extrabold text-amber-400 tabular-nums">{boardStats.unassigned}</span>
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] min-w-[180px]">
                <label htmlFor="completed-window-filter" className="block text-slate-500 mb-1">Hoàn thành</label>
                <select
                  id="completed-window-filter"
                  value={completedWindowDays}
                  onChange={(e) => setCompletedWindowDays(e.target.value as "7" | "30" | "90" | "all")}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="7">7 ngày gần nhất</option>
                  <option value="30">30 ngày gần nhất</option>
                  <option value="90">90 ngày gần nhất</option>
                  <option value="all">Tất cả</option>
                </select>
                {hiddenCompletedCount > 0 && (
                  <p className="mt-1 text-[10px] text-slate-500 tabular-nums">Đang ẩn {hiddenCompletedCount} task cũ.</p>
                )}
              </div>
            </Reveal>

            <div className={`grid grid-cols-1 md:grid-cols-2 ${visibleKanbanColumns.length > 2 ? "2xl:grid-cols-4" : "xl:grid-cols-2"} gap-4`}>
              {visibleKanbanColumns.map((column, columnIndex) => {
                const Icon = column.icon;
                const columnTasks = sortedTasks(boardTasks.filter(task => effectiveStatus(task) === column.status));

                return (
                  <Reveal as="section" key={column.status} delay={0.16 + columnIndex * 0.06} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg overflow-hidden">
                    <div className={`border-b ${column.headerClass} bg-slate-950/70 px-4 py-3`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`size-2 rounded-full ${column.accentClass} shrink-0`} />
                          <Icon className="size-4 shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-100 truncate">{column.title}</h4>
                            <p className="text-[10px] text-slate-500 truncate">{column.hint}</p>
                          </div>
                        </div>
                        <span className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-300 tabular-nums">
                          {columnTasks.length}
                        </span>
                      </div>
                    </div>

                    {/* Thân cột: cao tối đa ~3 thẻ task, dài hơn thì cuộn bên trong cột */}
                    <div className="p-3 space-y-3 min-h-[220px] max-h-[660px] overflow-y-auto overscroll-contain scrollbar-thin">
                      {columnTasks.length === 0 ? (
                        <div className="h-32 border border-dashed border-slate-800 rounded-xl flex items-center justify-center px-4 text-center">
                          <p className="text-[11px] text-slate-500">Không có task ở cột này.</p>
                        </div>
                      ) : (
                        <AnimatePresence initial={false}>
                          {columnTasks.map(task => {
                            const assignee = users.find(u => u.id === task.assigneeId);
                            const creator = users.find(u => u.id === task.creatorId);
                            const next = quickNextStatus(task);
                            const dueDate = task.dueDate?.split(" ")[0] || "Chưa đặt hạn";
                            const recurrence = recurrenceLabel(task.recurrenceType);

                            return (
                              <motion.article
                                key={task.id}
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.15 }}
                                className={`rounded-xl border bg-slate-950/80 p-3 shadow-sm space-y-3 hover:shadow-lg hover:shadow-sky-500/5 transition-[box-shadow,border-color] duration-300 ${task.priority === TaskPriority.HIGH && task.status !== TaskStatus.COMPLETED ? "border-rose-500/35" : "border-slate-800 hover:border-sky-500/25"} ${savingId === task.id ? "opacity-60 pointer-events-none" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-lg ${priorityColor(task.priority)}`}>
                                    {priorityLabel(task.priority)}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedTask(task)}
                                      className="size-7 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-sky-400 flex items-center justify-center cursor-pointer"
                                      title="Xem chi tiết & bình luận"
                                      aria-label={`Xem chi tiết task ${task.title}`}
                                    >
                                      <MessageSquare className="size-3.5" />
                                    </button>
                                    {canEditTask(task) && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditTask(task)}
                                        className="size-7 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-amber-400 flex items-center justify-center cursor-pointer"
                                        title="Sửa / giao lại công việc"
                                        aria-label={`Sửa task ${task.title}`}
                                      >
                                        <Pencil className="size-3.5" />
                                      </button>
                                    )}
                                    {canDeleteTask(task) && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteClick(task.id)}
                                        className="size-7 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-rose-400 flex items-center justify-center cursor-pointer"
                                        title="Xóa công việc"
                                        aria-label={`Xóa task ${task.title}`}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setSelectedTask(task)}
                                  className="block w-full text-left cursor-pointer"
                                >
                                  <h4 className={`text-sm font-bold leading-snug text-pretty ${task.status === TaskStatus.COMPLETED ? "line-through text-slate-500" : "text-slate-100 hover:text-sky-400"}`}>
                                    {task.title}
                                  </h4>
                                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-relaxed text-pretty">
                                    {task.description || "Không có mô tả công việc."}
                                  </p>
                                </button>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {assignee ? (
                                        <>
                                          <Avatar user={assignee} className="size-6 rounded-full text-[10px]" extraClass="shrink-0" />
                                          <span className="text-slate-300 truncate">{assignee.fullName}</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="size-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                                            <UserIcon className="size-3 text-slate-500" />
                                          </span>
                                          <span className="text-slate-500 italic truncate">Chưa giao</span>
                                        </>
                                      )}
                                    </div>
                                    <span className="text-slate-500 flex items-center gap-1 shrink-0 font-mono tabular-nums">
                                      <Calendar className="size-3 text-amber-500/80" />
                                      {dueDate}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5">
                                    <span className={`text-[10px] px-2 py-0.5 border rounded-lg font-semibold ${statusColor(effectiveStatus(task))}`}>
                                      {statusName(effectiveStatus(task))}
                                    </span>
                                    {task.isShared ? (
                                      <span className="text-[10px] px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg font-semibold flex items-center gap-1">
                                        <Share2 className="size-3" /> Chung
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg font-semibold">
                                        Cá nhân
                                      </span>
                                    )}
                                    {(task.rewardPoints || 0) > 0 && (
                                      <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg font-bold">
                                        +{task.rewardPoints} điểm
                                      </span>
                                    )}
                                    {recurrence && (
                                      <span className="text-[10px] px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg font-semibold">
                                        {recurrence}
                                      </span>
                                    )}
                                  </div>

                                  {task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {task.tags.slice(0, 4).map((tag, i) => (
                                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-900 text-slate-500 border border-slate-800 rounded">
                                          #{tag}
                                        </span>
                                      ))}
                                      {task.tags.length > 4 && (
                                        <span className="text-[10px] px-1.5 py-0.5 text-slate-600">+{task.tags.length - 4}</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-[10px] text-slate-600">
                                    Tạo bởi {creator ? creator.fullName : "ẩn danh"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(task, next.status)}
                                    className="shrink-0 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer"
                                  >
                                    {next.label}
                                  </button>
                                </div>
                              </motion.article>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Slideout Detail or Modal for Comments & Comment history logs */}
      {selectedTask && activeTaskDetails && (
        <div 
          onClick={() => setSelectedTask(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="task-details-modal"
        >
          <div
            ref={detailRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] outline-none"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="space-y-1">
                <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 border rounded-lg ${priorityColor(activeTaskDetails.priority)}`}>
                  Độ ưu tiên: {activeTaskDetails.priority === "high" ? "Khẩn cấp" : activeTaskDetails.priority === "medium" ? "Trung bình" : "Thấp"}
                </span>
                <h2 className="text-md font-bold text-slate-100">{activeTaskDetails.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                {canEditTask(activeTaskDetails) && (
                  <button
                    onClick={() => handleOpenEditTask(activeTaskDetails)}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg cursor-pointer"
                    title="Sửa / giao lại công việc"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Sửa
                  </button>
                )}
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-2 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
                    Gửi
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
          onClick={handleCloseTaskForm}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="task-create-modal"
        >
          <motion.div
            ref={formRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800 shrink-0">
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5 text-sky-400" /> {editingTaskId ? "Chỉnh sửa công việc" : "Tạo việc mới hằng ngày"}
              </h3>
              <button
                onClick={handleCloseTaskForm}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="flex flex-col min-h-0 flex-1 overflow-hidden text-xs">
              <div className="space-y-4 overflow-y-auto px-5 py-4 flex-1 min-h-0">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
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

                <div className="space-y-1 min-w-0">
                  <label className="text-slate-400 block font-semibold">Hạn hoàn thành</label>
                  <DateTimePicker24 value={newDueDate} onChange={setNewDueDate} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
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
                    <option value="false">Riêng tư (Chỉ Admin & người phân công thấy)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Điểm thưởng</label>
                  <input
                    type="number"
                    min="0"
                    value={newRewardPoints || ""}
                    onChange={(e) => setNewRewardPoints(Number(e.target.value))}
                    placeholder="VD: 5"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Task lặp lại</label>
                  <select
                    value={newRecurrenceType}
                    onChange={(e) => setNewRecurrenceType(e.target.value as RecurrenceType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">Không lặp</option>
                    <option value="daily">Hàng ngày</option>
                    <option value="weekly">Hàng tuần</option>
                    <option value="monthly">Hàng tháng</option>
                  </select>
                </div>
                {newRecurrenceType !== "none" && (
                  <div className="space-y-1 col-span-2">
                    <label className="text-slate-400 block font-semibold">Kết thúc lặp</label>
                    <input
                      type="date"
                      value={newRecurrenceEndDate}
                      onChange={(e) => setNewRecurrenceEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
                {newRecurrenceType !== "none" && (
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-slate-400 block font-semibold">Xoay vòng người nhận (tùy chọn)</label>
                    <p className="text-[10px] text-slate-500">Chọn các thành viên để mỗi lần lặp lại tự luân phiên giao cho người kế tiếp.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {users.map(u => {
                        const active = newRotationMemberIds.includes(u.id);
                        return (
                          <button
                            type="button"
                            key={u.id}
                            onClick={() => setNewRotationMemberIds(prev => active ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${active ? "bg-indigo-500 text-white border-indigo-400" : "bg-slate-950 text-slate-400 border-slate-800 hover:border-indigo-500/50"}`}
                          >
                            {active && newRotationMemberIds.indexOf(u.id) >= 0 ? `${newRotationMemberIds.indexOf(u.id) + 1}. ` : ""}{u.fullName}
                          </button>
                        );
                      })}
                    </div>
                    {newRotationMemberIds.length > 0 && (
                      <p className="text-[10px] text-indigo-400">Thứ tự xoay vòng theo số hiển thị. Bấm lại để bỏ chọn.</p>
                    )}
                  </div>
                )}
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

              </div>

              <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseTaskForm}
                  className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold"
                >
                  Đóng lại
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {editingTaskId ? "Lưu thay đổi" : "Lên nhiệm vụ"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
