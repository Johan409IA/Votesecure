export class AppError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDACION', message);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Se requiere iniciar sesion') {
    super(401, 'NO_AUTENTICADO', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No autorizado') {
    super(403, 'PROHIBIDO', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(404, 'NO_ENCONTRADO', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICTO', message);
  }
}

export class BusinessError extends AppError {
  constructor(message: string) {
    super(422, 'NEGOCIO', message);
  }
}
