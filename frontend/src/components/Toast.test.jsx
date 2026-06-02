import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toast from './Toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('renders the message text', () => {
    render(<Toast message="Saved successfully" type="success" onClose={vi.fn()} />);
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('applies green styling for success type', () => {
    render(<Toast message="OK" type="success" onClose={vi.fn()} />);
    expect(screen.getByText('OK')).toHaveClass('bg-green-600');
  });

  it('applies red styling for error type', () => {
    render(<Toast message="Oops" type="error" onClose={vi.fn()} />);
    expect(screen.getByText('Oops')).toHaveClass('bg-red-600');
  });

  it('calls onClose after 3 seconds', () => {
    const onClose = vi.fn();
    render(<Toast message="Hey" type="success" onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3000));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose before 3 seconds', () => {
    const onClose = vi.fn();
    render(<Toast message="Hey" type="success" onClose={onClose} />);
    act(() => vi.advanceTimersByTime(2999));
    expect(onClose).not.toHaveBeenCalled();
  });
});
