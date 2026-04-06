import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInForm } from '../components/sign-in-form';
import { SignUpForm } from '../components/sign-up-form';
import { ForgotPasswordForm } from '../components/forgot-password-form';
import { ResetPasswordForm } from '../components/reset-password-form';
import { ApiRequestError } from '../lib/api-error';

const {
  signInMock,
  breakGlassSignInMock,
  signUpMock,
  requestPasswordResetMock,
  resetPasswordMock,
  routerPushMock,
  routerRefreshMock
} = vi.hoisted(() => ({
  signInMock: vi.fn(),
  breakGlassSignInMock: vi.fn(),
  signUpMock: vi.fn(),
  requestPasswordResetMock: vi.fn(),
  resetPasswordMock: vi.fn(),
  routerPushMock: vi.fn(),
  routerRefreshMock: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: routerRefreshMock
  })
}));

vi.mock('../lib/client-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/client-api')>('../lib/client-api');

  return {
    ...actual,
    signIn: signInMock,
    breakGlassSignIn: breakGlassSignInMock,
    signUp: signUpMock,
    requestPasswordReset: requestPasswordResetMock,
    resetPassword: resetPasswordMock
  };
});

describe('auth forms', () => {
  beforeEach(() => {
    signInMock.mockReset();
    breakGlassSignInMock.mockReset();
    signUpMock.mockReset();
    requestPasswordResetMock.mockReset();
    resetPasswordMock.mockReset();
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders persistent polite live regions across auth forms', async () => {
    render(
      <div>
        <SignInForm
          breakGlassEnabled={false}
          defaultProviderSlug={null}
          localAuthEnabled
          providers={[]}
        />
        <SignUpForm />
        <ForgotPasswordForm />
        <ResetPasswordForm />
      </div>
    );

    expect(screen.getByTestId('sign-in-error-region').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByTestId('sign-up-error-region').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByTestId('forgot-password-error-region').getAttribute('aria-live')).toBe(
      'polite'
    );
    expect(screen.getByTestId('reset-password-error-region').getAttribute('aria-live')).toBe(
      'polite'
    );
  });

  it('passes automated axe checks for the sign-in form', async () => {
    const { container } = render(
      <SignInForm
        breakGlassEnabled={false}
        defaultProviderSlug={null}
        localAuthEnabled
        providers={[]}
      />
    );

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false }
      }
    });

    expect(results.violations).toHaveLength(0);
  }, 15000);

  it('associates field errors with controls on signup failures', async () => {
    signUpMock.mockRejectedValueOnce(
      new ApiRequestError('Please fix the highlighted fields.', 400, [
        {
          field: 'email',
          code: 'invalid',
          message: 'Use a different email address.'
        },
        {
          field: 'password',
          code: 'too_short',
          message: 'Password must be at least 8 characters.'
        }
      ])
    );

    render(<SignUpForm />);

    fireEvent.change(screen.getByTestId('sign-up-name'), {
      target: { value: 'Avery Parker' }
    });
    fireEvent.change(screen.getByTestId('sign-up-email'), {
      target: { value: 'avery@example.com' }
    });
    fireEvent.change(screen.getByTestId('sign-up-password'), {
      target: { value: 'short' }
    });
    fireEvent.click(screen.getByTestId('sign-up-submit'));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });

    const emailInput = screen.getByTestId('sign-up-email');
    const passwordInput = screen.getByTestId('sign-up-password');

    await waitFor(() => {
      expect(screen.getByTestId('sign-up-email-error').textContent).toContain(
        'Use a different email address.'
      );
      expect(screen.getByTestId('sign-up-password-error').textContent).toContain(
        'Password must be at least 8 characters.'
      );
    });

    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
    expect(passwordInput.getAttribute('aria-invalid')).toBe('true');
    expect(emailInput.getAttribute('aria-describedby')).toContain('sign-up-email-error');
    expect(passwordInput.getAttribute('aria-describedby')).toContain('sign-up-password-error');
    expect(screen.getByTestId('sign-up-error-region').textContent).toContain(
      'Please fix the highlighted fields.'
    );
  });

  it('renders the default enterprise provider first and suppresses local login when policy disables it', () => {
    render(
      <SignInForm
        breakGlassEnabled
        defaultProviderSlug="acme-oidc"
        localAuthEnabled={false}
        providers={[
          {
            slug: 'fallback-saml',
            displayName: 'Fallback SAML',
            type: 'saml',
            status: 'active'
          },
          {
            slug: 'acme-oidc',
            displayName: 'Acme SSO',
            type: 'oidc',
            status: 'active'
          }
        ]}
      />
    );

    const providerLinks = screen.getAllByRole('link');
    expect(providerLinks[0]?.textContent).toContain('Continue with Acme SSO');
    expect(screen.queryByTestId('sign-in-form')).toBeNull();
    expect(screen.getByTestId('break-glass-guidance').textContent).toContain(
      'Emergency owner access remains available'
    );
  });

  it('renders break-glass mode only when it is explicitly requested', async () => {
    breakGlassSignInMock.mockResolvedValue({
      user: {
        id: 'user_owner',
        email: 'owner@example.com',
        name: 'Owner User',
        role: 'owner'
      }
    });

    render(
      <SignInForm
        breakGlassEnabled
        breakGlassMode
        defaultProviderSlug="acme-oidc"
        localAuthEnabled={false}
        providers={[
          {
            slug: 'acme-oidc',
            displayName: 'Acme SSO',
            type: 'oidc',
            status: 'active'
          }
        ]}
      />
    );

    fireEvent.change(screen.getByTestId('sign-in-email'), {
      target: { value: 'owner@example.com' }
    });
    fireEvent.change(screen.getByTestId('sign-in-password'), {
      target: { value: 'ChangeMe123!' }
    });
    fireEvent.click(screen.getByTestId('sign-in-submit'));

    await waitFor(() => {
      expect(breakGlassSignInMock).toHaveBeenCalledWith({
        email: 'owner@example.com',
        password: 'ChangeMe123!'
      });
    });
  });
});
