/** Legacy-only saved-search persistence adapter. */
export function createSavedSearchLegacy({ db, textField, now }) {
  const localList = (userId) => db.collection.savedSearches
    .filter((x) => x.userId === userId)
    .sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0,20);
  const localUpsert = (userId, body) => {
    const name = textField(body.name, 'name', {min:1,max:100,required:true}).trim();
    const values = {
      id: String(body.id || db.id()), userId, name,
      query: textField(body.query || '', 'query', {min:0,max:240}),
      kind: textField(body.kind || 'ALL', 'kind', {min:1,max:40}),
      visibility: textField(body.visibility || 'ALL', 'visibility', {min:1,max:40}),
      city: textField(body.city || 'AUTO', 'city', {min:1,max:120}),
      category: textField(body.category || 'ALL', 'category', {min:1,max:120}),
      updatedAt: now(), createdAt: now(),
    };
    const existing = db.collection.savedSearches.find((x) => x.userId === userId && (x.id === values.id || x.name.trim().toLowerCase() === name.toLowerCase()));
    if (existing) Object.assign(existing, values, { id: existing.id, createdAt: existing.createdAt || values.createdAt });
    else db.insert('savedSearches', values);
    const all = localList(userId);
    if (all.length > 20) for (const stale of all.slice(20)) db.collection.savedSearches = db.collection.savedSearches.filter((x) => x.id !== stale.id);
    db.touch('savedSearches');
    return db.collection.savedSearches.find((x) => x.userId === userId && x.id === values.id)
      || db.collection.savedSearches.find((x) => x.userId === userId && x.name.toLowerCase() === name.toLowerCase());
  };
  const localDelete = (userId, id) => {
    const exists = db.collection.savedSearches.some((x) => x.id === id && x.userId === userId);
    if (!exists) return null;
    db.collection.savedSearches = db.collection.savedSearches.filter((x) => !(x.id === id && x.userId === userId));
    db.touch('savedSearches');
    return {deleted:true,id};
  };
  return { localList, localUpsert, localDelete };
}
