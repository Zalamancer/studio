
// src/app/settings/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// This page acts as a redirect to the default settings section (e.g., profile)
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the profile settings page by default
    router.replace('/settings/profile');
  }, [router]);

  // Show a loading indicator while redirecting
  return (
    <div className="flex justify-center items-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="ml-3 text-muted-foreground">Loading settings...</p>
    </div>
  );
}
