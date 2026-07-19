import path from "path";

/**
 * Optional on-disk content under web/ (may be empty until new architecture adds files).
 * Loaders treat missing directories as empty content.
 */
export const BRAINS_DIR = path.join(process.cwd(), "content", "brains");
export const KNOWLEDGE_DIR = path.join(process.cwd(), "content", "knowledge");
