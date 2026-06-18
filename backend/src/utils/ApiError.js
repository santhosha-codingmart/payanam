export class ApiError extends Error {
    constructor(statusCode, message = "Something went wrong", errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.success = false;

        // Capture the stack trace to help us find exactly where the error occurred
        Error.captureStackTrace(this, this.constructor);
    }
}
