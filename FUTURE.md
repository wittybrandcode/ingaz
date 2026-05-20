# الخطط المستقبلية — إنجاز (Ingaz)

> هذا الملف يجمع الأفكار والتوسعات المستقبلية من VISION.md و NOTIFICATIONS.md و SUGGESTIONS.md (AP4).
> تم إنشاؤه بعد تنظيف ملفات الخطط المنجزة.

---

## 1. تحسينات UI/UX

- **Dark Mode**: toggle في الشريط العلوي، Tailwind `dark:` classes مع persist في localStorage، متوافق مع system preference
- **PWA**: manifest.json + service worker + يعمل Offline للمهام الأساسية + شاشة Splash
- **Drag & Drop لترتيب المهام** (dnd-kit)
- **Swipe gestures** على الجوال (تسليم، أرشفة)
- **Undo/Redo** للحذف (Snackbar مع زر تراجع)
- **Skeleton loading** بدلاً من "جاري التحميل..."

---

## 2. إشعارات متقدمة (من NOTIFICATIONS.md)

### 2.1 تنبيهات المواعيد النهائية
| النوع | التوقيت |
|-------|---------|
| `deadline_approaching_24h` | قبل 24 ساعة |
| `deadline_approaching_6h` | قبل 6 ساعات |
| `deadline_overdue` | بعد تجاوز الموعد بساعة |
| `deadline_extended` | عند تمديد الموعد |

### 2.2 تنبيهات الإنجازات
| النوع | الشرط |
|-------|-------|
| `project_completed` | كل مهام المشروع مقبولة |
| `all_subtasks_approved` | كل مهام المستخدم للأسبوع مقبولة |
| `task_progress_50` | اكتمال 50% من المشروع |
| `task_progress_100` | اكتمال 100% من المشروع |
| `streak_achieved` | 5 مهام متتالية دون تأخير |
| `first_approval` | أول قبول لمهمة لموظف جديد |

### 2.3 تنبيهات الفريق والتغييرات
| النوع | الشرط |
|-------|-------|
| `user_joined` | انضمام عضو جديد |
| `user_left` | مغادرة عضو |
| `role_changed` | تغيير دور مستخدم |
| `assignment_changed` | تغيير المسؤول عن مهمة |
| `unassigned` | إلغاء تعيين مهمة |
| `reopened` | إعادة مهمة مرفوضة |

### 2.4 تنبيهات المرفقات والملفات
| النوع | الشرط |
|-------|-------|
| `file_uploaded_project` | رفع ملف في المشروع |
| `file_uploaded_task` | رفع ملف في مهمة |
| `file_deleted` | حذف ملف مهم |

### 2.5 تنبيهات الإشارات والتعاون
| النوع | الشرط |
|-------|-------|
| `@mention_in_comment` | @اسم_المستخدم في تعليق |
| `@mention_in_description` | @اسم_المستخدم في وصف المهمة |
| `multiple_assignees` | تعيين أكثر من شخص |
| `comment_reply` | رد على تعليق |

### 2.6 تنبيهات دورية
| النوع | التوقيت |
|-------|---------|
| `daily_summary` | كل صباح 8:00 |
| `weekly_report_manager` | كل سبت — ملخص الأسبوع |
| `pending_reminder` | كل 3 أيام للمهام المعلقة |
| `inactive_user` | مستخدم غير نشط منذ 7 أيام |

### 2.7 تنبيهات إدارية ونظامية
| النوع | الشرط |
|-------|-------|
| `backup_completed` | اكتمال النسخ الاحتياطي |
| `backup_failed` | فشل النسخ الاحتياطي |
| `storage_alert` | مساحة أقل من 10% |
| `new_version` | تحديث جديد متاح |
| `login_from_new_device` | تسجيل دخول من جهاز غير معروف |
| `password_changed` | تغيير كلمة المرور |

### 2.8 تنبيهات سلوكية
| النوع | الشرط |
|-------|-------|
| `fast_completion` | إنجاز مهمة قبل موعدها بـ > 24 ساعة |
| `multiple_rejections` | رفض مهمة أكثر من 3 مرات |
| `no_activity_3days` | لا نشاط لـ 3 أيام |
| `high_approval_rate` | نسبة قبول > 90% لـ 10 مهام |

### 2.9 تفضيلات التنبيهات
- جدول `notification_preferences`: user_id, type, channel, enabled
- صفحة `الإعدادات ← التنبيهات` لكل مستخدم
- قنوات: in_app, email, push

### 2.10 أنواع التنبيهات في الواجهة
- 🔶 برتقالي: إنذارات، مواعيد منتهية
- 🔵 أزرق: معلومات عامة
- 🟢 أخضر: إنجازات
- 🏆 ذهبي: إنجازات استثنائية
- 🟣 بنفسجي: انضمام عضو
- ⏰ أصفر: تذكير مواعيد
- 🔐 أحمر: أمان
- 💾 رمادي: نسخ احتياطي

---

## 3. التقارير والتصدير

