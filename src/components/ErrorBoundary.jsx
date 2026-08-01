import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full border border-slate-100 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">عذراً، حدث خطأ غير متوقع!</h2>
            <p className="text-sm font-bold text-slate-500 mb-6 leading-relaxed">
              لقد واجه التطبيق مشكلة تقنية أثناء عرض هذه الصفحة. يرجى إعادة تحميل الصفحة للمحاولة مرة أخرى.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-5 h-5" />
              إعادة تحميل التطبيق
            </button>
            <div className="mt-4 p-3 bg-slate-50 rounded-xl text-left overflow-hidden">
              <p className="text-[10px] font-mono text-slate-400 truncate" dir="ltr">
                {this.state.error?.toString()}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
