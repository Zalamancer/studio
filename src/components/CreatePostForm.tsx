
// src/components/CreatePostForm.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
    Loader2, Upload, XCircle, ImageDown, FileText, HandHelping, DollarSign, CalendarDays,
    AtSign, Briefcase, Info, Sparkles, User, Lightbulb, HelpingHand, FileQuestion, Brain, Target, Type, MessageCircle, AlignLeft, CalendarIcon, Handshake, Tag, Trash2
} from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile

const MAX_OUTPUT_FILE_SIZE_MB = 1; // Max size for the *output* compressed file
const MAX_UPLOAD_DIMENSION = 1600; // Max width or height for uploaded images
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_FILES = 5;

// Schema for individual file, checking type and initial size (before our compression)
const preCompressionFileSchema = z.instanceof(File)
  .refine(file => ACCEPTED_IMAGE_TYPES.includes(file.type), {
    message: "Only .jpg, .jpeg, .png, .gif, and .webp formats are supported."
  });
  // Initial size check can be less strict as we'll compress.
  // .refine(file => file.size <= 10 * 1024 * 1024, { // e.g. 10MB initial limit
  //   message: `Max initial image size is 10MB. Images will be compressed.`
  // });


const postFormSchema = z.object({
  requestType: z.enum(['post', 'help_request'], {
    required_error: "You must select a post type.",
  }),
  question: z.string().min(10, "Question must be at least 10 characters.").max(200, "Question cannot exceed 200 characters."),

  descriptionDetails: z.string().min(10, "Details are required (min 10 characters)."),
  descriptionTried: z.string().optional(),
  descriptionOutcome: z.string().optional(),

  tags: z.array(z.string()).min(1, "Please select at least one tag."),
  sector: z.string().min(1, "Please select a sector."),
  subSector: z.string().optional(),
  industry: z.string().optional(),

  imageFiles: z.array(preCompressionFileSchema).max(MAX_IMAGE_FILES, `You can upload a maximum of ${MAX_IMAGE_FILES} images.`).optional(),

  maxBudget: z.string().transform(val => val === '' ? undefined : val)
    .pipe(z.coerce.number().nonnegative("Budget must be a non-negative number.").optional())
    .optional(),
  deadline: z.date().optional().nullable(),
  miroBoardEmbedUrl: z.string().url("Please enter a valid Miro board embed URL.").optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  // Conditional validation moved here if needed, but description fields are always present in tabs
});

export interface CreatePostFormData {
  requestType: 'post' | 'help_request';
  question: string;
  descriptionDetails: string;
  descriptionTried?: string | undefined;
  descriptionOutcome?: string | undefined;
  tags: string[];
  sector: string;
  subSector?: string | undefined;
  industry?: string | undefined;
  imageFiles?: File[]; // Changed from imageFile to imageFiles
  mentionedUserIds?: string[];
  maxBudget?: number | undefined;
  deadline?: Date | null | undefined;
  miroBoardEmbedUrl?: string | undefined;
}

