import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";

// ── QR CODE ───────────────────────────────────────────────────────────────
function QRCodeSVG({ value, size = 200, fg = "#FFD700", bg = "#1A1A1A" }) {
  const modules = generateQR(value);
  if (!modules) return <div style={{ width: size, height: size, background: bg, borderRadius: 12 }} />;
  const n = modules.length, cell = size / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 12, display: "block" }}>
      <rect width={size} height={size} fill={bg} />
      {modules.flatMap((row, r) => row.map((on, c) => on ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={fg} /> : null))}
    </svg>
  );
}
function generateQR(str) {
  try {
    const size = 29, m = Array.from({ length: size }, () => Array(size).fill(0));
    const ss = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) m[r][c] = v; };
    const finder = (r, c) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const o = i === 0 || i === 6 || j === 0 || j === 6, inn = i >= 2 && i <= 4 && j >= 2 && j <= 4; m[r + i][c + j] = (o || inn) ? 1 : 0; } for (let k = 0; k < 8; k++) { ss(r + 7, c + k, 0); ss(r + k, c + 7, 0); } };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) { m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; }
    m[size - 8][8] = 1;
    const bits = []; bits.push(0, 1, 0, 0);
    const len = Math.min(str.length, 255);
    for (let i = 7; i >= 0; i--) bits.push((len >> i) & 1);
    for (let i = 0; i < len; i++) { const b = str.charCodeAt(i); for (let j = 7; j >= 0; j--) bits.push((b >> j) & 1); }
    bits.push(0, 0, 0, 0);
    const isRes = (r, c) => (r <= 8 && c <= 8) || (r <= 8 && c >= size - 8) || (r >= size - 8 && c <= 8) || r === 6 || c === 6 || (r === size - 8 && c === 8);
    let idx = 0, up = true;
    for (let col = size - 1; col >= 0; col -= 2) { if (col === 6) col = 5; for (let row = 0; row < size; row++) { const r = up ? size - 1 - row : row; for (let d = 0; d <= 1; d++) { const c = col - d; if (!isRes(r, c)) { const bit = idx < bits.length ? bits[idx++] : 0; m[r][c] = ((r + c) % 2 === 0) ? bit ^ 1 : bit; } } } up = !up; }
    return m;
  } catch { return null; }
}

// ── CONFETTI ──────────────────────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ["#FFD700", "#FF6B00", "#FF3B5C", "#39FF14", "#3B8BFF", "#BF5FFF", "#00E5FF", "#FF2D78"];
    const particles = Array.from({ length: 120 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * -canvas.height, r: Math.random() * 8 + 4, color: colors[Math.floor(Math.random() * colors.length)], speed: Math.random() * 3 + 2, spin: (Math.random() - 0.5) * 0.2, angle: Math.random() * Math.PI * 2, wobble: Math.random() * 0.05, wobbleSpeed: Math.random() * 0.05, shape: Math.random() > 0.5 ? "rect" : "circle" }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.speed; p.angle += p.spin; p.wobble += p.wobbleSpeed;
        const x = p.x + Math.sin(p.wobble * 10) * 5;
        ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.angle); ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - p.y / canvas.height);
        if (p.shape === "rect") { ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); } else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 500 }} />;
}

// ── STORAGE ───────────────────────────────────────────────────────────────
const DEFAULT_VRAGEN = {
  kennis: [
    { id: 1, q: "Wat is de hoofdstad van Canada?", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"], answer: 2, roundType: "kennis", track: null },
    { id: 2, q: "Hoeveel landen telt de Europese Unie?", options: ["25", "27", "29", "31"], answer: 1, roundType: "kennis", track: null },
    { id: 3, q: "Welk land heeft de meeste UNESCO werelderfgoederen?", options: ["China", "Italië", "Spanje", "Frankrijk"], answer: 1, roundType: "kennis", track: null },
    { id: 4, q: "In welk jaar landde de mens voor het eerst op de maan?", options: ["1965", "1967", "1969", "1971"], answer: 2, roundType: "kennis", track: null },
    { id: 5, q: "Wat is het snelste landdier ter wereld?", options: ["Leeuw", "Cheetah", "Pronghorn", "Gnoe"], answer: 1, roundType: "kennis", track: null },
    { id: 6, q: "Hoeveel tanden heeft een volwassen mens normaal gesproken?", options: ["28", "30", "32", "34"], answer: 2, roundType: "kennis", track: null },
    { id: 7, q: "Welke planeet is het grootst in ons zonnestelsel?", options: ["Saturnus", "Jupiter", "Neptunus", "Uranus"], answer: 1, roundType: "kennis", track: null },
    { id: 8, q: "Wie schilderde de Nachtwacht?", options: ["Vermeer", "Rubens", "Rembrandt", "Hals"], answer: 2, roundType: "kennis", track: null },
    { id: 9, q: "Wat is de langste rivier ter wereld?", options: ["Amazone", "Nijl", "Mississippi", "Yangtze"], answer: 1, roundType: "kennis", track: null },
    { id: 10, q: "In welk jaar viel de Berlijnse Muur?", options: ["1987", "1988", "1989", "1990"], answer: 2, roundType: "kennis", track: null },
  ],
  blitz: [
    { id: 11, q: "Hoeveel poten heeft een spin?", options: ["6", "8", "10", "12"], answer: 1, roundType: "blitz", track: null },
    { id: 12, q: "Wat is 12 × 12?", options: ["132", "140", "144", "148"], answer: 2, roundType: "blitz", track: null },
    { id: 13, q: "Welke kleur krijg je als je geel en blauw mengt?", options: ["Paars", "Oranje", "Groen", "Bruin"], answer: 2, roundType: "blitz", track: null },
    { id: 14, q: "Hoeveel seconden heeft een minuut?", options: ["30", "60", "90", "100"], answer: 1, roundType: "blitz", track: null },
    { id: 15, q: "Wat is de hoofdstad van België?", options: ["Antwerpen", "Gent", "Brussel", "Luik"], answer: 2, roundType: "blitz", track: null },
    { id: 16, q: "Wat heeft een zebra meer van — zwarte of witte strepen?", options: ["Zwart", "Wit", "Gelijk", "Wisselend"], answer: 0, roundType: "blitz", track: null },
    { id: 17, q: "Wat is het symbool van de Olympische Spelen 2024 Parijs?", options: ["Haan", "Marianne", "Eiffeltoren", "Leeuw"], answer: 1, roundType: "blitz", track: null },
    { id: 18, q: "Hoe heet de vrouw van koning Willem-Alexander?", options: ["Beatrix", "Máxima", "Amalia", "Catharina"], answer: 1, roundType: "blitz", track: null },
    { id: 19, q: "Wat is de snelheid van het licht (afgerond)?", options: ["200.000 km/s", "300.000 km/s", "400.000 km/s", "500.000 km/s"], answer: 1, roundType: "blitz", track: null },
    { id: 20, q: "In welk land staat de Eiffeltoren?", options: ["Italië", "Spanje", "Frankrijk", "België"], answer: 2, roundType: "blitz", track: null },
  ],
  muziek: [],
};

const saveBank = (bank) => localStorage.setItem("vibe_vragenbank", JSON.stringify(bank));
const loadBank = () => {
  const item = localStorage.getItem("vibe_vragenbank");
  if (item) {
    const saved = JSON.parse(item);
    // Merge defaults with saved — defaults first, then user additions
    return {
      kennis: [...DEFAULT_VRAGEN.kennis, ...saved.kennis.filter(q => q.id > 1000)],
      blitz: [...DEFAULT_VRAGEN.blitz, ...saved.blitz.filter(q => q.id > 1000)],
      muziek: saved.muziek || [],
    };
  }
  return { ...DEFAULT_VRAGEN };
};

// ── SPOTIFY ───────────────────────────────────────────────────────────────
const extractSpotifyId = (input) => {
  if (!input) return null;
  // Strip query params and whitespace
  const clean = input.trim().split("?")[0].split("#")[0];
  const trackMatch = clean.match(/track\/([A-Za-z0-9]+)/);
  if (trackMatch) return { type: "track", id: trackMatch[1] };
  const playlistMatch = clean.match(/playlist\/([A-Za-z0-9]+)/);
  if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };
  if (/^[A-Za-z0-9]{22}$/.test(clean)) return { type: "track", id: clean };
  return null;
};

