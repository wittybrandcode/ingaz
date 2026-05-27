import { useEffect } from 'react'
import socket from './socket'
import { useAppStore } from '../store/appStore'
import { useMemberStore } from '../store/memberStore'
import type { Comment } from '../types'

socket.on('connect_error', (err) => {
  if (err.message === 'Invalid token') socket.disconnect()
})

socket.on('subtask:updated', (data: { id: number; status: string }) => {
  useAppStore.getState().pushSubtaskUpdate(data)
})

socket.on('list:update', (data: { type: string; action: string; data: Record<string, unknown> }) => {
  useAppStore.getState().pushListUpdate(data)
})

socket.on('user:online', (userId: number) => {
  useMemberStore.getState().setOnline(userId, true)
})

socket.on('user:offline', (userId: number) => {
  useMemberStore.getState().setOnline(userId, false)
})

socket.on('online:list', (userIds: number[]) => {
  const setOnline = useMemberStore.getState().setOnline
  userIds.forEach(id => setOnline(id, true))
})

socket.on('notification', (notif: unknown) => {
  useAppStore.getState().pushNotification(notif)
})

socket.on('comment:new', (comment: Comment) => {
  useAppStore.getState().pushComment(comment)
})

socket.on('comment:winner-selected', (data: { commentId: number; subtaskId: number }) => {
  useAppStore.getState().setWinnerSelected(data)
})

export function useSubtaskUpdates(handler: (data: any) => void, deps: any[] = []) {
  useEffect(() => {
    socket.on('subtask:updated', handler)
    return () => { socket.off('subtask:updated', handler) }
  }, deps)
}

export function useListUpdates(handler: (data: { type: string; action: string; data: Record<string, unknown> }) => void, deps: any[] = []) {
  useEffect(() => {
    socket.on('list:update', handler)
    return () => { socket.off('list:update', handler) }
  }, deps)
}

export function useComments(subtaskId: number, handler: (comment: Comment) => void, deps: any[] = []) {
  useEffect(() => {
    const cb = (c: Comment) => { if (c.subtask_id === subtaskId) handler(c) }
    socket.on('comment:new', cb)
    return () => { socket.off('comment:new', cb) }
  }, [subtaskId, ...deps])
}

export function useNotifications(handler: (notif: unknown) => void, deps: any[] = []) {
  useEffect(() => {
    socket.on('notification', handler)
    return () => { socket.off('notification', handler) }
  }, deps)
}

export function useWinnerSelected(handler: (data: { commentId: number; subtaskId: number }) => void, deps: any[] = []) {
  useEffect(() => {
    socket.on('comment:winner-selected', handler)
    return () => { socket.off('comment:winner-selected', handler) }
  }, deps)
}

export function useOnlineStatus(userId: number | undefined) {
  const isOnline = useMemberStore(s => userId ? s.onlineUsers.has(userId) : false)
  return isOnline
}

export default socket
