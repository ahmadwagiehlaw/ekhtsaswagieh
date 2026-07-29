import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import GlobalRollViewerModal from '../components/GlobalRollViewerModal';

const UIContext = createContext();

export function UIProvider({ children }) {
  // Toasts
  const [toasts, setToasts] = useState([]);
  
  // Modal State
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'alert', // 'alert' | 'confirm' | 'prompt'
    title: '',
    message: '',
    defaultValue: '',
    onConfirm: null,
    onCancel: null,
  });

  const [promptValue, setPromptValue] = useState('');
  const promptValueRef = useRef('');

  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Global Roll Viewer State
  const [rollViewer, setRollViewer] = useState({ isOpen: false, date: '' });

  const openRollViewer = useCallback((date) => {
    if (!date) {
      toast('تاريخ الجلسة غير متوفر', 'error');
      return;
    }
    setRollViewer({ isOpen: true, date });
  }, []);

  const closeRollViewer = useCallback(() => {
    setRollViewer({ isOpen: false, date: '' });
  }, []);

  // Toast Function
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Alert Function
  const showAlert = useCallback((title, message) => {
    setModal({
      isOpen: true,
      type: 'alert',
      title,
      message,
      onConfirm: () => setModal(prev => ({ ...prev, isOpen: false })),
      onCancel: null,
    });
  }, []);

  // Confirm Function
  const showConfirm = useCallback((title, message, confirmKey = '') => {
    return new Promise((resolve) => {
      if (confirmKey) {
        const disabled = JSON.parse(localStorage.getItem('disabledConfirms') || '[]');
        if (disabled.includes(confirmKey)) {
          resolve(true);
          return;
        }
      }
      setDontShowAgain(false);
      setModal({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        confirmKey,
        onConfirm: () => {
          setModal(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setModal(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  }, []);

  // Prompt Function
  const showPrompt = useCallback((title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      setPromptValue(defaultValue);
      promptValueRef.current = defaultValue;
      setModal({
        isOpen: true,
        type: 'prompt',
        title,
        message,
        defaultValue,
        onConfirm: () => {
          setModal(prev => ({ ...prev, isOpen: false }));
          resolve(promptValueRef.current);
        },
        onCancel: () => {
          setModal(prev => ({ ...prev, isOpen: false }));
          resolve(null);
        },
      });
    });
  }, []);

  return (
    <UIContext.Provider value={{ toast, showAlert, showConfirm, showPrompt, openRollViewer }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-top-5 fade-in duration-300 pointer-events-auto ${
            t.type === 'success' ? 'bg-emerald-500 border-emerald-600 text-white' :
            t.type === 'error' ? 'bg-rose-500 border-rose-600 text-white' :
            'bg-slate-800 border-slate-900 text-white'
          }`}>
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 opacity-80" />}
            {t.type === 'error' && <AlertTriangle className="w-5 h-5 opacity-80" />}
            {t.type === 'info' && <Info className="w-5 h-5 opacity-80" />}
            <p className="text-sm font-bold">{t.message}</p>
          </div>
        ))}
      </div>

      {/* Global Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6">
              <h3 className="text-lg font-black text-navy-900 mb-2">{modal.title}</h3>
              {modal.message && <p className="text-sm font-bold text-slate-500 mb-6">{modal.message}</p>}
              
              {modal.type === 'prompt' && (
                <input 
                  autoFocus
                  type="text" 
                  value={promptValue}
                  onChange={e => {
                    setPromptValue(e.target.value);
                    promptValueRef.current = e.target.value;
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 mb-6"
                />
              )}

              {modal.type === 'confirm' && modal.confirmKey && (
                <label className="flex items-center gap-2 mt-2 mb-6 select-none cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={e => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-500">عدم إظهار هذه الرسالة مرة أخرى</span>
                </label>
              )}

              <div className="flex gap-3 mt-2">
                {modal.type !== 'alert' && (
                  <button 
                    onClick={modal.onCancel}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
                  >
                    إلغاء
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (dontShowAgain && modal.confirmKey) {
                      const disabled = JSON.parse(localStorage.getItem('disabledConfirms') || '[]');
                      if (!disabled.includes(modal.confirmKey)) {
                        disabled.push(modal.confirmKey);
                        localStorage.setItem('disabledConfirms', JSON.stringify(disabled));
                      }
                    }
                    modal.onConfirm();
                  }}
                  className={`flex-1 font-bold py-3 rounded-xl transition text-sm text-white shadow-sm ${
                    modal.type === 'confirm' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-navy-900 hover:bg-navy-800'
                  }`}
                >
                  {modal.type === 'alert' ? 'حسناً' : 'تأكيد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Roll Viewer Modal */}
      <GlobalRollViewerModal 
        isOpen={rollViewer.isOpen}
        onClose={closeRollViewer}
        initialDate={rollViewer.date}
      />
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
