/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  Calendar,
  Car,
  Clock,
  Coins,
  FileText,
  Gem,
  HandCoins,
  Image as ImageIcon,
  Info,
  Landmark,
  LineChart,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User as UserIcon,
  Wallet,
  X
} from "lucide-react";
import { motion } from "motion/react";
import {
  AccountType,
  AssetPhoto,
  AssetPriceLog,
  GoldPriceImportRow,
  AssetType,
  FamilyAsset,
  FinancialTransaction,
  GoldPackaging,
  PrivateGoldStore,
  TransactionType,
  User,
  UserRole
} from "../types.js";
import { useConfirm } from "./ConfirmDialog.js";
import { optimizeImageFile } from "../utils/image.js";
import { uploadDataUrl } from "../utils/uploadImage.js";
import { useModalA11y } from "../hooks/useModalA11y.js";
import { useTabFab } from "./FabHost.js";
import { ShimmerLine, Reveal, staggerDelay } from "./Lively.js";
import { FancySelect } from "./FancySelect.js";
import { DateInputDMY, formatDateVN } from "./DateTimePicker24.js";
import { GoldStoresModal } from "./GoldStoresModal.js";
import { MoneyInput } from "./MoneyInput.js";
import {
  GOLD_PURITY_OPTIONS,
  MarketPrices,
  effectiveGoldWeight,
  getEffectiveValue,
  getHoldingDuration,
  getMarketUnitPrice,
  goldPurityFactor,
  goldPurityLabel,
  isGoldType,
  normalizeGoldPurity,
  calculateProfitLoss
} from "../utils/assetValue.js";

interface AssetsProps {
  currentUser: User;
  users: User[];
  assets: FamilyAsset[];
  widgets?: any;
  onSaveAsset: (asset: Partial<FamilyAsset>) => Promise<any>;
  onDeleteAsset: (id: string) => Promise<any>;
  onSaveAssetPriceLog?: (assetId: string, log: Partial<AssetPriceLog>) => Promise<any>;
  onGetAssetPriceLogs?: (assetId: string) => Promise<AssetPriceLog[]>;
  onRefreshData?: () => void | Promise<void>;
  onSaveTransaction?: (tx: Partial<FinancialTransaction>) => Promise<any>;
}

// Hạng mục thu nhập dùng khi ghi nhận tiền bán tài sản vào sổ thu chi.
const ASSET_SALE_CATEGORY = "Bán tài sản";

const SELL_ACCOUNTS: { value: AccountType; label: string }[] = [
  { value: AccountType.BANK, label: "Ngân hàng 💳" },
  { value: AccountType.CASH, label: "Tiền mặt 💵" },
  { value: AccountType.E_WALLET, label: "Ví điện tử 📱" }
];

const ASSET_TYPES: { value: AssetType; label: string; short: string }[] = [
  { value: "crypto", label: "Tài sản mã hóa / crypto", short: "Crypto" },
  { value: "land", label: "Sổ đất / bất động sản", short: "Sổ đất" },
  { value: "gold_bar", label: "Vàng miếng", short: "Vàng miếng" },
  { value: "gold_ring", label: "Vàng nhẫn", short: "Vàng nhẫn" },
  { value: "gold_jewelry", label: "Vàng trang sức", short: "Trang sức" },
  { value: "gold_other", label: "Vàng loại khác", short: "Vàng khác" },
  { value: "vehicle", label: "Xe cộ", short: "Xe" },
  { value: "stock", label: "Cổ phần / cổ phiếu", short: "Cổ phiếu" },
  { value: "other", label: "Tài sản khác", short: "Khác" }
];

const MAX_ASSET_PHOTOS = 8;
const GOLD_SOURCE_OPTIONS = [
  { value: "SJC", label: "Hãng SJC" },
  { value: "DOJI", label: "Hãng DOJI" },
  { value: "PNJ", label: "Hãng PNJ" },
  { value: "BTMC", label: "Bảo Tín Minh Châu" },
  { value: "Vàng tư nhân", label: "Vàng tư nhân / tiệm riêng" },
  { value: "Khác", label: "Hãng khác" }
];

function supportsManualPrice(_asset: FamilyAsset) {
  return true;
}

function isUnitPricedAsset(asset: FamilyAsset) {
  return isGoldType(asset.type) || asset.type === "crypto" || asset.type === "stock";
}

function assetPriceQuantity(asset: FamilyAsset) {
  if (isGoldType(asset.type)) return effectiveGoldWeight(asset);
  return Number(asset.quantity || 0);
}

function assetPriceUnit(asset: FamilyAsset) {
  return isGoldType(asset.type) ? (asset.weightUnit || asset.unit || "chỉ") : (asset.unit || "món");
}

function assetTypeLabel(type: AssetType) {
  return ASSET_TYPES.find(t => t.value === type)?.short || "Khác";
}

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("family_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function defaultUnitForType(type: AssetType) {
  if (type === "crypto") return "coin";
  if (type === "land") return "m2";
  if (isGoldType(type)) return "chỉ";
  if (type === "vehicle") return "chiếc";
  if (type === "stock") return "cổ phiếu";
  return "món";
}

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Mới cập nhật" },
  { value: "purchase_desc", label: "📅 Ngày mua: Mới nhất" },
  { value: "purchase_asc", label: "📅 Ngày mua: Cũ nhất" },
  { value: "value_desc", label: "💰 Giá trị cao nhất" },
  { value: "profit_desc", label: "📈 Tỷ lệ lời cao nhất" }
] as const;

function typeClass(type: AssetType) {
  if (type === "crypto") return "text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/20";
  if (type === "land") return "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/20";
  if (isGoldType(type)) return "text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/20 font-semibold";
  if (type === "vehicle") return "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/20";
  if (type === "stock") return "text-violet-700 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/10 border-violet-300 dark:border-violet-500/20";
  return "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700";
}

function formatMoney(value: number, currency: "VND" | "USD" = "VND") {
  if (currency === "USD") return `${value.toLocaleString("en-US")} USD`;
  return `${value.toLocaleString("vi-VN")} VNĐ`;
}

function formatMoneyInput(n: number) {
  return n > 0 ? n.toLocaleString("vi-VN") : "";
}

function parseMoneyInput(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}


