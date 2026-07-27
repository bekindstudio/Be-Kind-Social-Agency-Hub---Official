import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicConfigRouter from "./public-config";
import publicPortalRouter from "./public-portal";
import clientsRouter from "./clients";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import teamRouter from "./team";
import messagesRouter from "./messages";
import filesRouter from "./files";
import quotesRouter from "./quotes";
import contractsRouter from "./contracts";
import contractDocumentsRouter from "./contract-documents";
import clientContractsRouter from "./client-contracts";
import dashboardRouter from "./dashboard";
import metaRouter from "./meta";
import reportsRouter from "./reports";
import aiChatRouter from "./ai-chat";
import aiRouter from "./ai";
import storageRouter from "./storage";
import notificationsRouter from "./notifications";
import rolesRouter from "./roles";
import emailNotificationsRouter from "./email-notifications";
import googleAdsRouter from "./google-ads";
import teamClientAccessRouter from "./team-client-access";
import searchRouter from "./search";
import deadlinesRouter from "./deadlines";
import activityLogRouter from "./activity-log";
import clientBriefsRouter from "./client-briefs";
import editorialPlansRouter from "./editorial-plans";
import dailyFocusRouter from "./daily-focus";
import trashRouter from "./trash";
import clientPostsRouter from "./client-posts";
import clientCompetitorsRouter from "./client-competitors";
import clientEventsRouter from "./client-events";
import clientNotesRouter from "./client-notes";
import clientContentIdeasRouter from "./client-content-ideas";
import clientRetainerRouter from "./client-retainer";
import quoteConfiguratorRouter from "./quote-configurator";
import cronRouter from "./cron";
import googleDriveRouter from "./google-drive";
import personalAgendaRouter from "./personal-agenda";
import timeTrackerRouter from "./time-tracker";
import clientCommunicationsRouter from "./client-communications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicConfigRouter);
router.use(publicPortalRouter);
router.use(clientsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(teamRouter);
router.use(messagesRouter);
router.use(filesRouter);
router.use(quotesRouter);
router.use(contractsRouter);
router.use(contractDocumentsRouter);
router.use(clientContractsRouter);
router.use(dashboardRouter);
router.use(metaRouter);
router.use(reportsRouter);
router.use(aiChatRouter);
router.use(aiRouter);
router.use(storageRouter);
router.use(notificationsRouter);
router.use(rolesRouter);
router.use(emailNotificationsRouter);
router.use(googleAdsRouter);
router.use(teamClientAccessRouter);
router.use(searchRouter);
router.use(deadlinesRouter);
router.use(activityLogRouter);
router.use(clientBriefsRouter);
router.use(editorialPlansRouter);
// Questi router definiscono rotte come `/:clientId/...` → vanno montati sotto
// `/clients` per ottenere `/api/clients/:clientId/{posts,competitors,events}`,
// che è ciò che chiama il frontend. (Senza prefisso restavano `/api/:clientId/...`
// → 404 → eventi/competitor/post non si salvavano.)
router.use("/clients", clientPostsRouter);
router.use("/clients", clientCompetitorsRouter);
router.use("/clients", clientEventsRouter);
router.use(clientNotesRouter);
// Path assoluti (`/content-ideas`, `/clients/:clientId/content-ideas`) → montato
// bare come clientNotesRouter, NON sotto "/clients" (darebbe /api/clients/clients/…).
router.use(clientContentIdeasRouter);
// Idem: path assoluti /clients/:clientId/retainer/*, montato bare.
router.use(clientRetainerRouter);
// Path assoluti: /public/preventivo/* (pubbliche) e /quote-* (agenzia).
router.use(quoteConfiguratorRouter);
router.use(dailyFocusRouter);
router.use(trashRouter);
router.use(cronRouter);
router.use(googleDriveRouter);
router.use(personalAgendaRouter);
router.use(timeTrackerRouter);
router.use(clientCommunicationsRouter);

export default router;
