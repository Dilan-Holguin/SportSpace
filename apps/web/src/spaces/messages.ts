import { ApiError } from '../api/http';

export function toSpaceAdminErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'Solo el personal autorizado puede gestionar espacios.';
    }
    if (error.status === 404) {
      return 'No encontramos ese espacio.';
    }
    if (error.status === 400) {
      return 'Revisa nombre, tipo, campus, capacidad y reglas de uso.';
    }
    if (error.message) {
      return error.message;
    }
  }

  return 'No hay conexión con el servidor. ¿Está corriendo la API?';
}

export function validateSpaceDraft(draft: {
  name: string;
  type: string;
  campus: string;
  capacity: string;
  usageRules: string;
}): string | null {
  if (draft.name.trim().length < 2) {
    return 'El nombre debe tener al menos 2 caracteres.';
  }
  if (draft.type.trim().length < 2) {
    return 'El tipo debe tener al menos 2 caracteres.';
  }
  if (draft.campus.trim().length < 2) {
    return 'El campus debe tener al menos 2 caracteres.';
  }
  const capacity = Number(draft.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    return 'La capacidad debe ser un número entero de al menos 1.';
  }
  if (draft.usageRules.trim().length < 1) {
    return 'Indica las reglas de uso del espacio.';
  }
  return null;
}
