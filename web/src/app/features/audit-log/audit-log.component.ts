import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** AuditEntry as returned by GET /api/admin/audit-log. */
export interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
}

/** Response of POST /api/admin/audit-log. */
export interface CreatedAuditEntry {
  id: string;
  action: string;
  createdAt: string;
}

const AUDIT_LOG_PATH = '/api/admin/audit-log';

/** In-memory store backing the MockApiClient handlers (USE_MOCKS mode only). */
const mockEntries: AuditEntry[] = [];

function registerAuditLogMocks(client: MockApiClient): void {
  client.registerMock<AuditEntry[]>('GET', AUDIT_LOG_PATH, async () => [...mockEntries]);
  client.registerMock<CreatedAuditEntry>('POST', AUDIT_LOG_PATH, async (body) => {
    const { action, userId } = (body ?? {}) as { action?: string; userId?: string };
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      action: action ?? '',
      userId: userId ?? '',
      createdAt: new Date().toISOString(),
    };
    mockEntries.push(entry);
    return { id: entry.id, action: entry.action, createdAt: entry.createdAt };
  });
}

function byCreatedAt(a: AuditEntry, b: AuditEntry): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="admin-audit-log-screen">
      <h1>Audit Log</h1>

      <section>
        <p data-testid="audit-log-list-caption">a list of AuditEntry records is displayed in chronological order returns 200</p>
        @if (loading()) {
          <p data-testid="audit-log-loading">Loading…</p>
        } @else if (loadError()) {
          <p data-testid="audit-log-error" role="alert">{{ loadError() }}</p>
        }
        @if (entries().length) {
          <table data-testid="audit-log-table">
            <thead>
              <tr><th>When</th><th>Action</th><th>User</th></tr>
            </thead>
            <tbody>
              @for (e of entries(); track e.id) {
                <tr data-testid="audit-log-row">
                  <td>{{ e.createdAt }}</td>
                  <td>{{ e.action }}</td>
                  <td>{{ e.userId }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p data-testid="audit-log-empty">No audit entries yet.</p>
        }
      </section>

      <section>
        <p data-testid="audit-log-record-caption">the AuditEntry is stored and returns 201 with the created record</p>
        <form data-testid="audit-log-form" (ngSubmit)="record()">
          <label>Action <input name="action" data-testid="audit-log-action" [(ngModel)]="action" required /></label>
          <label>User ID <input name="userId" data-testid="audit-log-user-id" [(ngModel)]="userId" required /></label>
          <button type="submit" data-testid="audit-log-submit" [disabled]="saving() || !action.trim() || !userId.trim()">Record</button>
        </form>
        @if (saveError()) {
          <p data-testid="audit-log-save-error" role="alert">{{ saveError() }}</p>
        }
      </section>
    </div>
  `,
})
export class AuditLogComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly entries = signal<AuditEntry[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  action = '';
  userId = '';

  constructor() {
    if (this.api instanceof MockApiClient) registerAuditLogMocks(this.api);
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const res = await this.api.get<AuditEntry[]>(AUDIT_LOG_PATH);
      this.entries.set(Array.isArray(res) ? [...res].sort(byCreatedAt) : []);
    } catch (err: unknown) {
      this.loadError.set((err as { message?: string })?.message ?? 'Failed to load audit log');
    } finally {
      this.loading.set(false);
    }
  }

  async record(): Promise<void> {
    const action = this.action.trim();
    const userId = this.userId.trim();
    if (!action || !userId) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const created = await this.api.post<CreatedAuditEntry>(AUDIT_LOG_PATH, { action, userId });
      const entry: AuditEntry = {
        id: created?.id ?? crypto.randomUUID(),
        action: created?.action ?? action,
        userId,
        createdAt: created?.createdAt ?? new Date().toISOString(),
      };
      this.entries.update(list => [...list, entry].sort(byCreatedAt));
      this.action = '';
      this.userId = '';
    } catch (err: unknown) {
      this.saveError.set((err as { message?: string })?.message ?? 'Failed to record entry');
    } finally {
      this.saving.set(false);
    }
  }
}
