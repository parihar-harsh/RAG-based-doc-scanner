import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  firstZodMessage,
  loginFormSchema,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  signupFormSchema,
} from '../schemas/authSchemas';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const validation = isSignup
      ? signupFormSchema.safeParse(form)
      : loginFormSchema.safeParse({ email: form.email, password: form.password });
    if (!validation.success) {
      toast.error(firstZodMessage(validation));
      return;
    }

    setSubmitting(true);

    try {
      if (isSignup) {
        const { name, email, password } = validation.data;
        await signup({
          name,
          email,
          password,
        });
      } else {
        await login(validation.data);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <h1>DoxChat AI</h1>
          <p>{isSignup ? 'Create an account to start a private document session.' : 'Sign in to continue your document sessions.'}</p>
        </div>

        <div className="auth-switch" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={`auth-switch-btn ${!isSignup ? 'auth-switch-btn--active' : ''}`}
            onClick={() => changeMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-switch-btn ${isSignup ? 'auth-switch-btn--active' : ''}`}
            onClick={() => changeMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="auth-field">
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                autoComplete="name"
                maxLength={MAX_NAME_LENGTH}
                required
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={isSignup ? 8 : undefined}
              maxLength={MAX_PASSWORD_LENGTH}
              required
            />
          </label>

          {isSignup && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={MAX_PASSWORD_LENGTH}
                required
              />
            </label>
          )}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
