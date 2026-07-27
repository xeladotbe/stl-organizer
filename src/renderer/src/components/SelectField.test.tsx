import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField } from './SelectField';

const options = [
  { value: '1', label: 'Vases' },
  { value: '2', label: 'Brackets' }
];

describe('SelectField', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(
      <SelectField value={null} placeholder="No category" options={options} onChange={vi.fn()} />
    );
    expect(screen.getByText('No category')).toBeInTheDocument();
  });

  it("shows the selected option's label", () => {
    render(
      <SelectField value="2" placeholder="No category" options={options} onChange={vi.fn()} />
    );
    expect(screen.getByText('Brackets')).toBeInTheDocument();
  });

  it('calls onChange with the option value when an option is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectField value={null} placeholder="No category" options={options} onChange={onChange} />
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Vases' }));
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('calls onChange with null when the placeholder option is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectField value="1" placeholder="No category" options={options} onChange={onChange} />
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'No category' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
