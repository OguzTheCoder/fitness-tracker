import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { exportBackupHandler, importBackupHandler } from './backup.controller.js';

export const backupRouter = Router();

backupRouter.use(authenticate);
backupRouter.get('/export', exportBackupHandler);
backupRouter.post('/import', importBackupHandler);
