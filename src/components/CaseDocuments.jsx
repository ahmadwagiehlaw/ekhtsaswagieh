import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, Download, ExternalLink, FileBox, X, Plus, Camera, Edit3, Gavel, User, File as FileIcon } from 'lucide-react';
import { uploadToR2, deleteFromR2 } from '../lib/r2';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import imageCompression from 'browser-image-compression';

const DOCUMENT_TYPES = [
  'غلاف الملف',
  'ملف الدعوى',
  'مذكرة دفاع',
  'تقرير مفوضين',
  'حكم أول درجة',
  'تقرير خبراء',
  'منطوق الحكم',
  'مسودة الحكم',
  'إعلان',
  'تحريات',
  'حافظة مستندات'
];

const getDocTypeStyle = (type) => {
  if (!type) return { color: 'text-slate-600', bg: 'bg-slate-100', icon: FileIcon };
  if (type.includes('مذكرة') || type.includes('دفاع')) return { color: 'text-amber-600', bg: 'bg-amber-100', icon: FileText };
  if (type.includes('حكم') || type.includes('منطوق')) return { color: 'text-rose-600', bg: 'bg-rose-100', icon: Gavel };
  if (type.includes('مفوضين') || type.includes('خبراء') || type.includes('تقرير')) return { color: 'text-emerald-600', bg: 'bg-emerald-100', icon: FileBox };
  if (type.includes('إعلان')) return { color: 'text-blue-600', bg: 'bg-blue-100', icon: User };
  return { color: 'text-indigo-600', bg: 'bg-indigo-100', icon: FileText };
};

