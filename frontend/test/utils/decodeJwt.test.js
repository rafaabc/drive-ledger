import { decodeJwt } from '../../src/utils/decodeJwt.js';

function makeToken(payload) {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe('decodeJwt', () => {
  test('should return decoded payload object for a valid token', () => {
    // Arrange
    const payload = { id: 1, username: 'alice' };
    const token = makeToken(payload);
    // Act
    const result = decodeJwt(token);
    // Assert
    expect(result).toEqual(payload);
  });

  test('should return null for a malformed token with no dots', () => {
    expect(decodeJwt('invalidtoken')).toBeNull();
  });

  test('should return null when the payload segment is not valid base64', () => {
    expect(decodeJwt('header.!!!.signature')).toBeNull();
  });

  test('should return null when the payload decodes to non-JSON', () => {
    const nonJson = btoa('not-valid-json');
    expect(decodeJwt(`header.${nonJson}.signature`)).toBeNull();
  });

  test('should return null for null input', () => {
    expect(decodeJwt(null)).toBeNull();
  });

  test('should return null for undefined input', () => {
    expect(decodeJwt(undefined)).toBeNull();
  });
});
