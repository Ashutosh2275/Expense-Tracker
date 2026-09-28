import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { firebaseService } from '@/services/firebase';
import { localAuth } from '@/services/localAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode: 'login' | 'register' | 'forgot' | 'resetPassword'
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'resetPassword'>('login');

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if opened via email reset link (with oobCode)
  useEffect(() => {
    const oobCode = searchParams.get('oobCode');
    const action = searchParams.get('mode');
    if (oobCode || action === 'resetPassword') {
      setMode('resetPassword');
    }
  }, [searchParams]);

  const resetForm = () => {
    setError('');
    setSuccessMsg('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Username is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      await firebaseService.login(cleanUsername, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('operation-not-allowed') || msg.includes('configuration-not-found')) {
        setError('Email/Password provider is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable "Email/Password".');
      } else if (
        msg.includes('user-not-found') ||
        msg.includes('invalid-credential') ||
        msg.includes('User not found')
      ) {
        setError('User not found. Please check your username or register.');
      } else if (msg.includes('wrong-password') || msg.includes('Incorrect password')) {
        setError('Incorrect password.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    const cleanUser = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUser) {
      setError('Username is required');
      return;
    }
    if (!cleanEmail) {
      setError('Email address is required');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await firebaseService.register(cleanUser, cleanEmail, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.includes('operation-not-allowed') || msg.includes('configuration-not-found')) {
        setError('Email/Password provider is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable "Email/Password".');
      } else if (msg.includes('email-already-in-use') || msg.includes('already registered')) {
        setError('This email address is already registered. Please sign in or use a different email.');
      } else if (msg.includes('already taken')) {
        setError('This username is already taken. Please choose another username.');
      } else if (msg.includes('invalid-email')) {
        setError('Please enter a valid email address.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [forgotEmail, setForgotEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your registered email address');
      return;
    }

    setIsLoading(true);
    try {
      const verified = await firebaseService.sendResetLink(cleanEmail);
      setLinkSent(true);
      setSuccessMsg(
        `Reset link sent to your registered email (${verified.email})! You can now set your new password below:`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset link';
      if (msg.includes('operation-not-allowed') || msg.includes('configuration-not-found')) {
        setError('Email/Password provider is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable "Email/Password".');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword.trim() || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await firebaseService.updatePasswordForEmail(forgotEmail, newPassword);
      setSuccessMsg('Your password has been successfully updated! You can now sign in with your new password.');
      // Prefill username if known for smooth login
      const localUsers = localAuth.getStoredUsers();
      const matched = localUsers.find(
        (u) => u.email && u.email.toLowerCase() === forgotEmail.trim().toLowerCase()
      );
      if (matched?.username) {
        setUsername(matched.username);
      }
      setTimeout(() => {
        resetForm();
        setLinkSent(false);
        setMode('login');
      }, 2200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    if (!newPassword.trim() || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const oobCode = searchParams.get('oobCode');
      if (oobCode) {
        await firebaseService.confirmReset(oobCode, newPassword);
      } else if (email.trim()) {
        await firebaseService.updatePasswordForEmail(email.trim(), newPassword);
      }
      setSuccessMsg('Your password has been successfully reset! You can now sign in.');
      setTimeout(() => {
        resetForm();
        setMode('login');
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 sm:px-6 lg:px-8 select-none"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)',
      }}
    >
      {/* Header Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center text-2xl font-black mx-auto shadow-md">
          ₹
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-900 tracking-tight">
          Expense Tracker
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Track shared expenses and settlements simply
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-3xl sm:px-10">
          {/* Mode: LOGIN */}
          {mode === 'login' && (
            <div>
              <div className="mb-6 border-b border-slate-100 pb-3">
                <h2 className="text-lg font-black text-slate-900">Sign In</h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Username *"
                  placeholder="e.g. leonid@op"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  autoFocus
                  required
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setMode('forgot');
                      }}
                      className="text-xs text-slate-500 hover:text-black hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full text-sm py-3 font-bold bg-black text-white hover:bg-slate-800 rounded-xl shadow-sm"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-500">
                New to Expense Tracker?{' '}
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode('register');
                  }}
                  className="font-bold text-black hover:underline"
                >
                  Register here
                </button>
              </div>
            </div>
          )}

          {/* Mode: REGISTER */}
          {mode === 'register' && (
            <div>
              <div className="mb-6 border-b border-slate-100 pb-3">
                <h2 className="text-lg font-black text-slate-900">Create Account</h2>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  label="Username *"
                  placeholder="e.g. leonid@op"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  autoFocus
                  required
                />

                <Input
                  type="email"
                  label="Email Address *"
                  placeholder="leonidop@attendance.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  required
                />

                <Input
                  type="password"
                  label="Password *"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                />

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full text-sm py-3 font-bold bg-black text-white hover:bg-slate-800 rounded-xl shadow-sm"
                >
                  {isLoading ? 'Creating account...' : 'Register'}
                </Button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode('login');
                  }}
                  className="font-bold text-black hover:underline"
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

          {/* Mode: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setLinkSent(false);
                    setMode('login');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-black mb-3"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
                <h2 className="text-lg font-black text-slate-900">Forgot Password</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your registered email ID to receive the reset link and set your new password.
                </p>
              </div>

              {successMsg && (
                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{successMsg}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {error}
                </div>
              )}

              {/* Step 1: Ask for registered Email ID */}
              {!linkSent ? (
                <form onSubmit={handleSendResetLink} className="space-y-4">
                  <Input
                    type="email"
                    label="Registered Email ID *"
                    placeholder="e.g. ashutosh2275@gmail.com"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      setError('');
                    }}
                    autoFocus
                    required
                  />

                  <Button
                    type="submit"
                    disabled={isLoading || !forgotEmail.trim()}
                    className="w-full text-sm py-3 font-bold bg-black text-white hover:bg-slate-800 rounded-xl shadow-sm"
                  >
                    {isLoading ? 'Sending reset link...' : 'Send Reset Link'}
                  </Button>
                </form>
              ) : (
                /* Step 2: Right there on the same card ("there only"): Ask for New Password and Confirm New Password */
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                        Registered Email
                      </span>
                      <span className="font-bold text-slate-900">{forgotEmail}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkSent(false);
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-slate-600 hover:text-black font-semibold underline"
                    >
                      Change
                    </button>
                  </div>

                  <Input
                    type="password"
                    label="New Password *"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    autoFocus
                    required
                  />

                  <Input
                    type="password"
                    label="Confirm New Password *"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    required
                  />

                  <div className="space-y-2 pt-1">
                    <Button
                      type="submit"
                      disabled={isLoading || !newPassword.trim() || !confirmPassword.trim()}
                      className="w-full text-sm py-3 font-bold bg-black text-white hover:bg-slate-800 rounded-xl shadow-sm"
                    >
                      {isLoading ? 'Updating password...' : 'Update Password'}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        resetForm();
                        setLinkSent(false);
                        setMode('login');
                      }}
                      className="w-full text-xs text-slate-500 hover:text-slate-900"
                    >
                      Back to Sign In
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Mode: SET NEW PASSWORD (Via Reset Link) */}
          {mode === 'resetPassword' && (
            <div>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode('login');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-black mb-3"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
                <div className="p-3.5 bg-slate-100/90 rounded-2xl border border-slate-200 text-xs text-slate-800 leading-relaxed mb-4">
                  <p className="font-bold text-slate-900">Hi, this is your Expense Tracker,</p>
                  <p className="text-slate-600 mt-0.5">and here is your reset link below to update your password:</p>
                </div>
                <h2 className="text-lg font-black text-slate-900">Set New Password</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your new password and confirm it below.
                </p>
              </div>

              {successMsg ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setMode('login');
                    }}
                    className="w-full text-sm py-2.5 font-bold bg-black text-white rounded-xl"
                  >
                    Proceed to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <Input
                    type="password"
                    label="New Password *"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    autoFocus
                    required
                  />

                  <Input
                    type="password"
                    label="Confirm New Password *"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    required
                  />

                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full text-sm py-3 font-bold bg-black text-white hover:bg-slate-800 rounded-xl shadow-sm"
                  >
                    {isLoading ? 'Updating password...' : 'Update Password'}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
