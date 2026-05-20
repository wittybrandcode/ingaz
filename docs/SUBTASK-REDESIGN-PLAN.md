# SubtaskPage Redesign — خطة إعادة تصميم صفحة المهمة الفرعية

## 🎯 الهدف
إعادة هيكلة صفحة المهمة الفرعية كاملة وفق التصميم التالي:

```
┌────────────────────────────────────────────┐
│  [Breadcrumb: Project → Task → Subtask]    │
│                                            │
│  السطر 1:  العنوان (h1)                    │
│  السطر 2:  المهمة ← المشروع المصدر         │
│  السطر 3:  [Avatar] المكلفون               │
│  السطر 4:  الوصف الكامل (Tiptap HTML)      │
│  السطر 5:  [Status Badge]  ←→  [رفع ملفات] │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │  المرفقات (معرض الصور والملفات)    │    │
│  │  [img][img][img][pdf][doc]         │    │
│  └────────────────────────────────────┘    │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │  المشاركات                          │    │
│  │  ┌──────────────────────────────┐  │    │
│  │  │ [🏆] مشاركة فائزة            │  │    │
│  │  │ [Avatar] الاسم               │  │    │
│  │  │  فقاعة المحتوى               │  │    │
│  │  │  [img attachments in post]   │  │    │
│  │  └──────────────────────────────┘  │    │
│  │  ┌──────────────────────────────┐  │    │
│  │  │ [Avatar] اسم                 │  │    │
│  │  │  فقاعة المحتوى               │  │    │
│  │  └──────────────────────────────┘  │    │
│  │  ┌──────────────────────────────┐  │    │
│  │  │  [Tiptap form]  [➤]         │  │    │
│  │  └──────────────────────────────┘  │    │
│  └────────────────────────────────────┘    │
└────────────────────────────────────────────┘
```

---

## 🗂 Phase 1: إعادة هيكلة SubtaskPage (5 أسطر)

### السطر 1: العنوان
- `<h1>` كبير
- أسفله breadcrumb موجود مسبقاً

### السطر 2: المهمة ← المشروع
```
subtask.task.title  ←  subtask.task.project_title
```
- ربط تشعبي للمشروع
- مع أيقونة السهم (`ArrowRight`)

### السطر 3: المكلفون (Assignees)
```
[Avatar] Name    [Avatar] Name    ...
```
- كل مكلّف: `Avatar` + اسمه
- عرض أفقي مع `flex flex-wrap gap-3`

### السطر 4: الوصف الكامل
- عرض HTML عبر `sanitizeHTML` + `dangerouslySetInnerHTML`
- نفس تصميم المقال: `prose prose-lg max-w-none` مع خلفية `bg-gray-50`
- إذا الوصف فارغ → يختفي القسم بالكامل

### السطر 5: شريط المعلومات
```
[Status Badge]  ←  (مرن)  →  [Upload Trigger Button]
```
- جهة اليمين: حالة المهمة مع الأيقونة (منفذة/ملغية/مؤجلة/مفتوحة)
- جهة اليسار: زر رفع الملفات (أيقونة `Paperclip` فقط بدون نصوص)، يظهر فقط لـ:
  - ADMIN أو DEPUTY
  - أو مدير المشروع (isProjectManager)
  - أو المكلف بالمهمة (assigned_to أو assignee)
- الزر يفتح `FileUpload` المدمج

### الملفات المتأثرة
- `client/src/pages/SubtaskPage.tsx`

---

## 🖼 Phase 2: معرض المرفقات (Attachments Gallery)

### الاقتراح: Grid ثنائي الأبعاد مع معاينة
```
┌────────────────────────────────────────────┐
│  📎 المرفقات (5)           [إرفاق ملفات]   │
│                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ صورة  │ │ صورة  │ │ صورة  │ │ صورة  │      │
│  │      │ │      │ │      │ │      │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│  ┌──────────┐ ┌──────────┐                │
│  │ 📄 report│ │ 📊 data  │                │
│  │  2.3 MB  │ │  1.1 MB  │                │
│  └──────────┘ └──────────┘                │
└────────────────────────────────────────────┘
```

