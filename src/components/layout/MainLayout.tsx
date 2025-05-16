// src/components/layout/MainLayout.tsx
"use client";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "@/components/ui/dropdown-menu";
import { Home, Compass, Network, FileText, LogOut, PlusCircle, UserCircle, CreditCard, Settings, User, Bell } from "lucide-react";
import { auth } from '@/lib/firebase/config';
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { CreatePostForm, type CreatePostFormData } from '@/components/CreatePostForm'; // Import CreatePostFormData type
import type { NewPostData } from '@/types/post'; // Keep NewPostData for service layer
import { addPostToFirestore } from '@/services/postService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';

const navItems = [
  { title: "Board", href: "/", icon: Home },
  { title: "Discover", href: "/discover", icon: Compass },
  { title: "Connect", href: "/connect", icon: Network },
  { title: "Contracts", href: "/contracts", icon: FileText },
];

export const availableTags = [
    "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

// Define the list of sectors for the form
const formSectors = [
  "Agriculture, Forestry, Fishing and Hunting",
  "Mining, Quarrying, and Oil and Gas Extraction",
  "Utilities",
  "Construction",
  "Manufacturing",
  "Wholesale Trade",
  "Retail Trade",
  "Transportation and Warehousing",
  "Information",
  "Finance and Insurance",
  "Real Estate and Rental and Leasing",
  "Professional, Scientific, and Technical Services",
  "Management of Companies and Enterprises",
  "Administrative and Support and Waste Management and Remediation Services",
  "Educational Services",
  "Health Care and Social Assistance",
  "Arts, Entertainment, and Recreation",
  "Accommodation and Food Services",
  "Other Services (except Public Administration)",
  "Public Administration"
];

const getInitials = (displayNameOrEmail: string | null | undefined): string => {
    if (!displayNameOrEmail) return '?';
    const name = displayNameOrEmail; // Use directly
    if (name.includes('@') && !displayNameOrEmail) { // Fallback to email initial if display name is email-like
        return name.charAt(0).toUpperCase();
    }
    const parts = name.split(' ').filter(Boolean);
    if (parts.length > 1) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
};


export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push('/login');
    } catch (error) {
      console.error("Logout Error:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred during logout. Please try again.",
      });
    }
  };

  const addPostMutation = useMutation({
      mutationFn: addPostToFirestore,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['posts'] }).then(() => {
              toast({
                  title: "Post Created",
                  description: "Your post has been added to the board.",
              });
              setIsCreatePostOpen(false);
          }).catch(err => {
              console.error("Error during post-success operations (invalidate/toast/close):", err);
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
      },
  });

  const handleAddPost = (formData: CreatePostFormData) => { // formData type now includes sector
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Required",
            description: "You must be logged in to create a post.",
        });
        return;
    }

    // NewPostData is the type expected by addPostToFirestore service
    const newPostDataForService: NewPostData = {
        question: formData.question,
        description: formData.description,
        tags: formData.tags || [],
        sector: formData.sector, // Use sector from the form data
        userId: user.uid,
        // Placeholders for other required fields in Post type, not yet collected by this form
        businessType: "Startup", // Example placeholder
        safetyIndicator: "Medium", // Example placeholder
        ratingScore: Math.floor(Math.random() * 3) + 3, // Example placeholder (3-5)
        // naicsCode and stockGraphData are optional in the Post type or handled differently
    };
    addPostMutation.mutate(newPostDataForService);
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
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
           <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
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
                     {isCreatePostOpen && (
                        <CreatePostForm
                           onSubmit={handleAddPost}
                           availableTags={availableTags}
                           availableSectors={formSectors} // Pass sectors to the form
                           isSubmitting={addPostMutation.isPending}
                        />
                     )}
                  </DialogContent>
                </Dialog>
             )}

            {user ? (
              <div className="flex items-center gap-2">
                <NotificationDropdown userId={user.uid} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" aria-label="User Menu" className="rounded-full h-8 w-8">
                       <Avatar className="h-8 w-8">
                         <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? "User"} />
                         <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                           {getInitials(user.displayName || user.email)}
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
                    <DropdownMenuItem asChild className={cn("cursor-pointer", pathname === `/profile/${user.uid}` && "bg-accent text-accent-foreground")}>
                      <Link href={`/profile/${user.uid}`} className="w-full">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={cn("cursor-pointer", pathname === "/subscription" && "bg-accent text-accent-foreground")}>
                       <Link href="/subscription" className="w-full">
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Subscription</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={cn("cursor-pointer", pathname.startsWith("/settings") && "bg-accent text-accent-foreground")}>
                       <Link href="/settings/profile" className="w-full">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
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
              <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" asChild>
                   <Link href="/login">Login</Link>
                 </Button>
                 <Button variant="default" size="sm" asChild>
                   <Link href="/signup">Sign Up</Link>
                 </Button>
              </div>
            )}
           </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="py-4 border-t mt-auto">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} AnonyCollab. All rights reserved.
          </div>
      </footer>
    </div>
  );
}
