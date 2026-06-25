import { render } from '@testing-library/react';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders an accessible checkbox', () => {
    const { getByRole } = render(<Checkbox aria-label="pick" />);
    expect(getByRole('checkbox')).toBeInTheDocument();
  });
});
