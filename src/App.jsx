import { useEffect, useRef, useState } from "react";
import "./style.css";
import "./notes.css";
import "./responsive.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { saveVideo, getVideo, deleteVideo } from './db';
import { saveImage, getImage, deleteImage } from './db';
import { saveAudio, getAudio, deleteAudio, getAllAudioKeys } from './db';
import NoteCard from './NoteCard';
import Popup from './Popup';

export default function App() 
{
  // State management
  const [notes, setNotes] = useState([]);
  const [archived, setArchived] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingArchived, setEditingArchived] = useState(false);

  // Popup state
  const [currentText, setCurrentText] = useState('');
  const [currentTags, setCurrentTags] = useState([]);
  const [isPinned, setIsPinned] = useState(false);
  const [currentVideos, setCurrentVideos] = useState([]);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  
  // Add these new state variables for image handling
  const [currentNote, setCurrentNote] = useState(null);
  const [currentImages, setCurrentImages] = useState([]);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [showNav, setShowNav] = useState(false);
  
  // Refs
  const pinnedRef = useRef(null);
  const allRef = useRef(null);
  const archivedRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);

  //Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [audioList, setAudioList] = useState([]);

  //Delete States
  const [removedAudios, setRemovedAudios] = useState([]);
  const [removedVideos, setRemovedVideos] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);

  useEffect(() => 
  {
    // Force scroll on load to mimic nav behavior
    allRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, []);
  
  // Load notes from localStorage and normalize videos
  useEffect(() => 
  {
    const loadAllNotes = async () => 
    {
      try 
      {
        const rawNotes = JSON.parse(localStorage.getItem("notes") || "[]");
        const rawArchived = JSON.parse(localStorage.getItem("archivedNotes") || "[]");

        // Migrate notes without IDs first
        const migratedNotes = migrateNotesWithoutIds(rawNotes);
        const migratedArchived = migrateNotesWithoutIds(rawArchived);

        // Then normalize with videos
        const normalizedNotes = await Promise.all(migratedNotes.map(normalizeWithVideos));
        const normalizedArchived = await Promise.all(migratedArchived.map(normalizeWithVideos));

        setNotes(normalizedNotes);
        setArchived(normalizedArchived);

        // Save back to localStorage if any notes were migrated
        if (migratedNotes.some((note, i) => note.id !== rawNotes[i]?.id) || migratedArchived.some((note, i) => note.id !== rawArchived[i]?.id)) 
        {
          localStorage.setItem("notes", JSON.stringify(normalizedNotes));
          localStorage.setItem("archivedNotes", JSON.stringify(normalizedArchived));
        }
      } 
      catch (error) 
      {
        console.error("Error loading notes:", error);
      }
    };

    loadAllNotes();
  }, []);

  useEffect(() => 
  {
    const loadImages = async () => 
    {
      const updatedNotes = await Promise.all(notes.map(async (note) => 
      {
        const loadedImages = await Promise.all(
          (note.images || []).map(async (id) => 
          {
            const blob = await getImage(id);
            return { id, url: URL.createObjectURL(blob) };
          })
        );
        return { ...note, imageURLs: loadedImages };
      }));
      setNotes(updatedNotes);
    };

    loadImages();
  }, []);

  useEffect(() => 
  {
    if (!currentNote?.id) return;

    const loadAudios = async () => 
    {
      const keys = await getAllAudioKeys();
      const matching = keys.filter((key) =>
        key.startsWith(currentNote.id)
      );
      const urls = await Promise.all(
        matching.map(async (audioId) => 
        {
          const file = await getAudio(audioId);
          if (file instanceof Blob) 
          {
            return { id: audioId, url: URL.createObjectURL(file) };
          } 
          else 
          {
            console.warn("Invalid audio blob for id:", audioId);
            return null;
          }
        })
      );
      setAudioList(urls.filter(Boolean));
    };

    loadAudios();
  }, [currentNote]);

  // Normalize videos by loading from IndexedDB
  const normalizeWithVideos = async (note) => 
  {
    const videos = [];
    const images = [];

    // Normalize videos
    if (Array.isArray(note.videos)) 
    {
      for (const vid of note.videos) 
      {
        const id = typeof vid === "string" ? vid : vid.id;
        const file = await getVideo(id);
        if (file) videos.push({ id, url: URL.createObjectURL(file) });
      }
    }

    // Normalize images
    if (Array.isArray(note.imageURLs)) 
    {
      for (const img of note.imageURLs) 
      {
        const id = typeof img === "string" ? img : img.id;
        const file = await getImage(id);
        if (file) images.push({ id, url: URL.createObjectURL(file) });
      }
    }

    return {
      ...note,
      videos,
      imageURLs: images,
    };
  };

  const migrateNotesWithoutIds = (notes) => 
  {
    return notes.map(note => 
    {
      if (!note.id) 
      {
        return {
          ...note,
          id: `note_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        };
      }
      return note;
    });
  };

  // Save notes to localStorage
  const saveNotesToStorage = (notesToSave, archivedToSave = archived) => 
  {
    localStorage.setItem("notes", JSON.stringify(notesToSave));
    localStorage.setItem("archivedNotes", JSON.stringify(archivedToSave));
  };

  // Image handling functions - ADD THESE BEFORE openPopup
  const handleImageUpload = async (noteId, file) => 
  {
    const imageId = `${noteId}-img-${Date.now()}`;
    await saveImage(imageId, file);

    // Update current images for the popup
    const newImageURL = { id: imageId, url: URL.createObjectURL(file) };
    setCurrentImages(prev => [...prev, newImageURL]);
  };

  const handleImageDelete = (noteId, imageId) => 
  {
    setCurrentImages(prev => prev.filter(img => img.id !== imageId));
    setRemovedImages(prev => [...prev, imageId]);
  };

  const startRecording = async () => 
  {
    try 
    {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream; // Save stream to ref so we can stop it later

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => 
      {
        if (e.data.size > 0) 
        {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => 
      {
        //  Stop the microphone stream
        if (mediaStreamRef.current) 
        {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        try 
        {
          const id = `${currentNote.id}_${Date.now()}`;
          await saveAudio(id, { file: audioBlob, name: "" }); 

          setAudioList((prev) => [
            ...prev,
            { id, url: URL.createObjectURL(audioBlob) },
          ]);
        } 
        catch (err) 
        {
          console.error("Failed to save audio:", err);
        }

        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } 
    catch (error) 
    {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = () => 
  {
    if (mediaRecorderRef.current) 
    {
      mediaRecorderRef.current.stop();
      setIsRecording(false); 
    }
  };

  const handleAudioDelete = (id) => 
  {
    setAudioList(prev => prev.filter(audio => audio.id !== id));
    setRemovedAudios(prev => [...prev, id]);
  };

  // Handle saving a note
  const handleSave = async () => 
  {
    try 
    {
      // Save videos to IndexedDB and get their IDs
      const videoObjs = await Promise.all(
        currentVideos.map(async (video) => 
        {
          if (video.file) 
          {
            await saveVideo(video.id, video.file);
          }
          const blob = await getVideo(video.id);
          const url = blob ? URL.createObjectURL(blob) : video.url;
          return { id: video.id, url };
        })
      );

      // Save images to the note
      const imageIds = currentImages.map(img => img.id);

      const noteData = 
      {
        id: (editingIndex !== null)
          ? (editingArchived ? archived[editingIndex]?.id : notes[editingIndex]?.id)
          : `note_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        content: currentText,
        tags: currentTags,
        pinned: isPinned,
        videos: videoObjs,
        images: imageIds,
        imageURLs: currentImages,
        audios: audioList.map(a => ({ id: a.id, name: a.name || "" })), 
        date: Date.now()
      };

      if (editingIndex === null) 
      {
        // New note
        const updatedNotes = [...notes, noteData];
        setNotes(updatedNotes);
        saveNotesToStorage(updatedNotes);
      } 
      else 
      {
        // Edit existing note
        if (editingArchived) 
        {
          const updatedArchived = [...archived];
          updatedArchived[editingIndex] = noteData;
          setArchived(updatedArchived);
          saveNotesToStorage(notes, updatedArchived);
        } 
        else 
        {
          const updatedNotes = [...notes];
          updatedNotes[editingIndex] = noteData;
          setNotes(updatedNotes);
          saveNotesToStorage(updatedNotes);
        }
      }

      await Promise.all([
        ...removedVideos.map(id => deleteVideo(id)),
        ...removedImages.map(id => deleteImage(id)),
        ...removedAudios.map(id => deleteAudio(id)),
      ]);

      handleCancel();
    } 
    catch (error) 
    {
      console.error("Error saving note:", error);
    }
  };

  // Cancel popup
  const handleCancel = () => 
  {
    setShowPopup(false);
    setCurrentText('');
    setCurrentTags([]);
    setIsPinned(false);
    setCurrentVideos([]);
    setCurrentNote(null);
    setCurrentImages([]);
    setEditingIndex(null);
    setEditingArchived(false);
    setRemovedAudios([]);
    setRemovedVideos([]);
    setRemovedImages([]);
  };

  // Open popup for new or existing note
  const openPopup = async (noteIndex = null, isArchived = false) => 
  {
    try 
    {
      if (noteIndex === null) 
      {
        // New note
        const newNoteId = `note_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        setCurrentText('');
        setCurrentTags([]);
        setIsPinned(false);
        setCurrentVideos([]);
        setCurrentNote({ id: newNoteId });
        setCurrentImages([]);
        setEditingIndex(null);
        setEditingArchived(false);
      } 
      else 
      {
        // Edit existing note
        const note = isArchived ? archived[noteIndex] : notes[noteIndex];
        setCurrentText(note.content || '');
        setCurrentTags(note.tags || []);
        setIsPinned(!!note.pinned);
        setEditingIndex(noteIndex);
        setEditingArchived(isArchived);
        setCurrentNote(note);
        
        // Load images
        const loadedImages = await Promise.all(
          (note.images || []).map(async (id) => 
          {
            const blob = await getImage(id);
            if (blob instanceof Blob) 
            {
              return { id, url: URL.createObjectURL(blob) };
            } 
            else 
            {
              console.warn(`Image not found or invalid for id: ${id}`);
              return null;
            }
          })
        );
        setCurrentImages(loadedImages.filter(Boolean));

        // Load videos
        const videos = await Promise.all(
          (note.videos || []).map(async (v) => 
          {
            const blob = await getVideo(v.id);
            const url = blob ? URL.createObjectURL(blob) : '';
            return { id: v.id, url };
          })
        );
        setCurrentVideos(videos);

        // Load audios
        const loadedAudios = await Promise.all(
          (note.audios || []).map(async (a) => 
          {
            try 
            {
              const blob = await getAudio(a.id);
              const url = blob ? URL.createObjectURL(blob) : '';
              return { id: a.id, url, name: a.name || "" };
            } 
            catch (err) 
            {
              return null;
            }
          })
        );
        setAudioList(loadedAudios.filter(Boolean));
      }
      setShowPopup(true);
    } 
    catch (error) 
    {
      console.error("Error opening popup:", error);
    }
  };

  // Archive note
  const archiveNote = async (noteObj) => 
  {
    try 
    {
      if (!noteObj?.id) 
      {
        console.warn("Cannot archive note without a valid ID:", noteObj);
        return;
      }

      const updatedNotes = notes.filter(n => n.id !== noteObj.id);
      const updatedArchived = [...archived, { ...noteObj, pinned: false }];

      setNotes(updatedNotes);
      setArchived(updatedArchived);
      saveNotesToStorage(updatedNotes, updatedArchived);
    } 
    catch (error) 
    {
      console.error("Error archiving note:", error);
    }
  };

  // Restore note from archive
  const restoreNote = async (index) => 
  {
    try 
    {
      const restored = await normalizeWithVideos(archived[index]);
      const updatedNotes = [...notes, restored];
      const updatedArchived = archived.filter((_, i) => i !== index);

      setNotes(updatedNotes);
      setArchived(updatedArchived);
      saveNotesToStorage(updatedNotes, updatedArchived);
    } 
    catch (error) 
    {
      console.error("Error restoring note:", error);
    }
  };

  // Delete archived note permanently
  const deleteArchive = async (idx) => 
  {
    try 
    {
      const noteToDelete = archived[idx];
      
      // Delete associated videos
      if (noteToDelete.videos) 
      {
        await Promise.all(noteToDelete.videos.map(v => deleteVideo(v.id)));
      }
      
      // Delete associated images
      if (noteToDelete.images) 
      {
        await Promise.all(noteToDelete.images.map(id => deleteImage(id)));
      }
      
      const updatedArchived = archived.filter((_, i) => i !== idx);
      setArchived(updatedArchived);
      saveNotesToStorage(notes, updatedArchived);
    } 
    catch (error) 
    {
      console.error("Error deleting archived note:", error);
    }
  };

  // Filter notes
  const filteredNotes = notes.filter(note => 
  {
    const content = note?.content || "";
    const tags = Array.isArray(note?.tags) ? note.tags : [];

    const contentMatch = content.toLowerCase().includes(searchTerm.toLowerCase());
    const tagMatch = tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const tagFilterMatch = !activeTagFilter || tags.includes(activeTagFilter);
    
    return (contentMatch || tagMatch) && tagFilterMatch;
  });

  const filteredArchived = archived.filter(note => 
  {
    const content = note?.content || "";
    const tags = Array.isArray(note?.tags) ? note.tags : [];
    
    const contentMatch = content.toLowerCase().includes(searchTerm.toLowerCase());
    const tagMatch = tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const tagFilterMatch = !activeTagFilter || tags.includes(activeTagFilter);
    
    return (contentMatch || tagMatch) && tagFilterMatch;
  });

  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const otherNotes = filteredNotes.filter(n => !n.pinned);

  return (
    <div>
      <div className="top-bar">
      {/* Header */}
      <header className="app-header">
        <h1>ClipNote</h1>
      </header>
      
      {!showPopup && (
        <i 
          className="fa-solid fa-bars menu-toggle-icon" 
          onClick={() => setShowNav(p => !p)}
        ></i>
      )}
      {!showPopup && showNav && (
        <div className="nav-bar">
          <button onClick={() => 
          {
            pinnedRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShowNav(false);
          }}>
            Pinned
          </button>
          <button onClick={() => 
          {
            allRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShowNav(false);
          }}>
            All
          </button>
          <button onClick={() => 
          {
            archivedRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShowNav(false);
          }}>
            Archived
          </button>
        </div>
      )}
      </div>
      <div className="container">
        {/* Search Bar and Tag Filter */}
        <div className="search-wrapper">
          <div className="search-inner">
            <input
              id="searchInput"
              type="text"
              placeholder="Search notes/tags..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <span className="clear-icon" onClick={() => setSearchTerm('')}>
                &times;
              </span>
            )}
            </div>
          {/* Active Tag Filter Banner */}
          {activeTagFilter && (
            <div className="tag-filter-banner">
              <span>Filtering by tag: <b>{activeTagFilter}</b></span>
              <button onClick={() => setActiveTagFilter(null)}>Clear</button>
            </div>
          )}
        </div>
        {/* Pinned Notes Section */}
        <h2 ref={pinnedRef} className="section-heading">Pinned Notes</h2>
        <div id="pinnedGrid">
          {pinnedNotes.map((note, i) => (
            <NoteCard
              key={`pinned-${note.id || i}`}
              note={note}
              onClick={() => openPopup(notes.findIndex(n => n.id === note.id), false)}
              onArchive={() => archiveNote(note)} 
              onTagClick={tag => setActiveTagFilter(tag)}
            />
          ))}
        </div>

        {/* All Notes Section */}
        <h2 ref={allRef} className="section-heading">All Notes</h2>
        <div className="grid-wrapper">
          <div id="notesGrid">
            {otherNotes.map((note, i) => (
              <NoteCard
                key={`note-${note.id || i}`}
                note={note}
                onClick={() => openPopup(notes.findIndex(n => n.id === note.id), false)}
                onArchive={() => archiveNote(note)}
                onTagClick={tag => setActiveTagFilter(tag)}
              />
            ))}
            
            {/* Add New Note Button */}
            <div className="add-btn" onClick={() => openPopup(null, false)}>
              <i className="fas fa-plus plus-icon"></i>
            </div>
          </div>

          {/* Archived Notes Section */}
          <h2 ref={archivedRef} className="section-heading">Archived Notes</h2>
          <div id="archiveGrid">
            {filteredArchived.map((note, i) => (
              <NoteCard
                key={`archived-${note.id || i}`}
                note={note}
                archived
                onClick={() => openPopup(i, true)}
                onDelete={() => 
                {
                  setDeleteIndex(i);
                  setShowConfirm(true);
                }}
                onRestore={() => restoreNote(i)}
                onTagClick={tag => setActiveTagFilter(tag)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Note Editing Popup */}
      {showPopup && (
        <Popup
          text={currentText}
          tags={currentTags}
          pinned={isPinned}
          onText={setCurrentText}
          onTags={setCurrentTags}
          onTogglePin={() => setIsPinned(!isPinned)}
          onSave={handleSave}
          onCancel={handleCancel}
          archived={editingArchived}
          videos={currentVideos}
          setVideos={setCurrentVideos}
          currentNote={currentNote}
          currentImages={currentImages}
          handleImageUpload={handleImageUpload}
          handleImageDelete={handleImageDelete}
          setAudioList={setAudioList} 
          fullscreenImage={fullscreenImage}
          setFullscreenImage={setFullscreenImage}
          audioList={audioList}
          handleAudioDelete={handleAudioDelete}
          isRecording={isRecording}
          startRecording={startRecording}
          stopRecording={stopRecording}
          setRemovedVideos={setRemovedVideos}
        />
      )}

      {/* Confirm Delete Popup */}
      {showConfirm && (
        <div id="confirmOverlay" className="show" onClick={() => setShowConfirm(false)}>
          <div className="popup-box" onClick={e => e.stopPropagation()}>
            <p>Are you sure you want to permanently delete this note?</p>
            <div className="popup-buttons">
              <button
                onClick={() => 
                {
                  deleteArchive(deleteIndex);
                  setShowConfirm(false);
                }}
              >
                Yes, Delete
              </button>
              <button onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );  
}