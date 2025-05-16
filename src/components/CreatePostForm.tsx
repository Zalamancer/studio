
// src/components/CreatePostForm.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label"; // Ensure Label is imported
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, Upload, XCircle, ImageDown } from 'lucide-react';
import Image from 'next/image'; // Import Next.js Image component
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

// Define the shape of a single industry
export interface Industry { // Exported for MainLayout.tsx
  name: string;
  code: string;
}

// Define the shape of a single sub-sector with industries
export interface SubSector { // Exported for MainLayout.tsx
  name: string;
  code: string;
  industries: Industry[];
}

// Define the shape of a single sector with sub-sectors
export interface SectorWithSubSectors { // Exported for MainLayout.tsx
  name: string;
  code: string;
  description?: string; // Optional description for the sector
  subSectors: SubSector[];
}


// Zod schema update
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

const postFormSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
  description: z.string().optional(),
  tags: z.array(z.string()).min(1, "Please select at least one tag."),
  sector: z.string().min(1, "Please select a sector."),
  subSector: z.string().optional(),
  industry: z.string().optional(),
  image: z.instanceof(File).optional().nullable()
    .refine(file => !file || file.size <= MAX_FILE_SIZE_BYTES, `Max image size is 2MB.`)
    .refine(
      file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .jpeg, .png and .gif formats are supported."
    ),
});

type PostFormValues = z.infer<typeof postFormSchema>;

export interface CreatePostFormData {
  question: string;
  description?: string;
  tags: string[];
  sector: string; // Main sector code
  subSector?: string; // Sub-sector code
  industry?: string; // Industry code
  imageFile?: File | null; // For the uploaded image file
}

