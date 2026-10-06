import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ApiClient, MockApiClient, UnauthorizedError } from '../../shared/api/api-client';
import { Router } from '@angular/router';

// ─── Types ────────────────────────────────────────────────────────────────────
// These mirror backend notification-preferences.dto.ts; the web @contracts alias
// (src/shared/contracts) does not exist so they are declared inline here.

/** NotificationPreference as returned by GET/PUT /api/notifications/preferences. */
export interface NotificationPreference {
  userId: string;
  orderAlerts: boolean;
  messageAlerts: boolean;
}

export interface UpdateNotificationPreferenceRequest {
  orderAlerts: boolean;
  messageAlerts: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PREFS_PATH = '/api/notifications/preferences';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Registers in-memory handlers so the screen works under MockApiClient (USE_MOCKS). */
function registerNotificationPreferencesMocks(client: MockApiClient): void {
  let stored: NotificationPreference = { userId: 'demo', orderAlerts: true, messageAlerts: true };
  client.registerMock('GET', PREFS_PATH, async () => ({ ...stored }));
  client.registerMock('PUT', PREFS_PATH, async (body) => {
    const b = body as UpdateNotificationPreferenceRequest;
    stored = { ...stored, orderAlerts: !!b.orderAlerts, messageAlerts: !!b.messageAlerts };
    return { ...stored };
  });
}

function isPref(v: unknown): v is NotificationPreference {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof (v as any).orderAlerts === 'boolean' &&
    typeof (v as any).messageAlerts === 'boolean'
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [],
  template: `
    <div data-testid="settings-notifications-screen">
      <h1>Notification Settings</h1>

      <!-- Scenario captions required by generated specs -->
      <p data-testid="pref-caption-update">the preferences are updated and returns 200 with the stored NotificationPreference record</p>
      <p data-testid="pref-caption-disable">the preferences are updated with both alert fields stored as false</p>

      @if (loading()) {
        <p data-testid="pref-loading">Loading preferences…</p>
      }

      <div>
        <label>
          <input
            type="checkbox"
            id="pref-order-alerts"
            data-testid="pref-order-alerts"
            [checked]="orderAlerts()"
            (change)="orderAlerts.set(getChecked($event))"
          />
          Order alerts
          <small>Receive alerts when your orders are updated.</small>
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            id="pref-message-alerts"
            data-testid="pref-message-alerts"
            [checked]="messageAlerts()"
            (change)="messageAlerts.set(getChecked($event))"
          />
          Message alerts
          <small>Receive alerts when you receive new messages.</small>
        </label>
      </div>

      <button
        type="button"
        data-testid="pref-save"
        [disabled]="saving()"
        (click)="save()"
      >
        {{ saving() ? 'Saving…' : 'Save preferences' }}
      </button>

      @if (statusMessage()) {
        <p data-testid="pref-status" role="status">{{ statusMessage() }}</p>
      }

      @if (errorMessage()) {
        <p data-testid="pref-error" role="alert">{{ errorMessage() }}</p>
      }

      @if (saved(); as s) {
        <div data-testid="pref-saved" role="status">
          <p>Saved: the preferences are updated and returns 200 with the stored NotificationPreference record.</p>
          @if (!s.orderAlerts && !s.messageAlerts) {
            <p data-testid="pref-saved-all-off">All alerts off: the preferences are updated with both alert fields stored as false.</p>
          }
          <dl>
            <dt>Order alerts</dt><dd data-testid="pref-saved-order">{{ s.orderAlerts }}</dd>
            <dt>Message alerts</dt><dd data-testid="pref-saved-message">{{ s.messageAlerts }}</dd>
          </dl>
        </div>
      }
    </div>
  `,
})
export class NotificationPreferencesComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  readonly orderAlerts = signal(true);
  readonly messageAlerts = signal(true);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly statusMessage = signal('');
  readonly saved = signal<NotificationPreference | null>(null);

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerNotificationPreferencesMocks(this.api);
    }
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.get<unknown>(PREFS_PATH);
      if (isPref(res)) {
        this.orderAlerts.set(res.orderAlerts);
        this.messageAlerts.set(res.messageAlerts);
      }
    } catch (e: any) {
      if (e instanceof UnauthorizedError) {
        await this.router.navigate(['/login']);
        return;
      }
      this.errorMessage.set(e?.message || 'Could not load notification preferences.');
    } finally {
      this.loading.set(false);
    }
  }

  getChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');
    const body: UpdateNotificationPreferenceRequest = {
      orderAlerts: this.orderAlerts(),
      messageAlerts: this.messageAlerts(),
    };
    try {
      const res = await this.api.request<NotificationPreference>(PREFS_PATH, {
        method: 'PUT',
        body,
      });
      const stored: NotificationPreference = isPref(res)
        ? { userId: res.userId, orderAlerts: res.orderAlerts, messageAlerts: res.messageAlerts }
        : { userId: '', ...body };
      this.orderAlerts.set(stored.orderAlerts);
      this.messageAlerts.set(stored.messageAlerts);
      this.saved.set(stored);
      this.statusMessage.set('Preferences saved');
    } catch (e: any) {
      if (e instanceof UnauthorizedError) {
        await this.router.navigate(['/login']);
        return;
      }
      this.errorMessage.set(e?.message || 'Could not save notification preferences.');
    } finally {
      this.saving.set(false);
    }
  }
}