const getAccessToken = async (clientId, clientSecret) => {
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + btoa(clientId + ":" + clientSecret) }, body: "grant_type=client_credentials" });
  if (!tokenRes.ok) throw new Error("Token mislukt — controleer je credentials.");
  const { access_token } = await tokenRes.json();
  return access_token;
};

const trackToData = (d) => ({
  id: d.id, title: d.name, artist: d.artists.map(a => a.name).join(", "),
  album: d.album.name, cover: d.album.images[0]?.url,
  previewUrl: d.preview_url, year: d.album.release_date?.slice(0, 4)
});

const fetchSpotifyTrack = async (trackId, clientId, clientSecret) => {
  const token = await getAccessToken(clientId, clientSecret);
  const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!trackRes.ok) throw new Error("Track niet gevonden.");
  return trackToData(await trackRes.json());
};

const fetchRandomFromPlaylist = async (playlistId, clientId, clientSecret) => {
  const token = await getAccessToken(clientId, clientSecret);
  // Get playlist info — geen fields filter zodat we zeker de juiste structuur krijgen
  const infoRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!infoRes.ok) throw new Error("Playlist niet gevonden. Is de playlist publiek?");
  const info = await infoRes.json();
  const total = info?.tracks?.total;
  if (!total || total === 0) throw new Error("Playlist is leeg of niet toegankelijk.");
  // Pick random offset
  const offset = Math.floor(Math.random() * total);
  const tracksRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=1&offset=${offset}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!tracksRes.ok) throw new Error("Kon tracks niet laden.");
  const data = await tracksRes.json();
  const item = data.items?.[0]?.track;
  if (!item || !item.id) throw new Error("Geen geldige track. Probeer opnieuw.");
  return {
    track: {
      id: item.id,
      title: item.name,
      artist: item.artists?.map(a => a.name).join(", ") || "Onbekend",
      album: item.album?.name || "",
      cover: item.album?.images?.[0]?.url || null,
      previewUrl: item.preview_url || null,
      year: item.album?.release_date?.slice(0, 4) || null,
    },
    playlistName: info.name,
    playlistTotal: total,
  };
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────
const EMOJIS = ["🎸", "🎺", "🥁", "🎹", "🎷", "🎻", "🎤", "🎧", "🦁", "🐯", "🦊", "🐻", "🦄", "🐙", "🦋", "🌈", "🔥", "⚡", "🍕", "🍺", "🏆", "💎", "🚀", "🎲"];
const COLORS = [{ name: "Neon Rood", value: "#FF3B5C" }, { name: "Elektrisch Blauw", value: "#3B8BFF" }, { name: "Acid Groen", value: "#39FF14" }, { name: "Hot Pink", value: "#FF2D78" }, { name: "Goud", value: "#FFD700" }, { name: "Paars", value: "#BF5FFF" }, { name: "Oranje", value: "#FF6B00" }, { name: "Cyaan", value: "#00E5FF" }];
const ROUND_TIMES = { kennis: 20, blitz: 10, muziek: 30 };
const ROUND_POINTS = { kennis: 100, blitz: 50, muziek: 200 };
const ROUND_LABELS = { kennis: { icon: "🧠", label: "Kennis", color: "#3B8BFF" }, blitz: { icon: "⚡", label: "Blitz", color: "#FFD700" }, muziek: { icon: "🎵", label: "Muziek", color: "#BF5FFF" } };

// ── STYLES ────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight: "100vh", background: "#0D0D0D", color: "#F0EDE8", fontFamily: "'Georgia',serif", position: "relative" },
  grain: { position: "fixed", inset: 0, opacity: 0.04, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, pointerEvents: "none", zIndex: 999 },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px" },
  logo: { fontSize: "clamp(48px,10vw,80px)", fontWeight: 900, letterSpacing: "0.15em", background: "linear-gradient(135deg,#FFD700,#FF6B00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 },
  logoSm: { fontSize: "30px", fontWeight: 900, letterSpacing: "0.15em", background: "linear-gradient(135deg,#FFD700,#FF6B00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 },
  card: { background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "20px", width: "100%", maxWidth: "440px", boxSizing: "border-box" },
  btn: (v = "primary", sz = "md") => ({ padding: sz === "sm" ? "8px 13px" : sz === "lg" ? "16px 24px" : "12px 20px", borderRadius: "10px", border: "none", cursor: "pointer", fontFamily: "'Georgia',serif", fontSize: sz === "sm" ? "12px" : sz === "lg" ? "17px" : "14px", fontWeight: 700, letterSpacing: "0.03em", background: v === "primary" ? "linear-gradient(135deg,#FFD700,#FF6B00)" : v === "danger" ? "#FF3B5C" : v === "ghost" ? "transparent" : "#2A2A2A", color: v === "primary" ? "#0D0D0D" : "#F0EDE8", border: v === "ghost" ? "1px solid #333" : "none", WebkitTapHighlightColor: "transparent", userSelect: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px" }),
  input: { width: "100%", padding: "11px 14px", background: "#111", border: "1px solid #333", borderRadius: "10px", color: "#F0EDE8", fontSize: "14px", fontFamily: "'Georgia',serif", boxSizing: "border-box" },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.2em", color: "#666", textTransform: "uppercase", marginBottom: "6px" },
  tag: (c) => ({ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "12px", background: c + "22", color: c, fontSize: "11px", letterSpacing: "0.1em", fontWeight: 700 }),
};

// ── ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [gameCode, setGameCode] = useState("");
  const [myTeam, setMyTeam] = useState(null);
  const [spotifyCreds] = useState({ clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || "", clientSecret: import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || "" });
  const [syncStatus, setSyncStatus] = useState("idle");
  const [vragenbank, setVragenbank] = useState(() => loadBank());

  // Game state
  const [teams, setTeams] = useState([]);
  const [gamePhase, setGamePhase] = useState("lobby");
  const [currentQ, setCurrentQ] = useState(null);
  const [answers, setAnswers] = useState({});
  const [gameOver, setGameOver] = useState(false);

  const channelRef = useRef(null);
  const isHostRef = useRef(false);
  const pendingTeamRef = useRef(null); // team waiting to be sent after subscribe

  const saveAndSetBank = (newBank) => { setVragenbank(newBank); saveBank(newBank); };

  // ── Check URL hash for QR join ──
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash.startsWith("join-")) {
      const code = hash.replace("join-", "").toUpperCase();
      setGameCode(code);
      setScreen("join");
      window.location.hash = "";
    }
  }, []);

  // ── Setup Supabase channel ──
  const setupChannel = useCallback((code, isHost) => {
    // Cleanup old channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    isHostRef.current = isHost;

    const channel = supabase.channel(`vibe-${code}`, {
      config: { broadcast: { self: false } }
    });

    if (isHost) {
      // Host: listen for joining teams and answers
      channel.on("broadcast", { event: "join_team" }, ({ payload }) => {
        console.log("Host received join_team:", payload.team);
        setTeams(prev => {
          if (prev.find(t => t.id === payload.team.id)) return prev;
          const updated = [...prev, payload.team];
          // Broadcast updated state back to all players
          setTimeout(() => {
            if (channelRef.current) {
              channelRef.current.send({
                type: "broadcast", event: "gamestate",
                payload: { teams: updated, phase: "lobby", currentQ: null, answers: {}, gameOver: false }
              });
            }
          }, 100);
          return updated;
        });
        setSyncStatus("ok");
      });

      channel.on("broadcast", { event: "answer" }, ({ payload }) => {
        setAnswers(prev => ({ ...prev, [payload.teamId]: payload.answerIdx }));
        setSyncStatus("ok");
      });

    } else {
      // Player: listen for game state from host
      channel.on("broadcast", { event: "gamestate" }, ({ payload }) => {
        setTeams(payload.teams || []);
        setGamePhase(payload.phase || "lobby");
        setCurrentQ(payload.currentQ || null);
        setAnswers(payload.answers || {});
        setGameOver(payload.gameOver || false);
        setSyncStatus("ok");
      });
    }

    channel.subscribe((status) => {
      console.log("Channel status:", status);
      if (status === "SUBSCRIBED") {
        setSyncStatus("ok");
        // If player has a pending team to send, send it now
        if (!isHost && pendingTeamRef.current) {
          console.log("Sending pending team:", pendingTeamRef.current);
          channel.send({
            type: "broadcast", event: "join_team",
            payload: { team: pendingTeamRef.current }
          });
          pendingTeamRef.current = null;
        }
      } else if (status === "CHANNEL_ERROR") {
        setSyncStatus("error");
      }
    });

    channelRef.current = channel;
    return channel;
  }, []);

  // ── Broadcast state (host only) ──
  const broadcastState = useCallback((overrides = {}) => {
    if (!channelRef.current || !isHostRef.current) return;
    channelRef.current.send({
      type: "broadcast", event: "gamestate",
      payload: {
        teams: overrides.teams ?? teams,
        phase: overrides.phase ?? gamePhase,
        currentQ: overrides.currentQ ?? currentQ,
        answers: overrides.answers ?? answers,
        gameOver: overrides.gameOver ?? gameOver,
      }
    });
  }, [teams, gamePhase, currentQ, answers, gameOver]);

  const startHost = () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setGameCode(code);
    setTeams([]); setGamePhase("lobby"); setCurrentQ(null); setAnswers({}); setGameOver(false);
    setupChannel(code, true);
    setScreen("host");
  };

  const handleJoinCode = (code) => {
    setGameCode(code);
    setupChannel(code, false);
  };

  const handleJoined = (team) => {
    setMyTeam(team);
    // Store team as pending — will be sent once channel is subscribed
    if (channelRef.current) {
      // Check if already subscribed
      pendingTeamRef.current = team;
      // Try sending immediately too (in case already subscribed)
      try {
        channelRef.current.send({
          type: "broadcast", event: "join_team",
          payload: { team }
        });
        pendingTeamRef.current = null;
      } catch (e) {
        console.log("Will send on subscribe:", e);
      }
    }
    setScreen("player");
  };

  const awardPoints = useCallback((tid, pts) => {
    setTeams(prev => {
      const updated = prev.map(t => t.id === tid ? { ...t, score: t.score + pts } : t);
      if (channelRef.current && isHostRef.current) {
        channelRef.current.send({
          type: "broadcast", event: "gamestate",
          payload: { teams: updated, phase: gamePhase, currentQ, answers, gameOver }
        });
      }
      return updated;
    });
  }, [gamePhase, currentQ, answers, gameOver]);

  const endGame = useCallback(() => {
    setGameOver(true); setGamePhase("gameover");
    broadcastState({ gameOver: true, phase: "gameover" });
  }, [broadcastState]);

  const submitAnswer = useCallback((teamId, answerIdx) => {
    if (channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "answer", payload: { teamId, answerIdx } });
    }
    setAnswers(prev => ({ ...prev, [teamId]: answerIdx }));
  }, []);

  const g = { teams, phase: gamePhase, currentQ, answers, gameOver };

  if ((screen === "host" || screen === "bigscreen" || screen === "player") && (gameOver || gamePhase === "gameover")) {
    return <EndScreen teams={teams} onRestart={() => { setTeams([]); setGamePhase("lobby"); setGameOver(false); setCurrentQ(null); setAnswers({}); setScreen("home"); }} />;
  }

  const hostProps = { code: gameCode, g, setTeams, setGamePhase, setCurrentQ, setAnswers, broadcastState, awardPoints, openBig: () => setScreen("bigscreen"), spotifyCreds, onEndGame: endGame, syncStatus, vragenbank, saveAndSetBank };

  if (screen === "home") return <Home onHost={startHost} onJoin={() => setScreen("join")} onBank={() => setScreen("bank")} />;
  if (screen === "bank") return <VragenBankScreen vragenbank={vragenbank} saveAndSetBank={saveAndSetBank} spotifyCreds={spotifyCreds} onBack={() => setScreen("home")} />;
  if (screen === "host") return <HostView {...hostProps} />;
  if (screen === "join") return <JoinView prefilledCode={gameCode} onJoinCode={handleJoinCode} onJoined={handleJoined} onBack={() => setScreen("home")} />;
  if (screen === "player") return <PlayerView myTeam={myTeam} g={g} submitAnswer={submitAnswer} />;
  if (screen === "bigscreen") return <BigScreen {...hostProps} onBack={() => setScreen("host")} />;
}

