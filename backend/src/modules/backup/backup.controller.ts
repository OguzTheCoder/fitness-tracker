import type { RequestHandler } from 'express';
import { exportQuerySchema, importBackupRequestSchema } from './backup.schema.js';
import { exportCsvDataset, exportJsonBackup, importJsonBackup } from './backup.service.js';

export const exportBackupHandler: RequestHandler = async (req, res, next) => {
  try {
    const query = exportQuerySchema.parse(req.query);
    res.setHeader('Cache-Control', 'no-store');

    if (query.format === 'csv') {
      const { filename, csv } = await exportCsvDataset(req.authUser!.id, query.dataset!);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
      return;
    }

    const { filename, payload } = await exportJsonBackup(req.authUser!.id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
};

export const importBackupHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = importBackupRequestSchema.parse(req.body);
    const result = await importJsonBackup(req.authUser!.id, input);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
