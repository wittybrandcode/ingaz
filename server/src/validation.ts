import { z } from 'zod';

const MAX_TITLE = 200;
const MAX_DESC = 5000;
const MAX_EMAIL = 254;
const MAX_PASSWORD = 128;
const MAX_REASON = 2000;
const MAX_NOTES = 2000;
const MAX_TEXT = 2000;
const MAX_LINK = 500;
const MAX_STATUS = 50;
const MAX_NAME = 200;

export function validate(schema: any) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.errors[0];
      return res.fail(400, first.message);
    }
    req.body = result.data;
    next();
  };
}

export const loginSchema = z.object({
  email: z.string({ message: 'البريد الإلكتروني مطلوب' }).email('بريد إلكتروني غير صالح').max(MAX_EMAIL),
  password: z.string({ message: 'كلمة المرور مطلوبة' }).min(1, 'كلمة المرور مطلوبة').max(MAX_PASSWORD),
});

export const createUserSchema = z.object({
  name: z.string({ message: 'الاسم مطلوب' }).min(1, 'الاسم مطلوب').max(MAX_NAME),
  email: z.string({ message: 'البريد الإلكتروني مطلوب' }).email('بريد إلكتروني غير صالح').max(MAX_EMAIL),
  password: z.string({ message: 'كلمة المرور مطلوبة' }).min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').max(MAX_PASSWORD),
  role_id: z.number({ message: 'الدور مطلوب' }).int().positive(),
  status: z.string().max(MAX_STATUS).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'الاسم لا يمكن أن يكون فارغاً').max(MAX_NAME).optional(),
  email: z.string().email('بريد إلكتروني غير صالح').max(MAX_EMAIL).optional(),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').max(MAX_PASSWORD).optional(),
  role_id: z.number({ message: 'الدور مطلوب' }).int().positive().optional(),
  status: z.string().max(MAX_STATUS).optional(),
});

export const createProjectSchema = z.object({
  title: z.string({ message: 'عنوان المشروع مطلوب' }).min(1, 'عنوان المشروع مطلوب').max(MAX_TITLE),
  description: z.string().max(MAX_DESC).optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(MAX_TITLE).optional(),
  description: z.string().max(MAX_DESC).optional(),
  status: z.string().max(MAX_STATUS).optional(),
});

export const createTaskSchema = z.object({
  project_id: z.number({ message: 'المشروع مطلوب' }).int().positive(),
  title: z.string({ message: 'عنوان المهمة مطلوب' }).min(1, 'عنوان المهمة مطلوب').max(MAX_TITLE),
  description: z.string().max(MAX_DESC).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(MAX_TITLE).optional(),
  description: z.string().max(MAX_DESC).optional(),
  status: z.string().max(MAX_STATUS).optional(),
});

export const createSubtaskSchema = z.object({
  task_id: z.number({ message: 'المهمة مطلوبة' }).int().positive(),
  title: z.string({ message: 'العنوان مطلوب' }).min(1, 'العنوان مطلوب').max(MAX_TITLE),
  description: z.string().max(MAX_DESC).optional().nullable(),
  assigned_to: z.number().int().positive().optional().nullable(),
  deadline: z.string().max(MAX_STATUS).optional().nullable(),
});

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(MAX_TITLE).optional(),
  description: z.string().max(MAX_DESC).optional(),
  assigned_to: z.number().int().positive().optional().nullable(),
  deadline: z.string().max(MAX_STATUS).optional().nullable(),
  status: z.string().max(MAX_STATUS).optional(),
});

export const createWarningTypeSchema = z.object({
  name: z.string({ message: 'الاسم مطلوب' }).min(1, 'الاسم مطلوب').max(MAX_NAME),
  description: z.string().max(MAX_DESC).optional().nullable(),
  points: z.number().int().min(0).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});

export const updateWarningTypeSchema = z.object({
  name: z.string().min(1).max(MAX_NAME).optional(),
  description: z.string().max(MAX_DESC).optional().nullable(),
  points: z.number().int().min(0).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});

export const createWarningSchema = z.object({
  user_id: z.number({ message: 'المستخدم مطلوب' }).int().positive(),
  reason: z.string({ message: 'السبب مطلوب' }).min(1, 'السبب مطلوب').max(MAX_REASON),
  deadline_hours: z.number().int().positive().optional(),
  warning_type_id: z.number().int().positive().optional().nullable(),
});

export const respondWarningSchema = z.object({
  response_text: z.string({ message: 'نص الرد مطلوب' }).min(1, 'نص الرد مطلوب').max(MAX_TEXT),
});

export const createRoleSchema = z.object({
  name: z.string({ message: 'الاسم مطلوب' }).min(1, 'الاسم مطلوب').max(MAX_NAME),
});

export const updateRoleSchema = z.object({
  name: z.string({ message: 'الاسم مطلوب' }).min(1, 'الاسم مطلوب').max(MAX_NAME),
});

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string(), { message: 'مصفوفة الصلاحيات مطلوبة' }),
});

export const createCommentSchema = z.object({
  subtask_id: z.number({ message: 'المهمة الفرعية مطلوبة' }).int().positive(),
  content: z.string({ message: 'نص التعليق مطلوب' }).min(1, 'نص التعليق مطلوب').max(MAX_TEXT),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(MAX_NAME).optional(),
  password: z.string().min(6).max(MAX_PASSWORD).optional(),
  avatar: z.string().max(MAX_NAME).optional(),
});

export const updateNotificationPrefSchema = z.object({
  enabled: z.number().int().min(0).max(1).optional(),
  channels: z.array(z.string()).optional(),
});

export const uploadSchema = z.object({
  entity_type: z.enum(['project', 'task', 'subtask', 'comment'], { message: 'نوع الكيان غير صالح' }),
  entity_id: z.coerce.number({ message: 'معرف الكيان مطلوب' }).int().positive(),
});
