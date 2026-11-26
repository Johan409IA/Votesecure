import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModalConfirmarVoto from './ModalConfirmarVoto';
import ModalVotoRegistrado from './ModalVotoRegistrado';
import { emitirVoto } from '../services/votacion.service';


export default function FlujoVoto({ eleccion, seccion, candidatura, alCancelar, enviarVoto = emitirVoto }) {
  const [paso, setPaso] = useState('confirmar'); // 'confirmar' | 'registrado'
  const navigate = useNavigate();

  if (paso === 'registrado') {
    return (
      <ModalVotoRegistrado
        alVolverAlCurso={() => navigate(`/cursos/${seccion.id}`, { replace: true })}
        alVerResultados={() => navigate(`/cursos/${seccion.id}/resultados`, { replace: true })}
      />
    );
  }

  return (
    <ModalConfirmarVoto
      candidatura={candidatura}
      nombreCurso={seccion.courseName}
      codigoSeccion={seccion.code}
      alConfirmar={() => enviarVoto(eleccion.id, candidatura.id)}
      alVolver={alCancelar}
      alRegistrado={() => setPaso('registrado')}
    />
  );
}