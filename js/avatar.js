// Foto del profilo: si sceglie dal telefono, si rimpicciolisce, si salva nello spazio privato
// "avatars" di Supabase (cartella = id dell'utente). Si vede solo dopo il login.

import { supabase } from './supabase.js';
import { showToast, saveErrorMessage } from './ui.js';

const SIZE = 320; // lato della foto salvata, in pixel: basta e avanza per un cerchio di 44px

let userId = null;
let photoUrl = null; // indirizzo temporaneo (firmato) della foto, oppure null

const path = () => `${userId}/avatar.jpg`;

// Disegna la foto o l'iniziale in tutti i punti dove compare (.avatar)
function paint() {
  document.querySelectorAll('.avatar').forEach((el) => {
    const img = el.querySelector('img');
    img.hidden = !photoUrl;
    if (photoUrl) img.src = photoUrl;
  });
}

// Un file privato non ha un indirizzo pubblico: Supabase ne crea uno temporaneo ("firmato"),
// valido un'ora, che funziona solo per chi ha fatto il login
async function loadPhoto() {
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path(), 60 * 60);
  photoUrl = error ? null : data.signedUrl; // errore = nessuna foto caricata: resta l'iniziale
  paint();
}

// Ritaglia al centro un quadrato e lo rimpicciolisce: da 4 MB a circa 30 KB
async function resize(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.getContext('2d').drawImage(
    bitmap,
    (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, // quadrato centrale della foto
    0, 0, SIZE, SIZE,
  );
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

async function upload(file) {
  try {
    const blob = await resize(file);
    const { error } = await supabase.storage.from('avatars').upload(path(), blob, {
      upsert: true, // sostituisce la foto precedente
      contentType: 'image/jpeg',
    });
    if (error) throw error;
    await loadPhoto();
    showToast('Foto aggiornata.');
  } catch (error) {
    showToast(error?.message?.includes('decode') || error?.name === 'InvalidStateError'
      ? 'Questa immagine non si riesce a leggere: prova con un\'altra foto.'
      : saveErrorMessage(error));
  }
}

// Dopo il login: carica la foto dell'utente
export function initAvatar(id) {
  userId = id;
  photoUrl = null;
  paint();
  loadPhoto();
}

// Al logout: niente foto in pagina
export function clearAvatar() {
  userId = null;
  photoUrl = null;
  paint();
}

// Una volta sola: il cerchio della foto apre la scelta dell'immagine
export function initAvatarPicker() {
  const input = document.getElementById('avatar-input');
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="change-photo"]') && userId) input.click();
  });
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = ''; // così si può scegliere di nuovo la stessa foto
    if (file) upload(file);
  });
}
