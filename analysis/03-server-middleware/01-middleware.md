# تحليل Middleware — Server Middleware Analysis

> الملفات: `server/src/middleware/` — auth.ts, errorHandler.ts

## 3.1 auth.ts

### authenticate
```typescript
// يتحقق من JWT في Authorization header
const token = req.headers.authorization?.replace('Bearer ', '')
if (!token) return res.fail(401, 'No token provided')
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret')
  req.user = decoded
  next()
} catch {
  return res.fail(401, 'Invalid token')
}
```

**المشاكل:**
- **JWT_SECRET fallback**: وجود fallback-secret في الكود خطر أمني إنتاجي
- **لا يتحقق من blacklist**: لا يتصل بـ `token_blacklist` للتحقق من صلاحية التوكن بعد تسجيل الخروج
- **لا يفحص user.status**: لا يتحقق من أن المستخدم ليس `'archived'`

### authorize(...roleIds)
```typescript
return (req, res, next) => {
  if (!roleIds.includes(req.user.role_id)) {
    return res.fail(403, 'Unauthorized')
  }
  next()
}
```

لا مشاكل — وظيفة صحيحة ونظيفة.

### requireCredit(action)
```typescript
// يستدعي db.getCreditLevel() ويتحقق creditLevel > 1
```

**المشاكل:**
- الخطأ السابق في `getCreditLevel` (`ORDER BY minScore ASC` بدلاً من `DESC`) تم إصلاحه
- مازال يُعيد 403 بدون رسالة واضحة عن مستوى التحذير الحالي

### checkFrozen
```typescript
// يتحقق من frozenAt ≠ null وفك التجميد التلقائي
```

**المشاكل:**
- `frozenAt` يُقرأ مرة واحدة لكل طلب — لا يتحقق من stale entries
- التحديث إلى `unfrozenAt` لا يُحدث `frozenAt = null`
- المنطق الزمني غير دقيق

## 3.2 errorHandler.ts
- Error handler واحد بسيط يلتقط uncaught errors ويعيد 500
- كافٍ حالياً ولكن ينقصه Sentry/Raven للبيئة الإنتاجية

## 3.3 res.success() — نظام camelToSnake التلقائي
المعرفة في `server/src/index.ts:113`:

```typescript
// @ts-ignore
app.response.success = function (data = null, statusCode = 200, message = 'Success') {
  return this.status(statusCode).json({
    success: true,
    message,
    data: data ? camelToSnake(data) : null,
    timestamp: new Date().toISOString()
  })
}
```

**أهمية تشخيصية:** هذا الميدلوير هو السبب الذي جعل إضافة `camelToSnake()` في الخدمات **غير ضرورية** — camelToSnake يُطبّق تلقائياً على كل استجابة. هذا أخفى المشاكل الهيكلية وجعل التشخيص مربكاً.
