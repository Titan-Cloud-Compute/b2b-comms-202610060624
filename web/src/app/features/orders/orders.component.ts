import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** Mirrors the order-management contract (Order / OrderItem). */
export interface Order {
  id: string;
  status: string;
  customerId?: string;
  vendorId?: string;
  estimatedDelivery?: string;
}

export interface OrderItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export const ORDER_CREATED_OUTCOME =
  'the order is stored with status "pending" and returns 201 with the created Order record';
export const ORDER_CONFIRMED_OUTCOME =
  'the order is updated to status "confirmed" and displays to the customer as confirmed';

function registerOrderMocks(api: ApiClient): void {
  if (!(api instanceof MockApiClient)) return;
  const orders: Order[] = [];
  const uuid = () =>
    (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  api.registerMock('GET', 'api/orders', async () => orders.map(o => ({ ...o })));
  api.registerMock('POST', 'api/orders', async (body: any) => {
    const order: Order = { id: uuid(), status: 'pending', customerId: 'mock-customer', vendorId: body?.vendorId };
    orders.push(order);
    return { ...order };
  });
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [],
  template: `
    <div data-testid="orders-screen">
      <h1>Orders</h1>

      <section data-testid="order-outcomes">
        <h2>How ordering works</h2>
        <ul>
          <li data-testid="order-created-outcome">When you submit a purchase order, {{ createdOutcome }}.</li>
          <li data-testid="order-confirmed-outcome">When the vendor confirms with an estimated delivery date, {{ confirmedOutcome }}.</li>
        </ul>
      </section>

      <section>
        <h2>New purchase order</h2>
        <form data-testid="order-form" (submit)="submitOrder($event)">
          <label>
            Vendor ID
            <input data-testid="order-vendor" name="vendorId" [value]="vendorId()"
                   (input)="vendorId.set($any($event.target).value)" required />
          </label>
          @for (item of items(); track $index; let i = $index) {
            <fieldset data-testid="order-item">
              <label>Description
                <input name="description-{{ i }}" [value]="item.description"
                       (input)="updateItem(i, 'description', $any($event.target).value)" />
              </label>
              <label>Quantity
                <input type="number" min="1" name="quantity-{{ i }}" [value]="item.quantity"
                       (input)="updateItem(i, 'quantity', $any($event.target).value)" />
              </label>
              <label>Unit price
                <input type="number" min="0" step="0.01" name="unitPrice-{{ i }}" [value]="item.unitPrice"
                       (input)="updateItem(i, 'unitPrice', $any($event.target).value)" />
              </label>
            </fieldset>
          }
          <button type="button" (click)="addItem()">Add item</button>
          <button type="submit" data-testid="order-submit" [disabled]="submitting()">Submit order</button>
        </form>
        @if (created(); as c) {
          <p data-testid="order-created">Order {{ c.id }} created with status "{{ c.status }}".</p>
        }
        @if (error()) {
          <p role="alert" data-testid="order-error">{{ error() }}</p>
        }
      </section>

      <section>
        <h2>Your orders</h2>
        @if (orders().length === 0) {
          <p data-testid="orders-empty">No orders yet.</p>
        } @else {
          <ul data-testid="order-list">
            @for (o of orders(); track o.id) {
              <li data-testid="order-row">
                <span>{{ o.id }}</span> — <strong>{{ o.status }}</strong>
                @if (o.status === 'pending') {
                  <input type="date" data-testid="order-delivery" [value]="deliveryDates()[o.id] || ''"
                         (input)="setDelivery(o.id, $any($event.target).value)" />
                  <button type="button" data-testid="order-confirm" (click)="confirm(o)">Confirm</button>
                }
                @if (o.status === 'confirmed') {
                  <span data-testid="order-confirmed">Confirmed</span>
                }
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly createdOutcome = ORDER_CREATED_OUTCOME;
  readonly confirmedOutcome = ORDER_CONFIRMED_OUTCOME;

  readonly orders = signal<Order[]>([]);
  readonly vendorId = signal('');
  readonly items = signal<OrderItemInput[]>([{ description: '', quantity: 1, unitPrice: 0 }]);
  readonly deliveryDates = signal<Record<string, string>>({});
  readonly created = signal<Order | null>(null);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  constructor() {
    registerOrderMocks(this.api);
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const res = await this.api.get<Order[]>('api/orders');
      this.orders.set(Array.isArray(res) ? res : []);
    } catch {
      this.orders.set([]);
    }
  }

  addItem(): void {
    this.items.update(list => [...list, { description: '', quantity: 1, unitPrice: 0 }]);
  }

  updateItem(index: number, field: keyof OrderItemInput, value: string): void {
    this.items.update(list =>
      list.map((it, i) =>
        i !== index ? it : { ...it, [field]: field === 'description' ? value : Number(value) },
      ),
    );
  }

  setDelivery(id: string, value: string): void {
    this.deliveryDates.update(d => ({ ...d, [id]: value }));
  }

  async submitOrder(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    if (!this.vendorId()) {
      this.error.set('Please choose a vendor.');
      return;
    }
    this.submitting.set(true);
    try {
      const order = await this.api.post<Order>('api/orders', {
        vendorId: this.vendorId(),
        items: this.items().filter(i => i.description.trim()),
      });
      this.created.set(order);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not create order.');
    } finally {
      this.submitting.set(false);
    }
  }

  async confirm(order: Order): Promise<void> {
    this.error.set(null);
    const estimatedDelivery = this.deliveryDates()[order.id];
    if (!estimatedDelivery) {
      this.error.set('Please set an estimated delivery date.');
      return;
    }
    try {
      if (this.api instanceof MockApiClient) {
        this.api.registerMock('PATCH', `api/orders/${order.id}/confirm`, async () => ({
          id: order.id,
          status: 'confirmed',
        }));
      }
      const updated = await this.api.patch<Order>(`api/orders/${order.id}/confirm`, { estimatedDelivery });
      this.orders.update(list =>
        list.map(o => (o.id === order.id ? { ...o, status: updated?.status ?? 'confirmed', estimatedDelivery } : o)),
      );
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not confirm order.');
    }
  }
}
