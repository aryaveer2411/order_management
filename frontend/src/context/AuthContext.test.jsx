import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { setTokens, clearTokens } from '../utils/tokenStore';
import { VALID_TOKEN, EXPIRED_TOKEN } from '../test/helpers';

// Mock the API layer so no real HTTP calls are made
vi.mock('../api/client', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refreshTokens: vi.fn(),
}));

import { login as apiLogin, logout as apiLogout, refreshTokens as apiRefresh } from '../api/client';

// Helper: renders a component that reads from AuthContext
function AuthConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `user:${user.username}` : 'no-user'}</div>;
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

beforeEach(() => {
  clearTokens();
  vi.clearAllMocks();
});

describe('AuthProvider – initialisation', () => {
  it('shows user when a valid token is already stored', async () => {
    setTokens(VALID_TOKEN);
    renderWithAuth();
    await waitFor(() => expect(screen.getByText('user:testuser')).toBeInTheDocument());
  });

  it('attempts refresh when stored token is expired', async () => {
    setTokens(EXPIRED_TOKEN);
    apiRefresh.mockResolvedValue(VALID_TOKEN);

    renderWithAuth();
    await waitFor(() => expect(screen.getByText('user:testuser')).toBeInTheDocument());
    expect(apiRefresh).toHaveBeenCalledOnce();
  });

  it('attempts refresh when no token is stored', async () => {
    apiRefresh.mockResolvedValue(VALID_TOKEN);

    renderWithAuth();
    await waitFor(() => expect(screen.getByText('user:testuser')).toBeInTheDocument());
    expect(apiRefresh).toHaveBeenCalledOnce();
  });

  it('shows no-user when refresh fails on init', async () => {
    apiRefresh.mockRejectedValue(new Error('Network error'));

    renderWithAuth();
    await waitFor(() => expect(screen.getByText('no-user')).toBeInTheDocument());
  });

  it('shows loading state before init resolves', () => {
    // Never resolves during this assertion
    apiRefresh.mockReturnValue(new Promise(() => {}));
    renderWithAuth();
    expect(screen.getByText('loading')).toBeInTheDocument();
  });
});

describe('AuthProvider – login()', () => {
  it('sets user after a successful login', async () => {
    apiLogin.mockResolvedValue({ access_token: VALID_TOKEN });
    apiRefresh.mockRejectedValue(new Error('no session'));

    function LoginTrigger() {
      const { user, loading, login } = useAuth();
      if (loading) return <div>loading</div>;
      return (
        <>
          <div>{user ? `user:${user.username}` : 'no-user'}</div>
          <button onClick={() => login('testuser', 'pass')}>login</button>
        </>
      );
    }

    const { getByRole } = render(
      <AuthProvider>
        <LoginTrigger />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('no-user')).toBeInTheDocument());

    await act(async () => {
      getByRole('button', { name: 'login' }).click();
    });

    await waitFor(() => expect(screen.getByText('user:testuser')).toBeInTheDocument());
    expect(apiLogin).toHaveBeenCalledWith('testuser', 'pass');
  });
});

describe('AuthProvider – logout()', () => {
  it('clears user after logout', async () => {
    setTokens(VALID_TOKEN);
    apiLogout.mockResolvedValue();

    function LogoutTrigger() {
      const { user, loading, logout } = useAuth();
      if (loading) return <div>loading</div>;
      return (
        <>
          <div>{user ? `user:${user.username}` : 'no-user'}</div>
          <button onClick={logout}>logout</button>
        </>
      );
    }

    const { getByRole } = render(
      <AuthProvider>
        <LogoutTrigger />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('user:testuser')).toBeInTheDocument());

    await act(async () => {
      getByRole('button', { name: 'logout' }).click();
    });

    await waitFor(() => expect(screen.getByText('no-user')).toBeInTheDocument());
  });
});

describe('AuthProvider – auth:logout event', () => {
  it('clears user when the auth:logout window event fires', async () => {
    setTokens(VALID_TOKEN);
    renderWithAuth();

    await waitFor(() => expect(screen.getByText('user:testuser')).toBeInTheDocument());

    act(() => {
      window.dispatchEvent(new Event('auth:logout'));
    });

    await waitFor(() => expect(screen.getByText('no-user')).toBeInTheDocument());
  });
});
