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
  Moon,
  Lock,
  ShoppingCart,
  Pill
} from "lucide-react";
import {
  User,
  UserRole,
  Task,
  FamilyPlan,
  Note,
  FinancialTransaction,
  FamilyAsset,
  Notification,
  RewardPointEntry,
  BudgetLimit,
  RecurringBill,
  MedicationReminder,
  ROLE_LABELS,
  FAMILY_RELATION_LABELS,
  canAccessFinance
} from "./types.js";
import { Auth } from "./components/Auth.js";
import { Avatar } from "./components/Avatar.js";
import { Dashboard } from "./components/Dashboard.js";
import { Tasks } from "./components/Tasks.js";
import { Schedules } from "./components/Schedules.js";
import { Notes } from "./components/Notes.js";
import { Finance } from "./components/Finance.js";
import { Shopping } from "./components/Shopping.js";
import { Medication } from "./components/Medication.js";
import { Assistant } from "./components/Assistant.js";
import { Settings } from "./components/Settings.js";
import { motion, AnimatePresence } from "motion/react";

type SettingsTab = "profile" | "members" | "backups" | "logs";

export default function App() {
  // Authentication & session status
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem("family_token"));
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

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("/sw.js").then(reg => {
      if (reg.waiting) setSwWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setSwWaiting(reg.waiting || installing);
          }
        });
      });
    }).catch(err => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  // PWA install prompt capture + live network status
  useEffect(() => {
    const goOnline = () => setNetworkOnline(true);
    const goOffline = () => setNetworkOnline(false);
    const onBeforeInstall = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* ignore */ }
    setInstallPrompt(null);
  };

  const handleApplyUpdate = () => {
    if (swWaiting) swWaiting.postMessage("SKIP_WAITING");
  };
  
  // Navigation layout state
  const [activeTab, setActiveTab] = useState<string>(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("tab"); // PWA shortcuts deep-link here
    return fromQuery || localStorage.getItem("family_active_tab") || "dashboard";
  });
  const [settingsTabRequest, setSettingsTabRequest] = useState<{ tab: SettingsTab; seq: number }>({ tab: "profile", seq: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // PWA: network status, install prompt, and pending service-worker update
  const [networkOnline, setNetworkOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    if (!canAccessFinance(currentUser.role) && activeTab === "finance") {
      setActiveTab("dashboard");
      return;
    }
    localStorage.setItem("family_active_tab", activeTab);
  }, [activeTab, currentUser]);

  // Database lists
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<FamilyPlan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [assets, setAssets] = useState<FamilyAsset[]>([]);
  const [rewardEntries, setRewardEntries] = useState<RewardPointEntry[]>([]);
  const [rewardTotals, setRewardTotals] = useState<Record<string, number>>({});
  const [budgets, setBudgets] = useState<BudgetLimit[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [medications, setMedications] = useState<MedicationReminder[]>([]);
  const [shoppingItems, setShoppingItems] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [widgets, setWidgets] = useState<any>(null);
  const [appVersion, setAppVersion] = useState<string>("");

  // Notifications modal control
  const [notifOpen, setNotifOpen] = useState(false);

  // Password-gated account switch modal
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchError, setSwitchError] = useState("");
  const [switchLoading, setSwitchLoading] = useState(false);

  // Server-Sent Events (SSE) reference
  const sseRef = useRef<EventSource | null>(null);

  // Authentication persistence check
  useEffect(() => {
    const savedToken = localStorage.getItem("family_token");
    if (savedToken) {
      fetch(`/api/auth/me`, {
        headers: { "Authorization": `Bearer ${savedToken}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then(data => {
          setCurrentUser(data.user);
        })
        .catch(() => {
          localStorage.removeItem("family_token");
          setAuthToken(null);
        })
        .finally(() => {
          setSessionInitialized(true);
        });
    } else {
      setSessionInitialized(true);
    }
  }, []);

  // Fetch functions with Bearer authentication (signed session token)
  const getAuthHeader = (): Record<string, string> => {
    return authToken ? { "Authorization": `Bearer ${authToken}` } : {};
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
    // Only adults (Admin/Member) may view the transactions list
    if (!canAccessFinance(currentUser.role)) return;
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

  const fetchRewards = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/rewards", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setRewardEntries(data.entries || []);
        setRewardTotals(data.totals || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFinancePlanning = async () => {
    if (!currentUser || !canAccessFinance(currentUser.role)) return;
    try {
      const [budgetRes, billRes, assetRes] = await Promise.all([
        fetch("/api/finance/budgets", { headers: getAuthHeader() }),
        fetch("/api/finance/recurring-bills", { headers: getAuthHeader() }),
        fetch("/api/finance/assets", { headers: getAuthHeader() })
      ]);
      if (budgetRes.ok) {
        const data = await budgetRes.json();
        setBudgets(data.budgets || []);
      }
      if (billRes.ok) {
        const data = await billRes.json();
        setRecurringBills(data.recurringBills || []);
      }
      if (assetRes.ok) {
        const data = await assetRes.json();
        setAssets(data.assets || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMedications = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/medications", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setMedications(data.medications || []);
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

  const fetchShopping = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/shopping", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setShoppingItems(data.shoppingItems || []);
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

  const fetchWidgets = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/widgets/overview", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setWidgets(data);
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
    fetchRewards();
    fetchFinancePlanning();
    fetchMedications();
    fetchShopping();
    fetchNotifications();
    fetchBackupsAndLogs();
    fetchWidgets();
    fetchAppVersion();
  };

  const fetchAppVersion = async () => {
    try {
      const res = await fetch("/api/version", { headers: getAuthHeader() });
      if (!res.ok) return;
      const d = await res.json();
      setAppVersion(d.shortCommit || d.version || "");
    } catch (e) {
      // version is non-critical; ignore
    }
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

    // Refresh dashboard widgets (weather/markets) periodically
    const widgetTimer = setInterval(() => { fetchWidgets(); }, 10 * 60 * 1000);

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
            fetchRewards();
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
            fetchFinancePlanning();
            fetchBackupsAndLogs();
            break;
          case "REWARDS_UPDATE":
            fetchRewards();
            fetchBackupsAndLogs();
            break;
          case "MEDICATIONS_UPDATE":
            fetchMedications();
            fetchNotifications();
            fetchBackupsAndLogs();
            break;
          case "SHOPPING_UPDATE":
            fetchShopping();
            fetchBackupsAndLogs();
            break;
          case "NOTIFICATIONS_UPDATE":
            fetchNotifications();
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
      clearInterval(widgetTimer);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [currentUser]);

  // Auth helper triggers
  const handleLoginSuccess = (user: User, token: string) => {
    localStorage.setItem("family_token", token);
    localStorage.setItem("family_active_tab", "dashboard");
    setAuthToken(token);
    setCurrentUser(user);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("family_token");
    localStorage.removeItem("family_user_id"); // clean up legacy key
    localStorage.removeItem("family_active_tab");
    setAuthToken(null);
    setCurrentUser(null);
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  };

  const openSettingsTab = (tab: SettingsTab) => {
    setSettingsTabRequest(prev => ({ tab, seq: prev.seq + 1 }));
    setActiveTab("settings");
    setMobileMenuOpen(false);
    if (tab === "backups" || tab === "logs") {
      fetchBackupsAndLogs();
    }
  };

  // Account switch now requires the target account's password (no more passwordless jump)
  const handleConfirmSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchTargetId) return;
    const target = users.find(u => u.id === switchTargetId);
    if (!target) return;

    setSwitchError("");
    setSwitchLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target.username, password: switchPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Mật khẩu không chính xác!");
      }
      handleLoginSuccess(data.user, data.token);
      setSwitchTargetId(null);
      setSwitchPassword("");
    } catch (err: any) {
      setSwitchError(err.message || "Không thể chuyển tài khoản");
    } finally {
      setSwitchLoading(false);
    }
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

  const handleAddRewardEntry = async (payload: Partial<RewardPointEntry>) => {
    const res = await fetch("/api/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleSaveBudget = async (payload: Partial<BudgetLimit>) => {
    const res = await fetch("/api/finance/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeleteBudget = async (id: string) => {
    const res = await fetch(`/api/finance/budgets/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleSaveRecurringBill = async (payload: Partial<RecurringBill>) => {
    const res = await fetch("/api/finance/recurring-bills", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handlePayRecurringBill = async (id: string) => {
    const res = await fetch(`/api/finance/recurring-bills/${id}/pay`, {
      method: "POST",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeleteRecurringBill = async (id: string) => {
    const res = await fetch(`/api/finance/recurring-bills/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleSaveAsset = async (payload: Partial<FamilyAsset>) => {
    const res = await fetch("/api/finance/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeleteAsset = async (id: string) => {
    const res = await fetch(`/api/finance/assets/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleSaveMedication = async (payload: Partial<MedicationReminder>) => {
    const res = await fetch("/api/medications", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleDeleteMedication = async (id: string) => {
    const res = await fetch(`/api/medications/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleSaveShoppingItem = async (data: any) => {
    const res = await fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error);
    }
    return res.json();
  };

  const handleToggleShoppingItem = async (id: string) => {
    const res = await fetch(`/api/shopping/${id}/toggle`, {
      method: "POST",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error);
    }
    return res.json();
  };

  const handleDeleteShoppingItem = async (id: string) => {
    const res = await fetch(`/api/shopping/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error);
    }
    return res.json();
  };

  const handleClearPurchasedShopping = async () => {
    const res = await fetch("/api/shopping/purchased", {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error);
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

  const handleDeleteUser = async (userId: string) => {
    const res = await fetch(`/api/users/${userId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleUpdateProfile = async (profilePayload: any) => {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(profilePayload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    const data = await res.json();
    // The current user just edited their own profile — reflect it immediately
    if (data.user) {
      setCurrentUser(data.user);
    }
    fetchUsers();
    return data;
  };

  const handleChangePassword = async (payload: { currentPassword: string; newPassword: string }) => {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleResetUserPassword = async (userId: string, newPassword: string) => {
    const res = await fetch(`/api/users/${userId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ newPassword })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res.json();
  };

  const handleAdminUpdateUser = async (userId: string, data: any) => {
    const res = await fetch(`/api/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    // Parse defensively: an empty/non-JSON body (e.g. missing route) must not crash the UI
    const text = await res.text();
    const d = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
    if (!res.ok) {
      throw new Error(d.error || `Máy chủ trả về lỗi ${res.status}. Hãy thử khởi động lại server.`);
    }
    // If the admin edited their own account, reflect it immediately
    if (d.user && currentUser && d.user.id === currentUser.id) {
      setCurrentUser(d.user);
    }
    fetchUsers();
    return d;
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
    { id: "shopping", label: "Đi chợ", icon: ShoppingCart },
    { id: "medications", label: "Thuốc", icon: Pill },
    // Only show finance to Admin and Members; hidden from Child and Guest accounts
    ...(canAccessFinance(currentUser.role) ? [{ id: "finance", label: "Chi tiêu", icon: Wallet }] : []),
    { id: "settings", label: "Thiết lập", icon: Settings2 }
  ];

  return (
    <div className="h-screen overflow-hidden bg-slate-950 flex text-slate-200 selection:bg-sky-200 selection:text-sky-700 font-sans relative">

      {/* PWA: offline banner */}
      {!networkOnline && (
        <div className="fixed top-0 inset-x-0 z-[70] bg-amber-500 text-slate-950 text-[11px] font-bold text-center py-1.5 px-3 shadow-md">
          Đang offline — dữ liệu hiển thị là bản gần nhất, thao tác mới sẽ chờ có mạng.
        </div>
      )}

      {/* PWA: update available */}
      {swWaiting && (
        <button
          onClick={handleApplyUpdate}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" /> Có bản cập nhật mới — Bấm để làm mới
        </button>
      )}

      {/* PWA: install prompt button */}
      {installPrompt && (
        <button
          onClick={handleInstallApp}
          className="fixed bottom-20 right-5 z-[70] bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer"
        >
          <Home className="w-4 h-4" /> Cài app lên máy
        </button>
      )}

      {/* Visual glowing particle effects */}
      <div className="absolute top-0 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* 1. SIDEBAR Navigation Drawer (Leaning desktop screens) */}
      <aside className="hidden lg:flex h-screen sticky top-0 flex-col w-64 border-r border-slate-850 bg-slate-900/60 backdrop-blur-md justify-between shrink-0 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-20 overflow-hidden">
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
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
        <div className="shrink-0 space-y-4 pt-4 border-t border-slate-850">
          <button
            type="button"
            onClick={() => openSettingsTab("profile")}
            className="w-full flex items-center gap-2.5 px-1.5 py-2 rounded-xl text-xs text-left hover:bg-slate-800/40 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition-all cursor-pointer"
            title="Mở hồ sơ của tôi"
            aria-label={`Mở hồ sơ của ${currentUser.fullName}`}
          >
            <Avatar user={currentUser} className="w-8.5 h-8.5 rounded-xl text-sm" extraClass="shrink-0" />
            <div className="space-y-0.5 truncate flex-1">
              <span className="font-bold text-slate-100 block truncate">{currentUser.fullName}</span>
              <span className="text-[10px] text-slate-400 font-mono block truncate">
                {ROLE_LABELS[currentUser.role]}{currentUser.familyRelation ? ` • ${FAMILY_RELATION_LABELS[currentUser.familyRelation]}` : ""}{appVersion ? ` • v${appVersion}` : ""}
              </span>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full text-slate-400 hover:text-rose-400 flex items-center gap-3 px-3 py-2.5 hover:bg-rose-500/5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" /> Thống kê Đăng xuất
          </button>
        </div>
      </aside>

      {/* 2. MAIN SCREEN AREA */}
      <div className="flex-1 h-screen min-h-0 flex flex-col min-w-0 pr-0 overflow-hidden">
        
        {/* TOP COMPONENT APP BAR HEADER */}
        <header className="shrink-0 sticky top-0 border-b border-slate-850 bg-slate-900/80 backdrop-blur-md px-5 py-3.5 flex items-center justify-between z-30">
          
          <div className="flex items-center gap-2 min-w-0">
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
                onChange={(e) => {
                  const id = e.target.value;
                  if (id && id !== currentUser.id) {
                    setSwitchTargetId(id);
                    setSwitchPassword("");
                    setSwitchError("");
                  }
                }}
                className="bg-slate-900 border-0 text-slate-300 font-semibold focus:outline-none focus:ring-0 p-1 rounded-lg cursor-pointer max-w-[120px] md:max-w-[none]"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
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
        <main className="min-h-0 flex-1 px-5 md:px-6 pt-5 md:pt-6 overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="wait">
            {/*
              Bottom padding lives on the (overflowing) content, not <main>:
              a scroll container's own padding-bottom is dropped by browsers when content overflows.
              Extra room so the last widget clears the floating buttons + phone home bar.
            */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.15 }}
              className="min-h-full pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]"
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
                  widgets={widgets}
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
                  rewardEntries={rewardEntries}
                  rewardTotals={rewardTotals}
                  onAddReward={handleAddRewardEntry}
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

              {activeTab === "shopping" && (
                <Shopping
                  currentUser={currentUser}
                  users={users}
                  shoppingItems={shoppingItems}
                  onSaveItem={handleSaveShoppingItem}
                  onToggleItem={handleToggleShoppingItem}
                  onDeleteItem={handleDeleteShoppingItem}
                  onClearPurchased={handleClearPurchasedShopping}
                />
              )}

              {activeTab === "medications" && (
                <Medication
                  currentUser={currentUser}
                  users={users}
                  medications={medications}
                  onSaveMedication={handleSaveMedication}
                  onDeleteMedication={handleDeleteMedication}
                />
              )}

              {activeTab === "finance" && canAccessFinance(currentUser.role) && (
                <Finance
                  currentUser={currentUser}
                  users={users}
                  transactions={transactions}
                  budgets={budgets}
                  recurringBills={recurringBills}
                  assets={assets}
                  widgets={widgets}
                  onSaveTransaction={handleSaveTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onSaveBudget={handleSaveBudget}
                  onDeleteBudget={handleDeleteBudget}
                  onSaveRecurringBill={handleSaveRecurringBill}
                  onPayRecurringBill={handlePayRecurringBill}
                  onDeleteRecurringBill={handleDeleteRecurringBill}
                  onSaveAsset={handleSaveAsset}
                  onDeleteAsset={handleDeleteAsset}
                />
              )}

              {activeTab === "settings" && (
                <Settings
                  currentUser={currentUser}
                  users={users}
                  activityLogs={activityLogs}
                  backups={backups}
                  onCreateUser={handleCreateUser}
                  onDeleteUser={handleDeleteUser}
                  onUpdateProfile={handleUpdateProfile}
                  onChangePassword={handleChangePassword}
                  onResetUserPassword={handleResetUserPassword}
                  onAdminUpdateUser={handleAdminUpdateUser}
                  requestedTab={settingsTabRequest.tab}
                  requestedTabSeq={settingsTabRequest.seq}
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
            className="w-72 h-full bg-slate-900 border-r border-slate-800 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col justify-between overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
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
            <div className="shrink-0 space-y-4 pt-4 border-t border-slate-850">
              <button
                type="button"
                onClick={() => openSettingsTab("profile")}
                className="w-full flex items-center gap-3 px-1.5 py-2 rounded-xl text-xs text-left hover:bg-slate-800/40 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition-all cursor-pointer"
                title="Mở hồ sơ của tôi"
                aria-label={`Mở hồ sơ của ${currentUser.fullName}`}
              >
                <Avatar user={currentUser} className="w-8.5 h-8.5 rounded-xl text-sm" extraClass="shrink-0" />
                <div className="space-y-0.5 truncate flex-1">
                  <span className="font-bold text-slate-100 block truncate">{currentUser.fullName}</span>
                  <span className="text-[10px] text-slate-400 font-mono block truncate">
                    {ROLE_LABELS[currentUser.role]}{currentUser.familyRelation ? ` • ${FAMILY_RELATION_LABELS[currentUser.familyRelation]}` : ""}{appVersion ? ` • v${appVersion}` : ""}
                  </span>
                </div>
              </button>

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

      <Assistant currentUser={currentUser} authHeaders={getAuthHeader()} />

      {/* PASSWORD-GATED ACCOUNT SWITCH MODAL */}
      {switchTargetId && (() => {
        const target = users.find(u => u.id === switchTargetId);
        if (!target) return null;
        return (
          <div
            onClick={() => setSwitchTargetId(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <Avatar user={target} className="w-10 h-10 rounded-xl text-base" extraClass="shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-100 truncate">Chuyển sang {target.fullName}</h3>
                  <p className="text-[11px] text-slate-500 font-mono truncate">@{target.username}</p>
                </div>
              </div>

              <form onSubmit={handleConfirmSwitch} className="space-y-3 text-xs">
                {switchError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{switchError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-slate-400 block font-semibold">Nhập mật khẩu của tài khoản này</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      autoFocus
                      type="password"
                      value={switchPassword}
                      onChange={(e) => setSwitchPassword(e.target.value)}
                      placeholder="Mật khẩu..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSwitchTargetId(null)}
                    className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={switchLoading}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {switchLoading ? "Đang xác thực..." : "Xác nhận chuyển"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}
