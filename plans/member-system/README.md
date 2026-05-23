# Member System — خطة تنفيذ نظام الأعضاء

> **الهدف**: بناء نظام أعضاء احترافي ومتكامل في لوحة التحكم الرئيسية، يعرض كل عضو ببطاقة غنية بالبيانات (الصورة، badges، حالة الاتصال، التكليفات، الإجراءات السريعة) ويرتبط ببقية الأنظمة (الصلاحيات، الأدوار، التنبيهات، Socket.io).

**تاريخ البدء**: 23-05-2026  
**الحالة**: 🔴 لم يبدأ  
**عدد المراحل**: 6 مراحل  

---

## 🧭 خريطة التنقل بين المراحل

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
  (API)        (Store)      (UI Card)    (Socket)     (Actions)    (Modal)
```

كل مرحلة تبني على التي قبلها. النظام مصمم بحيث:
- كل مرحلة تعمل `typecheck + lint + test`
- توثيق + commit بعد كل مرحلة
- إذا توقف التنفيذ (نفاد السياق)، يُنشأ `handoff` ويُستأنف من نفس المرحلة

---

## 📋 قائمة المراحل

| # | المرحلة | المدة التقريبية | الملفات المتأثرة | تتطلب |
|---|---------|-----------------|-----------------|-------|
| 1 | **Member API** — نقطة نهاية جديدة للمستخدمين في Dashboard | ~15 دقيقة | `MemberService.ts`, `members.ts`, `index.ts` | — |
| 2 | **Member Store** — مخزن Zustand مع ربط Socket | ~15 دقيقة | `memberStore.ts`, `socket.ts` | Phase 1 |
| 3 | **MemberCard** — بطاقة العضو المتكاملة | ~25 دقيقة | `MemberCard.tsx`, `MemberList.tsx`, `Dashboard.tsx` | Phase 2 |
| 4 | **Online Status** — نقطة الاتصال عبر Socket.io | ~10 دقائق | `socket.ts`, `index.ts`, `MemberCard.tsx` | Phase 3 |
| 5 | **Action Icons** — أيقونات الإجراءات السريعة | ~20 دقيقة | `MemberCard.tsx`, `AssignModal.tsx`, `WarnModal.tsx` | Phase 4 |
| 6 | **MemberDetailModal** — مودال التفاصيل الكاملة | ~20 دقيقة | `MemberDetailModal.tsx`, `MemberCard.tsx` | Phase 5 |

---

## 🔄 آلية التنفيذ الذاتي

يتم تنفيذ الخطة عبر سلسلة من الأوامر التي يستدعيها Agent متخصص:

```
لكل مرحلة:
  1. load skills/phase-verify      ← typecheck + lint + test (قبل)
  2. تنفيذ التغييرات البرمجية        ← حسب وصف المرحلة
  3. load skills/phase-verify      ← typecheck + lint + test (بعد)
  4. load skills/phase-document     ← توثيق الإنجاز
  5. load skills/git-commit         ← حفظ التغييرات
  6. تحديث STATUS.md إلى المرحلة التالية
  7. load skills/session-handoff    ← إذا نفد السياق → جلسة جديدة
```

### نقطة الاستئناف (Resume Point)

ملف `STATUS.md` هو **المصدر الوحيد للحقيقة**. في بداية كل جلسة:
1. يُقرأ `STATUS.md`
2. يُحدد `current_phase`
3. يُستأنف التنفيذ من أول خطوة في تلك المرحلة

---

## 👥 الوكلاء المسؤولون (Agents)

| الوكيل | المسؤولية |
|--------|-----------|
| `member-system` | وكيل مخصص — يشرف على كل مرحلة وينسق الأدوات |
| `client-agent` | تطوير مكونات React (MemberCard, MemberList, Modals) |
| `db-agent` | أي تغيير في قاعدة البيانات (إن وجد) |
| `docs-agent` | توثيق المراحل — لا يُستخدم هنا مباشرة (نستخدم skill phase-document) |

---

## 📐 المبادئ المعمارية

1. **لا تكرار منطق** — كل معلومة مصدرها واحد (Store أو API)
2. **Socket هو المصدر الوحيد لحالة الاتصال** — لا Polling
3. **كل إجراء يرتبط بصلاحية** — لا يظهر زر بدون صلاحية
4. **ProfileAvatar هو المكوّن الأساسي** — يعاد استخدامه في كل مكان
5. **الـ Store هو الوسيط الوحيد** — لا توجد API calls مباشرة في المكونات

```
Socket.io ──► memberStore ──► MemberCard(s) ──► Actions ──► API
                 ▲
                 │
            API (loadMembers)
```
