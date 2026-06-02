import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../context/AuthContext';

const mockLogin = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ login: mockLogin });
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

// The Login form labels are not linked via htmlFor/id, so we query inputs by role/type.
const getUsernameInput = () => screen.getByRole('textbox');
const getPasswordInput = () => document.querySelector('input[type="password"]');

describe('Login page', () => {
  it('renders the username and password fields', () => {
    renderLogin();
    expect(getUsernameInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('renders the Sign in button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders a link to the register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  });

  it('navigates to / after a successful login', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue();
    renderLogin();

    await user.type(getUsernameInput(), 'alice');
    await user.type(getPasswordInput(), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(mockLogin).toHaveBeenCalledWith('alice', 'secret');
  });

  it('shows an error message when login fails', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue({
      response: { status: 401, data: { detail: 'Invalid credentials' } },
    });
    renderLogin();

    await user.type(getUsernameInput(), 'alice');
    await user.type(getPasswordInput(), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows rate-limit message and countdown on 429', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue({
      response: {
        status: 429,
        data: { detail: 'rate limited', retry_after: 5 },
        headers: {},
      },
    });
    renderLogin();

    await user.type(getUsernameInput(), 'alice');
    await user.type(getPasswordInput(), 'pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(screen.getByText('Too many attempts. Please wait before trying again.')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /Try again in/ })).toBeDisabled();
  });

  it('disables the button while a login request is in-flight', async () => {
    const user = userEvent.setup();
    let resolveLogin;
    mockLogin.mockReturnValue(new Promise((res) => { resolveLogin = res; }));
    renderLogin();

    await user.type(getUsernameInput(), 'alice');
    await user.type(getPasswordInput(), 'pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('button', { name: 'Signing in...' })).toBeDisabled();
    resolveLogin();
  });

  it('falls back to "Login failed" when the error has no detail', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue({ response: { status: 500, data: {} } });
    renderLogin();

    await user.type(getUsernameInput(), 'a');
    await user.type(getPasswordInput(), 'b');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(screen.getByText('Login failed')).toBeInTheDocument()
    );
  });
});
