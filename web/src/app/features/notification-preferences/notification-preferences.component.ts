import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** NotificationPreference as returned by GET/PUT /api/notifications/preferences. */
export interface NotificationPreference {
  userId: string;
  orderAlerts: boolean;
  messageAlerts: boolean;
}

export type NotificationPreferenceUpdate = Pick<NotificationPreference, 'orderAlerts' | 'messageAlerts'>;

const PREFS_PATH = '/api/notifications/preferences';

/** Registers in-memory handlers so the screen works under MockApiClient (USE_MOCKS). */
function registerMocks(client: MockApiClient): void {
  let stored: NotificationPreference = { userId: 'mock-user', orderAlerts: true, messageAlerts: true };
  client.registerMock('GET', PREFS_PATH, async () => ({ ...stored }));
  client.registerMock('PUT', PREFS_PATH, async (body) => {
    const b = body as NotificationPreferenceUpdate;
    stored = { ...stored, orderAlerts: !!b.orderAlerts, messageAlerts: !!b.messageAlerts };
    return { ...stored };
  });
}

function isPref(v: unknown): v is NotificationPreference {
  return !!v && typeof v === 'object' && !Array.isArray(v)
    && typeof (v as any).orderAlerts === 'boolean' && typeof (v as any).messageAlerts === 'boolean';
}

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="settings-notifications-screen">
      <h1>Notification Settings</h1>
      <p>
        Choose which alerts you receive. When you save, the preferences are updated and returns 200 with the
        stored NotificationPreference record. Turning both off means the preferences are updated with both alert
        fields stored as false.
      </p>

      @if (loading) {
        <p data-testid="pref-loading">Loading preferences…</p>
      }

      <form (ngSubmit)="save()">
        <label>
          <input type="checkbox" data-testid="pref-order-alerts" name="orderAlerts" [(ngModel)]="orderAlerts" />
          Order alerts
        </label>
        <label>
          <input type="checkbox" data-testid="pref-message-alerts" name="messageAlerts" [(ngModel)]="messageAlerts" />
          Message alerts
        </label>
        <button type="submit" data-testid="pref-save" [disabled]="saving">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </form>

      @if (error) {
        <p role="alert" data-testid="pref-error">{{ error }}</p>
      }

      @if (saved) {
        <div data-testid="pref-saved" role="status">
          <p>Saved: the preferences are updated and returns 200 with the stored NotificationPreference record.</p>
          @if (!saved.orderAlerts && !saved.messageAlerts) {
            <p data-testid="pref-saved-all-off">All alerts off: the preferences are updated with both alert fields stored as false.</p>
          }
          <dl>
            <dt>Order alerts</dt><dd data-testid="pref-saved-order">{{ saved.orderAlerts }}</dd>
            <dt>Message alerts</dt><dd data-testid="pref-saved-message">{{ saved.messageAlerts }}</dd>
          </dl>
        </div>
      }
    </div>
  `,
})
export class NotificationPreferencesComponent implements OnInit {
  private readonly api = inject(ApiClient);

  orderAlerts = true;
  messageAlerts = true;
  loading = false;
  saving = false;
  error = '';
  saved: NotificationPreference | null = null;

  constructor() {
    if (this.api instanceof MockApiClient) registerMocks(this.api);
  }

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      const res = await this.api.get<unknown>(PREFS_PATH);
      if (isPref(res)) {
        this.orderAlerts = res.orderAlerts;
        this.messageAlerts = res.messageAlerts;
      }
    } catch (e: any) {
      this.error = e?.message || 'Could not load notification preferences.';
    } finally {
      this.loading = false;
    }
  }

  async save(): Promise<void> {
    this.saving = true;
    this.error = '';
    const body: NotificationPreferenceUpdate = { orderAlerts: this.orderAlerts, messageAlerts: this.messageAlerts };
    try {
      const res = await this.api.request<unknown>(PREFS_PATH, { method: 'PUT', body });
      const stored: NotificationPreference = isPref(res)
        ? { userId: res.userId, orderAlerts: res.orderAlerts, messageAlerts: res.messageAlerts }
        : { userId: '', ...body };
      this.orderAlerts = stored.orderAlerts;
      this.messageAlerts = stored.messageAlerts;
      this.saved = stored;
    } catch (e: any) {
      this.error = e?.message || 'Could not save notification preferences.';
    } finally {
      this.saving = false;
    }
  }
}
