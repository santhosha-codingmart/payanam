import express from "express";
import multer from "multer";
import {
  getProfile,
  updateProfile,
  getVendorDashboard,
  uploadProfileImage,
} from "../controllers/user.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { updateProfileSchema } from "../validators/user.validator.js";

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});
const router = express.Router();
router.get("/profile", authenticate, getProfile);
router.put(
  "/profile",
  authenticate,
  validate(updateProfileSchema),
  updateProfile,
);
router.get(
  "/vendor/dashboard",
  authenticate,
  authorize("vendor", "admin"),
  getVendorDashboard,
);
router.post(
  "/profile/upload-image",
  authenticate,
  upload.single("image"),
  uploadProfileImage,
);

export default router;