export interface CreatePostFormProps {
  onSubmit: (data: CreatePostFormData) => void;
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
  currentUserId: string | null;
  onDialogClose?: () => void;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  onSubmit,
  availableTags,
  detailedSectorsData,
  isSubmitting,
  currentUserId,
  onDialogClose,
}) => {
  const form = useForm<z.infer<typeof postFormSchema>>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      requestType: 'post',
      question: "",
      descriptionDetails: "",
      descriptionTried: "",
      descriptionOutcome: "",
      tags: [],
      sector: "",
      subSector: "",
      industry: "",
      imageFiles: [], // Initialize as empty array
      maxBudget: undefined,
      deadline: undefined,
      miroBoardEmbedUrl: "",
    },
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile(); // Add useIsMobile hook

  const [currentSubSectors, setCurrentSubSectors] = useState<SubSector[]>([]);
  const [currentIndustries, setCurrentIndustries] = useState<Industry[]>([]);

  // State for multiple image previews
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  // State for a single file being processed for compression
  const [fileForCompression, setFileForCompression] = useState<File | null>(null);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false); // Not used if auto-compressing
  const [isCompressing, setIsCompressing] = useState(false);

  const [problemDetailsValue, setProblemDetailsValue] = useState('');
  const [problemDetailsMentionQuery, setProblemDetailsMentionQuery] = useState('');
  const [debouncedProblemDetailsQuery, setDebouncedProblemDetailsQuery] = useState('');
  const [showProblemDetailsSuggestions, setShowProblemDetailsSuggestions] = useState(false);
  const problemDetailsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const problemDetailsSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [selectedMentionedUserIds, setSelectedMentionedUserIds] = useState<Set<string>>(new Set());

  const requestType = form.watch("requestType");
  const [activeDescriptionTab, setActiveDescriptionTab] = useState("details");

  const resetFormValues = useCallback(() => {
    form.reset({
      requestType: 'post',
      question: "",
      descriptionDetails: "",
      descriptionTried: "",
      descriptionOutcome: "",
      tags: [],
      sector: "",
      subSector: "",
      industry: "",
      imageFiles: [],
      maxBudget: undefined,
      deadline: undefined,
      miroBoardEmbedUrl: "",
    });
    setProblemDetailsValue('');
    setImagePreviewUrls([]);
    setFileForCompression(null);
    setShowCompressionDialog(false);
    setCurrentSubSectors([]);
    setCurrentIndustries([]);
    setActiveDescriptionTab("details");
    setProblemDetailsMentionQuery('');
    setShowProblemDetailsSuggestions(false);
    setSelectedMentionedUserIds(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [form]);

  useEffect(() => {
    if (form.formState.isSubmitSuccessful && onDialogClose) {
      const timer = setTimeout(() => {
        resetFormValues();
        onDialogClose();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [form.formState.isSubmitSuccessful, onDialogClose, resetFormValues]);

  const selectedSectorCode = form.watch("sector");
  useEffect(() => {
    if (selectedSectorCode) {
      const selectedMainSector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setCurrentSubSectors(selectedMainSector?.subSectors || []);
      form.setValue("subSector", "", { shouldValidate: false });
      form.setValue("industry", "", { shouldValidate: false });
      setCurrentIndustries([]);
    } else {
      setCurrentSubSectors([]);
      setCurrentIndustries([]);
    }
  }, [selectedSectorCode, detailedSectorsData, form]);

  const selectedSubSectorCode = form.watch("subSector");
  useEffect(() => {
    if (selectedSubSectorCode) {
      const selectedSub = currentSubSectors.find(ss => ss.code === selectedSubSectorCode);
      setCurrentIndustries(selectedSub?.industries || []);
      form.setValue("industry", "", { shouldValidate: false });
    } else {
      setCurrentIndustries([]);
    }
  }, [selectedSubSectorCode, currentSubSectors, form]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProblemDetailsQuery(problemDetailsMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [problemDetailsMentionQuery]);

  const { data: suggestibleUsers = [], isLoading: isLoadingSuggestibleUsers } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForCreatePost', debouncedProblemDetailsQuery, currentUserId],
    queryFn: () => getSuggestibleUsers(debouncedProblemDetailsQuery, debouncedProblemDetailsQuery ? 10 : 25),
    enabled: showProblemDetailsSuggestions && !!currentUserId,
  });

  const evaluateMentionState = useCallback((text: string, cursorPosition: number, setQuery: React.Dispatch<React.SetStateAction<string>>, setShow: React.Dispatch<React.SetStateAction<boolean>>) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
        const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
        if (!/\s/.test(potentialQuery) && !/\r\n|\r|\n/.test(potentialQuery)) {
            activeQuery = potentialQuery;
        }
    }
    setQuery(activeQuery !== null ? activeQuery : '');
    setShow(activeQuery !== null);
  }, []);

  const handleProblemDetailsChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setProblemDetailsValue(value);
    if (problemDetailsTextareaRef.current) {
        evaluateMentionState(value, problemDetailsTextareaRef.current.selectionStart || 0, setProblemDetailsMentionQuery, setShowProblemDetailsSuggestions);
    }
  }, [evaluateMentionState, setProblemDetailsValue, problemDetailsTextareaRef, setProblemDetailsMentionQuery, setShowProblemDetailsSuggestions]);

  const handleProblemDetailsFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (problemDetailsTextareaRef.current) {
        evaluateMentionState(e.target.value, problemDetailsTextareaRef.current.selectionStart || 0, setProblemDetailsMentionQuery, setShowProblemDetailsSuggestions);
    }
  }, [evaluateMentionState, problemDetailsTextareaRef, setProblemDetailsMentionQuery, setShowProblemDetailsSuggestions]);

  const handleSelectSuggestion = useCallback((profile: UserProfileBasic,
    currentTextValue: string,
    setTextValue: React.Dispatch<React.SetStateAction<string>>,
    inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>,
    setMentionQueryFn: React.Dispatch<React.SetStateAction<string>>,
    setShowSuggestionsFn: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!inputRef.current || !profile.mentionName) return;
    const currentValue = currentTextValue;
    const cursorPosition = inputRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1) {
        const textBeforeMention = currentValue.substring(0, lastAtIndex);
        const textAfterCursor = currentValue.substring(cursorPosition);
        const mentionToInsert = profile.mentionName;
        const newText = `${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`;

        setTextValue(newText);
        setSelectedMentionedUserIds(prev => new Set(prev).add(profile.userId));

        const newCursorPosition = textBeforeMention.length + ("@" + mentionToInsert + " ").length;
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
        }, 0);
    }
    setShowSuggestionsFn(false);
    setMentionQueryFn('');
  }, [setSelectedMentionedUserIds]);

  useEffect(() => {
    if (problemDetailsValue !== form.getValues('descriptionDetails')) {
      form.setValue('descriptionDetails', problemDetailsValue, { shouldValidate: true, shouldDirty: true });
    }
  }, [problemDetailsValue, form]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showProblemDetailsSuggestions &&
        problemDetailsSuggestionsPopoverRef.current &&
        !problemDetailsSuggestionsPopoverRef.current.contains(event.target as Node) &&
        problemDetailsTextareaRef.current &&
        !problemDetailsTextareaRef.current.contains(event.target as Node)
      ) {
        if (showProblemDetailsSuggestions) setShowProblemDetailsSuggestions(false);
      }
    };
    if (showProblemDetailsSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProblemDetailsSuggestions]);

  const filteredDescriptionSuggestions = useMemo(() => {
    if (!showProblemDetailsSuggestions) return [];
    if (isLoadingSuggestibleUsers) return [{ userId: 'loading-desc', displayName: 'Loading users...', mentionName: 'loading-desc' } as UserProfileBasic];

    let source = suggestibleUsers.filter(p => p.userId !== currentUserId && !!p.mentionName);

    if (debouncedProblemDetailsQuery.trim() === '') {
      source = source.slice(0, 25);
    } else {
      const queryLower = debouncedProblemDetailsQuery.toLowerCase();
      source = source.filter(p =>
        p.mentionName.toLowerCase().includes(queryLower) ||
        (p.displayName && p.displayName.toLowerCase().includes(queryLower)) ||
        (p.companyName && p.companyName.toLowerCase().includes(queryLower))
      ).slice(0, 10);
    }

    if (source.length === 0 && debouncedProblemDetailsQuery.trim() !== '') {
      return [{ userId: 'no-match-desc', displayName: `No users matching "@${debouncedProblemDetailsQuery}"`, mentionName: 'no-match-desc' } as UserProfileBasic];
    }
    if (source.length === 0) {
      return [{ userId: 'no-users-desc', displayName: 'No users to suggest.', mentionName: 'no-users-desc' } as UserProfileBasic];
    }
    return source;
  }, [suggestibleUsers, isLoadingSuggestibleUsers, showProblemDetailsSuggestions, debouncedProblemDetailsQuery, currentUserId]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const currentSelectedFiles = form.getValues("imageFiles") || [];
    const newlyProcessedFiles: File[] = [];
    const newFilesToProcess = Array.from(files);

    setIsCompressing(true);
    toast({ title: "Processing images...", description: "Please wait.", duration: newFilesToProcess.length * 1500 });

    try { // Wrap main processing in try
        for (const file of newFilesToProcess) {
            if (currentSelectedFiles.length + newlyProcessedFiles.length >= MAX_IMAGE_FILES) {
                toast({ variant: "destructive", title: "Limit Reached", description: `You can only upload up to ${MAX_IMAGE_FILES} images.` });
                break;
            }
            if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                toast({ variant: "destructive", title: "Invalid File Type", description: `${file.name} is not a supported image type.` });
                continue;
            }

            try {
                const compressionOptions = {
                    maxSizeMB: MAX_OUTPUT_FILE_SIZE_MB,
                    maxWidthOrHeight: MAX_UPLOAD_DIMENSION,
                    useWebWorker: true,
                    mimeType: 'image/webp',
                    quality: 0.75,
                };
                const compressedFile = await imageCompression(file, compressionOptions);
                newlyProcessedFiles.push(compressedFile);
            } catch (error) {
                console.error(`Error compressing ${file.name}:`, error);
                toast({ variant: "destructive", title: `Compression Failed for ${file.name}`, description: "Could not process this image. Please try another." });
            }
        }

        if (newlyProcessedFiles.length > 0) {
            form.setValue("imageFiles", [...currentSelectedFiles, ...newlyProcessedFiles], { shouldValidate: true });
            const updatePreviews = async () => {
                const previews = await Promise.all(newlyProcessedFiles.map(f => {
                    return new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(f);
                    });
                }));
                setImagePreviewUrls(prev => [...prev, ...previews]);
            };
            updatePreviews().catch(error => {
              console.error("Error updating image previews:", error);
              toast({
                variant: "destructive",
                title: "Preview Error",
                description: "Some image previews could not be generated."
              });
            });
        }
    } finally { // Ensure isCompressing is reset
        setIsCompressing(false);
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input in finally as well
    }
  };


  const handleRemoveImage = (indexToRemove: number) => {
    const currentFiles = form.getValues("imageFiles") || [];
    const updatedFiles = currentFiles.filter((_, index) => index !== indexToRemove);
    form.setValue("imageFiles", updatedFiles, { shouldValidate: true });
    setImagePreviewUrls(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmitForm = (values: z.infer<typeof postFormSchema>) => {
    const finalMentionedUserIds = Array.from(selectedMentionedUserIds);

    const submitData: CreatePostFormData = {
      requestType: values.requestType,
      question: values.question,
      descriptionDetails: values.descriptionDetails,
      descriptionTried: values.descriptionTried?.trim() ? values.descriptionTried.trim() : undefined,
      descriptionOutcome: values.descriptionOutcome?.trim() ? values.descriptionOutcome.trim() : undefined,
      tags: values.tags || [],
      sector: values.sector,
      subSector: values.subSector || undefined,
      industry: values.industry || undefined,
      imageFiles: values.imageFiles || [],
      mentionedUserIds: finalMentionedUserIds,
      maxBudget: values.requestType === 'help_request' && values.maxBudget !== undefined ? Number(values.maxBudget) : undefined,
      deadline: values.requestType === 'help_request' && values.deadline ? values.deadline : undefined,
      miroBoardEmbedUrl: values.miroBoardEmbedUrl?.trim() ? values.miroBoardEmbedUrl.trim() : undefined,
    };
    onSubmit(submitData);
  };

  const localGetInitials = (name: string | undefined | null): string => {
      if (!name || typeof name !== 'string' || name.trim() === '') return '?';
      const nameToProcess = name.startsWith('@') ? name.substring(1) : name;
      const pseudonymRegex = /^[A-Z][a-z]+([A-Z][a-zA-Z]*)[0-9]{3,}$/;
      const match = nameToProcess.match(pseudonymRegex);
      if (match) {
          const firstLetter = nameToProcess.charAt(0);
          const animalPart = match[1];
          const secondLetter = animalPart.charAt(0);
          return (firstLetter + secondLetter).toUpperCase();
      }
      const words = nameToProcess.split(/\s+/).filter(Boolean);
      if (words.length === 0) return '?';
      if (words.length === 1) return words[0].substring(0, 1).toUpperCase();
      const firstInitial = words[0].substring(0, 1);
      const lastInitial = words[words.length - 1].substring(0, 1);
      return (firstInitial + lastInitial).toUpperCase();
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 p-1">
          {/* Left Column */}
          <div className="space-y-6 flex flex-col">
            <FormField
              control={form.control}
              name="requestType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-semibold text-foreground">What kind of post is this? <span className="text-destructive">*</span></FormLabel>
                   <div className="flex items-center gap-3">
                     <Button
                        type="button"
                        variant={field.value === 'post' ? 'default' : 'outline'}
                        onClick={() => { field.onChange('post'); setActiveDescriptionTab('details'); }}
                        className={cn("flex-1 py-2.5 text-sm rounded-md shadow-sm transition-all duration-150 ease-in-out group",
                           field.value === 'post' ? "ring-2 ring-primary ring-offset-2" : "hover:bg-muted/70"
                        )}
                        disabled={isSubmitting}
                     >
                        <FileText className={cn("mr-2 h-4 w-4", field.value === 'post' ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")}/> General Post
                     </Button>
                     <Button
                        type="button"
                        variant={field.value === 'help_request' ? 'default' : 'outline'}
                        onClick={() => { field.onChange('help_request'); setActiveDescriptionTab('details'); }}
                        className={cn("flex-1 py-2.5 text-sm rounded-md shadow-sm transition-all duration-150 ease-in-out group",
                           field.value === 'help_request' ? "bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700 ring-2 ring-amber-500 ring-offset-2" : "hover:bg-muted/70"
                        )}
                        disabled={isSubmitting}
                     >
                        <HandHelping className={cn("mr-2 h-4 w-4", field.value === 'help_request' ? "text-white" : "text-muted-foreground group-hover:text-foreground")}/> Request Help
                     </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question / Need <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder={requestType === 'help_request' ? "e.g., Need help designing a new logo" : "e.g., Seeking expertise in B2B marketing automation"} {...field} disabled={isSubmitting} /></FormControl>
                  <FormDescription>Keep it concise and clear (max 200 characters).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex-grow flex flex-col space-y-0">
              <Label className="text-base font-semibold text-foreground mb-2">
                Details <span className="text-destructive">*</span>
              </Label>
              <Tabs value={activeDescriptionTab} onValueChange={setActiveDescriptionTab} className="w-full flex-grow flex flex-col">
                <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
                  <TabsTrigger value="details" className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1", isMobile && "flex-col h-auto p-1.5 text-xs")}>
                      <FileQuestion className={cn("h-4 w-4", isMobile ? "mb-0.5" : "mr-1.5")} />
                      <span className={cn(isMobile && "hidden")}>Problem Details</span> <span className="text-destructive ml-0.5">*</span>
                  </TabsTrigger>
                  <TabsTrigger value="tried" className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1", isMobile && "flex-col h-auto p-1.5 text-xs")}>
                      <Brain className={cn("h-4 w-4", isMobile ? "mb-0.5" : "mr-1.5")} />
                      <span className={cn(isMobile && "hidden")}>What I&apos;ve Tried</span>
                  </TabsTrigger>
                  <TabsTrigger value="outcome" className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1", isMobile && "flex-col h-auto p-1.5 text-xs")}>
                      <Target className={cn("h-4 w-4", isMobile ? "mb-0.5" : "mr-1.5")} />
                      <span className={cn(isMobile && "hidden")}>Expected Outcome</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-2 rounded-md border p-4 bg-background flex-grow">
                  <FormField control={form.control} name="descriptionDetails" render={({ field }) => (
                    <FormItem className="h-full flex flex-col">
                      <FormLabel className="sr-only">Problem Details</FormLabel>
                      <Popover
                        open={showProblemDetailsSuggestions && filteredDescriptionSuggestions.length > 0 && !['loading-desc', 'no-users-desc', 'no-match-desc'].includes(filteredDescriptionSuggestions[0]?.userId)}
                        onOpenChange={(open) => { setShowProblemDetailsSuggestions(open); if (!open) setProblemDetailsMentionQuery('');}}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the specific problem, idea, or need... (@mention users)"
                              className="flex-grow resize-y min-h-[120px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                              ref={problemDetailsTextareaRef}
                              value={problemDetailsValue}
                              onChange={handleProblemDetailsChange}
                              onFocus={handleProblemDetailsFocus}
                              onKeyDownCapture={(e) => { if (showProblemDetailsSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) { if (e.key !== 'Escape') e.preventDefault(); } }}
                              onBlurCapture={() => setTimeout(() => { if (problemDetailsSuggestionsPopoverRef.current && !problemDetailsSuggestionsPopoverRef.current.contains(document.activeElement as Node) && problemDetailsTextareaRef.current !== document.activeElement) { if(showProblemDetailsSuggestions) setShowProblemDetailsSuggestions(false); } }, 150)}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent ref={problemDetailsSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="bottom" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                          {filteredDescriptionSuggestions.map(profile => {
                            const displayableName = profile.companyName || profile.displayName;
                            const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();
                            return (
                              ['loading-desc', 'no-users-desc', 'no-match-desc'].includes(profile.userId) ? (
                                <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                              ) : (
                                <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectSuggestion(profile, problemDetailsValue, setProblemDetailsValue, problemDetailsTextareaRef, setProblemDetailsMentionQuery, setShowProblemDetailsSuggestions )}>
                                  <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{localGetInitials(profile.mentionName)}</AvatarFallback></Avatar>
                                  <div className="flex flex-col items-start">
                                      {showSecondaryNameLine && (<span className="font-medium text-foreground">{displayableName}</span>)}
                                      <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>@{profile.mentionName}</span>
                                  </div>
                                </Button>
                              )
                            );
                          })}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />
                </TabsContent>
                <TabsContent value="tried" className="mt-2 rounded-md border p-4 bg-background flex-grow">
                  <FormField control={form.control} name="descriptionTried" render={({ field }) => (
                    <FormItem className="h-full flex flex-col">
                      <FormLabel className="sr-only">What I&apos;ve Tried</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Solutions or approaches you&apos;ve already attempted (optional)..."
                          className="flex-grow resize-y min-h-[120px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                          {...field}
                          value={field.value || ''}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </TabsContent>
                <TabsContent value="outcome" className="mt-2 rounded-md border p-4 bg-background flex-grow">
                  <FormField control={form.control} name="descriptionOutcome" render={({ field }) => (
                    <FormItem className="h-full flex flex-col">
                      <FormLabel className="sr-only">Expected Outcome</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ideal result or solution you&apos;re looking for (optional)?"
                          className="flex-grow resize-y min-h-[120px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                          {...field}
                           value={field.value || ''}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </TabsContent>
              </Tabs>
            </div>

            {requestType === 'help_request' && (
              <>
                <FormField control={form.control} name="maxBudget" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><DollarSign className="h-4 w-4 text-green-600" />Maximum Budget (Optional)</FormLabel>
                    <FormControl><Input type="text" placeholder="e.g., 500 (USD)" {...field} value={field.value === undefined ? '' : String(field.value)} onChange={e => { const val = e.target.value; if (/^\d*\.?\d*$/.test(val) || val === "") field.onChange(val === '' ? undefined : val);}} disabled={isSubmitting} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="deadline" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-1"><CalendarIcon className="h-4 w-4 text-muted-foreground" />Deadline (Optional)</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                           <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                            type="button"
                          >
                            <span className="flex items-center justify-between w-full">
                                <span>
                                    {field.value && field.value instanceof Date ? format(field.value, "PPP") : "Pick a date"}
                                </span>
                                <CalendarDays className="h-4 w-4 opacity-50" />
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                           <Calendar
                             mode="single"
                             selected={field.value instanceof Date ? field.value : undefined}
                             onSelect={(date) => field.onChange(date instanceof Date ? date : undefined)}
                             disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1)) || isSubmitting}
                             initialFocus
                           />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}

            <FormField control={form.control} name="imageFiles" render={({ field }) => (
              <FormItem>
                <FormLabel>Images (Optional, up to {MAX_IMAGE_FILES})</FormLabel>
                <FormControl>
                    <Input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(",")}
                        multiple // Allow multiple file selection
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="hidden"
                        disabled={isSubmitting || isCompressing || (form.getValues("imageFiles")?.length || 0) >= MAX_IMAGE_FILES}
                    />
                </FormControl>
                <div className="mt-2 flex items-center gap-4">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting || isCompressing || (form.getValues("imageFiles")?.length || 0) >= MAX_IMAGE_FILES}>
                    {isCompressing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                    Add Image(s)
                  </Button>
                </div>
                {imagePreviewUrls.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {imagePreviewUrls.map((url, index) => (
                            <div key={url} className="relative group aspect-square border rounded-md overflow-hidden">
                                <Image src={url} alt={`Preview ${index + 1}`} fill style={{objectFit:"cover"}} className="rounded-md" data-ai-hint="user upload preview"/>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    onClick={() => handleRemoveImage(index)}
                                    disabled={isSubmitting || isCompressing}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only">Remove image {index + 1}</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
                <FormDescription>Max {MAX_IMAGE_FILES} images. Output will be optimized to WebP, ~{MAX_OUTPUT_FILE_SIZE_MB}MB, max {MAX_UPLOAD_DIMENSION}px.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
             <FormField
                control={form.control}
                name="miroBoardEmbedUrl"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Miro Board Embed URL (Optional)</FormLabel>
                    <FormControl>
                        <Input
                        type="url"
                        placeholder="Paste Miro board embed 'src' URL here"
                        {...field}
                        disabled={isSubmitting}
                        />
                    </FormControl>
                    <FormDescription>
                        Get this from Miro: Share &gt; Embed &gt; Copy iframe code &gt; extract the <strong>src</strong> URL.
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <FormField control={form.control} name="sector" render={({ field }) => (
              <FormItem>
                <FormLabel>Sector <span className="text-destructive">*</span></FormLabel>
                 <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select a main sector" /></SelectTrigger>
                    <SelectContent>{detailedSectorsData.map(sector => (<SelectItem key={sector.code} value={sector.code}>{sector.name} ({sector.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Choose the primary sector for your post.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="subSector" render={({ field }) => (
              <FormItem>
                <FormLabel>Sub-sector (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentSubSectors.length === 0}>
                    <SelectTrigger><SelectValue placeholder={currentSubSectors.length > 0 ? "Select a sub-sector" : "Select sector first"} /></SelectTrigger>
                    <SelectContent>{currentSubSectors.map(sub => (<SelectItem key={sub.code} value={sub.code}>{sub.name} ({sub.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Choose a specific sub-sector if applicable.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="industry" render={({ field }) => (
              <FormItem>
                <FormLabel>Industry (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentIndustries.length === 0}>
                    <SelectTrigger><SelectValue placeholder={currentIndustries.length > 0 ? "Select an industry" : "Select sub-sector first"} /></SelectTrigger>
                    <SelectContent>{currentIndustries.map(ind => (<SelectItem key={ind.code} value={ind.code}>{ind.name} ({ind.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Choose a specific industry if applicable.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tags" render={() => (
              <FormItem>
                <div className="mb-2">
                    <FormLabel className="text-base font-semibold text-foreground">Tags <span className="text-destructive">*</span></FormLabel>
                    <FormDescription>Select relevant tags (select at least one).</FormDescription>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {availableTags.map(tag => (
                    <FormField key={tag} control={form.control} name="tags" render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(tag)}
                              onCheckedChange={(checked: boolean | "indeterminate") => {
                                  return checked === true
                                      ? field.onChange([...(field.value || []), tag])
                                      : field.onChange((field.value || []).filter(v => v !== tag));
                              }}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                        <FormLabel className="font-normal text-sm">{tag}</FormLabel>
                      </FormItem>
                    )} />
                  ))}
                </div>
                <FormMessage className="pt-2" />
              </FormItem>
            )} />
          </div>
        </div>

        <DialogFooter className="pt-8 md:col-span-2">
            {onDialogClose && (<DialogClose asChild><Button type="button" variant="outline" onClick={resetFormValues} disabled={isSubmitting || isCompressing || (showProblemDetailsSuggestions && isLoadingSuggestibleUsers)}>Cancel</Button></DialogClose>)}
            <Button type="submit" disabled={isSubmitting || isCompressing || (showProblemDetailsSuggestions && isLoadingSuggestibleUsers)}>
                {(isSubmitting || isCompressing || (showProblemDetailsSuggestions && isLoadingSuggestibleUsers) ) ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isCompressing ? "Processing..." : "Submitting..."}</>) : ('Submit Post')}
            </Button>
        </DialogFooter>
      </form>
       <AlertDialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Image Too Large</AlertDialogTitle>
              <AlertDialogDescription>
                The selected image ({fileForCompression?.name}) exceeds the initial size limit.
                It will be compressed to fit within {MAX_OUTPUT_FILE_SIZE_MB}MB and {MAX_UPLOAD_DIMENSION}px. This may slightly reduce quality.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setFileForCompression(null); setShowCompressionDialog(false); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                  if (!fileForCompression) return;
                  setIsCompressing(true);
                  setShowCompressionDialog(false);
                  toast({ title: "Compressing image...", description: "Please wait." });
                  try {
                      const compressionOptions = {
                          maxSizeMB: MAX_OUTPUT_FILE_SIZE_MB,
                          maxWidthOrHeight: MAX_UPLOAD_DIMENSION,
                          useWebWorker: true,
                          mimeType: 'image/webp',
                          quality: 0.75,
                      };
                      const compressedFile = await imageCompression(fileForCompression, compressionOptions);
                      const currentFiles = form.getValues("imageFiles") || [];
                      form.setValue("imageFiles", [...currentFiles, compressedFile], { shouldValidate: true });
                      const reader = new FileReader();
                      reader.onloadend = () => setImagePreviewUrls(prev => [...prev, reader.result as string]);
                      reader.readAsDataURL(compressedFile);
                      toast({ title: "Image Compressed & Added" });
                  } catch (error) {
                      console.error("Error compressing image:", error);
                      toast({ variant: "destructive", title: "Compression Failed", description: "Could not compress the image." });
                  } finally {
                      setIsCompressing(false);
                      setFileForCompression(null);
                  }
              }} className="bg-primary hover:bg-primary/90"><ImageDown className="mr-2 h-4 w-4" /> Compress and Add</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </Form>
  );
};

    