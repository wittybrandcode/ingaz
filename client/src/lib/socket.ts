import { io } from 'socket.io-client'

const socket = io(import.meta.env.PROD ? '/' : 'http://localhost:3001', {
  transports: ['polling', 'websocket'],
  autoConnect: false
});

export default socket
