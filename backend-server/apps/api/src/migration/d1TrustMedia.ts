// Shared private verification-media naming and delivery rules. The legacy
// reference format and the admin delivery route must stay in step with the
// owner-facing upload and download routers.

export const trustMediaPath = "/api/trust-verification/media/";
// Admin submissions accept the broader legacy reference shape; the owner-facing
// route must keep storage.ts's stricter generated-name pattern.
export const trustMediaReference = /^[a-f0-9]{24}_[0-9]{1,20}_[a-z0-9]{6}\.(\w{2,5})$/i;
export const trustOwnerMediaReference = /^[0-9a-f]{24}_[0-9]+_[a-z0-9]{6}\.(jpe?g|png|webp|mp4|mov|m4v|webm|mp3|m4a|aac|wav|ogg)$/i;
export const trustMediaMime: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac", ogg: "audio/ogg"
};

export const trustMediaKey = (fileName: string) => `trust-verification/${fileName}`;
