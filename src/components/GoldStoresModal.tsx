/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import {
  Store,
  X,
  Plus,
  TrendingUp,
  History,
  Pencil,
  Trash2,
  CheckCircle2,
  Sparkles,
  Phone,
  MapPin,
  Save,
  Coins
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FamilyAsset, PrivateGoldStore } from "../types.js";
import { useModalA11y } from "../hooks/useModalA11y.js";
import { useConfirm } from "./ConfirmDialog.js";
import { effectiveGoldWeight, isGoldType } from "../utils/assetValue.js";

interface GoldStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  goldStores: PrivateGoldStore[];
  assets: FamilyAsset[];
  onRefresh: () => Promise<void> | void;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function formatMoneyInput(n: number | undefined) {
  return n && n > 0 ? n.toLocaleString("vi-VN") : "";
}

function parseMoneyInput(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("family_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function GoldStoresModal({
  isOpen,
  onClose,
  goldStores,
  assets,
  onRefresh
}: GoldStoresModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [editingStore, setEditingStore] = useState<PrivateGoldStore | null>(null);
  const [historyStoreId, setHistoryStoreId] = useState<string | null>(null);

  // Quick price update form state for a store
  const [priceUpdateStoreId, setPriceUpdateStoreId] = useState<string | null>(null);
  const [ringBlisterBuyPrice, setRingBlisterBuyPrice] = useState<number>(0);
  const [ringBlisterSellPrice, setRingBlisterSellPrice] = useState<number>(0);
  const [ringPlainBuyPrice, setRingPlainBuyPrice] = useState<number>(0);
  const [ringPlainSellPrice, setRingPlainSellPrice] = useState<number>(0);
  const [priceNote, setPriceNote] = useState<string>("");
  const [autoConvert, setAutoConvert] = useState<boolean>(true);
  const [priceSaving, setPriceSaving] = useState<boolean>(false);

  // Store metadata form (add / edit)
  const [formName, setFormName] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [formAddress, setFormAddress] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formSaving, setFormSaving] = useState<boolean>(false);

  // Feedback notifications
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useModalA11y(isOpen, onClose, modalRef);

  // Find linked assets for each store
  const getLinkedAssets = (store: PrivateGoldStore) => {
    const storeNameLower = store.name.toLowerCase().trim();
    return assets.filter(a => {
      if (!isGoldType(a.type)) return false;
      if (a.goldStoreId === store.id) return true;
      const brandLower = (a.brand || "").toLowerCase();
      const sourceLower = (a.goldSource || "").toLowerCase();
      const nameLower = (a.name || "").toLowerCase();
      return (
        brandLower === storeNameLower ||
        sourceLower === storeNameLower ||
        brandLower.includes(storeNameLower) ||
        storeNameLower.includes(brandLower && brandLower.length >= 3 ? brandLower : "") ||
        nameLower.includes(storeNameLower)
      );
    });
  };

  const openPriceUpdate = (store: PrivateGoldStore) => {
    setPriceUpdateStoreId(store.id);
    setRingBlisterBuyPrice(store.prices?.ringBlisterBuyPrice || 0);
    setRingBlisterSellPrice(store.prices?.ringBlisterSellPrice || 0);
    setRingPlainBuyPrice(store.prices?.ringPlainBuyPrice || 0);
    setRingPlainSellPrice(store.prices?.ringPlainSellPrice || 0);
    setPriceNote("");
    setAutoConvert(true);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleSavePrices = async (storeId: string) => {
    setPriceSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await fetch(`/api/finance/gold-stores/${storeId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          prices: {
            ringBlisterBuyPrice: ringBlisterBuyPrice || undefined,
            ringBlisterSellPrice: ringBlisterSellPrice || undefined,
            ringPlainBuyPrice: ringPlainBuyPrice || undefined,
            ringPlainSellPrice: ringPlainSellPrice || undefined
          },
          note: priceNote.trim() || undefined,
          autoConvertAssets: autoConvert
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể cập nhật bảng giá.");

      const updatedCount = data.updatedAssetsCount || 0;
      const updatedNames = data.updatedAssetNames || [];
      const msg = updatedCount > 0
        ? `Đã cập nhật bảng giá thành công và tự động quy đổi ${updatedCount} tài sản (${updatedNames.join(", ")})!`
        : `Đã cập nhật bảng giá thành công!`;
      setSuccessMessage(msg);
      setPriceUpdateStoreId(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi cập nhật bảng giá.");
    } finally {
      setPriceSaving(false);
    }
  };

  const openCreateStore = () => {
    setEditingStore(null);
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setFormNotes("");
    setRingBlisterBuyPrice(0);
    setRingBlisterSellPrice(0);
    setRingPlainBuyPrice(0);
    setRingPlainSellPrice(0);
    setActiveTab("create");
    setSuccessMessage("");
    setErrorMessage("");
  };

  const openEditStore = (store: PrivateGoldStore) => {
    setEditingStore(store);
    setFormName(store.name);
    setFormPhone(store.phone || "");
    setFormAddress(store.address || "");
    setFormNotes(store.notes || "");
    setActiveTab("create");
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleSaveStore = async () => {
    if (!formName.trim()) {
      setErrorMessage("Vui lòng nhập tên tiệm vàng.");
      return;
    }
    setFormSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload: Partial<PrivateGoldStore> = {
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        notes: formNotes.trim() || undefined
      };
      if (editingStore) {
        payload.id = editingStore.id;
      } else {
        payload.prices = {
          ringBlisterBuyPrice: ringBlisterBuyPrice || undefined,
          ringBlisterSellPrice: ringBlisterSellPrice || undefined,
          ringPlainBuyPrice: ringPlainBuyPrice || undefined,
          ringPlainSellPrice: ringPlainSellPrice || undefined,
          updatedAt: new Date().toISOString()
        };
      }

      const res = await fetch("/api/finance/gold-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu thông tin tiệm vàng.");

      setSuccessMessage(editingStore ? `Đã cập nhật tiệm "${data.store.name}"!` : `Đã thêm tiệm "${data.store.name}" thành công!`);
      setActiveTab("list");
      setEditingStore(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi lưu tiệm vàng.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteStore = async (store: PrivateGoldStore) => {
    const linked = getLinkedAssets(store);
    const ok = await confirm({
      title: `Xóa tiệm "${store.name}"?`,
      message: linked.length > 0
        ? `Tiệm này hiện đang có ${linked.length} tài sản liên kết. Các tài sản sẽ không bị xóa mà chỉ gỡ liên kết khỏi tiệm này. Bạn có chắc chắn muốn xóa?`
        : `Bạn có chắc chắn muốn xóa tiệm vàng "${store.name}" khỏi danh mục?`,
      confirmLabel: "Xóa tiệm vàng",
      cancelLabel: "Hủy",
      tone: "danger"
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/finance/gold-stores/${store.id}`, {
        method: "DELETE",
        headers: authHeader()
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể xóa tiệm vàng.");
      }
      setSuccessMessage(`Đã xóa tiệm "${store.name}".`);
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi xóa tiệm vàng.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4"
      id="gold-stores-modal"
    >
      <motion.div
        ref={modalRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gold-stores-title"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Store className="size-5" />
            </div>
            <div>
              <h2 id="gold-stores-title" className="text-base font-bold text-slate-100 flex items-center gap-2">
                Cửa Hàng Vàng Tư Nhân & Bảng Giá
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-transparent font-semibold">
                  {goldStores.length} tiệm
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Ưu tiên quản lý bảng giá tiệm tư nhân và tự động quy đổi giá trị tài sản vàng tương đương.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/20 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveTab("list"); setEditingStore(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === "list"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Danh sách tiệm ({goldStores.length})
            </button>
            <button
              type="button"
              onClick={openCreateStore}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === "create" && !editingStore
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Plus className="size-3.5" /> Thêm tiệm vàng mới
            </button>
          </div>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="mx-4 mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-4 mt-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <X className="size-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === "create" ? (
            /* ADD / EDIT STORE FORM */
            <div className="max-w-xl mx-auto bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Store className="size-4 text-amber-400" />
                  {editingStore ? `Chỉnh sửa: ${editingStore.name}` : "Thêm tiệm vàng tư nhân mới"}
                </h3>
                <button
                  type="button"
                  onClick={() => { setActiveTab("list"); setEditingStore(null); }}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Quay lại
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tên tiệm vàng <span className="text-rose-400">*</span>
                  </label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Tiệm vàng Gia Bảo, Tiệm vàng Xuân Trường..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại</label>
                    <input
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="0988..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Địa chỉ tiệm</label>
                    <input
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="Số nhà, đường, phố..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ghi chú</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Tiệm ruột, chính sách thu mua, thói quen giao dịch..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>

                {!editingStore && (
                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                      <Coins className="size-3.5 text-amber-700 dark:text-amber-400" /> Bảng giá ban đầu (đ/chỉ)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block mb-1">
                          🏷️ Nhẫn 24K Ép vỉ (Thu mua)
                        </span>
                        <input
                          inputMode="numeric"
                          value={formatMoneyInput(ringBlisterBuyPrice)}
                          onChange={(e) => setRingBlisterBuyPrice(parseMoneyInput(e.target.value))}
                          placeholder="VD: 14.950.000"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-100"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block mb-1">
                          Nhẫn 24K Ép vỉ (Bán ra)
                        </span>
                        <input
                          inputMode="numeric"
                          value={formatMoneyInput(ringBlisterSellPrice)}
                          onChange={(e) => setRingBlisterSellPrice(parseMoneyInput(e.target.value))}
                          placeholder="VD: 15.200.000"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-100"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block mb-1">
                          💍 Nhẫn 24K Loại thường (Thu mua)
                        </span>
                        <input
                          inputMode="numeric"
                          value={formatMoneyInput(ringPlainBuyPrice)}
                          onChange={(e) => setRingPlainBuyPrice(parseMoneyInput(e.target.value))}
                          placeholder="VD: 14.850.000"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-100"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block mb-1">
                          Nhẫn 24K Loại thường (Bán ra)
                        </span>
                        <input
                          inputMode="numeric"
                          value={formatMoneyInput(ringPlainSellPrice)}
                          onChange={(e) => setRingPlainSellPrice(parseMoneyInput(e.target.value))}
                          placeholder="VD: 15.100.000"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setActiveTab("list"); setEditingStore(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStore}
                    disabled={formSaving}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    <Save className="size-3.5" />
                    {formSaving ? "Đang lưu..." : editingStore ? "Cập nhật tiệm" : "Lưu tiệm mới"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STORES LIST VIEW */
            <div className="space-y-4">
              {goldStores.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-950/30 rounded-2xl border border-slate-800">
                  <Store className="size-10 mx-auto mb-2 opacity-40 text-amber-400" />
                  <p className="text-sm font-semibold text-slate-400">Chưa có tiệm vàng tư nhân nào</p>
                  <p className="text-xs text-slate-500 mt-1">Bấm nút "Thêm tiệm vàng mới" để khai báo tiệm vàng bạn hay mua.</p>
                  <button
                    type="button"
                    onClick={openCreateStore}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="size-4" /> Thêm tiệm vàng đầu tiên
                  </button>
                </div>
              ) : (
                goldStores.map((store) => {
                  const linked = getLinkedAssets(store);
                  const totalWeight = linked.reduce((sum, a) => sum + effectiveGoldWeight(a), 0);
                  const isUpdatingPrice = priceUpdateStoreId === store.id;
                  const isShowingHistory = historyStoreId === store.id;

                  return (
                    <div
                      key={store.id}
                      className="bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition-all shadow-sm space-y-4"
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                              <Store className="size-4.5 text-amber-700 dark:text-amber-400" />
                              {store.name}
                            </h3>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                              Đang liên kết: <b className="text-amber-700 dark:text-amber-400">{linked.length} tài sản</b> ({totalWeight} chỉ)
                            </span>
                          </div>
                          {(store.address || store.phone) && (
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                              {store.address && (
                                <span className="flex items-center gap-1">
                                   <MapPin className="size-3 text-slate-500" /> {store.address}
                                </span>
                              )}
                              {store.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="size-3 text-slate-500" /> {store.phone}
                                </span>
                              )}
                            </div>
                          )}
                          {store.notes && (
                            <p className="text-[11px] text-slate-500 italic">"{store.notes}"</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => openPriceUpdate(store)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 hover:bg-amber-200 dark:hover:bg-amber-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Cập nhật bảng giá và tự động đồng bộ tất cả tài sản"
                          >
                            <TrendingUp className="size-3.5 text-amber-700 dark:text-amber-400" />
                            {isUpdatingPrice ? "Đóng bảng giá" : "Cập nhật giá"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryStoreId(isShowingHistory ? null : store.id)}
                            className="size-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                            title="Xem lịch sử thay đổi giá"
                          >
                            <History className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditStore(store)}
                            className="size-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-700 dark:hover:text-amber-400 flex items-center justify-center cursor-pointer transition-colors"
                            title="Sửa thông tin tiệm"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStore(store)}
                            className="size-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                            title="Xóa tiệm"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* CURRENT PRICE CARDS */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Nhẫn 24K Ép Vỉ */}
                        <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-500/30 rounded-xl p-3 space-y-1.5 relative overflow-hidden">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1 text-xs">
                              <Sparkles className="size-3.5 text-amber-700 dark:text-amber-400" />
                              Nhẫn 24K Ép Vỉ
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-transparent">
                              Thanh khoản cao
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Thu mua (thanh khoản)</span>
                              <span className="text-sm font-extrabold text-emerald-400 font-mono">
                                {store.prices?.ringBlisterBuyPrice ? formatMoney(store.prices.ringBlisterBuyPrice) : "—"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">/chỉ</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Bán ra</span>
                              <span className="text-sm font-bold text-slate-300 font-mono">
                                {store.prices?.ringBlisterSellPrice ? formatMoney(store.prices.ringBlisterSellPrice) : "—"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">/chỉ</span>
                            </div>
                          </div>
                        </div>

                        {/* Nhẫn 24K Loại Thường */}
                        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-200 flex items-center gap-1 text-xs">
                              <Coins className="size-3.5 text-slate-400" />
                              Nhẫn 24K Loại Thường (Trơn)
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Nhẫn tròn trơn
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Thu mua (thanh khoản)</span>
                              <span className="text-sm font-extrabold text-emerald-400 font-mono">
                                {store.prices?.ringPlainBuyPrice ? formatMoney(store.prices.ringPlainBuyPrice) : "—"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">/chỉ</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Bán ra</span>
                              <span className="text-sm font-bold text-slate-300 font-mono">
                                {store.prices?.ringPlainSellPrice ? formatMoney(store.prices.ringPlainSellPrice) : "—"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">/chỉ</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Updated time */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>
                          Cập nhật giá gần nhất:{" "}
                          <b className="text-slate-400">
                            {store.prices?.updatedAt
                              ? new Date(store.prices.updatedAt).toLocaleString("vi-VN")
                              : "Chưa ghi nhận"}
                          </b>
                        </span>
                        {linked.length > 0 && (
                          <span className="text-amber-400/90">
                            Có {linked.length} tài sản áp dụng giá tiệm này
                          </span>
                        )}
                      </div>

                      {/* INLINE PRICE UPDATE DRAWER */}
                      <AnimatePresence>
                        {isUpdatingPrice && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 space-y-3 mt-3 overflow-hidden"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                <TrendingUp className="size-4 text-amber-700 dark:text-amber-400" />
                                Điều chỉnh bảng giá mới cho {store.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setPriceUpdateStoreId(null)}
                                className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                              >
                                Đóng
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              {/* Ép vỉ */}
                              <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-amber-500/20">
                                <p className="font-bold text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-1">
                                  🏷️ Nhẫn 24K Ép Vỉ (đ/chỉ)
                                </p>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400 block">Giá thu mua (Thanh khoản)</label>
                                  <input
                                    inputMode="numeric"
                                    value={formatMoneyInput(ringBlisterBuyPrice)}
                                    onChange={(e) => setRingBlisterBuyPrice(parseMoneyInput(e.target.value))}
                                    placeholder="VD: 14.950.000"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-emerald-300 outline-none focus:border-amber-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400 block">Giá bán ra</label>
                                  <input
                                    inputMode="numeric"
                                    value={formatMoneyInput(ringBlisterSellPrice)}
                                    onChange={(e) => setRingBlisterSellPrice(parseMoneyInput(e.target.value))}
                                    placeholder="VD: 15.200.000"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                                  />
                                </div>
                              </div>

                              {/* Loại thường */}
                              <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                                <p className="font-bold text-slate-300 text-[11px] flex items-center gap-1">
                                  💍 Nhẫn 24K Loại Thường (đ/chỉ)
                                </p>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400 block">Giá thu mua (Thanh khoản)</label>
                                  <input
                                    inputMode="numeric"
                                    value={formatMoneyInput(ringPlainBuyPrice)}
                                    onChange={(e) => setRingPlainBuyPrice(parseMoneyInput(e.target.value))}
                                    placeholder="VD: 14.850.000"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-emerald-300 outline-none focus:border-amber-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400 block">Giá bán ra</label>
                                  <input
                                    inputMode="numeric"
                                    value={formatMoneyInput(ringPlainSellPrice)}
                                    onChange={(e) => setRingPlainSellPrice(parseMoneyInput(e.target.value))}
                                    placeholder="VD: 15.100.000"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 block">Ghi chú lần đổi giá này (nếu có)</label>
                              <input
                                value={priceNote}
                                onChange={(e) => setPriceNote(e.target.value)}
                                placeholder="VD: Giá sáng nay tăng 50k, theo tiệm điều chỉnh..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-amber-500"
                              />
                            </div>

                            {/* AUTO CONVERT CHECKBOX */}
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-amber-100/80 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={autoConvert}
                                onChange={(e) => setAutoConvert(e.target.checked)}
                                className="accent-amber-500 size-4 rounded"
                              />
                              <span className="text-xs text-amber-900 dark:text-amber-200 font-semibold">
                                Tự động quy đổi giá trị cho tất cả {linked.length} tài sản vàng tương đương đã mua tại {store.name}
                              </span>
                            </label>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setPriceUpdateStoreId(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSavePrices(store.id)}
                                disabled={priceSaving}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md"
                              >
                                <Save className="size-3.5" />
                                {priceSaving ? "Đang lưu & quy đổi..." : "Lưu giá & Đồng bộ tài sản"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* PRICE HISTORY DRAWER */}
                      <AnimatePresence>
                        {isShowingHistory && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-900/95 border border-slate-800 rounded-xl p-3 space-y-2 mt-2 overflow-hidden"
                          >
                            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                <History className="size-3.5 text-amber-400" />
                                Lịch sử giá tại {store.name} ({store.priceHistory?.length || 0} mốc)
                              </span>
                              <button
                                type="button"
                                onClick={() => setHistoryStoreId(null)}
                                className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                              >
                                Đóng
                              </button>
                            </div>

                            {!store.priceHistory || store.priceHistory.length === 0 ? (
                              <p className="text-xs text-slate-500 py-2 text-center">Chưa có lịch sử biến động giá.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-[11px]">
                                  <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                      <th className="py-1.5 px-2 font-semibold">Thời điểm</th>
                                      <th className="py-1.5 px-2 font-semibold">Ép Vỉ (Mua/Bán)</th>
                                      <th className="py-1.5 px-2 font-semibold">Thường (Mua/Bán)</th>
                                      <th className="py-1.5 px-2 font-semibold">Ghi chú</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/50">
                                    {store.priceHistory.map((h) => (
                                      <tr key={h.id} className="hover:bg-slate-800/30">
                                        <td className="py-1.5 px-2 font-mono text-slate-400 whitespace-nowrap">
                                          {new Date(h.date).toLocaleString("vi-VN")}
                                        </td>
                                        <td className="py-1.5 px-2 font-mono">
                                          <span className="text-emerald-400 font-bold">{h.ringBlisterBuyPrice ? formatMoney(h.ringBlisterBuyPrice) : "—"}</span>
                                          <span className="text-slate-500"> / </span>
                                          <span className="text-slate-400">{h.ringBlisterSellPrice ? formatMoney(h.ringBlisterSellPrice) : "—"}</span>
                                        </td>
                                        <td className="py-1.5 px-2 font-mono">
                                          <span className="text-emerald-400 font-bold">{h.ringPlainBuyPrice ? formatMoney(h.ringPlainBuyPrice) : "—"}</span>
                                          <span className="text-slate-500"> / </span>
                                          <span className="text-slate-400">{h.ringPlainSellPrice ? formatMoney(h.ringPlainSellPrice) : "—"}</span>
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-400">
                                          {h.note || "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>
            💡 Mẹo: Nhẫn 24K ép vỉ có giá thu mua thanh khoản cao hơn loại thường từ 50.000đ - 150.000đ/chỉ.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </motion.div>
      {ConfirmDialog}
    </div>
  );
}
