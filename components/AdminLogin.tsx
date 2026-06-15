import React from 'react';
import { useNavigate } from 'react-router-dom';
import SignInModal from './account/SignInModal';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const toAtlas = () => navigate('/admin/atlas');

  return (
    <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold text-center mb-3">
          Admin
        </p>
        <h1 className="font-serif text-3xl text-wood-900 font-medium mb-8 text-center">
          Sign in
        </h1>
        <SignInModal onClose={toAtlas} onSignedIn={toAtlas} />
        <p className="font-sans text-xs text-wood-500 mt-6 text-center leading-relaxed">
          Admin access is restricted to the workspace email on file.
        </p>
      </div>
    </section>
  );
};

export default AdminLogin;
