import { AuthInterface } from "@octokit/auth-app/dist-types/types";
import { Octokit } from "@octokit/rest";
import { EmitterWebhookEvent, Webhooks } from "@octokit/webhooks";
import { getAuthorizationToken } from "../auth";
import { EmitterWebhookEventName as WebhookEvents } from "@octokit/webhooks/dist-types/types";

type PullRequestHooks = {
  id: string;
  name: WebhookEvents;
  payload: EmitterWebhookEvent<'pull_request'>['payload']
  octokit?: Octokit;
}

type StatusHooks = {
  id: string;
  name: WebhookEvents;
  payload: EmitterWebhookEvent<'status'>["payload"];
  octokit?: Octokit;
}
export class AppHooks {
  private appAuth: AuthInterface;
  private myhooks: any;
  constructor(appAuth: AuthInterface) {
    this.appAuth = appAuth;
  }

  async webhookTransform(event: EmitterWebhookEvent) {
    const { id, payload, name } = event;
    const octokit = new Octokit({ auth: `Bearer ${await getAuthorizationToken(this.appAuth)}` });
    const context = { id, payload, name, octokit }
    return context;
  }

  configureWebhook() {
    const webhooks = new Webhooks({
      secret: process.env.GITHUB_WEBHOOK_SECRET!,
      transform: this.webhookTransform.bind(this)
    });

    this.myhooks = webhooks;
    return (this.myhooks as typeof webhooks);
  }

  async processIncomingPullRequest(context: PullRequestHooks) {
    const payload = context.payload;
    const { owner, name: repo } = payload.repository;
    const pull_number = payload.pull_request.number;
    const status_url = payload.pull_request.statuses_url;


    // Gets the authenticated client
    const resp = await context.octokit!.pulls.listFiles({
      owner: owner.login,
      repo: repo,
      pull_number: pull_number
    });

    // Add here some custom logic to determine if running full-suite or not
    const fileNames = resp.data.map(d => d.filename);
    console.log('Change files', fileNames);

    // Add Label based on changed file logic

    const findIndex = fileNames.findIndex(f => f.match('tests/features'));

    if (findIndex > -1) {
      const myLabel = '@e2efull'
      console.log(`Adding a new label called ${myLabel}`);
      const label = await context.octokit!.issues.addLabels({
        owner: owner.login,
        repo: repo,
        issue_number: pull_number,
        labels: [myLabel]
      })
    }
  }

  async deleteMergedBranch(context: PullRequestHooks) {
    console.log('Pull request has merged');
    const payload = context.payload;
    const { owner, name: repo } = payload.repository;
    const ref = payload.pull_request.head.ref;
    console.log(`Deleting branch ${ref}`);
    const addComment = await context.octokit!.issues.createComment({
      owner: owner.login,
      repo: repo,
      issue_number: payload.pull_request.number,
      body: `Auto-Deleting branch ${ref}`
    })
    const deleteBranch = await context.octokit!.git.deleteRef({
      owner: owner.login,
      repo: repo,
      ref: `heads/${ref}`
    })
  }

  async checkCommitStatus(context: StatusHooks) {
    console.log('Enlisting Commit Statuses');
    const payload = context.payload;
    const { owner, name: repo } = payload.repository;
    const ref = payload.sha;
    console.log(`Checking branch ${ref}`);
    const getStatuses = await context.octokit!.repos.listCommitStatusesForRef({
      owner: owner.login,
      repo: repo,
      ref: ref
    });

    const findStatusToChange = getStatuses.data.find(s => s.context === 'Milestone Check');
    if(findStatusToChange!.state === 'pending') {
        const createStatuses = await context.octokit!.repos.createCommitStatus({
            owner: owner.login,
            repo: repo,
            sha: ref,
            state: 'success',
            context: 'Milestone Check',
            description: 'Status has been modified by the github app'
        });
    } else {
        console.log('All done!!');
    }
  }
}