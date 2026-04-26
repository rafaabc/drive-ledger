import { render, screen } from '@testing-library/react';
import ErrorBanner from '../../src/components/ErrorBanner.jsx';

describe('ErrorBanner', () => {
  test('should render nothing when message is an empty string', () => {
    // Arrange + Act
    const { container } = render(<ErrorBanner message="" />);
    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  test('should render nothing when message prop is omitted', () => {
    // Arrange + Act
    const { container } = render(<ErrorBanner />);
    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  test('should render with alert-error class by default', () => {
    // Arrange + Act
    render(<ErrorBanner message="Something went wrong" />);
    // Assert
    expect(screen.getByText('Something went wrong')).toHaveClass('alert-error');
  });

  test('should render with alert-info class when type is info', () => {
    // Arrange + Act
    render(<ErrorBanner message="Info message" type="info" />);
    // Assert
    expect(screen.getByText('Info message')).toHaveClass('alert-info');
  });

  test('should render with alert-success class when type is success', () => {
    // Arrange + Act
    render(<ErrorBanner message="Done!" type="success" />);
    // Assert
    expect(screen.getByText('Done!')).toHaveClass('alert-success');
  });
});
