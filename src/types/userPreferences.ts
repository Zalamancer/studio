
// src/types/userPreferences.ts
import type { Timestamp } from 'firebase/firestore';

export interface SavedPaymentMethod {
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

export interface UserPreference {
  userId: string;
  favoriteSectorCodes?: string[];
  notifyOnReply?: boolean;
  notifyOnMention?: boolean;
  notifyOnNewConnectionRequest?: boolean;
  notifyOnConnectionAccepted?: boolean;
  notifyOnNewMessage?: boolean;
  notifyOnPlatformUpdates?: boolean;
  stripeCustomerId?: string; // To store Stripe Customer ID
  paymentMethods?: SavedPaymentMethod[]; // Array to store multiple saved payment methods
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type UpdateUserPreferencesData = Omit<Partial<UserPreference>, 'userId' | 'createdAt'> & {
  updatedAt?: Timestamp;
};
