'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext.jsx';
import Loading from '@/components/Loading.jsx';
import LandingPage from '@/views/LandingPage.jsx';

export default function RootPage() {
  const { isAuthed, authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (isAuthed) router.replace('/dashboard');
  }, [isAuthed, authLoading, router]);

  if (authLoading) return <Loading />;
  if (isAuthed) return <Loading />;
  return <LandingPage />;
}
