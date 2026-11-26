import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { barcodeCodeSchema, foodBodySchema, foodListQuerySchema } from './foods.schema.js';
import {
  createFood,
  deleteFood,
  getFoodById,
  listFoods,
  lookupFoodByBarcode,
  updateFood,
} from './foods.service.js';

export const foodsRouter = Router();

foodsRouter.use(authenticate);

foodsRouter.get('/', async (req, res) => {
  const query = foodListQuerySchema.parse(req.query);
  const result = await listFoods(req.authUser!.id, query);
  res.status(200).json(result);
});

foodsRouter.get('/barcode/:code', async (req, res) => {
  const code = barcodeCodeSchema.parse(String(req.params.code));
  const result = await lookupFoodByBarcode(req.authUser!.id, code);
  res.status(200).json(result);
});

foodsRouter.get('/:id', async (req, res) => {
  const result = await getFoodById(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});

foodsRouter.post('/', async (req, res) => {
  const input = foodBodySchema.parse(req.body);
  const result = await createFood(req.authUser!.id, input);
  res.status(201).json(result);
});

foodsRouter.put('/:id', async (req, res) => {
  const input = foodBodySchema.parse(req.body);
  const result = await updateFood(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

foodsRouter.delete('/:id', async (req, res) => {
  const result = await deleteFood(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
