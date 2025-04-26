
"use client"; // Required because this page uses hooks and client-side logic

import React from 'react';
import { MessagingInterface } from '@/components/messaging/MessagingInterface'; // Corrected import path
import { useAuth } from '@/contexts/AuthContext'; // To get the current user
import { Loader2, AlertTriangle } from 'lucide-react';

// This page will now be rendered within the MainLayout
const ContractsPage = () => {
    const { user, loading } = useAuth();

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
                <p className="text-muted-foreground">Please log in to view contracts and messages.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 flex flex-col h-[calc(100vh-8rem)]"> {/* Adjust height based on header/footer */}
            <h1 className="text-2xl font-semibold text-foreground mb-4">Contracts & Messaging</h1>
            <p className="text-muted-foreground mb-6">
                Manage your collaborations and communicate securely with your connections.
            </p>
            {/* Render the Messaging Interface */}
            <div className="flex-grow border rounded-lg overflow-hidden shadow-sm"> {/* Container for the messaging UI */}
                {/* Pass user ID and handle potential errors during conversation load within MessagingInterface */}
                <MessagingInterface currentUserId={user.uid} />
            </div>
        </div>
    );
};

export default ContractsPage;
