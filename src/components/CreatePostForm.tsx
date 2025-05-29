// src/components/CreatePostForm.tsx
"use client";

import React from 'react';
import type { SectorWithSubSectors } from '@/components/layout/MainLayout'; // Keep this for props type

// Keep the props interface for compatibility with MainLayout's dynamic import
export interface CreatePostFormProps {
  onSubmit: (data: any) => void; // Use 'any' for temporary simplicity
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
  currentUserId: string | null;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({ isSubmitting, onSubmit }) => {
  console.log("[CreatePostForm] Minimal version rendered. isSubmitting:", isSubmitting);

  const handleMockSubmit = () => {
    console.log("[CreatePostForm] Mock submit clicked.");
    onSubmit({ question: "Mock Question", descriptionDetails: "Mock Details", tags: ["Tech"], sector: "51" });
  };

  return (
    <div className="p-4 border border-dashed border-blue-500 bg-blue-50">
      <h3 className="text-lg font-semibold text-blue-700">Minimal CreatePostForm (Debug Version)</h3>
      <p className="text-sm text-blue-600">
        This is a simplified version of the form to test dynamic loading.
        If you see this, the dynamic import itself is working, but the original form component has an issue.
      </p>
      <button
        onClick={handleMockSubmit}
        disabled={isSubmitting}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {isSubmitting ? "Submitting..." : "Mock Submit"}
      </button>
    </div>
  );
};

// Ensure CreatePostFormData is also exported if MainLayout tries to import it directly,
// though it's not used by this minimal version. For safety:
export interface CreatePostFormData {
  question: string;
  descriptionDetails?: string; // Made optional for this minimal version
  tags: string[];
  sector: string;
  subSector?: string;
  industry?: string;
  imageFile?: File | null;
  mentionedUserIds?: string[];
}

export default CreatePostForm; // Also adding a default export for robustness if dynamic import tries that.
