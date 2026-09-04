import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[22rem] p-6 rounded-2xl border border-rose-500/30 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-center max-w-xl mx-auto my-8 shadow-2xl">
          <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-400 mb-4 border border-rose-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">
            {this.props.fallbackTitle || "Đã xảy ra lỗi khi tải khu vực này"}
          </h2>
          <p className="text-xs text-slate-400 mb-4 max-w-md">
            Hệ thống vừa gặp sự cố trong quá trình hiển thị. Bạn có thể bấm tải lại hoặc quay về trang chính.
          </p>

          {this.state.error && (
            <div className="w-full text-left bg-slate-950 border border-slate-800/80 rounded-xl p-3 mb-5 font-mono text-[11px] text-rose-300/90 overflow-x-auto max-h-32">
              <span className="text-slate-500 select-none">$ </span>
              {this.state.error.toString()}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {this.props.onReset && (
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4 text-sky-400" />
                Về trang chính
              </button>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/20"
            >
              <RefreshCw className="w-4 h-4" />
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
