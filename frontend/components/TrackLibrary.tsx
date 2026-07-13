"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Library, Loader2, Music, Trash2 } from "lucide-react";
import { estimateLabel, estimateSeconds, formatDuration } from "@/lib/duration";
import KaraokePlayer from "@/components/KaraokePlayer";

const POSITION_KEY = "focusreader:pos:";

function savePosition(trackId: string, seconds: number) {
  try {
    localStorage.setItem(POSITION_KEY + trackId, String(Math.floor(seconds)));
  } catch {
    /* storage full/blocked — resume is best-effort */
  }
}

function loadPosition(trackId: string): number {
  try {
    return Number(localStorage.getItem(POSITION_KEY + trackId)) || 0;
  } catch {
    return 0;
  }
}

function clearPosition(trackId: string) {
  try {
    localStorage.removeItem(POSITION_KEY + trackId);
  } catch {
    /* ignore */
  }
}

interface Track {
  id: string;
  title: string;
  chars: number;
  speed: number;
  background: string;
  status: "processing" | "ready" | "failed";
  size_bytes: number;
  created_at: string;
}

const BACKGROUND_LABELS: Record<string, string> = {
  silence: "No background",
  brown_noise: "Brown noise",
  binaural: "Binaural",
};

export default function TrackLibrary({
  refreshSignal,
}: {
  /** Bump this value (e.g. after a generation completes) to reload the list. */
  refreshSignal: number;
}) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingText, setPlayingText] = useState<string>("");

  const openPlayer = async (id: string) => {
    setPlayingId(id);
    setPlayingText("");
    try {
      const res = await fetch(`/api/tracks/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPlayingText(data.track?.text ?? "");
      }
    } catch {
      // Karaoke text is an enhancement — audio still plays without it.
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tracks");
      if (!res.ok) return;
      const data = await res.json();
      setTracks(data.tracks);
    } catch {
      // Library is a convenience surface — fail quietly, keep whatever we had.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const handleDelete = async (id: string) => {
    setTracks((prev) => prev?.filter((t) => t.id !== id) ?? null);
    if (playingId === id) setPlayingId(null);
    clearPosition(id);
    await fetch(`/api/tracks/${id}`, { method: "DELETE" }).catch(() => load());
  };

  if (tracks === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your library...
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-600">
        Your generated tracks will appear here — they survive refresh now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-neutral-400">
        <Library className="h-4 w-4" />
        <h2 className="text-sm font-medium">Your Library</h2>
        <span className="text-xs text-neutral-600">
          ({tracks.length} ·{" "}
          {formatDuration(
            tracks.reduce((s, t) => s + estimateSeconds(t.chars, t.speed), 0)
          )}{" "}
          total)
        </span>
      </div>

      <ul className="space-y-2">
        {tracks.map((track) => (
          <li
            key={track.id}
            className="rounded-xl border border-white/10 bg-[#131619] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Music className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-200">
                    {track.title || "Untitled track"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    ≈ {estimateLabel(track.chars, track.speed)} · {track.speed}x ·{" "}
                    {BACKGROUND_LABELS[track.background] ?? track.background} ·{" "}
                    {new Date(track.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {track.status === "ready" ? (
                  <>
                    <button
                      onClick={() =>
                        playingId === track.id
                          ? setPlayingId(null)
                          : openPlayer(track.id)
                      }
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-indigo-500/50 hover:text-indigo-300"
                    >
                      {playingId === track.id
                        ? "Close"
                        : loadPosition(track.id) > 0
                          ? "Resume"
                          : "Play"}
                    </button>
                    <a
                      href={`/api/tracks/${track.id}/audio`}
                      download={`${track.title || "track"}.mp3`}
                      aria-label="Download MP3"
                      className="rounded-lg p-1.5 text-neutral-600 transition hover:text-indigo-300"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-neutral-600">
                    {track.status === "processing" ? "Saving..." : "Failed"}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(track.id)}
                  aria-label="Delete track"
                  className="rounded-lg p-1.5 text-neutral-600 transition hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {playingId === track.id && (
              <div className="mt-3">
                <KaraokePlayer
                  src={`/api/tracks/${track.id}/audio`}
                  text={playingText}
                  autoPlay
                  initialTime={loadPosition(track.id)}
                  onTime={(s) => savePosition(track.id, s)}
                  onEnded={() => clearPosition(track.id)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
