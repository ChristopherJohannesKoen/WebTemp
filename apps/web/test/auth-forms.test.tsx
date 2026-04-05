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
  signUpMock,
  requestPasswordResetMock,
  resetPasswordMock,
  routerPushMock,
  routerRefreshMock
} = vi.hoisted(() => ({
  signInMock: vi.fn(),
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
    signUp: signUpMock,
    requestPasswordReset: requestPasswordResetMock,
    resetPassword: resetPasswordMock
  };
});

describe('auth forms', () => {
  beforeEach(() => {
    signInMock.mockReset();
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
        <SignInForm breakGlassEnabled={false} localAuthEnabled providers={[]} />
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
      <SignInForm breakGlassEnabled={false} localAuthEnabled providers={[]} />
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
});
