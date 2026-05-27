import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import socket from '../lib/socket'

export function useSocketAuth() {
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      if (state.user) {
        if (!socket.connected) {
          socket.auth = { token: state.token }
          socket.connect()
        }
        socket.emit('join:user', state.user.id)
      } else {
        socket.disconnect()
      }
    })
    return () => unsub()
  }, [])
}
