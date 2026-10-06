import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** Contract shapes for the shared-channel endpoints. */
export interface ChannelSummary {
  id: string;
  name: string;
}
export interface ChannelMessage {
  id: string;
  body: string;
  channelId: string;
}

const CHANNEL_STORED_TEXT =
  'the channel is stored and displays in both the vendor and customer channel lists';
const MESSAGE_STORED_TEXT =
  'the message is stored and returns 201 with the created Message record';

/** Registers in-memory handlers when the app runs against MockApiClient. */
function registerSharedChannelMocks(client: MockApiClient): void {
  const channels: ChannelSummary[] = [];
  let seq = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  client.registerMock('GET', '/api/channels', async () => channels.slice());
  client.registerMock('POST', '/api/channels', async (body) => {
    const ch = { id: uid(), name: String((body as { name?: string })?.name ?? '') };
    channels.push(ch);
    for (const c of channels) {
      client.registerMock('POST', `/api/channels/${c.id}/messages`, async (b) => ({
        id: uid(),
        body: String((b as { body?: string })?.body ?? ''),
        channelId: c.id,
      }));
    }
    return ch;
  });
}

@Component({
  selector: 'app-shared-channel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="channels-screen">
      <h1>Channels</h1>
      <p class="help">
        When you create a channel, {{ channelStoredText }}.
        When a member posts, {{ messageStoredText }}.
      </p>

      <form data-testid="create-channel-form" (ngSubmit)="createChannel()">
        <label for="channel-name">Channel name</label>
        <input id="channel-name" name="name" data-testid="channel-name-input"
               [(ngModel)]="newName" required />
        <button type="submit" data-testid="create-channel-submit" [disabled]="!newName.trim()">
          Create channel
        </button>
      </form>
      @if (channelCreated()) {
        <p data-testid="channel-created" role="status">{{ channelStoredText }}</p>
      }
      @if (error()) {
        <p data-testid="channels-error" role="alert">{{ error() }}</p>
      }

      <ul data-testid="channel-list">
        @for (ch of channels(); track ch.id) {
          <li data-testid="channel-item">
            <button type="button" (click)="select(ch)"
                    [attr.aria-pressed]="selected()?.id === ch.id">{{ ch.name }}</button>
          </li>
        } @empty {
          <li data-testid="channel-list-empty">No channels yet.</li>
        }
      </ul>

      @if (selected(); as ch) {
        <section data-testid="channel-messages">
          <h2>{{ ch.name }}</h2>
          <ul data-testid="message-list">
            @for (m of messages(); track m.id) {
              <li data-testid="message-item">{{ m.body }}</li>
            }
          </ul>
          <form data-testid="post-message-form" (ngSubmit)="postMessage()">
            <label for="message-body">Message</label>
            <input id="message-body" name="body" data-testid="message-body-input"
                   [(ngModel)]="newBody" required />
            <button type="submit" data-testid="post-message-submit" [disabled]="!newBody.trim()">
              Send
            </button>
          </form>
          @if (messagePosted()) {
            <p data-testid="message-posted" role="status">{{ messageStoredText }}</p>
          }
        </section>
      }
    </div>
  `,
})
export class SharedChannelComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly channelStoredText = CHANNEL_STORED_TEXT;
  readonly messageStoredText = MESSAGE_STORED_TEXT;

  readonly channels = signal<ChannelSummary[]>([]);
  readonly selected = signal<ChannelSummary | null>(null);
  readonly messages = signal<ChannelMessage[]>([]);
  readonly channelCreated = signal(false);
  readonly messagePosted = signal(false);
  readonly error = signal<string | null>(null);

  newName = '';
  newBody = '';

  constructor() {
    if (this.api instanceof MockApiClient) registerSharedChannelMocks(this.api);
  }

  async ngOnInit(): Promise<void> {
    try {
      const list = await this.api.get<ChannelSummary[]>('/api/channels');
      this.channels.set(Array.isArray(list) ? list.filter((c) => c && c.id) : []);
    } catch {
      this.error.set('Could not load channels.');
    }
  }

  select(ch: ChannelSummary): void {
    this.selected.set(ch);
    this.messages.set([]);
    this.messagePosted.set(false);
  }

  async createChannel(): Promise<void> {
    const name = this.newName.trim();
    if (!name) return;
    this.error.set(null);
    try {
      const ch = await this.api.post<ChannelSummary>('/api/channels', { name });
      if (ch && ch.id) {
        this.channels.update((list) => [...list, { id: ch.id, name: ch.name }]);
        this.selected.set(ch);
        this.messages.set([]);
      }
      this.newName = '';
      this.channelCreated.set(true);
    } catch {
      this.error.set('Could not create channel.');
    }
  }

  async postMessage(): Promise<void> {
    const ch = this.selected();
    const body = this.newBody.trim();
    if (!ch || !body) return;
    this.error.set(null);
    try {
      const msg = await this.api.post<ChannelMessage>(
        `/api/channels/${encodeURIComponent(ch.id)}/messages`,
        { body },
      );
      if (msg && msg.id) this.messages.update((list) => [...list, msg]);
      this.newBody = '';
      this.messagePosted.set(true);
    } catch {
      this.error.set('Could not send message.');
    }
  }
}
