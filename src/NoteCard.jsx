import { useEffect, useState } from "react";
import { getAudio } from './db';
import WaveformPlayer from './WaveformPlayer';

// Truncate text helper
const truncate = (text, maxLength) => 
{
  if (!text || typeof text !== 'string') return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};


// Note Card Component
function NoteCard({ note, onClick, archived, onArchive, onRestore, onDelete, onTagClick }) 
{
  const [audioURLs, setAudioURLs] = useState([]);

  useEffect(() => 
  {
    const loadAudioURLs = async () => 
    {
      if (!Array.isArray(note.audios)) return;
      
      const urls = await Promise.all(
        note.audios.map(async (audio) => 
        {
          try 
          {
            if (!audio?.id) return null;
            
            const blob = await getAudio(audio.id);
            
            // Check if blob is valid before creating URL
            if (!blob || !(blob instanceof Blob)) 
            {
              console.warn("Missing or invalid audio blob for ID:", audio.id);
              return null;
            }
            
            return URL.createObjectURL(blob);
          } 
          catch (error) 
          {
            console.error("Error loading audio for ID:", audio?.id, error);
            return null;
          }
        })
      );
      
      setAudioURLs(urls.filter(Boolean)); // Remove nulls
    };
    
    loadAudioURLs();
  }, [note.audios]);

  return (
    <div className={`note-cell note${note.pinned ? ' pinned' : ''}${archived ? ' archived' : ''}`}>
      {/* Clickable area for note */}
      <div className="note-click-area" onClick={onClick}>
        <div className="note-content">
          {truncate(note.content, 
            note.videos?.length || note.imageURLs?.length || note.audios?.length ? 20 : 120
          )}
        </div>
        <div className="note-media-scroll">
          {/* Videos */}
          {note.videos?.map((vid, i) => 
          {
            const url = typeof vid === 'string' ? vid : vid?.url;
            if (!url) return null;
            return (
              <video
                key={vid?.id || i}
                className="note-media"
                src={url}
                controls
                onClick={(e) => e.stopPropagation()}
              />
            );
          })}

          {/* Images */}
          {note.imageURLs?.map((img, i) => 
          {
            const url = typeof img === 'string' ? img : img?.url;
            if (!url) return null;
            return (
              <img
                key={img?.id || i}
                className="note-media"
                src={url}
                alt="note"
              />
            );
          })}

          {/* Audios */}
          {note.audios?.map((audio, i) => 
          {
            const url = audioURLs[i];
            if (!audio?.id || !url) return null;
            return (
              <div
                key={audio.id || i}
                className="note-audio-item"
                onClick={(e) => e.stopPropagation()} // Prevent triggering note open
              >
                <div className="note-audio-title">🎵 {audio.name || "Untitled Audio"}</div>
                <div className="audio-wrapper">
                  <WaveformPlayer audioUrl={url} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Display tags */}
        <div className="note-tags-wrapper">
          {Array.isArray(note.tags) && note.tags.map((tag, i) => (
            <span
              className="tag"
              key={i}
              onClick={e => 
              {
                e.stopPropagation(); 
                onTagClick?.(tag);
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="note-actions-container">
        <div className="note-actions">
          {archived ? (
            <>
              <i className="fa-solid fa-rotate-left restore-btn" onClick={onRestore}></i>
              <i className="fa-solid fa-trash delete-btn" onClick={onDelete}></i>
            </>
          ) : (
            <i className="fa-solid fa-archive delete-btn" onClick={onArchive}></i>
          )}
        </div>
      </div>
    </div>
  );
}

export default NoteCard;