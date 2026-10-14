import { useState, useCallback } from 'react';
import { verificarDni } from '../services/reniec.service';

/**
 * Hook personalizado que encapsula el flujo de verificación de identidad
 * contra RENIEC: estado de carga, error y datos de la persona verificada.
 */
export function useReniec() {
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');
  const [persona, setPersona] = useState(null); // { dni, nombreCompleto, ... }

  const verificar = useCallback(async (dni) => {
    setError('');
    setPersona(null);

    if (!/^\d{8}$/.test(dni || '')) {
      setError('Ingresa un DNI válido de 8 dígitos');
      return null;
    }

    setVerificando(true);
    try {
      const data = await verificarDni(dni);
      setPersona(data);
      return data;
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo verificar el DNI');
      return null;
    } finally {
      setVerificando(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPersona(null);
    setError('');
  }, []);

  return { verificar, verificando, error, persona, reset };
}
