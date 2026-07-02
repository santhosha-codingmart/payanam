import multer from "multer";

// Configure Multer to use memory storage (keep file in RAM as a Buffer)
// This is perfect for serverless or when we want to forward the buffer directly to S3
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."), false);
    }
};

// Create the Multer upload instance
export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB limit per file
    },
    fileFilter: fileFilter,
});
