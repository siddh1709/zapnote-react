import { useEffect, useRef, useState } from "react";
import { saveAudio } from './db';
import WaveformPlayer from './WaveformPlayer';

// Tag Input Component
function TagInput({ tags, onChange }) 
{
  const [input, setInput] = useState('');

  const addTag = () => 
  {
    const t = input.trim();
    if (t && !tags.includes(t)) 
    {
      onChange([...tags, t]);
    }
    setInput('');
  };

  return (
    <div id="tagInputContainer">
      <div id="tagList">
        {tags.map((tag, i) => (
          <span className="tag-chip" key={i}>
            {tag} 
            <span 
              className="remove-tag" 
              onClick={() => onChange(tags.filter(x => x !== tag))}
            >
              &times;
            </span>
          </span>
        ))}
      </div>
      <input
        id="tagInputField"
        value={input}
        placeholder="Add tag…"
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') 
          {
            e.preventDefault();
            addTag();
          }
        }}
      />
    </div>
  );
}

// Popup Component
function Popup({text, tags, pinned, onText, onTags, onTogglePin, onSave, 
  onCancel, archived, videos, setVideos, currentNote, currentImages, 
  handleImageUpload, handleImageDelete, fullscreenImage, setFullscreenImage, audioList, handleAudioDelete, 
  isRecording, startRecording, stopRecording, setAudioList,setRemovedVideos}) 
{
  const inputRef = useRef();

  useEffect(() => 
  {
    const handler = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const handleVideoUpload = (event) => 
  {
    const files = Array.from(event.target.files);
    const newVideoObjs = files.map(file => ({
      id: `video_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      url: URL.createObjectURL(file),
      file: file
    }));

    setVideos(prev => [...(prev || []), ...newVideoObjs]);
    event.target.value = '';
  };

  const handleMediaUpload = async (event) => 
  {
    console.log("handleMediaUpload called");
    
    if (!currentNote?.id) 
    {
      console.error("currentNote is not ready yet for media upload");
      return;
    }

    const files = Array.from(event.target.files);
    console.log("Files to upload:", files);
    
    for (const file of files) 
    {
      console.log("Processing file:", file.name, "Type:", file.type);
      
      if (file.type.startsWith('video/')) 
      {
        console.log("Uploading video:", file.name);
        const newVideoObj = 
        {
          id: `video_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          url: URL.createObjectURL(file),
          file: file
        };
        setVideos(prev => [...(prev || []), newVideoObj]);
        
      } 
      else if (file.type.startsWith('image/')) 
      {
        console.log("Uploading image:", file.name);
        await handleImageUpload(currentNote.id, file);
        
      } 
      else if (file.type.startsWith('audio/') || file.name.match(/\.(wav|mp3|m4a|ogg|webm)$/i)) 
      {
        console.log("Uploading audio:", file.name, "MIME type:", file.type);
        
        try 
        {
          const id = `${currentNote.id}_${Date.now()}`;
          console.log("Saving audio with ID:", id);
          
          // Save to IndexedDB with correct format
          await saveAudio(id, { file, name: file.name });
          console.log("Audio saved successfully");
          
          // Update UI
          setAudioList((prev) => 
          {
            const newList = [
              ...prev,
              { id, url: URL.createObjectURL(file), name: file.name },
            ];
            console.log("Updated audio list:", newList);
            return newList;
          });
          
        } 
        catch (err) 
        {
          console.error("Failed to upload audio file:", err);
        }
      } 
      else 
      {
        console.log("File type not recognized:", file.type, "Name:", file.name);
      }
    }

    event.target.value = '';
    console.log("handleMediaUpload completed");
  };

  const removeVideo = (idToRemove) => 
  {
    setVideos(prev => 
    {
      const updated = prev.filter(vid => vid.id !== idToRemove);
      const removedVid = prev.find(vid => vid.id === idToRemove);
      if (removedVid?.url?.startsWith("blob:")) 
      {
        URL.revokeObjectURL(removedVid.url);
      }
      return updated;
    });
    setRemovedVideos(prev => [...prev, idToRemove]);
  };

  return (
    <div className="popup-overlay" onClick={onCancel}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <div className="popup-content">
          <div className="popup-controls">
            {!archived && (
              <i
                className={`fa-solid ${pinned ? "fa-thumbtack-slash" : "fa-thumbtack"} popup-pin-btn`}
                onClick={onTogglePin}
                title={pinned ? "Unpin" : "Pin"}
              ></i>
            )}
            <i
              className="fa-solid fa-xmark popup-close-btn"
              onClick={onCancel}
              title="Close"
            ></i>
          </div>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => onText(e.target.value)}
            className="popup-textarea large"
            placeholder="Write your note..."
          />

          <TagInput tags={tags} onChange={onTags} />

          {/* Combined Media Grid - Videos and Images */}
          <div className="media-grid">
            {[...(videos || []), ...(currentImages || [])].map(({ id, url }) => 
            {
              const isImage = currentImages.some(img => img.id === id);
              return (
                <div key={id} className="media-cell">
                  {isImage ? (
                    <img
                      src={url}
                      className="media-image"
                      alt="Note media"
                      onClick={() => setFullscreenImage(url)}
                    />
                  ) : (
                    <video
                      controls
                      className="media-video"
                      src={url}
                    />
                  )}
                  <button 
                    className="remove-video-icon" 
                    onClick={() => 
                    {
                      if (isImage) 
                      {
                        handleImageDelete(currentNote?.id, id);
                      } 
                      else 
                      {
                        removeVideo(id);
                      }
                    }}
                    title="Delete media"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Audio List - Separate row for audio files */}
          <div className="audio-list">
            {(audioList || []).map((audio, index) => 
            {
              if (!audio || !audio.url) return null;
              return (
                <div key={audio.id} className="audio-item">
                  <input
                    className="audio-title-input"
                    type="text"
                    placeholder="Enter audio title"
                    value={audio.name || ""}
                    onChange={(e) => 
                    {
                      const newList = [...audioList];
                      newList[index] = { ...audio, name: e.target.value };
                      setAudioList(newList);
                    }}
                  />
                  <WaveformPlayer audioUrl={audio.url} />
                  <button
                    className="remove-video-icon"
                    onClick={() => handleAudioDelete(audio.id)}
                    title="Delete audio"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          
          {/* Single Upload Media Section */}
          <div className="video-upload-section">
            <input
              type="file"
              accept="video/*,image/*,audio/*,.wav,.mp3,.m4a,.ogg,.webm"
              style={{ display: "none" }}
              id="mediaUploadInput"
              onChange={handleMediaUpload}
              multiple
            />
            <label htmlFor="mediaUploadInput" className="video-upload-label">
              <i className="fa-solid fa-upload"></i> Upload Media
            </label>
          </div>

          {/* Audio recording row */}
          <div className="audio-recording-row">
            {isRecording ? (
              <>
                <button onClick={stopRecording} className="record-btn stop">
                  Stop Recording
                </button>
                <div className="recording-status">
                  <span className="recording-dot" />
                  <span>Recording...</span>
                </div>
              </>
            ) : (
              <button onClick={startRecording} className="record-btn start">
                Start Recording
              </button>
            )}
          </div>

          <button onClick={onSave} id="popupSave">
            Save
          </button>
        </div>
      </div>

      {fullscreenImage && (
        <div className="fullscreen" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="preview" />
        </div>
      )}
    </div>
  );
}

export default Popup;