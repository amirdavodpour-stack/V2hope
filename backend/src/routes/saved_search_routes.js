export function createSavedSearchRoutes({ authUser, repo, legacy, readBody, sendJson, HttpError, textField }) {
  return async function savedSearchRoutes(req, res, parts) {
    const me = await authUser(req);
    if (req.method === 'GET' && parts.length === 1) {
      const items = process.env.DATABASE_URL ? await repo.listSavedSearches(me.id) : legacy.localList(me.id);
      return sendJson(res, 200, {items});
    }
    if (req.method === 'PUT' && parts.length === 1) {
      const body = await readBody(req);
      if (!body || typeof body !== 'object') throw new HttpError(400,'INVALID_BODY','Request body is required');
      const search = process.env.DATABASE_URL ? await repo.upsertSavedSearch(me.id, {
        id: body.id ? textField(body.id,'id',{min:1,max:100}) : undefined,
        name: textField(body.name,'name',{min:1,max:100,required:true}),
        query: textField(body.query || '','query',{min:0,max:240}), kind: textField(body.kind || 'ALL','kind',{min:1,max:40}),
        visibility: textField(body.visibility || 'ALL','visibility',{min:1,max:40}), city: textField(body.city || 'AUTO','city',{min:1,max:120}), category: textField(body.category || 'ALL','category',{min:1,max:120}),
      }) : legacy.localUpsert(me.id, body);
      return sendJson(res, 200, search);
    }
    if (req.method === 'DELETE' && parts.length === 2 && parts[1]) {
      const id=textField(parts[1],'id',{min:1,max:100});
      const result=process.env.DATABASE_URL ? await repo.deleteSavedSearch(me.id,id) : legacy.localDelete(me.id,id);
      if (!result) throw new HttpError(404,'SAVED_SEARCH_NOT_FOUND','Saved search not found');
      return sendJson(res,200,result);
    }
    throw new HttpError(404,'NOT_FOUND','Saved search route not found');
  };
}
