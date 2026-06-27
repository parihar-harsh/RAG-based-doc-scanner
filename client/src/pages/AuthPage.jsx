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
import {
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  Mail,
  ScanText,
  ShieldCheck,
  User,
} from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);

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
      <header className="auth-topbar">
        <div className="auth-logo">
          <span><FileText size={18} /></span>
          <strong>DoxChat AI</strong>
        </div>
        <div className="auth-private-label"><ShieldCheck size={14} /> Private document workspace</div>
      </header>

      <div className="auth-layout">
        <section className="auth-panel">
          <div className="auth-section-index">01 / Access</div>
          <div className="auth-brand">
            <h1>{isSignup ? 'Create your workspace.' : 'Welcome back.'}</h1>
            <p>
              {isSignup
                ? 'Set up your private document workspace.'
                : 'Continue working with your documents.'}
            </p>
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
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="auth-field">
                <span>Name</span>
                <div className="auth-input-shell">
                  <User size={16} />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    autoComplete="name"
                    maxLength={MAX_NAME_LENGTH}
                    placeholder="Your name"
                    required
                  />
                </div>
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>
              <div className="auth-input-shell">
                <Mail size={16} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-input-shell">
                <LockKeyhole size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  minLength={isSignup ? 8 : undefined}
                  maxLength={MAX_PASSWORD_LENGTH}
                  placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {isSignup && (
              <label className="auth-field">
                <span>Confirm password</span>
                <div className="auth-input-shell">
                  <LockKeyhole size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={MAX_PASSWORD_LENGTH}
                    placeholder="Repeat your password"
                    required
                  />
                </div>
              </label>
            )}

            <button className="auth-submit" type="submit" disabled={submitting}>
              <span>{submitting ? 'Please wait...' : isSignup ? 'Create workspace' : 'Enter workspace'}</span>
              {!submitting && <span aria-hidden="true">↗</span>}
            </button>
          </form>

          <div className="auth-form-footer">
            <ShieldCheck size={14} />
            Your documents stay private to your account
          </div>
        </section>

        <aside className="auth-visual" aria-hidden="true">
          <div className="auth-visual-heading">
            <span>02 / Evidence</span>
            <h2>Ground every answer.</h2>
          </div>

          <div className="auth-document-scene">
            <article className="auth-document-sheet">
              <header>
                <span>Research brief</span>
                <span>27.06.26</span>
              </header>
              <div className="auth-document-title">
                <ScanText size={20} />
                <h3>The signal is already in your documents.</h3>
              </div>
              <div className="auth-document-rule" />
              <p>
                Evidence-backed analysis keeps the original context close, so every conclusion can
                be traced to the passage that supports it.
              </p>
              <p className="auth-document-highlight">
                Clear answers are more useful when the source is visible beside them.
              </p>
              <div className="auth-document-lines">
                <i /><i /><i /><i /><i />
              </div>
              <footer><span>DoxChat / Memo</span><span>04</span></footer>
            </article>

            <div className="auth-citation-note">
              <span>Citation 01</span>
              <strong>Source verified</strong>
              <p>Page 4 · Research brief</p>
            </div>

            <div className="auth-file-tabs">
              <span>PDF</span>
              <span>DOCX</span>
              <span>TXT</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
