import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, User } from '../shared/auth.service';
import { AuthApi } from '../shared/api/auth-api.service';
import { ConflictError, BadRequestError } from '../shared/api/api-errors';

/**
 * Open self-service sign-up: Email + Password, one button. The backend
 * (POST auth/signup) creates a VENDOR account and sets the session cookie;
 * we confirm with "Account created" and continue to /vendor/profile.
 */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrl: './signup.component.css',
  template: `
    <div class="signup-container">
      <div class="signup-card">
        <h1>Create Account</h1>
        <p class="subtitle">Sign up as a vendor</p>

        @if (created()) {
          <div class="success-message" role="status">Account created</div>
        }

        <form (ngSubmit)="onSignup()" class="signup-form">
          @if (error()) {
            <div class="error-message" role="alert">{{ error() }}</div>
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

          <button type="submit" class="btn-primary" [disabled]="isLoading() || created()">
            @if (isLoading()) {
              <span class="spinner"></span>
              Creating account...
            } @else {
              Sign up
            }
          </button>
        </form>

        <p class="login-link">
          Already have an account?
          <a routerLink="/login">Log in</a>
        </p>
      </div>
    </div>
  `
})
export class SignupComponent {
  email = '';
  password = '';
  error = signal<string | null>(null);
  created = signal(false);
  isLoading = signal(false);

  auth = inject(AuthService);
  private authApi = inject(AuthApi);
  private router = inject(Router);

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
      const result = await this.authApi.signup({ email, password: this.password });
      const role = (result?.role as User['role']) || 'VENDOR';
      this.auth.setUser({
        id: result?.id ?? email,
        email: result?.email ?? email,
        name: (result?.email ?? email).split('@')[0],
        role,
      });
      this.created.set(true);
      setTimeout(() => void this.router.navigate(['/vendor/profile']), 1500);
    } catch (err) {
      if (err instanceof ConflictError || (err as any)?.status === 409) {
        this.error.set('An account with this email already exists');
      } else if (err instanceof BadRequestError) {
        this.error.set('Invalid sign-up data');
      } else {
        this.error.set('Signup failed. Please try again.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
