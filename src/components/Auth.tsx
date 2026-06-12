/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Lock, User as UserIcon, Home, Compass, UserCheck, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface AuthProps {
  onLoginSuccess: (user: any) => void;
}

export function Auth({ onLoginSuccess }: AuthProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [errorStatus, setErrorStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus("");

    if (!username.trim() || !password) {
      setErrorStatus("Vui lòng điền tài khoản và mật khẩu!");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Mật khẩu không chính xác!");
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorStatus(err.message || "Không thể kết nối đến máy chủ");
    } finally {
      setLoading(false);
    }
  };

  // Quick Account Login list for reviewer mapping
  const quickLogins = [
    { name: "Gia Trưởng (Admin)", user: "admin", pass: "admin123", color: "bg-red-500", desc: "Xem hết, tạo tk, backup tệp" },
    { name: "Bố Hùng (Member)", user: "bohung", pass: "bohung123", color: "bg-blue-500", desc: "Xem, viết notes, ghi tài chính" },
    { name: "Mẹ Lan (Member)", user: "melan", pass: "melan123", color: "bg-pink-500", desc: "Xem, ghi việc, ghi thu chi" },
    { name: "Bé Vy (Guest/Kid)", user: "bevy", pass: "bevy123", color: "bg-amber-500", desc: "Chỉ xem lịch, cập nhật task con" }
  ];

  const handleQuickLogin = async (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setErrorStatus("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
      });

      const data = await response.json();
      if (response.ok && data.user) {
        onLoginSuccess(data.user);
      } else {
        setErrorStatus(data.error || "Gặp lỗi đăng nhập nhanh");
      }
    } catch (e) {
      setErrorStatus("Máy chủ gặp sự cố hoặc đang chờ khởi chạy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-sky-200 selection:text-sky-700 font-sans" id="login-container">
      
      {/* Visual background decoration */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-sky-500/10 rounded-full blur-[90px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-6 z-10"
      >
        {/* Upper visual logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-sky-500/10 p-3 rounded-2xl text-sky-400 border border-sky-500/10 mb-1 leading-none shadow-inner shadow-sky-400/5">
            <Home className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">Family Organizer</h2>
          <p className="text-slate-500 text-xs text-balance">Hệ thống cộng tác hằng ngày của gia đình thân thương</p>
        </div>

        {errorStatus && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorStatus}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-400 block font-semibold">Tên tài khoản</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Nhập tên đăng nhập gia đình..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 outline-none transition-all placeholder-slate-650"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-400 block font-semibold">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input 
                type="password" 
                placeholder="Mật khẩu của từng thành viên..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 outline-none transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl cursor-pointer select-none transition-all disabled:opacity-50 text-center text-xs"
          >
            {loading ? "Đang xác thực..." : "Đăng nhập Gia Đình"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center font-mono">
          <div className="absolute w-full h-[1px] bg-slate-800" />
          <span className="bg-slate-900 px-3.5 text-[9px] uppercase tracking-wider text-slate-550 z-10 shrink-0 font-bold">Khám phá nhanh (Demo)</span>
        </div>

        {/* Demo profiles quick clickable list */}
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 text-center">Bấm vào bất cứ thành viên nào để chuyển quyền tương thích lập tức:</p>
          <div className="grid grid-cols-2 gap-2">
            {quickLogins.map(p => (
              <button 
                key={p.user}
                type="button"
                onClick={() => handleQuickLogin(p.user, p.pass)}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800/80 p-2.5 rounded-xl cursor-pointer text-left text-[11px] hover:border-slate-700 transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 pb-1">
                  <span className={`w-3.5 h-3.5 rounded-full ${p.color} shrink-0 group-hover:scale-110 transition-transform`} />
                  <span className="font-bold text-slate-200 truncate">{p.name.split(" ")[0]}</span>
                </div>
                <span className="text-[9px] text-slate-500 leading-none truncate block">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
