import { ApiError } from "../utils/ApiError.js";
import { ZodError } from "zod";

export const validate = (schema) => async (req, res, next) => {
  try {
    const data = JSON.parse(
      JSON.stringify({
        body: req.body ?? {},
        query: req.query ?? {},
        params: req.params ?? {},
      }),
    );
    await schema.parseAsync(data);
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map(
        (err) => `${err.path.join(".")}: ${err.message}`,
      );
      return next(new ApiError(400, "Validation Error", errorMessages));
    }
    return next(error);
  }
};
