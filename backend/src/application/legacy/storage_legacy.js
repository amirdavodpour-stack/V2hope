/** Explicit test-runtime adapter for upload persistence. */
export function createStorageLegacyAdapter({ db, id, now }) {
  return Object.freeze({
    insertUpload(draft) { return db.insert('uploads', draft); },
    createIntent(draft) { return db.insert('uploadIntents', draft); },
    findUploadByKey(key) { return db.collection.uploads.find((x) => x.storageKey === key) || null; },
    findIntentByKey(key) { return db.collection.uploadIntents.find((x) => x.storageKey === key) || null; },
    completeUpload({ key, userId, contentType, size, createdAt, filename }) {
      const existing = db.collection.uploads.find((x) => x.storageKey === key);
      if (existing) return { existing: true, upload: existing };
      const created = db.insert('uploads', { id: id(), storageKey: key, uploadedBy: userId, contentType, size, createdAt });
      db.collection.uploadIntents = db.collection.uploadIntents.filter((x) => x.storageKey !== key);
      db.touch('uploadIntents');
      return { existing: false, upload: created, filename };
    },
    newId() { return id(); },
    async save() { await db.save(); },
  });
}
