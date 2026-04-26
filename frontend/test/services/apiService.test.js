import { authApi, expensesApi } from '../../src/services/apiService.js';

function mockOk(body, status = 200) {
  return {
    ok: true,
    status,
    json: async () => body,
  };
}

function mockError(status, body = {}) {
  return {
    ok: false,
    status,
    json: async () => body,
  };
}

describe('apiService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    localStorage.clear();
  });

  describe('request() — headers & auth', () => {
    test('should inject Authorization header when token exists in localStorage', async () => {
      // Arrange
      localStorage.setItem('token', 'my.test.token');
      fetch.mockResolvedValueOnce(mockOk({ id: 1 }));
      // Act
      await expensesApi.get('1');
      // Assert
      const [, options] = fetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer my.test.token');
    });

    test('should omit Authorization header when auth is false', async () => {
      // Arrange
      localStorage.setItem('token', 'tok');
      fetch.mockResolvedValueOnce(mockOk({ token: 'x' }));
      // Act
      await authApi.login({ username: 'a', password: 'b' });
      // Assert
      const [, options] = fetch.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    test('should send JSON body and Content-Type header on POST', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockOk({}));
      // Act
      await authApi.register({ username: 'user', password: 'pass' });
      // Assert
      const [, options] = fetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.body).toBe(JSON.stringify({ username: 'user', password: 'pass' }));
    });
  });

  describe('request() — 401/403 handling', () => {
    test('should clear token, dispatch auth:logout event, and throw on 401', async () => {
      // Arrange
      localStorage.setItem('token', 'tok');
      fetch.mockResolvedValueOnce(mockError(401));
      const events = [];
      window.addEventListener('auth:logout', (e) => events.push(e));
      // Act + Assert
      await expect(expensesApi.get('1')).rejects.toThrow('Session expired');
      expect(localStorage.getItem('token')).toBeNull();
      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({ expired: true });
      window.removeEventListener('auth:logout', events[0]);
    });

    test('should clear token and throw with status 403 on forbidden response', async () => {
      // Arrange
      localStorage.setItem('token', 'tok');
      fetch.mockResolvedValueOnce(mockError(403));
      // Act + Assert
      await expect(expensesApi.get('1')).rejects.toMatchObject({ status: 403 });
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('request() — error responses', () => {
    test('should throw with message from error JSON body', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockError(400, { message: 'Bad request error' }));
      // Act + Assert
      await expect(authApi.register({ username: 'u', password: 'p' })).rejects.toMatchObject({
        message: 'Bad request error',
        status: 400,
      });
    });

    test('should use fallback message when error body is not valid JSON', async () => {
      // Arrange
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => { throw new Error('not json'); },
      });
      // Act + Assert
      await expect(authApi.register({ username: 'u', password: 'p' })).rejects.toMatchObject({
        message: 'Request failed: 422',
      });
    });
  });

  describe('request() — success responses', () => {
    test('should return null on 204 No Content', async () => {
      // Arrange
      fetch.mockResolvedValueOnce({ ok: true, status: 204 });
      // Act
      const result = await expensesApi.remove('1');
      // Assert
      expect(result).toBeNull();
    });

    test('should return parsed JSON body on 200', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockOk({ id: 42, amount: 99.9 }));
      // Act
      const result = await expensesApi.get('42');
      // Assert
      expect(result).toEqual({ id: 42, amount: 99.9 });
    });
  });

  describe('expensesApi.list() — query string building', () => {
    test('should call /expenses with no query string when all filters are empty', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockOk([]));
      // Act
      await expensesApi.list({});
      // Assert
      const [url] = fetch.mock.calls[0];
      expect(url).toBe('/api/expenses');
    });

    test('should build full query string when all filters are provided', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockOk([]));
      // Act
      await expensesApi.list({ category: 'Fuel', year: '2026', month: 4 });
      // Assert
      const [url] = fetch.mock.calls[0];
      expect(url).toBe('/api/expenses?category=Fuel&year=2026&month=4');
    });

    test('should include only year when only year is provided', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockOk([]));
      // Act
      await expensesApi.list({ year: '2026' });
      // Assert
      const [url] = fetch.mock.calls[0];
      expect(url).toBe('/api/expenses?year=2026');
    });
  });

  describe('expensesApi CRUD endpoints', () => {
    test('should call correct path and method for get, create, update, remove', async () => {
      // Arrange
      fetch
        .mockResolvedValueOnce(mockOk({ id: '5' }))
        .mockResolvedValueOnce(mockOk({ id: '6' }))
        .mockResolvedValueOnce(mockOk({ id: '5' }))
        .mockResolvedValueOnce({ ok: true, status: 204 });

      // Act + Assert — get
      await expensesApi.get('5');
      expect(fetch.mock.calls[0][0]).toBe('/api/expenses/5');
      expect(fetch.mock.calls[0][1].method).toBe('GET');

      // Act + Assert — create
      await expensesApi.create({ category: 'Fuel', litres: 40 });
      expect(fetch.mock.calls[1][0]).toBe('/api/expenses');
      expect(fetch.mock.calls[1][1].method).toBe('POST');

      // Act + Assert — update
      await expensesApi.update('5', { category: 'Fuel' });
      expect(fetch.mock.calls[2][0]).toBe('/api/expenses/5');
      expect(fetch.mock.calls[2][1].method).toBe('PUT');

      // Act + Assert — remove
      await expensesApi.remove('5');
      expect(fetch.mock.calls[3][0]).toBe('/api/expenses/5');
      expect(fetch.mock.calls[3][1].method).toBe('DELETE');
    });
  });

  describe('expensesApi.summary()', () => {
    test('should build correct query string for summary', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockOk({}));
      // Act
      await expensesApi.summary({ year: '2026', month: '3', category: 'Fuel' });
      // Assert
      const [url] = fetch.mock.calls[0];
      expect(url).toBe('/api/expenses/summary?year=2026&month=3&category=Fuel');
    });
  });

  describe('authApi', () => {
    test('should POST to /auth/register without an Authorization header', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockOk({}));
      // Act
      await authApi.register({ username: 'u', password: 'p' });
      // Assert
      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('/api/auth/register');
      expect(options.headers['Authorization']).toBeUndefined();
    });

    test('should POST to /auth/login without an Authorization header', async () => {
      // Arrange
      fetch.mockResolvedValueOnce(mockOk({ token: 'abc' }));
      // Act
      await authApi.login({ username: 'u', password: 'p' });
      // Assert
      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('/api/auth/login');
      expect(options.headers['Authorization']).toBeUndefined();
    });
  });
});
