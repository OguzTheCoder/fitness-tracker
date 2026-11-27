import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { syncPullQuerySchema, syncPushBodySchema } from './sync.schema.js';
import { pullSyncChanges, pushSyncMutations } from './sync.service.js';

export const syncRouter = Router();

syncRouter.use(authenticate);

syncRouter.get('/', async (req, res, next) => {
  try {
    const query = syncPullQuerySchema.parse(req.query);
    const result = await pullSyncChanges(req.authUser!.id, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

syncRouter.post('/', async (req, res, next) => {
  try {
    const body = syncPushBodySchema.parse(req.body);
    const result = await pushSyncMutations(req.authUser!.id, body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
