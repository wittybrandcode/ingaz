# خطة تحسين واجهة المهام الفرعية (SubtaskPage)

## نظرة عامة
تحسين صفحة المهمة الفرعية — Fixes UI, دمج Tiptap Editor مركزي، تحسين التعليقات وصورة الفائز، تطوير نظام المرفقات.

---

## المرحلة 1: إصلاح واجهة التعليقات والفائز
**الهدف:** تحسين المظهر البصري للتعليقات، إصلاح بادج الفائز، تلوين الحاوية

### المهام:
- [x] استيراد `<Avatar>` في Comments.tsx بدلاً من `<User>` icon اليدوي
- [x] إصلاح بادج الفائز: نقله خارج الفقاعة (`relative`) إلى الحاوية الخارجية مع `overflow-visible` ومسافة كافية
- [x] تلوين حاوية التعليق الفائز بالكامل (`bg-amber-50 border-2 border-amber-300`)
- [x] تحسين صندوق الإدخال: إضافة border محسن، focus ring، placeholder

### الملفات المتأثرة:
- `client/src/components/Comments.tsx`

---

## المرحلة 2: دمج Tiptap Editor في التعليقات
**الهدف:** استبدال textarea في التعليقات بـ TiptapEditor مع إمكانية إدراج الصور

### المهام:
- [ ] إضافة `@tiptap/extension-image` إلى package.json
- [ ] تحديث TiptapEditor.tsx: إضافة Image extension + زر رفع صورة في toolbar
- [ ] استبدال textarea في Comments.tsx بـ TiptapEditor
- [ ] تعديل `send()` لقراءة HTML من Tiptap بدلاً من `content.trim()`
- [ ] عرض HTML في فقاعة التعليق مع `sanitizeHTML` و `dangerouslySetInnerHTML`

### الملفات المتأثرة:
- `client/package.json`
- `client/src/components/TiptapEditor.tsx`
- `client/src/components/Comments.tsx`
- `client/src/lib/sanitize.ts` (تأكيد دعم HTML)

---

## المرحلة 3: دمج Tiptap في صناديق الوصف
**الهدف:** استخدام TiptapEditor مركزي في كل حقول الوصف

### المهام:
- [ ] SubtaskSettingsModal.tsx — استبدال textarea الوصف بـ TiptapEditor
- [ ] TaskSettingsModal.tsx — استبدال textarea الوصف بـ TiptapEditor
- [ ] ProjectSettingsModal.tsx — استبدال textarea الوصف بـ TiptapEditor
- [ ] SubtaskPage.tsx — جعل الوصف قابلاً للتعديل (زر تعديل → Tiptap)

### الملفات المتأثرة:
- `client/src/components/SubtaskSettingsModal.tsx`
- `client/src/components/TaskSettingsModal.tsx`
- `client/src/components/ProjectSettingsModal.tsx`
- `client/src/pages/SubtaskPage.tsx`

---

## المرحلة 4: دمج المرفقات + معرض الصور
**الهدف:** صندوق واحد للمرفقات مع عرض الصور في مودال وأزرار إجراءات

### المهام:
- [ ] دمج `<FileUpload>` و `<FilePreview>` في صندوق "المرفقات" واحد في SubtaskPage.tsx
- [ ] إخفاء `<FileUpload>` المنفصل، جعل زر الإرفاق داخل صندوق المرفقات
- [ ] تطوير `FilePreview.tsx` إلى مودال صور متكامل مع أزرار (قبول/رفض/ترشيح فائز)
- [ ] إضافة `onAccept`, `onReject`, `onSelectWinner` props إلى FilePreview

### الملفات المتأثرة:
- `client/src/pages/SubtaskPage.tsx`
- `client/src/components/FilePreview.tsx`
- `client/src/components/FileUpload.tsx`

---

## المرحلة 5: نظام المشاركات (اختياري — حسب الحاجة)
**الهدف:** تحويل التعليقات إلى "مشاركات" مع ردود داخلية وإجراءات

### المهام:
- [ ] إنشاء جدول `submissions` في schema
- [ ] إنشاء SubmissionService + routes
- [ ] إنشاء `Submissions.tsx` + `SubmissionCard.tsx` في client
- [ ] إعادة هيكلة `Comments.tsx` لتصبح ردوداً داخل المشاركات
- [ ] إضافة صلاحيات `submissions.*` في seed

### الملفات المتأثرة:
- `server/src/db/schema.ts`
- `server/src/services/SubmissionService.ts` (جديد)
- `server/src/routes/submissions.ts` (جديد)
- `client/src/components/Submissions.tsx` (جديد)
- `client/src/components/SubmissionCard.tsx` (جديد)

---

## التنفيذ

كل مرحلة تتبع هذا المسار:
```
typecheck (server + client) → اختبارات → commit (عند الطلب)
```

`cd server && npm run typecheck && npm run test`
`cd client && npm run typecheck`