// ── HOME ──────────────────────────────────────────────────────────────────
function Home({ onHost, onJoin, onBank }) {
  return (
    <div style={S.app}><div style={S.grain} />
      <div style={S.center}>
        <div style={{ ...S.logo, marginBottom: "6px" }}>VIBE</div>
        <div style={{ fontSize: "11px", letterSpacing: "0.3em", color: "#555", marginBottom: "32px", textTransform: "uppercase" }}>Herken jij de hit? Ken jij het antwoord?</div>
        <div style={{ ...S.card, textAlign: "center" }}>
          <button style={{ ...S.btn("primary", "lg"), width: "100%", marginBottom: "10px" }} onClick={onHost}>🎮 Spel starten als host</button>
          <button style={{ ...S.btn("secondary", "lg"), width: "100%", marginBottom: "10px" }} onClick={onJoin}>📱 Joinen als speler</button>
          <button style={{ ...S.btn("ghost", "lg"), width: "100%" }} onClick={onBank}>🗂 Vragenbank beheren</button>
        </div>
      </div>
    </div>
  );
}

// ── END SCREEN ────────────────────────────────────────────────────────────
function EndScreen({ teams, onRestart }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div style={{ ...S.app, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", overflow: "hidden" }}>
      <Confetti /><div style={S.grain} />
      <div style={{ position: "relative", zIndex: 10 }}>
        <div style={{ fontSize: "clamp(48px,12vw,96px)", marginBottom: "8px" }}>🏆</div>
        <div style={{ ...S.logo, marginBottom: "4px" }}>VIBE</div>
        <div style={{ fontSize: "12px", letterSpacing: "0.2em", color: "#555", textTransform: "uppercase", marginBottom: "36px" }}>Eindstand</div>
        {winner && (
          <div style={{ background: "#1A1A1A", border: `2px solid ${winner.color}`, borderRadius: "20px", padding: "24px 32px", marginBottom: "20px", maxWidth: "380px" }}>
            <div style={{ fontSize: "52px", marginBottom: "8px" }}>{winner.emoji}</div>
            <div style={{ fontSize: "26px", fontWeight: 900, color: winner.color, marginBottom: "4px" }}>{winner.name}</div>
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "14px" }}>🎉 Winnaar!</div>
            <div style={{ fontSize: "44px", fontWeight: 900, color: winner.color }}>{winner.score} <span style={{ fontSize: "16px", color: "#555" }}>punten</span></div>
          </div>
        )}
        <div style={{ width: "100%", maxWidth: "380px", marginBottom: "28px" }}>
          {sorted.slice(1).map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 16px", background: "#1A1A1A", borderRadius: "10px", marginBottom: "7px", border: "1px solid #2A2A2A" }}>
              <span style={{ fontSize: "20px" }}>{medals[i + 1] || i + 2}</span>
              <span style={{ fontSize: "20px" }}>{t.emoji}</span>
              <span style={{ flex: 1, fontWeight: 700, color: t.color, textAlign: "left", fontSize: "14px" }}>{t.name}</span>
              <span style={{ fontWeight: 900, color: t.color, fontSize: "16px" }}>{t.score}p</span>
            </div>
          ))}
        </div>
        <button style={{ ...S.btn("primary", "lg"), minWidth: "200px" }} onClick={onRestart}>🔄 Nieuw spel</button>
      </div>
    </div>
  );
}

