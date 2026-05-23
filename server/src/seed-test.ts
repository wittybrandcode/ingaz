import 'dotenv/config'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { eq, inArray, and } from 'drizzle-orm'
import { getDb, closePool, schema } from './db/index.js'
import { ROLES } from './constants.js'

const uploadDir = path.resolve(process.cwd(), 'uploads')
const now = new Date()

// ─── Helper: rich Tiptap HTML ─────────────────────────────────
function tiptapHTML(title: string, body: string, images: string[] = []): string {
  const imgs = images.map(src => `<p><img src="${src}"></p>`).join('\n')
  return `<h2>${title}</h2>
${body}
${imgs}`
}

const project1Desc = tiptapHTML('نظام إدارة المحتوى المتكامل', `<p>هذا المشروع يهدف إلى بناء <strong>نظام إدارة محتوى متكامل</strong> للمؤسسة يتيح للفريق تحرير ونشر المحتوى بسهولة.</p>
<hr>
<h3>الأهداف الرئيسية</h3>
<ul>
<li><strong>سهولة الاستخدام:</strong> واجهة بديهية لا تحتاج تدريب طويل</li>
<li><strong>السرعة:</strong> زمن استجابة أقل من 200ms</li>
<li><em>التوسع:</em> دعم 10,000 مستخدم متزامن</li>
<li><u>الأمان:</u> تشفير كامل للبيانات</li>
</ul>
<h3>المخرجات المتوقعة</h3>
<ol>
<li>نظام جاهز للإنتاج</li>
<li>توثيق كامل للكود</li>
<li>دليل مستخدم بالعربية</li>
</ol>
<blockquote><p>"نظام إدارة المحتوى هو العمود الفقري للتحول الرقمي في المؤسسة"</p></blockquote>
<p><strong>ملاحظة:</strong> سيتم تسليم النظام على <s>3</s> 4 مراحل بسبب تعقيد التكامل مع الأنظمة القديمة.</p>`,
  ['/uploads/project1-screenshot.svg', '/uploads/project1-diagram.svg']
)

const project2Desc = tiptapHTML('تطبيق الهواتف الذكية للخدمات الميدانية', `<p>تطبيق جوال <strong>بالكامل</strong> لمنصفي الخدمات الميدانية مع دعم <em>الخرائط والتتبع المباشر</em>.</p>
<h3>التقنيات المستخدمة</h3>
<ul>
<li>React Native للواجهة</li>
<li>Node.js للخلفية</li>
<li>PostgreSQL + Redis</li>
<li>WebSockets للاتصال المباشر</li>
</ul>
<h3>المميزات</h3>
<ul>
<li>تتبع مباشر عبر GPS</li>
<li>إشعارات لحظية</li>
<li>دعم وضع عدم الاتصال</li>
<li>تقارير يومية وأسبوعية</li>
</ul>`,
  ['/uploads/app-mockup.svg', '/uploads/app-flow.svg', '/uploads/report-sample.txt']
)

const project3Desc = tiptapHTML('منصة التدريب والتطوير المهني', `<p>منصة إلكترونية شاملة للتدريب والتطوير المهني تحتوي على <strong>أكثر من 100 دورة تدريبية</strong> في مختلف المجالات.</p>
<h3>مكونات المنصة</h3>
<ul>
<li><strong>مكتبة الفيديوهات:</strong> أكثر من 500 ساعة تدريبية</li>
<li><strong>نظام الاختبارات:</strong> اختبارات تفاعلية مع تصحيح آلي</li>
<li><strong>الشهادات:</strong> إصدار شهادات إتمام مع QR code</li>
<li><strong>لوحة الإدارة:</strong> متابعة تقدم المتدربين</li>
</ul>
<blockquote><p>"التعلم المستمر هو مفتاح النجاح في العصر الرقمي"</p></blockquote>
<h3>الفئة المستهدفة</h3>
<ol>
<li>الموظفون الجدد (برامج تأهيلية)</li>
<li>المشرفون (برامج تطويرية)</li>
<li>الإدارة العليا (برامج قيادية)</li>
</ol>`,
  ['/uploads/platform-dashboard.svg']
)

