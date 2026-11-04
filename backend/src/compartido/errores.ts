export class ErrorAplicacion extends Error {
  constructor(
    readonly estadoHttp: number,
    readonly codigo: string,
    mensaje: string
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class ErrorValidacion extends ErrorAplicacion {
  constructor(mensaje: string) {
    super(400, 'VALIDACION', mensaje);
  }
}

export class ErrorNoAutenticado extends ErrorAplicacion {
  constructor(mensaje = 'Se requiere iniciar sesion') {
    super(401, 'NO_AUTENTICADO', mensaje);
  }
}

export class ErrorProhibido extends ErrorAplicacion {
  constructor(mensaje = 'No autorizado') {
    super(403, 'PROHIBIDO', mensaje);
  }
}

export class ErrorNoEncontrado extends ErrorAplicacion {
  constructor(mensaje = 'Recurso no encontrado') {
    super(404, 'NO_ENCONTRADO', mensaje);
  }
}

export class ErrorConflicto extends ErrorAplicacion {
  constructor(mensaje: string) {
    super(409, 'CONFLICTO', mensaje);
  }
}

export class ErrorNegocio extends ErrorAplicacion {
  constructor(mensaje: string) {
    super(422, 'NEGOCIO', mensaje);
  }
}
