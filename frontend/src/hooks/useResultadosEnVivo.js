import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { cargarResultados, pedirSuscripcion } from '../services/resultado.service';

// Renovamos el ticket unos segundos antes de su vencimiento (60 s) para que
// la rotacion de canal no deje huecos; el backend publica en la ventana
// actual y la anterior justamente para cubrir ese traslape.
const MARGEN_RENOVACION_MS = 10_000;
const INTERVALO_SONDEO_MS = 10_000;

// Un solo cliente para toda la app (la clave anon es publica).
let clienteRealtime = null;

function clienteSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !clave) return null;
  if (!clienteRealtime) {
    clienteRealtime = createClient(url, clave, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return clienteRealtime;
}

// Carga los resultados de la eleccion y, si estan en vivo, los mantiene
// actualizados: Realtime Broadcast con rotacion de ticket, o sondeo cada
// 10 s si la suscripcion no esta disponible.
export default function useResultadosEnVivo(eleccionId) {
  const [resultado, setResultado] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [conexion, setConexion] = useState(null); // 'realtime' | 'sondeo' | null
  const [error, setError] = useState(null);
  const sondeando = useRef(false);

  useEffect(() => {
    if (!eleccionId) return undefined;
    let activo = true;
    let canal = null;
    let supabase = null;
    let temporizadorRenovacion = null;
    let temporizadorSondeo = null;

    setResultado(null);
    setUltimaActualizacion(null);
    setConexion(null);
    setError(null);
    sondeando.current = false;

    const aplicarCarga = (datos) => {
      setResultado(datos);
      setUltimaActualizacion(new Date());
      return datos;
    };

    const sondear = () => {
      if (sondeando.current || !activo) return;
      sondeando.current = true;
      setConexion('sondeo');
      temporizadorSondeo = setInterval(async () => {
        try {
          const datos = await cargarResultados(eleccionId);
          if (!activo) return;
          aplicarCarga(datos);
          // Al llegar el resultado final dejamos de sondear.
          if (datos.tipo === 'final') clearInterval(temporizadorSondeo);
        } catch {
          // Sin conexion puntual: el siguiente intento lo reintentara.
        }
      }, INTERVALO_SONDEO_MS);
    };

    const renovar = async () => {
      try {
        const { canal: nombre, expiraEn } = await pedirSuscripcion(eleccionId);
        if (!activo) return;
        canal = supabase.channel(nombre, { config: { broadcast: { self: false } } });
        canal
          .on('broadcast', { event: 'resultado' }, ({ payload }) => {
            if (!activo) return;
            if (payload?.estado === 'cerrada') {
              // La eleccion cerro: pedimos la instantanea final publicada.
              cargarResultados(eleccionId).then((datos) => {
                if (activo) aplicarCarga(datos);
              });
            } else {
              setResultado(payload);
              setUltimaActualizacion(new Date());
            }
          })
          .subscribe((estado) => {
            if (estado === 'SUBSCRIBED' && activo) setConexion('realtime');
          });
        const enMs = Math.max(1_000, expiraEn * 1000 - Date.now() - MARGEN_RENOVACION_MS);
        temporizadorRenovacion = setTimeout(() => {
          supabase.removeChannel(canal);
          renovar();
        }, enMs);
      } catch {
        if (activo) sondear();
      }
    };

    cargarResultados(eleccionId)
      .then((datos) => {
        if (!activo) return;
        aplicarCarga(datos);
        if (datos.tipo !== 'en_vivo') return;
        supabase = clienteSupabase();
        if (supabase) {
          renovar();
        } else {
          sondear();
        }
      })
      .catch((err) => {
        if (activo) setError(err);
      });

    return () => {
      activo = false;
      if (temporizadorRenovacion) clearTimeout(temporizadorRenovacion);
      if (temporizadorSondeo) clearInterval(temporizadorSondeo);
      if (canal && supabase) supabase.removeChannel(canal);
    };
  }, [eleccionId]);

  return { resultado, ultimaActualizacion, conexion, error };
}
