import React, { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import RegisterForm from '@/components/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat Formulir Pendaftaran...</div>}>
          <RegisterForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
