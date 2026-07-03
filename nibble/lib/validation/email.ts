// RFC 5321 §4.5.3: local part ≤ 64 chars, domain label ≤ 63 chars,
// TLD ≥ 2 chars (no numbers). No espacios ni arroba dentro de cada segmento.
// Los schemas Zod arman su refine con esta regex directamente — hubo
// helpers `emailOptional`/`emailRequired` acá pero nadie los usaba.
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@.]{2,63}$/;
