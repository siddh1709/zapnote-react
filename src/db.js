import { openDB } from 'idb';

const DB_NAME = 'ClipNoteDB';
const DB_VERSION = 2; // Incremented to ensure all stores are created
export const VIDEO_STORE = 'videos';
export const IMAGE_STORE = 'images';
export const AUDIO_STORE = 'audios';

export const initDB = async () => 
{
  return openDB(DB_NAME, DB_VERSION,
  {
    upgrade(db) 
    {
      if (!db.objectStoreNames.contains(VIDEO_STORE)) 
      {
        db.createObjectStore(VIDEO_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) 
      {
        db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) 
      {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
      }
    },
  });
};

// ===== VIDEO STORAGE =====

export const saveVideo = async (id, file) => 
{
  const db = await initDB();
  await db.put(VIDEO_STORE, { id, file });
};

export const getVideo = async (id) => 
{
  const db = await initDB();
  const record = await db.get(VIDEO_STORE, id);
  return record?.file || null;
};

export const deleteVideo = async (id) => 
{
  const db = await initDB();
  await db.delete(VIDEO_STORE, id);
};

// ===== IMAGE STORAGE =====

export const saveImage = async (id, file) => 
{
  const db = await initDB();
  await db.put(IMAGE_STORE, { id, file });
};

export const getImage = async (id) => 
{
  const db = await initDB();
  const record = await db.get(IMAGE_STORE, id);
  return record?.file || null;
};

export const deleteImage = async (id) => 
{
  const db = await initDB();
  await db.delete(IMAGE_STORE, id);
};

// Replace the AUDIO STORAGE section in your db.js with this:

// ===== AUDIO STORAGE =====

export const saveAudio = async (id, audioData) => 
{
  const db = await initDB();
  // audioData should be { file: Blob, name: string }
  await db.put(AUDIO_STORE, 
  { 
    id, 
    file: audioData.file, 
    name: audioData.name || "" 
  });
};

export const getAudio = async (id) => 
{
  const db = await initDB();
  const record = await db.get(AUDIO_STORE, id);
  return record?.file || null;
};

export const getAudioWithMetadata = async (id) => 
{
  const db = await initDB();
  const record = await db.get(AUDIO_STORE, id);
  if (!record) return null;
  return {
    file: record.file,
    name: record.name || ""
  };
};

export const deleteAudio = async (id) => 
{
  const db = await initDB();
  await db.delete(AUDIO_STORE, id);
};

export const getAllAudioKeys = async () => 
{
  const db = await initDB();
  return await db.getAllKeys(AUDIO_STORE);
};

export const getAudioByFullKey = async (fullKey) => 
{
  const db = await initDB(); 
  const record = await db.get(AUDIO_STORE, fullKey);
  return record?.file || null;
};