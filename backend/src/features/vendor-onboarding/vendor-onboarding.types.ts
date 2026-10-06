/**
 * Vendor-onboarding request/response types.
 * Field-for-field copy of the relevant entries in shared/contracts/dtos.ts.
 */

export interface PostApiVendorProfileRequest {
  companyName: string;
  contactEmail: string;
}

export interface PostApiVendorProfileResponse {
  id: string;
  companyName: string;
  contactEmail: string;
}

export interface PostApiVendorDocumentsRequest {
  filename: string;
}

export interface PostApiVendorDocumentsResponse {
  id: string;
  filename: string;
  status: string;
}

export interface GetApiVendorDocumentsResponse {
  id: string;
  filename: string;
  status: string;
}
