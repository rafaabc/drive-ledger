import { render } from '@testing-library/react';
import Loading from '../../src/components/Loading.jsx';

describe('Loading', () => {
  test('should render an element with the spinner class', () => {
    // Arrange + Act
    const { container } = render(<Loading />);
    // Assert
    expect(container.querySelector('.spinner')).toBeInTheDocument();
  });
});
