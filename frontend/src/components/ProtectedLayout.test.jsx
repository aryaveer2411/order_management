import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedLayout from './ProtectedLayout';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../context/AuthContext';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<div>protected-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedLayout', () => {
  it('shows a loading indicator while auth is resolving', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    renderLayout();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to /login when there is no authenticated user', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderLayout();
    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument();
  });

  it('renders the child route when the user is authenticated', () => {
    useAuth.mockReturnValue({ user: { username: 'alice' }, loading: false, logout: vi.fn() });
    renderLayout();
    expect(screen.getByText('protected-content')).toBeInTheDocument();
    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
  });
});
