import type { Space } from '../api/types';

const PHOTOS_BY_TYPE: Record<string, string> = {
  coliseo: '/spaces/coliseo-robledo.jpg',
  gimnasio: '/spaces/gimnasio.jpg',
  pista: '/spaces/cancha-sintetica.jpg',
  cancha: '/spaces/cancha-sintetica.jpg',
};

export function spaceImageSrc(space: Pick<Space, 'name' | 'type'> & { imageUrl?: string | null }): string | null {
  const custom = space.imageUrl?.trim();
  if (custom) {
    return custom;
  }

  const typePhoto = PHOTOS_BY_TYPE[space.type.trim().toLowerCase()];
  if (typePhoto) {
    return typePhoto;
  }

  const name = space.name.trim().toLowerCase();
  if (name.includes('coliseo')) {
    return PHOTOS_BY_TYPE.coliseo;
  }
  if (name.includes('gimnasio') || name.includes('gym')) {
    return PHOTOS_BY_TYPE.gimnasio;
  }
  if (name.includes('cancha') || name.includes('pista') || name.includes('sintetic')) {
    return PHOTOS_BY_TYPE.pista;
  }

  return null;
}
