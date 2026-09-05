import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CompleteReminderDialog from '@/components/CompleteReminderDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }),
}));
vi.mock('@/utils/formatDate.js', () => ({ formatDate: (d) => d }));

const reminder = { id: 'r1', title: 'Oil change', dueDate: '2026-06-01' };
const reminderWithRecurrence = { ...reminder, intervalMonths: 3, intervalKm: 5000 };

describe('CompleteReminderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when open=false', () => {
    const { container } = render(
      <CompleteReminderDialog
        open={false}
        reminder={reminder}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when reminder is null', () => {
    const { container } = render(
      <CompleteReminderDialog open reminder={null} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render km input when open', () => {
    render(
      <CompleteReminderDialog open reminder={reminder} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText('reminders.actions.completedKm')).toBeInTheDocument();
  });

  it('should keep submit disabled when km is empty', () => {
    render(
      <CompleteReminderDialog open reminder={reminder} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('common.save')).toBeDisabled();
  });

  it('should enable submit when valid km entered', () => {
    render(
      <CompleteReminderDialog open reminder={reminder} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12000' } });
    expect(screen.getByText('common.save')).not.toBeDisabled();
  });

  it('should call onSubmit with parsed km on form submit', () => {
    const onSubmit = vi.fn();
    render(
      <CompleteReminderDialog open reminder={reminder} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12000' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));
    expect(onSubmit).toHaveBeenCalledWith(12000);
  });

  it('should call onCancel when cancel clicked', () => {
    const onCancel = vi.fn();
    render(
      <CompleteReminderDialog open reminder={reminder} onSubmit={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should show preview when reminder has intervalKm', () => {
    render(
      <CompleteReminderDialog
        open
        reminder={reminderWithRecurrence}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10000' } });
    expect(screen.getByText(/completePreview/)).toBeInTheDocument();
  });
});
