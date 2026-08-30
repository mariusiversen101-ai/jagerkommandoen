import React, { useState, useEffect } from "react";
import {
  Beer,
  Utensils,
  Snowflake,
  Calendar,
  Users,
  MapPin,
  Wind,
  Edit3,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Mountain,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  query,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

// --- INJISERER DESIGN (TAILWIND) AUTOMATISK ---
if (
  typeof document !== "undefined" &&
  !document.getElementById("tailwind-script")
) {
  const script = document.createElement("script");
  script.id = "tailwind-script";
  script.src = "https://cdn.tailwindcss.com";
  document.head.appendChild(script);
}

// --- DIN FIREBASE KONFIGURASJON ---
const firebaseConfig = {
  apiKey: "AIzaSyA4NucXC4ZouRqGHhoa5uBlbvJKZkjgiDw",
  authDomain: "jagerkommandoen-27.firebaseapp.com",
  projectId: "jagerkommandoen-27",
  storageBucket: "jagerkommandoen-27.firebasestorage.app",
  messagingSenderId: "628596295326",
  appId: "1:628596295326:web:08d6ad96830f3bad79dd8f",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- STANDARD DATA ---
const defaultSchedule = {
  torsdag: {
    id: "torsdag",
    label: "Torsdag",
    activity: {
      title: "Ankomst & Innsjekk",
      time: "18:00",
      icon: "🛬",
      desc: "Vi samles i hovedhytta for velkomst.",
    },
    food: "Hjemmelaget Lasagne m/ hvitløksbrød",
    tap: ["Pilsner (Frydenlund)", "Juicy IPA", "Mineralvann"],
  },
  fredag: {
    id: "fredag",
    label: "Fredag",
    activity: {
      title: "Felleski & Afterski",
      time: "10:00",
      icon: "⛷️",
      desc: "Oppmøte ved heisen. Afterski starter 16:00.",
    },
    food: "Taco Fiesta & Guacamole",
    tap: ["Pilsner", "Weissbier", "Gin & Tonic (kl 20:00)"],
  },
  lørdag: {
    id: "lørdag",
    label: "Lørdag",
    activity: {
      title: "Konkurranse & Bankett",
      time: "12:00",
      icon: "🏆",
      desc: "Uhøytidelig slalåmrenn. Bankettmiddag på kvelden.",
    },
    food: "3-retters: Reinsdyrsteik",
    tap: ["Pilsner", "Akevitt", "Rødvin", "Champagne"],
  },
  søndag: {
    id: "søndag",
    label: "Søndag",
    activity: {
      title: "Frokost & Utvask",
      time: "10:00",
      icon: "🧹",
      desc: "Felles frokost før vi pakker oss ut.",
    },
    food: "Egg & Bacon (Restefest)",
    tap: ["Kaffe", "Appelsinjuice", "Repareringspils"],
  },
};

// --- KOMPONENTER FLYTTET UT FOR Å FIKSE TASTATUR-FEILEN PÅ MOBIL ---
const EditableText = ({ isEditing, value, onChange, label, multiline }) => {
  if (!isEditing) return <span className="block">{value}</span>;
  return multiline ? (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border border-amber-500/30 rounded bg-[#0f2216] text-amber-50 text-sm focus:border-amber-500 focus:outline-none"
      placeholder={label}
      rows={2}
    />
  ) : (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-1 border border-amber-500/30 rounded bg-[#0f2216] text-amber-50 text-sm mb-1 focus:border-amber-500 focus:outline-none"
      placeholder={label}
    />
  );
};

const TapEditor = ({ isEditing, items, onChange }) => {
  if (!isEditing) {
    return (
      <ul className="space-y-3 relative z-10">
        {items.map((drink, idx) => (
          <li
            key={idx}
            className="flex items-center gap-3 text-sm border-b border-amber-900/30 pb-2 last:border-0 last:pb-0"
          >
            <span className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
            <span className="text-amber-50/90 font-medium tracking-wide">
              {drink}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-2 relative z-10">
      {items.map((drink, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            value={drink}
            onChange={(e) => {
              const newItems = [...items];
              newItems[idx] = e.target.value;
              onChange(newItems);
            }}
            className="flex-1 bg-[#0f2216] border border-amber-500/30 text-amber-50 text-sm p-1 rounded focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, "Ny drikke"])}
        className="text-xs bg-[#0f2216] border border-amber-500/30 hover:bg-[#1a3324] text-amber-500 px-3 py-2 rounded flex items-center gap-1"
      >
        <Plus size={12} /> Legg til
      </button>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedDayId, setSelectedDayId] = useState("torsdag");
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [scheduleData, setScheduleData] = useState(defaultSchedule);
  const [guests, setGuests] = useState([]);
  const [weather, setWeather] = useState(null);

  const [newName, setNewName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Autentisering
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Firebase Auth feil:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Database-lyttere
  useEffect(() => {
    if (!user) return;

    const unsubSchedule = onSnapshot(
      query(collection(db, "schedule")),
      (snapshot) => {
        if (snapshot.empty) {
          Object.values(defaultSchedule).forEach(async (day) => {
            await setDoc(doc(db, "schedule", day.id), day);
          });
        } else {
          const newSchedule = {};
          snapshot.forEach((doc) => {
            newSchedule[doc.id] = doc.data();
          });
          setScheduleData((prev) => ({ ...prev, ...newSchedule }));
        }
      }
    );

    const unsubGuests = onSnapshot(
      query(collection(db, "guestlist")),
      (snapshot) => {
        const list = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort(
            (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
          );
        setGuests(list);
      }
    );

    return () => {
      unsubSchedule();
      unsubGuests();
    };
  }, [user]);

  // Vær-data fra Myrkdalen
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=60.88&longitude=6.47&current=temperature_2m,wind_speed_10m,weather_code&wind_speed_unit=ms"
        );
        const data = await response.json();
        const code = data.current.weather_code;
        let condition = "Skyet";
        if (code === 0) condition = "Sol";
        if (code > 0 && code < 4) condition = "Delvis skyet";
        if (code >= 45 && code < 50) condition = "Tåke";
        if (code >= 51 && code < 60) condition = "Yr";
        if (code >= 61 && code < 70) condition = "Regn";
        if (code >= 71 && code < 80) condition = "Snø";
        if (code >= 80) condition = "Byger";

        setWeather({
          temp: Math.round(data.current.temperature_2m),
          wind: data.current.wind_speed_10m.toFixed(1),
          conditions: condition,
        });
      } catch (err) {
        console.error(err);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveDay = async (dayId, updatedData) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "schedule", dayId), updatedData, { merge: true });
    } catch (error) {
      console.error("Lagring feilet:", error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    setIsRegistering(true);
    try {
      await addDoc(collection(db, "guestlist"), {
        name: newName,
        userId: user.uid,
        timestamp: serverTimestamp(),
      });
      setNewName("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsRegistering(false);
    }
  };

  const dayData = scheduleData[selectedDayId] || defaultSchedule.torsdag;
  const updateField = (field, value) => {
    const updated = { ...dayData, [field]: value };
    setScheduleData((prev) => ({ ...prev, [selectedDayId]: updated }));
    handleSaveDay(selectedDayId, updated);
  };

  return (
    <div className="min-h-screen bg-[#0a1a12] font-sans text-gray-200 selection:bg-amber-500/30">
      {/* Top Bar */}
      <div className="bg-[#0f2216] border-b border-amber-500/10 sticky top-0 z-20 px-4 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-[#0a1a12] shadow-[0_0_10px_rgba(245,158,11,0.4)]">
            <div className="font-black text-lg tracking-tighter">JK</div>
          </div>
          <span className="font-black text-lg tracking-widest text-amber-50 uppercase">
            Jäger<span className="text-amber-500">kommandoen</span>
          </span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 pb-24">
        {/* HOMESCREEN */}
        {activeTab === "home" && (
          <div className="space-y-6 relative">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`absolute -top-14 right-0 p-2 rounded-full shadow-sm border transition-all z-50 ${
                isEditing
                  ? "bg-red-900/20 text-red-500 border-red-500/50"
                  : "bg-[#1a2f23] text-amber-500 border-amber-500/20 hover:bg-[#233d2e]"
              }`}
            >
              {isEditing ? <X size={18} /> : <Edit3 size={18} />}
            </button>

            <div
              className="flex overflow-x-auto gap-2 py-4 px-1"
              style={{ scrollbarWidth: "none" }}
            >
              {Object.values(scheduleData).map((data) => (
                <button
                  key={data.id}
                  onClick={() => setSelectedDayId(data.id)}
                  className={`flex-shrink-0 px-5 py-2 rounded text-sm font-bold uppercase tracking-wide transition-all duration-200 border ${
                    selectedDayId === data.id
                      ? "bg-amber-500 text-[#0a1a12] border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      : "bg-[#1a2f23] text-gray-400 border-transparent hover:border-amber-500/30 hover:text-gray-200"
                  }`}
                >
                  {data.label}
                </button>
              ))}
            </div>

            {/* Weather */}
            <div className="bg-gradient-to-br from-[#1a2f23] to-[#0f2216] border border-amber-500/20 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden mb-6">
              <div className="absolute top-0 right-0 opacity-5 transform translate-x-4 -translate-y-4">
                <Snowflake size={100} />
              </div>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h3 className="text-amber-500/80 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <MapPin size={12} /> Myrkdalen
                  </h3>
                  {weather ? (
                    <>
                      <div className="text-4xl font-bold mb-1 text-white tracking-tight">
                        {weather.temp}°
                      </div>
                      <p className="text-gray-400 text-sm">
                        {weather.conditions}
                      </p>
                    </>
                  ) : (
                    <div className="animate-pulse h-10 w-24 bg-white/10 rounded mt-2"></div>
                  )}
                </div>
                <div className="text-right space-y-2">
                  <div className="flex items-center justify-end gap-2 text-sm bg-[#0a1a12]/50 border border-amber-500/10 px-3 py-1 rounded-full">
                    <Wind size={14} className="text-amber-500" />
                    <span className="text-gray-300">
                      {weather ? weather.wind : "--"} m/s
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-500/50 mt-1 pr-1 uppercase tracking-widest">
                    Live
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`bg-[#1a2f23] p-6 rounded-2xl shadow-xl border transition-all ${
                isEditing
                  ? "border-amber-500 ring-1 ring-amber-500/20"
                  : "border-amber-500/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-4 text-amber-500">
                <Mountain className="w-5 h-5" />
                <h2 className="font-bold text-sm uppercase tracking-widest">
                  Dagens Oppdrag
                </h2>
              </div>
              <div className="flex gap-5 items-start">
                <div className="bg-[#0a1a12] w-14 h-14 rounded border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner text-white">
                  {isEditing ? (
                    <input
                      className="w-8 bg-transparent text-center outline-none"
                      value={dayData.activity.icon}
                      onChange={(e) =>
                        updateField("activity", {
                          ...dayData.activity,
                          icon: e.target.value,
                        })
                      }
                    />
                  ) : (
                    dayData.activity.icon
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-amber-500/80 font-bold mb-1 uppercase tracking-wide">
                    <EditableText
                      isEditing={isEditing}
                      value={dayData.activity.time}
                      onChange={(val) =>
                        updateField("activity", {
                          ...dayData.activity,
                          time: val,
                        })
                      }
                      label="Tid"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white leading-tight mb-2 tracking-tight">
                    <EditableText
                      isEditing={isEditing}
                      value={dayData.activity.title}
                      onChange={(val) =>
                        updateField("activity", {
                          ...dayData.activity,
                          title: val,
                        })
                      }
                      label="Tittel"
                    />
                  </h3>
                  <div className="text-gray-400 text-sm leading-relaxed">
                    <EditableText
                      isEditing={isEditing}
                      value={dayData.activity.desc}
                      onChange={(val) =>
                        updateField("activity", {
                          ...dayData.activity,
                          desc: val,
                        })
                      }
                      label="Beskrivelse"
                      multiline
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div
                className={`bg-[#13221a] text-gray-100 p-6 rounded-2xl border transition-all relative overflow-hidden ${
                  isEditing
                    ? "border-amber-500 ring-1 ring-amber-500/20"
                    : "border-amber-500/10"
                }`}
              >
                <div className="absolute -right-6 -bottom-6 opacity-[0.03] rotate-12">
                  <Beer size={180} />
                </div>
                <div className="flex items-center gap-2 mb-5 text-amber-500 relative z-10 border-b border-amber-500/10 pb-3">
                  <Beer size={20} />
                  <h3 className="font-bold text-sm uppercase tracking-widest">
                    På Tapp (Bar)
                  </h3>
                </div>
                <TapEditor
                  isEditing={isEditing}
                  items={dayData.tap || []}
                  onChange={(val) => updateField("tap", val)}
                />
              </div>

              <div
                className={`bg-[#1a2f23] p-5 rounded-2xl border transition-all ${
                  isEditing
                    ? "border-amber-500 ring-1 ring-amber-500/20"
                    : "border-amber-500/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-3 text-amber-600">
                  <Utensils className="w-4 h-4" />
                  <h3 className="font-bold text-xs uppercase tracking-widest text-amber-500/70">
                    Meny
                  </h3>
                </div>
                <div className="text-gray-200 font-medium text-lg leading-snug">
                  <EditableText
                    isEditing={isEditing}
                    value={dayData.food}
                    onChange={(val) => updateField("food", val)}
                    label="Dagens rett"
                    multiline
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GUESTLIST SCREEN */}
        {activeTab === "guests" && (
          <div className="space-y-6">
            <div className="bg-[#1a2f23] border border-amber-500/20 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-amber-500">
                <Users strokeWidth={2} /> Jägertroppen
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Registrer deg for tjeneste.
              </p>
              <form onSubmit={handleRegister} className="relative">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ditt kodenavn..."
                  className="w-full px-4 py-3 rounded bg-[#0a1a12] border border-amber-500/20 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newName.trim() || isRegistering}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-amber-600 hover:bg-amber-500 text-[#0a1a12] px-4 rounded font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {isRegistering ? "..." : "MELD PÅ"}
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <h3 className="text-amber-500/50 text-[10px] font-bold uppercase tracking-widest px-2 mb-3">
                Påmeldte agenter ({guests.length})
              </h3>
              {guests.length === 0 ? (
                <div className="text-center py-12 text-gray-600 bg-[#1a2f23]/50 rounded-xl border border-dashed border-gray-800">
                  Ingen agenter registrert.
                </div>
              ) : (
                guests.map((guest, index) => (
                  <div
                    key={guest.id}
                    className="bg-[#1a2f23] p-4 rounded-lg border border-amber-500/10 shadow-sm flex items-center justify-between group hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded flex items-center justify-center text-[#0a1a12] font-bold text-lg shadow-lg ${
                          ["bg-amber-500", "bg-amber-600", "bg-amber-400"][
                            index % 3
                          ]
                        }`}
                      >
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-gray-200 text-sm">
                          {guest.name}
                        </div>
                        <div className="text-[10px] text-amber-500/60 uppercase tracking-wider">
                          Klar til strid
                        </div>
                      </div>
                    </div>
                    <div className="text-amber-500/20 group-hover:text-amber-500/50 transition-colors">
                      <CheckCircle2 />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f2216] border-t border-amber-500/10 px-6 py-3 flex justify-around items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === "home"
              ? "text-amber-500 scale-105"
              : "text-gray-600 hover:text-gray-400"
          }`}
        >
          <Calendar strokeWidth={activeTab === "home" ? 2.5 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">
            Oversikt
          </span>
        </button>
        <div className="w-px h-8 bg-amber-500/10"></div>
        <button
          onClick={() => setActiveTab("guests")}
          className={`flex flex-col items-center gap-1 transition-all relative ${
            activeTab === "guests"
              ? "text-amber-500 scale-105"
              : "text-gray-600 hover:text-gray-400"
          }`}
        >
          <div className="relative">
            <Users strokeWidth={activeTab === "guests" ? 2.5 : 2} />
            {guests.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-600 text-[#0a1a12] text-[9px] font-black px-1.5 py-0.5 rounded min-w-[16px] text-center border border-[#0a1a12]">
                {guests.length}
              </span>
            )}
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">
            Troppen
          </span>
        </button>
      </div>
    </div>
  );
}
