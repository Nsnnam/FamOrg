/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Users, 
  Database, 
  History, 
  UserPlus, 
  Trash2, 
  RefreshCw, 
  Download, 
  CheckCircle, 
  AlertTriangle,
  Lock,
  Compass,
  Layers,
  Sparkles
} from "lucide-react";
import { User, UserRole } from "../types.js";
import { motion } from "motion/react";
import { useConfirm } from "./ConfirmDialog.js";

interface SettingsProps {
  currentUser: User;
  users: User[];
  activityLogs: any[];
  backups: any[];
  onCreateUser: (user: any) => Promise<any>;
  onDeleteUser: (id: string) => Promise<any>;
  onCreateBackup: () => Promise<any>;
  onRestoreBackup: (id: string) => Promise<any>;
  onDeleteBackup: (id: string) => Promise<any>;
}

export function Settings({
  currentUser,
  users,
  activityLogs,
  backups,
  onCreateUser,
  onDeleteUser,
  onCreateBackup,
  onRestoreBackup,
  onDeleteBackup
}: SettingsProps) {
  // In-app confirmation dialog (replaces native browser confirm)
  const { confirm, ConfirmDialog } = useConfirm();
  // Tab configuration
  const [activeTab, setActiveTab] = useState<"members" | "backups" | "logs">("members");
  
  // Registration form
  const [regUsername, setRegUsername] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regRole, setRegRole] = useState<UserRole>(UserRole.MEMBER);
  const [regPassword, setRegPassword] = useState("");
  const [regAvatar, setRegAvatar] = useState("bg-indigo-500");
  
  // Action state trackers
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");

    if (!regUsername.trim() || !regFullName.trim() || !regPassword) {
      setActionError("Vui lòng điền đầy đủ các trường thông tin bắt buộc!");
      return;
    }

    setLoadingAction("register");
    try {
      await onCreateUser({
        username: regUsername.toLowerCase().trim(),
        fullName: regFullName.trim(),
        role: regRole,
        passwordPlain: regPassword,
        avatarColor: regAvatar
      });
      setActionSuccess(`Đã tạo tài khoản thành viên mới cho ${regFullName.trim()} thành công!`);
      // Reset
      setRegUsername("");
      setRegFullName("");
      setRegPassword("");
    } catch (err: any) {
      setActionError(err.message || "Tạo tài khoản thất bại");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTriggerManualBackup = async () => {
    setActionError("");
    setActionSuccess("");
    setLoadingAction("backup");
    try {
      const res = await onCreateBackup();
      setActionSuccess(`Tạo backup thủ công thành công! Tên tệp: ${res.filename} (${res.sizeKb} KB)`);
    } catch (err: any) {
      setActionError(err.message || "Sao lưu thất bại");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteUserClick = async (member: User) => {
    setActionError("");
    setActionSuccess("");
    const ok = await confirm({
      title: `Xóa thành viên ${member.fullName}?`,
      message: `Tài khoản @${member.username} sẽ bị xóa vĩnh viễn và không thể đăng nhập nữa. Các bản ghi (công việc, ghi chú, giao dịch) do thành viên này tạo trước đó vẫn được giữ lại trong hệ thống.`,
      confirmLabel: "Xóa thành viên",
      tone: "danger"
    });
    if (!ok) return;

    setLoadingAction(`delete-user-${member.id}`);
    try {
      await onDeleteUser(member.id);
      setActionSuccess(`Đã xóa tài khoản ${member.fullName} khỏi gia đình.`);
    } catch (err: any) {
      setActionError(err.message || "Xóa thành viên thất bại");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRestoreClick = async (backupId: string, filename: string) => {
    setActionError("");
    setActionSuccess("");
    const ok = await confirm({
      title: "Khôi phục cơ sở dữ liệu?",
      message: `CẢNH BÁO: Toàn bộ dữ liệu hiện tại sẽ bị THAY THẾ bằng dữ liệu tại điểm sao lưu "${filename}". Mọi thay đổi phát sinh sau thời điểm đó sẽ mất. Bạn có chắc chắn không?`,
      confirmLabel: "Khôi phục ngay",
      tone: "danger"
    });
    if (ok) {
      setLoadingAction(`restore-${backupId}`);
      try {
        await onRestoreBackup(backupId);
        setActionSuccess("Khôi phục cấu trúc dữ liệu thành công! Ứng dụng đã được đồng bộ hóa về điểm backup.");
        // Short page refresh to ensure client state refetches cleanly
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err: any) {
        setActionError(err.message || "Phục hồi tệp thất bại");
      } finally {
        setLoadingAction(null);
      }
    }
  };

  const handleDeleteBackupClick = async (backupId: string) => {
    const ok = await confirm({
      title: "Xóa tệp sao lưu?",
      message: "Tệp backup vật lý này sẽ bị xóa khỏi đĩa và không thể khôi phục lại. Bạn có chắc chắn không?",
      confirmLabel: "Xóa tệp",
      tone: "danger"
    });
    if (ok) {
      await onDeleteBackup(backupId);
    }
  };

  // Avatar colors presets
  const colors = [
    "bg-indigo-500", "bg-sky-500", "bg-emerald-500", "bg-teal-500", 
    "bg-rose-500", "bg-pink-500", "bg-amber-500", "bg-purple-500"
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6" id="settings-module">
      
      {/* Settings Navigation sub-header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4" id="settings-sub-header">
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1 text-xs">
          <button
            onClick={() => { setActiveTab("members"); setActionSuccess(""); setActionError(""); }}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === "members" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Users className="w-4 h-4 text-sky-400" /> Thành viên và Phân quyền
          </button>
          <button
            onClick={() => { setActiveTab("backups"); setActionSuccess(""); setActionError(""); }}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === "backups" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Database className="w-4 h-4 text-amber-400" /> Lưu trữ & Sao lưu tệp
          </button>
          <button
            onClick={() => { setActiveTab("logs"); setActionSuccess(""); setActionError(""); }}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === "logs" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            <History className="w-4 h-4 text-emerald-400" /> Nhật ký hệ thống
          </button>
        </div>

        {/* Current status info tag */}
        <span className="text-[10px] uppercase font-mono bg-slate-950 text-slate-400 border border-slate-850 px-2.5 py-1 rounded-lg">
          Quyền hạn: <span className="text-sky-400 font-bold">{currentUser.role === "admin" ? "Gia Trưởng (Admin)" : currentUser.role === "member" ? "Thành thành viên" : "Tài khoản Khách"}</span>
        </span>
      </div>

      {/* General feedback boxes inside settings */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Render sub-tab content */}
      {activeTab === "members" && (
        <div className="space-y-6" id="settings-tab-members">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* List of existing members */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                Danh sách tài khoản gia đình ({users.length})
              </h3>
              
              <div className="divide-y divide-slate-800/60 space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {users.map(u => (
                  <div key={u.id} className="pt-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`w-8.5 h-8.5 rounded-xl ${u.avatarColor} text-slate-950 font-bold text-sm flex items-center justify-center shrink-0`}>
                        {u.fullName.charAt(0)}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-slate-200 font-bold text-[13px]">{u.fullName}</p>
                        <p className="text-slate-500 font-mono text-[10px]">@{u.username} • {new Date(u.createdAt).toLocaleDateString("vi-VN")}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${u.role === "admin" ? "bg-red-500/10 text-red-400 border border-red-500/10" : u.role === "member" ? "bg-blue-500/10 text-blue-400 border border-blue-500/10" : "bg-green-500/10 text-green-400 border border-green-500/10"}`}>
                        {u.role.toUpperCase()}
                      </span>

                      {/* Delete member (Admin only, cannot delete self) */}
                      {currentUser.role === UserRole.ADMIN && u.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUserClick(u)}
                          disabled={loadingAction === `delete-user-${u.id}`}
                          className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer transition-all disabled:opacity-50"
                          title={`Xóa tài khoản ${u.fullName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create new member form (Admin only constraint) */}
            <div className="bg-slate-950 p-4.5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <UserPlus className="w-4.5 h-4.5 text-sky-400 animate-pulse" />
                Tạo tài khoản thành viên mới
              </h3>
              
              {currentUser.role !== UserRole.ADMIN ? (
                /* Protected block */
                <div className="py-12 text-center space-y-2">
                  <Lock className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500">Chỉ Gia Trưởng (Admin) mới có quyền tạo thêm tài khoản thành viên gia đình.</p>
                </div>
              ) : (
                /* Active block */
                <form onSubmit={handleRegisterUser} className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-400 block font-semibold">Tên đăng nhập <span className="text-rose-450">*</span></label>
                    <input 
                      type="text" 
                      placeholder="Viết liền không dấu, ví dụ: bevy"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 block font-semibold">Tên xưng hô đầy đủ <span className="text-rose-450">*</span></label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Bé Vy (Con út)"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 block font-semibold">Phân quyền</label>
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as UserRole)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                      >
                        <option value="member">Thành viên (Member)</option>
                        <option value="guest">Khách / Trẻ em (Guest)</option>
                        <option value="admin">Quản lý (Admin)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 block font-semibold">Mật khẩu khởi tạo <span className="text-rose-450">*</span></label>
                      <input 
                        type="password"
                        placeholder="Mật khẩu riêng..."
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Selecting theme avatar tag */}
                  <div className="space-y-1.5">
                    <label className="text-slate-400 block font-semibold">Màu sắc thương hiệu cá nhân</label>
                    <div className="flex wrap gap-2.5 pt-1">
                      {colors.map(c => (
                        <button 
                          key={c}
                          type="button"
                          onClick={() => setRegAvatar(c)}
                          className={`w-5.5 h-5.5 rounded-full cursor-pointer border-2 transition-all shrink-0 ${regAvatar === c ? "border-slate-100 scale-110" : "border-transparent opacity-80"}`}
                          title={c}
                          style={{ backgroundColor: c === "bg-indigo-500" ? "#6366f1" : c === "bg-sky-500" ? "#0ea5e9" : c === "bg-emerald-500" ? "#10b981" : c === "bg-teal-500" ? "#14b8a6" : c === "bg-rose-500" ? "#f43f5e" : c === "bg-pink-500" ? "#ec4899" : c === "bg-amber-500" ? "#f59e0b" : "#a855f7" }}
                        />
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loadingAction === "register"}
                    className="w-full mt-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2 px-4 rounded-xl cursor-pointer transition-all select-none disabled:opacity-50 text-center flex items-center justify-center"
                  >
                    {loadingAction === "register" ? "Đang xử lý đăng ký..." : "Kích hoạt tài khoản"}
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === "backups" && (
        <div className="space-y-5" id="settings-tab-backups">
          <div className="space-y-2 border-b border-slate-800 pb-3 block md:flex md:items-center md:justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                Trữ lượng phục hồi & Sao lưu tệp
              </h3>
              <p className="text-[11px] text-slate-500">Mọi sự kiện, nhiệm vụ, hóa đơn trong gia đình đều được kiểm soát và khôi phục dễ dàng.</p>
            </div>

            {/* Daily backups trigger */}
            <button 
              disabled={currentUser.role !== UserRole.ADMIN || loadingAction === "backup"}
              onClick={handleTriggerManualBackup}
              className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all self-start md:self-auto shrink-0 shadow duration-150 cursor-pointer"
            >
              <Download className="w-4 h-4" /> 
              {loadingAction === "backup" ? "Đang sao lưu tệp..." : "Tạo điểm hồi phục (Backup)"}
            </button>
          </div>

          {currentUser.role !== UserRole.ADMIN ? (
            /* Protected backup panel */
            <div className="py-16 text-center space-y-2 bg-slate-950/40 border border-slate-805 rounded-2xl">
              <Lock className="w-8 h-8 text-slate-605 mx-auto" />
              <p className="text-xs text-slate-500">Người dùng thông thường chỉ có thể xem dữ liệu. Quyền khôi phục và sao lưu thuộc về Gia Trưởng (Admin).</p>
            </div>
          ) : (
            /* Active backup panel */
            <div className="space-y-3.5">
              {backups.length === 0 ? (
                <div className="bg-slate-950 p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  Hệ thống chưa ghi nhận điểm lưu trữ thủ công nào. (Mặc định hệ thống tự động backup mỗi 24H).
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {backups.map(b => (
                    <div 
                      key={b.id}
                      className="bg-slate-955 border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-slate-700 transition-all text-xs"
                    >
                      <div className="space-y-1.5 flex-1 max-w-[65%]">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${b.type === "auto" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/10"}`}>
                            {b.type === "auto" ? "Tự động" : "Thủ công"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono italic">{b.sizeKb} KB</span>
                        </div>
                        <h4 className="text-slate-300 font-bold select-all truncate">{b.filename}</h4>
                        <p className="text-slate-500 text-[10px] font-mono">{new Date(b.createdAt).toLocaleString("vi-VN")}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Restore trigger */}
                        <button 
                          disabled={Boolean(loadingAction && loadingAction.startsWith("restore"))}
                          onClick={() => handleRestoreClick(b.id, b.filename)}
                          className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:text-emerald-450 hover:bg-slate-800 hover:border-slate-700 text-emerald-400 font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Khôi phục
                        </button>
                        
                        {/* Delete trigger */}
                        <button 
                          onClick={() => handleDeleteBackupClick(b.id)}
                          className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-500 hover:text-rose-450 rounded-lg cursor-pointer"
                          title="Xóa tệp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-4" id="settings-tab-logs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              Báo cáo nhật ký gia đình (Audit trail)
            </h3>
            <span className="text-slate-500 text-[10px] font-mono">Tối đa giữ 300 hoạt động gần nhất</span>
          </div>

          {currentUser.role !== UserRole.ADMIN ? (
            /* Protected panel */
            <div className="py-16 text-center space-y-2 bg-slate-950/40 border border-slate-805 rounded-2xl">
              <Lock className="w-8 h-8 text-slate-605 mx-auto" />
              <p className="text-xs text-slate-500">Nhật ký truy vết sâu hệ thống chỉ khả dụng cho quyền Gia Trưởng / Admin.</p>
            </div>
          ) : (
            /* Full scrollable operations trace log */
            <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-[350px] overflow-y-auto space-y-1.5 p-3 font-mono text-[11px] text-slate-300">
              {activityLogs.length === 0 ? (
                <p className="text-center text-slate-500 py-12 italic">Không có nhật ký hệ thống.</p>
              ) : (
                activityLogs.map(log => (
                  <div key={log.id} className="p-1.5 hover:bg-slate-900 rounded flex flex-col md:flex-row md:items-start justify-between gap-1 border-b border-slate-800/30">
                    <div className="space-y-0.5 flex-1">
                      <span className="text-[10px] text-slate-500 mr-2">[{new Date(log.createdAt).toLocaleString("vi-VN")}]</span>
                      <span className="text-sky-400 font-extrabold mr-2">@{log.username}</span>
                      <span className="text-amber-500 font-bold mr-2">&lt;{log.action}&gt;</span>
                      <span className="text-slate-200 pl-1 font-sans">{log.details}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* In-app confirmation dialog */}
      {ConfirmDialog}
    </div>
  );
}
