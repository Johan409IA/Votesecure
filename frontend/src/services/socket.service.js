import { io } from 'socket.io-client';

let socketInstance = null;

export const getSocket = () => {
  if (!socketInstance) {
    const token = localStorage.getItem('token');
    socketInstance = io('/', {
      auth: { token },
      autoConnect: false,
    });
  }
  return socketInstance;
};

export const conectarSocket = () => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const desconectarSocket = () => {
  if (socketInstance?.connected) socketInstance.disconnect();
};
