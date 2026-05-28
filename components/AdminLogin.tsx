import React from 'react';
import { SignIn } from '@clerk/clerk-react';

const AdminLogin: React.FC = () => {
  return (
    <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold text-center mb-3">
          Admin
        </p>
        <h1 className="font-serif text-3xl text-wood-900 font-medium mb-8 text-center">
          Sign in
        </h1>
        <SignIn
          path="/admin/login"
          routing="path"
          signUpUrl="/admin/login"
          afterSignInUrl="/admin/atlas"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-none border border-wood-200 bg-white',
            },
          }}
        />
        <p className="font-sans text-xs text-wood-500 mt-6 text-center leading-relaxed">
          Admin access is restricted to the workspace email on file.
        </p>
      </div>
    </section>
  );
};

export default AdminLogin;
