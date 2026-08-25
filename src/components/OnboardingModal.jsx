import React, { useState, useEffect } from 'react';
import { Download, LayoutDashboard, Search, CalendarDays, Share, PlusCircle, CheckCircle2, ChevronRight, ChevronLeft, X, FileText, ClipboardList } from 'lucide-react';
import { useAppContext } from '../context/AppState';

export default function OnboardingModal() {
  const { isAdmin } = useAppContext();
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('ekhtsas_onboarding_v1');
    if (!hasSeenOnboarding) {
      // Delay showing slightly so it doesn't jarringly block the initial load
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isVisible) return null;

  const handleDismiss = () => {
    localStorage.setItem('ekhtsas_onboarding_v1', 'true');
    setIsVisible(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        handleDismiss();
      }
    }
  };

  const steps = [
    {
      id: 1,
      title: 'مرحباً بك في منصة اختصاصي 👋',
      desc: 'المساعد الذكي لإدارة الاختصاص  بكل سهولة واحترافية.',
      icon: <LayoutDashboard className="w-12 h-12 text-emerald-500" />,
      content: (
        <div className="space-y-4 text-right text-sm mt-4">
          <p className="font-bold text-slate-700 leading-relaxed">
            من خلال هذه المنصة، يمكنك:
          </p>
          <ul className="space-y-3 font-semibold text-slate-600">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> إدارة ملفات القضايا والأحكام ومتابعتها.</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> توزيع مهام الإطلاع وتصوير المستندات على الفريق.</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> استخراج تقارير شهرية ذكية وكشوف للجلسات بدقة.</li>
          </ul>
        </div>
      )
    },
    {
      id: 2,
      title: 'تعرف على الواجهة 🧭',
      desc: 'أدواتك الرئيسية في متناول يدك دائماً.',
      icon: <Search className="w-12 h-12 text-indigo-500" />,
      content: (
        <div className="space-y-3 mt-4">
          {isAdmin ? (
            <>
              <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start">
                <LayoutDashboard className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="text-right">
                  <p className="font-bold text-sm text-navy-900">لوحة التحكم (Dashboard)</p>
                  <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-1">تابع إحصائيات مكتبك بدقة: عدد الدعاوى، الأحكام، وتطور العمليات شهرياً مقارنة بالشهر السابق.</p>
                </div>
              </div>
              <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start">
                <FileText className="w-6 h-6 text-blue-600 shrink-0" />
                <div className="text-right">
                  <p className="font-bold text-sm text-navy-900">صفحة الملفات</p>
                  <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-1">الوصول السريع والبحث الذكي في جميع قضايا القسم وتعديلها.</p>
                </div>
              </div>
              <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start">
                <CalendarDays className="w-6 h-6 text-amber-500 shrink-0" />
                <div className="text-right">
                  <p className="font-bold text-sm text-navy-900">الأجندة</p>
                  <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-1">تنظيم ومتابعة رول الجلسات والأحكام بشكل يومي وشهري.</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start">
                <ClipboardList className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="text-right">
                  <p className="font-bold text-sm text-navy-900">الرئيسية (المهام والإحصائيات)</p>
                  <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-1">تجد هنا المهام المكلف بها يومياً مع ملخص سريع لأهم الإحصائيات.</p>
                </div>
              </div>
              <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start">
                <FileText className="w-6 h-6 text-blue-600 shrink-0" />
                <div className="text-right">
                  <p className="font-bold text-sm text-navy-900">صفحة الملفات</p>
                  <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-1">الوصول السريع والبحث في جميع قضايا القسم حسب الصلاحيات الممنوحة لك.</p>
                </div>
              </div>
              <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start">
                <CalendarDays className="w-6 h-6 text-amber-500 shrink-0" />
                <div className="text-right">
                  <p className="font-bold text-sm text-navy-900">الأجندة</p>
                  <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-1">متابعة رول الجلسات وتسجيل القرارات في يومها.</p>
                </div>
              </div>
            </>
          )}
        </div>
      )
    }
  ];

  // If the app is NOT standalone (not installed), add an installation step!
  if (!isStandalone) {
    steps.push({
      id: 3,
      title: 'تثبيت التطبيق على جهازك 📱',
      desc: 'للحصول على أفضل تجربة وسرعة وإشعارات، قم بتثبيت التطبيق على الشاشة الرئيسية.',
      icon: <Download className="w-12 h-12 text-blue-500" />,
      content: (
        <div className="space-y-4 mt-4 text-center">
          {isIOS ? (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 text-sm font-bold leading-relaxed space-y-4">
              <p>نظام الآيفون (iOS) يتطلب خطوة يدوية بسيطة لتثبيت التطبيق:</p>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg justify-start text-right">
                <span className="p-1 rounded shadow-sm bg-slate-100 shrink-0"><Share className="w-5 h-5 text-blue-600" /></span>
                <span>1. اضغط على زر المشاركة الموجود في متصفح سفاري أسفل أو أعلى الشاشة.</span>
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg justify-start text-right">
                <span className="p-1 rounded shadow-sm text-xl bg-slate-100 shrink-0 flex items-center justify-center w-7 h-7">➕</span>
                <span>2. قم بالتمرير لأسفل واختر "Add to Home Screen" أو "إضافة للصفحة الرئيسية".</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">
              <p className="mb-4 leading-relaxed">بضغطة زر واحدة سيتم تثبيت التطبيق وتظهر أيقونته بجوار تطبيقاتك الأخرى ليعمل بكفاءة وسرعة أعلى.</p>
              <button
                onClick={handleInstall}
                disabled={!deferredPrompt}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                <Download className="w-5 h-5" />
                {deferredPrompt ? 'تثبيت التطبيق الآن' : 'في انتظار تهيئة المتصفح للتثبيت...'}
              </button>
            </div>
          )}
        </div>
      )
    });
  }

  const currentStepData = steps[step - 1];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 relative">

        <button onClick={handleDismiss} className="absolute top-4 left-4 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-4 flex flex-col items-center text-center">
          <div className="bg-slate-50 p-4 rounded-full mb-4 ring-8 ring-white shadow-sm">
            {currentStepData.icon}
          </div>
          <h2 className="text-xl font-black text-navy-900 mb-2">{currentStepData.title}</h2>
          <p className="text-sm font-bold text-slate-500">{currentStepData.desc}</p>
        </div>

        <div className="px-8 pb-6 grow">
          {currentStepData.content}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="flex-1 border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-100 transition flex justify-center items-center gap-1">
                <ChevronRight className="w-4 h-4" /> السابق
              </button>
            )}
            {step < steps.length ? (
              <button onClick={() => setStep(s => s + 1)} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition flex justify-center items-center gap-1 shadow-sm">
                التالي <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleDismiss} className="flex-[2] bg-navy-900 hover:bg-navy-800 text-amber-300 font-bold py-3 rounded-xl transition flex justify-center items-center shadow-sm">
                ابدأ الاستخدام 🚀
              </button>
            )}
          </div>

          <button onClick={handleDismiss} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 py-1 transition mt-1">
            تخطي ولا تظهر هذا مجدداً
          </button>
        </div>

      </div>
    </div>
  );
}
