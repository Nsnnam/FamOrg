/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Home, 
  CheckSquare, 
  Calendar, 
  FileText, 
  Wallet, 
  Settings2, 
  Bell, 
  LogOut, 
  Menu, 
  X, 
  Wifi, 
  AlertCircle,
  Clock,
  Sparkles,
  Info,
  Sun,
  Moon
} from "lucide-react";
import { User, UserRole, Task, FamilyPlan, Note, FinancialTransaction, Notification } from "./types.js";
import { Auth } from "./components/Auth.js";
import { Dashboard } from "./components/Dashboard.js";
import { Tasks } from "./components/Tasks.js";
import { Schedules } from "./components/Schedules.js";
import { Notes } from "./components/Notes.js";
import { Finance } from "./components/Finance.js";
import { Settings } from "./components/Settings.js";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Authentication & session status
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("family_theme");
    return (saved as "light" | "dark") || "light";
  });

  useEffect(() => {
    localStorage.setItem("family_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);
  
  // Navigation layout state
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Database lists
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<FamilyPlan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);

  // Notifications modal control
  const [notifOpen, setNotifOpen] = useState(false);

  // Server-Sent Events (SSE) reference
  const sseRef = useRef<EventSource | null>(null);

  // Authentication persistence check
  useEffect(() => {
    const savedUserId = localStorage.getItem("family_user_id");
    if (savedUserId) {
      fetch(`/api/auth/me`, {
        headers: { "Authorization": `Bearer ${savedUserId}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then(data => {
          setCurrentUser(data.user);
        })
        .catch(() => {
          localStorage.removeItem("family_user_id");
        })
        .finally(() => {
          setSessionInitialized(true);
        });
    } else {
      setSessionInitialized(true);
    }
  }, []);

  // Fetch functions with Bearer authentication
  const getAuthHeader = () => {
    return currentUser ? { "Authorization": `Bearer ${currentUser.id}` } : {};
  };

  const fetchUsers = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/users", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTasks = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/tasks", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPlans = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/plans", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotes = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/notes", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTransactions = async () => {
    if (!currentUser) return;
    // Guest role does not have authorization to view transactions list
    if (currentUser.role === UserRole.GUEST) return;
    try {
      const res = await fetch("/api/finance", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/notifications", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBackupsAndLogs = async () => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;
    try {
      const [backupsRes, logsRes] = await Promise.all([
        fetch("/api/admin/backups", { headers: getAuthHeader() }),
        fetch("/api/admin/logs", { headers: getAuthHeader() })
      ]);

      if (backupsRes.ok) {
        const b = await backupsRes.json();
        setBackups(b.backups || []);
      }
      if (logsRes.ok) {
        const l = await logsRes.json();
        setActivityLogs(l.logs || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dispatch fully unified refetch sequences
  const fetchAllData = () => {
    fetchUsers();
    fetchTasks();
    fetchPlans();
    fetchNotes();
    fetchTransactions();
    fetchNotifications();
    fetchBackupsAndLogs();
  };

  // Listen to realtime server pushes (SSE sync connection)
  useEffect(() => {
    if (!currentUser) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      return;
    }

    // Refresh core states on login
    fetchAllData();

    // Establish Server-Sent Events client loop pipeline
    const sse = new EventSource("/api/realtime");
    sseRef.current = sse;

    sse.onopen = () => {
      setIsOnline(true);
    };

    sse.onerror = () => {
      setIsOnline(false);
    };

    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("⚓ Đã đồng bộ tài liệu thời gian thực:", payload);

        switch (payload.type) {
          case "TASKS_UPDATE":
            fetchTasks();
            fetchNotifications();
            fetchBackupsAndLogs(); // refresh logs
            break;
          case "PLANS_UPDATE":
            fetchPlans();
            fetchNotifications();
            fetchBackupsAndLogs();
            break;
          case "NOTES_UPDATE":
            fetchNotes();
            fetchBackupsAndLogs();
            break;
          case "FINANCE_UPDATE":
            fetchTransactions();
            fetchBackupsAndLogs();
            break;
          case "USERS_UPDATE":
            fetchUsers();
            fetchBackupsAndLogs();
            break;
          case "BACKUPS_UPDATE":
            fetchBackupsAndLogs();
            break;
          case "RESTORE_COMPLETED":
            // Critical: full server reboot sync
            fetchAllData();
            break;
          default:
            break;
        }
      } catch (err) {
        console.error("SSE message parsing failed:", err);
      }
    };

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [currentUser]);

  // Auth helper triggers
  const handleLoginSuccess = (user: User) => {
    localStorage.setItem("family_user_id", user.id);
    setCurrentUser(user);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("family_user_id");
    setCurrentUser(null);
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  };

  // Quick switch account picker function inside top header
  const handleQuickSwitchUser = (userId: string) => {
    localStorage.setItem("family_user_id", userId);
    fetch(`/api/auth/me`, {
      headers: { "Authorization": `Bearer ${userId}` }
    })
      .then(res => res.json())
      .then(data => {
        setCurrentUser(data.user);
        setActiveTab("dashboard");
      });
  };

  // Mutations wrappers to connect dashboard callbacks with backend routes
  const handleSaveTask = async (taskData: Partial<Task>) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(taskData)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeleteTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleAddCommentToTask = async (taskId: string, commentContent: string) => {
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ content: commentContent })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleSavePlan = async (planData: Partial<FamilyPlan>) => {
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(planData)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeletePlan = async (planId: string) => {
    const res = await fetch(`/api/plans/${planId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleSaveNote = async (noteData: Partial<Note>) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(noteData)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeleteNote = async (noteId: string) => {
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleSaveTransaction = async (txData: Partial<FinancialTransaction>) => {
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(txData)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeleteTransaction = async (txId: string) => {
    const res = await fetch(`/api/finance/${txId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleCreateUser = async (userPayload: any) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(userPayload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleCreateBackup = async () => {
    const res = await fetch("/api/admin/backups", {
      method: "POST",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleRestoreBackup = async (backupId: string) => {
    const res = await fetch(`/api/admin/backups/${backupId}/restore`, {
      method: "POST",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeleteBackup = async (backupId: string) => {
    const res = await fetch(`/api/admin/backups/${backupId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleMarkNotifRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: "POST",
      headers: getAuthHeader()
    });
    // refresh
    fetchNotifications();
  };

  const handleMarkAllNotifsRead = async () => {
    await fetch(`/api/notifications/read-all`, {
      method: "POST",
      headers: getAuthHeader()
    });
    // refresh
    fetchNotifications();
  };

  // Compute unread alert notifications
  const unreadNotifs = notifications.filter(n => !n.isRead);

  // Loading window blocker
  if (!sessionInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <div className="relative w-12 h-12 border-4 border-slate-800 border-t-sky-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-mono tracking-widest uppercase">Đang khởi tạo máy chủ tổ ấm...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show portal page
  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  // Navigation Links definition
  const navLinks = [
    { id: "dashboard", label: "Tổng quan", icon: Home },
    { id: "tasks", label: "Nhóm Task", icon: CheckSquare },
    { id: "plans", label: "Lập Lịch", icon: Calendar },
    { id: "notes", label: "Ghi chú", icon: FileText },
    // Only show finance to Admin and Members, hide from Guest child Account
    ...(currentUser.role !== UserRole.GUEST ? [{ id: "finance", label: "Chi tiêu", icon: Wallet }] : []),
    { id: "settings", label: "Thiết lập", icon: Settings2 }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-200 selection:bg-sky-200 selection:text-sky-700 font-sans relative">
      
      {/* Visual glowing particle effects */}
      <div className="absolute top-0 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* 1. SIDEBAR Navigation Drawer (Leaning desktop screens) */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-850 bg-slate-900/60 backdrop-blur-md justify-between shrink-0 p-5 z-20">
        <div className="space-y-8">
          {/* Main Visual Title */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="bg-sky-500/10 p-2 rounded-xl text-sky-400 border border-sky-400/10 leading-none">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <span className="text-md font-extrabold text-slate-100 block tracking-tight">Family Organizer</span>
              <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500">Raspberry Pi 5 Hub</span>
            </div>
          </div>

          {/* List items links */}
          <nav className="space-y-1 text-xs">
            {navLinks.map(link => {
              const Icon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold cursor-pointer transition-all ${isActive ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/5" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"}`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer details */}
        <div className="space-y-4 pt-4 border-t border-slate-850">
          <div className="flex items-center gap-2.5 px-1.5 text-xs">
            <div className={`w-8.5 h-8.5 rounded-xl ${currentUser.avatarColor} text-slate-950 font-extrabold flex items-center justify-center`}>
              {currentUser.fullName.charAt(0)}
            </div>
            <div className="space-y-0.5 truncate flex-1">
              <span className="font-bold text-slate-100 block truncate">{currentUser.fullName}</span>
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Role: {currentUser.role}</span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full text-slate-400 hover:text-rose-400 flex items-center gap-3 px-3 py-2.5 hover:bg-rose-500/5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" /> Thống kê Đăng xuất
          </button>
        </div>
      </aside>

      {/* 2. MAIN SCREEN AREA */}
      <div className="flex-1 flex flex-col min-w-0 pr-0">
        
        {/* TOP COMPONENT APP BAR HEADER */}
        <header className="border-b border-slate-850 bg-slate-900/40 backdrop-blur-md px-5 py-3.5 flex items-center justify-between z-20">
          
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 bg-slate-950 border border-slate-800 rounded-xl leading-none cursor-pointer"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            {/* SSE replication indicators */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-950 p-2 border border-slate-850 rounded-xl font-mono text-[10px] text-slate-400">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Realtime Sync: <span className="text-emerald-400 font-bold">ONLINE</span></span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                  <span>Realtime Sync: <span className="text-rose-400 font-bold">OFFLINE</span></span>
                </>
              )}
            </div>
          </div>

          {/* User selector, alerts bells */}
          <div className="flex items-center gap-3">
            
            {/* Quick Demo Role selection panel block */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850 text-[10px] font-sans">
              <span className="text-slate-500 px-1 text-[9px] uppercase font-mono font-bold hidden md:inline">Nhân vật:</span>
              <select
                value={currentUser.id}
                onChange={(e) => handleQuickSwitchUser(e.target.value)}
                className="bg-slate-900 border-0 text-slate-300 font-semibold focus:outline-none focus:ring-0 p-1 rounded-lg cursor-pointer max-w-[120px] md:max-w-[none]"
              >
                <option value="user_admin">Gia Trưởng (Admin)</option>
                <option value="user_mother">Mẹ Lan (Member)</option>
                <option value="user_father">Bố Hùng (Member)</option>
                <option value="user_child">Bé Vy (Guest)</option>
              </select>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="p-2.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 bg-slate-950 border border-slate-850 rounded-xl outline-none leading-none cursor-pointer group flex items-center justify-center transition-all"
              title={theme === "light" ? "Chuyển sang Giao diện Tối" : "Chuyển sang Giao diện Sáng"}
            >
              {theme === "light" ? (
                <Moon className="w-4.5 h-4.5 transition-transform group-hover:scale-110" />
              ) : (
                <Sun className="w-4.5 h-4.5 text-amber-500 transition-transform group-hover:rotate-45" />
              )}
            </button>

            {/* Notifications Alert Bells list */}
            <div className="relative">
              <button 
                onClick={() => { setNotifOpen(!notifOpen); fetchNotifications(); }}
                className="p-2.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 bg-slate-950 border border-slate-850 rounded-xl outline-none leading-none relative cursor-pointer group"
              >
                <Bell className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-slate-950 text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-slate-950 animate-pulse">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notif box menu floating absolute */}
              {notifOpen && (
                <div className="absolute right-0 mt-2.5 w-76 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl z-30 font-sans">
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-800 text-xs text-slate-450 font-bold mb-2">
                    <span className="flex items-center gap-1.5"><Bell className="w-4 h-4 text-sky-400" /> Bản tin ({unreadNotifs.length})</span>
                    {unreadNotifs.length > 0 && (
                      <button 
                        onClick={handleMarkAllNotifsRead}
                        className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        Đọc hết
                      </button>
                    )}
                  </div>

                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-0.5">
                    {notifications.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-6 text-center">Hộp thư trống...</p>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => handleMarkNotifRead(n.id)}
                          className={`p-2 rounded-xl text-left text-[11px] hover:bg-slate-850 relative group cursor-pointer border ${n.isRead ? "bg-slate-950/20 border-transparent text-slate-500" : "bg-slate-950 border-slate-800/60 text-slate-200 font-medium"}`}
                        >
                          <p className="font-bold text-slate-300 pr-4">{n.title}</p>
                          <p className="text-slate-450 mt-0.5 leading-relaxed font-sans">{n.content}</p>
                          <span className="text-[9px] text-slate-500/80 font-mono mt-1 block">{new Date(n.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                          
                          {!n.isRead && (
                            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-sky-500" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* WORKSPACE VIEW CONTAINER */}
        <main className="flex-1 p-5 md:p-6 overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {activeTab === "dashboard" && (
                <Dashboard 
                  currentUser={currentUser}
                  users={users}
                  tasks={tasks}
                  plans={plans}
                  notes={notes}
                  transactions={transactions}
                  activityLogs={activityLogs}
                  onNavigate={(tab) => {
                    setActiveTab(tab);
                    // Also query log history if navigating to settings
                    if (tab === "settings") fetchBackupsAndLogs();
                  }}
                />
              )}

              {activeTab === "tasks" && (
                <Tasks 
                  currentUser={currentUser}
                  users={users}
                  tasks={tasks}
                  onSaveTask={handleSaveTask}
                  onDeleteTask={handleDeleteTask}
                  onAddComment={handleAddCommentToTask}
                />
              )}

              {activeTab === "plans" && (
                <Schedules 
                  currentUser={currentUser}
                  users={users}
                  plans={plans}
                  onSavePlan={handleSavePlan}
                  onDeletePlan={handleDeletePlan}
                />
              )}

              {activeTab === "notes" && (
                <Notes 
                  currentUser={currentUser}
                  users={users}
                  notes={notes}
                  onSaveNote={handleSaveNote}
                  onDeleteNote={handleDeleteNote}
                />
              )}

              {activeTab === "finance" && currentUser.role !== UserRole.GUEST && (
                <Finance 
                  currentUser={currentUser}
                  users={users}
                  transactions={transactions}
                  onSaveTransaction={handleSaveTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {activeTab === "settings" && (
                <Settings 
                  currentUser={currentUser}
                  users={users}
                  activityLogs={activityLogs}
                  backups={backups}
                  onCreateUser={handleCreateUser}
                  onCreateBackup={handleCreateBackup}
                  onRestoreBackup={handleRestoreBackup}
                  onDeleteBackup={handleDeleteBackup}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MOBILE FULL-SCREEN MOBILE OVERLAY MENU DRAWER */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/90 z-40 lg:hidden flex justify-start backdrop-blur-sm"
        >
          <motion.div 
            initial={{ x: -100 }}
            animate={{ x: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-72 bg-slate-900 border-r border-slate-800 p-5 flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-sky-500/15 p-2 rounded-xl text-sky-450 leading-none">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-100 block">Family Hub</span>
                    <span className="text-[9px] uppercase font-mono text-slate-500">Raspberry Pi Server</span>
                  </div>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-lg leading-none cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="space-y-1 text-xs">
                {navLinks.map(link => {
                  const Icon = link.icon;
                  const isActive = activeTab === link.id;
                  return (
                    <button
                      key={link.id}
                      onClick={() => {
                        setActiveTab(link.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl font-bold cursor-pointer transition-all ${isActive ? "bg-sky-500 text-slate-950" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"}`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                      <span>{link.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar logout */}
            <div className="space-y-4 pt-4 border-t border-slate-850">
              <div className="flex items-center gap-3 px-1.5 text-xs">
                <div className={`w-8.5 h-8.5 rounded-xl ${currentUser.avatarColor} text-slate-950 font-extrabold flex items-center justify-center`}>
                  {currentUser.fullName.charAt(0)}
                </div>
                <div className="space-y-0.5 truncate flex-1">
                  <span className="font-bold text-slate-100 block truncate">{currentUser.fullName}</span>
                  <span className="text-[10px] text-slate-550 uppercase font-mono block">Role: {currentUser.role}</span>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="w-full text-slate-400 hover:text-rose-400 flex items-center gap-3 px-3 py-3 hover:bg-rose-500/5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <LogOut className="w-4.5 h-4.5" /> Thống kê Đăng xuất
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
