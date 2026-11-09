'use strict';

// The entitlement is stored with the player's martial profile, never in the public loadout.
const M = require('../../public/js/martial');
const SECRETS = Object.freeze({
  wanderer: Object.freeze({ id: 'tau-vi-thuong-sach', name: 'Tẩu Vi Thượng Sách', branch: 'toc', level: 5 }),
  beggar: Object.freeze({ id: 'nhu-lai-than-chuong', name: 'Như Lai Thần Chưởng', branch: 'cuong', level: 9 }),
  obito: Object.freeze({ id: 'kamui', name: 'Kamui', branch: 'nhu', level: 8 })
});

function claim(profile, role) {
  const secret = Object.prototype.hasOwnProperty.call(SECRETS, role) && SECRETS[role];
  if (!secret || !profile || typeof profile !== 'object') return { ok: false, code: 'invalid' };
  const level = M.levelOf(Number.isFinite(profile.congLuc) ? profile.congLuc : 0);
  const tam = profile.tam && profile.tam[secret.branch];
  if (level < secret.level || !Number.isFinite(tam) || tam < M.TAM_MAX) return { ok: false, code: 'conditions' };
  if (!Array.isArray(profile.secretSkills)) profile.secretSkills = [];
  if (profile.secretSkills.includes(secret.id)) return { ok: true, already: true, id: secret.id, name: secret.name };
  profile.secretSkills.push(secret.id);
  return { ok: true, already: false, id: secret.id, name: secret.name };
}

module.exports = { SECRETS, claim };
