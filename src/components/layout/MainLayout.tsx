
"use client"; // This layout uses client-side hooks and state

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import Dropdown components
import { Home, LineChart, Network, FileText, LogOut, PlusCircle, UserCircle, CreditCard, Settings, User, Bell } from "lucide-react"; // Added Bell icon
import { signOut } from '@/lib/firebase/auth'; // Import signOut
import { auth } from '@/lib/firebase/config'; // Import auth from config
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { CreatePostForm } from '@/components/CreatePostForm';
import type { NewPostData, Post } from '@/types/post';
import { addPostToFirestore } from '@/services/postService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle'; // Import ThemeToggle
import { cn } from '@/lib/utils'; // Import cn for class merging
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'; // Import NotificationDropdown

// Navigation items definition (moved here for clarity)
const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Invest", href: "/invest", icon: LineChart },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
  // Subscription is moved to the profile dropdown
  // { title: "Subscription", href: "/subscription", icon: CreditCard },
];

// Available tags (can be fetched or defined globally if needed elsewhere)
export const availableTags = [
    "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

// Helper to get initials for Avatar
const getInitials = (email: string | null | undefined): string => {
    if (!email) return '?';
    // Prefer display name's first char if available, otherwise email
    const name = auth.currentUser?.displayName; // Use imported auth object
    if (name) return name.charAt(0).toUpperCase();
    return email.substring(0, 1).toUpperCase();
};


export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); // Get user state
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname(); // Get current path for active link styling
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const queryClient = useQueryClient(); // Get query client instance

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push('/login'); // Redirect to login after logout
    } catch (error) {
      console.error("Logout Error:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred during logout. Please try again.",
      });
    }
  };

  // Add Post Mutation
  const addPostMutation = useMutation({
      mutationFn: addPostToFirestore,
      onSuccess: () => {
          // Invalidate queries first to refetch data in the background
          queryClient.invalidateQueries({ queryKey: ['posts'] }).then(() => {
              // Show success toast
              toast({
                  title: "Post Created",
                  description: "Your post has been added to the board.",
              });
              // Close the dialog
              setIsCreatePostOpen(false);
          }).catch(err => {
              console.error("Error during post-success operations (invalidate/toast/close):", err);
               // Still attempt to close the dialog even if other steps failed
               setIsCreatePostOpen(false);
          });
       },
      onError: (error: Error) => {
          console.error("Add Post Mutation failed:", error);
          toast({
            variant: "destructive",
            title: "Post Failed",
            description: `Could not add your post: ${error.message}. Check console and Firestore rules.`,
          });
          // Optionally keep the dialog open on error
          // setIsCreatePostOpen(true);
      },
  });

  // Handle adding a post (passed to CreatePostForm)
  const handleAddPost = (formData: Omit<Post, 'id' | 'createdAt' | 'userId' | 'sector' | 'businessType' | 'safetyIndicator' | 'ratingScore' | 'stockGraphData'>) => {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Required",
            description: "You must be logged in to create a post.",
        });
        return;
    }

    const newPostData: NewPostData = {
        question: formData.question,
        description: formData.description,
        tags: formData.tags || [],
        userId: user.uid, // Associate post with the logged-in user
        // createdAt is handled by serverTimestamp in the service
        sector: "Tech", // Placeholder - Should ideally come from user profile or form
        businessType: "Startup", // Placeholder
        safetyIndicator: "Medium", // Placeholder
        ratingScore: Math.floor(Math.random() * 5) + 1, // Placeholder
        stockGraphData: [], // Placeholder
    };
    addPostMutation.mutate(newPostData);
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* --- Header --- */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              {/* Optional: Add Logo here */}
              <span className="hidden font-bold sm:inline-block text-primary hover:text-primary/90 text-lg">
                AnonyCollab
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm lg:gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className={cn(
                    "transition-colors hover:text-foreground/80",
                    pathname === item.href ? 'text-foreground font-semibold' : 'text-foreground/60'
                  )}
                >
                  <item.icon className="mr-1 h-4 w-4 inline-block" aria-hidden="true" />
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>
           {/* Mobile Menu Trigger (Optional) */}
           <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
             {/* Create Post Button - only if user is logged in */}
             {user && (
                <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
                  <DialogTrigger asChild>
                     <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                       <PlusCircle className="mr-2 h-4 w-4" />
                       Create Post
                     </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                     <DialogHeader>
                       <DialogTitle>Create a New Post</DialogTitle>
                       <DialogDescription>
                         Share your question or need with the community. Keep it anonymous.
                       </DialogDescription>
                     </DialogHeader>
                     {isCreatePostOpen && ( // Conditionally render form only when dialog is open
                        <CreatePostForm
                           onSubmit={handleAddPost}
                           availableTags={availableTags}
                           isSubmitting={addPostMutation.isPending}
                        />
                     )}
                  </DialogContent>
                </Dialog>
             )}

            {/* --- User Actions Area --- */}
            {user ? (
              <div className="flex items-center gap-2">
                {/* Notification Dropdown */}
                <NotificationDropdown userId={user.uid} />

                {/* User Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" aria-label="User Menu" className="rounded-full h-8 w-8">
                       <Avatar className="h-8 w-8">
                         <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? "User"} />
                         <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                           {getInitials(user.email ?? user.displayName)}
                         </AvatarFallback>
                       </Avatar>
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                       <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {/* Apply cursor-pointer to interactive items */}
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href={`/profile/${user.uid}`}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                       <Link href="/subscription">
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Subscription</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                       <Link href="/settings/profile"> {/* Link to settings */}
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    {/* Add Theme Toggle Item - keep cursor-pointer */}
                    <ThemeToggle />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                       <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // Show Login/Signup buttons if not logged in
              <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" asChild>
                   <Link href="/login">Login</Link>
                 </Button>
                 <Button variant="default" size="sm" asChild>
                   <Link href="/signup">Sign Up</Link>
                 </Button>
              </div>
            )}
            {/* --- End User Actions Area --- */}

           </div>
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <main className="flex-1">
        {children} {/* The content of the specific page will be rendered here */}
      </main>

      {/* --- Footer --- */}
      <footer className="py-4 border-t mt-auto"> {/* Use mt-auto to push footer down */}
          <div className="container mx-auto text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} AnonyCollab. All rights reserved.
          </div>
      </footer>
    </div>
  );
}

