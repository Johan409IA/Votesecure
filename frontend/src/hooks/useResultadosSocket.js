import { useEffect, useRef, useState, useCallback } from 'react';
import { conectarSocket } from '../services/socket.service';

/**
 * Hook personalizado que suscribe al cliente a los resultados en tiempo
 * real de una elección vía WebSocket (Socket.io) y expone el estado
 * de conexión + los últimos datos recibidos.
 */
export function useResultadosSocket(eleccionId, onResultados, onCambioEstado) {
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef(null);
  const onResultadosRef = useRef(onResultados);
  const onCambioEstadoRef = useRef(onCambioEstado);
  onResultadosRef.current = onResultados;
  onCambioEstadoRef.current = onCambioEstado;

  useEffect(() => {
    const socket = conectarSocket();
    socketRef.current = socket;
    socket.emit('suscribir:eleccion', eleccionId);

    const manejarConexion = () => setConectado(true);
    const manejarDesconexion = () => setConectado(false);
    const manejarResultados = (datos) => {
      if (datos.eleccion_id !== eleccionId) return;
      onResultadosRef.current?.(datos);
    };
    const manejarEstado = (datos) => {
      if (datos.eleccion_id !== eleccionId) return;
      onCambioEstadoRef.current?.(datos);
    };

    socket.on('connect', manejarConexion);
    socket.on('disconnect', manejarDesconexion);
    socket.on('resultados:actualizados', manejarResultados);
    socket.on('eleccion:estado', manejarEstado);
    setConectado(socket.connected);

    return () => {
      socket.emit('desuscribir:eleccion', eleccionId);
      socket.off('connect', manejarConexion);
      socket.off('disconnect', manejarDesconexion);
      socket.off('resultados:actualizados', manejarResultados);
      socket.off('eleccion:estado', manejarEstado);
    };
  }, [eleccionId]);

  return { conectado };
}
