import React from 'react';
import { useNavigate } from 'react-router-dom';
import SignInModal from './account/SignInModal';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const toAtlas = () => navigate('/admin/atlas');

  return (
    <section className="min-h-screen bg-admin flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="font-label text-label uppercase tracking-[0.2em] text-accent font-semibold text-center mb-3">
          Admin
        </p>
        <h1 className="font-display text-section-heading text-ink font-medium mb-8 text-center">
          Sign in
        </h1>
        <SignInModal onClose={toAtlas} onSignedIn={toAtlas} />
        <p className="font-reading text-label text-ink-faint mt-6 text-center leading-relaxed">
          Admin access is restricted to the workspace email on file.
        </p>
      </div>
    </section>
  );
};

export default AdminLogin;
