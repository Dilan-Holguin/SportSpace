import { describe, expect, it } from '@jest/globals';
import { normalizeImageUrl } from './space-image-url';
describe('Image URL normalization', () => {
  it.each([[undefined, undefined], [null, null], [123, undefined], ['', null], ['  ', null], [' https://example.com/image.jpg ', 'https://example.com/image.jpg']])('normalizes %j', (value, expected) => {
    expect(normalizeImageUrl(value)).toBe(expected);
  });
});
