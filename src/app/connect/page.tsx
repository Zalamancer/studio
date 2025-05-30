// src/components/layout/MainLayout.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Home, Compass, MessageSquare, LogOut, PlusCircle, Settings, User, CreditCard, Handshake, Factory } from "lucide-react"; // Replaced Network, FileText with MessageSquare
import { signOut } from '@/lib/firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import type {
  CreatePostFormData,
  CreatePostFormProps
} from '@/components/CreatePostForm';
import type {
  NewPostData,
  SectorWithSubSectors as SectorWithSubSectorsType,
  SubSector as SubSectorType,
  Industry as IndustryType
} from '@/types/post'; // Ensure this path is correct
import { addPostToFirestore } from '@/services/postService';
import { uploadPostImage } from '@/services/storageService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { Timestamp } from 'firebase/firestore';
import { useIsMobile } from "@/hooks/use-mobile";
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { createNotification } from '@/services/notificationService';
import { getReviewsForProfile } from '@/services/reviewService';
import { fetchFullUserProfile } from '@/services/connectionService'; // Assuming this exists

// Ensure this detailedSectorsData matches or is sourced from a shared location
// if it's also used in src/app/discover/[sectorCode]/page.tsx or similar.
// For brevity, I'm assuming a simplified version here or that it's correctly defined as before.
export const detailedSectorsData: SectorWithSubSectorsType[] = [
    {
        name: "Agriculture, Forestry, Fishing and Hunting", code: "11",
        description: "Growing crops, raising animals, harvesting timber, and fishing.",
        subSectors: [
            {
                name: "Crop Production", code: "111",
                industries: [
                    { name: "Soybean Farming", code: "111110" },
                    { name: "Oilseed (except Soybean) Farming", code: "111120" },
                    { name: "Dry Pea and Bean Farming", code: "111130" },
                    { name: "Wheat Farming", code: "111140" },
                    { name: "Corn Farming", code: "111150" },
                    { name: "Rice Farming", code: "111160" },
                    { name: "Oilseed and Grain Combination Farming", code: "111191" },
                    { name: "All Other Grain Farming", code: "111199" },
                ],
            },
            {
                name: "Animal Production and Aquaculture", code: "112",
                industries: [
                    { name: "Beef Cattle Ranching and Farming", code: "112111" },
                    { name: "Cattle Feedlots", code: "112112" },
                    { name: "Dairy Cattle and Milk Production", code: "112120" },
                ],
            },
             {
                name: "Forestry and Logging", code: "113",
                industries: [ { name: "Timber Tract Operations", code: "113110" },],
            },
            {
                name: "Fishing, Hunting and Trapping", code: "114",
                industries: [{ name: "Finfish Fishing", code: "114111" },],
            },
            {
                name: "Support Activities for Agriculture and Forestry", code: "115",
                industries: [ { name: "Cotton Ginning", code: "115111" },],
            },
        ],
    },
    {
        name: "Mining, Quarrying, and Oil and Gas Extraction", code: "21",
        description: "Extracting naturally occurring mineral solids, liquids, and gases.",
        subSectors: [
            { name: "Oil and Gas Extraction", code: "211", industries: [{ name: "Crude Petroleum and Natural Gas Extraction", code: "2111" }] },
            { name: "Coal Mining", code: "2121", industries: [{ name: "Coal Mining", code: "2121" }] },
        ],
    },
    {
        name: "Utilities", code: "22",
        description: "Providing utility services like electric power, natural gas, water, and sewage.",
        subSectors: [
            { name: "Electric Power Generation, Transmission and Distribution", code: "2211", industries: [{ name: "Electric Power Generation", code: "22111" }] },
        ],
    },
    {
        name: "Construction", code: "23",
        description: "Construction of buildings and engineering projects.",
        subSectors: [
            { name: "Construction of Buildings", code: "236", industries: [{ name: "Residential Building Construction", code: "2361" }] },
        ],
    },
    {
        name: "Manufacturing", code: "31-33",
        description: "Mechanical, physical, or chemical transformation of materials into new products.",
        subSectors: [
            { name: "Food Manufacturing", code: "311", industries: [{ name: "Animal Food Manufacturing", code: "3111" }] },
            { name: "Beverage and Tobacco Product Manufacturing", code: "312", industries: [{ name: "Beverage Manufacturing", code: "3121" }] },
        ],
    },
     {
        name: "Wholesale Trade", code: "42",
        description: "Wholesaling merchandise, generally without transformation.",
        subSectors: [
            { name: "Merchant Wholesalers, Durable Goods", code: "423", industries: [{ name: "Motor Vehicle and Motor Vehicle Parts and Supplies Merchant Wholesalers", code: "4231" }] },
        ],
    },
    {
        name: "Retail Trade", code: "44-45",
        description: "Retailing merchandise, generally without transformation.",
        subSectors: [
            { name: "Motor Vehicle and Parts Dealers", code: "441", industries: [{ name: "Automobile Dealers", code: "4411" }] },
        ],
    },
    {
        name: "Transportation and Warehousing", code: "48-49",
        description: "Transportation of passengers and cargo, warehousing and storage.",
        subSectors: [
            { name: "Air Transportation", code: "481", industries: [{ name: "Scheduled Passenger Air Transportation", code: "481111" }] },
        ],
    },
    {
        name: "Information", code: "51",
        description: "Producing and distributing information and cultural products.",
        subSectors: [
            { name: "Publishing Industries (except Internet)", code: "513", industries: [{ name: "Newspaper, Periodical, Book, and Directory Publishers", code: "5131" }] },
        ],
    },
     {
        name: "Finance and Insurance", code: "52",
        description: "Financial transactions and facilitating financial transactions.",
        subSectors: [
            { name: "Depository Credit Intermediation", code: "5221", industries: [{ name: "Commercial Banking", code: "522110" }] },
        ],
    },
    {
        name: "Real Estate and Rental and Leasing", code: "53",
        description: "Renting, leasing, or otherwise allowing the use of assets.",
        subSectors: [
            { name: "Real Estate", code: "531", industries: [{ name: "Lessors of Residential Buildings and Dwellings", code: "531110" }] },
        ],
    },
    {
        name: "Professional, Scientific, and Technical Services", code: "54",
        description: "Performing professional, scientific, and technical activities for others.",
        subSectors: [
            { name: "Legal Services", code: "5411", industries: [{ name: "Offices of Lawyers", code: "541110" }] },
        ],
    },
    {
        name: "Management of Companies and Enterprises", code: "55",
        description: "Holding securities of companies for controlling interest or influencing management.",
        subSectors: [
            { name: "Management of Companies and Enterprises", code: "551", industries: [{ name: "Offices of Bank Holding Companies", code: "551111" }] },
        ],
    },
    {
        name: "Administrative and Support and Waste Management and Remediation Services", code: "56",
        description: "Routine support activities for other organizations or managing waste.",
        subSectors: [
            { name: "Administrative and Support Services", code: "561", industries: [{ name: "Office Administrative Services", code: "5611" }] },
        ],
    },
    {
        name: "Educational Services", code: "61",
        description: "Providing instruction and training in a wide variety of subjects.",
        subSectors: [
            { name: "Educational Services", code: "611", industries: [{ name: "Elementary and Secondary Schools", code: "6111" }] },
        ],
    },
    {
        name: "Health Care and Social Assistance", code: "62",
        description: "Providing health care and social assistance for individuals.",
        subSectors: [
            { name: "Ambulatory Health Care Services", code: "621", industries: [{ name: "Offices of Physicians", code: "6211" }] },
        ],
    },
    {
        name: "Arts, Entertainment, and Recreation", code: "71",
        description: "Operating facilities or providing services for cultural, entertainment, and recreational interests.",
        subSectors: [
            { name: "Performing Arts, Spectator Sports, and Related Industries", code: "711", industries: [{ name: "Performing Arts Companies", code: "7111" }] },
        ],
    },
    {
        name: "Accommodation and Food Services", code: "72",
        description: "Providing lodging and/or preparing meals, snacks, and beverages.",
        subSectors: [
            { name: "Accommodation", code: "721", industries: [{ name: "Hotels (except Casino Hotels) and Motels", code: "721110" }] },
        ],
    },
    {
        name: "Other Services (except Public Administration)", code: "81",
        description: "Providing services not elsewhere classified.",
        subSectors: [
            { name: "Repair and Maintenance", code: "811", industries: [{ name: "Automotive Repair and Maintenance", code: "8111" }] },
        ],
    },
    {
        name: "Public Administration", code: "92",
        description: "Government agencies administering public programs.",
        subSectors: [
            { name: "Executive, Legislative, and Other General Government Support", code: "921", industries: [{ name: "Executive Offices", code: "921110" }] },
        ],
    },
];