export default function CaseDocuments({ caseId, pastedFile, setPastedFile }) {
  const { cases, saveCaseToFirebase, currentUser, isAdmin } = useAppContext();
  const { toast, showConfirm } = useUI();

  const caseData = cases.find(c => c.id === caseId);
  const documents = caseData?.documents || [];

  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState('ملف الدعوى');
  const [docTitle, setDocTitle] = useState('');
  const [editingDoc, setEditingDoc] = useState(null);

  const closeModal = () => {
    setShowUploadModal(false);
    setEditingDoc(null);
    setSelectedFile(null);
    setDocTitle('');
    setDocType('ملف الدعوى');
  };

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setDocTitle(''); // Leave title empty as requested
    }
  };

  // Handle Ctrl+V Paste from Parent (CaseDetails)
  useEffect(() => {
    if (pastedFile) {
      setEditingDoc(null);
      setSelectedFile(pastedFile);
      setDocTitle('');
      setDocType('غلاف الملف');
      setShowUploadModal(true);
      setPastedFile(null); // Clear after handling
    }
  }, [pastedFile, setPastedFile]);

  const handleUpload = async () => {
    if (editingDoc) {
      try {
        const updatedDocs = documents.map(d => d.id === editingDoc.id ? { ...d, type: docType, title: docTitle.trim() !== '' ? docTitle.trim() : docType } : d);
        await saveCaseToFirebase(caseId, { documents: updatedDocs });
        toast('تم تحديث بيانات المستند بنجاح', 'success');
        closeModal();
      } catch (error) {
        toast('حدث خطأ أثناء تحديث المستند', 'error');
      }
      return;
    }

    if (!selectedFile) {
      toast('يرجى اختيار ملف أولاً', 'error');
      return;
    }

    setIsUploading(true);
    try {
      let fileToUpload = selectedFile;

      // Compress image if it's an image
      if (fileToUpload.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };
        fileToUpload = await imageCompression(fileToUpload, options);
      }

      const caseNum = caseData['رقم الدعوى'] || caseData['رقم القضية'] || '';
      const finalType = fileToUpload.type || selectedFile.type || '';
      const originalName = fileToUpload.name || selectedFile.name || 'document';
      const lastDotIndex = originalName.lastIndexOf('.');
      let extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';
      if (!extension || extension.length > 5) extension = finalType.startsWith('image/') ? '.jpg' : '.pdf';
      
      const safeDocType = docType.replace(/[\/\\?%*:|"<>\s]/g, '_');
      const newFileName = `${caseNum ? caseNum + '-' : ''}${safeDocType}_${Date.now()}${extension}`;
      fileToUpload = new File([fileToUpload], newFileName, { type: finalType });

      const url = await uploadToR2(fileToUpload, 'ekhtsasi-light-files');

      const newDoc = {
        id: Date.now().toString(),
        url,
        type: docType || 'مستند إضافي',
        title: docTitle.trim() !== '' ? docTitle.trim() : (docType || 'مستند إضافي'),
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser || 'مجهول',
        fileType: finalType.startsWith('image/') ? 'image' : 'pdf'
      };

      const updatedDocs = [...documents, newDoc];
      await saveCaseToFirebase(caseId, { documents: updatedDocs });

      toast('تم إضافة الملف بنجاح', 'success');
      setDocTitle('');
      setDocType('ملف الدعوى');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    } catch (error) {
      console.error("Upload error details:", error);
      toast(`حدث خطأ أثناء رفع الملف: ${error.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setIsUploading(false);
      closeModal();
    }
  };

  const handleDelete = async (doc) => {
    const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الملف نهائياً؟', 'delete_document');
    if (!confirmed) return;

    try {
      await deleteFromR2(doc.url, 'ekhtsasi-light-files');
      const updatedDocs = documents.filter(d => d.id !== doc.id);
      await saveCaseToFirebase(caseId, { documents: updatedDocs });
      toast('تم حذف الملف', 'info');
    } catch (error) {
      console.error(error);
      toast('حدث خطأ أثناء الحذف', 'error');
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 mx-4 sm:mx-0 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <FileBox className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-lg text-navy-900">أوراق الدعوى</h2>
            <p className="text-[11px] text-slate-500 font-bold">المستندات، المذكرات، وصور الملف</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { setShowUploadModal(true); setTimeout(() => cameraInputRef.current?.click(), 100); }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm border border-slate-200"
          >
            <Camera className="w-4 h-4 text-indigo-600" /> <span className="hidden sm:inline">تصوير</span>
          </button>
          <button
            onClick={() => { setShowUploadModal(true); setTimeout(() => fileInputRef.current?.click(), 100); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> رفع ملف
          </button>
        </div>
      </div>

      <div className="pt-2">
        {documents.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <FileBox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">لا توجد ملفات مرفوعة لهذه القضية بعد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {documents.map(doc => (
              <div key={doc.id} className="relative group rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col shadow-sm hover:shadow-lg transition duration-300">
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-md z-10 border border-white/10 shadow-sm">
                  {doc.type}
                </div>

                {/* Delete and Edit Buttons */}
                {isAdmin && (
                  <div className="absolute top-2 left-2 z-10 flex gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingDoc(doc); setDocType(doc.type || 'ملف الدعوى'); setDocTitle(doc.title || doc.type || ''); setShowUploadModal(true); }}
                      className="bg-blue-500 text-white p-1.5 rounded-lg transition hover:bg-blue-600 shadow-sm backdrop-blur-md"
                      title="تعديل بيانات الملف"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                      className="bg-rose-500 text-white p-1.5 rounded-lg transition hover:bg-rose-600 shadow-sm backdrop-blur-md"
                      title="حذف الملف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <a href={doc.url} target="_blank" rel="noreferrer" className="flex-1 bg-slate-200 relative block overflow-hidden aspect-[4/5]">
                  {doc.fileType === 'image' ? (
                    <img src={doc.url} alt={doc.title} className="w-full h-full object-cover group-hover:scale-110 transition duration-500 ease-out" />
                  ) : (
                    <div className={`w-full h-full flex flex-col items-center justify-center group-hover:scale-110 transition duration-500 ease-out ${getDocTypeStyle(doc.type).bg} ${getDocTypeStyle(doc.type).color}`}>
                      {React.createElement(getDocTypeStyle(doc.type).icon, { className: "w-16 h-16 opacity-70 mb-2" })}
                      <span className="text-xs font-black opacity-80 px-2 text-center truncate w-full">{doc.type}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition duration-300 flex items-center justify-center">
                    <ExternalLink className="text-white opacity-0 group-hover:opacity-100 w-8 h-8 drop-shadow-lg scale-50 group-hover:scale-100 transition duration-300" />
                  </div>
                </a>
                <div className="p-3 border-t border-slate-200 bg-white absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition duration-300">
                  <h4 className="font-black text-sm text-navy-900 truncate" title={doc.title}>{doc.title}</h4>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">بواسطة: {doc.uploadedBy}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="font-black text-lg text-navy-900">{editingDoc ? 'تعديل بيانات المستند' : 'رفع مستند جديد'}</h2>
              <button onClick={closeModal} className="p-2 text-slate-400 hover:text-rose-500 rounded-xl transition bg-white border border-slate-200 shadow-sm">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {!editingDoc && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-navy-900">الملف (صورة أو PDF)</label>
                  
                  {/* Hidden inputs */}
                  <input
                    type="file"
                    ref={cameraInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,.pdf"
                    className="hidden"
                  />

                  {!selectedFile ? (
                    <div className="flex gap-3">
                      <button onClick={() => cameraInputRef.current?.click()} className="flex-1 bg-white hover:bg-slate-50 text-slate-700 py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 transition">
                        <Camera className="w-6 h-6 text-indigo-500" />
                        <span className="text-xs">تصوير ورقة</span>
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white hover:bg-slate-50 text-slate-700 py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 transition">
                        <Upload className="w-6 h-6 text-indigo-500" />
                        <span className="text-xs">رفع ملف</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileBox className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-700 truncate">{selectedFile.name}</span>
                      </div>
                      <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-rose-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-navy-900">تصنيف المستند</label>
                {DOCUMENT_TYPES.includes(docType) || docType === 'ملف الدعوى' ? (
                  <select
                    value={docType}
                    onChange={e => {
                      if (e.target.value === 'أخرى...') {
                        setDocType('');
                      } else {
                        setDocType(e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  >
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    <option value="أخرى...">أخرى... (إضافة تصنيف جديد)</option>
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      value={docType}
                      onChange={e => setDocType(e.target.value)}
                      placeholder="اكتب اسم التصنيف الجديد هنا..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10"
                    />
                    <button 
                      onClick={() => setDocType('ملف الدعوى')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                      title="إلغاء والعودة للقائمة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-navy-900">عنوان المستند (اختياري)</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="مثال: صورة غلاف الملف الخارجي"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-navy-900"
                />
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || (!editingDoc && !selectedFile)}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUploading ? (editingDoc ? 'جاري الحفظ...' : 'جاري الرفع...') : (editingDoc ? 'حفظ التعديلات' : 'رفع المستند')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
