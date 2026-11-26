import { describe, expect, it } from '@jest/globals';
import { spaceImageSrc } from './image';
describe('Space images', () => {
  it('prefers a custom image', () => { expect(spaceImageSrc({ name: 'Cancha', type: 'cancha', imageUrl: ' /custom.jpg ' })).toBe('/custom.jpg'); });
  it.each([
    ['Otro', ' COLISEO ', 'coliseo-robledo'], ['Coliseo', 'otro', 'coliseo-robledo'],
    ['Gimnasio', 'otro', 'gimnasio'], ['Gym', 'otro', 'gimnasio'],
    ['Cancha', 'otro', 'cancha-sintetica'], ['Pista', 'otro', 'cancha-sintetica'], ['Sintetica', 'otro', 'cancha-sintetica'],
  ])('selects image for %s %s', (name, type, file) => { expect(spaceImageSrc({ name, type })).toContain(file); });
  it('returns no image for an unknown space', () => { expect(spaceImageSrc({ name: 'Otro', type: 'otro', imageUrl: '' })).toBeNull(); });
});
