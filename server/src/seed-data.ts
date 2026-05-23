import 'dotenv/config'
import bcrypt from 'bcryptjs';
import { getPool } from './db/index.js';

const pool = getPool();

async function get(q: string, ...params: any[]) {
  const result = await pool.query(q, params);
  return result.rows[0];
}

async function all(q: string, ...params: any[]) {
  const result = await pool.query(q, params);
  return result.rows;
}

async function main() {
  console.log('🌱 Seeding comprehensive test data...\n');

  // Fetch dynamic role IDs
  const participantRole = await get("SELECT id FROM roles WHERE name = 'مشارك'");
  const participantRoleId = participantRole?.id || 2;

  // ============================================================
  // 1. USERS (10 total)
  // ============================================================
  const userPasswords = ['ahmed123', 'sara123', 'mohamed123', 'noura123', 'khalid123', 'mona123', 'faisal123', 'hind123', 'sami123', 'laila123'];
  const hashedPasswords = await Promise.all(userPasswords.map(p => bcrypt.hash(p, 10)));

  const users = [
    { id: 100, name: 'أحمد الشريف', email: 'ahmed@ingaz.com', password: hashedPasswords[0], role_id: null, is_manager: 1, status: 'active' },
    { id: 101, name: 'سارة النمر', email: 'sara@ingaz.com', password: hashedPasswords[1], role_id: participantRoleId, is_manager: 0, status: 'active' },
    { id: 102, name: 'محمد العبدالله', email: 'mohamed@ingaz.com', password: hashedPasswords[2], role_id: participantRoleId, is_manager: 0, status: 'active' },
    { id: 103, name: 'نورة السعيد', email: 'noura@ingaz.com', password: hashedPasswords[3], role_id: participantRoleId, is_manager: 0, status: 'active' },
    { id: 104, name: 'خالد المطيري', email: 'khalid@ingaz.com', password: hashedPasswords[4], role_id: participantRoleId, is_manager: 0, status: 'active' },
    { id: 105, name: 'منى الحربي', email: 'mona@ingaz.com', password: hashedPasswords[5], role_id: participantRoleId, is_manager: 0, status: 'active' },
    { id: 106, name: 'فيصل الدوسري', email: 'faisal@ingaz.com', password: hashedPasswords[6], role_id: participantRoleId, is_manager: 0, status: 'active' },
    { id: 107, name: 'هند القحطاني', email: 'hind@ingaz.com', password: hashedPasswords[7], role_id: participantRoleId, is_manager: 0, status: 'active' },
    { id: 108, name: 'سامي الزهراني', email: 'sami@ingaz.com', password: hashedPasswords[8], role_id: participantRoleId, is_manager: 0, status: 'active' },
    { id: 109, name: 'ليلى الغامدي', email: 'laila@ingaz.com', password: hashedPasswords[9], role_id: participantRoleId, is_manager: 0, status: 'active' },
  ];

  for (const u of users) {
    const existing = await get('SELECT id FROM users WHERE email = $1', u.email);
    if (!existing) {
      await pool.query('INSERT INTO users (id, name, email, password, role_id, is_manager, status, credit_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [u.id, u.name, u.email, u.password, u.role_id, u.is_manager, u.status, 10]);
    }
  }
  console.log('✅ 10 users seeded (manager + 9 with مشارك role)');

  // ============================================================
  // 2. PROJECTS (5)
  // ============================================================
  const projects = [
    { id: 100, title: 'تطوير نظام الفوترة الإلكترونية', description: 'نظام متكامل لإدارة الفواتير والفواتير الضريبية مع ربط بمنصة زكاتي', created_by: 100 },
    { id: 101, title: 'إعادة تصميم الموقع الرسمي للمؤسسة', description: 'إعادة تصميم الموقع بالكامل باستخدام أحدث تقنيات الواجهات مع دعم كامل للجوال', created_by: 100 },
    { id: 102, title: 'حملة التسويق الرقمي للمنتجات الجديدة', description: 'حملة إعلانية متكاملة عبر منصات التواصل الاجتماعي لإطلاق 3 منتجات جديدة', created_by: 101 },
    { id: 103, title: 'تطبيق الجوال للموظفين', description: 'تطبيق جوال يسمح للموظفين بمتابعة مهامهم وإدارة الإنذارات والملف الشخصي', created_by: 100 },
    { id: 104, title: 'تدريب الموظفين على النظام الجديد', description: 'خطة تدريبية شاملة لجميع الموظفين على النظام الجديد لإدارة العمل', created_by: 101 },
  ];

  for (const p of projects) {
    const existing = await get('SELECT id FROM projects WHERE id = $1', p.id);
    if (!existing) {
      const created_at = new Date(Date.now() - Math.random() * 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
      await pool.query('INSERT INTO projects (id, title, description, created_by, created_at) VALUES ($1, $2, $3, $4, $5)', [p.id, p.title, p.description, p.created_by, created_at]);
    }
  }
  console.log('✅ 5 projects seeded');

  // ============================================================
  // 3. TASKS (3-5 per project = 20 total)
  // ============================================================
  const tasks = [
    // Project 100 - نظام الفوترة
    { id: 200, project_id: 100, title: 'تصميم قاعدة البيانات', description: 'تصميم ERD وجداول الفواتير والعملاء', created_by: 100 },
    { id: 201, project_id: 100, title: 'واجهة إنشاء فاتورة', description: 'تصفح وإدخال بيانات الفاتورة مع إضافة الأصناف', created_by: 100 },
    { id: 202, project_id: 100, title: 'ربط مع منصة زكاتي', description: 'API ربط لإصدار الفواتير الضريبية', created_by: 100 },
    { id: 203, project_id: 100, title: 'لوحة تحكم الفواتير', description: 'إحصائيات وتقارير الفواتير الشهرية', created_by: 101 },
    { id: 204, project_id: 100, title: 'نظام التنبيهات للفواتير المتأخرة', description: 'إرسال تنبيهات للعملاء عند اقتراب موعد الفاتورة', created_by: 101 },

    // Project 101 - الموقع الرسمي
    { id: 205, project_id: 101, title: 'تصميم الهيكل الرئيسي', description: 'تصميم الـ Layout الرئيسي مع القوائم', created_by: 100 },
    { id: 206, project_id: 101, title: 'صفحة الخدمات', description: 'عرض الخدمات مع إمكانية التصفية', created_by: 100 },
    { id: 207, project_id: 101, title: 'نموذج التواصل', description: 'نموذج تواصل متكامل مع التحقق', created_by: 101 },
    { id: 208, project_id: 101, title: 'تحسين محركات البحث SEO', description: 'تحسين الموقع لمحركات البحث', created_by: 101 },

    // Project 102 - التسويق الرقمي
    { id: 209, project_id: 102, title: 'إعداد الحملات الإعلانية', description: 'إعداد إعلانات مدفوعة على منصات التواصل', created_by: 101 },
    { id: 210, project_id: 102, title: 'تصميم المحتوى البصري', description: 'تصميم صور وفيديوهات للحملة', created_by: 101 },
    { id: 211, project_id: 102, title: 'تحليل أداء الحملات', description: 'إعداد لوحة تحكم لمتابعة أداء الحملات', created_by: 101 },

    // Project 103 - تطبيق الجوال
    { id: 212, project_id: 103, title: 'تصفح المهام', description: 'واجهة عرض المهام والتصفية حسب الحالة', created_by: 100 },
    { id: 213, project_id: 103, title: 'لوحة الإنذارات', description: 'عرض الإنذارات و الرد عليها', created_by: 100 },
    { id: 214, project_id: 103, title: 'الملف الشخصي', description: 'عرض وتعديل الملف الشخصي مع الصورة', created_by: 100 },
    { id: 215, project_id: 103, title: 'الإشعارات', description: 'نظام الإشعارات المباشرة', created_by: 100 },
    { id: 216, project_id: 103, title: 'تسليم العمل عبر الجوال', description: 'إرفاق صور ونصوص عند تسليم المهمة', created_by: 101 },

    // Project 104 - التدريب
    { id: 217, project_id: 104, title: 'إعداد المواد التدريبية', description: 'فيديوهات وشرائح تعليمية', created_by: 101 },
    { id: 218, project_id: 104, title: 'جدولة الدورات', description: 'تحديد مواعيد التدريب للمجموعات', created_by: 101 },
    { id: 219, project_id: 104, title: 'اختبارات التقييم', description: 'إعداد اختبارات لتقييم الموظفين بعد التدريب', created_by: 101 },
  ];

  for (const t of tasks) {
    const existing = await get('SELECT id FROM tasks WHERE id = $1', t.id);
    if (!existing) {
      const created_at = new Date(Date.now() - Math.random() * 25 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
      await pool.query('INSERT INTO tasks (id, project_id, title, description, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [t.id, t.project_id, t.title, t.description, t.created_by, created_at]);
    }
  }
  console.log('✅ 20 tasks seeded (4-5 per project)');

  // ============================================================
  // 4. SUBTASKS (3-8 per task = ~100 total)
  // ============================================================
  const now = Date.now();
  const day = 86400000;
  const statuses = ['pending', 'in_progress', 'submitted', 'approved', 'rejected'];
  const empIds = [102, 103, 104, 105, 106, 107, 108, 109];
  const subtaskDefs = [
    // Project 100 - الفوترة — Task 200
    { task_id: 200, title: 'تحليل المتطلبات', assign: 102, stat: 'approved', dl: 5 },
    { task_id: 200, title: 'تصميم ERD', assign: 102, stat: 'approved', dl: 7 },
    { task_id: 200, title: 'إنشاء جداول SQL', assign: 103, stat: 'approved', dl: 10 },
    { task_id: 200, title: 'توثيق قاعدة البيانات', assign: 103, stat: 'submitted', dl: 12 },
    // Task 201
    { task_id: 201, title: 'تصميم واجهة الإدخال', assign: 104, stat: 'approved', dl: 3 },
    { task_id: 201, title: 'إضافة الأصناف ديناميكياً', assign: 104, stat: 'approved', dl: 5 },
    { task_id: 201, title: 'حساب الضريبة تلقائياً', assign: 105, stat: 'in_progress', dl: 8 },
    { task_id: 201, title: 'معاينة الفاتورة قبل الإصدار', assign: 105, stat: 'pending', dl: 10 },
    { task_id: 201, title: 'طباعة الفاتورة PDF', assign: null, stat: 'pending', dl: 14 },
    // Task 202
    { task_id: 202, title: 'الحصول على مفاتيح API', assign: 102, stat: 'submitted', dl: 2 },
    { task_id: 202, title: 'تنفيذ طلب إصدار فاتورة', assign: 102, stat: 'in_progress', dl: 6 },
    { task_id: 202, title: 'معالجة الأخطاء', assign: 103, stat: 'pending', dl: 10 },
    // Task 203
    { task_id: 203, title: 'إحصائيات العدد', assign: 106, stat: 'pending', dl: 5 },
    { task_id: 203, title: 'رسم بياني للإيرادات', assign: null, stat: 'pending', dl: 7 },
    { task_id: 203, title: 'تصدير Excel', assign: 106, stat: 'pending', dl: 10 },
    // Task 204
    { task_id: 204, title: 'جدولة التنبيهات', assign: 107, stat: 'in_progress', dl: 4 },
    { task_id: 204, title: 'إرسال إيميل تلقائي', assign: 107, stat: 'pending', dl: 7 },
    { task_id: 204, title: 'رسائل واتساب', assign: 108, stat: 'pending', dl: 10 },

    // Project 101 — Task 205
    { task_id: 205, title: 'تصميم الـ Header', assign: 104, stat: 'approved', dl: 2 },
    { task_id: 205, title: 'القوائم المنسدلة', assign: 104, stat: 'approved', dl: 3 },
    { task_id: 205, title: 'الـ Footer', assign: 104, stat: 'approved', dl: 4 },
    { task_id: 205, title: 'التجاوب مع الجوال', assign: 105, stat: 'in_progress', dl: 7 },
    // Task 206
    { task_id: 206, title: 'بطاقات الخدمات', assign: 105, stat: 'approved', dl: 3 },
    { task_id: 206, title: 'تصفية حسب الفئة', assign: 105, stat: 'submitted', dl: 5 },
    { task_id: 206, title: 'صفحة تفاصيل الخدمة', assign: 106, stat: 'in_progress', dl: 8 },
    // Task 207
    { task_id: 207, title: 'حقول النموذج', assign: 106, stat: 'approved', dl: 2 },
    { task_id: 207, title: 'التحقق من المدخلات', assign: 106, stat: 'submitted', dl: 4 },
    { task_id: 207, title: 'إرسال إشعار للمسؤول', assign: 107, stat: 'pending', dl: 7 },
    // Task 208
    { task_id: 208, title: 'تحليل الكلمات المفتاحية', assign: 107, stat: 'pending', dl: 5 },
    { task_id: 208, title: 'تحسين سرعة الموقع', assign: null, stat: 'pending', dl: 10 },
    { task_id: 208, title: 'إضافة الـ Meta Tags', assign: 108, stat: 'pending', dl: 12 },

    // Project 102 — Task 209
    { task_id: 209, title: 'فيسبوك إعلانات', assign: 108, stat: 'approved', dl: 3 },
    { task_id: 209, title: 'إنستغرام إعلانات', assign: 108, stat: 'approved', dl: 4 },
    { task_id: 209, title: 'تويتر إعلانات', assign: 109, stat: 'in_progress', dl: 6 },
    { task_id: 209, title: 'إعداد الجمهور المستهدف', assign: 109, stat: 'submitted', dl: 2 },
    // Task 210
    { task_id: 210, title: 'تصميم بوستات', assign: 109, stat: 'approved', dl: 3 },
    { task_id: 210, title: 'فيديو تشويقي', assign: null, stat: 'pending', dl: 8 },
    { task_id: 210, title: 'تصاميم للقصص', assign: 109, stat: 'approved', dl: 4 },
    // Task 211
    { task_id: 211, title: 'لوحة متابعة', assign: 102, stat: 'pending', dl: 5 },
    { task_id: 211, title: 'تقرير أسبوعي', assign: null, stat: 'pending', dl: 10 },

    // Project 103 — Task 212
    { task_id: 212, title: 'قائمة المهام', assign: 103, stat: 'approved', dl: 3 },
    { task_id: 212, title: 'تصفية حسب الحالة', assign: 103, stat: 'approved', dl: 5 },
    { task_id: 212, title: 'بحث في المهام', assign: 103, stat: 'submitted', dl: 7 },
    { task_id: 212, title: ' Pull-to-refresh', assign: 104, stat: 'in_progress', dl: 9 },
    // Task 213
    { task_id: 213, title: 'عرض الإنذارات', assign: 104, stat: 'approved', dl: 3 },
    { task_id: 213, title: 'نافذة الرد', assign: 105, stat: 'in_progress', dl: 6 },
    { task_id: 213, title: 'حالة الإنذار', assign: 105, stat: 'pending', dl: 8 },
    // Task 214
    { task_id: 214, title: 'عرض الملف الشخصي', assign: 106, stat: 'approved', dl: 2 },
    { task_id: 214, title: 'تعديل الصورة', assign: 106, stat: 'approved', dl: 4 },
    { task_id: 214, title: 'تغيير كلمة المرور', assign: 107, stat: 'in_progress', dl: 6 },
    // Task 215
    { task_id: 215, title: 'قائمة الإشعارات', assign: 107, stat: 'submitted', dl: 4 },
    { task_id: 215, title: 'تحديد كمقروء', assign: 107, stat: 'submitted', dl: 5 },
    { task_id: 215, title: 'الإعدادات', assign: 108, stat: 'pending', dl: 8 },
    // Task 216
    { task_id: 216, title: 'رفع الصور', assign: 108, stat: 'in_progress', dl: 5 },
    { task_id: 216, title: 'نص التسليم', assign: 108, stat: 'pending', dl: 7 },
    { task_id: 216, title: 'معاينة قبل التسليم', assign: null, stat: 'pending', dl: 10 },

    // Project 104 — Task 217
    { task_id: 217, title: 'تسجيل فيديوهات', assign: 109, stat: 'approved', dl: 5 },
    { task_id: 217, title: 'إعداد الشرائح', assign: 109, stat: 'approved', dl: 7 },
    { task_id: 217, title: 'كتابة الدليل', assign: 102, stat: 'in_progress', dl: 12 },
    // Task 218
    { task_id: 218, title: 'تحديد المجموعات', assign: 102, stat: 'submitted', dl: 3 },
    { task_id: 218, title: 'إرسال الدعوات', assign: 103, stat: 'in_progress', dl: 5 },
    { task_id: 218, title: 'تأكيد الحضور', assign: 103, stat: 'pending', dl: 8 },
    // Task 219
    { task_id: 219, title: 'أسئلة الاختبار', assign: null, stat: 'pending', dl: 10 },
    { task_id: 219, title: 'تصحيح تلقائي', assign: null, stat: 'pending', dl: 14 },
    { task_id: 219, title: 'إرسال النتائج', assign: null, stat: 'pending', dl: 16 },
  ];

  const statusMap: Record<string, string> = {
    pending: 'open',
    in_progress: 'open',
    submitted: 'open',
    approved: 'completed',
    rejected: 'cancelled',
  }

  let subtaskId = 300;
  let insertedSubtasks = 0;
  for (const s of subtaskDefs) {
    const dl = new Date(now + s.dl * day).toISOString().replace('T', ' ').slice(0, 19);
    const past = now - (Math.random() * 20 * day);
    const created_at = new Date(past).toISOString().replace('T', ' ').slice(0, 19);
    const newStatus = statusMap[s.stat] || 'open';

    const existing = await get('SELECT id FROM subtasks WHERE id = $1', subtaskId);
    if (!existing) {
      const assigned_to = s.assign || null;
      await pool.query(`INSERT INTO subtasks (id, task_id, title, description, assigned_to, status, deadline, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [subtaskId, s.task_id, s.title, 'وصف تفصيلي للمهمة: ' + s.title, assigned_to, newStatus, dl, created_at]);
      insertedSubtasks++;
    }
    subtaskId++;
  }
  console.log(`✅ ${insertedSubtasks} subtasks seeded with various statuses`);

  // ============================================================
  // 5. WARNINGS (for some employees)
  // ============================================================
  const warningTypes = await all('SELECT id, points FROM warning_types');
  if (warningTypes.length > 0) {
    const warningData = [
      { user_id: 105, issued_by: 100, type_idx: 0, points: 1, status: 'cleared', responded: true, credit: 9 },
      { user_id: 106, issued_by: 100, type_idx: 2, points: 2, status: 'responded', responded: true, credit: 8 },
      { user_id: 107, issued_by: 101, type_idx: 5, points: 3, status: 'pending', responded: false, credit: 7 },
      { user_id: 108, issued_by: 100, type_idx: 1, points: 2, status: 'sustained', responded: true, credit: 6 },
      { user_id: 109, issued_by: 101, type_idx: 4, points: 4, status: 'pending', responded: false, credit: 5 },
      { user_id: 105, issued_by: 101, type_idx: 3, points: 3, status: 'cleared', responded: true, credit: 9 },
    ];

    for (const w of warningData) {
      const wt = warningTypes[w.type_idx];
      const daysAgo = Math.floor(Math.random() * 20);
      const created = new Date(now - daysAgo * day).toISOString().replace('T', ' ').slice(0, 19);
      const deadline = new Date(now + 2 * day).toISOString().replace('T', ' ').slice(0, 19);
      const existing = await get('SELECT id FROM warnings WHERE user_id = $1 AND issued_by = $2 AND created_at = $3', w.user_id, w.issued_by, created);
      if (!existing) {
        await pool.query(`INSERT INTO warnings (user_id, issued_by, reason, status, response_text, responded_at, created_at, deadline, warning_type_id, points_deducted, credit_before, credit_after)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
            w.user_id, w.issued_by, wt.name + ' - ' + (['تأخر عن العمل', 'عدم التزام بالمواعيد', 'تقصير في المهام'][w.type_idx % 3] || 'مخالفة'),
            w.status,
            w.responded ? 'أتقدم باعتذاري، سأعمل على تحسين أدائي في الفترة القادمة.' : null,
            w.responded ? new Date(now - daysAgo * day + 3600000).toISOString().replace('T', ' ').slice(0, 19) : null,
            created,
            deadline,
            wt.id, w.points, 10, w.credit
          ]);
      }
    }
    console.log('✅ 6 warnings seeded (cleared, responded, pending, sustained)');
  }

  // ============================================================
  // 6. COMMENTS (on some subtasks)
  // ============================================================
  const commentData = [
    { subtask_id: 300, user_id: 102, content: 'تم الانتهاء من تحليل المتطلبات بنجاح. يرجى مراجعة المستند المرفق.' },
    { subtask_id: 300, user_id: 100, content: 'ممتاز، تمت المراجعة. يرجى المتابعة للخطوة التالية.' },
    { subtask_id: 301, user_id: 102, content: 'بدأت في تصميم ERD. هل هناك متطلبات إضافية للعلاقات؟' },
    { subtask_id: 301, user_id: 100, content: 'نعم, يجب إضافة علاقة مع جدول العملاء.' },
    { subtask_id: 304, user_id: 104, content: 'تم تصميم الواجهة. هل الألوان مناسبة؟' },
    { subtask_id: 304, user_id: 101, content: 'الألوان جيدة. يرجى تغيير لون الأزرار إلى الأزرق.' },
    { subtask_id: 309, user_id: 102, content: 'تم الحصول على المفاتيح من المنصة.' },
    { subtask_id: 309, user_id: 100, content: 'ممتاز. اربطها في ملف الإعدادات.' },
    { subtask_id: 330, user_id: 109, content: 'تم تسجيل جميع الفيديوهات. جاري المونتاج.' },
    { subtask_id: 330, user_id: 101, content: 'تأكد من جودة الصوت في الفيديوهات.' },
  ];

  for (const c of commentData) {
    const existing = await get('SELECT id FROM comments WHERE subtask_id = $1 AND user_id = $2', c.subtask_id, c.user_id);
    if (!existing) {
      const created_at = new Date(now - Math.random() * 15 * day).toISOString().replace('T', ' ').slice(0, 19);
      await pool.query('INSERT INTO comments (subtask_id, user_id, content, created_at) VALUES ($1, $2, $3, $4)', [c.subtask_id, c.user_id, c.content, created_at]);
    }
  }
  console.log('✅ 10 comments seeded');

  // ============================================================
  // 7. Update credit scores for users who have warnings
  // ============================================================
  await pool.query("UPDATE users SET credit_score = 9 WHERE id = 105 AND credit_score = 10");
  await pool.query("UPDATE users SET credit_score = 8 WHERE id = 106 AND credit_score = 10");
  await pool.query("UPDATE users SET credit_score = 7 WHERE id = 107 AND credit_score = 10");
  await pool.query("UPDATE users SET credit_score = 6 WHERE id = 108 AND credit_score = 10");
  await pool.query("UPDATE users SET credit_score = 5 WHERE id = 109 AND credit_score = 10");

  console.log('✅ Credit scores updated for warned users');

  // ============================================================
  // 8. Summary
  // ============================================================
  const cnt = async (table: string) => (await get(`SELECT COUNT(*) as c FROM ${table}`)).c;

  console.log('\n📊 Database summary:');
  console.log(`   Users: ${await cnt('users')}`);
  console.log(`   Projects: ${await cnt('projects')}`);
  console.log(`   Tasks: ${await cnt('tasks')}`);
  console.log(`   Subtasks: ${await cnt('subtasks')}`);
  console.log(`   Warnings: ${await cnt('warnings')}`);
  console.log(`   Comments: ${await cnt('comments')}`);
  console.log(`   Notifications: ${await cnt('notifications')}`);
  console.log(`   Attachments: ${await cnt('attachments')}`);
  console.log(`   Warning Types: ${await cnt('warning_types')}`);
  console.log(`   Restriction Levels: ${await cnt('restriction_levels')}`);

  console.log('\n🎉 Data seeding complete!');
  console.log('\n🔑 Login credentials:');
  console.log('   Manager: admin@ingaz.com / admin123');
  console.log('   Manager: ahmed@ingaz.com / ahmed123');
  console.log('   User:    sara@ingaz.com / sara123');
  console.log('   User:    mohamed@ingaz.com / mohamed123');
  console.log('   (All test users have password: name@ingaz.com / name123)');
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1); });
