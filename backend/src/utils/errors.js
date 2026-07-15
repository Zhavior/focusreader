class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = "INTERNAL_SERVER_ERROR", retryable = false) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.retryable = retryable;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ProviderTtsError extends AppError {
  constructor(provider, message, statusCode = 502, retryable = true) {
    super(
      `[${provider}] ${message}`,
      statusCode,
      `PROVIDER_${provider.toUpperCase()}_ERROR`,
      retryable
    );
    this.provider = provider;
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Unauthorized access") {
    super(message, 401, "UNAUTHORIZED", false);
  }
}

class InsufficientCreditsError extends AppError {
  constructor(message = "Out of credits — open Billing to upgrade.") {
    super(message, 402, "INSUFFICIENT_CREDITS", false);
  }
}

class RateLimitExceededError extends AppError {
  constructor(message = "Too many requests. Please slow down.") {
    super(message, 429, "RATE_LIMIT_EXCEEDED", true);
  }
}

class InvalidInputError extends AppError {
  constructor(message = "Invalid input request") {
    super(message, 400, "INVALID_INPUT", false);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND", false);
  }
}

class ValidationError extends AppError {
  constructor(message = "Validation failed", details = null) {
    super(message, 400, "VALIDATION_ERROR", false);
    this.details = details;
  }
}

module.exports = {
  AppError,
  ProviderTtsError,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitExceededError,
  InvalidInputError,
  NotFoundError,
  ValidationError,
};
