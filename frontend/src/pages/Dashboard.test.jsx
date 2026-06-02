import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';

vi.mock('../api/client', () => ({
  getDashboard: vi.fn(),
}));

vi.mock('../components/ShimmerLoading', () => ({
  ShimmerDashboard: () => <div>shimmer</div>,
}));

import { getDashboard } from '../api/client';

const DASHBOARD_DATA = {
  total_products: 42,
  total_customers: 15,
  total_orders: 200,
  low_stock_threshold: 10,
  low_stock_products: [
    { id: 1, name: 'Widget A', sku: 'WA-001', quantity: 3 },
    { id: 2, name: 'Gadget B', sku: 'GB-002', quantity: 7 },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe('Dashboard page', () => {
  it('shows shimmer loader while data is being fetched', () => {
    getDashboard.mockReturnValue(new Promise(() => {}));
    render(<Dashboard />);
    expect(screen.getByText('shimmer')).toBeInTheDocument();
  });

  it('renders stat cards after data loads', async () => {
    getDashboard.mockResolvedValue({ data: DASHBOARD_DATA });
    render(<Dashboard />);

    await waitFor(() => expect(screen.queryByText('shimmer')).not.toBeInTheDocument());

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Total Products')).toBeInTheDocument();
    expect(screen.getByText('Total Customers')).toBeInTheDocument();
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
  });

  it('renders low stock products in a table', async () => {
    getDashboard.mockResolvedValue({ data: DASHBOARD_DATA });
    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    expect(screen.getByText('WA-001')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Gadget B')).toBeInTheDocument();
    expect(screen.getByText('GB-002')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows empty stock message when no low-stock products', async () => {
    getDashboard.mockResolvedValue({
      data: { ...DASHBOARD_DATA, low_stock_products: [] },
    });
    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText('All products are sufficiently stocked.')).toBeInTheDocument()
    );
  });

  it('shows an error message when the API call fails', async () => {
    getDashboard.mockRejectedValue(new Error('Network error'));
    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument()
    );
  });
});
