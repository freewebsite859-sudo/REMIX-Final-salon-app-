import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import { NexoraLogo } from './NexoraLogo';
import { PasswordResetModal } from './PasswordResetModal';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '../../lib/supabase';
import { upsertUserProfile, fetchUserProfile, type UserRole } from '../../lib/profileService';
import { UserProfile } from '../../types';

interface AuthPageProps {
  onAuthSuccess: (user: Partial<UserProfile> & { role?: UserRole }) => void;
  onExploreAsGuest?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthSuccess,
  onExploreAsGuest,
}) => {
  // Mode: 'login' | 'signup'
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'config' | 'credentials' | 'network' | 'auth' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    mobile?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Clear errors when switching modes
  const handleSwitchMode = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setErrorMessage(null);
    setErrorType(null);
    setSuccessMessage(null);
    setFieldErrors({});
  };

  // Form validation helper
  const validateForm = (): boolean => {
    const errors: typeof fieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Email validation (both modes)
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    // Password validation (both modes)
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    // Sign up specific validations
    if (authMode === 'signup') {
      if (!fullName.trim()) {
        errors.fullName = 'Full name is required.';
      }

      if (!mobile.trim()) {
        errors.mobile = 'Mobile number is required.';
      } else if (!/^[0-9+()-\s]{8,15}$/.test(mobile.trim())) {
        errors.mobile = 'Please enter a valid mobile phone number.';
      }

      if (!confirmPassword) {
        errors.confirmPassword = 'Please confirm your password.';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Determine error type for better UX
  const classifyError = (error: any, message: string): 'config' | 'credentials' | 'network' | 'auth' => {
    const lower = message.toLowerCase();
    if (lower.includes('fetch') || lower.includes('network') || lower.includes('failed to fetch') || lower.includes('networkerror') || error?.name === 'TypeError') {
      return 'network';
    }
    if (lower.includes('invalid login credentials') || lower.includes('invalid login') || lower.includes('email not confirmed')) {
      return 'credentials';
    }
    if (lower.includes('supabase') && (lower.includes('not configured') || lower.includes('url') || lower.includes('anon key'))) {
      return 'config';
    }
    return 'auth';
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorType(null);
    setSuccessMessage(null);

    if (!validateForm()) return;

    if (!isSupabaseConfigured || !supabase) {
      const status = getSupabaseConfigStatus();
      // Detailed config error for developers, but clear message
      let detail = '';
      if (!status.hasUrl) detail += 'Missing VITE_SUPABASE_URL. ';
      if (!status.hasAnonKey) detail += 'Missing VITE_SUPABASE_ANON_KEY. ';
      if (status.isPrivilegedKey) detail += 'Service role key detected in public env — use anon key. ';
      
      console.error('[Nexora] CONFIGURATION ERROR:', detail, status);
      
      setErrorType('config');
      setErrorMessage(
        'Live authentication is unavailable. Configure the public Supabase URL and anon key, then rebuild the app. ' +
        (detail ? `Details: ${detail}` : '')
      );
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const errType = classifyError(error, error.message);
          setErrorType(errType);
          
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            setErrorMessage('The email or password you entered is incorrect. Please try again.');
          } else if (errType === 'network') {
            setErrorMessage('Network error: Unable to reach authentication service. Check your connection.');
          } else {
            setErrorMessage(error.message || 'Failed to sign in. Please check your credentials.');
          }
          setIsLoading(false);
          return;
        }

        // Load profile and role after successful login
        let userRole: UserRole = 'customer';
        try {
          if (data.user?.id) {
            const { profile } = await fetchUserProfile(data.user.id);
            if (profile?.role) {
              userRole = profile.role;
            } else {
              // Fallback to metadata role if profile missing
              const metaRole = data.user.user_metadata?.role;
              if (metaRole === 'customer' || metaRole === 'salon_owner') {
                userRole = metaRole;
              }
            }
          }
        } catch (profileErr) {
          console.warn('[Nexora] Role lookup failed, defaulting to customer:', profileErr);
        }

        setIsLoading(false);
        setSuccessMessage(
          userRole === 'salon_owner' 
            ? 'Welcome back! Redirecting to Salon Owner Dashboard.' 
            : 'Welcome back to Nexora Luxury Management.'
        );
        
        onAuthSuccess({
          email: data.user?.email || email.trim(),
          name: data.user?.user_metadata?.full_name || email.split('@')[0],
          phone: data.user?.user_metadata?.mobile || '',
          role: userRole,
        });
      } else {
        // Signup flow
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              mobile: mobile.trim(),
              role: selectedRole,
            },
          },
        });

        if (error) {
          const errType = classifyError(error, error.message);
          setErrorType(errType);
          if (errType === 'network') {
            setErrorMessage('Network error: Unable to reach authentication service. Check your connection.');
          } else {
            setErrorMessage(error.message || 'Unable to create account. Please try again.');
          }
          setIsLoading(false);
          return;
        }

        // Try to create profile with role after signup
        if (data.user?.id) {
          try {
            const result = await upsertUserProfile(
              data.user.id,
              email.trim(),
              selectedRole,
              fullName.trim()
            );
            if (!result.success) {
              console.warn('[Nexora] Profile creation warning:', result.error);
              // Don't fail signup if profile creation fails - auth succeeded
            }
          } catch (profileErr) {
            console.warn('[Nexora] Profile creation failed, but auth succeeded:', profileErr);
          }
        }

        setIsLoading(false);
        setSuccessMessage(
          data.session
            ? selectedRole === 'salon_owner'
              ? 'Account created. Welcome! Redirecting to Salon Owner Dashboard.'
              : 'Account created. Welcome to Nexora Luxury Management.'
            : 'Account created. Check your email to confirm your account before signing in.'
        );
        if (data.session) {
          onAuthSuccess({
            email: data.user?.email || email.trim(),
            name: fullName.trim(),
            phone: mobile.trim(),
            role: selectedRole,
          });
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      const message = err?.message || String(err);
      const errType = classifyError(err, message);
      setErrorType(errType);
      console.error('[Nexora] Authentication request failed:', err);
      if (errType === 'network') {
        setErrorMessage('A network error occurred. Please check your connection and try again.');
      } else if (errType === 'config') {
        setErrorMessage('Configuration error: Supabase is not properly configured. Contact support.');
      } else {
        setErrorMessage('A network error occurred. Please check your connection and try again.');
      }
    }
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden bg-[#fcf9f8] font-sans selection:bg-[#b90064]/20 selection:text-[#b90064]"
      style={{
        backgroundColor: '#fcf9f8',
      }}
    >
      {/* ========================================================================= */}
      {/* LUXURY BACKGROUND ATMOSPHERE & DECORATIVE ORBS                            */}
      {/* ========================================================================= */}
      {/* Top-Left Ambient Luxury Glow */}
      <div
        className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full pointer-events-none opacity-40 blur-[130px]"
        style={{
          background: 'radial-gradient(circle, #b90064 0%, rgba(230, 0, 126, 0.4) 60%, transparent 80%)',
        }}
      />

      {/* Bottom-Right Secondary Mauve Glow */}
      <div
        className="absolute -bottom-36 -right-36 w-[560px] h-[560px] rounded-full pointer-events-none opacity-30 blur-[150px]"
        style={{
          background: 'radial-gradient(circle, #e6007e 0%, rgba(89, 64, 71, 0.3) 60%, transparent 80%)',
        }}
      />

      {/* Subtle Central Ambient Diffusion */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none opacity-15 blur-[180px]"
        style={{
          background: 'radial-gradient(circle, #f5d0e2 0%, transparent 70%)',
        }}
      />

      {/* ========================================================================= */}
      {/* MAIN GLASSMORPHISM CARD                                                   */}
      {/* ========================================================================= */}
      <div
        id="auth-main-card"
        className="w-full max-w-[460px] rounded-[24px] p-6 sm:p-9 relative z-10 transition-all duration-350 ease-out group"
        style={{
          background: 'rgba(255, 255, 255, 0.62)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.65)',
          boxShadow: '0 20px 60px rgba(89, 64, 71, 0.08), 0 8px 24px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Subtle Ambient Border Highlight on Hover */}
        <div className="absolute inset-0 rounded-[24px] pointer-events-none border border-white/80 transition-opacity duration-300" />

        {/* 1. Header with Nexora Logo */}
        <header className="flex flex-col items-center text-center mb-6">
          <NexoraLogo size="md" className="mb-4" />

          {authMode === 'login' ? (
            <div className="animate-in fade-in duration-300">
              <h2
                className="text-[26px] sm:text-[30px] font-bold text-[#1c1b1b] tracking-[-0.02em] leading-tight"
                style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
              >
                Welcome Back
              </h2>
              <p className="text-[14px] sm:text-[15px] text-[#594047] mt-1.5 leading-relaxed font-normal">
                Sign in to continue to your Nexora workspace.
              </p>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              <h2
                className="text-[26px] sm:text-[30px] font-bold text-[#1c1b1b] tracking-[-0.02em] leading-tight"
                style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
              >
                Create Your Account
              </h2>
              <p className="text-[14px] sm:text-[15px] text-[#594047] mt-1.5 leading-relaxed font-normal">
                Join Nexora and manage your luxury business effortlessly.
              </p>
            </div>
          )}
        </header>

        {/* 2. Segmented Pill Mode Toggle (Log In / Sign Up) */}
        <nav aria-label="Authentication Mode" className="p-1 rounded-full bg-[#594047]/6 border border-[#e8e8e8]/60 flex items-center justify-between mb-6 relative">
          <button
            type="button"
            id="toggle-login-mode"
            onClick={() => handleSwitchMode('login')}
            className={`flex-1 h-[42px] rounded-full text-[14px] font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer relative z-10 ${
              authMode === 'login'
                ? 'bg-[#b90064] text-white shadow-md font-bold'
                : 'text-[#594047] hover:text-[#1c1b1b]'
            }`}
          >
            <span>Log In</span>
          </button>

          <button
            type="button"
            id="toggle-signup-mode"
            onClick={() => handleSwitchMode('signup')}
            className={`flex-1 h-[42px] rounded-full text-[14px] font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer relative z-10 ${
              authMode === 'signup'
                ? 'bg-[#b90064] text-white shadow-md font-bold'
                : 'text-[#594047] hover:text-[#1c1b1b]'
            }`}
          >
            <span>Sign Up</span>
          </button>
        </nav>

        {/* 3. Global Feedback Messages - Distinguish error types */}
        {errorMessage && (
          <div className={`mb-5 p-3.5 rounded-xl border text-[13px] font-medium flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 ${
            errorType === 'config' 
              ? 'bg-amber-50 border-amber-300 text-amber-900' 
              : errorType === 'network'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : errorType === 'credentials'
              ? 'bg-orange-50 border-orange-200 text-orange-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
              errorType === 'config' ? 'text-amber-600' : 'text-[#b90064]'
            }`} />
            <div className="leading-snug">
              <span>{errorMessage}</span>
              {errorType === 'config' && (
                <p className="mt-1 text-[11px] opacity-80">
                  Developer: Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then rebuild.
                </p>
              )}
              {errorType === 'network' && (
                <p className="mt-1 text-[11px] opacity-80">
                  Network issue — check connection or try again shortly.
                </p>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-medium flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* 4. Authentication Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Sign Up: Full Name */}
          {authMode === 'signup' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label
                htmlFor="signup-fullname"
                className="block text-[13px] font-semibold text-[#1c1b1b] mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#594047]/70">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="signup-fullname"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: undefined });
                  }}
                  placeholder="Enter your full name"
                  className={`w-full h-[52px] pl-10 pr-4 bg-white/80 focus:bg-white text-[#1c1b1b] placeholder:text-[#594047]/45 rounded-lg text-[14px] border ${
                    fieldErrors.fullName ? 'border-[#b90064] ring-2 ring-[#b90064]/10' : 'border-[#e8e8e8]'
                  } focus:border-[#b90064] focus:ring-4 focus:ring-[#b90064]/10 transition-all outline-none`}
                />
              </div>
              {fieldErrors.fullName && (
                <p className="text-[12px] text-[#b90064] font-medium mt-1">
                  {fieldErrors.fullName}
                </p>
              )}
            </div>
          )}

          {/* Sign Up: Mobile Number */}
          {authMode === 'signup' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label
                htmlFor="signup-mobile"
                className="block text-[13px] font-semibold text-[#1c1b1b] mb-1.5"
              >
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#594047]/70">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="signup-mobile"
                  type="tel"
                  autoComplete="tel"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value);
                    if (fieldErrors.mobile) setFieldErrors({ ...fieldErrors, mobile: undefined });
                  }}
                  placeholder="Enter your mobile number"
                  className={`w-full h-[52px] pl-10 pr-4 bg-white/80 focus:bg-white text-[#1c1b1b] placeholder:text-[#594047]/45 rounded-lg text-[14px] border ${
                    fieldErrors.mobile ? 'border-[#b90064] ring-2 ring-[#b90064]/10' : 'border-[#e8e8e8]'
                  } focus:border-[#b90064] focus:ring-4 focus:ring-[#b90064]/10 transition-all outline-none`}
                />
              </div>
              {fieldErrors.mobile && (
                <p className="text-[12px] text-[#b90064] font-medium mt-1">
                  {fieldErrors.mobile}
                </p>
              )}
            </div>
          )}

          {/* Sign Up: Role Selection - Customer vs Salon Owner */}
          {authMode === 'signup' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-[13px] font-semibold text-[#1c1b1b] mb-1.5">
                I am a
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#594047]/5 border border-[#e8e8e8]/60">
                <button
                  type="button"
                  onClick={() => setSelectedRole('customer')}
                  className={`h-[44px] rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedRole === 'customer'
                      ? 'bg-white text-[#b90064] shadow-sm border border-[#b90064]/20'
                      : 'text-[#594047] hover:text-[#1c1b1b]'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('salon_owner')}
                  className={`h-[44px] rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedRole === 'salon_owner'
                      ? 'bg-white text-[#b90064] shadow-sm border border-[#b90064]/20'
                      : 'text-[#594047] hover:text-[#1c1b1b]'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Salon Owner</span>
                </button>
              </div>
              <p className="text-[11px] text-[#594047]/70 mt-1.5">
                {selectedRole === 'customer' 
                  ? 'Book appointments and discover salons' 
                  : 'Manage your salon and bookings'}
              </p>
            </div>
          )}

          {/* Gmail / Email Address (Both modes) */}
          <div>
            <label
              htmlFor="auth-email"
              className="block text-[13px] font-semibold text-[#1c1b1b] mb-1.5"
            >
              Gmail / Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#594047]/70">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                }}
                placeholder="you@gmail.com"
                className={`w-full h-[52px] pl-10 pr-4 bg-white/80 focus:bg-white text-[#1c1b1b] placeholder:text-[#594047]/45 rounded-lg text-[14px] border ${
                  fieldErrors.email ? 'border-[#b90064] ring-2 ring-[#b90064]/10' : 'border-[#e8e8e8]'
                } focus:border-[#b90064] focus:ring-4 focus:ring-[#b90064]/10 transition-all outline-none`}
              />
            </div>
            {fieldErrors.email && (
              <p className="text-[12px] text-[#b90064] font-medium mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password (Both modes) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="auth-password"
                className="block text-[13px] font-semibold text-[#1c1b1b]"
              >
                Password
              </label>

              {/* Forgot Password Link (Only in login mode) */}
              {authMode === 'login' && (
                <button
                  type="button"
                  id="forgot-password-link"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[13px] font-semibold text-[#b90064] hover:text-[#a00056] hover:underline transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#594047]/70">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                }}
                placeholder={authMode === 'login' ? 'Enter your password' : 'Create a secure password'}
                className={`w-full h-[52px] pl-10 pr-11 bg-white/80 focus:bg-white text-[#1c1b1b] placeholder:text-[#594047]/45 rounded-lg text-[14px] border ${
                  fieldErrors.password ? 'border-[#b90064] ring-2 ring-[#b90064]/10' : 'border-[#e8e8e8]'
                } focus:border-[#b90064] focus:ring-4 focus:ring-[#b90064]/10 transition-all outline-none`}
              />

              {/* Password Eye Toggle Button */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#594047]/70 hover:text-[#1c1b1b] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-[12px] text-[#b90064] font-medium mt-1">{fieldErrors.password}</p>
            )}
          </div>

          {/* Sign Up: Confirm Password */}
          {authMode === 'signup' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label
                htmlFor="signup-confirm-password"
                className="block text-[13px] font-semibold text-[#1c1b1b] mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#594047]/70">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                    }
                  }}
                  placeholder="Confirm your password"
                  className={`w-full h-[52px] pl-10 pr-11 bg-white/80 focus:bg-white text-[#1c1b1b] placeholder:text-[#594047]/45 rounded-lg text-[14px] border ${
                    fieldErrors.confirmPassword ? 'border-[#b90064] ring-2 ring-[#b90064]/10' : 'border-[#e8e8e8]'
                  } focus:border-[#b90064] focus:ring-4 focus:ring-[#b90064]/10 transition-all outline-none`}
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#594047]/70 hover:text-[#1c1b1b] transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-[12px] text-[#b90064] font-medium mt-1">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* 5. Primary CTA Button */}
          <button
            type="submit"
            id="auth-submit-button"
            disabled={isLoading}
            className="mt-2 w-full h-[52px] bg-[#b90064] hover:bg-[#a00056] text-white font-bold rounded-lg text-[15px] shadow-sm transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(185,0,100,0.25)] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{authMode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
              </>
            ) : (
              <>
                <span>{authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* 6. Footer Terms & Guest Preview Option */}
        <footer className="mt-6 pt-5 border-t border-[#e8e8e8]/70 text-center flex flex-col items-center gap-2">
          {onExploreAsGuest && (
            <button
              type="button"
              id="guest-preview-btn"
              onClick={onExploreAsGuest}
              className="text-[13px] font-semibold text-[#594047] hover:text-[#b90064] transition-colors py-1 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#b90064]" />
              <span>Explore Nexora Demo Workspace</span>
            </button>
          )}

          <p className="text-[11px] text-[#594047]/70 leading-relaxed max-w-[340px]">
            Protected by enterprise 256-bit encryption. By continuing, you agree to Nexora's Terms of
            Service and Privacy Policy.
          </p>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD MODAL                                                     */}
      {/* ========================================================================= */}
      <PasswordResetModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialEmail={email}
      />
    </main>
  );
};