// ─── File content generators ──────────────────────────────────
function createSVG(name: string, w = 400, h = 300): string {
  const colors = ['#4f46e5', '#22c55e', '#eab308', '#ef4444', '#3b82f6']
  const c = colors[Math.abs(hashCode(name)) % colors.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#f8fafc" rx="8"/>
  <rect x="20" y="20" width="${w - 40}" height="${h - 40}" fill="${c}20" rx="8" stroke="${c}" stroke-width="2"/>
  <text x="${w / 2}" y="${h / 2 - 10}" text-anchor="middle" fill="${c}" font-size="18" font-weight="bold" font-family="Arial">${name}</text>
  <text x="${w / 2}" y="${h / 2 + 20}" text-anchor="middle" fill="#64748b" font-size="12" font-family="Arial">${w}×${h}</text>
  <circle cx="${w - 40}" cy="40" r="8" fill="${c}"/>
  <rect x="40" y="${h - 50}" width="${w - 80}" height="8" fill="${c}40" rx="4"/>
  <rect x="40" y="${h - 50}" width="${(w - 80) * 0.65}" height="8" fill="${c}" rx="4"/>
</svg>`
}

function createTextFile(title: string, lines: string[]): string {
  return `${'='.repeat(50)}
${title}
${'='.repeat(50)}
${lines.join('\n')}
${'='.repeat(50)}
تاريخ الإنشاء: ${now.toISOString().split('T')[0]}
`
}

function createAudioFile(): Buffer {
  const sampleRate = 8000
  const duration = 2
  const numSamples = sampleRate * duration
  const dataSize = numSamples
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate, 28)
  buffer.writeUInt16LE(1, 32)
  buffer.writeUInt16LE(8, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < dataSize; i++) {
    buffer.writeUInt8(Math.floor(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 127 + 128), 44 + i)
  }
  return buffer
}

function hashCode(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i)
    hash |= 0
  }
  return hash
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  const db = getDb()

  console.log('\n🌱 بذر بيانات اختبارية غنية\n')

  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

  // ── Users ──
  const users = await db.select({ id: schema.users.id, name: schema.users.name, roleId: schema.users.roleId })
    .from(schema.users).where(inArray(schema.users.email, ['admin@ingaz.com', 'emp@ingaz.com']))
  const admin = users.find((u: typeof users[0]) => u.roleId === ROLES.ADMIN) || { id: 1 }
  const emp = users.find((u: typeof users[0]) => u.roleId === 2) || { id: 3 }
  const allEmployees = await db.select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users).where(eq(schema.users.roleId, 2))
  console.log(`✅ ${allEmployees.length + 2} مستخدم`)

  // ── Projects ──
  const projects = [
    { title: 'نظام إدارة المحتوى المتكامل', desc: project1Desc, by: admin.id },
    { title: 'تطبيق الهواتف الذكية للخدمات الميدانية', desc: project2Desc, by: admin.id },
    { title: 'منصة التدريب والتطوير المهني', desc: project3Desc, by: admin.id },
  ]

  const projectIds: number[] = []
  for (const p of projects) {
    const [proj] = await db.insert(schema.projects).values({
      title: p.title, description: p.desc, createdBy: p.by, createdAt: new Date(now.getTime() - (3 - projectIds.length) * 86400000),
    }).returning({ id: schema.projects.id })
    projectIds.push(proj.id)

    await db.insert(schema.projectMembers).values({
      projectId: proj.id, userId: admin.id, role: 'manager',
    }).onConflictDoNothing()
    for (const e of allEmployees.slice(0, 4)) {
      await db.insert(schema.projectMembers).values({
        projectId: proj.id, userId: e.id, role: 'manager',
      }).onConflictDoNothing()
    }
    console.log(`  ✅ مشروع: ${p.title} (id=${proj.id})`)
  }

  // ── Files for projects ──
  type AttDef = { entityType: string; entityId: number; filename: string; originalName: string; mime: string; content: Buffer | string }
  const allAttachments: AttDef[] = []

  const projFiles: [string, string, Buffer | string][] = [
    ['project1-screenshot.svg', 'واجهة النظام الرئيسية.svg', createSVG('واجهة النظام', 800, 500)],
    ['project1-diagram.svg', 'مخطط تدفق البيانات.svg', createSVG('مخطط تدفق البيانات', 600, 400)],
    ['project2-mockup.svg', 'تصميم التطبيق.svg', createSVG('تصميم التطبيق', 375, 812)],
    ['project2-flow.svg', 'خريطة التصفح.svg', createSVG('خريطة التصفح', 700, 500)],
    ['project2-report.txt', 'نموذج تقرير.txt', createTextFile('نموذج تقرير ميداني', [
      'التقرير رقم: FR-2026-001',
      'الموقع: المنطقة الصناعية',
      'الحالة: تمت المعاينة',
      'ملاحظات: الموقع جاهز للتركيب',
      'التوصيات: البدء فوراً بالمرحلة الأولى',
    ])],
    ['platform-dashboard.svg', 'لوحة الإدارة.svg', createSVG('لوحة الإدارة', 1200, 800)],
  ]

  const projIndices = [0, 0, 1, 1, 1, 2]
  for (const [i, [filename, originalName, content]] of projFiles.entries()) {
    const pid = projectIds[projIndices[i]]
    fs.writeFileSync(path.join(uploadDir, filename), content)
    allAttachments.push({
      entityType: 'project', entityId: pid,
      filename, originalName, mime: filename.endsWith('.svg') ? 'image/svg+xml' : 'text/plain',
      content,
    })
  }

  // ── Tasks ──
  const taskDefs = [
    { pid: 0, title: 'تصميم واجهات المستخدم (UI/UX)', desc: tiptapHTML('مرحلة التصميم', `<p>تصميم <strong>جميع واجهات</strong> النظام باستخدام Figma مع مراعاة <em>معايير الوصول</em>.</p>
<h3>المهام</h3>
<ul>
<li>تصميم 25 شاشة رئيسية</li>
<li>إنشاء نظام ألوان متناسق</li>
<li>تصميم أيقونات مخصصة</li>
<li>إعداد دليل التصميم</li>
</ul>`) },
    { pid: 0, title: 'تطوير الخلفية (API) و قواعد البيانات', desc: tiptapHTML('مرحلة التطوير', `<p>بناء الـ <code>API</code> مع <strong>توثيق كامل</strong> باستخدام Swagger.</p>
<h3>النقاط الرئيسية</h3>
<ol>
<li>تصميم ERD لقاعدة البيانات</li>
<li>إعداد GraphQL API</li>
<li>تطبيق أنظمة الأمان</li>
<li>اختبار التكامل</li>
</ol>`) },
    { pid: 1, title: 'تطوير تطبيق الجوال (Mobile App)', desc: tiptapHTML('تطوير التطبيق', `<p>بناء تطبيق جوال <strong>متعدد المنصات</strong> باستخدام Flutter.</p>
<ul>
<li>شاشة تسجيل الدخول</li>
<li>خريطة تفاعلية</li>
<li>نظام الإشعارات</li>
<li>رفع الصور والملفات</li>
</ul>`) },
    { pid: 1, title: 'الخلفية السحابية للتطبيق (Backend)', desc: tiptapHTML('الخلفية السحابية', `<p>بنية تحتية <strong>سحابية</strong> قابلة للتوسع.</p>
<ol>
<li>AWS Lambda Functions</li>
<li>API Gateway</li>
<li>DynamoDB + S3</li>
<li>CloudFront CDN</li>
</ol>`) },
    { pid: 2, title: 'إعداد المحتوى التدريبي', desc: tiptapHTML('المحتوى التدريبي', `<p>إنتاج <strong>50 دورة تدريبية</strong> بالفيديو والصوت.</p>
<ul>
<li>تسجيل فيديوهات احترافية</li>
<li>إعداد الاختبارات</li>
<li>ترجمة المحتوى</li>
<li>تصميم الشهادات</li>
</ul>`) },
    { pid: 2, title: 'تطوير منصة التعلم الإلكتروني', desc: tiptapHTML('المنصة التعليمية', `<p>تطوير منصة <strong>تفاعلية</strong> للتعلم.</p>
<ul>
<li>مشغل فيديو مخصص</li>
<li>نظام تتبع التقدم</li>
<li>منتدى نقاش</li>
<li>نظام الوصول</li>
</ul>`) },
  ]

  const taskIds: number[] = []
  for (const t of taskDefs) {
    const [tsk] = await db.insert(schema.tasks).values({
      projectId: projectIds[t.pid], title: t.title, description: t.desc,
      createdBy: admin.id, createdAt: new Date(now.getTime() - (6 - taskIds.length) * 86400000),
    }).returning({ id: schema.tasks.id })
    taskIds.push(tsk.id)

    for (const e of allEmployees.slice(0, 3)) {
      await db.insert(schema.taskAssignees).values({
        taskId: tsk.id, userId: e.id, assignedBy: admin.id,
      }).onConflictDoNothing()
    }
    console.log(`  ✅ مهمة: ${t.title} (id=${tsk.id})`)
  }

  // ── Files for tasks ──
  const taskFiles: [string, string, number, string | Buffer][] = [
    ['task1-wireframes.svg', 'نموذج واجهات.svg', 0, createSVG('نموذج واجهات', 800, 600)],
    ['task1-style-guide.txt', 'دليل الأنماط.txt', 0, createTextFile('دليل الأنماط', [
      'الألوان الأساسية: #4f46e5 (كحلي), #22c55e (أخضر)',
      'الخطوط: Arabic Typeface',
      'الأيقونات: Lucide Icons',
      'المسافات: 4px base grid',
    ])],
    ['task2-db-schema.svg', 'مخطط قاعدة البيانات.svg', 1, createSVG('مخطط قاعدة البيانات', 800, 600)],
    ['task2-api-docs.txt', 'توثيق API.txt', 1, createTextFile('توثيق API', [
      'POST /api/auth/login — تسجيل الدخول',
      'GET /api/projects — قائمة المشاريع',
      'POST /api/projects — إنشاء مشروع',
      'GET /api/tasks/:id — تفاصيل مهمة',
      'DELETE /api/tasks/:id — حذف مهمة',
    ])],
    ['task3-app-screens.svg', 'شاشات التطبيق.svg', 2, createSVG('شاشات التطبيق', 375, 812)],
    ['task3-notifications.txt', 'نظام الإشعارات.txt', 2, createTextFile('نظام الإشعارات', [
      'أنواع الإشعارات:',
      '- إشعارات فورية (Push)',
      '- إشعارات بريد إلكتروني',
      '- إشعارات داخل التطبيق',
      'كل مستخدم يتحكم في إعداداته',
    ])],
    ['task4-architecture.svg', 'البنية التحتية.svg', 3, createSVG('البنية التحتية', 900, 600)],
    ['task4-deploy.txt', 'دليل النشر.txt', 3, createTextFile('دليل النشر', [
      'خطوات النشر:',
      '1. بناء الصورة Docker',
      '2. رفع إلى ECR',
      '3. تحديث ECS Service',
      '4. التحقق من الصحة',
    ])],
    ['task5-course-list.txt', 'قائمة الدورات.txt', 4, createTextFile('قائمة الدورات', [
      '1. أساسيات إدارة المشاريع',
      '2. القيادة الفعالة',
      '3. التواصل المؤسسي',
      '4. التحليل المالي',
      '5. التسويق الرقمي',
      '6. الموارد البشرية',
    ])],
    ['task6-platform-ui.svg', 'تصميم المنصة.svg', 5, createSVG('تصميم المنصة', 1200, 800)],
  ]

  for (const [filename, originalName, taskIdx, content] of taskFiles) {
    fs.writeFileSync(path.join(uploadDir, filename), content)
    allAttachments.push({
      entityType: 'task', entityId: taskIds[taskIdx],
      filename, originalName, mime: filename.endsWith('.svg') ? 'image/svg+xml' : 'text/plain',
      content,
    })
  }

  // ── Subtasks ──
  const subtaskDefs: { tid: number; title: string; desc: string; assignees: number[] }[] = []
  const subTitles = [
    ['تحليل المتطلبات', 'تصميم الشاشات', 'النمذجة الأولية'],
    ['إعداد بيئة العمل', 'تطوير API', 'اختبار الوحدات'],
    ['إعداد بيئة Flutter', 'تطوير الشاشات', 'دمج APIs'],
    ['بنية AWS', 'وظائف Lambda', 'قواعد البيانات'],
    ['تسجيل فيديو', 'إعداد الاختبارات', 'تصميم الشهادات'],
    ['تثبيت المنصة', 'رفع المحتوى', 'اختبار المستخدم'],
  ]

  for (let ti = 0; ti < taskIds.length; ti++) {
    const subs = subTitles[ti] || ['مهمة فرعية 1', 'مهمة فرعية 2', 'مهمة فرعية 3']
    for (let si = 0; si < subs.length; si++) {
      const stTitle = subs[si]
      const stDesc = tiptapHTML(stTitle, `<p>خطوة من <strong>مشروع ${taskDefs[ti].title}</strong></p>
<ul>
<li>الهدف: ${stTitle}</li>
<li>المدة: ${1 + si} أيام</li>
<li>الأولوية: ${si === 0 ? 'عالية' : 'متوسطة'}</li>
</ul>
<p><em>يرجى توثيق كل خطوة</em></p>`)
      const assignees = allEmployees.slice(si, si + 2).map((e: typeof allEmployees[0]) => e.id)
      subtaskDefs.push({ tid: taskIds[ti], title: stTitle, desc: stDesc, assignees })
    }
  }

  const subtaskIds: number[] = []
  for (const s of subtaskDefs) {
    const statuses = ['open', 'open', 'open', 'completed', 'cancelled', 'deferred'] as const
    const st = await db.insert(schema.subtasks).values({
      taskId: s.tid, title: s.title, description: s.desc,
      assignedTo: s.assignees[0],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      deadline: new Date(now.getTime() + (7 + Math.floor(Math.random() * 30)) * 86400000),
      createdAt: new Date(now.getTime() - Math.random() * 14 * 86400000),
    }).returning({ id: schema.subtasks.id })
    subtaskIds.push(st[0].id)

    for (const uid of s.assignees) {
      await db.insert(schema.subtaskAssignees).values({
        subtaskId: st[0].id, userId: uid, assignedBy: admin.id,
      }).onConflictDoNothing()
    }
    console.log(`  ✅ مهمة فرعية: ${s.title} (id=${st[0].id})`)
  }

  // ── Files for subtasks ──
  const subFileTemplates: [string, string, string | Buffer][] = [
    ['sub-report', 'تقرير المرحلة', createTextFile('تقرير المرحلة', [
      'تم إنجاز المهمة بنجاح',
      'النتائج: متوقعة كما خططنا',
      'التحديات: لا توجد',
      'التوصيات: المتابعة للخطوة التالية',
    ])],
    ['sub-image', 'صورة توضيحية', createSVG('صورة توضيحية', 500, 400)],
    ['sub-audio', 'تسجيل صوتي', createAudioFile()],
  ]

  let fileIdx = 0
  for (let si = 0; si < subtaskIds.length; si++) {
    const [prefix, label, content] = subFileTemplates[si % subFileTemplates.length]
    const isAudio = prefix === 'sub-audio'
    const isImage = prefix === 'sub-image'
    const ext = isAudio ? '.wav' : isImage ? '.svg' : '.txt'
    const mime = isAudio ? 'audio/wav' : isImage ? 'image/svg+xml' : 'text/plain'
    const filename = `subtask-${subtaskIds[si]}-${prefix}${ext}`
    const originalName = `${label} ${Math.floor(si / 3) + 1}${ext}`
    fs.writeFileSync(path.join(uploadDir, filename), content)
    allAttachments.push({
      entityType: 'subtask', entityId: subtaskIds[si],
      filename, originalName, mime, content,
    })
    fileIdx++
  }

  // ── Insert attachments ──
  console.log(`\n📎 إدراج ${allAttachments.length} ملف مرفق...`)
  for (const a of allAttachments) {
    await db.insert(schema.attachments).values({
      entityType: a.entityType,
      entityId: a.entityId,
      filename: a.filename,
      originalName: a.originalName,
      mimeType: a.mime,
      fileSize: Buffer.byteLength(typeof a.content === 'string' ? a.content : a.content),
      uploadedBy: admin.id,
      createdAt: new Date(now.getTime() - Math.random() * 14 * 86400000),
    }).onConflictDoNothing()
    console.log(`  ✅ ملف: ${a.originalName} → ${a.entityType}/${a.entityId}`)
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`📊 إحصائيات`)
  console.log(`${'='.repeat(50)}`)
  console.log(`المشاريع:         ${projectIds.length}`)
  console.log(`المهام:            ${taskIds.length}`)
  console.log(`المهام الفرعية:    ${subtaskIds.length}`)
  console.log(`الملفات المرفقة:   ${allAttachments.length}`)
  console.log(`\n✅ اكتمل البذر بنجاح!`)

  await closePool()
}

main().catch(e => { console.error('❌ فشل البذر:', e); process.exit(1) })
