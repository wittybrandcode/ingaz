# Ralph Loop — Member System

> تنفيذ خطة نظام الأعضاء بشكل حلقي ذاتي حتى الاكتمال.
> الهدف: 6 مراحل، تنفذ واحدة تلو الأخرى بلا توقف.

## آلية العمل

1. اقرأ `scripts/ralph/log.md` ← افهم أين توقف التنفيذ
2. اقرأ `plans/member-system/STATUS.md` ← حدد `current_phase`
3. اقرأ `plans/member-system/plan.md` ← افهم وصف المرحلة الحالية

## لكل مرحلة

### 1. التحقق المبدئي
```
cd server && npm run typecheck
cd client && npm run typecheck
```
إذا فشل → سجل الخطأ في STATUS.md (`last_error`) وتوقف.

### 2. تنفيذ التغييرات
حسب `plan.md` للمرحلة الحالية. استخدم Task agent للتسريع عند الحاجة.

### 3. التحقق النهائي
```
cd server && npm run typecheck
cd client && npm run typecheck
cd server && npm run test
```
إذا فشل → صحّح وكرر.

### 4. توثيق الإنجاز
- أضف إدخالاً في `scripts/ralph/log.md` (سريع: المرحلة + الملفات)
- load skill `phase-document` ← يكتب `docs/phase-N-*.md`

### 5. Commit
```
git add -A
git commit -m "phase-N: <name>: <brief>"
```

### 6. تحديث STATUS.md
- غيّر `phase` إلى الرقم التالي
- غيّر `status` إلى `"not_started"`
- امسح `last_error`

### 7. استمرار الحلقة
- اقرأ STATUS.md من جديد
- إذا `phase > 6` → أخرج `<promise>FINISHED</promise>` ثم توقف
- وإلا → كرر الحلقة للمرحلة التالية

## كشف امتلاء السياق

أثناء العمل، إذا لاحظت أن الردود بدأت تقصر أو السياق قارب على الامتلاء:
1. load skill `session-handoff`
2. اكتب ملخصاً في `docs/handoff-session-N.md`
3. أخرج رسالة: `[HANDOFF] رجاء افتح جلسة جديدة واستمر من phase X`

## الإكمال

عندما تكتمل جميع المراحل الـ 6، أخرج:

```
<promise>FINISHED</promise>
```

## ملاحظات مهمة

- لا تتخطى `typecheck` أبداً
- STATUS.md هو المصدر الوحيد للحقيقة
- log.md للتوثيق البشري
- إذا فشلت مرحلة 3 مرات متتالية → سجل الخطأ وتوقف (`last_error`)
- استخدم Task agent للمهام المتوازية إن أمكن