export const availableTags = [
  "Legal", "Product", "Supplier", "Collaboration", "Marketing", "Ads", "Audience"
];

// Dynamic imports for components used in dialogs or dropdowns
const DynamicCreatePostForm = dynamic<CreatePostFormProps>(() =>
  import('@/components/CreatePostForm').then((mod) => mod.CreatePostForm),
  { loading: () => <div className="p-4 text-center"><p className="text-sm text-muted-foreground">Loading form...</p></div>, ssr: false }
);

const DynamicNotificationDropdown = dynamic(() =>
  import('@/components/notifications/NotificationDropdown').then((mod) => mod.NotificationDropdown),
  {
    loading: () => <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications (Loading)"><MessageSquare className="h-5 w-5" /></Button>, // Changed Bell to MessageSquare temporarily if Bell causes issues
    ssr: false
  }
);

const DynamicThemeToggle = dynamic(() =>
  import('@/components/ThemeToggle').then((mod) => mod.ThemeToggle),
  {
    loading: () => <DropdownMenuItem disabled className="justify-between">Theme <span className="text-xs text-muted-foreground">...</span></DropdownMenuItem>,
    ssr: false
  }
);


export default function MainLayout({
  children
}: {
  children: React.ReactNode
}) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

  const handlePrefetchSettings = useCallback(() => {
    if (user?.uid) {
      queryClient.prefetchQuery({
        queryKey: ['fullUserProfile', user.uid],
        queryFn: () => fetchFullUserProfile(user.uid),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (isMobile) {
      const setVisualViewportHeight = () => {
        if (typeof window !== 'undefined') {
          const vh = window.innerHeight * 0.01;
          document.documentElement.style.setProperty('--vh-dynamic', `${vh}px`);
        }
      };
      setVisualViewportHeight();
      window.addEventListener('resize', setVisualViewportHeight);
      window.addEventListener('orientationchange', setVisualViewportHeight);
      return () => {
        window.removeEventListener('resize', setVisualViewportHeight);
        window.removeEventListener('orientationchange', setVisualViewportHeight);
      };
    }
  }, [isMobile]);

  useEffect(() => {
    if (!authLoading && !user && isCreatePostOpen) {
      setIsCreatePostOpen(false);
    }
  }, [user, authLoading, isCreatePostOpen]);


  const addPostMutation = useMutation({
    mutationFn: async (formData: CreatePostFormData) => {
      if (!user) throw new Error("User not authenticated to create post.");
      console.log(`%c[MainLayout] addPostMutation: Initiated by user: ${user.uid}`, "color: magenta;");
      console.log(`%c[MainLayout] addPostMutation: Form data received:`, "color: magenta;", formData);

      let currentRatingScore = 0;
      try {
        console.log(`[MainLayout] addPostMutation: Fetching reviews for user ${user.uid} to calculate current rating score.`);
        const reviews = await getReviewsForProfile(user.uid);
        console.log(`[MainLayout] addPostMutation: Fetched ${reviews.length} reviews for user ${user.uid}.`);
        if (reviews && reviews.length > 0) {
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          currentRatingScore = parseFloat((totalRating / reviews.length).toFixed(1));
        }
      } catch (ratingError: any) {
        console.error("[MainLayout] addPostMutation: Error fetching reviews for rating score:", ratingError.message);
        // Proceed with ratingScore = 0 if fetching reviews fails
      }
      console.log(`%c[MainLayout] addPostMutation: User ${user.uid} rating score for new post: ${currentRatingScore}`, "color: magenta; font-weight: bold;");

      let uploadedImageUrls: string[] = [];
      if (formData.imageFile && user) {
        try {
          const singleUploadedUrl = await uploadPostImage(formData.imageFile, user.uid);
          if (singleUploadedUrl) uploadedImageUrls.push(singleUploadedUrl);
        } catch (uploadError: any) {
          toast({ variant: "destructive", title: "Image Upload Failed", description: uploadError.message || "Could not upload image." });
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }
      }

      const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
      const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
      const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

      const newPostDataForService: NewPostData = {
        userId: user.uid,
        question: formData.question,
        requestType: formData.requestType,
        descriptionDetails: formData.descriptionDetails,
        descriptionTried: formData.descriptionTried || null,
        descriptionOutcome: formData.descriptionOutcome || null,
        tags: formData.tags || [],
        sector: mainSectorDetails?.name || formData.sector,
        subSector: subSectorDetails?.name || null,
        industry: industryDetails?.name || null,
        naicsCode: formData.industry || formData.subSector || formData.sector,
        ratingScore: currentRatingScore,
        imageUrls: uploadedImageUrls,
        mentionedUserIds: formData.mentionedUserIds || [],
        maxBudget: formData.requestType === 'help_request' ? (formData.maxBudget === undefined ? null : formData.maxBudget) : null,
        deadline: formData.requestType === 'help_request' && formData.deadline ? Timestamp.fromDate(new Date(formData.deadline)) : null,
        commentCount: 0,
      };
      console.log(`%c[MainLayout] addPostMutation: Post data PREPARED for service. RatingScore: ${newPostDataForService.ratingScore}. Data:`, "color: #FF00FF;", newPostDataForService);
      return addPostToFirestore(newPostDataForService);
    },
    onSuccess: (newlyCreatedPostId, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage'] });
      toast({ title: variables.requestType === 'help_request' ? "Help Request Submitted" : "Post Created", description: "Your submission has been added." });
      setIsCreatePostOpen(false);

      if (user && newlyCreatedPostId && variables.mentionedUserIds && variables.mentionedUserIds.length > 0) {
        const descriptionSource = variables.descriptionDetails; // Always use descriptionDetails
        variables.mentionedUserIds.forEach(async (mentionedUid) => {
          if (mentionedUid !== user.uid) {
            try {
              await createNotification({
                userId: mentionedUid,
                type: 'mention',
                senderId: user.uid,
                postId: newlyCreatedPostId,
                postQuestion: variables.question,
                textSnippet: descriptionSource ? descriptionSource.substring(0, 100) : "",
              });
            } catch (notifyError) {
              console.error(`[MainLayout] Failed to create mention notification for post ${newlyCreatedPostId}:`, notifyError);
            }
          }
        });
      }
    },
    onError: (error: Error, variables) => {
      toast({ variant: "destructive", title: "Submission Failed", description: `Could not submit ${variables.requestType === 'help_request' ? 'help request' : 'post'}: ${error.message}.` });
    },
  });

  const handleCreatePostSubmit = useCallback(
    (formData: CreatePostFormData) => {
      if (!user) {
        toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in." });
        return;
      }
      console.log("[MainLayout] handleCreatePostSubmit formData RECEIVED:", JSON.stringify(formData, null, 2));
      addPostMutation.mutate(formData);
    },
    [user, toast, addPostMutation, queryClient] // queryClient added as it's used in addPostMutation's onSuccess
  );

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error) {
      console.error("Logout Error:", error);
      toast({ variant: "destructive", title: "Logout Failed", description: "An error occurred. Please try again." });
    }
  };

  const navItems = [
    { title: "Board", href: "/", icon: Home },
    { title: "Discover", href: "/discover", icon: Compass },
    { title: "Messages", href: "/messages", icon: MessageSquare },
  ];

  const rootLayoutClasses = cn(
    "flex flex-col bg-background",
    isMobile ? "h-[calc(var(--vh-dynamic,1vh)*100)]" : "min-h-screen"
  );

  return (
    <div className={rootLayoutClasses}>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <Factory className="h-6 w-6 text-primary" />
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
                    "transition-colors hover:text-foreground/80 flex items-center",
                    pathname === item.href ? 'text-foreground font-semibold' : 'text-foreground/60'
                  )}
                >
                  <item.icon className="mr-1 h-4 w-4" aria-hidden="true" />
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
            {authLoading ? (
              <div className="flex items-center space-x-2">
                <div className="h-8 w-20 rounded-md bg-muted animate-pulse"></div>
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
              </div>
            ) : user ? (
              <>
                <Dialog open={isCreatePostOpen} onOpenChange={(open) => {
                    if (!open && addPostMutation.isSuccess) {
                      // Form reset is handled internally by CreatePostForm via onDialogClose
                    }
                    setIsCreatePostOpen(open);
                  }}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Post
                    </Button>
                  </DialogTrigger>
                  {/* No "Request Help" button or its dialog here anymore */}
                  <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                      <DialogTitle>Create New Post</DialogTitle>
                      <DialogDescription>
                        Share your idea, question, or request help from the community.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
                      {isCreatePostOpen && user && (
                        <DynamicCreatePostForm
                          onSubmit={handleCreatePostSubmit}
                          availableTags={availableTags}
                          detailedSectorsData={detailedSectorsData}
                          isSubmitting={addPostMutation.isPending}
                          currentUserId={user.uid}
                          onDialogClose={() => setIsCreatePostOpen(false)}
                        />
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {user.uid && <DynamicNotificationDropdown userId={user.uid} />}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="User Menu" className="rounded-full h-8 w-8">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL ?? undefined} alt={getInitials(user.displayName || user.email)} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {getInitials(user.displayName || user.email)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName || generateAnonymousName(user.uid)}</p>
                        {user.email && (<p className="text-xs leading-none text-muted-foreground">{user.email}</p>)}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className={cn("cursor-pointer w-full", pathname === `/profile/${user.uid}` && "bg-accent text-accent-foreground")}>
                      <Link href={`/profile/${user.uid}`} className="w-full cursor-pointer"><User className="mr-2 h-4 w-4" /><span>Profile</span></Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className={cn("cursor-pointer w-full", pathname.startsWith("/settings") && "bg-accent text-accent-foreground")}
                      onMouseEnter={handlePrefetchSettings}
                    >
                      <Link href="/settings/profile" className="w-full cursor-pointer"><Settings className="mr-2 h-4 w-4" /><span>Settings</span></Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild className={cn("cursor-pointer w-full", pathname === "/subscription" && "bg-accent text-accent-foreground")}>
                      <Link href="/subscription" className="w-full cursor-pointer"><CreditCard className="mr-2 h-4 w-4"/><span>Subscription</span></Link>
                    </DropdownMenuItem>
                    <DynamicThemeToggle />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer"><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild><Link href="/login">Login</Link></Button>
                <Button variant="default" size="sm" asChild><Link href="/signup">Sign Up</Link></Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className={cn(
          "flex-1 flex flex-col",
          isMobile ? "h-full pb-14" : "min-h-0 pb-0" // Ensure main grows and has padding for mobile nav
        )}>
        {children}
      </main>
      {!isMobile && ( /* Optional: Desktop footer can remain or be removed */
        <footer className="py-4 border-t">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} AnonyCollab. All rights reserved.
          </div>
        </footer>
      )}
      {isMobile && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border h-14">
          <div className="container mx-auto flex justify-around items-center h-full">
            {navItems.map((item) => (
              <Link
                key={`mobile-${item.title}`}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center text-xs px-2 py-1 rounded-md transition-colors w-1/4 h-full",
                  pathname === item.href ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'
                )}
              >
                <item.icon className="h-5 w-5 mb-0.5" aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}