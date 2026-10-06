import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

interface VendorProfileRecord {
  id: string;
  companyName: string;
  contactEmail: string;
}

interface VendorDocument {
  id: string;
  filename: string;
  status: string;
}

const PROFILE_PATH = '/api/vendor/profile';
const DOCUMENTS_PATH = '/api/vendor/documents';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Register in-memory mocks for this feature's endpoints when running against MockApiClient. */
function registerVendorOnboardingMocks(client: MockApiClient): void {
  const docs: VendorDocument[] = [];
  client.registerMock('POST', PROFILE_PATH, async (body) => {
    const b = (body ?? {}) as Partial<VendorProfileRecord>;
    return { id: newId(), companyName: b.companyName ?? '', contactEmail: b.contactEmail ?? '' };
  });
  client.registerMock('POST', DOCUMENTS_PATH, async (body) => {
    const b = (body ?? {}) as Partial<VendorDocument>;
    const doc: VendorDocument = { id: newId(), filename: b.filename ?? '', status: 'pending' };
    docs.push(doc);
    return doc;
  });
  client.registerMock('GET', DOCUMENTS_PATH, async () => [...docs]);
}

@Component({
  selector: 'app-vendor-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="vendor-profile-screen">
      <h1>Vendor Profile</h1>

      <section>
        <h2>Company profile</h2>
        <p>Submit your company profile and contact details — the profile is stored and returns 201 with the created VendorProfile record.</p>
        <form (ngSubmit)="saveProfile()">
          <label for="vendor-company-name">Company name</label>
          <input id="vendor-company-name" name="companyName" data-testid="vendor-company-name"
                 [(ngModel)]="companyName" required />
          <label for="vendor-contact-email">Contact email</label>
          <input id="vendor-contact-email" name="contactEmail" type="email" data-testid="vendor-contact-email"
                 [(ngModel)]="contactEmail" required />
          <button type="submit" data-testid="vendor-profile-submit" [disabled]="savingProfile()">Save profile</button>
        </form>
        @if (profile(); as p) {
          <p data-testid="vendor-profile-saved">Saved profile for {{ p.companyName }} ({{ p.contactEmail }}).</p>
        }
        @if (profileError()) {
          <p role="alert">{{ profileError() }}</p>
        }
      </section>

      <section>
        <h2>Compliance documents</h2>
        <p>Upload a required compliance document — the document is stored with status "pending" and displays in the vendor document library.</p>
        <form (ngSubmit)="uploadDocument()">
          <label for="vendor-document-filename">Document filename</label>
          <input id="vendor-document-filename" name="filename" data-testid="vendor-document-filename"
                 [(ngModel)]="filename" required />
          <button type="submit" data-testid="vendor-document-upload" [disabled]="uploading()">Upload document</button>
        </form>
        @if (documentError()) {
          <p role="alert">{{ documentError() }}</p>
        }

        <h3>Document library</h3>
        <ul data-testid="vendor-document-library">
          @for (doc of documents(); track doc.id) {
            <li data-testid="vendor-document-item">{{ doc.filename }} — {{ doc.status }}</li>
          } @empty {
            <li>No documents uploaded yet.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class VendorProfileComponent implements OnInit {
  private readonly api = inject(ApiClient);

  companyName = '';
  contactEmail = '';
  filename = '';

  readonly profile = signal<VendorProfileRecord | null>(null);
  readonly documents = signal<VendorDocument[]>([]);
  readonly savingProfile = signal(false);
  readonly uploading = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly documentError = signal<string | null>(null);

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerVendorOnboardingMocks(this.api);
    }
  }

  ngOnInit(): void {
    void this.loadDocuments();
  }

  async loadDocuments(): Promise<void> {
    try {
      const docs = await this.api.get<VendorDocument[]>(DOCUMENTS_PATH);
      this.documents.set(Array.isArray(docs) ? docs : []);
    } catch {
      this.documents.set([]);
    }
  }

  async saveProfile(): Promise<void> {
    if (!this.companyName.trim() || !this.contactEmail.trim()) {
      this.profileError.set('Company name and contact email are required.');
      return;
    }
    this.savingProfile.set(true);
    this.profileError.set(null);
    try {
      const created = await this.api.post<VendorProfileRecord>(PROFILE_PATH, {
        companyName: this.companyName.trim(),
        contactEmail: this.contactEmail.trim(),
      });
      this.profile.set(created);
    } catch {
      this.profileError.set('Could not save the profile.');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async uploadDocument(): Promise<void> {
    if (!this.filename.trim()) {
      this.documentError.set('A filename is required.');
      return;
    }
    this.uploading.set(true);
    this.documentError.set(null);
    try {
      await this.api.post<VendorDocument>(DOCUMENTS_PATH, { filename: this.filename.trim() });
      this.filename = '';
      await this.loadDocuments();
    } catch {
      this.documentError.set('Could not upload the document.');
    } finally {
      this.uploading.set(false);
    }
  }
}
