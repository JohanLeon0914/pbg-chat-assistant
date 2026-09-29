import { Firestore } from "@google-cloud/firestore";

let firestore: Firestore | null = null;

export function getFirestore() {
  if (!firestore) {
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || "f1-ml-project",
      databaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
    });
  }

  return firestore;
}

