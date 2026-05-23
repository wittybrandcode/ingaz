# Skill: member-system

> تنفيذ خطة نظام الأعضاء المتكامل (Member System) حسب `plans/member-system/plan.md`

## متى تستخدم هذه المهارة

عندما يطلب المستخدم:
- بناء أو تطوير نظام الأعضاء
- تحسين MemberList في Dashboard
- إضافة بطاقات الأعضاء مع badges وحالة الاتصال
- تنفيذ أي مرحلة من مراحل `plans/member-system/plan.md`

## سير العمل الأساسي

```
1. اقرأ plans/member-system/STATUS.md ← حدد المرحلة الحالية
2. اقرأ plans/member-system/plan.md ← افهم تفاصيل المرحلة
3. load skills/phase-verify ← تأكد من الوضع الحالي
4. نفذ المرحلة حسب وصفها في plan.md
5. load skills/phase-verify ← تحقق من النتيجة
6. load skills/phase-document ← وثق الإنجاز
7. استخدم skill git-commit لرفع التغييرات
8. حدث STATUS.md ← انتقل إلى المرحلة التالية
9. إذا السياق ممتلئ → load skills/session-handoff
10. كرر من الخطوة 1 في الجلسة الجديدة
```

## Ralph Loop Integration

هذه المهارة متوافقة مع نمط **Ralph Loop** (`scripts/ralph/prompt.md`).

### حلقة التنفيذ
```
1. اقرأ scripts/ralph/log.md + plans/member-system/STATUS.md
2. حدد المرحلة الحالية
3. phase-verify (قبل)
4. نفذ المرحلة
5. phase-verify (بعد) + test
6. أضف إدخالاً في scripts/ralph/log.md
7. phase-document (docs/phase-N-*.md)
8. git-commit
9. حدث STATUS.md ← المرحلة التالية
10. إذا السياق ممتلئ → session-handoff → `[HANDOFF]`
11. كرر من الخطوة 1
```

### كشف الإكمال
عندما `STATUS.md.phase > 6`:
```
<promise>FINISHED</promise>
```

### كشف امتلاء السياق
- إذا لاحظت تقصير الردود أو صعوبة في التذكر:
  1. `load skill session-handoff`
  2. اكتب `docs/handoff-session-N.md`
  3. أخرج `[HANDOFF] افتح جلسة جديدة واستمر من phase X`

## أوامر مفيدة

```bash
cd server && npm run typecheck
cd client && npm run typecheck
cd server && npm run test
cd server && npm run lint
cd client && npm run lint
```

## هيكل الملفات للمراحل

### Phase 1 — Member API
```
server/src/services/MemberService.ts  ← جديد
server/src/routes/members.ts          ← جديد
server/src/index.ts                   ← تعديل
```

### Phase 2 — Member Store
```
client/src/store/memberStore.ts       ← جديد
client/src/lib/socket.ts              ← تعديل
server/src/index.ts                   ← تعديل (user:online/offline events)
```

### Phase 3 — MemberCard + MemberList
```
client/src/components/MemberCard.tsx  ← جديد
client/src/components/MemberList.tsx  ← جديد
client/src/pages/Dashboard.tsx        ← تعديل
```

### Phase 4 — Online Status
```
server/src/index.ts                   ← تعديل (broadcast online/offline)
client/src/lib/socket.ts              ← تعديل (استقبال الأحداث)
client/src/components/MemberCard.tsx  ← تعديل (النقطة الخضراء)
```

### Phase 5 — Action Icons + Assign/Warn
```
client/src/components/MemberCard.tsx  ← تعديل
client/src/components/AssignModal.tsx ← جديد
client/src/components/WarnModal.tsx   ← جديد
```

### Phase 6 — MemberDetailModal
```
client/src/components/MemberDetailModal.tsx ← جديد
client/src/components/MemberCard.tsx        ← تعديل
server/src/services/MemberService.ts       ← تعديل (API endpoints)
```
