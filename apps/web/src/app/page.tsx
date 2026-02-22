'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(token ? '/dashboard' : '/login');
    }
  }, [loading, token, router]);

  return <div className="loader">Opening workspace...</div>;
}
