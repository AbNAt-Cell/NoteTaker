'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from '../auth.module.css';

export default function RegisterPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleRegister = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
            },
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        router.push('/dashboard');
    };

    const handleGoogleSignUp = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/dashboard` },
        });
    };

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <div className={styles.authLogo}>
                    <span>⚡</span>
                    <span className={styles.logoGradient}>Amebo</span>
                </div>
                <h1 className={styles.authTitle}>Create your account</h1>
                <p className={styles.authSubtitle}>Start capturing smarter meetings today</p>

                {error && <div className={styles.errorMessage}>{error}</div>}

                {/* Google Sign-Up — Primary CTA */}
                <button className={styles.googleButton} onClick={handleGoogleSignUp}>
                    <svg className={styles.googleIcon} viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign up with Google
                </button>

                <div className={styles.authDivider}>or sign up with email</div>

                <form className={styles.authForm} onSubmit={handleRegister}>
                    <div className={styles.formGroup}>
                        <label htmlFor="fullName" className={styles.formLabel}>Full Name</label>
                        <input
                            id="fullName"
                            type="text"
                            className={styles.formInput}
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="email" className={styles.formLabel}>Email</label>
                        <input
                            id="email"
                            type="email"
                            className={styles.formInput}
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="password" className={styles.formLabel}>Password</label>
                        <input
                            id="password"
                            type="password"
                            className={styles.formInput}
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>
                    <button
                        type="submit"
                        className={styles.authSubmitBtn}
                        disabled={loading}
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className={styles.authFooter}>
                    Already have an account? <Link href="/login">Sign in</Link>
                </p>

                <p className={styles.terms}>
                    By signing up, you agree to our{' '}
                    <a href="#">Terms of Service</a> and{' '}
                    <a href="#">Privacy Policy</a>
                </p>

                <div className={styles.trustBadges}>
                    <span className={styles.trustItem}>
                        <span className={styles.trustIcon}>🔒</span> Encrypted
                    </span>
                    <span className={styles.trustItem}>
                        <span className={styles.trustIcon}>🛡️</span> SOC 2
                    </span>
                    <span className={styles.trustItem}>
                        <span className={styles.trustIcon}>🌍</span> GDPR
                    </span>
                </div>
            </div>
        </div>
    );
}
