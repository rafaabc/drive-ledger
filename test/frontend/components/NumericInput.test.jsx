import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NumericInput from '@/components/NumericInput';

const mockLang = vi.fn().mockReturnValue('en');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      get language() {
        return mockLang();
      },
    },
  }),
}));

function typeAndCapture(props, typedValue) {
  const onChange = vi.fn();
  render(<NumericInput id="x" name="x" value="" onChange={onChange} {...props} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: typedValue } });
  return onChange;
}

function expectAccepted(onChange, expectedValue) {
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      target: expect.objectContaining({ name: 'x', value: expectedValue }),
    }),
  );
}

describe('NumericInput — locale-tolerant separator', () => {
  it.each([
    ['en', '5.5', '5.5'],
    ['en', '5,5', '5.5'],
    ['pt-BR', '5,55', '5.55'],
    ['pt-BR', '5.55', '5.55'], // mismatched keyboard still accepted
  ])('accepts %s typing "%s" and normalizes to "%s"', (lang, typed, expected) => {
    mockLang.mockReturnValue(lang);
    expectAccepted(typeAndCapture({}, typed), expected);
  });

  it.each(['en', 'pt-BR'])('renders type=text with inputMode=decimal under %s', (lang) => {
    mockLang.mockReturnValue(lang);
    render(<NumericInput id="x" name="x" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it.each([
    ['en', '5.5', '5.5'],
    ['pt-BR', '5.50', '5,50'],
  ])('displays a stored value under %s as "%s"', (lang, stored, displayed) => {
    mockLang.mockReturnValue(lang);
    render(<NumericInput id="x" name="x" value={stored} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue(displayed);
  });

  it.each([
    ['en', 'e.g. 5.50'],
    ['pt-BR', 'e.g. 5,50'],
  ])('renders the placeholder separator for %s', (lang, expectedPlaceholder) => {
    mockLang.mockReturnValue(lang);
    render(<NumericInput id="x" name="x" value="" onChange={vi.fn()} placeholder="e.g. 5.50" />);
    expect(screen.getByPlaceholderText(expectedPlaceholder)).toBeInTheDocument();
  });

  describe('rejections (pt-BR)', () => {
    beforeEach(() => mockLang.mockReturnValue('pt-BR'));
    afterEach(() => mockLang.mockReturnValue('en'));

    it.each([
      ['non-numeric characters', '5,5', 'abc'],
      ['more than one separator', '5,5', '5,5,'],
    ])('rejects %s', (_label, initial, typed) => {
      const onChange = vi.fn();
      render(<NumericInput id="x" name="x" value={initial} onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: typed } });
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

describe('NumericInput — integer mode', () => {
  it.each(['5,5', '5.5'])('rejects a decimal separator ("%s")', (typed) => {
    expect(typeAndCapture({ integer: true }, typed)).not.toHaveBeenCalled();
  });

  it('accepts digits only', () => {
    expectAccepted(typeAndCapture({ integer: true }, '12500'), '12500');
  });
});
