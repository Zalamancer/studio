'use server';
/**
 * @fileOverview An AI-powered connection suggester for user profiles.
 *
 * - suggestProfileConnections - A function that suggests relevant connections for a given user profile.
 * - ProfileConnectionInput - The input type for the suggestProfileConnections function.
 * - ProfileConnectionOutput - The return type for the suggestProfileConnections function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

// Input schema for the profile whose connections are being suggested
const ProfileConnectionInputSchema = z.object({
  targetUserId: z.string().describe("The ID of the user for whom connections are being suggested."),
  targetUserProfileData: z.string().describe("A summary of the target user's profile, including their description, skills, and interests."),
  targetUserIndustry: z.string().describe("The primary industry of the target user."),
  // Optional: consider adding tags or other relevant data if available on the profile
  // targetUserTags: z.array(z.string()).optional().describe("Tags or keywords associated with the target user's profile or expertise."),
});
export type ProfileConnectionInput = z.infer<typeof ProfileConnectionInputSchema>;

// Output schema for suggested connections
const ProfileConnectionOutputSchema = z.object({
  suggestedUserConnections: z.array(
    z.object({
      suggestedProfileSummary: z.string().describe("A brief summary of a suggested user profile (e.g., their expertise or industry). This should NOT be a specific user's name or @mention, but a description of a type of user or business. Max 1-2 sentences."),
      reasonForSuggestion: z.string().describe("Why this type of user/business would be a good connection for the target user. Max 1-2 sentences.")
    })
  ).max(5, "Suggest no more than 5 connection types.")
  .describe("A list of suggested types of user profiles or businesses for potential connection."),
  overallReasoning: z.string().describe("General reasoning for the types of connections suggested, summarizing the approach. Max 2-3 sentences."),
});
export type ProfileConnectionOutput = z.infer<typeof ProfileConnectionOutputSchema>;

// Exported function to be called from the application
export async function suggestProfileConnections(input: ProfileConnectionInput): Promise<ProfileConnectionOutput> {
  return profileConnectionSuggesterFlow(input);
}

// Define the prompt for Genkit
const prompt = ai.definePrompt({
  name: 'profileConnectionSuggesterPrompt',
  model: 'googleai/gemini-1.5-flash-latest', // Added model parameter
  input: { schema: ProfileConnectionInputSchema },
  output: { schema: ProfileConnectionOutputSchema },
  prompt: `You are an AI assistant helping users find valuable B2B connections on a collaboration platform.
  Your goal is to analyze a user's profile and suggest TYPES of other users or businesses that would be beneficial for THEM to connect with. Do NOT suggest specific, named individuals or existing companies.

  Analyze the following profile information for the user (ID: {{{targetUserId}}}):

  Target User Profile Summary (Description, Skills, Interests):
  {{{targetUserProfileData}}}

  Target User Industry:
  {{{targetUserIndustry}}}

  {{#if targetUserTags}}
  Target User Tags/Keywords:
  {{#each targetUserTags}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  {{/if}}

  Based on this, identify up to 5 distinct types of profiles (e.g., "A software development firm specializing in mobile apps", "Venture capitalists focused on green tech", "Marketing consultants with experience in e-commerce") that would be valuable connections for THIS target user.
  For each suggested profile type, provide a concise reason (1-2 sentences) explaining why it's a good match (e.g., complementary services, potential for partnership, investment opportunities, shared market focus).
  Also, provide a brief overall reasoning (2-3 sentences) summarizing your general strategy for these suggestions.

  Ensure your output strictly adheres to the JSON schema provided for 'ProfileConnectionOutputSchema'.
  `,
});

// Define the Genkit flow
const profileConnectionSuggesterFlow = ai.defineFlow(
  {
    name: 'profileConnectionSuggesterFlow',
    inputSchema: ProfileConnectionInputSchema,
    outputSchema: ProfileConnectionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    // Ensure output is not null or undefined; return a default or throw if necessary
    if (!output) {
      console.error("AI prompt 'profileConnectionSuggesterPrompt' did not return an output for input:", input);
      return {
        suggestedUserConnections: [],
        overallReasoning: "Could not generate suggestions at this time."
      };
    }
    return output;
  }
);
