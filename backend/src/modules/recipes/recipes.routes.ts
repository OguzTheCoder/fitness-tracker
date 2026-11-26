import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { recipeBodySchema, recipeListQuerySchema } from './recipes.schema.js';
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipes,
  updateRecipe,
} from './recipes.service.js';

export const recipesRouter = Router();

recipesRouter.use(authenticate);

recipesRouter.get('/', async (req, res) => {
  const query = recipeListQuerySchema.parse(req.query);
  const result = await listRecipes(req.authUser!.id, query);
  res.status(200).json(result);
});

recipesRouter.get('/:id', async (req, res) => {
  const result = await getRecipeById(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});

recipesRouter.post('/', async (req, res) => {
  const input = recipeBodySchema.parse(req.body);
  const result = await createRecipe(req.authUser!.id, input);
  res.status(201).json(result);
});

recipesRouter.put('/:id', async (req, res) => {
  const input = recipeBodySchema.parse(req.body);
  const result = await updateRecipe(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

recipesRouter.delete('/:id', async (req, res) => {
  const result = await deleteRecipe(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
