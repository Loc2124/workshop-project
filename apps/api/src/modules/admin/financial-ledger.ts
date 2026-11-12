import { Router } from 'express';
import { calendarRouter } from './ledger/calendar.routes.js';
import { obligationsRouter } from './ledger/obligations.routes.js';
import { transfersRouter } from './ledger/transfers.routes.js';
import { accountsRouter } from './ledger/accounts.routes.js';
import { feesRouter } from './ledger/fees.routes.js';

export const financialLedgerRouter = Router();

financialLedgerRouter.use(calendarRouter);
financialLedgerRouter.use(obligationsRouter);
financialLedgerRouter.use(transfersRouter);
financialLedgerRouter.use(accountsRouter);
financialLedgerRouter.use(feesRouter);
