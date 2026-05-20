# المرحلة 4 — إمكانية الوصول (Accessibility)

**الهدف:** جعل التطبيق متاحاً لمستخدمي لوحة المفاتيح وقارئات الشاشة (WCAG 2.1 AA).

**المدة المقدرة:** ~6 ساعات

**الأولوية:** 🟡 متوسطة — تحسين نوعية الحياة للمستخدمين ذوي الاحتياجات الخاصة

---

## 4.1 إضافة aria-label إلى أزرار الأيقونات

| الحقل | القيمة |
|-------|--------|
| **المعرف** | A1 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | أزرار أيقونات في `SubtaskRow` و `SubtaskCard` و `ProjectCard` و `TaskCard` بدون `aria-label`. قارئات الشاشة لا تستطيع وصفها. |
| **الحل** | إضافة `aria-label` وصفي لكل زر أيقونة: `aria-label="حذف المهمة"`, `aria-label="تعديل"`, إلخ. |
| **الجهد** | 1 ساعة |
| **الملفات** | `client/src/components/SubtaskRow.tsx`, `SubtaskCard.tsx`, `ProjectCard.tsx`, `TaskCard.tsx` |
| **خطوات التنفيذ** | 1. تحديد جميع الأزرار التي تحتوي على `<Icon />` فقط بدون نص<br>2. إضافة `aria-label` لكل منها |

---

## 4.2 إضافة Keyboard Navigation إلى AssigneePicker

| الحقل | القيمة |
|-------|--------|
| **المعرف** | A2 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | `AssigneePicker.tsx` — dropdown غير قابل للملاحة بلوحة المفاتيح. لا `tabIndex`، لا معالجة `Enter`/`Escape`/`ArrowDown`/`ArrowUp`. |
| **الحل** | إضافة keyboard handlers للتنقل في القائمة: ArrowDown/ArrowUp للتحرك، Enter للاختيار، Escape للإغلاق. |
| **الجهد** | 1 ساعة |
| **الملفات** | `client/src/components/AssigneePicker.tsx` |
| **خطوات التنفيذ** | 1. إضافة `tabIndex={0}`<br>2. إضافة `onKeyDown` مع معالجة ArrowUp/ArrowDown/Enter/Escape<br>3. إضافة `role="listbox"` و `aria-activedescendant` |

---

## 4.3 إضافة Focus Indicators (focus-visible)

| الحقل | القيمة |
|-------|--------|
| **المعرف** | A3 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | Tailwind يزيل `outline` الافتراضي. لا `focus-visible` styles على الأزرار المخصصة. مستخدم لوحة المفاتيح لا يرى أين التركيز. |
| **الحل** | إضافة `focus-visible:ring-2 focus-visible:ring-blue-500` إلى الأزرار والعناصر التفاعلية. |
| **الجهد** | 30 دقيقة |
| **الملفات** | `client/src/index.css` (global style) أو Tailwind config |
| **خطوات التنفيذ** | 1. إضافة قاعدة global: `*:focus-visible { @apply ring-2 ring-blue-500; }` |

---

## 4.4 إضافة ARIA roles و attributes للمودالات

| الحقل | القيمة |
|-------|--------|
| **المعرف** | AX2 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | المودالات (DetailModal, ProjectSettingsModal, TaskSettingsModal, NotificationBell) بدون `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. |
| **الحل** | إضافة `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing إلى عنوان المودال، و `aria-describedby` إن أمكن. |
| **الجهد** | 1 ساعة |
| **الملفات** | جميع مكونات المودال |
| **خطوات التنفيذ** | 1. إضافة `role="dialog"` و `aria-modal="true"` إلى حاوية المودال<br>2. إضافة `id` إلى عنوان المودال و `aria-labelledby` |

---

## 4.5 إضافة Focus Trapping إلى جميع المودالات

| الحقل | القيمة |
|-------|--------|
| **المعرف** | AX1 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | Tab يسمح بخروج التركيز إلى خلفية الصفحة في جميع المودالات. مستخدمي لوحة المفاتيح لا يستطيعون استخدام المودالات. |
| **الحل** | تطبيق focus trapping (Tab/Shift+Tab محصور داخل المودال). إعادة التركيز إلى العنصر الذي فتح المودال عند الإغلاق. |
| **الجهد** | 2 ساعات |
| **الملفات** | جميع مكونات المودال |
| **خطوات التنفيذ** | 1. تثبيت `focus-trap-react` أو تطبيق FocusTrap يدوي<br>2. لف محتوى كل مودال بـ `<FocusTrap>`<br>3. حفظ `document.activeElement` قبل الفتح وإعادة التركيز عنده عند الإغلاق |

---

## 4.6 إعلان Toast لقارئات الشاشة

| الحقل | القيمة |
|-------|--------|
| **المعرف** | AX3 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `Toast.tsx:34-41` — Toast notifications بدون `role="alert"` أو `aria-live="polite"`. قارئات الشاشة لا تعلن عنها. |
| **الحل** | إضافة `role="alert"` أو `aria-live="polite"` إلى حاوية الـ Toast. |
| **الجهد** | 15 دقيقة |
| **الملفات** | `client/src/components/Toast.tsx` |
| **خطوات التنفيذ** | 1. إضافة `role="alert"` و `aria-live="polite"` إلى حاوية Toast |

---

## 4.7 إضافة aria-label للروابط في TopBar

| الحقل | القيمة |
|-------|--------|
| **المعرف** | AX5 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `TopBar.tsx` — أيقونات وروابط بدون `aria-label` أو نص وصفي. |
| **الحل** | إضافة `aria-label` لكل رابط/أيقونة في الـ TopBar |
| **الجهد** | 15 دقيقة |
| **الملفات** | `client/src/components/TopBar.tsx` |

---

## 4.8 Hamburger Menu للموبايل

| الحقل | القيمة |
|-------|--------|
| **المعرف** | A4 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `TopBar.tsx` — عناصر الـ nav تفيض على الشاشات الصغيرة (عرض < 768px). لا hamburger menu. |
| **الحل** | إضافة hamburger menu للشاشات الصغيرة. إخفاء الـ nav العادي واستبداله بقائمة منزلقة (slide-out drawer). |
| **الجهد** | 2 ساعات |
| **الملفات** | `client/src/components/TopBar.tsx` |
| **خطوات التنفيذ** | 1. إضافة `useState` للـ `isMenuOpen`<br>2. زر hamburger (☰) يظهر في `sm:` فقط<br>3. قائمة منزلقة جانبياً (drawer) للموبايل |

---

## خلاصة المرحلة

| البند | الجهد | الأولوية |
|-------|-------|----------|
| 4.1 aria-label للأيقونات | 1 س | 🔴 High | ✅ |
| 4.2 Keyboard nav AssigneePicker | 1 س | 🔴 High | ✅ |
| 4.3 Focus indicators | 30 د | 🟡 Medium | ✅ |
| 4.4 ARIA attributes للمودالات | 1 س | 🔴 High | ✅ |
| 4.5 Focus trapping | 2 س | 🔴 High | ✅ |
| 4.6 Toast accessibility | 15 د | 🟡 Medium | ✅ |
| 4.7 TopBar aria-labels | 15 د | 🟡 Medium | ✅ |
| 4.8 Hamburger menu | 2 س | 🟡 Medium | ✅ |
| **المجموع** | **~8 ساعات** | | **✅ كاملة** |
