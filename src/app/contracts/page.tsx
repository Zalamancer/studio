
// src/app/contracts/page.tsx
"use client";

import React from 'react';
import { MessagingInterface } from '@/components/messaging/MessagingInterface';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // For a potential back button if needed here

const ContractsPage = () => {
    const { user, loading: authLoading } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialConversationId = searchParams?.get('conversationId');
    const highlightPostId = searchParams?.get('postId'); // Still useful for initial highlighting logic if MessagingInterface uses it

    if (authLoading) {
        return (
            <div className="container mx-auto p-4 flex justify-center items-center min-h-[calc(100vh-10rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading user...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container mx-auto p-4 text-center">
                 <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
                <p className="text-muted-foreground font-semibold">Please log in to view contracts and messages.</p>
                 <Button onClick={() => router.push('/login')} className="mt-4">Log In</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 flex flex-col h-[calc(100vh-8rem)]">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Contracts & Messaging</h1>
                <p className="text-muted-foreground mt-1 max-w-2xl">
                    Manage your collaborations and communicate securely regarding specific posts.
                </p>
            </div>
            <div className="flex-grow border rounded-lg overflow-hidden shadow-sm bg-card"> {/* Ensure MessagingInterface fills this */}
                <MessagingInterface
                    currentUserId={user.uid}
                    initialConversationId={initialConversationId}
                    highlightPostId={highlightPostId} 
                />
            </div>
        </div>
    );
};

export default ContractsPage;
