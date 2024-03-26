import EventSource from 'eventsource';
import { Webhooks } from '@octokit/webhooks';

export class SourceIncomingEvents {
  private readonly webhooksProxyUrl: string;

  constructor(webhooksProxyUrl: string) {
    this.webhooksProxyUrl  = webhooksProxyUrl;
  }

  startEventSource() {
    return new EventSource(this.webhooksProxyUrl);
  }

  validateIncomingWebhookSource(incomingWebhook: Webhooks) {
    const source = this.startEventSource();
    source.onmessage = async (event) => {
      const webhookEvent = JSON.parse(event.data);
      await incomingWebhook
        .verifyAndReceive({
          id: webhookEvent["x-github-delivery"],
          name: webhookEvent["x-github-event"],
          signature: webhookEvent["x-hub-signature"],
          payload: JSON.stringify(webhookEvent.body),
        })
        .catch((error) => {
          console.log(error)
        });
    };
  }
}