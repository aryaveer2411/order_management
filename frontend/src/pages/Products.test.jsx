import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Products from './Products';

vi.mock('../api/client', () => ({
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  getDashboard: vi.fn(),
}));

vi.mock('../components/ShimmerLoading', () => ({
  ShimmerTableRows: () => <tr><td>loading...</td></tr>,
}));

import { getProducts, createProduct, updateProduct, deleteProduct, getDashboard } from '../api/client';

const PRODUCTS_PAGE = {
  items: [
    { id: 1, name: 'Widget A', sku: 'WA-001', price: 9.99, quantity: 50 },
    { id: 2, name: 'Gadget B', sku: 'GB-002', price: 24.99, quantity: 5 },
  ],
  total: 2,
  pages: 1,
  size: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  getDashboard.mockResolvedValue({ data: { low_stock_threshold: 10 } });
  getProducts.mockResolvedValue({ data: PRODUCTS_PAGE });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('Products page', () => {
  it('renders the product list after loading', async () => {
    render(<Products />);

    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    expect(screen.getByText('WA-001')).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('Gadget B')).toBeInTheDocument();
    expect(screen.getByText('GB-002')).toBeInTheDocument();
    expect(screen.getByText('$24.99')).toBeInTheDocument();
  });

  it('shows "No products yet" when the list is empty', async () => {
    getProducts.mockResolvedValue({
      data: { items: [], total: 0, pages: 1, size: 10 },
    });
    render(<Products />);
    await waitFor(() => expect(screen.getByText('No products yet')).toBeInTheDocument());
  });

  it('highlights low-stock quantities in red', async () => {
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    // quantity 5 is below threshold of 10 → red
    expect(screen.getByText('5')).toHaveClass('text-red-600');
    // quantity 50 is above threshold → green
    expect(screen.getByText('50')).toHaveClass('text-green-600');
  });

  it('opens the Add Product modal when the button is clicked', async () => {
    const user = userEvent.setup();
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '+ Add Product' }));
    expect(screen.getByText('Add Product')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows validation errors when submitting an empty form', async () => {
    const user = userEvent.setup();
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '+ Add Product' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('SKU is required')).toBeInTheDocument();
    expect(screen.getByText('Valid price required')).toBeInTheDocument();
    expect(screen.getByText('Valid quantity required')).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('creates a product and refreshes the list on valid form submit', async () => {
    const user = userEvent.setup();
    createProduct.mockResolvedValue({});
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '+ Add Product' }));

    // The modal form uses unlabelled inputs; query by role/type order within the modal
    const [nameInput, skuInput] = screen.getAllByRole('textbox');
    const [priceInput, quantityInput] = screen.getAllByRole('spinbutton');

    await user.type(nameInput, 'New Thing');
    await user.type(skuInput, 'NT-999');
    await user.type(priceInput, '4.99');
    await user.type(quantityInput, '100');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledWith({
      name: 'New Thing', sku: 'NT-999', price: 4.99, quantity: 100,
    }));
    await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(2));
  });

  it('opens the Edit modal pre-filled with product data', async () => {
    const user = userEvent.setup();
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Widget A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('WA-001')).toBeInTheDocument();
  });

  it('calls updateProduct with the correct id on save', async () => {
    const user = userEvent.setup();
    updateProduct.mockResolvedValue({});
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    // Clear the name and type a new one
    const nameInput = screen.getByDisplayValue('Widget A');
    await user.clear(nameInput);
    await user.type(nameInput, 'Widget A Updated');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateProduct).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Widget A Updated' }))
    );
  });

  it('calls deleteProduct when confirmed and refreshes the list', async () => {
    const user = userEvent.setup();
    deleteProduct.mockResolvedValue({});
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith('Delete this product?');
    await waitFor(() => expect(deleteProduct).toHaveBeenCalledWith(1));
    await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(2));
  });

  it('does not delete when confirm is cancelled', async () => {
    window.confirm.mockReturnValue(false);
    const user = userEvent.setup();
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);

    expect(deleteProduct).not.toHaveBeenCalled();
  });

  it('closes the modal when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<Products />);
    await waitFor(() => expect(screen.getByText('Widget A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '+ Add Product' }));
    expect(screen.getByText('Add Product')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Add Product')).not.toBeInTheDocument();
  });
});
