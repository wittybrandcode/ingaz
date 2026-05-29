# خطة التنظيف

## 1. 🗑️ ملفات ميتة
- حذف `server/src/_test_api.ts`
- حذف `server/src/_test_api2.ts`

## 2. 🧹 Console.log → Logger
- `server/src/sentry.ts:19` ← `logger.info`
- `server/src/services/BackgroundJobService.ts:80,98,144` ← `logger.error`
- `server/src/services/DeadlineService.ts:109` ← `logger.error`

## 3. ⚠️ Prettier scripts
- حذف سكريبت `format` من `server/package.json` و `client/package.json`
- أو تثبيت prettier في devDependencies