interface CreatePostFormProps {
  onSubmit: (data: CreatePostFormData) => void;
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({ onSubmit, availableTags, detailedSectorsData, isSubmitting }) => {
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      question: "",
      description: "",
      tags: [],
      sector: "",
      subSector: "",
      industry: "",
      image: null,
    },
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentSubSectors, setCurrentSubSectors] = useState<SubSector[]>([]);
  const [currentIndustries, setCurrentIndustries] = useState<Industry[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  const [isCompressing, setIsCompressing] = useState(false);
  const [originalTooLargeFile, setOriginalTooLargeFile] = useState<File | null>(null);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);


  const selectedSectorCode = form.watch("sector");
  const selectedSubSectorCode = form.watch("subSector");

  useEffect(() => {
    if (selectedSectorCode) {
      const selectedMainSector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setCurrentSubSectors(selectedMainSector?.subSectors || []);
      form.resetField("subSector");
      form.resetField("industry");
      setCurrentIndustries([]);
    } else {
      setCurrentSubSectors([]);
      setCurrentIndustries([]);
      form.resetField("subSector");
      form.resetField("industry");
    }
  }, [selectedSectorCode, detailedSectorsData, form]);

  useEffect(() => {
    if (selectedSubSectorCode) {
      const selectedSub = currentSubSectors.find(ss => ss.code === selectedSubSectorCode);
      setCurrentIndustries(selectedSub?.industries || []);
      form.resetField("industry");
    } else {
      setCurrentIndustries([]);
      form.resetField("industry");
    }
  }, [selectedSubSectorCode, currentSubSectors, form]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please select a JPG, PNG, or GIF image." });
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setOriginalTooLargeFile(file);
        setShowCompressionDialog(true);
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset, user will confirm compression
        return;
      }

      // File is acceptable, set for preview and form
      setSelectedImageFile(file);
      form.setValue("image", file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);

    }
  };

  const handleCompressAndSetImage = async () => {
    if (!originalTooLargeFile) return;
    setIsCompressing(true);
    setShowCompressionDialog(false);
    toast({ title: "Compressing image...", description: "Please wait." });
    try {
      const compressedFile = await imageCompression(originalTooLargeFile, {
        maxSizeMB: 1, // Target 1MB
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      setSelectedImageFile(compressedFile);
      form.setValue("image", compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(compressedFile);
      toast({ title: "Image Compressed", description: "Proceed with upload." });
    } catch (error) {
      console.error("Image compression error:", error);
      toast({ variant: "destructive", title: "Compression Failed", description: "Could not compress image. Try a smaller file." });
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset
    } finally {
      setIsCompressing(false);
      setOriginalTooLargeFile(null);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    form.setValue("image", null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset the file input
    }
  };

  const handleSubmit = (values: PostFormValues) => {
    const submitData: CreatePostFormData = {
        question: values.question,
        description: values.description,
        tags: values.tags,
        sector: values.sector,
        subSector: values.subSector,
        industry: values.industry,
        imageFile: selectedImageFile, // Use the state variable which might hold the compressed file
    };
    onSubmit(submitData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-0"> {/* Remove space-y-6 from form if grid handles spacing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 p-1"> {/* Increased gap-x */}
          {/* Left Column */}
          <div className="space-y-6 flex flex-col">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question / Need</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., How to improve B2B lead generation?" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>Keep it concise and clear.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="flex-grow flex flex-col">
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl className="flex-grow">
                    <Textarea
                      placeholder="Provide more context or details..."
                      className="resize-y min-h-[120px] flex-1" // Ensure textarea can grow
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image Upload Section */}
             <FormField
                control={form.control}
                name="image"
                render={() => ( // field prop not directly used for file input like this
                    <FormItem>
                        <FormLabel>Image (Optional)</FormLabel>
                        <FormControl>
                            <Input
                                type="file"
                                accept="image/png, image/jpeg, image/gif"
                                ref={fileInputRef}
                                onChange={handleImageChange}
                                className="hidden" // Hide the default input
                                disabled={isSubmitting || isCompressing}
                            />
                        </FormControl>
                        <div className="mt-2 flex items-center gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSubmitting || isCompressing}
                            >
                                {isCompressing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                                {imagePreviewUrl ? "Change Image" : "Upload Image"}
                            </Button>
                            {imagePreviewUrl && (
                                <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage} disabled={isSubmitting || isCompressing}>
                                    <XCircle className="mr-2 h-4 w-4 text-destructive" /> Remove
                                </Button>
                            )}
                        </div>
                        {imagePreviewUrl && (
                            <div className="mt-4 border rounded-md p-2 relative aspect-video max-w-sm mx-auto">
                                <Image src={imagePreviewUrl} alt="Preview" layout="fill" objectFit="contain" className="rounded-md" />
                            </div>
                        )}
                        <FormDescription>Max 2MB. JPG, PNG, GIF accepted.</FormDescription>
                        <FormMessage /> {/* For Zod validation errors */}
                    </FormItem>
                )}
             />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sector</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a main sector" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {detailedSectorsData.map((sector) => (
                        <SelectItem key={sector.code} value={sector.code}>{sector.name} ({sector.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose the primary sector for your post.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subSector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-sector (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentSubSectors.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={currentSubSectors.length > 0 ? "Select a sub-sector" : "No sub-sectors available"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentSubSectors.map((sub) => (
                        <SelectItem key={sub.code} value={sub.code}>{sub.name} ({sub.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose a specific sub-sector if applicable.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentIndustries.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={currentIndustries.length > 0 ? "Select an industry" : "No industries available"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentIndustries.map((industry) => (
                        <SelectItem key={industry.code} value={industry.code}>{industry.name} ({industry.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose a specific industry if applicable.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={() => (
                <FormItem>
                  <FormLabel className="text-base">Tags</FormLabel>
                  <FormDescription>Select relevant tags (select at least one).</FormDescription>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {availableTags.map((tag) => (
                      <FormField
                        key={tag}
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem key={tag} className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(tag)}
                                onCheckedChange={(checked) =>
                                  checked
                                    ? field.onChange([...(field.value || []), tag])
                                    : field.onChange((field.value || []).filter(value => value !== tag))
                                }
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{tag}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <DialogFooter className="pt-8 md:col-span-2"> {/* Ensure footer spans both columns and has padding */}
            <DialogClose asChild>
                 <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || isCompressing}>
                {isSubmitting || isCompressing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isCompressing ? "Compressing..." : "Posting..."}
                    </>
                 ) : (
                    'Submit Post'
                 )}
            </Button>
        </DialogFooter>
      </form>

       {/* Compression Dialog */}
      <AlertDialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Image Too Large</AlertDialogTitle>
            <AlertDialogDescription>
              The selected image exceeds {MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.
              Would you like to compress it? This may slightly reduce quality.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setOriginalTooLargeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompressAndSetImage} className="bg-primary hover:bg-primary/90">
              <ImageDown className="mr-2 h-4 w-4" /> Compress Image
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
};
