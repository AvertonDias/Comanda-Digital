'use server';

import { generateDishDescription } from '@/ai/flows/generate-dish-description';
import { z } from 'zod';

const inputSchema = z.object({
  dishName: z.string().min(1, 'Dish name is required.'),
  ingredients: z.string().min(1, 'Ingredients are required.'),
});

export async function generateDescriptionAction(
  prevState: any,
  formData: FormData,
) {
  const validatedFields = inputSchema.safeParse({
    dishName: formData.get('dishName'),
    ingredients: formData.get('ingredients'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Validation failed.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  const { dishName, ingredients } = validatedFields.data;

  try {
    const result = await generateDishDescription({
      dishName,
      ingredients: ingredients.split(',').map((i) => i.trim()),
      cuisineType: 'Variado',
      descriptionTone: 'Atraente e moderno',
    });
    return { message: 'success', description: result.description, errors: {} };
  } catch (error) {
    console.error(error);
    return { message: 'Failed to generate description.', description: '', errors: {} };
  }
}
