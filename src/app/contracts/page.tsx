// src/app/contracts/page.tsx
"use client"; // Required because this page uses hooks and client-side logic

import React from 'react';
import { MessagingInterface } from '@/components/messaging/MessagingInterface'; // Corrected import path
import { useAuth } from '@/contexts/AuthContext'; // To get the current user
import { Loader2, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'next/navigation'; // Import useSearchParams

// This page will now be rendered within the MainLayout
const ContractsPage = () => {
    const { user, loading } = useAuth();
    const searchParams = useSearchParams(); // Hook to access query parameters
    const highlightPostId = searchParams?.get('postId'); // Get postId from URL
    const initialConversationId = searchParams?.get('conversationId'); // Get conversationId from URL


    if (loading) {
        return (
            <div className="container mx-auto p-4 flex justify-center items-center min-h-[calc(100vh-10rem)]"> {/* Adjust height as needed */}
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading user...</p>
            </div>
        );
    }

    if (!user) {
        // Optional: You could redirect here, but MainLayout might handle it too
        return (
            <div className="container mx-auto p-4 text-center">
                 <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
                <p className="text-muted-foreground font-semibold">Please log in to view contracts and messages.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 flex flex-col h-[calc(100vh-8rem)]"> {/* Adjust height based on header/footer */}
            <h1 className="text-2xl font-semibold text-foreground mb-4">Contracts & Messaging</h1>
            <p className="text-muted-foreground mb-6">
                Manage your collaborations and communicate securely regarding specific posts.
            </p>
            {/* Render the Messaging Interface */}
            <div className="flex-grow border rounded-lg overflow-hidden shadow-sm"> {/* Container for the messaging UI */}
                {/* Pass user ID, initial conversation ID, and highlighted post ID */}
                <MessagingInterface
                    currentUserId={user.uid}
                    initialConversationId={initialConversationId}
                    highlightPostId={highlightPostId} // Pass the postId for highlighting
                />
            </div>
        </div>
    );
};

export default ContractsPage;
