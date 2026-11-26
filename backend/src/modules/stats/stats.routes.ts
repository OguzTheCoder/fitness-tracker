import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { statsSummaryQuerySchema } from './stats.schema.js';
import { getStatsSummary } from './stats.service.js';

export const statsRouter = Router();

statsRouter.use(authenticate);

statsRouter.get('/summary', async (req, res) => {
  const { days } = statsSummaryQuerySchema.parse(req.query);
  const result = await getStatsSummary(req.authUser!.id, days);
  res.status(200).json(result);
});
