# تحليل نظام الملفات — File System Analysis

## Uploads Directory

```
uploads/
├── [project-id]/
│   ├── [uuid-based-filename].[ext]
│   └── ...
└── ...
```

### آلية الرفع
- **Service:** `UploadService` في `server/src/services/UploadService.ts`
- **Middleware:** `multer` لمعالجة multipart/form-data
- **التنظيم:** ملفات في مجلدات حسب `projectId`
- **التسمية:** UUID عشوائي — يحافظ على الامتداد الأصلي
- **الـ metadata:** في جدول `attachments` في قاعدة البيانات

### خادم الملفات الثابتة
```typescript
// server/src/index.ts
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')))
```

الوكيل في Vite:
```typescript
// client/vite.config.ts
'/uploads': { target: 'http://localhost:3001' }
```

## Endpoints للملفات

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| POST | `/upload/:projectId` | رفع ملف/ملفات |
| GET | `/upload/:projectId` | قائمة ملفات المشروع |
| POST | `/upload/bulk` | جلب عدة ملفات |
| DELETE | `/upload/:projectId/:fileId` | حذف ملف |

## نقاط الضعف

1. **لا يوجد cleanup للملفات المعزولة** — الملفات المرفوعة تبقى حتى بعد حذف السجل
2. **لا يوجد validation لحجم/نوع الملف** على مستوى الخادم
3. **لا يوجد rate limiting** على رفع الملفات
4. **لا يوجد فحص مكافحة الفيروسات** (التطبيق تعليمي ولكن يُذكر)
5. **لا يوجد مجلد منفصل للمحتوى المؤقت/المنتهي**
6. **Structure uploads بدون إشارة إلى الـ projectId في الوسائط** (لكن من خلال الـ params)

## ملفات الإعدادات (`server/` و `client/`)

| الملف | الغرض |
|-------|-------|
| `.env` | متغيرات البيئة (JWT_SECRET, DATABASE_URL, ALLOWED_ORIGINS, SENTRY_DSN) |
| `tsconfig.json` | إعدادات TypeScript مع `strict: true` |
| `eslint.config.js` | ESLint 9 flat config |
| `.prettierrc` | تنسيق الكود (بلا فواصل منقوطة، علامات اقتباس مفردة) |
| `.gitignore` | استثناءات Git |

## ملفات مهمة في `.gitignore`

- `server/data/`
- `server/uploads/`
- `.env`
- `node_modules/`
