import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import instagramAccountsRouter from "./instagram-accounts";
import dailyReportsRouter from "./daily-reports";
import reportItemsRouter from "./report-items";
import walletAddressesRouter from "./wallet-addresses";
import delayFlagsRouter from "./delay-flags";
import auditLogsRouter from "./audit-logs";
import dashboardRouter from "./dashboard";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(instagramAccountsRouter);
router.use(dailyReportsRouter);
router.use(reportItemsRouter);
router.use(walletAddressesRouter);
router.use(delayFlagsRouter);
router.use(auditLogsRouter);
router.use(dashboardRouter);
router.use(exportRouter);

export default router;