export function Assets({
  currentUser,
  users,
  assets,
  widgets,
  onSaveAsset,
  onDeleteAsset,
  onSaveAssetPriceLog,
  onGetAssetPriceLogs,
  onRefreshData,
  onSaveTransaction
}: AssetsProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"updated_desc" | "purchase_desc" | "purchase_asc" | "value_desc" | "profit_desc">("updated_desc");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FamilyAsset | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ asset: FamilyAsset; photo: AssetPhoto } | null>(null);
  const [formError, setFormError] = useState("");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [showGoldPurityInfo, setShowGoldPurityInfo] = useState(false);

  // Cập nhật giá thủ công và xem lịch sử lời/lỗ.
  const [priceLogAsset, setPriceLogAsset] = useState<FamilyAsset | null>(null);
  const [priceLogs, setPriceLogs] = useState<AssetPriceLog[]>([]);
  const [priceInput, setPriceInput] = useState<number>(0);
  const [priceInputMode, setPriceInputMode] = useState<"unit" | "total">("total");
  const [priceNote, setPriceNote] = useState("");
  const [priceLogError, setPriceLogError] = useState("");
  const [priceLogLoading, setPriceLogLoading] = useState(false);
  const [priceLogSaving, setPriceLogSaving] = useState(false);

  const [goldImportOpen, setGoldImportOpen] = useState(false);
  const [goldImportFile, setGoldImportFile] = useState<File | null>(null);
  const [goldImportStore, setGoldImportStore] = useState("");
  const [goldImportCapturedAt, setGoldImportCapturedAt] = useState(new Date().toISOString().slice(0, 16));
  const [goldImportPreview, setGoldImportPreview] = useState<{ imageUrl: string; ocrText: string; rows: GoldPriceImportRow[] } | null>(null);
  const [goldImportLoading, setGoldImportLoading] = useState(false);
  const [goldImportSaving, setGoldImportSaving] = useState(false);
  const [goldImportError, setGoldImportError] = useState("");

  // Bán tài sản — popup ghi nhận tiền bán vào sổ thu chi rồi xóa tài sản.
  const [sellingAsset, setSellingAsset] = useState<FamilyAsset | null>(null);
  const [sellMode, setSellMode] = useState<"estimate" | "custom">("estimate");
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [sellEstimate, setSellEstimate] = useState<number>(0);
  const [sellAccount, setSellAccount] = useState<AccountType>(AccountType.BANK);
  const [sellDate, setSellDate] = useState(new Date().toISOString().slice(0, 10));
  const [sellNote, setSellNote] = useState("");
  const [sellError, setSellError] = useState("");
  const [selling, setSelling] = useState(false);

  const [formType, setFormType] = useState<AssetType>("gold_bar");
  const [formName, setFormName] = useState("");
  const [formOwnerId, setFormOwnerId] = useState("");
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnit, setFormUnit] = useState(defaultUnitForType("gold_bar"));
  const [formPurchaseUnitPrice, setFormPurchaseUnitPrice] = useState<number>(0);
  const [formPurchaseValue, setFormPurchaseValue] = useState<number>(0);
  const [formEstimatedUnitPrice, setFormEstimatedUnitPrice] = useState<number>(0);
  const [formEstimatedValue, setFormEstimatedValue] = useState<number>(0);
  const [formCurrency, setFormCurrency] = useState<"VND" | "USD">("VND");
  const [formPurchaseDate, setFormPurchaseDate] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formPhotos, setFormPhotos] = useState<AssetPhoto[]>([]);
  const [formSymbol, setFormSymbol] = useState("");
  const [formNetwork, setFormNetwork] = useState("");
  const [formWalletLabel, setFormWalletLabel] = useState("");
  const [formWalletAddressMasked, setFormWalletAddressMasked] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formAreaM2, setFormAreaM2] = useState<number>(0);
  const [formCertificateNo, setFormCertificateNo] = useState("");
  const [formParcelNo, setFormParcelNo] = useState("");
  const [formGoldPurity, setFormGoldPurity] = useState("");
  const [formGoldSource, setFormGoldSource] = useState("");
  const [formGoldPackaging, setFormGoldPackaging] = useState<GoldPackaging>("blister");
  const [formGoldStoreId, setFormGoldStoreId] = useState<string>("");
  const [formBrand, setFormBrand] = useState("");
  const [formSerialNo, setFormSerialNo] = useState("");

  const [goldStores, setGoldStores] = useState<PrivateGoldStore[]>([]);
  const [goldStoresModalOpen, setGoldStoresModalOpen] = useState(false);

  const fetchGoldStores = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/gold-stores", {
        headers: authHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setGoldStores(data.goldStores || []);
      }
    } catch (err) {
      console.error("Lỗi tải danh mục tiệm vàng:", err);
    }
  }, []);

  useEffect(() => {
    fetchGoldStores();
  }, [fetchGoldStores]);

  const widgetsOverview = widgets ?? null;

  const marketPrices = useMemo<MarketPrices | null>(() => {
    const ov = widgetsOverview;
    if (!ov) return null;
    const usdVndRate: number = ov?.fx?.usdVnd ?? 25000;
    let gold: MarketPrices["gold"] = null;
    const g = ov?.gold;
    if (g) {
      const pricePerLuongVnd: number | null =
        g.sell ?? g.vndPerTael ??
        (g.usdPerOz ? Math.round((g.usdPerOz / 31.1035) * 37.5 * usdVndRate) : null);
      if (pricePerLuongVnd && pricePerLuongVnd > 0) {
        const pgVnd = pricePerLuongVnd / 37.5;
        const pgUsd = pgVnd / usdVndRate;
        gold = {
          pricePerGramVnd: pgVnd, pricePerGramUsd: pgUsd,
          pricePerChiVnd: pgVnd * 3.75, pricePerChiUsd: pgUsd * 3.75,
          pricePerLuongVnd, pricePerLuongUsd: pgUsd * 37.5,
          source: g.source ?? "vang.today"
        };
      }
    }
    const crypto: MarketPrices["crypto"] = {};
    const c = ov?.crypto;
    if (c?.bitcoin) crypto["BTC"] = { usd: c.bitcoin.usd ?? 0, vnd: c.bitcoin.vnd ?? (c.bitcoin.usd ?? 0) * usdVndRate };
    if (c?.ethereum) crypto["ETH"] = { usd: c.ethereum.usd ?? 0, vnd: c.ethereum.vnd ?? (c.ethereum.usd ?? 0) * usdVndRate };
    return { gold, crypto, usdVndRate, lastUpdated: new Date().toISOString() };
  }, [widgetsOverview]);

  const marketPricesStatus: "loading" | "ok" = widgetsOverview ? "ok" : "loading";

  // Đơn vị giá thị trường theo 1 đơn vị tài sản hiện tại
  const marketUnitPrice = useMemo(() => {
    return getMarketUnitPrice(
      {
        type: formType,
        unit: formUnit,
        weightUnit: formUnit,
        goldPurity: formGoldPurity,
        symbol: formSymbol,
        currency: formCurrency
      },
      marketPrices
    );
  }, [marketPrices, formType, formUnit, formGoldPurity, formSymbol, formCurrency]);

  // Live auto-value preview inside the form (recalculates as user types weight/quantity/symbol)
  const formAutoValue = useMemo(() => {
    if (marketUnitPrice <= 0 || formQuantity <= 0) return null;
    const v = Math.round(formQuantity * marketUnitPrice);
    if (isGoldType(formType)) {
      const factor = goldPurityFactor(formGoldPurity);
      const purityNote = factor < 1 ? ` × ${Math.round(factor * 100)}% tuổi vàng` : "";
      return { value: v, unitPrice: marketUnitPrice, label: `${formQuantity} ${formUnit} × giá 9999${purityNote}` };
    }
    if (formType === "crypto" && formSymbol) {
      return { value: v, unitPrice: marketUnitPrice, label: `${formQuantity} ${formSymbol} × ${formatMoney(marketUnitPrice, formCurrency)}` };
    }
    return { value: v, unitPrice: marketUnitPrice, label: `${formQuantity} ${formUnit} × ${formatMoney(marketUnitPrice, formCurrency)}` };
  }, [marketUnitPrice, formQuantity, formType, formGoldPurity, formUnit, formSymbol, formCurrency]);

  const handleQuantityChange = (newQty: number) => {
    const q = Math.max(0, newQty);
    setFormQuantity(q);
    if (formType === "land") setFormAreaM2(q);
    if (formPurchaseUnitPrice > 0) {
      setFormPurchaseValue(Math.round(q * formPurchaseUnitPrice));
    }
    if (formEstimatedUnitPrice > 0) {
      setFormEstimatedValue(Math.round(q * formEstimatedUnitPrice));
    }
  };

  const handlePurchaseUnitPriceChange = (unitPrice: number) => {
    setFormPurchaseUnitPrice(unitPrice);
    const q = Number(formQuantity) || 0;
    if (q > 0) {
      setFormPurchaseValue(Math.round(q * unitPrice));
    }
  };

  const handlePurchaseValueChange = (total: number) => {
    setFormPurchaseValue(total);
    const q = Number(formQuantity) || 0;
    if (q > 0) {
      setFormPurchaseUnitPrice(Math.round(total / q));
    }
  };

  const handleEstimatedUnitPriceChange = (unitPrice: number) => {
    setFormEstimatedUnitPrice(unitPrice);
    const q = Number(formQuantity) || 0;
    if (q > 0) {
      setFormEstimatedValue(Math.round(q * unitPrice));
    }
  };

  const handleEstimatedValueChange = (total: number) => {
    setFormEstimatedValue(total);
    const q = Number(formQuantity) || 0;
    if (q > 0) {
      setFormEstimatedUnitPrice(Math.round(total / q));
    }
  };

  const handleGoldPackagingChange = (pkg: GoldPackaging) => {
    setFormGoldPackaging(pkg);
    if (formGoldStoreId) {
      const store = goldStores.find(s => s.id === formGoldStoreId);
      if (store) {
        const unitPrice = pkg === "blister"
          ? (store.prices?.ringBlisterBuyPrice || store.prices?.ringBlisterSellPrice || 0)
          : (store.prices?.ringPlainBuyPrice || store.prices?.ringPlainSellPrice || 0);
        if (unitPrice > 0) {
          handleEstimatedUnitPriceChange(unitPrice);
        }
      }
    }
  };

  const handleGoldSourceChange = (val: string) => {
    setFormGoldSource(val);
    const valLower = val.toLowerCase().trim();
    const matchingStore = goldStores.find(
      s => s.name.toLowerCase().trim() === valLower || s.id === val || (valLower.length >= 3 && valLower.includes(s.name.toLowerCase().trim()))
    );
    if (matchingStore) {
      setFormGoldStoreId(matchingStore.id);
      if (!formBrand) setFormBrand(matchingStore.name);
      const unitPrice = formGoldPackaging === "blister"
        ? (matchingStore.prices?.ringBlisterBuyPrice || matchingStore.prices?.ringBlisterSellPrice || 0)
        : (matchingStore.prices?.ringPlainBuyPrice || matchingStore.prices?.ringPlainSellPrice || 0);
      if (unitPrice > 0) {
        handleEstimatedUnitPriceChange(unitPrice);
      }
    } else {
      const curStore = goldStores.find(s => s.id === formGoldStoreId);
      if (curStore && curStore.name !== val) {
        setFormGoldStoreId("");
      }
    }
  };

  const goldSourceOptions = useMemo(() => {
    const storeOptions = goldStores.map(s => ({
      value: s.name,
      label: `🏪 ${s.name} ${s.prices?.ringBlisterBuyPrice ? `(Vỉ: ${formatMoney(s.prices.ringBlisterBuyPrice)} · Thường: ${formatMoney(s.prices.ringPlainBuyPrice || 0)})` : ""}`
    }));

    const brandOptions = [
      { value: "SJC", label: "🏢 Hãng SJC" },
      { value: "DOJI", label: "🏢 Hãng DOJI" },
      { value: "PNJ", label: "🏢 Hãng PNJ" },
      { value: "BTMC", label: "🏢 Bảo Tín Minh Châu" },
      { value: "Vàng tư nhân khác", label: "🏪 Vàng tư nhân khác" },
      { value: "Khác", label: "🏢 Hãng khác" }
    ];

    return [
      { value: "", label: "— Chọn nguồn / tiệm mua vàng —" },
      ...storeOptions,
      ...brandOptions,
      ...(formGoldSource && !storeOptions.some(o => o.value === formGoldSource) && !brandOptions.some(o => o.value === formGoldSource)
        ? [{ value: formGoldSource, label: `🏪 ${formGoldSource}` }]
        : [])
    ];
  }, [goldStores, formGoldSource]);

  const filteredAssets = useMemo(() => {
    const text = searchTerm.trim().toLowerCase();
    return assets.filter(asset => {
      if (typeFilter !== "all" && asset.type !== typeFilter) return false;
      if (ownerFilter !== "all" && (asset.ownerId || "") !== ownerFilter) return false;
      if (!text) return true;
      return [
        asset.name,
        asset.notes,
        asset.location,
        asset.symbol,
        asset.network,
        asset.address,
        asset.certificateNo,
        asset.brand,
        asset.serialNo,
        asset.goldSource,
        asset.purchaseDate
      ].some(value => String(value || "").toLowerCase().includes(text));
    }).sort((a, b) => {
      if (sortBy === "purchase_desc") {
        const da = a.purchaseDate || a.createdAt || "";
        const db = b.purchaseDate || b.createdAt || "";
        return db.localeCompare(da);
      }
      if (sortBy === "purchase_asc") {
        const da = a.purchaseDate || a.createdAt || "";
        const db = b.purchaseDate || b.createdAt || "";
        return da.localeCompare(db);
      }
      if (sortBy === "value_desc") {
        const va = getEffectiveValue(a, marketPrices).value;
        const vb = getEffectiveValue(b, marketPrices).value;
        return vb - va;
      }
      if (sortBy === "profit_desc") {
        const eva = getEffectiveValue(a, marketPrices).value;
        const evb = getEffectiveValue(b, marketPrices).value;
        const pa = Number(a.purchaseValue || 0);
        const pb = Number(b.purchaseValue || 0);
        const pcta = pa > 0 ? (eva - pa) / pa : -9999;
        const pctb = pb > 0 ? (evb - pb) / pb : -9999;
        return pctb - pcta;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [assets, searchTerm, typeFilter, ownerFilter, sortBy, marketPrices]);

  // Totals are kept per-currency — VND and USD must never be summed together.
  // Uses effective values: live market price → manual estimatedValue → purchaseValue fallback.
  const stats = useMemo(() => {
    const acc = {
      totalVnd: 0, totalUsd: 0,
      goldVnd: 0, goldUsd: 0,
      cryptoVnd: 0, cryptoUsd: 0,
      landVnd: 0, landUsd: 0
    };
    assets.forEach(asset => {
      const { value } = getEffectiveValue(asset, marketPrices);
      const usd = asset.currency === "USD";
      acc[usd ? "totalUsd" : "totalVnd"] += value;
      if (isGoldType(asset.type)) acc[usd ? "goldUsd" : "goldVnd"] += value;
      else if (asset.type === "crypto") acc[usd ? "cryptoUsd" : "cryptoVnd"] += value;
      else if (asset.type === "land") acc[usd ? "landUsd" : "landVnd"] += value;
    });
    return acc;
  }, [assets, marketPrices]);

  const resetForm = () => {
    setFormType("gold_bar");
    setFormName("");
    setFormOwnerId("");
    setFormQuantity(1);
    setFormUnit(defaultUnitForType("gold_bar"));
    setFormPurchaseUnitPrice(0);
    setFormPurchaseValue(0);
    setFormEstimatedUnitPrice(0);
    setFormEstimatedValue(0);
    setFormCurrency("VND");
    setFormPurchaseDate("");
    setFormLocation("");
    setFormNotes("");
    setFormPhotos([]);
    setFormSymbol("");
    setFormNetwork("");
    setFormWalletLabel("");
    setFormWalletAddressMasked("");
    setFormAddress("");
    setFormAreaM2(0);
    setFormCertificateNo("");
    setFormParcelNo("");
    setFormGoldPurity("");
    setFormGoldSource("");
    setFormGoldPackaging("blister");
    setFormGoldStoreId("");
    setFormBrand("");
    setFormSerialNo("");
  };

  const openCreateForm = () => {
    resetForm();
    setEditingAsset(null);
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (asset: FamilyAsset) => {
    setEditingAsset(asset);
    setFormType(asset.type);
    setFormName(asset.name);
    setFormOwnerId(asset.ownerId || "");

    // Số lượng & đơn vị
    const q = isGoldType(asset.type)
      ? Number(asset.weight || asset.quantity || 1)
      : asset.type === "land"
      ? Number(asset.areaM2 || asset.quantity || 1)
      : Number(asset.quantity || 1);
    const u = isGoldType(asset.type)
      ? (asset.weightUnit || asset.unit || "chỉ")
      : asset.type === "land"
      ? "m2"
      : (asset.unit || defaultUnitForType(asset.type));

    setFormQuantity(q);
    setFormUnit(u);

    // Tính toán đơn giá mua và tổng giá mua ban đầu
    let initialPurchaseUnitPrice = Number(asset.purchaseUnitPrice || 0);
    let initialPurchaseValue = Number(asset.purchaseValue || 0);
    if (!initialPurchaseUnitPrice && initialPurchaseValue > 0) {
      if (q > 1 && (isGoldType(asset.type) || asset.type === "crypto" || asset.type === "land") && initialPurchaseValue > 1_000_000 && initialPurchaseValue < 100_000_000) {
        // Dữ liệu cũ người dùng nhập đơn giá 1 đơn vị vào ô tổng (ví dụ 10.950.000 cho 11 chỉ)
        initialPurchaseUnitPrice = initialPurchaseValue;
        initialPurchaseValue = Math.round(q * initialPurchaseUnitPrice);
      } else {
        initialPurchaseUnitPrice = Math.round(initialPurchaseValue / q);
      }
    }

    // Tính toán đơn giá ước tính và tổng giá trị ước tính
    let initialEstimatedUnitPrice = Number(asset.estimatedUnitPrice || 0);
    let initialEstimatedValue = Number(asset.estimatedValue || 0);
    if (!initialEstimatedUnitPrice && initialEstimatedValue > 0) {
      if (q > 1 && (isGoldType(asset.type) || asset.type === "crypto" || asset.type === "land") && initialEstimatedValue > 1_000_000 && initialEstimatedValue < 100_000_000) {
        // Dữ liệu cũ người dùng nhập đơn giá 1 đơn vị vào ô tổng (ví dụ 13.000.000 cho 11 chỉ)
        initialEstimatedUnitPrice = initialEstimatedValue;
        initialEstimatedValue = Math.round(q * initialEstimatedUnitPrice);
      } else if (q > 0) {
        initialEstimatedUnitPrice = Math.round(initialEstimatedValue / q);
      }
    }

    setFormPurchaseUnitPrice(initialPurchaseUnitPrice);
    setFormPurchaseValue(initialPurchaseValue);
    setFormEstimatedUnitPrice(initialEstimatedUnitPrice);
    setFormEstimatedValue(initialEstimatedValue);

    setFormCurrency(asset.currency || "VND");
    setFormPurchaseDate(asset.purchaseDate || "");
    setFormLocation(asset.location || "");
    setFormNotes(asset.notes || "");
    setFormPhotos(asset.photos || []);
    setFormSymbol(asset.symbol || "");
    setFormNetwork(asset.network || "");
    setFormWalletLabel(asset.walletLabel || "");
    setFormWalletAddressMasked(asset.walletAddressMasked || "");
    setFormAddress(asset.address || "");
    setFormAreaM2(Number(asset.areaM2 || (asset.type === "land" ? q : 0)));
    setFormCertificateNo(asset.certificateNo || "");
    setFormParcelNo(asset.parcelNo || "");
    setFormGoldPurity(asset.goldPurity || "");
    setFormGoldSource(asset.goldSource || "");
    setFormGoldPackaging(asset.goldPackaging || (/ép vỉ|vỉ/i.test(asset.name) ? "blister" : "plain"));
    setFormGoldStoreId(asset.goldStoreId || "");
    setFormBrand(asset.brand || "");
    setFormSerialNo(asset.serialNo || "");
    setFormError("");
    setIsFormOpen(true);
  };

  const closeForm = useCallback(() => {
    if (imageProcessing) return;
    setIsFormOpen(false);
    setEditingAsset(null);
    setFormError("");
  }, [imageProcessing]);

  // Escape-to-close + scroll lock + focus trap for the form, photo viewer & gold-purity info
  const formRef = useRef<HTMLDivElement | null>(null);
  const photoRef = useRef<HTMLDivElement | null>(null);
  const goldInfoRef = useRef<HTMLDivElement | null>(null);
  const sellRef = useRef<HTMLDivElement | null>(null);
  const priceLogRef = useRef<HTMLDivElement | null>(null);
  const goldImportRef = useRef<HTMLDivElement | null>(null);
  const closePhoto = useCallback(() => setSelectedPhoto(null), []);
  const closeGoldInfo = useCallback(() => setShowGoldPurityInfo(false), []);
  const closePriceLog = useCallback(() => {
    if (priceLogSaving) return;
    setPriceLogAsset(null);
    setPriceLogs([]);
    setPriceLogError("");
  }, [priceLogSaving]);
  const closeSell = useCallback(() => {
    if (selling) return;
    setSellingAsset(null);
    setSellError("");
  }, [selling]);
  const closeGoldImport = useCallback(() => {
    if (!goldImportLoading && !goldImportSaving) {
      setGoldImportOpen(false);
    }
  }, [goldImportLoading, goldImportSaving]);
  const closeGoldStoresModal = useCallback(() => {
    setGoldStoresModalOpen(false);
  }, []);
  useModalA11y(isFormOpen, closeForm, formRef);
  useModalA11y(!!selectedPhoto, closePhoto, photoRef);
  useModalA11y(showGoldPurityInfo, closeGoldInfo, goldInfoRef);
  useModalA11y(!!priceLogAsset, closePriceLog, priceLogRef);
  useModalA11y(goldImportOpen, closeGoldImport, goldImportRef);
  useModalA11y(!!sellingAsset, closeSell, sellRef);

  // Nút nổi thêm tài sản — icon trùng tab con "Tài sản gia đình", ẩn khi đang mở modal
  useTabFab(
    !isFormOpen && !selectedPhoto && !showGoldPurityInfo && !priceLogAsset && !goldImportOpen && !sellingAsset
      ? { id: "assets", color: "emerald", title: "Thêm tài sản gia đình", icon: FileText, onClick: openCreateForm }
      : null
  );

  const canManageAsset = (asset: FamilyAsset) => {
    return currentUser.role === UserRole.ADMIN || asset.createdById === currentUser.id;
  };

  const openPriceLogForm = async (asset: FamilyAsset) => {
    const quantity = assetPriceQuantity(asset);
    const effective = getEffectiveValue(asset, marketPrices).value;
    const unitMode = isUnitPricedAsset(asset) && quantity > 0;
    setPriceLogAsset(asset);
    setPriceInputMode(unitMode ? "unit" : "total");
    setPriceInput(unitMode ? Math.round(effective / quantity) : effective);
    setPriceNote("");
    setPriceLogError("");
    setPriceLogs([]);
    if (!onGetAssetPriceLogs) return;
    setPriceLogLoading(true);
    try {
      setPriceLogs(await onGetAssetPriceLogs(asset.id));
    } catch (err: any) {
      setPriceLogError(err.message || "Không tải được lịch sử giá.");
    } finally {
      setPriceLogLoading(false);
    }
  };

  const priceLogTotal = useMemo(() => {
    if (!priceLogAsset) return 0;
    const quantity = assetPriceQuantity(priceLogAsset);
    return priceInputMode === "unit" && quantity > 0
      ? Math.round(priceInput * quantity)
      : Math.round(priceInput);
  }, [priceLogAsset, priceInput, priceInputMode]);

  const pricePreview = useMemo(() => {
    if (!priceLogAsset) return { profitLoss: null, profitLossPct: null };
    return calculateProfitLoss(priceLogTotal, Number(priceLogAsset.purchaseValue || 0));
  }, [priceLogAsset, priceLogTotal]);

  const handleSavePriceLog = async () => {
    if (!priceLogAsset || !onSaveAssetPriceLog) return;
    if (priceLogTotal <= 0) {
      setPriceLogError("Vui lòng nhập giá hiện tại lớn hơn 0.");
      return;
    }
    setPriceLogError("");
    setPriceLogSaving(true);
    try {
      const quantity = assetPriceQuantity(priceLogAsset);
      const result = await onSaveAssetPriceLog(priceLogAsset.id, {
        price: priceLogTotal,
        currency: priceLogAsset.currency,
        unitPrice: priceInputMode === "unit" ? Math.round(priceInput) : undefined,
        quantity: quantity > 0 ? quantity : undefined,
        unit: assetPriceUnit(priceLogAsset),
        note: priceNote.trim() || undefined
      });
      const savedLog = result?.log as AssetPriceLog | undefined;
      if (savedLog) setPriceLogs(prev => [savedLog, ...prev.filter(log => log.id !== savedLog.id)]);
      if (result?.asset) setPriceLogAsset(result.asset as FamilyAsset);
      await onRefreshData?.();
      setPriceNote("");
    } catch (err: any) {
      setPriceLogError(err.message || "Không lưu được giá thủ công.");
    } finally {
      setPriceLogSaving(false);
    }
  };

  const openGoldImport = () => {
    setGoldImportFile(null);
    setGoldImportStore("");
    setGoldImportCapturedAt(new Date().toISOString().slice(0, 16));
    setGoldImportPreview(null);
    setGoldImportError("");
    setGoldImportOpen(true);
  };

  const handleGoldImportPreview = async () => {
    if (!goldImportFile) {
      setGoldImportError("Vui lòng chọn ảnh bảng giá.");
      return;
    }
    setGoldImportError("");
    setGoldImportLoading(true);
    try {
      const optimized = await optimizeImageFile(goldImportFile, { targetBytes: 1_200_000, maxSizes: [1800, 1400, 1024] });
      const response = await fetch("/api/finance/gold-price-imports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        credentials: "include",
        body: JSON.stringify({ dataUrl: optimized.dataUrl, fileName: goldImportFile.name })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không đọc được bảng giá.");
      setGoldImportPreview(payload);
    } catch (err: any) {
      setGoldImportError(err.message || "Không đọc được ảnh bảng giá.");
    } finally {
      setGoldImportLoading(false);
    }
  };

  const updateGoldImportRow = (rowId: string, patch: Partial<GoldPriceImportRow>) => {
    setGoldImportPreview(prev => prev ? { ...prev, rows: prev.rows.map(row => row.id === rowId ? { ...row, ...patch } : row) } : prev);
  };

  const handleGoldImportSave = async () => {
    if (!goldImportPreview || !goldImportStore.trim()) {
      setGoldImportError("Vui lòng nhập tên cửa hàng trước khi lưu.");
      return;
    }
    setGoldImportError("");
    setGoldImportSaving(true);
    try {
      const response = await fetch("/api/finance/gold-price-imports", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        credentials: "include",
        body: JSON.stringify({
          storeName: goldImportStore.trim(),
          capturedAt: new Date(goldImportCapturedAt).toISOString(),
          imageUrl: goldImportPreview.imageUrl,
          ocrText: goldImportPreview.ocrText,
          rows: goldImportPreview.rows
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được bảng giá.");
      setGoldImportOpen(false);
      await onRefreshData?.();
    } catch (err: any) {
      setGoldImportError(err.message || "Không lưu được bảng giá.");
    } finally {
      setGoldImportSaving(false);
    }
  };

  const handleTypeChange = (type: AssetType) => {
    setFormType(type);
    setFormUnit(defaultUnitForType(type));
  };

  const addPhotoFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (formPhotos.length + files.length > MAX_ASSET_PHOTOS) {
      setFormError(`Mỗi tài sản chỉ lưu được tối đa ${MAX_ASSET_PHOTOS} ảnh.`);
      return;
    }

    setFormError("");
    setImageProcessing(true);
    try {
      const optimizedPhotos: AssetPhoto[] = [];
      for (const file of files) {
        const full = await optimizeImageFile(file, {
          maxSourceBytes: 25 * 1024 * 1024,
          targetBytes: 900 * 1024,
          maxSizes: [1280, 1024, 768, 512],
          qualities: [0.86, 0.76, 0.66, 0.56],
          backgroundColor: "#ffffff"
        });
        const thumb = await optimizeImageFile(file, {
          maxSourceBytes: 25 * 1024 * 1024,
          targetBytes: 120 * 1024,
          maxSizes: [320, 240],
          qualities: [0.82, 0.7, 0.6],
          backgroundColor: "#ffffff"
        });
        // Persist as files on disk (organized under uploads/assets/<type>) and keep only the URLs.
        const [fullUrl, thumbUrl] = await Promise.all([
          uploadDataUrl(full.dataUrl, "assets", formType),
          uploadDataUrl(thumb.dataUrl, "assets", formType)
        ]);
        optimizedPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          thumbnailDataUrl: thumbUrl,
          fullDataUrl: fullUrl,
          width: full.width,
          height: full.height,
          sizeKb: full.sizeKb,
          createdAt: new Date().toISOString()
        });
      }
      setFormPhotos(prev => [...prev, ...optimizedPhotos]);
    } catch (err: any) {
      setFormError(err.message || "Không xử lý được ảnh tài sản.");
    } finally {
      setImageProcessing(false);
    }
  };

  const handlePhotoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = [];
    const fileList = e.currentTarget.files;
    if (fileList) {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList.item(i);
        if (file) files.push(file);
      }
    }
    e.currentTarget.value = "";
    void addPhotoFiles(files);
  };

  // Dán ảnh tài sản từ clipboard (Ctrl+V) khi form đang mở.
  const handlePhotoPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData?.items || [])
      .filter(it => it.kind === "file" && it.type.startsWith("image/"))
      .map(it => it.getAsFile())
      .filter((f): f is File => !!f);
    if (imgs.length === 0 || imageProcessing) return;
    e.preventDefault();
    void addPhotoFiles(imgs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!formName.trim()) {
      setFormError("Vui lòng nhập tên tài sản.");
      return;
    }

    try {
      await onSaveAsset({
        id: editingAsset?.id,
        type: formType,
        name: formName.trim(),
        ownerId: formOwnerId || undefined,
        quantity: Number(formQuantity) || 0,
        unit: formUnit.trim() || defaultUnitForType(formType),
        purchaseUnitPrice: Number(formPurchaseUnitPrice) || undefined,
        purchaseValue: Number(formPurchaseValue) || undefined,
        estimatedUnitPrice: Number(formEstimatedUnitPrice) || undefined,
        estimatedValue: Number(formEstimatedValue) || 0,
        currency: formCurrency,
        purchaseDate: formPurchaseDate || undefined,
        location: formLocation.trim(),
        notes: formNotes.trim(),
        photos: formPhotos,
        symbol: formSymbol.trim(),
        network: formNetwork.trim(),
        walletLabel: formWalletLabel.trim(),
        walletAddressMasked: formWalletAddressMasked.trim(),
        address: formAddress.trim(),
        areaM2: Number(formAreaM2) || undefined,
        certificateNo: formCertificateNo.trim(),
        parcelNo: formParcelNo.trim(),
        goldPurity: formGoldPurity.trim(),
        goldSource: isGoldType(formType) ? formGoldSource.trim() : "",
        goldPackaging: isGoldType(formType) ? formGoldPackaging : undefined,
        goldStoreId: isGoldType(formType) ? (formGoldStoreId || undefined) : undefined,
        // Vàng: trọng lượng lưu từ Số lượng/Đơn vị (gộp, tránh nhập 2 lần).
        weight: isGoldType(formType) ? (Number(formQuantity) || undefined) : undefined,
        weightUnit: isGoldType(formType) ? formUnit.trim() : "",
        brand: formBrand.trim(),
        serialNo: formSerialNo.trim()
      });
      resetForm();
      setEditingAsset(null);
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Không lưu được tài sản.");
    }
  };

  const handleDelete = async (asset: FamilyAsset) => {
    const ok = await confirm({
      title: `Xóa tài sản "${asset.name}"?`,
      message: "Tài sản này cùng toàn bộ ảnh đính kèm sẽ bị xóa khỏi hệ thống. Bạn có chắc chắn muốn tiếp tục không?",
      confirmLabel: "Xóa tài sản",
      cancelLabel: "Đóng lại",
      tone: "danger"
    });
    if (!ok) return;
    await onDeleteAsset(asset.id);
  };

  const openSellForm = (asset: FamilyAsset) => {
    // Gợi ý giá bán = giá trị hiệu dụng hiện tại (live thị trường → ước tính → giá mua).
    const estimate = getEffectiveValue(asset, marketPrices).value;
    setSellingAsset(asset);
    setSellEstimate(estimate);
    setSellMode("estimate");
    setSellPrice(estimate);
    setSellAccount(AccountType.BANK);
    setSellDate(new Date().toISOString().slice(0, 10));
    setSellNote("");
    setSellError("");
  };

  const handleSellModeChange = (mode: "estimate" | "custom") => {
    setSellMode(mode);
    if (mode === "estimate") setSellPrice(sellEstimate);
  };

  const handleConfirmSell = async () => {
    if (!sellingAsset) return;
    setSellError("");
    const price = Number(sellPrice) || 0;
    if (price <= 0) {
      setSellError("Vui lòng nhập giá bán lớn hơn 0.");
      return;
    }
    if (!onSaveTransaction) {
      setSellError("Không ghi nhận được khoản thu từ bán tài sản.");
      return;
    }
    // Sổ thu chi chỉ tính bằng VNĐ — tài sản định giá USD sẽ quy đổi theo tỷ giá hiện tại.
    const rate = marketPrices?.usdVndRate || 25000;
    const amountVnd = sellingAsset.currency === "USD" ? Math.round(price * rate) : Math.round(price);
    const noteSuffix = sellNote.trim() ? ` — ${sellNote.trim()}` : "";
    setSelling(true);
    try {
      await onSaveTransaction({
        type: TransactionType.INCOME,
        amount: amountVnd,
        category: ASSET_SALE_CATEGORY,
        account: sellAccount,
        description: `Bán tài sản: ${sellingAsset.name}${noteSuffix}`,
        date: sellDate
      });
      await onDeleteAsset(sellingAsset.id);
      setSellingAsset(null);
    } catch (err: any) {
      setSellError(err.message || "Không ghi nhận được giao dịch bán tài sản.");
    } finally {
      setSelling(false);
    }
  };

  const fmtUsd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  const fmtVnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
  const changeBadge = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined || isNaN(pct)) return null;
    const up = pct >= 0;
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${up ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
        {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
      </span>
    );
  };
  const PriceSkeleton = () => (
    <>
      <span className="inline-block bg-slate-700/40 rounded-md animate-pulse align-middle h-5 w-24" />
      <span className="inline-block bg-slate-700/40 rounded-md animate-pulse align-middle h-2.5 w-20 mt-1" />
    </>
  );

  return (
    <div className="space-y-5" id="assets-module">
      {/* Market price widgets — BTC, ETH, Vàng, USD */}
      <Reveal className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Bitcoin */}
        <div className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-4 shadow-md hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[88px]">
          <ShimmerLine accent="amber" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">₿ Bitcoin</span>
            {widgetsOverview?.crypto?.bitcoin ? changeBadge(widgetsOverview.crypto.bitcoin.usd_24h_change) : null}
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            {marketPrices?.crypto["BTC"] ? (
              <>
                <p className="text-base font-extrabold text-slate-100 tabular-nums">{fmtUsd(marketPrices.crypto["BTC"].usd)}</p>
                <p className="text-[10px] text-slate-500 font-mono tabular-nums">{fmtVnd(marketPrices.crypto["BTC"].vnd)}</p>
              </>
            ) : <PriceSkeleton />}
          </div>
        </div>

        {/* Ethereum */}
        <div className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-4 shadow-md hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[88px]">
          <ShimmerLine accent="indigo" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Ξ Ethereum</span>
            {widgetsOverview?.crypto?.ethereum ? changeBadge(widgetsOverview.crypto.ethereum.usd_24h_change) : null}
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            {marketPrices?.crypto["ETH"] ? (
              <>
                <p className="text-base font-extrabold text-slate-100 tabular-nums">{fmtUsd(marketPrices.crypto["ETH"].usd)}</p>
                <p className="text-[10px] text-slate-500 font-mono tabular-nums">{fmtVnd(marketPrices.crypto["ETH"].vnd)}</p>
              </>
            ) : <PriceSkeleton />}
          </div>
        </div>

        {/* Vàng */}
        <div className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-yellow-500/30 rounded-2xl p-4 shadow-md hover:shadow-lg hover:shadow-yellow-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[88px]">
          <ShimmerLine accent="yellow" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-yellow-500">🪙 {widgetsOverview?.gold?.source || "Vàng"}</span>
            {widgetsOverview?.gold ? changeBadge(widgetsOverview.gold.changePct) : null}
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            {marketPrices?.gold ? (
              <>
                <p className="text-base font-extrabold text-slate-100 tabular-nums">{fmtVnd(Math.round(marketPrices.gold.pricePerLuongVnd))}</p>
                <p className="text-[10px] text-slate-500">
                  {widgetsOverview?.gold?.buy ? `Mua ${fmtVnd(widgetsOverview.gold.buy)} • ` : ""}Bán /lượng
                </p>
              </>
            ) : <PriceSkeleton />}
          </div>
        </div>

        {/* USD/VND */}
        <div className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-4 shadow-md hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[88px]">
          <ShimmerLine accent="emerald" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">💵 USD/VND</span>
            {marketPricesStatus === "ok" && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-700/80 dark:text-emerald-400/70">
                <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse inline-block" />
                Live
              </span>
            )}
            {marketPricesStatus === "loading" && (
              <RefreshCw className="size-3 text-slate-500 animate-spin" />
            )}
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            {marketPrices?.usdVndRate ? (
              <>
                <p className="text-base font-extrabold text-slate-100 tabular-nums">{fmtVnd(marketPrices.usdVndRate)}</p>
                <p className="text-[10px] text-slate-500">
                  Tỷ giá 1 USD
                  {marketPrices.lastUpdated ? ` · ${new Date(marketPrices.lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </p>
              </>
            ) : <PriceSkeleton />}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.06} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-850 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] text-slate-500">Tổng tài sản ước tính</p>
          <p className="mt-1 text-xl font-extrabold text-slate-100 tabular-nums">{formatMoney(stats.totalVnd)}</p>
          {stats.totalUsd > 0 && <p className="text-xs font-bold text-slate-400 tabular-nums">+ {formatMoney(stats.totalUsd, "USD")}</p>}
        </div>
        <div className="bg-slate-900 border border-slate-850 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] text-slate-500">Vàng các loại</p>
          <p className="mt-1 text-lg font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">{formatMoney(stats.goldVnd)}</p>
          {stats.goldUsd > 0 && <p className="text-xs font-bold text-amber-700/80 dark:text-amber-400/70 tabular-nums">+ {formatMoney(stats.goldUsd, "USD")}</p>}
        </div>
        <div className="bg-slate-900 border border-slate-850 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] text-slate-500">Crypto</p>
          <p className="mt-1 text-lg font-extrabold text-sky-500 dark:text-sky-400 tabular-nums">{formatMoney(stats.cryptoVnd)}</p>
          {stats.cryptoUsd > 0 && <p className="text-xs font-bold text-sky-500/70 dark:text-sky-400/70 tabular-nums">+ {formatMoney(stats.cryptoUsd, "USD")}</p>}
        </div>
        <div className="bg-slate-900 border border-slate-850 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] text-slate-500">Sổ đất / BĐS</p>
          <p className="mt-1 text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatMoney(stats.landVnd)}</p>
          {stats.landUsd > 0 && <p className="text-xs font-bold text-emerald-600/70 dark:text-emerald-400/70 tabular-nums">+ {formatMoney(stats.landUsd, "USD")}</p>}
        </div>
      </Reveal>

      <Reveal delay={0.12} className="relative overflow-hidden bg-slate-900 border border-slate-850 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <ShimmerLine accent="emerald" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên tài sản, tiệm vàng, mã sổ, ví crypto, vị trí lưu giữ..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-850 dark:border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setGoldStoresModalOpen(true)}
              className="bg-amber-100 dark:bg-amber-600/20 hover:bg-amber-200 dark:hover:bg-amber-600/30 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              title="Quản lý tiệm vàng tư nhân và bảng giá thời điểm"
            >
              <Store className="size-4 text-amber-700 dark:text-amber-400" /> Tiệm vàng & Bảng giá
              {goldStores.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-500/30 text-amber-900 dark:text-amber-300 font-bold ml-0.5">
                  {goldStores.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={openGoldImport}
              className="bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Upload className="size-4 text-amber-700 dark:text-amber-400" /> Nhập bảng giá từ ảnh
            </button>
            <button
              type="button"
              onClick={openCreateForm}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="size-4" /> Thêm tài sản
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          <div>
            <label className="text-slate-500 block mb-1">Loại tài sản</label>
            <FancySelect
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as AssetType | "all")}
              ariaLabel="Lọc theo loại tài sản"
              options={[{ value: "all", label: "Tất cả tài sản" }, ...ASSET_TYPES]}
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">Chủ sở hữu</label>
            <FancySelect
              value={ownerFilter}
              onChange={setOwnerFilter}
              ariaLabel="Lọc theo chủ sở hữu"
              options={[
                { value: "all", label: "Cả gia đình" },
                { value: "", label: "Chưa gán chủ sở hữu" },
                ...users.map(user => ({ value: user.id, label: user.fullName }))
              ]}
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">Sắp xếp theo</label>
            <FancySelect
              value={sortBy}
              onChange={(v) => setSortBy(v as any)}
              ariaLabel="Sắp xếp danh sách tài sản"
              options={SORT_OPTIONS}
            />
          </div>
        </div>
      </Reveal>

      {filteredAssets.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center space-y-3">
          <p className="text-sm text-slate-500">Chưa có tài sản nào phù hợp với bộ lọc.</p>
          <button type="button" onClick={openCreateForm} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
            <Plus className="size-4" /> Thêm tài sản đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredAssets.map((asset, assetIndex) => {
            const owner = users.find(u => u.id === asset.ownerId);
            const creator = users.find(u => u.id === asset.createdById);
            const firstPhoto = asset.photos?.[0];
            const Icon = asset.type === "land" ? Landmark : asset.type === "crypto" ? Coins : asset.type === "vehicle" ? Car : asset.type === "stock" ? LineChart : isGoldType(asset.type) ? Gem : Wallet;

            return (
              <Reveal
                as="article"
                key={asset.id}
                delay={0.16 + staggerDelay(assetIndex)}
                hoverLift
                className="bg-slate-900 border border-slate-850 dark:border-slate-800 hover:border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:shadow-emerald-500/5 transition-[box-shadow,border-color] duration-300 flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-3.5">
                  {/* Card Header: Avatar, Badges, Title, Action buttons */}
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      disabled={!firstPhoto}
                      onClick={() => firstPhoto && setSelectedPhoto({ asset, photo: firstPhoto })}
                      className="size-14 sm:size-16 rounded-2xl border border-slate-850 bg-slate-950/80 overflow-hidden shrink-0 flex items-center justify-center disabled:cursor-default cursor-pointer shadow-xs group"
                      aria-label={firstPhoto ? `Xem ảnh tài sản ${asset.name}` : `Tài sản ${asset.name} chưa có ảnh`}
                    >
                      {firstPhoto ? (
                        <img src={firstPhoto.thumbnailDataUrl} alt={asset.name} className="size-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className={`size-full flex items-center justify-center ${
                          isGoldType(asset.type)
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : asset.type === "crypto"
                            ? "bg-sky-500/10 text-sky-500 dark:text-sky-400"
                            : asset.type === "land"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : asset.type === "vehicle"
                            ? "bg-orange-500/10 text-orange-500 dark:text-orange-400"
                            : asset.type === "stock"
                            ? "bg-violet-500/10 text-violet-500 dark:text-violet-400"
                            : "bg-slate-800/40 text-slate-400"
                        }`}>
                          <Icon className="size-6 sm:size-7" />
                        </div>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold ${typeClass(asset.type)}`}>
                              {assetTypeLabel(asset.type)}
                            </span>
                            {isGoldType(asset.type) && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${
                                  asset.goldPackaging === "blister"
                                    ? "text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 shadow-xs"
                                    : "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700"
                                }`}
                              >
                                {asset.goldPackaging === "blister" ? "🏷️ Ép vỉ (Thanh khoản cao)" : "💍 Loại thường"}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-medium bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300">
                              <UserIcon className="size-2.5 text-slate-400" />
                              {owner ? owner.fullName : "Tài sản chung"}
                            </span>
                          </div>
                          <h3 className="mt-1 text-base font-bold text-slate-100 truncate" title={asset.name}>
                            {asset.name}
                          </h3>
                        </div>

                        {canManageAsset(asset) && (
                          <div className="flex items-center gap-1 shrink-0 bg-slate-950/60 border border-slate-850 p-1 rounded-xl shadow-xs">
                            {supportsManualPrice(asset) && onSaveAssetPriceLog && (
                              <button
                                type="button"
                                onClick={() => void openPriceLogForm(asset)}
                                aria-label={`Cập nhật giá ${asset.name}`}
                                title="Cập nhật giá thủ công và xem lịch sử"
                                className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-sky-500 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <RefreshCw className="size-3.5" />
                              </button>
                            )}
                            {onSaveTransaction && (
                              <button
                                type="button"
                                onClick={() => openSellForm(asset)}
                                aria-label={`Bán tài sản ${asset.name}`}
                                title="Bán tài sản"
                                className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-500 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <HandCoins className="size-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditForm(asset)}
                              aria-label={`Sửa tài sản ${asset.name}`}
                              title="Chỉnh sửa tài sản"
                              className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-500 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(asset)}
                              aria-label={`Xóa tài sản ${asset.name}`}
                              title="Xóa tài sản"
                              className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Metrics & Purchase Date Block */}
                  {(() => {
                    const ev = getEffectiveValue(asset, marketPrices);
                    const purchase = Number(asset.purchaseValue || 0);
                    const showPL = purchase > 0 && ev.value > 0 && ev.source !== "purchase";
                    const diff = ev.value - purchase;
                    const pct = purchase > 0 ? (diff / purchase) * 100 : 0;
                    const up = diff >= 0;
                    const q = isGoldType(asset.type) ? effectiveGoldWeight(asset) : Number(asset.quantity || 0);
                    const u = isGoldType(asset.type) ? (asset.weightUnit || asset.unit || "chỉ") : (asset.unit || "món");
                    const estUnitPrice = asset.estimatedUnitPrice || (q > 0 ? Math.round(ev.value / q) : 0);
                    const buyUnitPrice = asset.purchaseUnitPrice || (q > 0 && purchase > 0 ? Math.round(purchase / q) : 0);
                    const holdingText = getHoldingDuration(asset.purchaseDate);

                    return (
                      <div className="bg-slate-950/70 border border-slate-850 rounded-xl p-3 sm:p-3.5 space-y-2.5 shadow-xs">
                        {/* Value + Profit/Loss Pill */}
                        <div className="flex items-baseline justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl sm:text-2xl font-black text-slate-100 tabular-nums tracking-tight">
                              {ev.source === "live" ? "≈ " : ""}{formatMoney(ev.value, asset.currency)}
                            </span>
                            {ev.source === "live" && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE
                              </span>
                            )}
                            {ev.source === "purchase" && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-800 border border-slate-700/80 text-slate-400">
                                theo giá vốn
                              </span>
                            )}
                          </div>

                          {showPL && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border tabular-nums ${
                              up ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                            }`}>
                              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                              {up ? "+" : "−"}{Math.abs(pct).toFixed(1)}%
                            </span>
                          )}
                        </div>

                        {/* Breakdown: Unit Price & Capital & Absolute Profit/Loss */}
                        <div className="flex flex-col gap-1 text-xs text-slate-400 font-mono border-t border-slate-850/80 pt-2">
                          {q > 1 && estUnitPrice > 0 && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">Đơn giá hiện tại:</span>
                              <span className="text-slate-200 font-semibold">{formatMoney(estUnitPrice, asset.currency)}/{u}</span>
                            </div>
                          )}
                          {purchase > 0 && (
                            <div className="flex items-center justify-between flex-wrap gap-1 text-[11px]">
                              <span className="text-slate-500">
                                Vốn mua: <b className="text-slate-300 font-medium">{formatMoney(purchase, asset.currency)}</b>
                                {q > 1 && buyUnitPrice > 0 && <span className="text-slate-500 ml-1">({formatMoney(buyUnitPrice, asset.currency)}/{u})</span>}
                              </span>
                              {showPL && (
                                <span className={`font-semibold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                  {up ? "Lời +" : "Lỗ −"}{formatMoney(Math.abs(diff), asset.currency)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Purchase Date & Holding Time (NỔI BẬT & RÕ RÀNG) */}
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs border-t border-slate-850/80 pt-2 bg-slate-900/40 -mx-1 px-2.5 py-1.5 rounded-lg">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Calendar className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-slate-500 text-[11px]">Ngày mua:</span>
                            <strong className="font-semibold text-slate-100 font-mono text-[11px]">
                              {asset.purchaseDate ? formatDateVN(asset.purchaseDate) : "Chưa cập nhật"}
                            </strong>
                          </div>
                          {asset.purchaseDate && holdingText ? (
                            <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                              <Clock className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>Nắm giữ {holdingText}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Specifications Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {isGoldType(asset.type) && (
                      <>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Trọng lượng</span>
                          <span className="text-amber-700 dark:text-amber-400 font-bold tabular-nums">
                            {asset.weight ? `${asset.weight} ${asset.weightUnit || asset.unit || "chỉ"}` : `${asset.quantity} ${asset.unit || "chỉ"}`}
                          </span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Tuổi vàng</span>
                          <span className="text-slate-200 font-semibold truncate block">
                            {goldPurityLabel(asset.goldPurity)}
                          </span>
                        </div>
                        <div className={`bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 ${asset.location ? "" : "col-span-2 sm:col-span-1"}`}>
                          <span className="text-[10px] text-slate-500 block">Tiệm / Nguồn</span>
                          <span className="text-amber-800 dark:text-amber-300 font-semibold truncate block" title={asset.goldSource || "Tiệm vàng tư nhân"}>
                            🏪 {asset.goldSource || "Tiệm vàng tư nhân"}
                          </span>
                        </div>
                        {asset.location && (
                          <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-3">
                            <span className="text-[10px] text-slate-500 block">Vị trí lưu giữ</span>
                            <span className="text-slate-300 font-medium flex items-center gap-1">
                              <MapPin className="size-3 text-slate-400 shrink-0" /> {asset.location}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {asset.type === "crypto" && (
                      <>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Mã token</span>
                          <span className="text-sky-400 font-bold">{asset.symbol || "—"}</span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Mạng</span>
                          <span className="text-slate-200 font-medium truncate block">{asset.network || "—"}</span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-slate-500 block">Số lượng</span>
                          <span className="text-slate-200 font-semibold tabular-nums">{asset.quantity} {asset.unit}</span>
                        </div>
                        {(asset.walletAddressMasked || asset.address) && (
                          <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-3">
                            <span className="text-[10px] text-slate-500 block">Địa chỉ ví</span>
                            <span className="text-slate-300 font-mono text-[11px] truncate block">{asset.walletAddressMasked || asset.address}</span>
                          </div>
                        )}
                      </>
                    )}

                    {asset.type === "land" && (
                      <>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Diện tích</span>
                          <span className="text-emerald-500 font-bold tabular-nums">{asset.areaM2 ? `${asset.areaM2} m²` : "—"}</span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Số sổ</span>
                          <span className="text-slate-200 font-medium truncate block">{asset.certificateNo || "—"}</span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-slate-500 block">Số thửa</span>
                          <span className="text-slate-200 font-medium truncate block">{asset.parcelNo || "—"}</span>
                        </div>
                        {(asset.address || asset.location) && (
                          <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-3">
                            <span className="text-[10px] text-slate-500 block">Địa chỉ BĐS</span>
                            <span className="text-slate-300 font-medium flex items-center gap-1">
                              <MapPin className="size-3 text-emerald-500 shrink-0" /> {asset.address || asset.location}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {asset.type === "vehicle" && (
                      <>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Hãng / Dòng</span>
                          <span className="text-orange-400 font-bold truncate block">{asset.brand || "—"}</span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Biển số / Khung</span>
                          <span className="text-slate-200 font-mono text-[11px] truncate block">{asset.serialNo || "—"}</span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-slate-500 block">Số lượng</span>
                          <span className="text-slate-200 font-semibold tabular-nums">{asset.quantity} {asset.unit}</span>
                        </div>
                        {asset.location && (
                          <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-3">
                            <span className="text-[10px] text-slate-500 block">Vị trí lưu giữ</span>
                            <span className="text-slate-300 font-medium flex items-center gap-1">
                              <MapPin className="size-3 text-slate-400 shrink-0" /> {asset.location}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {asset.type === "stock" && (
                      <>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Mã CP</span>
                          <span className="text-violet-400 font-bold">{asset.symbol || "—"}</span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Sàn / CTCK</span>
                          <span className="text-slate-200 font-medium truncate block">{asset.brand || "—"}</span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-slate-500 block">Số lượng</span>
                          <span className="text-slate-200 font-semibold tabular-nums">{asset.quantity} {asset.unit}</span>
                        </div>
                      </>
                    )}

                    {asset.type === "other" && (
                      <>
                        <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 block">Số lượng</span>
                          <span className="text-slate-200 font-semibold tabular-nums">{asset.quantity} {asset.unit}</span>
                        </div>
                        {asset.location && (
                          <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1.5 col-span-2 sm:col-span-2">
                            <span className="text-[10px] text-slate-500 block">Vị trí lưu giữ</span>
                            <span className="text-slate-300 font-medium flex items-center gap-1">
                              <MapPin className="size-3 text-slate-400 shrink-0" /> {asset.location}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Notes Callout (có tiêu đề và icon rõ ràng, không bị trôi nổi) */}
                  {asset.notes && (
                    <div className="bg-slate-950/50 border border-slate-850/80 rounded-xl p-2.5 text-xs flex items-start gap-2">
                      <FileText className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-0.5">Ghi chú</span>
                        <p className="text-slate-300 whitespace-pre-wrap">{asset.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Additional photos preview */}
                  {asset.photos?.length > 1 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {asset.photos.map(photo => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setSelectedPhoto({ asset, photo })}
                          className="size-11 rounded-xl border border-slate-850 overflow-hidden bg-slate-950 hover:border-emerald-500/50 transition-colors cursor-pointer shadow-xs"
                          aria-label={`Xem ảnh ${photo.fileName}`}
                        >
                          <img src={photo.thumbnailDataUrl} alt={photo.fileName} className="size-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Người tạo & Ngày cập nhật */}
                <div className="pt-2.5 border-t border-slate-850/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 truncate">
                    <UserIcon className="size-3 text-slate-400 shrink-0" />
                    <span>Tạo bởi {creator ? creator.fullName : "thành viên"}</span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    Cập nhật {new Date(asset.updatedAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      {goldImportOpen && (
        <div onClick={() => { if (!goldImportLoading && !goldImportSaving) setGoldImportOpen(false); }} className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-50 p-4" id="gold-price-import-modal">
          <motion.div
            ref={goldImportRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gold-price-import-title"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 id="gold-price-import-title" className="text-md font-bold text-slate-100 flex items-center gap-1.5"><Upload className="size-5 text-amber-700 dark:text-amber-400" /> Nhập bảng giá vàng từ ảnh</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">OCR chỉ gợi ý dữ liệu; hãy kiểm tra trước khi lưu.</p>
              </div>
              <button type="button" onClick={() => setGoldImportOpen(false)} disabled={goldImportLoading || goldImportSaving} aria-label="Đóng nhập bảng giá" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center disabled:opacity-50"><X className="size-4" /></button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1 min-h-0">
              {goldImportError && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">{goldImportError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1 text-xs text-slate-400 md:col-span-1">
                  <span className="block font-semibold">Cửa hàng / nguồn giá <span className="text-rose-400">*</span></span>
                  <input value={goldImportStore} onChange={(e) => setGoldImportStore(e.target.value)} placeholder="VD: Tiệm vàng Gia Bảo, SJC..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-amber-500" />
                </label>
                <label className="space-y-1 text-xs text-slate-400">
                  <span className="block font-semibold">Thời điểm bảng giá</span>
                  <input type="datetime-local" value={goldImportCapturedAt} onChange={(e) => setGoldImportCapturedAt(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                </label>
                <label className="space-y-1 text-xs text-slate-400">
                  <span className="block font-semibold">Ảnh bảng giá</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { setGoldImportFile(e.target.files?.[0] || null); setGoldImportPreview(null); setGoldImportError(""); }} className="block w-full text-[11px] text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-500 file:px-2.5 file:py-2 file:text-xs file:font-bold file:text-slate-950" />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void handleGoldImportPreview()} disabled={!goldImportFile || goldImportLoading || goldImportSaving} className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                  <RefreshCw className={`size-3.5 ${goldImportLoading ? "animate-spin" : ""}`} /> {goldImportLoading ? "Đang đọc ảnh..." : "Đọc ảnh và xem trước"}
                </button>
                {goldImportFile && <span className="text-[11px] text-slate-500 truncate max-w-[280px]">{goldImportFile.name}</span>}
              </div>
              {goldImportPreview && (
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-200">Ảnh nguồn</p>
                    <img src={goldImportPreview.imageUrl} alt="Ảnh bảng giá vàng đã nhập" className="w-full max-h-64 object-contain rounded-xl border border-slate-800 bg-slate-950" />
                    <p className="text-[10px] text-slate-600">Ảnh được lưu cùng lần nhập để đối chiếu về sau.</p>
                  </div>
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-200">Các dòng nhận diện ({goldImportPreview.rows.length})</h4>
                      <span className="text-[10px] text-slate-500">Có thể sửa trước khi lưu</span>
                    </div>
                    {goldImportPreview.rows.length === 0 ? (
                      <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 rounded-xl p-3">Chưa nhận diện được dòng giá. Bạn vẫn có thể lưu ảnh để tra cứu, nhưng nên nhập lại bằng ảnh rõ hơn.</p>
                    ) : (
                      <div className="space-y-2">
                        {goldImportPreview.rows.map(row => (
                          <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1.1fr_1.1fr_160px_160px_90px] gap-2 items-end bg-slate-950/50 border border-slate-800 rounded-xl p-2.5">
                            <label className="text-[10px] text-slate-500">Tên / loại<input value={row.label} onChange={(e) => updateGoldImportRow(row.id, { label: e.target.value })} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" /></label>
                            <label className="text-[10px] text-slate-500">Gắn vào tài sản<select value={row.assetId || ""} onChange={(e) => updateGoldImportRow(row.id, { assetId: e.target.value || undefined })} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"><option value="">Chỉ lưu bảng giá</option>{assets.filter(asset => isGoldType(asset.type)).map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                            <div><label className="text-[10px] text-slate-500 block mb-1">Giá mua</label><MoneyInput value={row.buyPrice || 0} onChange={(val) => updateGoldImportRow(row.id, { buyPrice: val > 0 ? val : undefined })} placeholder="Giá mua" size="sm" showZeroShortcuts={true} /></div>
                            <div><label className="text-[10px] text-slate-500 block mb-1">Giá bán</label><MoneyInput value={row.sellPrice || 0} onChange={(val) => updateGoldImportRow(row.id, { sellPrice: val > 0 ? val : undefined })} placeholder="Giá bán" size="sm" showZeroShortcuts={true} /></div>
                            <label className="text-[10px] text-slate-500">Đơn vị<select value={row.unit} onChange={(e) => updateGoldImportRow(row.id, { unit: e.target.value as GoldPriceImportRow["unit"] })} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"><option value="lượng">lượng</option><option value="chỉ">chỉ</option><option value="gram">gram</option></select></label>
                          </div>
                        ))}
                      </div>
                    )}
                    <details className="text-[10px] text-slate-500"><summary className="cursor-pointer">Xem text OCR thô</summary><pre className="mt-2 whitespace-pre-wrap bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-32 overflow-auto">{goldImportPreview.ocrText || "(trống)"}</pre></details>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-slate-600 leading-relaxed">Ảnh và các dòng giá được lưu theo cửa hàng/thời điểm, tách với giá thủ công và giá tự động từ Needle. Đây là công cụ theo dõi/tham khảo, không phải khuyến nghị đầu tư.</p>
            </div>
            <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-800 shrink-0">
              <button type="button" onClick={() => setGoldImportOpen(false)} disabled={goldImportLoading || goldImportSaving} className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-bold disabled:opacity-50">Đóng lại</button>
              <button type="button" onClick={() => void handleGoldImportSave()} disabled={!goldImportPreview || goldImportSaving || goldImportLoading} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold disabled:opacity-50">{goldImportSaving ? "Đang lưu..." : "Lưu bảng giá"}</button>
            </div>
          </motion.div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-50 p-4" id="asset-form-modal">
          <motion.div
            ref={formRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <h3 className="text-md font-bold text-slate-100">{editingAsset ? "Chỉnh sửa tài sản" : "Thêm tài sản gia đình"}</h3>
              <button type="button" onClick={closeForm} aria-label="Đóng form tài sản" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} onPaste={handlePhotoPaste} className="flex flex-col min-h-0 flex-1 overflow-hidden text-xs">
              <div className="space-y-4 overflow-y-auto px-5 py-4 flex-1 min-h-0">
                {formError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400 block font-semibold">Loại tài sản</label>
                    <FancySelect
                      value={formType}
                      onChange={(v) => handleTypeChange(v as AssetType)}
                      ariaLabel="Loại tài sản"
                      options={ASSET_TYPES}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 block font-semibold">Tên tài sản <span className="text-rose-400">*</span></label>
                    <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="VD: 2 lượng SJC, BTC ví lạnh, sổ đất Long An..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-emerald-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400 block font-semibold text-xs">Chủ sở hữu</label>
                    <FancySelect
                      value={formOwnerId}
                      onChange={setFormOwnerId}
                      ariaLabel="Chủ sở hữu"
                      placeholder="Tài sản chung"
                      options={[
                        { value: "", label: "Tài sản chung" },
                        ...users.map(user => ({ value: user.id, label: user.fullName }))
                      ]}
                    />
                  </div>
                  {formType === "land" ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-slate-400 block font-semibold text-xs">Diện tích đất</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formQuantity || ""}
                            onChange={(e) => handleQuantityChange(Number(e.target.value))}
                            placeholder="Diện tích"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none font-mono text-xs"
                          />
                          <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-500 font-mono">m2</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 block font-semibold text-xs">Đơn vị</label>
                        <input
                          disabled
                          value="m2"
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-slate-400 outline-none font-mono text-xs cursor-not-allowed"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-slate-400 block font-semibold text-xs">
                          {isGoldType(formType) ? "Trọng lượng vàng" : "Số lượng"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={formQuantity || ""}
                          onChange={(e) => handleQuantityChange(Number(e.target.value))}
                          placeholder="Số lượng"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 block font-semibold text-xs">Đơn vị</label>
                        {isGoldType(formType) ? (
                          <FancySelect
                            value={formUnit}
                            onChange={(v) => {
                              setFormUnit(v);
                            }}
                            ariaLabel="Đơn vị"
                            options={[
                              { value: "chỉ", label: "chỉ" },
                              { value: "lượng", label: "lượng (cây)" },
                              { value: "gram", label: "gram" },
                              { value: "phân", label: "phân (0.1 chỉ)" }
                            ]}
                          />
                        ) : (
                          <input
                            value={formUnit}
                            onChange={(e) => setFormUnit(e.target.value)}
                            placeholder="VD: cái, chiếc, coin..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none text-xs"
                          />
                        )}
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <label className="text-slate-400 block font-semibold text-xs">Tiền tệ</label>
                    <FancySelect
                      value={formCurrency}
                      onChange={(v) => setFormCurrency(v as "VND" | "USD")}
                      ariaLabel="Tiền tệ"
                      options={[
                        { value: "VND", label: "VND" },
                        { value: "USD", label: "USD" }
                      ]}
                    />
                  </div>
                </div>

                {/* KHỐI 1: GIÁ MUA BAN ĐẦU (VỐN ĐẦU TƯ) */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Wallet className="size-3.5 text-amber-700 dark:text-amber-400" />
                      Giá mua ban đầu (Vốn đầu tư)
                    </span>
                    {formQuantity > 0 && formPurchaseUnitPrice > 0 && (
                      <span className="text-[11px] text-amber-800 dark:text-amber-400/80 font-mono font-medium">
                        {formQuantity} {formUnit} × {formatMoney(formPurchaseUnitPrice, formCurrency)}/{formUnit}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 block font-semibold text-xs">
                        Đơn giá mua / 1 {formUnit || "đơn vị"}
                      </label>
                      <MoneyInput
                        value={formPurchaseUnitPrice}
                        onChange={handlePurchaseUnitPriceChange}
                        placeholder="Ví dụ: 10.950.000"
                        currency={`/${formUnit || "đv"}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-400 block font-semibold text-xs">
                          Tổng giá mua ban đầu
                        </label>
                        <span className="text-[9px] text-amber-800 dark:text-amber-400/80 font-mono font-medium">Tự tính: SL × Đơn giá</span>
                      </div>
                      <MoneyInput
                        value={formPurchaseValue}
                        onChange={handlePurchaseValueChange}
                        placeholder="Tự động nhân từ đơn giá"
                        currency={formCurrency}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 block font-semibold text-xs">Ngày mua / ghi nhận</label>
                      <DateInputDMY value={formPurchaseDate} onChange={setFormPurchaseDate} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none font-mono text-xs" />
                    </div>
                  </div>

                  {formPurchaseValue > 0 && (
                    <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-850">
                      <span>
                        ∑ Tổng vốn: <b className="text-slate-200">{formatMoney(formPurchaseValue, formCurrency)}</b>
                        {formQuantity > 0 && formPurchaseUnitPrice > 0 && (
                          <span className="text-slate-500 ml-1">
                            (= {formQuantity} {formUnit} × {formatMoney(formPurchaseUnitPrice, formCurrency)}/{formUnit})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* KHỐI 2: GIÁ TRỊ ƯỚC TÍNH HIỆN TẠI (TỪ ĐƠN VỊ NHỎ NHẤT NHÂN LÊN) */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      Giá trị ước tính hiện tại
                      {formAutoValue && formEstimatedValue === 0 && (
                        <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">LIVE AUTO</span>
                      )}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {marketUnitPrice > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleEstimatedUnitPriceChange(marketUnitPrice);
                          }}
                          className="text-[10px] text-sky-600 dark:text-sky-300 hover:text-sky-700 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors"
                          title="Điền theo bảng giá thị trường đang có"
                        >
                          Dùng giá thị trường ({formatMoney(marketUnitPrice, formCurrency)}/{formUnit})
                        </button>
                      )}
                      {formPurchaseUnitPrice > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleEstimatedUnitPriceChange(formPurchaseUnitPrice);
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-750 px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors"
                          title="Sao chép từ đơn giá mua ban đầu"
                        >
                          = Giá mua
                        </button>
                      )}
                      {formEstimatedValue > 0 && marketUnitPrice > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormEstimatedUnitPrice(0);
                            setFormEstimatedValue(0);
                          }}
                          className="text-[10px] text-slate-400 hover:text-amber-700 dark:hover:text-amber-400 bg-slate-800/80 px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors"
                          title="Để trống để tự động dùng giá thị trường LIVE"
                        >
                          Xóa để dùng LIVE
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Đơn vị nhỏ nhất */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-400 block font-semibold text-xs">
                          Đơn giá ước tính / 1 {formUnit || "đơn vị"}
                        </label>
                        {marketUnitPrice > 0 && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                            Thị trường: {formatMoney(marketUnitPrice, formCurrency)}/{formUnit}
                          </span>
                        )}
                      </div>
                      <MoneyInput
                        value={formEstimatedUnitPrice}
                        onChange={handleEstimatedUnitPriceChange}
                        placeholder={marketUnitPrice > 0 ? formatMoneyInput(marketUnitPrice) : "Nhập đơn giá / 1 đơn vị"}
                        currency={`/${formUnit || "đv"}`}
                      />
                    </div>

                    {/* Tổng giá trị ước tính */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-400 block font-semibold text-xs">
                          Tổng giá trị ước tính
                        </label>
                        <span className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 font-mono">Tự tính: SL × Đơn giá</span>
                      </div>
                      <MoneyInput
                        value={formEstimatedValue}
                        onChange={handleEstimatedValueChange}
                        placeholder={formAutoValue ? `Tự động: ${formatMoney(formAutoValue.value, formCurrency)}` : "Tự động nhân từ đơn vị nhỏ nhất"}
                        currency={formCurrency}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-850 text-xs">
                    <div className="text-[11px] text-slate-400 font-mono">
                      {formQuantity > 0 && formEstimatedUnitPrice > 0 ? (
                        <span>
                          ∑ Ước tính: <b className="text-emerald-700 dark:text-emerald-400">{formatMoney(formEstimatedValue, formCurrency)}</b>
                          <span className="text-slate-500 ml-1">
                            (= {formQuantity} {formUnit} × {formatMoney(formEstimatedUnitPrice, formCurrency)}/{formUnit})
                          </span>
                        </span>
                      ) : formAutoValue ? (
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <TrendingUp className="size-3" />
                          LIVE: <b>{formatMoney(formAutoValue.value, formCurrency)}</b>
                          <span className="text-slate-500">({formAutoValue.label}) — Để trống ô đơn giá để tự dùng giá live</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Nhập đơn giá để tự nhân tổng giá trị ước tính từ đơn vị nhỏ nhất.</span>
                      )}
                    </div>

                    {/* Lời/lỗ dự kiến */}
                    {(() => {
                      const cur = formEstimatedValue > 0 ? formEstimatedValue : (formAutoValue?.value || 0);
                      const buy = formPurchaseValue;
                      if (cur > 0 && buy > 0) {
                        const diff = cur - buy;
                        const pct = (diff / buy) * 100;
                        const up = diff >= 0;
                        return (
                          <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg border ${up ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"}`}>
                            {up ? "Dự kiến lời:" : "Dự kiến lỗ:"} {up ? "+" : "−"}{formatMoney(Math.abs(diff), formCurrency)} ({up ? "+" : ""}{pct.toFixed(1)}%)
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {formType === "crypto" && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                    <input value={formSymbol} onChange={(e) => setFormSymbol(e.target.value.toUpperCase())} placeholder="Mã coin: BTC" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    <input value={formNetwork} onChange={(e) => setFormNetwork(e.target.value)} placeholder="Network: Bitcoin/ERC20" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    <input value={formWalletLabel} onChange={(e) => setFormWalletLabel(e.target.value)} placeholder="Ví: Ledger/Binance" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    <input value={formWalletAddressMasked} onChange={(e) => setFormWalletAddressMasked(e.target.value)} placeholder="Địa chỉ rút gọn" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    {marketPrices && formSymbol && marketPrices.crypto[formSymbol.toUpperCase()] && (
                      <div className="md:col-span-4 flex items-center gap-2 text-[10px] text-sky-400/80">
                        <TrendingUp className="size-3 shrink-0" />
                        {formSymbol}: <span className="font-bold">${marketPrices.crypto[formSymbol.toUpperCase()].usd.toLocaleString("en-US")}</span>
                        <span className="text-slate-600">≈ {formatMoney(Math.round(marketPrices.crypto[formSymbol.toUpperCase()].vnd))}</span>
                        <span className="text-slate-700">/ coin</span>
                      </div>
                    )}
                    {marketPrices && formSymbol && !marketPrices.crypto[formSymbol.toUpperCase()] && formSymbol.length >= 2 && (
                      <p className="md:col-span-4 text-[10px] text-slate-600">Chưa có giá live cho {formSymbol} — nhập giá trị ước tính thủ công.</p>
                    )}
                  </div>
                )}

                {formType === "land" && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                    <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Địa chỉ/thửa đất" className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    <input type="number" min="0" step="0.01" value={formAreaM2 || ""} onChange={(e) => setFormAreaM2(Number(e.target.value))} placeholder="Diện tích m2" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    <input value={formCertificateNo} onChange={(e) => setFormCertificateNo(e.target.value)} placeholder="Số sổ" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    <input value={formParcelNo} onChange={(e) => setFormParcelNo(e.target.value)} placeholder="Số thửa/tờ bản đồ" className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                  </div>
                )}

                {isGoldType(formType) && (
                  <div className="space-y-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                    {/* Hình thức bao bì: Ép vỉ vs Loại thường */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-amber-700 dark:text-amber-400" />
                          Hình thức bao bì vàng nhẫn 24K:
                        </label>
                        <span className="text-[10px] text-amber-800 dark:text-amber-400/90 font-medium">
                          {formGoldPackaging === "blister" ? "Ép vỉ thanh khoản cao hơn" : "Nhẫn trơn thông thường"}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleGoldPackagingChange("blister")}
                          className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                            formGoldPackaging === "blister"
                              ? "bg-amber-100/80 dark:bg-amber-500/15 border-amber-400 dark:border-amber-500/80 text-amber-900 dark:text-amber-200 shadow-sm"
                              : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900"
                          }`}
                        >
                          <span className="text-xl">🏷️</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold leading-tight text-amber-800 dark:text-amber-300">Ép vỉ (Thanh khoản cao)</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300">Khuyên dùng</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">Bao bì niêm phong chuẩn tuổi, tiệm thu mua lại giá cao nhất</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGoldPackagingChange("plain")}
                          className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                            formGoldPackaging === "plain"
                              ? "bg-amber-100/80 dark:bg-amber-500/15 border-amber-400 dark:border-amber-500/80 text-amber-900 dark:text-amber-200 shadow-sm"
                              : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900"
                          }`}
                        >
                          <span className="text-xl">💍</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight text-slate-200">Loại thường / Nhẫn trơn</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Nhẫn tròn trơn truyền thống, thanh khoản theo giá vàng thường</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pt-1 border-t border-slate-850">
                      <div className="flex items-center gap-1.5">
                        <FancySelect
                          value={normalizeGoldPurity(formGoldPurity)}
                          onChange={setFormGoldPurity}
                          ariaLabel="Tuổi vàng"
                          placeholder="— Tuổi vàng —"
                          className="flex-1 min-w-0"
                          options={[
                            { value: "", label: "— Tuổi vàng —" },
                            ...GOLD_PURITY_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${Math.round(o.factor * 100)}%)` }))
                          ]}
                        />
                        <button type="button" onClick={() => setShowGoldPurityInfo(true)} aria-label="Bảng quy ước tuổi vàng" title="Bảng quy ước tuổi vàng" className="shrink-0 size-9 rounded-lg bg-slate-800 border border-slate-700 text-amber-700 dark:text-amber-400 hover:bg-slate-700 flex items-center justify-center cursor-pointer">
                          <Info className="size-4" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <FancySelect
                          value={formGoldSource}
                          onChange={handleGoldSourceChange}
                          ariaLabel="Nguồn vàng"
                          placeholder="— Mua tại tiệm tư nhân / hãng —"
                          options={goldSourceOptions}
                        />
                      </div>

                      <input value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder="Nhãn hiệu/tiệm vàng" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                      <input value={formSerialNo} onChange={(e) => setFormSerialNo(e.target.value)} placeholder="Số seri nếu có" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />

                      <div className="md:col-span-2 xl:col-span-4 flex items-center justify-between flex-wrap gap-2 text-[10px]">
                        {formGoldStoreId ? (
                          <div className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                            <Store className="size-3.5 text-amber-700 dark:text-amber-400" />
                            <span>
                              Đang áp dụng bảng giá tiệm: <b>{formGoldSource}</b> ({formGoldPackaging === "blister" ? "Ép vỉ" : "Loại thường"})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            Chọn tiệm vàng tư nhân để tự động điền đơn giá thu mua theo hình thức bao bì
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setGoldStoresModalOpen(true)}
                          className="text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold underline flex items-center gap-1 cursor-pointer"
                        >
                          <Store className="size-3" /> Quản lý danh mục & bảng giá tiệm vàng
                        </button>
                      </div>

                      {marketPrices?.gold && (
                        <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-amber-400/80 pt-1 border-t border-slate-850">
                          <span className="flex items-center gap-1"><TrendingUp className="size-3" /> Giá vàng 9999 thị trường live:</span>
                          <span className="font-bold">{formatMoney(Math.round(marketPrices.gold.pricePerChiVnd))}/chỉ</span>
                          <span className="text-amber-400/50">· {formatMoney(Math.round(marketPrices.gold.pricePerLuongVnd))}/lượng</span>
                          <span className="text-amber-400/50">· {formatMoney(Math.round(marketPrices.gold.pricePerGramVnd))}/gram</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {formType === "vehicle" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                    <input value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder="Hãng / dòng xe: Honda SH, Toyota Vios" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    <input value={formSerialNo} onChange={(e) => setFormSerialNo(e.target.value)} placeholder="Biển số / số khung" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                  </div>
                )}

                {formType === "stock" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                    <input value={formSymbol} onChange={(e) => setFormSymbol(e.target.value.toUpperCase())} placeholder="Mã CP: VNM, FPT, HPG" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                    <input value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder="Sàn / Cty CK: HOSE, SSI, VND" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="Nơi lưu giữ / vị trí" className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                  <textarea rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Ghi chú: tình trạng, người giữ, lưu ý bảo mật..." className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none" />
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5"><ImageIcon className="size-4 text-sky-400" /> Ảnh tài sản</p>
                      <p className="text-[10px] text-slate-500">Ảnh sẽ tự thu nhỏ cho nhẹ máy mà vẫn xem rõ.</p>
                    </div>
                    <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 text-sky-400 hover:bg-slate-700 ${imageProcessing ? "opacity-60 cursor-wait pointer-events-none" : "cursor-pointer"}`}>
                      <Upload className="size-4" /> {imageProcessing ? "Đang tối ưu..." : "Chụp / tải ảnh"}
                      <input type="file" accept="image/*,.heic,.heif" multiple onChange={handlePhotoFiles} disabled={imageProcessing} className="hidden" />
                    </label>
                  </div>
                  {formPhotos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {formPhotos.map(photo => (
                        <div key={photo.id} className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-square">
                          <img src={photo.thumbnailDataUrl} alt={photo.fileName} className="size-full object-cover" />
                          <button type="button" onClick={() => setFormPhotos(prev => prev.filter(p => p.id !== photo.id))} aria-label={`Xóa ảnh ${photo.fileName}`} className="absolute right-1 top-1 size-6 rounded-lg bg-slate-950/90 text-slate-400 hover:text-rose-400 flex items-center justify-center">
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-800 shrink-0">
                <button type="button" onClick={closeForm} disabled={imageProcessing} className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-bold disabled:opacity-50">
                  Đóng lại
                </button>
                <button type="submit" disabled={imageProcessing} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold disabled:opacity-50">
                  {editingAsset ? "Lưu thay đổi" : "Lưu tài sản"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {priceLogAsset && (
        <div onClick={closePriceLog} className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-50 p-4" id="asset-price-log-modal">
          <motion.div
            ref={priceLogRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-price-log-title"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <div className="min-w-0">
                <h3 id="asset-price-log-title" className="text-md font-bold text-slate-100 flex items-center gap-1.5"><LineChart className="size-5 text-sky-400" /> Cập nhật giá tài sản</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{priceLogAsset.name} · {assetTypeLabel(priceLogAsset.type)} · Giá mua {priceLogAsset.purchaseValue ? formatMoney(priceLogAsset.purchaseValue, priceLogAsset.currency) : "chưa nhập"}</p>
              </div>
              <button type="button" onClick={closePriceLog} disabled={priceLogSaving} aria-label="Đóng cập nhật giá" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center shrink-0 disabled:opacity-50">
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1 min-h-0">
              {priceLogError && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">{priceLogError}</div>}

              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-200">Giá thủ công tại thời điểm ghi</p>
                    <p className="text-[10px] text-slate-500">Nhập giá tại cửa hàng đã mua trực tiếp hoặc giá tham khảo của bạn.</p>
                  </div>
                  <div className="flex rounded-lg border border-slate-800 overflow-hidden text-[10px] font-semibold">
                    {isUnitPricedAsset(priceLogAsset) && assetPriceQuantity(priceLogAsset) > 0 && (
                      <button type="button" onClick={() => setPriceInputMode("unit")} className={`px-2.5 py-1.5 ${priceInputMode === "unit" ? "bg-sky-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-200"}`}>Theo {assetPriceUnit(priceLogAsset)}</button>
                    )}
                    <button type="button" onClick={() => setPriceInputMode("total")} className={`px-2.5 py-1.5 ${priceInputMode === "total" ? "bg-sky-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-slate-200"}`}>Tổng giá trị</button>
                  </div>
                </div>
                <div className="w-full">
                  <MoneyInput
                    value={priceInput || 0}
                    onChange={(val) => setPriceInput(val)}
                    placeholder="0"
                    currency={priceLogAsset.currency}
                    showZeroShortcuts={true}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">Tổng ghi nhận</span>
                  <span className="text-sky-300 font-bold tabular-nums">{formatMoney(priceLogTotal, priceLogAsset.currency)}</span>
                </div>
                {pricePreview.profitLoss !== null ? (
                  <div className={`rounded-lg border px-3 py-2 text-xs ${pricePreview.profitLoss >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Ước tính tại thời điểm này</span>
                      <span className={`font-bold tabular-nums ${pricePreview.profitLoss >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {pricePreview.profitLoss >= 0 ? "Lời " : "Lỗ "}{formatMoney(Math.abs(pricePreview.profitLoss), priceLogAsset.currency)} ({pricePreview.profitLossPct!.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-600">Nhập giá mua ban đầu để tính lời/lỗ. Nếu chưa có giá mua, nhật ký vẫn lưu giá tham khảo.</p>
                )}
                <textarea value={priceNote} onChange={(e) => setPriceNote(e.target.value)} rows={2} placeholder="Ghi chú: giá mua lại tại cửa hàng, tình trạng, nguồn báo giá..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none text-xs" />
                <p className="text-[10px] text-slate-600 leading-relaxed">Đây là công cụ theo dõi/tham khảo, không phải khuyến nghị đầu tư. Giá thực tế có thể khác theo thời điểm, cửa hàng, phí và điều kiện giao dịch.</p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5"><RefreshCw className="size-3.5 text-sky-400" /> Lịch sử giá</h4>
                  <span className="text-[10px] text-slate-600">{priceLogs.length} lần ghi</span>
                </div>
                {priceLogLoading ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Đang tải lịch sử...</p>
                ) : priceLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có log giá thủ công. Hãy lưu lần đầu ở phía trên.</p>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-[11px] tabular-nums min-w-[560px]">
                      <thead className="bg-slate-950/60 text-slate-500">
                        <tr>
                          <th className="text-left font-semibold px-3 py-2">Thời điểm</th>
                          <th className="text-right font-semibold px-3 py-2">Giá ghi nhận</th>
                          <th className="text-right font-semibold px-3 py-2">Lời/lỗ</th>
                          <th className="text-left font-semibold px-3 py-2">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceLogs.map(log => (
                          <tr key={log.id} className="border-t border-slate-800/70">
                            <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{new Date(log.recordedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</td>
                            <td className="px-3 py-2 text-right text-slate-200 font-semibold whitespace-nowrap">{formatMoney(log.price, log.currency)}{log.unitPrice ? <span className="block text-[10px] text-slate-600">{formatMoney(log.unitPrice, log.currency)}/{log.unit || "đơn vị"}</span> : null}</td>
                            <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${log.profitLoss === undefined ? "text-slate-600" : log.profitLoss >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                              {log.profitLoss === undefined ? "—" : `${log.profitLoss >= 0 ? "+" : "−"}${formatMoney(Math.abs(log.profitLoss), log.currency)}${log.profitLossPct !== undefined ? ` (${log.profitLossPct.toFixed(1)}%)` : ""}`}
                            </td>
                            <td className="px-3 py-2 text-slate-500 max-w-[190px] truncate" title={log.note || ""}>{log.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-800 shrink-0">
              <button type="button" onClick={closePriceLog} disabled={priceLogSaving} className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-bold disabled:opacity-50">Đóng lại</button>
              <button type="button" onClick={() => void handleSavePriceLog()} disabled={priceLogSaving || priceLogLoading || !onSaveAssetPriceLog} className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold disabled:opacity-50 flex items-center gap-1.5">
                <RefreshCw className={`size-3.5 ${priceLogSaving ? "animate-spin" : ""}`} /> {priceLogSaving ? "Đang lưu..." : "Lưu giá & nhật ký"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {selectedPhoto && (
        <div onClick={() => setSelectedPhoto(null)} className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4" id="asset-photo-viewer">
          <div ref={photoRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Xem ảnh tài sản" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col outline-none">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">{selectedPhoto.asset.name}</p>
                <p className="text-[11px] text-slate-500 tabular-nums">{selectedPhoto.photo.width}x{selectedPhoto.photo.height} • {selectedPhoto.photo.sizeKb}KB</p>
              </div>
              <button type="button" onClick={() => setSelectedPhoto(null)} aria-label="Đóng ảnh tài sản" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center shrink-0">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-slate-950 flex items-center justify-center p-3">
              <img src={selectedPhoto.photo.fullDataUrl} alt={selectedPhoto.photo.fileName} className="max-h-[72vh] max-w-full object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {showGoldPurityInfo && (
        <div onClick={() => setShowGoldPurityInfo(false)} className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4" id="gold-purity-info">
          <div ref={goldInfoRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col outline-none">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-100 flex items-center gap-1.5"><Gem className="size-4 text-amber-400" /> Bảng quy ước tuổi vàng</p>
              <button type="button" onClick={() => setShowGoldPurityInfo(false)} aria-label="Đóng" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center shrink-0">
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Giá trị vàng ước tính theo công thức: <span className="text-amber-400 font-semibold">trọng lượng × giá vàng 9999 × hệ số tuổi vàng</span>.
                Vàng tuổi cao gần đúng hàm lượng; tuổi thấp bị trừ thêm hao công và chênh lệch thu mua nên hệ số thấp hơn hàm lượng lý thuyết một chút (sát giá bán lại thực tế).
              </p>
              <table className="w-full text-[11px] tabular-nums">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left font-semibold py-1.5">Tuổi vàng</th>
                    <th className="text-right font-semibold py-1.5">Hàm lượng</th>
                    <th className="text-right font-semibold py-1.5">Hệ số</th>
                  </tr>
                </thead>
                <tbody>
                  {GOLD_PURITY_OPTIONS.map(o => (
                    <tr key={o.value} className="border-b border-slate-800/50">
                      <td className="py-1.5 text-slate-200">{o.label}</td>
                      <td className="py-1.5 text-right text-slate-500">{o.content}</td>
                      <td className="py-1.5 text-right font-bold text-amber-400">{o.factor.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Số liệu tham khảo thị trường (06/2026, vàng 9999 ~14.7tr/chỉ): 18K bán ~11tr, 14K ~8.3tr, 10K ~5.8tr/chỉ.
                Đây là ước lượng tương đối — bạn có thể nhập "Giá trị ước tính" thủ công để ghi đè.
              </p>
            </div>
          </div>
        </div>
      )}

      {sellingAsset && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-50 p-4" id="asset-sell-modal">
          <motion.div
            ref={sellRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                <HandCoins className="size-5 text-emerald-600 dark:text-emerald-400" /> Bán tài sản
              </h3>
              <button type="button" onClick={closeSell} disabled={selling} aria-label="Đóng" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center disabled:opacity-50">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4 flex-1 min-h-0 text-xs">
              {sellError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">{sellError}</div>
              )}

              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
                <p className="text-[11px] text-slate-500">Tài sản</p>
                <p className="text-sm font-bold text-slate-100 truncate">{sellingAsset.name}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Giá trị ước lượng hiện tại:{" "}
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">{sellEstimate > 0 ? formatMoney(sellEstimate, sellingAsset.currency) : "Chưa xác định"}</span>
                </p>
              </div>

              {/* Chọn cách định giá bán */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSellModeChange("estimate")}
                  disabled={sellEstimate <= 0}
                  className={`px-3 py-2.5 rounded-xl font-bold border transition-all ${sellMode === "estimate" ? "bg-emerald-500 text-slate-950 border-emerald-500" : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Theo giá ước lượng
                </button>
                <button
                  type="button"
                  onClick={() => handleSellModeChange("custom")}
                  className={`px-3 py-2.5 rounded-xl font-bold border transition-all ${sellMode === "custom" ? "bg-emerald-500 text-slate-950 border-emerald-500" : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"}`}
                >
                  Tự nhập giá
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Giá bán thực tế ({sellingAsset.currency})</label>
                <MoneyInput
                  value={sellPrice}
                  onChange={(val) => {
                    setSellMode("custom");
                    setSellPrice(val);
                  }}
                  currency={sellingAsset.currency}
                />
                {sellingAsset.currency === "USD" && sellPrice > 0 && (
                  <p className="text-[10px] text-slate-500">
                    ≈ {formatMoney(Math.round(sellPrice * (marketPrices?.usdVndRate || 25000)))} (quy đổi theo tỷ giá {(marketPrices?.usdVndRate || 25000).toLocaleString("vi-VN")}đ/USD)
                  </p>
                )}
                {(() => {
                  const purchase = Number(sellingAsset.purchaseValue || 0);
                  if (purchase <= 0 || sellPrice <= 0) return null;
                  const diff = sellPrice - purchase;
                  const up = diff >= 0;
                  const pct = (diff / purchase) * 100;
                  return (
                    <p className={`text-[10px] flex items-center gap-1 ${up ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      So với giá mua {formatMoney(purchase, sellingAsset.currency)}: {up ? "Lời" : "Lỗ"} {formatMoney(Math.abs(diff), sellingAsset.currency)} ({up ? "+" : "−"}{Math.abs(pct).toFixed(1)}%)
                    </p>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Tiền vào ví</label>
                  <FancySelect
                    value={sellAccount}
                    onChange={(v) => setSellAccount(v as AccountType)}
                    ariaLabel="Tiền vào ví"
                    options={SELL_ACCOUNTS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Ngày bán</label>
                  <DateInputDMY value={sellDate} onChange={setSellDate} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none font-mono" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Ghi chú (không bắt buộc)</label>
                <input value={sellNote} onChange={(e) => setSellNote(e.target.value)} placeholder="VD: bán cho người quen, đã nhận đủ tiền..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-emerald-500" />
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Khi xác nhận: hệ thống ghi một khoản <span className="text-emerald-700 dark:text-emerald-400 font-semibold">THU</span> với hạng mục "{ASSET_SALE_CATEGORY}" vào sổ thu chi, sau đó xóa tài sản này khỏi danh sách.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-800 shrink-0">
              <button type="button" onClick={closeSell} disabled={selling} className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-bold disabled:opacity-50">
                Hủy
              </button>
              <button type="button" onClick={handleConfirmSell} disabled={selling || sellPrice <= 0} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold disabled:opacity-50 flex items-center gap-1.5">
                <HandCoins className="size-4" /> {selling ? "Đang ghi nhận..." : "Xác nhận bán"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <GoldStoresModal
        isOpen={goldStoresModalOpen}
        onClose={closeGoldStoresModal}
        goldStores={goldStores}
        assets={assets}
        onRefresh={async () => {
          await fetchGoldStores();
          if (onRefreshData) await onRefreshData();
        }}
      />

      {ConfirmDialog}
    </div>
  );
}
