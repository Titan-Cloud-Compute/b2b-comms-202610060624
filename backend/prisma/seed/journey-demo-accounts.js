'use strict';

/**
 * Journey demo accounts for the auth-entry cards (pure module — no DB access).
 * seed.js merges them into COLOSSUS_ACCOUNTS_JSON, adding each only when absent.
 */
const JOURNEY_DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({ email: 'admin@b2b-portal.example.com', password: 'password', role: 'ADMIN', name: 'Portal Admin' }),
  Object.freeze({ email: 'vendor@acme.example.com', password: 'password', role: 'VENDOR', name: 'Acme Vendor' }),
  Object.freeze({ email: 'buyer@corp.example.com', password: 'password', role: 'CUSTOMER', name: 'Corp Buyer' }),
]);

/** Returns a new array: `accounts` plus every demo account whose email is not already present. */
function withJourneyDemoAccounts(accounts) {
  const out = Array.isArray(accounts) ? accounts.slice() : [];
  for (const demo of JOURNEY_DEMO_ACCOUNTS) {
    if (!out.some((a) => a && a.email === demo.email)) out.push({ ...demo });
  }
  return out;
}

module.exports = { JOURNEY_DEMO_ACCOUNTS, withJourneyDemoAccounts };
