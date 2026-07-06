'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext.jsx';
import AppShell from '@/components/AppShell.jsx';

export default function AdminLayout({ children }) {
  const { isAuthed, authLoading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) router.replace('/login');
    else if (role !== 'admin') router.replace('/dashboard');
  }, [isAuthed, authLoading, role, router]);

  if (authLoading || !isAuthed || role !== 'admin') return null;

  return <AppShell>{children}</AppShell>;
}
