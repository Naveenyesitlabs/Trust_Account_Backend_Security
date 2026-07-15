const normalizeRole = (role = '') => role.toString().toLowerCase().replace(/\s+/g, '');

const resolveRoleScopedField = (role = '') => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'user' ? 'userId' : 'adminId';
};

const escapeLikeValue = (value = '') =>
  value.toString().replace(/[\\%_]/g, '\\$&');

const toContainsLikeValue = (value = '') => `%${escapeLikeValue(value)}%`;

module.exports = {
  normalizeRole,
  resolveRoleScopedField,
  escapeLikeValue,
  toContainsLikeValue,
};
