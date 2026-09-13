/** Legacy-only session persistence adapter. */
export function createSessionLegacyAdapter({ db }) {
  const findUserById = (id) => db.collection.users.find((u) => u.id === id);
  const findUserByEmail = (email) => db.collection.users.find((u) => u.email === email);
  const insertRefreshToken = (token) => db.insert('refreshTokens', token);
  const id = () => db.id();
  return { findUserById, findUserByEmail, insertRefreshToken, id };
}
