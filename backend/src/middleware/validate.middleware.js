import { ApiError } from '../utils/ApiError.js';
import { ZodError } from 'zod';

// This is a "Curried" function. It's a function that returns another function!
// It takes a Zod schema, and returns an Express middleware.
export const validate = (schema) => async (req, res, next) => {
    try {
        // We tell Zod to check the req.body, req.query, and req.params against our rules
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // Data is perfect! Hand the baton to the next controller.
        return next();
    } catch (error) {
        // 1. Is it a Zod Validation Error?
        if (error instanceof ZodError) {
            const errorMessages = error.issues.map(err => `${err.path.join('.')}: ${err.message}`);
            return next(new ApiError(400, "Validation Error", errorMessages));
        }

        // 2. If it's a random server crash (like a TypeError), pass it downwards!
        return next(error);
    }
};
