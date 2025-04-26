
// src/types/post.ts

export interface Post {
  id: number | string; // Use string if using UUIDs later
  tags: string[];
  question: string;
  description?: string; // Make description optional or required as needed
  sector: string;
  businessType: string; // e.g., Startup, Growing, Established
  safetyIndicator: 'High' | 'Medium' | 'Low'; // Or use a numerical score
  ratingScore: number; // e.g., 0-5
  stockGraphData: { name: string; uv: number }[]; // Example structure
  createdAt: Date; // Timestamp for sorting
  // Add other fields like userId (anonymous identifier), replies, etc. later
}
