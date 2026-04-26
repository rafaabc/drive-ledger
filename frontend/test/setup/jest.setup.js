import '@testing-library/jest-dom';

beforeEach(() => {
  localStorage.clear();
  window.confirm = jest.fn(() => true);
  window.scrollTo = jest.fn();
});