// ── HOST VIEW ─────────────────────────────────────────────────────────────
function HostView({ code, g, setTeams, setGamePhase, setCurrentQ, setAnswers, broadcastState, awardPoints, openBig, spotifyCreds, onEndGame, syncStatus, vragenbank, saveAndSetBank }) {
  const [tab, setTab] = useState("lobby");
  const tabs = [{ k: "lobby", label: "👥" }, { k: "control", label: "🎛" }, { k: "bank", label: "🗂" }, { k: "instellingen", label: "⚙️" }];
  return (
    <div style={{ ...S.app, paddingBottom: "70px" }}><div style={S.grain} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 0", marginBottom: "14px" }}>
        <div style={S.logoSm}>VIBE</div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <div style={{ ...S.tag(syncStatus === "ok" ? "#39FF14" : syncStatus === "error" ? "#FF3B5C" : "#FFD700"), fontSize: "10px" }}>
            {syncStatus === "ok" ? "● LIVE" : syncStatus === "error" ? "● ERR" : "● ..."}
          </div>
          <button style={S.btn("secondary", "sm")} onClick={onEndGame}>🏁</button>
          <button style={S.btn("primary", "sm")} onClick={openBig}>📺</button>
        </div>
      </div>
      <div style={{ padding: "0 16px" }}>
        {tab === "lobby" && <HostLobbyTab code={code} g={g} setTeams={setTeams} broadcastState={broadcastState} />}
        {tab === "control" && <HostControlTab g={g} setGamePhase={setGamePhase} setCurrentQ={setCurrentQ} setAnswers={setAnswers} broadcastState={broadcastState} awardPoints={awardPoints} vragenbank={vragenbank} />}
        {tab === "bank" && <InGameBankTab vragenbank={vragenbank} saveAndSetBank={saveAndSetBank} spotifyCreds={spotifyCreds} />}
        {tab === "instellingen" && <SpotifyCredsTab />}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#111", borderTop: "1px solid #222", display: "flex", zIndex: 100 }}>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, padding: "10px 4px 8px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", WebkitTapHighlightColor: "transparent", position: "relative" }}>
            <span style={{ fontSize: "20px" }}>{t.label}</span>
            <span style={{ fontSize: "9px", color: tab === t.k ? "#FFD700" : "#555", fontFamily: "Georgia,serif", textTransform: "uppercase" }}>{t.k === "lobby" ? "Lobby" : t.k === "control" ? "Besturing" : t.k === "bank" ? "Bank" : "Inst."}</span>
            {tab === t.k && <div style={{ position: "absolute", bottom: 0, width: "36px", height: "2px", background: "linear-gradient(90deg,#FFD700,#FF6B00)", borderRadius: "1px" }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── LOBBY TAB ─────────────────────────────────────────────────────────────
function HostLobbyTab({ code, g, setTeams, broadcastState }) {
  const [dName, setDName] = useState("");
  const [dColor, setDColor] = useState(COLORS[0]);
  const [dEmoji, setDEmoji] = useState(EMOJIS[0]);
  const [showQR, setShowQR] = useState(true);
  const joinUrl = `${window.location.origin}/#join-${code}`;

  const addTestTeam = () => {
    if (!dName.trim()) return;
    const t = { id: Date.now(), name: dName.trim(), color: dColor.value, emoji: dEmoji, score: 0 };
    setTeams(prev => {
      const updated = [...prev, t];
      broadcastState({ teams: updated });
      return updated;
    });
    setDName("");
  };

  return (
    <div>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "16px", marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={S.label}>Spelers joinen via</div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={S.btn(showQR ? "primary" : "ghost", "sm")} onClick={() => setShowQR(true)}>QR</button>
            <button style={S.btn(!showQR ? "primary" : "ghost", "sm")} onClick={() => setShowQR(false)}>Code</button>
          </div>
        </div>
        {showQR ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ padding: "12px", background: "#1A1A1A", borderRadius: "14px", border: "2px solid #FFD70044" }}>
              <QRCodeSVG value={joinUrl} size={170} />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "0.3em", background: "linear-gradient(135deg,#FFD700,#FF6B00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{code}</div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "56px", fontWeight: 900, letterSpacing: "0.35em", background: "linear-gradient(135deg,#FFD700,#FF6B00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{code}</div>
          </div>
        )}
      </div>

      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "16px", marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div style={S.label}>Teams ({g.teams.length})</div>
          {g.teams.length > 0 && <div style={S.tag("#39FF14")}>LIVE</div>}
        </div>
        {g.teams.length === 0
          ? <div style={{ textAlign: "center", padding: "16px", color: "#333", fontSize: "13px" }}>📱 Scan de QR code om mee te doen</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{g.teams.map(t => <TeamChip key={t.id} team={t} />)}</div>}
      </div>

      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "16px" }}>
        <div style={{ ...S.label, marginBottom: "10px" }}>Testteam toevoegen</div>
        <input style={{ ...S.input, marginBottom: "8px" }} placeholder="Teamnaam" value={dName} onChange={e => setDName(e.target.value)} />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
          {COLORS.map(c => <div key={c.value} onClick={() => setDColor(c)} style={{ width: "22px", height: "22px", borderRadius: "50%", background: c.value, cursor: "pointer", border: dColor.value === c.value ? "3px solid #fff" : "3px solid transparent" }} />)}
        </div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
          {EMOJIS.slice(0, 16).map(em => <div key={em} onClick={() => setDEmoji(em)} style={{ padding: "4px", borderRadius: "6px", cursor: "pointer", fontSize: "18px", background: dEmoji === em ? "#2A2A2A" : "transparent" }}>{em}</div>)}
        </div>
        <button style={{ ...S.btn("primary", "sm"), width: "100%" }} onClick={addTestTeam}>+ Toevoegen</button>
      </div>
    </div>
  );
}

