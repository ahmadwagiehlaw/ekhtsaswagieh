import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppState';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { Users, Fingerprint, Trash2 } from 'lucide-react';
import { firebaseConfig, USERS_DIRECTORY_REF } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function SettingsUsersTab() {
  const { settings, saveSettingsToFirebase } = useAppContext();
  const { userData } = useAuth();
  const { toast } = useUI();

  const [localEmployees, setLocalEmployees] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setLocalEmployees(settings?.employees || []);
  }, [settings]);

  const handleSaveUsers = async () => {
    // Validate employees before processing
    for (const emp of localEmployees) {
      if (emp.password && emp.password.length > 0 && emp.password.length < 6) {
        toast(`كلمة المرور للموظف "${emp.name || emp.username}" يجب أن تكون 6 أحرف/أرقام على الأقل`, 'error');
        return; // Stop saving
      }
    }

    setIsProcessing(true);

    // Create accounts for new employees
    if (userData?.tenantId) {
      for (const emp of localEmployees) {
        if (!emp.username || !emp.password) continue;

        try {
          const safeTenantId = userData.tenantId.replace(/_/g, '-').trim();
          const email = `${emp.username.toLowerCase().trim()}@${safeTenantId}.ekhtsas.local`;

          const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              password: emp.password,
              returnSecureToken: false
            })
          });

          const data = await response.json();
          if (response.ok && data.localId) {
            // Write employee role to directory
            await setDoc(doc(USERS_DIRECTORY_REF, data.localId), {
              email: email,
              role: 'employee',
              tenantId: userData.tenantId,
              name: emp.name
            });
          } else if (!response.ok) {
            if (data.error?.message === 'EMAIL_EXISTS') {
              // Attempt to update password if changed
              const oldEmp = settings?.employees?.find(e => e.username.toLowerCase() === emp.username.toLowerCase());
              if (oldEmp && oldEmp.password !== emp.password) {
                try {
                  const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: oldEmp.password, returnSecureToken: true })
                  });
                  const signInData = await signInRes.json();

                  if (signInRes.ok && signInData.idToken) {
                    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ idToken: signInData.idToken, password: emp.password, returnSecureToken: false })
                    });
                  }
                } catch (err) {
                  console.error("Failed to update employee password", err);
                }
              }
            } else {
              console.error("Firebase Auth Error for employee:", data.error?.message);
              toast(`تعذر إنشاء/تحديث حساب للموظف ${emp.username}: ${data.error?.message || 'خطأ غير معروف'}`, 'error');
            }
          }
        } catch (error) {
          console.error("Error provisioning employee:", error);
          toast(`فشل الاتصال لإنشاء حساب الموظف ${emp.username}`, 'error');
        }
      }
    }

    await saveSettingsToFirebase({
      ...settings,
      employees: localEmployees,
    });
    setIsProcessing(false);
    toast('تم حفظ إعدادات المستخدمين بنجاح', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h3 className="font-black text-sm text-navy-900">إدارة المستخدمين والموظفين</h3>
          </div>
          {userData?.tenantId && (
            <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-2">
              <Fingerprint className="w-4 h-4" />
              <span className="text-[10px] font-black">رقم اشتراك القسم:</span>
              <span className="text-sm font-mono font-black tracking-wider">{userData.tenantId}</span>
            </div>
          )}
        </div>

        <div className="pt-2 space-y-4">
          <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
            يستخدم الموظف اسم المستخدم وكلمة المرور لتسجيل الدخول (Username). يفضل أن يكون اسم المستخدم "بدون مسافات" و "بالحروف الإنجليزية" لتسهيل الدخول.
          </p>

          <div className="space-y-3">
            {localEmployees.map((emp, index) => {
              const empPerms = emp.permissions || { canEditData: true, canDeleteData: true, canManageRolls: true, canManageTasks: true };
              return (
                <div key={index} className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <input type="text" placeholder="الاسم" value={emp.name} onChange={e => {
                      const newEmp = [...localEmployees];
                      newEmp[index].name = e.target.value;
                      setLocalEmployees(newEmp);
                    }} className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto" />

                    <input type="text" placeholder="اسم الدخول (مثال: omar)" value={emp.username || ''} onChange={e => {
                      const newEmp = [...localEmployees];
                      newEmp[index].username = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setLocalEmployees(newEmp);
                    }} className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto bg-slate-50" dir="ltr" />

                    <input
                      type="text"
                      list="jobTitlesList"
                      placeholder="المسمى (مثال: محامي)"
                      value={emp.jobTitle || ''}
                      onChange={e => {
                        const newEmp = [...localEmployees];
                        newEmp[index].jobTitle = e.target.value;
                        setLocalEmployees(newEmp);
                      }}
                      className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto bg-white"
                    />
                    <datalist id="jobTitlesList">
                      <option value="محامي" />
                      <option value="سكرتير إداري" />
                      <option value="متدرب" />
                      <option value="باحث" />
                      <option value="مندوب" />
                    </datalist>

                    <input type="text" placeholder="كلمة المرور" value={emp.password} onChange={e => {
                      const newEmp = [...localEmployees];
                      newEmp[index].password = e.target.value;
                      setLocalEmployees(newEmp);
                    }} className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto" />

                    <button onClick={() => setLocalEmployees(localEmployees.filter((_, idx) => idx !== index))} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-1 p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer hover:text-navy-900 transition">
                      <input type="checkbox" checked={empPerms.canEditData} onChange={e => {
                        const newEmp = [...localEmployees];
                        newEmp[index].permissions = { ...empPerms, canEditData: e.target.checked };
                        setLocalEmployees(newEmp);
                      }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      تعديل وإضافة القضايا والإجراءات
                    </label>

                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer hover:text-rose-600 transition">
                      <input type="checkbox" checked={empPerms.canDeleteData} onChange={e => {
                        const newEmp = [...localEmployees];
                        newEmp[index].permissions = { ...empPerms, canDeleteData: e.target.checked };
                        setLocalEmployees(newEmp);
                      }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      حذف أي بيانات
                    </label>

                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer hover:text-navy-900 transition">
                      <input type="checkbox" checked={empPerms.canManageRolls} onChange={e => {
                        const newEmp = [...localEmployees];
                        newEmp[index].permissions = { ...empPerms, canManageRolls: e.target.checked };
                        setLocalEmployees(newEmp);
                      }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      إدارة الرول الأجندة
                    </label>

                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer hover:text-navy-900 transition">
                      <input type="checkbox" checked={empPerms.canManageTasks} onChange={e => {
                        const newEmp = [...localEmployees];
                        newEmp[index].permissions = { ...empPerms, canManageTasks: e.target.checked };
                        setLocalEmployees(newEmp);
                      }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      إدارة المهام القسمية
                    </label>
                  </div>
                </div>
              );
            })}

            <button onClick={() => setLocalEmployees([...localEmployees, { name: '', username: '', password: '', permissions: { canEditData: true, canDeleteData: true, canManageRolls: true, canManageTasks: true } }])} className="w-full bg-slate-50 border border-slate-200 text-slate-600 font-bold py-3 rounded-xl shadow-sm text-sm hover:bg-slate-100 transition">
              + إضافة موظف جديد
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button onClick={handleSaveUsers} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm hover:bg-navy-800 transition disabled:opacity-50">
              {isProcessing ? 'جاري الحفظ...' : 'حفظ إعدادات المستخدمين'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
