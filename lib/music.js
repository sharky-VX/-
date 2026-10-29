const axios = require('axios');
const config = require('../config');
const U = require('./utils');

// ═══════════════════════════════════════════════
//  Búsqueda de música.
//   • Si pones config.spotify.clientId / clientSecret (gratis en developer.spotify.com)
//     se busca en Spotify de verdad.
//   • Sin claves: iTunes Search (gratis, sin key) da portada HD, artista, álbum, año y género.
//  El AUDIO completo siempre sale de YouTube (yt-dlp), porque Spotify no deja descargar.
// ═══════════════════════════════════════════════
let token = null, tokenExp = 0;

async function spotifyToken() {
  const { clientId, clientSecret } = config.spotify || {};
  if (!clientId || !clientSecret) return null;
  if (token && Date.now() < tokenExp) return token;
  const r = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
    headers: { Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  token = r.data.access_token;
  tokenExp = Date.now() + (r.data.expires_in - 60) * 1000;
  return token;
}

async function viaSpotify(q, n) {
  const t = await spotifyToken();
  if (!t) return null;
  const d = await U.getJson('https://api.spotify.com/v1/search', { params: { q, type: 'track', limit: n }, headers: { Authorization: 'Bearer ' + t } });
  return (d.tracks?.items || []).map((x) => ({
    title: x.name,
    artist: x.artists.map((a) => a.name).join(', '),
    album: x.album?.name,
    year: (x.album?.release_date || '').slice(0, 4),
    duration: Math.round(x.duration_ms / 1000),
    cover: x.album?.images?.[0]?.url,
    url: x.external_urls?.spotify,
    popularity: x.popularity,
    preview: x.preview_url,
    source: 'Spotify',
  }));
}

async function viaItunes(q, n) {
  const d = await U.getJson('https://itunes.apple.com/search', { params: { term: q, media: 'music', entity: 'song', limit: n, country: 'US' } });
  return (d.results || []).map((x) => ({
    title: x.trackName,
    artist: x.artistName,
    album: x.collectionName,
    year: (x.releaseDate || '').slice(0, 4),
    duration: Math.round((x.trackTimeMillis || 0) / 1000),
    cover: (x.artworkUrl100 || '').replace('100x100bb', '1200x1200bb'),
    genre: x.primaryGenreName,
    url: x.trackViewUrl,
    preview: x.previewUrl,
    source: 'iTunes',
  }));
}

// Si pegan un enlace de Spotify, saca el nombre con oEmbed (sin clave)
async function fromSpotifyLink(url) {
  try {
    const d = await U.getJson('https://open.spotify.com/oembed', { params: { url } });
    return d.title || '';
  } catch { return ''; }
}

async function searchTracks(q, n = 5) {
  try {
    const r = await viaSpotify(q, n);
    if (r && r.length) return r;
  } catch (e) { /* cae a iTunes */ }
  return viaItunes(q, n);
}

module.exports = { searchTracks, fromSpotifyLink };
