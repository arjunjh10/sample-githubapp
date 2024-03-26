import express, { Express } from "express";
import { smee } from "../smee-client/smee";
import { Server } from "http";
import { EmitterWebhookEvent, Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import { getAppAuth, getAuthorizationToken } from "../auth";
import { AuthInterface } from '@octokit/auth-app/dist-types/types';
import { AppHooks } from "../webhooks/webhook";
import { SourceIncomingEvents } from "../events/sourceEvents";
import { deleteBranchRef } from "../middleware/deleteBranch";
import { addNewLabelToPullRequest } from "../middleware/addLabel";

export class GithubApp {
  private readonly portNumber: number;
  private readonly webhookProxyUrl = process.env.SMEE_LINK!;
  private readonly githubAppId = process.env.GITHUB_APP_IDENTIFIER!;
  private readonly privateKey = process.env.PRIVATE_KEY!;
  private readonly clientId = process.env.CLIENT_ID!;
  private readonly clientSecret = process.env.CLIENT_SECRET!;
  private readonly installationId = process.env.INSTALLATION_ID!;
  private readonly useWebhooks = process.env.USE_WEBHOOKS!;
  private app: Express;
  private smee: any;
  private server: Server;
  private appAuth: AuthInterface;
  private webHookInterface: AppHooks;
  private webhooks: Webhooks;
  private events: SourceIncomingEvents;
  private on: Webhooks['on'];

  constructor(props?: {
    portNumber?: number
  }) {
    this.portNumber = (props?.portNumber) ? props.portNumber : 1010;
    this.app = express();
    this.smee = smee(this.webhookProxyUrl, this.portNumber);
    this.appAuth = getAppAuth({
      githubAppId: this.githubAppId,
      privateKey: this.privateKey,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      installationId: this.installationId
    });
    this.webHookInterface = new AppHooks(this.appAuth);
    this.webhooks = this.webHookInterface.configureWebhook();
    this.on = this.webhooks.on;
  }

  async webhookTransform(event: EmitterWebhookEvent) {
    const { id, payload,  name } = event;
    const octokit = new Octokit({ auth: `Bearer ${await getAuthorizationToken(this.appAuth)}` });
    const context = { id, payload, name, octokit }
    return context;
  }

  async start() {
    // Starting the smee broadcast channel
    this.smee.start();
    this.server = this.app.listen(this.portNumber, () => {
      console.log(`Github App Server started on ${this.portNumber}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error('Address already in use');
      }
    })

    this.app.use(express.json());
    
    // Configure event source and webhooks and verify them before processing
    this.events = new SourceIncomingEvents(this.webhookProxyUrl);
    this.events.validateIncomingWebhookSource(this.webhooks);
    
    // Adding middleware for incoming webhooks
    this.app.use(this.webhookProxyUrl, (req, res, next) => {
      createNodeMiddleware(this.webhooks, { path: "/" })(req, res, next);
      res.sendStatus(200)
    });

    // Accept incoming PR webhook and do the magic
    if (this.useWebhooks === 'true') {
      console.log('Using Webhooks middleware layer directly')
      this.on('pull_request', async (context) => {
        this.webHookInterface.processIncomingPullRequest(context)
      })

      this.on('pull_request.closed', async (context) => {
        this.webHookInterface.deleteMergedBranch(context);
      })
      this.on('status', async(context) => {
        this.webHookInterface.checkCommitStatus(context);
      })
    } else {
      console.log('Creating custom middleware layer through express')
      this.app.use(async (req, res, next) => {
        const token = await getAuthorizationToken(this.appAuth);
        await deleteBranchRef(req, res, next, token)
      });

      this.app.use(async (req, res, next) => {
        const token = await getAuthorizationToken(this.appAuth);
        await addNewLabelToPullRequest(req, res, next, token)
      });
    }

    // this.app.use(async (req, res, next) => deleteBranchRef(req, res, next));
    this.app.use(async (req, res, next) => {
      next();
    })

    // Once server receives a response, we can do some more filtering here if needed. 
    // Incoming req body should contain the webhook response if one wishes to process it.
    this.app.post('/', async (req, res) => {
      // console.log('req', req)
      res.sendStatus(200);
    });
  }

  async stop() {
    // Close the smee broadcast channel
    this.smee.close();
    this.server.close();
  }
}