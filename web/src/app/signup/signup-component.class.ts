import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthApi } from '../shared/api/auth-api.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrl: './signup.component.css',
  template: `
    <div class="signup-container">
      <div class="signup-card">
        <div class="logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" style="fill: var(--color-primary)"/>
            <path d="M14 24L22 32L34 16" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>Create Account</h1>
        <p class="subtitle">Join the Enterprise Platform</p>

        <form (ngSubmit)="onSignup()" class="signup-form">
          @if (error()) {
            <div class="error-message">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              {{ error() }}
            </div>
          }

          @if (created()) {
            <div class="success-message" role="status">Account created</div>
          }

          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              [(ngModel)]="email"
              name="email"
              placeholder="email@company.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              [(ngModel)]="password"
              name="password"
              placeholder="Min 8 characters"
              required
              autocomplete="new-password"
            />
          </div>

          <button type="submit" class="btn-primary" [disabled]="isLoading()">
            @if (isLoading()) {
              <span class="spinner"></span>
              Creating account...
            } @else {
              Sign up
            }
          </button>
        </form>

        <div class="divider">
          <span>or</span>
        </div>

        <p class="login-link">
          Already have an account?
          <a routerLink="/login">Sign in</a>
        </p>
      </div>

      <footer class="signup-footer">
        <p>Enterprise Template</p>
      </footer>
    </div>
  `
})
export class SignupComponent {
  email = '';
  password = '';
  error = signal<string | null>(null);
  created = signal(false);
  isLoading = signal(false);

  private authApi = inject(AuthApi);

  async onSignup() {
    this.error.set(null);
    this.created.set(false);

    const email = this.email.trim();
    if (!email || !this.password) {
      this.error.set('Please fill in all fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
      this.error.set('Please enter a valid email address');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }

    this.isLoading.set(true);
    try {
      // Open self-service signup — the backend assigns the VENDOR role.
      await this.authApi.signup({ email, password: this.password });
      this.created.set(true);
    } catch (err: any) {
      this.error.set(
        err?.status === 409 ? 'Email already registered' : 'Signup failed. Please try again.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
