import { Router } from 'express';
import { tryAuthenticateRequest } from '../../middlewares/authenticate.js';
import { getPersistentSessionTtlMs, setSessionCookie } from '../auth/session.utils.js';
import { setupAccessSchema, unlockAccessSchema } from './access.schema.js';
import {
  getAccessStatus,
  getActiveAppPin,
  getRuntimeNodeEnv,
  resumeLocalPersonalSession,
  setupPersonalAccess,
  unlockPersonalAccess,
} from './access.service.js';

export const accessRouter = Router();

accessRouter.get('/status', async (req, res) => {
  const activePin = getActiveAppPin(req);
  const authUser = await tryAuthenticateRequest(req);
  const status = await getAccessStatus(activePin, authUser?.id ?? null);
  res.status(200).json(status);
});

accessRouter.post('/setup', async (req, res) => {
  const input = setupAccessSchema.parse(req.body);
  const activePin = getActiveAppPin(req);
  const result = await setupPersonalAccess(input, activePin);
  setSessionCookie(req, res, result.token, getPersistentSessionTtlMs());
  res.status(201).json({
    mode: result.mode,
    user: result.user,
  });
});

accessRouter.post('/unlock', async (req, res) => {
  const input = unlockAccessSchema.parse(req.body);
  const activePin = getActiveAppPin(req);
  const result = await unlockPersonalAccess(input, activePin);
  setSessionCookie(req, res, result.token, getPersistentSessionTtlMs());
  res.status(200).json({
    mode: result.mode,
    user: result.user,
  });
});

accessRouter.post('/local-session', async (req, res) => {
  const activePin = getActiveAppPin(req);
  const nodeEnv = getRuntimeNodeEnv(req);
  const result = await resumeLocalPersonalSession(activePin, nodeEnv);
  setSessionCookie(req, res, result.token, getPersistentSessionTtlMs());
  res.status(200).json({
    mode: result.mode,
    user: result.user,
  });
});
