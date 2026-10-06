import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, ApiError, ConflictError, MockApiClient } from '../../shared/api/api-client';
import { AuthService } from '../../shared/auth.service';

// Mirrors backend/src/features/customer-invite/customer-invite.dto.ts.
// (No @contracts/* module for this feature exists yet; shared/contracts is not ours to edit.)
export interface CustomerSummary {
  id: string;
  email: string;
}
export interface InviteCustomerRequest {
  email: string;
}
export interface InviteCustomerResponse {
  customerId: string;
  email: string;
  invitationSent: boolean;
}

const LIST_PATH = '/api/admin/customers';
const INVITE_PATH = '/api/admin/customers/invite';

/** In-memory mocks so the screen works under MockApiClient (USE_MOCKS). */
function registerMocks(client: MockApiClient): void {
  const customers: CustomerSummary[] = [];
  client.registerMock<CustomerSummary[]>('GET', LIST_PATH, async () => [...customers]);
  client.registerMock<InviteCustomerResponse>('POST', INVITE_PATH, async (body: unknown) => {
    const email = String((body as InviteCustomerRequest | undefined)?.email ?? '').trim().toLowerCase();
    if (customers.some(c => c.email === email)) {
      throw new ConflictError('Customer already exists');
    }
    const customer = { id: crypto.randomUUID(), email };
    customers.unshift(customer);
    return { customerId: customer.id, email, invitationSent: true };
  });
}

@Component({
  selector: 'app-customer-invite',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="admin-customers-screen" class="customer-invite">
      <h1>Customer Management</h1>

      @if (forbidden()) {
        <p role="alert" data-testid="customer-invite-forbidden">Admin access required.</p>
      } @else {
        <form data-testid="customer-invite-form" (ngSubmit)="invite()">
          <label for="customer-invite-email">Customer email</label>
          <input
            id="customer-invite-email"
            data-testid="customer-invite-email"
            type="email"
            name="email"
            required
            autocomplete="email"
            placeholder="customer@example.com"
            [(ngModel)]="email"
            [disabled]="submitting()" />
          <button type="submit" data-testid="customer-invite-submit" [disabled]="submitting() || !email.trim()">
            Invite
          </button>
        </form>

        @if (success()) {
          <p role="status" data-testid="customer-invite-success">Invitation sent to {{ success() }}</p>
        }
        @if (error()) {
          <p role="alert" data-testid="customer-invite-error">{{ error() }}</p>
        }

        <section data-testid="customer-list" aria-label="Customers">
          <h2>Customers</h2>
          @if (loading()) {
            <p>Loading customers…</p>
          } @else if (customers().length === 0) {
            <p data-testid="customer-list-empty">No customers invited yet.</p>
          } @else {
            <ul>
              @for (c of customers(); track c.id) {
                <li data-testid="customer-list-item" [attr.data-customer-id]="c.id">{{ c.email }}</li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
})
export class CustomerInviteComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  email = '';
  readonly customers = signal<CustomerSummary[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly forbidden = computed(() => {
    const user = this.auth.user();
    return !!user && !this.auth.hasAdminRole();
  });

  constructor() {
    if (this.api instanceof MockApiClient) registerMocks(this.api);
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.api.get<CustomerSummary[]>(LIST_PATH);
      this.customers.set(Array.isArray(list) ? list : []);
    } catch {
      this.customers.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async invite(): Promise<void> {
    const email = this.email.trim();
    if (!email || this.submitting()) return;
    this.submitting.set(true);
    this.success.set(null);
    this.error.set(null);
    try {
      const body: InviteCustomerRequest = { email };
      const res = await this.api.post<InviteCustomerResponse>(INVITE_PATH, body);
      if (!res?.invitationSent) {
        this.error.set('Invitation could not be sent');
        return;
      }
      this.success.set(res.email);
      this.email = '';
      const created = { id: res.customerId, email: res.email };
      this.customers.update(list => [created, ...list.filter(c => c.id !== created.id)]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        this.error.set('Customer already exists');
      } else {
        this.error.set(err instanceof Error && err.message ? err.message : 'Invitation failed');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
