import { useState } from 'react';
import { storage } from '../utils.js';

const DISMISSED_KEY = 'qcm-banner-ferme';

export const isSafeLink = (url) => /^https?:\/\/\S+$/i.test(url?.trim() || '');

// Bannière d'annonce en haut de la page (modifiable dans Admin → Réglages).
// Fermée par Sara, elle réapparaît dès que le texte change.
export default function AnnouncementBar({ banner, preview = false }) {
  const [dismissed, setDismissed] = useState(() => storage.get(DISMISSED_KEY, ''));
  const text = banner?.text?.trim();
  if (!text || (!preview && (!banner.enabled || dismissed === text))) return null;

  function close() {
    storage.set(DISMISSED_KEY, text);
    setDismissed(text);
  }

  return (
    <div className={`announce announce-${banner.style || 'degrade'}`} role="region" aria-label="Annonce">
      <span className="announce-text">{text}</span>
      {isSafeLink(banner.link) && (
        <a className="announce-link" href={banner.link.trim()} target="_blank" rel="noopener noreferrer">
          {banner.linkLabel?.trim() || 'En savoir plus'}
        </a>
      )}
      {!preview && (
        <button className="announce-close" onClick={close} aria-label="Fermer l’annonce">
          ×
        </button>
      )}
    </div>
  );
}