// ── CONTROL TAB ───────────────────────────────────────────────────────────
function HostControlTab({ g, setGamePhase, setCurrentQ, setAnswers, broadcastState, awardPoints, vragenbank }) {
  const [roundType, setRoundType] = useState("kennis");
  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [timer, setTimer] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const questions = vragenbank[roundType] || [];
  const currentQ = questions[qIdx];
  const labels = ["A", "B", "C", "D"];
  const rl = ROUND_LABELS;

  const startQ = () => {
    if (!currentQ) return;
    const t = ROUND_TIMES[roundType];
    setTimer(t); setPhase("question");
    const q = { ...currentQ, roundType, qIdx, timeLeft: t };
    setCurrentQ(q); setAnswers({}); setGamePhase("question");
    broadcastState({ phase: "question", currentQ: q, answers: {} });
    if (roundType === "muziek" && currentQ.track?.previewUrl && audioRef.current) {
      audioRef.current.src = currentQ.track.previewUrl;
      audioRef.current.play().then(() => setPlaying(true)).catch(() => { });
    }
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimer(p => {
        const n = p - 1;
        setCurrentQ(prev => prev ? { ...prev, timeLeft: n } : prev);
        if (n <= 0) { clearInterval(intervalRef.current); doReveal(); }
        return n;
      });
    }, 1000);
  };

  const doReveal = () => {
    clearInterval(intervalRef.current);
    setPhase("reveal"); setGamePhase("reveal");
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false); }
    broadcastState({ phase: "reveal" });
  };

  const givePoints = () => {
    const pts = ROUND_POINTS[roundType];
    Object.entries(g.answers).forEach(([tid, ans]) => { if (parseInt(ans) === currentQ.answer) awardPoints(parseInt(tid), pts); });
    nextQ();
  };

  const nextQ = () => {
    clearInterval(intervalRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false); }
    setQIdx((qIdx + 1) % Math.max(questions.length, 1));
    setPhase("idle"); setGamePhase("lobby"); setCurrentQ(null); setAnswers({});
    broadcastState({ phase: "lobby", currentQ: null, answers: {} });
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div>
      <audio ref={audioRef} onEnded={() => setPlaying(false)} />
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "14px", marginBottom: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {["kennis", "blitz", "muziek"].map(r => (
            <button key={r} disabled={phase !== "idle"} onClick={() => { setRoundType(r); setQIdx(0); }} style={{ ...S.btn(roundType === r ? "primary" : "secondary", "sm"), textAlign: "center", opacity: phase !== "idle" ? 0.4 : 1, padding: "10px 6px", flexDirection: "column", gap: "3px" }}>
              <div style={{ fontSize: "18px" }}>{rl[r].icon}</div>
              <div style={{ fontSize: "10px" }}>{rl[r].label} ({vragenbank[r].length})</div>
            </button>
          ))}
        </div>
      </div>

      {questions.length === 0
        ? <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "20px", textAlign: "center", color: "#555", fontSize: "13px" }}>
          Geen vragen in {rl[roundType].label}bank.<br /><span style={{ color: "#444" }}>Voeg ze toe via 🗂 Bank.</span>
        </div>
        : <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "16px", marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ ...S.label, marginBottom: 0 }}>Vraag {qIdx + 1}/{questions.length}</div>
            {phase === "question" && <div style={{ fontSize: "26px", fontWeight: 900, color: "#FF6B00" }}>{timer}s</div>}
            {playing && <div style={{ ...S.tag("#39FF14"), fontSize: "10px" }}>▶ LIVE</div>}
          </div>
          {roundType === "muziek" && currentQ?.track?.cover && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#111", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
              <img src={currentQ.track.cover} alt="" style={{ width: "44px", height: "44px", borderRadius: "6px", objectFit: "cover", filter: phase === "reveal" ? "none" : "blur(6px)" }} />
              <div style={{ fontSize: "13px", color: phase === "reveal" ? "#F0EDE8" : "#333", fontWeight: 700 }}>{phase === "reveal" ? `${currentQ.track.title} — ${currentQ.track.artist}` : "Verborgen tot reveal"}</div>
            </div>
          )}
          <div style={{ fontSize: "14px", lineHeight: 1.5, marginBottom: "12px" }}>{currentQ?.q}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "14px" }}>
            {currentQ?.options?.map((opt, i) => (<div key={i} style={{ padding: "7px 10px", borderRadius: "8px", fontSize: "12px", background: phase === "reveal" && i === currentQ.answer ? "#39FF1422" : "#111", border: `1px solid ${phase === "reveal" && i === currentQ.answer ? "#39FF14" : "#2A2A2A"}`, color: phase === "reveal" && i === currentQ.answer ? "#39FF14" : "#888" }}><strong style={{ marginRight: "4px" }}>{labels[i]}.</strong>{opt}</div>))}
          </div>
          {phase === "idle" && <button style={{ ...S.btn("primary"), width: "100%" }} onClick={startQ}>▶ Start vraag</button>}
          {phase === "question" && <button style={{ ...S.btn("secondary"), width: "100%" }} onClick={doReveal}>⏹ Stop & reveal</button>}
          {phase === "reveal" && <div style={{ display: "flex", gap: "8px" }}>
            <button style={{ ...S.btn("primary"), flex: 1 }} onClick={givePoints}>✅ Punten + volgende</button>
            <button style={{ ...S.btn("secondary"), flex: 1 }} onClick={nextQ}>⏭ Skip</button>
          </div>}
        </div>
      }

      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "14px" }}>
        <div style={{ ...S.label, marginBottom: "8px" }}>Antwoorden {Object.keys(g.answers).length}/{g.teams.length}</div>
        {g.teams.length === 0 ? <div style={{ color: "#333", fontSize: "12px" }}>Geen teams.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {g.teams.map(t => {
              const ans = g.answers[t.id]; const correct = phase === "reveal" && parseInt(ans) === currentQ?.answer; const wrong = phase === "reveal" && ans !== undefined && !correct;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", borderRadius: "8px", background: "#111", border: `1px solid ${correct ? "#39FF1444" : wrong ? "#FF3B5C33" : "#1A1A1A"}` }}>
                  <span style={{ fontSize: "15px" }}>{t.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 700, color: t.color, fontSize: "12px" }}>{t.name}</span>
                  {ans !== undefined ? <span style={{ fontSize: "11px", background: correct ? "#39FF1422" : wrong ? "#FF3B5C22" : "#2A2A2A", color: correct ? "#39FF14" : wrong ? "#FF3B5C" : "#888", padding: "2px 7px", borderRadius: "5px", fontWeight: 700 }}>{labels[ans]} {correct ? "✓" : wrong ? "✗" : ""}</span> : <span style={{ color: "#333", fontSize: "11px" }}>⏳</span>}
                  <span style={{ fontSize: "10px", color: "#444" }}>{t.score}p</span>
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
}

// ── JOIN FLOW ─────────────────────────────────────────────────────────────
function JoinView({ prefilledCode, onJoinCode, onJoined, onBack }) {
  const [step, setStep] = useState(prefilledCode ? 2 : 1);
  const [inputCode, setInputCode] = useState(prefilledCode || "");
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [emoji, setEmoji] = useState(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (prefilledCode) {
      onJoinCode(prefilledCode);
    }
  }, []);

  const handleCodeSubmit = () => {
    if (!inputCode.trim()) { setErr("Vul een code in."); return; }
    onJoinCode(inputCode.toUpperCase());
    setErr(""); setStep(2);
  };

  const handleJoin = () => {
    if (!name.trim()) { setErr("Vul een teamnaam in."); return; }
    const team = { id: Date.now(), name: name.trim(), color: color.value, emoji, score: 0 };
    onJoined(team);
  };

  return (
    <div style={S.app}><div style={S.grain} />
      <div style={S.center}>
        <div style={{ ...S.logoSm, marginBottom: "24px" }}>VIBE</div>
        <div style={S.card}>
          {step === 1 && <>
            <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "14px" }}>🎮 Code invoeren</div>
            <input style={{ ...S.input, fontSize: "28px", letterSpacing: "0.35em", textAlign: "center", marginBottom: "12px" }} placeholder="XXXXX" maxLength={5} value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase())} />
            {err && <div style={{ color: "#FF3B5C", fontSize: "13px", marginBottom: "8px" }}>{err}</div>}
            <button style={{ ...S.btn("primary"), width: "100%", marginBottom: "8px" }} onClick={handleCodeSubmit}>Verder →</button>
            <button style={{ ...S.btn("secondary"), width: "100%" }} onClick={onBack}>← Terug</button>
          </>}
          {step === 2 && <>
            {prefilledCode && <div style={{ ...S.tag("#39FF14"), marginBottom: "14px", fontSize: "11px" }}>✓ Code {prefilledCode} herkend via QR</div>}
            <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "14px" }}>🏆 Maak je team aan</div>
            <label style={S.label}>Teamnaam</label>
            <input style={{ ...S.input, fontSize: "17px", marginBottom: "14px" }} placeholder="bv. De Vinylkrakers" maxLength={20} value={name} onChange={e => setName(e.target.value)} autoFocus />
            <label style={S.label}>Kleur</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>{COLORS.map(c => <div key={c.value} onClick={() => setColor(c)} style={{ width: "30px", height: "30px", borderRadius: "50%", background: c.value, cursor: "pointer", border: color.value === c.value ? "3px solid #fff" : "3px solid transparent" }} />)}</div>
            <label style={S.label}>Emoji</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "14px" }}>{EMOJIS.map(em => <div key={em} onClick={() => setEmoji(em)} style={{ padding: "5px", borderRadius: "7px", cursor: "pointer", fontSize: "22px", background: emoji === em ? "#2A2A2A" : "transparent", border: emoji === em ? "1px solid #FFD700" : "1px solid transparent" }}>{em}</div>)}</div>
            {name && <div style={{ marginBottom: "14px" }}><TeamChip team={{ name, color: color.value, emoji, score: 0 }} /></div>}
            {err && <div style={{ color: "#FF3B5C", fontSize: "13px", marginBottom: "8px" }}>{err}</div>}
            <button style={{ ...S.btn("primary", "lg"), width: "100%" }} onClick={handleJoin}>🎉 Joinen!</button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── PLAYER VIEW ───────────────────────────────────────────────────────────
