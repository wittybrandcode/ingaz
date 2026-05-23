import { Clock, AlertCircle, CheckCircle2, XCircle, Send, MessageSquare } from 'lucide-react'
import type { ComponentType } from 'react'

export interface StatusConfigItem {
  label: string
  icon: ComponentType<{ className?: string }>
  color: string
  bg: string
  dot?: string
}

export type StatusConfig = Record<string, StatusConfigItem>

export const SUBTASK_STATUS_CONFIG: StatusConfig = {
  open: { label: 'مفتوحة', icon: Clock, color: 'text-gray-700', bg: 'bg-gray-100' },
  in_progress: { label: 'قيد التنفيذ', icon: Clock, color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'منفذة', icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'ملغية', icon: XCircle, color: 'text-red-700', bg: 'bg-red-100' },
  deferred: { label: 'مؤجلة', icon: AlertCircle, color: 'text-yellow-700', bg: 'bg-yellow-100' },
}

export const TICKET_STATUS_CONFIG: StatusConfig = {
  pending: { label: 'بانتظار البدء', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  in_progress: { label: 'قيد التنفيذ', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  submitted: { label: 'تم التسليم', icon: Send, color: 'text-yellow-600', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  approved: { label: 'مقبول', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', dot: 'bg-green-500' },
  rejected: { label: 'مرفوض', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', dot: 'bg-red-500' },
}

export const SUBTASK_CARD_STATUS_CONFIG: StatusConfig = {
  pending: { label: 'معلّقة', icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
  in_progress: { label: 'جارية', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  submitted: { label: 'مقدّمة', icon: Send, color: 'text-purple-600', bg: 'bg-purple-50' },
  approved: { label: 'مكتملة', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  rejected: { label: 'مرفوضة', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
}

export const WARNING_STATUS_CONFIG: StatusConfig = {
  pending: { label: 'بانتظار الرد', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  responded: { label: 'تم الرد', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-100' },
  cleared: { label: 'تم الفك', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  sustained: { label: 'قائم', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  ignored: { label: 'تم التجاهل', icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
}