### التفاصيل
- **صور**: `w-28 h-28 object-cover rounded-lg` مع hover zoom طفيف
- **ملفات غير صور**: أيقونة + اسم + حجم، `min-w-[140px]`
- **النقر على صورة** → `FilePreview` modal (مودال عرض الصور)
- **النقر على ملف غير صورة** → `FilePreview` modal مع زر تحميل
- **عدد المرفقات** يظهر في العنوان
- زر **إرفاق ملفات** في أعلى اليمين (داخل نفس الحاوية)
- يستخدم `FileUpload` الموجود لكن مضمن داخل الحاوية

### الملفات المتأثرة
- `client/src/components/FileUpload.tsx` — تحديث مظهر الشبكة
- `client/src/pages/SubtaskPage.tsx` — دمج FileUpload في حاوية المرفقات

---

## 💬 Phase 3: حاوية المشاركات (Posts Container)

### هيكل المشاركة الواحدة
```
┌─────────────────────────────────────────┐
│  [🏆]  ← بادج الفائز (فوق الحاوية)     │  Winner Card
│  ┌─────────────────────────────────┐    │
│  │ [Avatar]  اسم العضو            │    │  Header row
│  │                                 │    │
│  │  فقاعة المحتوى (Tiptap HTML)    │    │  Content
│  │  مع الصور المضمنة               │    │
│  │                                 │    │
│  │  ┌──┐ ┌──┐ ┌──┐                │    │  Attachments
│  │  │img│ │img│ │📄│                │    │  in post
│  │  └──┘ └──┘ └──┘                │    │
│  │                                 │    │
│  │  منذ 5 د  [ترشيح كفائز]         │    │  Footer
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### الميزات
- **كامل العرض** (`max-w-full`) — عكس السابق `max-w-[85%]`
- كل مشاركة تحتوي على `Header (Avatar + Name)` + `Content` + `Attachments` + `Footer (time + actions)`
- **بادج الفائز**: `absolute -top-2 right-3 z-10` (غير مقصوص)
- حاوية الفائز: `bg-amber-50 border-2 border-amber-300 rounded-xl p-3`
- إخفاء زر "ترشيح كفائز" بعد اختيار الفائز

### معرض الملفات داخل المشاركة
```
إذا كان الملف:
├── صورة (image/*)     → مصغرة w-16 h-16, النقر → FilePreview modal (بنفس مودال الصور)
├── صوت (audio/*)      → أيقونة + اسم, النقر → AudioPlayer modal
└── ملف آخر            → أيقونة + اسم + حجم, النقر → Download modal/رابط
```

#### AudioPlayer Modal
- `fixed inset-0 z-50 bg-black/70` (نفس نمط FilePreview)
- `<audio controls>` مع `src="/uploads/{filename}"`
- اسم الملف + زر تحميل + زر إغلاق
- لوحة تحكم HTML5 audio

### إخفاء الفورم بعد اختيار الفائز
- إذا `subtask.winner_comment_id` موجود → الفورم مخفي + أيقونة قفل + رسالة "تم إغلاق المشاركات"
- مع إظهار `subtask.status` كـ "منفذة"

### الملفات المتأثرة
- `client/src/components/Comments.tsx` — إعادة هيكلة كبيرة
- `client/src/components/FilePreview.tsx` — إضافة دعم audio
- `client/src/components/AudioPreview.tsx` **(جديد)** — مودال تشغيل الصوت
- `client/src/pages/SubtaskPage.tsx` — تمرير `winner_comment_id`

---

## ✍️ Phase 4: فورم المشاركة (Tiptap)

### التصميم المبسط
```
┌─────────────────────────────────────────────┐
│  [Tiptap Editor — سطر واحد فقط]   [🔘 إرسال] │
└─────────────────────────────────────────────┘
```

### التغييرات
- **Tiptap Editor**: `min-h-[40px]` فقط (ليس `min-h-[120px]`) — بارتفاع سطر واحد، يتمدد مع المحتوى
- **شريط الأدوات**: مخفى تماماً (لا Bold, لا Italic, لا أدوات) — مجرد كتابة نص + إدراج صور
- **زر الإرسال**: `rounded-full` (مدور) + أيقونة `Send` + إرسال
- **رفع الصور**: يتم عبر آلية `handleImageUpload` في TiptapEditor لكن الملفات تُرفع إلى السيرفر بـ `entity_type=comment&entity_id={commentId}` (وليس subtask)
  - هذا يتطلب تغيير في الخلفية: إضافة `comment` إلى `uploadSchema.entity_type`
  - أو رفع الصور أولاً إلى subtask، ثم ربطها مع التعليق عند الإنشاء

### مشكلة رفع الصور للمشاركة
الحل المقترح: مبدئياً نرفع الصور إلى subtask كما هو معمول حالياً. لاحقاً يمكن إضافة منطق ربط الصور بالتعليق. التركيز الآن على الـ UI.

### إخفاء الفورم عند إغلاق المشاركات
```tsx
{subtask.winner_comment_id ? (
  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-500">
    <Lock className="w-4 h-4 text-gray-400" />
    تم إغلاق المشاركات — تم ترشيح فائز
  </div>
) : (
  <div className="flex gap-2 items-start">
    <TiptapEditor ... />
    <button className="rounded-full ...">
      <Send className="w-4 h-4" />
    </button>
  </div>
)}
```

### الملفات المتأثرة
- `client/src/components/Comments.tsx` — فورم جديد، زر مدور، إخفاء
- `client/src/components/TiptapEditor.tsx` — إضافة `minimal` prop لإخفاء toolbar
- `server/src/validation.ts` — إضافة `'comment'` إلى `uploadSchema.entity_type`

---

## 🎵 Phase 5: AudioPreview Component

### ملف جديد: `client/src/components/AudioPreview.tsx`
```tsx
interface Props {
  file: { filename: string; original_name: string }
  onClose: () => void
}
```

- مودال بنفس نمط `FilePreview`
- `<audio controls className="w-full">` مع `src="/uploads/{filename}"`
- زر تحميل: `<a download>`
- اسم الملف + الحجم (يُمرر أو يُستخرج)
- إغلاق بـ Escape أو النقر خارجياً

### الملفات المتأثرة
- `client/src/components/AudioPreview.tsx` (جديد)

---

## ⚙️ Phase 6: تغييرات الخلفية (Backend)

### 1. توسيع `uploadSchema.entity_type`
**الملف**: `server/src/validation.ts`
```
z.enum(['project', 'task', 'subtask', 'comment'])
```

### 2. إضافة حقل `comment_id` إلى جدول المرفقات (اختياري)
- `comment_id INTEGER REFERENCES comments(id)`
- أو استخدام `entity_type='comment'` + `entity_id=commentId`

### 3. إضافة `winner_comment_id` إلى استجابة Subtask
- مطلوب في الـ client لتحديد إذا كانت المشاركات مغلقة

### الملفات المتأثرة
- `server/src/validation.ts`
- `server/src/db/schema.ts` (اختياري)
- `server/src/services/SubtaskService.ts`

---

## 📂 هيكل الملفات النهائي

```
client/src/
├── components/
│   ├── SubtaskHeader.tsx          (جديد — السطور 1-5)
│   ├── SubtaskAttachments.tsx     (جديد — معرض المرفقات)
│   ├── Comments.tsx               (معدل — مشاركات + AudioModal)
│   ├── FilePreview.tsx            (معدل — لا تغيير كبير)
│   ├── AudioPreview.tsx           (جديد — مودال الصوت)
│   ├── FileUpload.tsx             (معدل — تحسين الشبكة)
│   └── TiptapEditor.tsx           (معدل — وضع minimal)
└── pages/
    └── SubtaskPage.tsx            (معدل — هيكل 5 أسطر)
```

---

## ✅ مراحل التنفيذ

| المرحلة | الوصف | الملفات | الأولوية |
|---------|-------|---------|----------|
| **1** | إعادة هيكلة SubtaskPage (5 أسطر) | `SubtaskPage.tsx` | عالية |
| **2** | تحسين معرض المرفقات | `FileUpload.tsx`, `SubtaskPage.tsx` | عالية |
| **3** | إعادة هيكلة المشاركات (كامل العرض + مرفقات) | `Comments.tsx`, `SubtaskPage.tsx` | عالية |
| **4** | فورم Tiptap المبسط (مخفي عند الإغلاق + زر مدور) | `Comments.tsx`, `TiptapEditor.tsx` | عالية |
| **5** | AudioPreview modal | `AudioPreview.tsx` (جديد) | متوسطة |
| **6** | توسيع `entity_type` للخلفية | `validation.ts` | متوسطة |

---

## 🔄 التنفيذ

كل مرحلة:
1. `cd server && npx tsc --noEmit`
2. `cd client && npx tsc --noEmit`
3. اختبار يدوي
4. commit (عند الطلب)
