import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useMemberStore } from '../store/memberStore';

const socket = io(import.meta.env.PROD ? '/' : 'http://localhost:3001', {
  transports: ['polling', 'websocket'],
  autoConnect: false
});

socket.on('connect_error', (err) => {
  console.warn('Socket connection error:', err.message);
  if (err.message === 'Invalid token') {
    socket.disconnect();
  }
});

socket.on('disconnect', (reason) => {
  if (reason !== 'io client disconnect') {
    console.warn('Socket disconnected:', reason);
  }
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('subtask:updated', (data: { id: number; status: string }) => {
  useAppStore.getState().pushSubtaskUpdate(data);
});

socket.on('list:update', (data: { type: string; action: string; data: Record<string, unknown> }) => {
  useAppStore.getState().pushListUpdate(data);
});

socket.on('user:online', (userId: number) => {
  useMemberStore.getState().setOnline(userId, true);
});

socket.on('user:offline', (userId: number) => {
  useMemberStore.getState().setOnline(userId, false);
});

let prevUserId: number | null = null;
useAuthStore.subscribe((state) => {
  if (state.user && state.user.id !== prevUserId) {
    prevUserId = state.user.id;
    if (!socket.connected) {
      socket.auth = { token: state.token };
      socket.connect();
    }
    socket.emit('join:user', state.user.id);
  } else if (!state.user && prevUserId) {
    prevUserId = null;
    socket.disconnect();
  }
});

export default socket;
