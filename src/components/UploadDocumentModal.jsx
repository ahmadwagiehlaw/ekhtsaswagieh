import React, { useState, useRef, useEffect } from 'react';
import { Camera, FileText, Upload, Plus, X, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { uploadToR2 } from '../lib/r2';
import imageCompression from 'browser-image-compression';

export default function UploadDocumentModal({ isOpen, onClose, caseData, onSuccess, initialDocType = '' }) {
  const { saveCaseToFirebase, currentUser, settings } = useAppContext();
  const { toast } = useUI();
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState(initialDocType);
  const [docTitle, setDocTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setDocType(initialDocType || 'مستندات أخرى');
      setDocTitle('');
      setSelectedFile(null);
      setIsUploading(false);
    }
  }, [isOpen, initialDocType]);

  // Paste Support
  useEffect(() => {
    const handlePaste = (e) => {
      if (!isOpen) return;
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            setSelectedFile(blob);
            if (!docTitle) setDocTitle('صورة ملصقة');
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, docTitle]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast('الرجاء اختيار ملف أو صورة', 'error');
      return;
    }

    if (!caseData || !caseData.id) {
      toast('خطأ: لم يتم العثور على بيانات الدعوى', 'error');
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
        type: docType || 'مستندات أخرى',
        title: docTitle.trim() !== '' ? docTitle.trim() : (docType || 'مستندات أخرى'),
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser || 'مجهول',
        originalName: newFileName
      };

      const documents = caseData.documents || [];
      const updatedDocs = [...documents, newDoc];
      
      const updatePayload = { documents: updatedDocs };
      
      const DEFAULT_CHECKLIST = [
        'صحيفة الطعن', 'تقرير مفوضين', 'مذكرة دفاع', 'مذكرة ختامية', 
        'تقرير الخبراء', 'تعجيل من الوقف', 'مذكرة تكميلية', 'مذكرة رأي',
        'حافظة مستندات', 'مسودة حكم', 'فتح باب مرافعة', 'محضر الجلسة',
        'مستندات الخصم', 'مذكرات الخصم'
      ];
      const checklist = settings?.paperFileChecklist || DEFAULT_CHECKLIST;
      
      if (checklist.includes(docType)) {
        const currentPaperFiles = caseData.paperFileContents || [];
        if (!currentPaperFiles.includes(docType)) {
          updatePayload.paperFileContents = [...currentPaperFiles, docType];
        }
      }

      await saveCaseToFirebase(caseData.id, updatePayload);

      toast('تم رفع المستند بنجاح!', 'success');
      if (onSuccess) onSuccess(newDoc);
      onClose();
    } catch (error) {
      console.error(error);
      toast('حدث خطأ أثناء رفع المستند', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-black text-navy-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              إرفاق مستند للإطلاع
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">يمكنك لصق صورة مباشرة (Ctrl+V)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="text-xs font-black text-slate-500 block mb-1.5">نوع المستند *</label>
            <input 
              type="text"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="مثال: محضر جلسة، عريضة دعوى..."
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-500 block mb-1.5">عنوان المستند أو ملاحظات</label>
            <input 
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="وصف إضافي للمستند..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {!selectedFile ? (
            <div className="mt-2">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Camera className="w-4 h-4 text-indigo-600" /> التقاط صورة
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <FileText className="w-4 h-4" /> اختيار ملف
                </button>
              </div>
              
              {/* Hidden Inputs */}
              <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFileChange} />
            </div>
          ) : (
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex justify-between items-center mt-2">
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-indigo-900 truncate max-w-[200px]">{selectedFile.name || 'ملف جاهز للرفع'}</p>
                <p className="text-xs font-bold text-indigo-500 mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button 
                onClick={() => setSelectedFile(null)}
                className="text-indigo-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-bold transition"
            disabled={isUploading}
          >
            إلغاء
          </button>
          <button 
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جاري الرفع...</>
            ) : (
              'رفع وإرفاق المستند'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