function PlayerView({ myTeam, g, submitAnswer }) {
  const [answered, setAnswered] = useState(null);
  const labels = ["A", "B", "C", "D"];
  const prevPhase = useRef(g.phase);

  useEffect(() => {
    if (prevPhase.current !== "question" && g.phase === "question") setAnswered(null);
    prevPhase.current = g.phase;
  }, [g.phase]);

  const submit = idx => {
    if (answered !== null) return;
    setAnswered(idx);
    submitAnswer(myTeam.id, idx);
  };

  const me = g.teams.find(t => t.id === myTeam?.id) || myTeam;
  if (!myTeam) return null;
  if (g.gameOver || g.phase === "gameover") return <EndScreen teams={g.teams} onRestart={() => { }} />;

  return (
    <div style={S.app}><div style={S.grain} />
      <div style={S.center}>
        {g.phase === "lobby" && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: "56px", marginBottom: "8px" }}>{myTeam.emoji}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: myTeam.color, marginBottom: "4px" }}>{myTeam.name}</div>
            <div style={{ color: "#555", fontSize: "13px", marginBottom: "20px" }}>{me?.score ?? 0} punten</div>
            <div style={{ background: "#111", borderRadius: "10px", padding: "18px", color: "#444", fontSize: "13px" }}>
              ⏳ Wacht op de host...
              <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "10px" }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFD700", animation: `pulse ${0.5 + i * 0.2}s ease-in-out infinite alternate` }} />)}
              </div>
            </div>
          </div>
        )}
        {g.phase === "question" && g.currentQ && (
          <div style={{ ...S.card, maxWidth: "400px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={S.tag(ROUND_LABELS[g.currentQ.roundType]?.color || "#888")}>{ROUND_LABELS[g.currentQ.roundType]?.icon} {ROUND_LABELS[g.currentQ.roundType]?.label?.toUpperCase()}</div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#FF6B00" }}>{g.currentQ.timeLeft}s</div>
            </div>
            <div style={{ fontSize: "16px", lineHeight: 1.6, marginBottom: "18px" }}>{g.currentQ.q}</div>
            {answered !== null
              ? <div style={{ textAlign: "center", padding: "20px", background: "#111", borderRadius: "10px", color: "#FFD700", fontSize: "16px", fontWeight: 700 }}>✅ {labels[answered]} ingevoerd!<br /><span style={{ color: "#555", fontSize: "12px", fontWeight: 400 }}>Wacht op de host...</span></div>
              : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {g.currentQ.options.map((opt, i) => (
                  <button key={i} onClick={() => submit(i)} style={{ padding: "16px 10px", borderRadius: "12px", border: "1px solid #333", background: "#111", color: "#F0EDE8", cursor: "pointer", fontFamily: "'Georgia',serif", fontSize: "14px", textAlign: "left", minHeight: "64px", WebkitTapHighlightColor: "transparent" }}>
                    <span style={{ fontWeight: 900, color: "#FFD700", display: "block", marginBottom: "3px" }}>{labels[i]}</span>{opt}
                  </button>
                ))}
              </div>
            }
          </div>
        )}
        {g.phase === "reveal" && g.currentQ && (
          <div style={{ ...S.card, textAlign: "center", maxWidth: "360px" }}>
            {answered !== null && parseInt(answered) === g.currentQ.answer
              ? <><div style={{ fontSize: "60px" }}>🎉</div><div style={{ fontSize: "22px", fontWeight: 700, color: "#39FF14", marginBottom: "6px" }}>Goed!</div><div style={{ color: "#555" }}>+{ROUND_POINTS[g.currentQ.roundType]} punten</div></>
              : <><div style={{ fontSize: "60px" }}>😬</div><div style={{ fontSize: "22px", fontWeight: 700, color: "#FF3B5C", marginBottom: "6px" }}>{answered === null ? "Geen antwoord" : "Fout!"}</div><div style={{ color: "#555", fontSize: "13px" }}>Correct: {g.currentQ.options?.[g.currentQ.answer]}</div></>
            }
            <div style={{ marginTop: "16px", padding: "12px", background: "#111", borderRadius: "8px", fontSize: "20px", fontWeight: 700, color: myTeam.color }}>{me?.score ?? 0} punten</div>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{from{opacity:0.2;transform:scale(0.8)}to{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
}

// ── BIG SCREEN ────────────────────────────────────────────────────────────
function BigScreen({ code, g, onBack, onEndGame }) {
  const sorted = [...g.teams].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...g.teams.map(t => t.score), 1);
  const medals = ["🥇", "🥈", "🥉"];
  const labels = ["A", "B", "C", "D"];
  const joinUrl = `${window.location.origin}/#join-${code}`;
  if (g.gameOver || g.phase === "gameover") return <EndScreen teams={g.teams} onRestart={onBack} />;
  return (
    <div style={{ ...S.app, minHeight: "100vh" }}><div style={S.grain} />
      <div style={{ padding: "24px 36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <div style={S.logo}>VIBE</div>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            {g.phase === "question" && g.currentQ
              ? <><div style={S.tag(ROUND_LABELS[g.currentQ.roundType]?.color || "#888")}>{ROUND_LABELS[g.currentQ.roundType]?.icon} {ROUND_LABELS[g.currentQ.roundType]?.label?.toUpperCase()}</div><div style={{ fontSize: "64px", fontWeight: 900, color: "#FF6B00", lineHeight: 1 }}>{g.currentQ.timeLeft}</div></>
              : <><QRCodeSVG value={joinUrl} size={110} /><div style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "0.25em", background: "linear-gradient(135deg,#FFD700,#FF6B00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{code}</div></>
            }
          </div>
          <div style={{ display: "flex", gap: "6px", flexDirection: "column", alignItems: "flex-end" }}>
            <button style={S.btn("ghost", "sm")} onClick={onBack}>← Terug</button>
            <button style={S.btn("danger", "sm")} onClick={onEndGame}>🏁 Einde</button>
          </div>
        </div>

        {g.phase === "question" && g.currentQ && (
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "20px", marginBottom: "18px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              {g.currentQ.track?.cover && <img src={g.currentQ.track.cover} alt="" style={{ width: "80px", height: "80px", borderRadius: "8px", objectFit: "cover", filter: "blur(10px)", flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "20px", lineHeight: 1.5, marginBottom: "14px" }}>{g.currentQ.q}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
                  {g.currentQ.options?.map((opt, i) => (<div key={i} style={{ padding: "10px", borderRadius: "8px", background: "#111", border: "1px solid #2A2A2A", fontSize: "13px" }}><span style={{ fontWeight: 900, color: "#FFD700", display: "block", marginBottom: "3px" }}>{labels[i]}</span>{opt}</div>))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: "10px", color: "#444", fontSize: "12px", textAlign: "right" }}>{Object.keys(g.answers).length}/{g.teams.length} antwoorden</div>
          </div>
        )}

        {g.phase === "reveal" && g.currentQ && (
          <div style={{ background: "#1A1A1A", border: "1px solid #39FF1444", borderRadius: "16px", padding: "16px", marginBottom: "18px", textAlign: "center" }}>
            {g.currentQ.track && (<div style={{ display: "flex", gap: "14px", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>{g.currentQ.track.cover && <img src={g.currentQ.track.cover} alt="" style={{ width: "56px", height: "56px", borderRadius: "6px", objectFit: "cover" }} />}<div style={{ textAlign: "left" }}><div style={{ fontWeight: 700, fontSize: "18px" }}>{g.currentQ.track.title}</div><div style={{ color: "#888", fontSize: "13px" }}>{g.currentQ.track.artist} · {g.currentQ.track.year}</div></div></div>)}
            <div style={{ color: "#39FF14", fontSize: "13px", letterSpacing: "0.2em" }}>✓ CORRECT: {labels[g.currentQ.answer]}. {g.currentQ.options?.[g.currentQ.answer]}</div>
          </div>
        )}

        <div style={S.label}>🏆 Scorebord</div>
        {sorted.length === 0
          ? <div style={{ textAlign: "center", padding: "40px", color: "#333" }}><div style={{ fontSize: "48px", marginBottom: "10px" }}>📱</div>Scan de QR code om mee te doen!</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
            {sorted.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 22px", borderRadius: "12px", background: "#1A1A1A", border: `1px solid ${i === 0 ? t.color + "55" : "#2A2A2A"}` }}>
                <div style={{ fontSize: "24px", width: "32px", textAlign: "center" }}>{medals[i] || i + 1}</div>
                <div style={{ fontSize: "26px" }}>{t.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: t.color, marginBottom: "5px" }}>{t.name}</div>
                  <div style={{ height: "4px", background: "#111", borderRadius: "2px", overflow: "hidden" }}><div style={{ height: "100%", width: `${(t.score / maxScore) * 100}%`, background: t.color, borderRadius: "2px", transition: "width 0.8s ease" }} /></div>
                </div>
                <div style={{ fontSize: "28px", fontWeight: 900, color: t.color, minWidth: "52px", textAlign: "right" }}>{t.score}</div>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
}

// ── VRAGENBANK ────────────────────────────────────────────────────────────
function VragenBankScreen({ vragenbank, saveAndSetBank, spotifyCreds, onBack }) {
  const [activeTab, setActiveTab] = useState("kennis");
  const [editQ, setEditQ] = useState(null);
  const [showSpotify, setShowSpotify] = useState(false);
  const rl = ROUND_LABELS;
  const addQuestion = (q) => { saveAndSetBank({ ...vragenbank, [activeTab]: [...vragenbank[activeTab], { ...q, id: Date.now() }] }); setEditQ(null); setShowSpotify(false); };
  const updateQuestion = (idx, q) => { const arr = [...vragenbank[activeTab]]; arr[idx] = { ...q, id: arr[idx].id }; saveAndSetBank({ ...vragenbank, [activeTab]: arr }); setEditQ(null); };
  const deleteQuestion = (idx) => { saveAndSetBank({ ...vragenbank, [activeTab]: vragenbank[activeTab].filter((_, i) => i !== idx) }); };
  const moveQuestion = (idx, dir) => { const arr = [...vragenbank[activeTab]]; const to = idx + dir; if (to < 0 || to >= arr.length) return; [arr[idx], arr[to]] = [arr[to], arr[idx]]; saveAndSetBank({ ...vragenbank, [activeTab]: arr }); };
  return (
    <div style={{ ...S.app, paddingBottom: "20px" }}><div style={S.grain} />
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <button style={S.btn("ghost", "sm")} onClick={onBack}>←</button>
          <div style={S.logoSm}>Vragenbank</div>
          <div style={{ marginLeft: "auto", fontSize: "12px", color: "#555" }}>{Object.values(vragenbank).flat().length} vragen</div>
        </div>
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          {["kennis", "blitz", "muziek"].map(t => (<button key={t} onClick={() => { setActiveTab(t); setEditQ(null); setShowSpotify(false); }} style={{ ...S.btn(activeTab === t ? "primary" : "secondary", "sm"), flex: 1, flexDirection: "column", gap: "2px", padding: "10px 4px" }}><span style={{ fontSize: "18px" }}>{rl[t].icon}</span><span style={{ fontSize: "10px" }}>{rl[t].label} ({vragenbank[t].length})</span></button>))}
        </div>
        {editQ === null && !showSpotify && (<>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button style={{ ...S.btn("primary", "sm"), flex: 1 }} onClick={() => setEditQ("new")}>+ Nieuwe vraag</button>
            {activeTab === "muziek" && <button style={{ ...S.btn("secondary", "sm"), flex: 1 }} onClick={() => setShowSpotify(true)}>🎵 Via Spotify</button>}
          </div>
          {vragenbank[activeTab].length === 0
            ? <div style={{ textAlign: "center", padding: "40px 20px", color: "#333" }}><div style={{ fontSize: "40px", marginBottom: "12px" }}>{rl[activeTab].icon}</div><div>Nog geen vragen — voeg er een toe!</div></div>
            : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{vragenbank[activeTab].map((q, i) => (<QuestionCard key={q.id || i} q={q} i={i} total={vragenbank[activeTab].length} onEdit={() => setEditQ({ ...q, index: i })} onDelete={() => deleteQuestion(i)} onMove={dir => moveQuestion(i, dir)} />))}</div>}
        </>)}
        {(editQ === "new" || (editQ && editQ.index !== undefined)) && <QuestionForm initial={editQ === "new" ? null : editQ} type={activeTab} onSave={q => editQ === "new" ? addQuestion(q) : updateQuestion(editQ.index, q)} onCancel={() => setEditQ(null)} />}
        {showSpotify && activeTab === "muziek" && <SpotifyAdder spotifyCreds={spotifyCreds} onAdd={q => { addQuestion(q); }} onCancel={() => setShowSpotify(false)} />}
      </div>
    </div>
  );
}

function QuestionCard({ q, i, total, onEdit, onDelete, onMove }) {
  const [open, setOpen] = useState(false);
  const labels = ["A", "B", "C", "D"];
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#666", flexShrink: 0, fontWeight: 700 }}>{i + 1}</div>
        {q.track?.cover && <img src={q.track.cover} alt="" style={{ width: "36px", height: "36px", borderRadius: "5px", objectFit: "cover", flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, lineHeight: 1.4, whiteSpace: open ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.q}</div>
          {q.track && <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>{q.track.artist} · {q.track.year}</div>}
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0 }}>
          <button style={{ ...S.btn("ghost", "sm"), padding: "4px 6px", opacity: i === 0 ? 0.3 : 1 }} onClick={e => { e.stopPropagation(); onMove(-1); }}>↑</button>
          <button style={{ ...S.btn("ghost", "sm"), padding: "4px 6px", opacity: i === total - 1 ? 0.3 : 1 }} onClick={e => { e.stopPropagation(); onMove(1); }}>↓</button>
          <span style={{ fontSize: "14px", color: "#444" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && <div style={{ padding: "0 14px 14px", borderTop: "1px solid #222" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", margin: "10px 0" }}>
          {q.options?.map((opt, j) => (<div key={j} style={{ padding: "6px 10px", borderRadius: "7px", fontSize: "12px", background: j === q.answer ? "#39FF1422" : "#111", border: `1px solid ${j === q.answer ? "#39FF14" : "#222"}`, color: j === q.answer ? "#39FF14" : "#888" }}><strong>{labels[j]}.</strong> {opt}</div>))}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={{ ...S.btn("secondary", "sm"), flex: 1 }} onClick={onEdit}>✏️ Bewerken</button>
          <button style={{ ...S.btn("danger", "sm"), flex: 1 }} onClick={onDelete}>🗑 Verwijderen</button>
        </div>
      </div>}
    </div>
  );
}

function QuestionForm({ initial, type, onSave, onCancel }) {
  const [q, setQ] = useState(initial?.q || "");
  const [options, setOptions] = useState(initial?.options || ["", "", "", ""]);
  const [answer, setAnswer] = useState(initial?.answer ?? 0);
  const [err, setErr] = useState("");
  const labels = ["A", "B", "C", "D"];
  const save = () => {
    if (!q.trim()) { setErr("Vul een vraag in."); return; }
    if (options.some(o => !o.trim())) { setErr("Vul alle antwoordopties in."); return; }
    onSave({ q: q.trim(), options: options.map(o => o.trim()), answer, roundType: type, track: initial?.track || null });
  };
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "18px" }}>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "14px" }}>{initial?.q ? "Vraag bewerken" : "Nieuwe vraag"}</div>
      {initial?.track && <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#111", borderRadius: "8px", padding: "10px", marginBottom: "12px" }}>{initial.track.cover && <img src={initial.track.cover} alt="" style={{ width: "40px", height: "40px", borderRadius: "5px", objectFit: "cover" }} />}<div><div style={{ fontWeight: 700, fontSize: "13px" }}>{initial.track.title}</div><div style={{ color: "#555", fontSize: "11px" }}>{initial.track.artist} · {initial.track.year}</div></div></div>}
      <label style={S.label}>Vraag</label>
      <textarea style={{ ...S.input, minHeight: "72px", resize: "vertical", marginBottom: "14px", lineHeight: 1.5 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Typ hier je vraag..." />
      <label style={S.label}>Antwoordopties (● = correct)</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginBottom: "14px" }}>
        {options.map((opt, i) => (<div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div onClick={() => setAnswer(i)} style={{ width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${answer === i ? "#FFD700" : "#444"}`, background: answer === i ? "#FFD700" : "transparent", cursor: "pointer", flexShrink: 0 }} />
          <div style={{ width: "20px", fontSize: "12px", color: "#666", fontWeight: 700, flexShrink: 0 }}>{labels[i]}</div>
          <input style={{ ...S.input, flex: 1 }} value={opt} onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} placeholder={`Optie ${labels[i]}`} />
        </div>))}
      </div>
      {err && <div style={{ color: "#FF3B5C", fontSize: "12px", marginBottom: "10px" }}>{err}</div>}
      <div style={{ display: "flex", gap: "8px" }}>
        <button style={{ ...S.btn("primary"), flex: 1 }} onClick={save}>💾 Opslaan</button>
        <button style={{ ...S.btn("secondary"), flex: 1 }} onClick={onCancel}>Annuleren</button>
      </div>
    </div>
  );
}

function SpotifyAdder({ spotifyCreds, onAdd, onCancel }) {
  const [url, setUrl] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [track, setTrack] = useState(null); const [playing, setPlaying] = useState(false); const [qText, setQText] = useState(""); const [options, setOptions] = useState(["", "", "", ""]); const [answer, setAnswer] = useState(0); const audioRef = useRef(null);
  const [playlistInfo, setPlaylistInfo] = useState(null);

  const buildYearOptions = (yr) => {
    const pool = [yr - 3, yr - 2, yr - 1, yr, yr + 1, yr + 2].filter(y => y > 1950 && y <= new Date().getFullYear());
    const wrong = pool.filter(y => y !== yr).sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [...wrong, yr].sort(() => Math.random() - 0.5);
    setOptions(opts.map(String)); setAnswer(opts.indexOf(yr));
  };

  const lookup = async () => {
    const parsed = extractSpotifyId(url);
    if (!parsed) { setError("Geen geldige Spotify URL of ID."); return; }
    if (!spotifyCreds.clientId) { setError("Spotify credentials ontbreken."); return; }
    setLoading(true); setError(""); setTrack(null); setPlaylistInfo(null);
    try {
      if (parsed.type === "track") {
        const t = await fetchSpotifyTrack(parsed.id, spotifyCreds.clientId, spotifyCreds.clientSecret);
        setTrack(t);
        setQText(`🎵 Welk jaar verscheen "${t.title}" van ${t.artist}?`);
        if (t.year) buildYearOptions(parseInt(t.year));
      } else {
        const { track: t, playlistName, playlistTotal } = await fetchRandomFromPlaylist(parsed.id, spotifyCreds.clientId, spotifyCreds.clientSecret);
        setTrack(t); setPlaylistInfo({ name: playlistName, total: playlistTotal, id: parsed.id });
        setQText(`🎵 Welk jaar verscheen "${t.title}" van ${t.artist}?`);
        if (t.year) buildYearOptions(parseInt(t.year));
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const pickAnother = async () => {
    if (!playlistInfo) return;
    setLoading(true); setError(""); setTrack(null);
    try {
      const { track: t } = await fetchRandomFromPlaylist(playlistInfo.id, spotifyCreds.clientId, spotifyCreds.clientSecret);
      setTrack(t);
      setQText(`🎵 Welk jaar verscheen "${t.title}" van ${t.artist}?`);
      if (t.year) buildYearOptions(parseInt(t.year));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "18px" }}>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "14px" }}>🎵 Track via Spotify</div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}><input style={{ ...S.input, flex: 1, fontSize: "13px" }} placeholder="Spotify URL of track ID" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} /><button style={S.btn("primary", "sm")} onClick={lookup} disabled={loading}>{loading ? "..." : "Zoek"}</button></div>
      {error && <div style={{ color: "#FF3B5C", fontSize: "12px", marginBottom: "8px" }}>{error}</div>}
      {track && (<><div style={{ display: "flex", gap: "12px", alignItems: "center", background: "#111", borderRadius: "8px", padding: "10px", marginBottom: "12px" }}>{track.cover && <img src={track.cover} alt="" style={{ width: "52px", height: "52px", borderRadius: "6px", objectFit: "cover" }} />}<div><div style={{ fontWeight: 700, fontSize: "14px" }}>{track.title}</div><div style={{ color: "#888", fontSize: "12px" }}>{track.artist} · {track.year}</div></div>{track.previewUrl && <button style={{ ...S.btn(playing ? "danger" : "secondary", "sm"), marginLeft: "auto" }} onClick={() => { if (!audioRef.current) return; if (playing) { audioRef.current.pause(); setPlaying(false); } else { audioRef.current.play(); setPlaying(true); } }}>{playing ? "⏸" : "▶"}</button>}</div>
        {track.previewUrl && <audio ref={audioRef} src={track.previewUrl} onEnded={() => setPlaying(false)} />}
        <label style={S.label}>Vraagtekst</label><input style={{ ...S.input, fontSize: "13px", marginBottom: "10px" }} value={qText} onChange={e => setQText(e.target.value)} />
        <label style={S.label}>Opties (● = correct)</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>{options.map((opt, i) => (<div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}><div onClick={() => setAnswer(i)} style={{ width: "16px", height: "16px", borderRadius: "50%", border: `2px solid ${answer === i ? "#FFD700" : "#444"}`, background: answer === i ? "#FFD700" : "transparent", cursor: "pointer", flexShrink: 0 }} /><input style={{ ...S.input, fontSize: "12px", padding: "6px 10px" }} value={opt} onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} /></div>))}</div>
        <button style={{ ...S.btn("primary"), width: "100%", marginBottom: "8px" }} onClick={() => { if (!track || !qText.trim()) return; onAdd({ q: qText, options: options.map((o, i) => o || `Optie ${i + 1}`), answer, roundType: "muziek", track }); }}>+ Opslaan in vragenbank</button></>)}
      <button style={{ ...S.btn("secondary"), width: "100%" }} onClick={onCancel}>Annuleren</button>
    </div>
  );
}

function InGameBankTab({ vragenbank, saveAndSetBank, spotifyCreds }) {
  const [activeTab, setActiveTab] = useState("kennis"); const [showAdd, setShowAdd] = useState(false); const [showSpotify, setShowSpotify] = useState(false); const rl = ROUND_LABELS;
  const addQ = (q) => { saveAndSetBank({ ...vragenbank, [activeTab]: [...vragenbank[activeTab], { ...q, id: Date.now() }] }); setShowAdd(false); setShowSpotify(false); };
  const removeQ = (i) => { saveAndSetBank({ ...vragenbank, [activeTab]: vragenbank[activeTab].filter((_, j) => j !== i) }); };
  return (
    <div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>{["kennis", "blitz", "muziek"].map(t => (<button key={t} onClick={() => { setActiveTab(t); setShowAdd(false); setShowSpotify(false); }} style={{ ...S.btn(activeTab === t ? "primary" : "secondary", "sm"), flex: 1, flexDirection: "column", gap: "2px", padding: "8px 4px" }}><span style={{ fontSize: "16px" }}>{rl[t].icon}</span><span style={{ fontSize: "9px" }}>{rl[t].label} ({vragenbank[t].length})</span></button>))}</div>
      {!showAdd && !showSpotify && (<><div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}><button style={{ ...S.btn("primary", "sm"), flex: 1 }} onClick={() => setShowAdd(true)}>+ Vraag</button>{activeTab === "muziek" && <button style={{ ...S.btn("secondary", "sm"), flex: 1 }} onClick={() => setShowSpotify(true)}>🎵 Spotify</button>}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>{vragenbank[activeTab].length === 0 ? <div style={{ color: "#333", fontSize: "13px", textAlign: "center", padding: "20px" }}>Geen vragen</div> : vragenbank[activeTab].map((q, i) => (<div key={q.id || i} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "10px 13px", borderRadius: "10px", background: "#111", border: "1px solid #2A2A2A" }}>{q.track?.cover && <img src={q.track.cover} alt="" style={{ width: "34px", height: "34px", borderRadius: "5px", objectFit: "cover", flexShrink: 0 }} />}<div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: "12px", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.q}</div>{q.track && <div style={{ fontSize: "10px", color: "#555" }}>{q.track.artist}</div>}</div><button style={{ ...S.btn("danger", "sm"), padding: "4px 8px", fontSize: "12px" }} onClick={() => removeQ(i)}>✕</button></div>))}</div></>)}
      {showAdd && <QuestionForm initial={null} type={activeTab} onSave={addQ} onCancel={() => setShowAdd(false)} />}
      {showSpotify && <SpotifyAdder spotifyCreds={spotifyCreds} onAdd={addQ} onCancel={() => setShowSpotify(false)} />}
    </div>
  );
}

function SpotifyCredsTab() {
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "16px", padding: "20px" }}>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>⚙️ Instellingen</div>
      <div style={{ background: "#111", borderRadius: "8px", padding: "12px", fontSize: "13px", color: "#888", lineHeight: 1.7 }}>
        Spotify credentials worden geladen vanuit <code style={{ color: "#FFD700" }}>.env.local</code> (lokaal) of Vercel Environment Variables (productie).
      </div>
    </div>
  );
}

function TeamChip({ team }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 13px", borderRadius: "9px", background: "#111", border: `1px solid ${team.color}33` }}>
      <span style={{ fontSize: "20px" }}>{team.emoji}</span>
      <div><div style={{ fontWeight: 700, color: team.color, fontSize: "13px" }}>{team.name}</div><div style={{ fontSize: "11px", color: "#444" }}>{team.score} punten</div></div>
    </div>
  );
}