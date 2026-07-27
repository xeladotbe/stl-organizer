import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChipComboBox } from './ChipComboBox';

const suggestions = [
  { id: 1, name: 'Bad' },
  { id: 2, name: 'Bracket' }
];

function setup(overrides: Partial<Parameters<typeof ChipComboBox>[0]> = {}): {
  onRemove: ReturnType<typeof vi.fn>;
  onSelectExisting: ReturnType<typeof vi.fn>;
  onCreateNew: ReturnType<typeof vi.fn>;
} {
  const onRemove = vi.fn();
  const onSelectExisting = vi.fn();
  const onCreateNew = vi.fn();
  render(
    <ChipComboBox
      chips={[]}
      suggestions={suggestions}
      placeholder="Add tag…"
      onRemove={onRemove}
      onSelectExisting={onSelectExisting}
      onCreateNew={onCreateNew}
      {...overrides}
    />
  );
  return { onRemove, onSelectExisting, onCreateNew };
}

describe('ChipComboBox', () => {
  it('renders currently-assigned items as chips', () => {
    setup({ chips: [{ id: 3, name: 'Vase' }] });
    expect(screen.getByText('Vase')).toBeInTheDocument();
  });

  it('shows matching suggestions while typing', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByPlaceholderText('Add tag…'), 'brack');
    expect(screen.getByText('Bracket')).toBeInTheDocument();
    expect(screen.queryByText('Bad')).not.toBeInTheDocument();
  });

  it('selects an existing suggestion on click and clears the input', async () => {
    const user = userEvent.setup();
    const { onSelectExisting } = setup();
    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'brack');
    await user.click(screen.getByText('Bracket'));
    expect(onSelectExisting).toHaveBeenCalledWith(2);
    expect(input).toHaveValue('');
  });

  it('offers to create a new entry when nothing matches, and creates it on Enter', async () => {
    const user = userEvent.setup();
    const { onCreateNew } = setup();
    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'Spacer');
    expect(screen.getByText('+ Create "Spacer"')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onCreateNew).toHaveBeenCalledWith('Spacer');
  });

  it('removes a chip via its ✕ button', async () => {
    const user = userEvent.setup();
    const { onRemove } = setup({ chips: [{ id: 3, name: 'Vase' }] });
    await user.click(screen.getByRole('button', { name: 'Remove Vase' }));
    expect(onRemove).toHaveBeenCalledWith(3);
  });

  it('calls onChipClick (not onRemove) when a chip is clicked and onChipClick is provided', async () => {
    const user = userEvent.setup()
    const onChipClick = vi.fn()
    const { onRemove } = setup({ chips: [{ id: 3, name: 'Vase' }], onChipClick })
    await user.click(screen.getByText('Vase'))
    expect(onChipClick).toHaveBeenCalledWith(3)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('renders a plain (non-clickable) chip name when onChipClick is not provided', () => {
    setup({ chips: [{ id: 3, name: 'Vase' }] })
    expect(screen.queryByRole('button', { name: 'Vase' })).not.toBeInTheDocument()
    expect(screen.getByText('Vase')).toBeInTheDocument()
  })

  it('still removes via the ✕ button when onChipClick is also provided', async () => {
    const user = userEvent.setup()
    const { onRemove } = setup({
      chips: [{ id: 3, name: 'Vase' }],
      onChipClick: vi.fn()
    })
    await user.click(screen.getByRole('button', { name: 'Remove Vase' }))
    expect(onRemove).toHaveBeenCalledWith(3)
  })

  it('removes the last chip on Backspace when the input is empty', async () => {
    const user = userEvent.setup();
    const { onRemove } = setup({
      chips: [
        { id: 3, name: 'Vase' },
        { id: 4, name: 'Bracket' }
      ]
    });
    // The placeholder only shows when there are no chips yet, so once a chip is present the
    // input must be queried by role instead.
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Backspace}');
    expect(onRemove).toHaveBeenCalledWith(4);
  });

  it('does not remove a chip on Backspace when the input has text', async () => {
    const user = userEvent.setup();
    const { onRemove } = setup({ chips: [{ id: 3, name: 'Vase' }] });
    await user.type(screen.getByRole('textbox'), 'x');
    await user.keyboard('{Backspace}');
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('navigates suggestions with arrow keys and selects with Enter', async () => {
    const user = userEvent.setup();
    const { onSelectExisting } = setup();
    const input = screen.getByPlaceholderText('Add tag…');
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelectExisting).toHaveBeenCalledWith(2);
  });
});