- **PDF**: تصدير تقرير مشروع كامل
- **Excel**: جداول بيانات للمهام والمستخدمين
- **طباعة**: view مخصص للطباعة
- **مخططات زمنية**: Gantt Chart

---

## 4. نظام المرفقات المتقدم

- **معاينة الملفات**: PDF viewer مدمج (react-pdf)
- **ضغط الصور**: تحجيم تلقائي للصور الكبيرة
- **سحابة خاصة**: تخزين منظم بالتواريخ
- **Office docs**: معاينة Word/Excel
- **AP4 — دمج endpointي المرفقات**: `/api/uploads/by-subtasks?ids=` و `/api/uploads/:entity_type/:entity_id` يمكن دمجهما مع query param `groupBy`

---

## 5. نظام التعليقات المتطور

- **@Mentions**: إشارة لمستخدم معين
- **صور في التعليق**: رفع صورة داخل التعليق
- **Reactions**: إيموجي ردود فعل (👍 ❤️)
- **تعديل وحذف التعليق**: مع سجل التعديلات

---

## 6. إدارة الوقت

- **ساعة توقيت** للمهمة (Timer): ابدأ/أوقف/إجمالي الوقت
- **تقرير الوقت**: كم ساعة قضاها كل موظف
- **المواعيد النهائية**: إشعار قبل 24 ساعة، 1 ساعة
- **تقويم**: Calendar view يعرض المهام حسب التاريخ

---

## 7. البحث والفلترة

- **بحث شامل**: Ctrl+K يبحث في المشاريع، المهام، التعليقات
- **فلترة متقدمة**: بالحالة، التاريخ، المسؤول، الأولوية
- **Saved Filters**: حفظ الفلاتر المفضلة
- **Full-text search**: FTS5 في SQLite

---

## 8. الأولويات والتصنيفات

- **Priority**: عاجل/عالي/متوسط/منخفض (مع ألوان)
- **Tags**: وسم المهام
- **قوالب مهام**: Task Templates للمهام المتكررة

---

## 9. البنية التحتية والتشغيل

### 9.1 Desktop App (Tauri + Rust)
- `.exe` خفيف على ويندوز/ماك/لينكس
- SQLite في `%APPDATA%/Ingaz`
- Auto-updater عبر GitHub Releases
- Notification API لنظام التشغيل

### 9.2 Docker والنشر
- Docker Compose (server + client + nginx)
- نشر على VPS مع PM2
- SSL عبر Let's Encrypt
- CI/CD: GitHub Actions → build → test → deploy

### 9.3 الأمان
- Rate limiting (express-rate-limit)
- Helmet.js
- CORS مقيد
- express-validator للتحقق من الإدخال
- سجل أمني (login attempts, failed access)

---

## 10. تحسينات الأداء

### 10.1 Backend
- Pagination لكل قوائم API (cursor-based)
- Caching (node-cache) للبيانات الثابتة
- Database indexing

### 10.2 Frontend
- Code splitting: `React.lazy()` لكل صفحة
- Virtual scrolling للقوائم الطويلة
- Image lazy loading + blur placeholder
- Prefetch الصفحات المتوقعة

---

## 11. ميزات إدارية

### 11.1 سجل التدقيق (Audit Log)
- كل عملية مع IP Address
- واجهة مشاهدة مع فلترة
- تصدير CSV

### 11.2 النسخ الاحتياطي
- تلقائي كل 6 ساعات
- Restore بنقرة
- Cloud Backup (Google Drive, Dropbox)

### 11.3 نظام التحذيرات المتقدم
- تدرج تلقائي: إنذار ← إنذار ثان ← تجميد
- جدول الإنذارات للمدير
- Unfreeze request من الموظف

---

## 12. أمور تقنية

### 12.1 Testing
- Backend: Vitest + Supertest
- Frontend: Playwright E2E
- Load testing: k6

### 12.2 Monitoring
- Sentry لتتبع الأخطاء
- Winston لتسجيل logs
- Uptime monitoring

### 12.3 i18n
- دعم الإنجليزية بجانب العربية
- تبديل اللغة أثناء العمل
- تنسيق التاريخ والعملة حسب اللغة

---

## 13. إشعارات Web Push

- **Web Push API**: إشعارات حتى لو المتصفح مقفول
- **إشعارات صوتية**: Sound notification عند وصول مهمة
- **البريد الإلكتروني**: عبر Nodemailer
- **مركز إشعارات متطور**: فلترة، بحث، تصنيف

---

## خريطة طريق مقترحة

| المرحلة | المدة | المحتوى |
|---------|-------|---------|
| **P1 - فوري** | أسبوع | Dark mode, Skeleton loading, Pagination |
| **P2 - قريب** | أسبوعان | Priority/Tags, PDF, Push notifications, أهم 5 تنبيهات من NOTIFICATIONS.md |
| **P3 - متوسط** | شهر | Tauri desktop app, Calendar, Audit log, Web Push |
| **P4 - بعيد** | شهران | Tests, Mobile app, Cloud sync, i18n |
