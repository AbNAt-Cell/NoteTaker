import Link from 'next/link';

export const metadata = {
    title: 'Terms of Service - Amebo',
    description: 'Terms of Service and usage conditions for Amebo AI.',
};

export default function TermsOfService() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 32px', color: '#e5e5e5', lineHeight: '1.7' }}>
            <div style={{ marginBottom: '40px' }}>
                <Link href="/" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: '500' }}>
                    &larr; Back to Home
                </Link>
            </div>

            <h1 style={{ fontSize: '2.5rem', marginBottom: '16px', fontWeight: '700', color: '#fff' }}>Terms of Service</h1>
            <p style={{ color: '#aaa', marginBottom: '40px' }}>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>1. Agreement to Terms</h2>
                <p style={{ marginBottom: '16px' }}>
                    By accessing or using the Amebo website (ameboai.com) and services, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, then you may not access the Service.
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>2. Use of the Service</h2>
                <p style={{ marginBottom: '16px' }}>
                    Amebo provides AI-powered meeting transcription and summarization tools. You agree to use the Service only for lawful purposes and in accordance with these Terms. You are prohibited from:
                </p>
                <ul style={{ paddingLeft: '24px', marginBottom: '16px', listStyleType: 'disc' }}>
                    <li style={{ marginBottom: '8px' }}>Using the Service to record individuals without their consent where legally required.</li>
                    <li style={{ marginBottom: '8px' }}>Violating any applicable national or international law or regulation.</li>
                    <li style={{ marginBottom: '8px' }}>Attempting to interfere with the proper working of the Service or bypass our security measures.</li>
                </ul>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>3. Accounts</h2>
                <p style={{ marginBottom: '16px' }}>
                    When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                    You are responsible for safeguarding the password that you use to access the Service.
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>4. Meeting Data and Content</h2>
                <p style={{ marginBottom: '16px' }}>
                    You retain all rights and ownership to the audio files, transcripts, and summaries generated through your use of the Service ("Your Content"). By using the Service, you grant Amebo a limited, secure license to process Your Content solely for the purpose of providing the transcription and summarization features to you. We do not sell your data or use it to train public AI models.
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>5. Third-Party Services</h2>
                <p style={{ marginBottom: '16px' }}>
                    Our Service may integrate with third-party services (e.g., Google Calendar, Zoom, OpenAI). Amebo is not responsible for the content, privacy policies, or practices of any third-party web sites or services. You acknowledge and agree that Amebo shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of any such third-party services.
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>6. Termination</h2>
                <p style={{ marginBottom: '16px' }}>
                    We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
                </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>7. Limitation of Liability</h2>
                <p style={{ marginBottom: '16px' }}>
                    In no event shall Amebo, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                </p>
            </section>

            <section>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#fff' }}>8. Contact Us</h2>
                <p>
                    If you have any questions about these Terms, please contact us at support@ameboai.com.
                </p>
            </section>
        </div>
    );
}
