// src/types/news.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export type NewsArticleStatus = 'draft' | 'published';

export interface NewsArticle {
  id: string;
  userId: string; // UID of the author
  title: string;
  category: string;
  content: string; // HTML content from the rich text editor
  coverImageUrl?: string | null;
  status: NewsArticleStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp | null; // Timestamp for when it was actually published
}

export type NewNewsArticleData = Omit<NewsArticle, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'> & {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  publishedAt?: FieldValue | null;
};

export type UpdateNewsArticleData = Partial<Omit<NewsArticle, 'id' | 'userId' | 'createdAt'>> & {
  updatedAt: FieldValue;
  publishedAt?: FieldValue | null; // Allow updating publishedAt if status changes to published
};

export interface ClientNewsArticle extends Omit<NewsArticle, 'createdAt' | 'updatedAt' | 'publishedAt'> {
  createdAt: number; // Milliseconds
  updatedAt: number; // Milliseconds
  publishedAt?: number | null; // Milliseconds
}
