
'use server';
/**
 * @fileOverview An AI-powered connection matcher for suggesting relevant collaborators.
 *
 * - aiConnectionMatcher - A function that suggests relevant connections based on post content and user profiles.
 * - AIConnectionMatcherInput - The input type for the aiConnectionMatcher function.
 * - AIConnectionMatcherOutput - The return type for the aiConnectionMatcher function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AIConnectionMatcherInputSchema = z.object({
  postContent: z.string().describe('The content of the post.'),
  userProfile: z.string().describe('The viewing user profile information (e.g., their industry, expertise summary).'), // Clarified this is the VIEWING user
  industry: z.string().describe('The industry of the viewing user.'), // Clarified this is the VIEWING user
  tags: z.array(z.string()).describe('The tags associated with the post.'),
});
export type AIConnectionMatcherInput = z.infer<typeof AIConnectionMatcherInputSchema>;

const AIConnectionMatcherOutputSchema = z.object({
  suggestedConnections: z.array(z.string()).describe('A list of suggested types of collaborators or expertise areas for potential collaboration (e.g., "A marketing specialist", "Someone with experience in logistics"). Max 3-4 suggestions.'),
  reasoning: z.string().describe('The AI reasoning behind the suggested types of connections or expertise areas.'),
});
export type AIConnectionMatcherOutput = z.infer<typeof AIConnectionMatcherOutputSchema>;

export async function aiConnectionMatcher(input: AIConnectionMatcherInput): Promise<AIConnectionMatcherOutput> {
  return aiConnectionMatcherFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiConnectionMatcherPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {
    schema: z.object({ // Input schema for the prompt itself
      postContent: z.string().describe('The content of the post.'),
      userProfile: z.string().describe('The viewing user profile information (e.g., their industry, expertise summary).'),
      industry: z.string().describe('The industry of the viewing user.'),
      tags: z.array(z.string()).describe('The tags associated with the post.'),
    }),
  },
  output: { // Output schema defined here
    schema: AIConnectionMatcherOutputSchema, // Reference the one defined above for consistency
  },
  prompt: `You are an AI assistant designed to suggest relevant types of collaborators or areas of expertise for a B2B collaboration platform.

  Based on the following post content, the viewing user's profile, their industry, and the post's tags, identify up to 3-4 types of collaborators or specific expertise areas that would be beneficial for the viewing user to connect with regarding this post.

  Post Content: {{{postContent}}}
  Viewing User Profile: {{{userProfile}}}
  Viewing User Industry: {{{industry}}}
  Post Tags: {{#each tags}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

  For each suggestion, provide a brief explanation of why this type of collaborator or expertise would be valuable in the context of the post.
  If specific user profiles are not immediately obvious from the provided information, focus on suggesting general roles, skills, or business types. The goal is to provide actionable advice.
  Ensure your output adheres to the schema. The 'suggestedConnections' should be descriptions of these types or expertise areas (e.g., "A marketing specialist", "Someone with experience in logistics"). Return the reasoning as a well-structured explanation for the suggestions.
  If you truly cannot find any relevant suggestions, you may indicate that, but strive to offer some general guidance if possible.`,
});


const aiConnectionMatcherFlow = ai.defineFlow(
  {
    name: 'aiConnectionMatcherFlow',
    inputSchema: AIConnectionMatcherInputSchema,
    outputSchema: AIConnectionMatcherOutputSchema,
  },
  async input => {
    const {output} = await prompt(input); // model is defined in the prompt object
    if (!output) {
      console.warn("[ai-connection-matcher.ts] AI prompt did not return an output for input:", input);
      // Return a default "no suggestions" output that matches the schema
      return {
        suggestedConnections: ["No specific types of collaborators suggested by AI at this time."],
        reasoning: "The AI could not identify specific types of collaborators based on the provided information. Consider broadening your search or looking for general expertise in the post's domain."
      };
    }
    // Ensure output.suggestedConnections is an array, even if empty
    if (!output.suggestedConnections || output.suggestedConnections.length === 0) {
      return {
        suggestedConnections: ["No specific types of collaborators suggested by AI at this time."],
        reasoning: output.reasoning || "The AI could not identify specific types of collaborators or provide detailed reasoning based on the provided information."
      };
    }
    return output;
  }
);
