import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

function setup(props) {
  const onPage = vi.fn();
  render(<Pagination onPage={onPage} {...props} />);
  return { onPage };
}

describe('Pagination', () => {
  it('shows "No results" when total is 0', () => {
    setup({ page: 1, pages: 1, total: 0, size: 10 });
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('shows correct range for first page', () => {
    setup({ page: 1, pages: 3, total: 25, size: 10 });
    expect(screen.getByText('1–10 of 25')).toBeInTheDocument();
  });

  it('shows correct range for middle page', () => {
    setup({ page: 2, pages: 3, total: 25, size: 10 });
    expect(screen.getByText('11–20 of 25')).toBeInTheDocument();
  });

  it('shows correct range for last page with partial results', () => {
    setup({ page: 3, pages: 3, total: 25, size: 10 });
    expect(screen.getByText('21–25 of 25')).toBeInTheDocument();
  });

  it('disables Prev button on the first page', () => {
    setup({ page: 1, pages: 3, total: 25, size: 10 });
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
  });

  it('disables Next button on the last page', () => {
    setup({ page: 3, pages: 3, total: 25, size: 10 });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('enables both buttons on a middle page', () => {
    setup({ page: 2, pages: 3, total: 25, size: 10 });
    expect(screen.getByRole('button', { name: 'Prev' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
  });

  it('calls onPage with page - 1 when Prev is clicked', async () => {
    const user = userEvent.setup();
    const { onPage } = setup({ page: 2, pages: 3, total: 25, size: 10 });
    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it('calls onPage with page + 1 when Next is clicked', async () => {
    const user = userEvent.setup();
    const { onPage } = setup({ page: 2, pages: 3, total: 25, size: 10 });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it('displays current page and total pages', () => {
    setup({ page: 2, pages: 5, total: 50, size: 10 });
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });
});
