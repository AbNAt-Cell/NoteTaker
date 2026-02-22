import Link from 'next/link';

export const metadata = {
    title: 'Privacy Policy - Amebo',
    description: 'Privacy Policy and data handling practices for Amebo AI.',
};

export default function PrivacyPolicy() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 32px', color: '#e5e5e5', lineHeight: '1.7' }}>
            <div style={{ marginBottom: '40px' }}>
                <Link href="/" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: '500' }}>
                    &larr; Back to Home
                </Link>
            </div>

            <h1 style={{ fontSize: '2.5rem', marginBottom: '16px', fontWeight: '700', color: '#fff' }}>Privacy Policy</h1>
            <p style={{ color: '#aaa', marginBottom: '40px' }}>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>1. Introduction</h2>
                <p style={{ marginBottom: '16px' }}>
                    Welcome to Amebo ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
                    This Privacy Policy explains how we collect, use, and share your information when you use our AI meeting intelligence services at ameboai.com (the "Service").
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>2. Information We Collect</h2>
                <p style={{ marginBottom: '16px' }}>We collect personal information that you voluntarily provide to us when you register on the Service, including:</p>
                <ul style={{ paddingLeft: '24px', marginBottom: '16px', listStyleType: 'disc' }}>
                    <li style={{ marginBottom: '8px' }}><strong>Account Information:</strong> Name, email address, and authentication credentials (e.g., Google OAuth).</li>
                    <li style={{ marginBottom: '8px' }}><strong>Meeting Data:</strong> Audio recordings, transcripts, and AI-generated summaries of the meetings you record using our Service.</li>
                    <li style={{ marginBottom: '8px' }}><strong>Calendar Data:</strong> If authorized, we access your calendar events to join and record meetings automatically.</li>
                </ul>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>3. How We Use Your Information</h2>
                <p style={{ marginBottom: '16px' }}>We use personal information collected via our Service for a variety of business purposes described below:</p>
                <ul style={{ paddingLeft: '24px', marginBottom: '16px', listStyleType: 'disc' }}>
                    <li style={{ marginBottom: '8px' }}>To facilitate account creation and logon process.</li>
                    <li style={{ marginBottom: '8px' }}>To provide the core functionality: transcribing and summarizing your meetings using AI.</li>
                    <li style={{ marginBottom: '8px' }}>To improve, personalize, and expand our Service.</li>
                    <li style={{ marginBottom: '8px' }}>To communicate with you, including for customer service and updates.</li>
                </ul>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>4. Data Processing and AI</h2>
                <p style={{ marginBottom: '16px' }}>
                    Amebo utilizes advanced AI models (such as OpenAI) to process meeting audio and transcripts. Your meeting data is processed securely and is <strong>not</strong> used by Amebo or our third-party AI providers to train public AI models. Data is encrypted in transit and at rest.
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>5. Data Retention and Deletion</h2>
                <p style={{ marginBottom: '16px' }}>
                    We retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy. You have the right to request the deletion of your account and all associated meeting data at any time through your account settings or by contacting us.
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>6. Sharing Your Information</h2>
                <p style={{ marginBottom: '16px' }}>
                    We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. We may share data with trusted third-party service providers (e.g., cloud hosting, database providers, AI processing APIs) strictly to operate the Service.
                </p>
            </section>

            <section>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>7. Contact Us</h2>
                <p>
                    If you have questions or comments about this notice, you may email us at support@ameboai.com.
                </p>
            </section>
        </div>
    );
}
