/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Bell,
  LogOut,
  User as UserIcon,
  Menu,
  HelpCircle,
  Activity,
  Edit,
  Trash2,
  XCircle,
  Lock,
} from "lucide-react";
import { PLRCLogo } from "./Logo";

const RESERVATION_TIME_OPTIONS = [
  "7:30am-8:30am",
  "8:30am-9:30am",
  "9:30am-10:30am",
  "10:30am-11:30am",
  "11:30am-12:30pm",
  "12:30pm-1:30pm",
  "1:30pm-2:30pm",
  "2:30pm-3:30pm",
  "3:30pm-4:30pm",
  "4:30pm-5:30pm",
  "5:30pm-6:30pm",
];

const usesReservationTimeDropdown = (room) =>
  room === "Ubag Cinema" ||
  room === "Discussion Room (BIWAG)" ||
  room === "Discussion Room (MALANA)";

const usesFirstComeFirstServedSlots = (room) =>
  room === "Discussion Room (BIWAG)" || room === "Discussion Room (MALANA)";

const isActiveReservation = (reservation) =>
  reservation.status === "PENDING" || reservation.status === "APPROVED";

const readReservationFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result,
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const ClientDashboard = ({ users, loggedInClient, onLogout }) => {
  const [activeTab, setActiveTab] = useState("information");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Client local states
  const [clientInfo, setClientInfo] = useState(loggedInClient);
  // Schedule state
  const [resDate, setResDate] = useState("2026-05-23");
  const [resSlot, setResSlot] = useState("");
  const [resPurpose, setResPurpose] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("[Choose Option Below]");
  const [attendeeCount, setAttendeeCount] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [editingResId, setEditingResId] = useState(null);
  const [reservationFile, setReservationFile] = useState(null);
  const [reservationFileInputKey, setReservationFileInputKey] = useState(0);

  // Local reservation list
  const [myReservations, setMyReservations] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState([]);

  // Local storage calendar state (for custom closed days from admin)
  const [blockedDays, setBlockedDays] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem("plrc_blocked_days");
    if (saved) {
      try {
        setBlockedDays(JSON.parse(saved));
      } catch (_) {}
    }
  }, []);

  const notificationReadStorageKey = loggedInClient
    ? `plrc_read_notifications_${loggedInClient.id || loggedInClient.rfid}`
    : "";

  useEffect(() => {
    if (!notificationReadStorageKey) return;
    const saved = localStorage.getItem(notificationReadStorageKey);
    if (saved) {
      try {
        setReadNotificationIds(JSON.parse(saved));
      } catch (_) {
        setReadNotificationIds([]);
      }
    } else {
      setReadNotificationIds([]);
    }
  }, [notificationReadStorageKey]);

  // Load reservations helper
  const loadReservations = () => {
    if (!loggedInClient) return;
    const stored = localStorage.getItem("plrc_reservations");
    if (stored) {
      try {
        const allRes = JSON.parse(stored);
        setAllReservations(allRes);
        const filtered = allRes.filter(
          (r) =>
            r.name.toLowerCase() ===
            `${loggedInClient.givenName} ${loggedInClient.lastName}`.toLowerCase(),
        );
        setMyReservations(filtered);
      } catch (e) {
        console.error("Failed to load reservations", e);
      }
    } else {
      setMyReservations([]);
      setAllReservations([]);
    }
  };

  // Load reservations on load or success
  useEffect(() => {
    loadReservations();
  }, [loggedInClient, bookingSuccess]);

  useEffect(() => {
    if (activeTab === "notifications") {
      loadReservations();
    }
  }, [activeTab]);

  const isReservationSlotTaken = (slot, reservations = allReservations) =>
    usesFirstComeFirstServedSlots(selectedRoom) &&
    reservations.some(
      (reservation) =>
        reservation.id !== editingResId &&
        reservation.date === resDate &&
        reservation.room === selectedRoom &&
        reservation.timeSlot === slot &&
        isActiveReservation(reservation),
    );

  const rejectedReservationNotifications = myReservations.filter(
    (reservation) =>
      reservation.status === "REJECTED" && reservation.rejectionReason,
  );
  const getRejectedNotificationId = (reservation) =>
    `rejected-${reservation.id}-${reservation.rejectedAt || ""}`;
  const isNotificationRead = (notificationId) =>
    readNotificationIds.includes(notificationId);
  const markNotificationAsRead = (notificationId) => {
    if (isNotificationRead(notificationId)) return;
    const updated = [...readNotificationIds, notificationId];
    setReadNotificationIds(updated);
    if (notificationReadStorageKey) {
      localStorage.setItem(notificationReadStorageKey, JSON.stringify(updated));
    }
  };
  const notificationIds = [
    "account-activation",
    ...rejectedReservationNotifications.map(getRejectedNotificationId),
  ];
  const unreadNotificationsCount = notificationIds.filter(
    (notificationId) => !isNotificationRead(notificationId),
  ).length;

  const handleReservationFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setReservationFile(null);
      return;
    }

    try {
      const attachment = await readReservationFile(file);
      setReservationFile(attachment);
    } catch (error) {
      console.error("Failed to read reservation file", error);
      alert("Unable to attach this file. Please try another file.");
      e.target.value = "";
      setReservationFile(null);
    }
  };

  // Handle start editing
  const handleStartEdit = (res) => {
    if (res.status === "APPROVED") {
      alert("Approved reservations cannot be modified.");
      return;
    }
    setEditingResId(res.id);
    setResDate(res.date);
    setResSlot(res.timeSlot);
    setSelectedRoom(res.room || "[Choose Option Below]");
    setAttendeeCount(res.attendees || "");
    setResPurpose(res.purpose || "");
    setReservationFile(res.attachment || null);
    setReservationFileInputKey((current) => current + 1);
  };

  // Handle cancel editing state
  const handleCancelEdit = () => {
    setEditingResId(null);
    setResDate("2026-05-23");
    setResSlot("");
    setSelectedRoom("[Choose Option Below]");
    setAttendeeCount("");
    setResPurpose("");
    setReservationFile(null);
    setReservationFileInputKey((current) => current + 1);
  };

  // Cancel reservation request
  const handleCancelReservation = (resId) => {
    if (
      !window.confirm("Are you sure you want to cancel this booking request?")
    ) {
      return;
    }
    const stored = localStorage.getItem("plrc_reservations");
    if (stored) {
      try {
        let allRes = JSON.parse(stored);
        allRes = allRes.map((r) => {
          if (r.id === resId) {
            return { ...r, status: "REJECTED" };
          }
          return r;
        });
        localStorage.setItem("plrc_reservations", JSON.stringify(allRes));
        loadReservations();
        setBookingSuccess("Reservation request cancelled successfully.");
        setTimeout(() => setBookingSuccess(""), 5000);
      } catch (e) {
        console.error("Failed to cancel reservation", e);
      }
    }
  };

  // Delete reservation request
  const handleDeleteReservation = (resId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this reservation record?",
      )
    ) {
      return;
    }
    const stored = localStorage.getItem("plrc_reservations");
    if (stored) {
      try {
        let allRes = JSON.parse(stored);
        allRes = allRes.filter((r) => r.id !== resId);
        localStorage.setItem("plrc_reservations", JSON.stringify(allRes));
        loadReservations();

        if (editingResId === resId) {
          handleCancelEdit();
        }

        setBookingSuccess("Reservation deleted successfully.");
        setTimeout(() => setBookingSuccess(""), 5000);
      } catch (e) {
        console.error("Failed to delete reservation", e);
      }
    }
  };

  // Handle local profile changes simulation
  const handleProfileSave = (e) => {
    e.preventDefault();
    if (!clientInfo) return;
    // Save to users list in localStorage
    const storedUsers = localStorage.getItem("plrc_users");
    if (storedUsers) {
      try {
        const parsedUsers = JSON.parse(storedUsers);
        const updated = parsedUsers.map((u) =>
          u.id === clientInfo.id ? clientInfo : u,
        );
        localStorage.setItem("plrc_users", JSON.stringify(updated));
        alert(
          "Profile details synchronized successfully with Provincial registry!",
        );
      } catch (err) {}
    }
  };

  // Create or Update client reservation request
  const handleRequestBooking = async (e) => {
    e.preventDefault();
    if (!clientInfo) return;

    if (selectedRoom === "[Choose Option Below]" || !selectedRoom) {
      alert("Please select a Room option.");
      return;
    }

    if (!attendeeCount.trim()) {
      alert("Please enter or select the Number of Attendees.");
      return;
    }

    if (!resSlot.trim() || resSlot === "Select Time") {
      alert("Please enter or select a valid Time slot.");
      return;
    }

    if (
      usesReservationTimeDropdown(selectedRoom) &&
      !RESERVATION_TIME_OPTIONS.includes(resSlot)
    ) {
      alert("Please choose one of the available reservation time slots.");
      return;
    }

    if (!resPurpose.trim()) {
      alert("Please state your purpose of reservation.");
      return;
    }

    // Save to global list
    const stored = localStorage.getItem("plrc_reservations");
    let allRes = [];
    if (stored) {
      try {
        allRes = JSON.parse(stored);
      } catch (e) {}
    }

    if (isReservationSlotTaken(resSlot, allRes)) {
      alert("This BIWAG/MALANA time slot is already reserved.");
      loadReservations();
      return;
    }

    if (editingResId) {
      // Edit mode
      allRes = allRes.map((r) => {
        if (r.id === editingResId) {
          return {
            ...r,
            date: resDate,
            timeSlot: resSlot,
            purpose: resPurpose,
            room: selectedRoom,
            attendees: attendeeCount,
            attachment: reservationFile,
            status: "PENDING",
          };
        }
        return r;
      });
      localStorage.setItem("plrc_reservations", JSON.stringify(allRes));
      setBookingSuccess(
        "Reservation updated successfully! Awaiting review by Jerome Villanueva.",
      );
      setEditingResId(null);
    } else {
      // Create new mode
      const newRes = {
        id: `res-${Date.now()}`,
        name: `${clientInfo.givenName} ${clientInfo.lastName}`,
        patronType: clientInfo.patronType,
        date: resDate,
        timeSlot: resSlot,
        purpose: resPurpose,
        room: selectedRoom,
        attendees: attendeeCount,
        attachment: reservationFile,
        status: "PENDING",
      };
      allRes = [newRes, ...allRes];
      localStorage.setItem("plrc_reservations", JSON.stringify(allRes));
      setBookingSuccess(
        "Reservation submitted successfully! Awaiting review by Jerome Villanueva at Staff Desk.",
      );
    }

    // Refresh state
    loadReservations();
    // Clear state inputs
    setResPurpose("");
    setSelectedRoom("[Choose Option Below]");
    setAttendeeCount("");
    setResSlot("");
    setReservationFile(null);
    setReservationFileInputKey((current) => current + 1);
    setTimeout(() => setBookingSuccess(""), 5000);
  };

  if (!clientInfo) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-md text-slate-800">
        <Activity className="animate-spin text-blue-500 mb-4" size={32} />
        <p className="font-bold text-sm uppercase tracking-wider text-slate-500">
          Loading Client Workspace Security...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#F3F4F6] text-slate-900 font-sans antialiased text-left">
      {/* Sidebar navigation panel */}
      <div
        className={`${sidebarOpen ? "w-full lg:w-64" : "w-full lg:w-20"} bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col pt-6 pb-4 shrink-0 transition-all duration-300`}
      >
        {/* Core title branding */}
        <div className="flex items-center gap-3 px-6 mb-8 overflow-hidden">
          <PLRCLogo size={42} />
          {sidebarOpen && (
            <div>
              <span className="font-sans font-black text-[#1E3A8A] text-lg block tracking-tight leading-none">
                CPLRC
              </span>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5 tracking-wider font-bold">
                ONLINE PORTAL
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Nav buttons */}
        <nav className="flex-1 px-4 space-y-1.5 focus:outline-none">
          <button
            onClick={() => setActiveTab("information")}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "information"
                ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
            }`}
          >
            <UserIcon size={16} />
            {sidebarOpen && <span>Information</span>}
          </button>

          <button
            onClick={() => setActiveTab("reservation")}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "reservation"
                ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Calendar size={16} />
              {sidebarOpen && <span>Reservation</span>}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "notifications"
                ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Bell size={16} />
              {sidebarOpen && <span>Notifications</span>}
            </span>
            {sidebarOpen && (
              <span className="bg-blue-500 text-white text-[9px] font-mono font-black px-2 py-0.5 rounded-full">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-black text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer uppercase tracking-wider mt-6"
          >
            <LogOut size={16} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </nav>

        {/* Current profile status strip bottom */}
        {sidebarOpen && (
          <div className="mt-auto px-6 pt-4 border-t border-slate-100 text-left">
            <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">
              SECURE DIGITAL CARD
            </span>
            <span className="text-xs font-black text-slate-800 block truncate mt-1">
              {clientInfo.givenName} {clientInfo.lastName}
            </span>
          </div>
        )}
      </div>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header matching "CPLRC Online Scheduler for Room" perfectly */}
        <div className="bg-white border-b border-gray-200 py-4 px-6 flex justify-between items-center select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-slate-100 rounded-lg lg:block hidden cursor-pointer"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1 className="text-base font-black text-slate-850 tracking-tight uppercase">
                CPLRC Online Scheduler for Room
              </h1>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">
                Home / Workspace / Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono font-bold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Online Account Access</span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-slate-700 font-sans font-black">
              @{clientInfo.givenName.toLowerCase()}{" "}
              {clientInfo.lastName.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Workspace Body content */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* ========================================================= */}
          {/* TAB: INFORMATION (PROFILE + ACCESS CARD PREVIEW) */}
          {/* ========================================================= */}
          {activeTab === "information" && (
            <div className="space-y-6">
              {/* SIDE-BY-SIDE ACCESS CARD AND PASSCODE PREVIEWS */}
              <div className="flex flex-col xl:flex-row items-center xl:items-stretch justify-center gap-6">
                
                {/* ACCORDION/PREVIEW: THE HIGH-FIDELITY OFFICIAL ACCREDITED PLRC ACCESS CARD */}
                <div className="relative w-full max-w-[580px] aspect-[1.58/1] bg-white rounded-2xl shadow-xl border border-slate-300/80 overflow-hidden flex flex-col p-4 select-none text-slate-900 transition-transform duration-300 hover:scale-[1.01]">
                  {/* ID Background Image */}
                  <img 
                    src="img/id.png" 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none "
                  />
                  {/* Outer security stripe representation (The Philippine flag bar banner at top) */}
                  <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-600 via-white to-red-600 z-20" />

                  {/* Subtle seal watermark in background */}
                  <div className="absolute inset-x-0 bottom-2 opacity-5 pointer-events-none flex justify-center z-10">
                    <PLRCLogo size={180} />
                  </div>

                  {/* Header labels with seals flanking */}
                  <div className="flex items-center justify-between border-b border-blue-100 pb-2 mb-2 bg-transparent relative z-20">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-blue-50 scale-90 border border-slate-100">
                      <img
                        src="img/pgc.png"
                        alt="Seal"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="text-center flex-1 px-1 select-none">
                      <div className="text-[7.5px] font-mono tracking-widest text-[#1E3A8A] uppercase font-bold leading-none">
                        Republic of the Philippines
                      </div>
                      <div className="text-[8px] font-mono tracking-widest text-emerald-850 font-black uppercase leading-tight mt-0.5">
                        Province of Cagayan
                      </div>
                      <div className="text-[12px] font-sans text-[#1D4ED8] tracking-tight font-black leading-tight">
                        CAGAYAN PROVINCIAL LEARNING AND RESOURCE CENTER
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-blue-50 scale-95 border border-slate-100">
                      <PLRCLogo size={28} />
                    </div>
                  </div>

                  {/* ACCESS CARD blue pill badge */}
                  <div className="mx-auto bg-[#1D4ED8] text-white text-[9px] font-mono tracking-widest font-black uppercase px-5 py-0.5 rounded-full select-none mb-3 relative z-20">
                    ACCESS CARD
                  </div>

                  {/* Card Content Layout */}
                  <div className="flex-1 flex gap-4 items-stretch overflow-hidden relative z-20">
                    {/* Left side: Client profile photo inside exact frame */}
                    <div className="w-30 h-30 aspect-[3/4] bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden flex flex-col items-center justify-center relative shrink-0">
                      {clientInfo.photoUrl ? (
                        <img
                          src={clientInfo.photoUrl}
                          alt="ID Photo"
                          className="w-full h-full object-cover transition-all"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-center p-2 text-slate-400">
                          <UserIcon size={24} />
                          <span className="text-[8px] uppercase tracking-wider font-bold mt-1">
                            Photo slot
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right side: Field values with actual arrows prefixed: ▶ */}
                    <div className="flex-1 flex flex-col justify-around text-slate-800 text-[11px] font-bold py-1 min-w-0  p-2.5 rounded-xl ">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[15px] uppercase tracking-wider font-mono text-slate-500 w-24 shrink-0">
                          LAST NAME
                        </span>
                        <div className="flex items-center gap-1 truncate text-slate-950 font-black">
                          <span className="text-blue-600">▶</span>
                          <span className="uppercase text-xs tracking-wide text-[15px]">
                            {clientInfo.lastName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[15px] uppercase tracking-wider font-mono text-slate-500 w-24 shrink-0">
                          FIRST NAME
                        </span>
                        <div className="flex items-center gap-1 truncate text-slate-950 font-black">
                          <span className="text-blue-600">▶</span>
                          <span className="uppercase text-xs tracking-wide text-[15px]">
                            {clientInfo.givenName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 truncate">
                        <span className="text-[15px] uppercase tracking-wider font-mono text-slate-500 w-24 shrink-0">
                          MIDDLE NAME
                        </span>
                        <div className="flex items-center gap-1.5 truncate text-slate-950 font-black">
                          <span className="text-blue-600">▶</span>
                          <span className="uppercase text-xs tracking-wide text-[15px]">
                            {clientInfo.middleName || "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[15px] uppercase tracking-wider font-mono text-slate-500 w-24 shrink-0">
                          BIRTHDAY
                        </span>
                        <div className="flex items-center gap-1 text-slate-950 font-bold">
                          <span className="text-blue-600">▶</span>
                          <span className="uppercase text-xs tracking-wide text-[15px]">
                            {clientInfo.birthday || "YYYY-MM-DD"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                       <div className="flex flex-col">
                          <span className="text-[15px] uppercase tracking-wider font-mono text-slate-500">
                            ADDRESS 
                          </span>

                          <div className="flex items-center gap-1 text-slate-950 font-medium">
                            <span className="text-blue-600">▶</span>

                            <span className="uppercase tracking-wide text-[15px]">
                              {clientInfo.address || "cagayan valley, region ii"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card bottom: Scanning barcode representer with numeric index printing */}
                  <div className="mt-3 border-t border-slate-100 pt-1.5 flex flex-col items-center justify-center shrink-0 relative z-20">
                    {/* Replicated simulated bar lines */}
                    <div className="h-6 flex items-center justify-center tracking-[2px] opacity-85 select-none scale-y-110">
                      {"|||| | ||| |||| | | ||| || |||| | | |||| | | |||| | ||| ||||"
                        .split("")
                        .map((char, i) => (
                          <span
                            key={i}
                            className={`inline-block h-full bg-slate-900 ${
                              char === " " ? "w-[1.5px]" : "w-[3px]"
                            }`}
                          />
                        ))}
                    </div>

                    <p className="text-[9.5px] font-mono tracking-[4px] font-black text-slate-950 mt-1 uppercase text-center">
                      {clientInfo.rfid}
                    </p>
                  </div>
                </div>
              </div>

              {/* PROFILE SETUP FORM WRAPPERS */}
              <form onSubmit={handleProfileSave} className="space-y-6">
                <fieldset disabled className="space-y-6">
                {/* 1. Group Card personal information */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-sm font-black text-blue-900 tracking-wider uppercase border-b border-slate-100 pb-2 mb-4">
                    Personal Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={clientInfo.givenName}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            givenName: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Middle Name
                      </label>
                      <input
                        type="text"
                        value={clientInfo.middleName}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            middleName: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={clientInfo.lastName}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            lastName: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Email
                      </label>
                      <input
                        type="email"
                        value={clientInfo.email}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            email: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={clientInfo.phone}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            phone: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Birth Date
                      </label>
                      <input
                        type="date"
                        value={clientInfo.birthday}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            birthday: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Address
                      </label>
                      <input
                        type="text"
                        value={clientInfo.address}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            address: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        RFID NO.
                      </label>
                      <input
                        type="text"
                        value={clientInfo.rfid}
                        disabled
                        className="w-full bg-slate-100 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 font-mono outline-none cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Gender
                      </label>
                      <select
                        value={clientInfo.gender}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            gender: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Marital Status
                      </label>
                      <select
                        value={clientInfo.maritalStatus}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            maritalStatus: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Age Bracket
                      </label>
                      <input
                        type="text"
                        value={clientInfo.ageBracket}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            ageBracket: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Institution
                      </label>
                      <input
                        type="text"
                        value={clientInfo.institution}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            institution: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Patron Type
                      </label>
                      <input
                        type="text"
                        value={clientInfo.patronType}
                        disabled
                        className="w-full bg-slate-100 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 outline-none cursor-not-allowed uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Group Card Emergency contact */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-sm font-black text-blue-900 tracking-wider uppercase border-b border-slate-100 pb-2 mb-4">
                    Emergency Contact
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={clientInfo.emergencyContact?.fullName || ""}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            emergencyContact: {
                              fullName: e.target.value,
                              phone: clientInfo.emergencyContact?.phone || "",
                            },
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={clientInfo.emergencyContact?.phone || ""}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            emergencyContact: {
                              fullName:
                                clientInfo.emergencyContact?.fullName || "",
                              phone: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                </div>
                </fieldset>

                {/* Footer PGC trademark */}
                <p className="text-center text-[10px] text-gray-500 font-medium">
                  © Copyright: CPLRC - Cagayan Provincial Learning and Resource
                  Center
                </p>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: RESERVATION SCHEDULER SYSTEM */}
          {/* ========================================================= */}
          {activeTab === "reservation" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left pane: High-fidelity Room Reservation form matching screenshot */}
              <div className="xl:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                {/* Header visual */}
                <div
                  className={`flex items-center justify-between border-b pb-3 mb-4 select-none ${
                    editingResId
                      ? "border-amber-200 bg-amber-50/20 -mx-6 px-6 pt-1"
                      : "border-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                      {editingResId ? "Edit Reservation" : "Room Reservation"}
                    </h2>
                    {editingResId && (
                      <span className="bg-amber-100 text-amber-800 text-[8px] font-sans font-black px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                        Active Edit
                      </span>
                    )}
                  </div>
                  {editingResId ? (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-amber-700 hover:text-amber-900 text-[10.5px] font-bold flex items-center gap-1 transition-colors px-2 py-1 bg-amber-100/60 hover:bg-amber-100 rounded-lg cursor-pointer"
                      title="Cancel Editing and return to submit mode"
                    >
                      <XCircle size={13} className="text-amber-600" />
                      <span>Cancel Edit</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {bookingSuccess && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-semibold mb-4 leading-normal">
                    ✓ {bookingSuccess}
                  </div>
                )}

                {/* Calendar element container */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-blue-50/50 mb-5 text-center">
                  {/* Calendar controller */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-extrabold text-sm flex items-center justify-center transition-all cursor-pointer shadow-sm select-none"
                    >
                      ‹
                    </button>
                    <span className="font-extrabold text-sm text-[#1D4ED8]">
                      May 2026
                    </span>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-extrabold text-sm flex items-center justify-center transition-all cursor-pointer shadow-sm select-none"
                    >
                      ›
                    </button>
                  </div>

                  {/* Days label header */}
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10.5px] text-slate-800 mb-2 font-sans select-none">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                  </div>

                  {/* Days rendering */}
                  <div className="grid grid-cols-7 gap-1.5 select-none">
                    {/* Empty cell spacers for May 2026 (Starts on a Friday, so 5 empty spots) */}
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="aspect-square" />
                    ))}

                    {/* Days 1 to 31 */}
                    {Array.from({ length: 31 }).map((_, idx) => {
                      const day = idx + 1;
                      const formattedDate = `2026-05-${String(day).padStart(2, "0")}`;
                      const isPast = day < 23;
                      const isSelected = resDate === formattedDate;

                      // Check for admin blocked dates
                      const blockObj = blockedDays[formattedDate];
                      const isBlocked = blockObj && blockObj.status === "closed";
                      const isHoliday = blockObj && blockObj.status === "holiday";
                      const isToday = day === 23; // Static Today as per system default (May 23, 2026)

                      if (isPast || isBlocked || isHoliday || isToday) {
                        let title = "Unavailable date";
                        let bgClass = "bg-slate-200 text-slate-400";
                        
                        if (isBlocked) {
                          title = `Closed: ${blockObj.reason}`;
                          bgClass = "bg-[#F97316] text-white border border-amber-500 font-bold";
                        } else if (isHoliday) {
                          title = `Holiday: ${blockObj.reason}`;
                          bgClass = "bg-[#DC2626] text-white border border-rose-500 font-bold";
                        } else if (isToday) {
                          title = "Today - Active Access Day";
                          bgClass = "bg-[#10B981] text-white border-2 border-emerald-500 font-extrabold shadow-sm";
                        }

                        return (
                          <div
                            key={`day-${day}`}
                            className={`aspect-square flex items-center justify-center rounded-lg text-[11px] cursor-not-allowed transition-all ${bgClass}`}
                            title={title}
                          >
                            {day}
                          </div>
                        );
                      }

                      return (
                        <button
                          type="button"
                          key={`day-${day}`}
                          onClick={() => setResDate(formattedDate)}
                          className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-50 border-2 border-[#1D4ED8] text-[#1D4ED8] scale-105 shadow-inner font-extrabold"
                              : "bg-white border border-slate-200 text-slate-800 hover:bg-blue-50/[0.2] hover:border-blue-200"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-blue-600 font-bold font-mono mt-3 select-none">
                    ✓ Scheduled Date:{" "}
                    <span className="bg-[#1D4ED8] text-white px-2 py-0.5 rounded text-[10.5px] font-black">
                      {resDate}
                    </span>
                  </p>
                </div>

              {/* Calendar Legend for Client Visibility */}
              <div className="flex flex-wrap gap-4 justify-center text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 mb-5 select-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600" />
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#F97316] border border-amber-500" />
                  <span>Maintenance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#DC2626] border border-rose-500" />
                  <span>Public Holiday</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#10B981] border border-emerald-500" />
                  <span>Today</span>
                </div>
              </div>

                <form
                  onSubmit={handleRequestBooking}
                  className="space-y-4 text-left"
                >
                  {/* ROOM SELECT OPTION */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Room
                    </label>
                    <select
                      value={selectedRoom}
                      onChange={(e) => {
                        const roomVal = e.target.value;
                        setSelectedRoom(roomVal);
                        setResSlot("");
                        // conditional attendees preset limit
                        if (
                          roomVal === "Discussion Room (BIWAG)" ||
                          roomVal === "Discussion Room (MALANA)"
                        ) {
                          setAttendeeCount("3");
                        } else {
                          setAttendeeCount("");
                        }
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="[Choose Option Below]">
                        [Choose Option Below]
                      </option>
                      <option value="Discussion Room (BIWAG)">
                        Discussion Room (BIWAG)
                      </option>
                      <option value="Discussion Room (MALANA)">
                        Discussion Room (MALANA)
                      </option>
                      <option value="Conference Room">Conference Room</option>
                      <option value="Ubag Cinema">Ubag Cinema</option>
                      <option value="Multimedia Room">Multimedia Room</option>
                    </select>
                  </div>

                  {/* NUMBER OF ATTENDEES (Dropdown if BIWAG/MALANA; free text input otherwise) */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Number of Attendees
                    </label>

                    {selectedRoom === "Discussion Room (BIWAG)" ||
                    selectedRoom === "Discussion Room (MALANA)" ? (
                      <div>
                        <select
                          value={attendeeCount}
                          onChange={(e) => setAttendeeCount(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          <option value="3">3 Attendees</option>
                          <option value="4">4 Attendees</option>
                          <option value="5">5 Attendees</option>
                          <option value="6">6 Attendees</option>
                          <option value="7">7 Attendees</option>
                          <option value="8">8 Attendees</option>
                        </select>
                        <p className="text-[9.5px] text-blue-600 mt-1 font-semibold italic">
                          ℹ️ Discussion spaces are optimized for batches of 3 to
                          8 scholars.
                        </p>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Enter number of attendees"
                        value={attendeeCount}
                        onChange={(e) => setAttendeeCount(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    )}
                  </div>

                  {/* TIME SLOT OPTION */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Time
                    </label>
                    {usesReservationTimeDropdown(selectedRoom) ? (
                      <select
                        value={resSlot}
                        onChange={(e) => setResSlot(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Time</option>
                        {RESERVATION_TIME_OPTIONS.map((slot) => {
                          const isTaken = isReservationSlotTaken(slot);
                          return (
                            <option key={slot} value={slot} disabled={isTaken}>
                              {slot}
                              {isTaken ? " - Reserved" : ""}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Enter preferred time"
                        value={resSlot}
                        onChange={(e) => setResSlot(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    )}
                  </div>

                  {/* PURPOSE INPUT OPTION */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Purpose of Reservation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Dissertation thesis study on local Cagayan history"
                      value={resPurpose}
                      onChange={(e) => setResPurpose(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Attachment File
                    </label>
                    <input
                      key={reservationFileInputKey}
                      type="file"
                      onChange={handleReservationFileChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 bg-white file:mr-3 file:border-0 file:rounded-md file:bg-blue-50 file:px-3 file:py-1.5 file:text-[10px] file:font-black file:uppercase file:text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {reservationFile && (
                      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600">
                        <span className="truncate">{reservationFile.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setReservationFile(null);
                            setReservationFileInputKey((current) => current + 1);
                          }}
                          className="text-rose-600 hover:text-rose-800 uppercase tracking-wide"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-3 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-sm text-center ${
                      editingResId
                        ? "bg-amber-600 hover:bg-amber-700 shadow-md ring-2 ring-amber-300"
                        : "bg-[#1D4ED8] hover:bg-blue-800"
                    }`}
                  >
                    {editingResId
                      ? "Update Reservation"
                      : "Submit Booking Request"}
                  </button>
                </form>
              </div>

              {/* Right pane: Client reservation history index updated with Rooms + Attendees */}
              <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">
                  My Reservation Request Ledger
                </h2>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-150 text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                      <tr>
                        <th className="px-5 py-3">Scheduled Date</th>
                        <th className="px-5 py-3">Room / Space</th>
                        <th className="px-5 py-3">Attendees</th>
                        <th className="px-5 py-3">Hours Block</th>
                        <th className="px-5 py-3 text-center">System Status</th>
                        <th className="px-5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-xs text-slate-850">
                      {myReservations.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-10 text-center text-gray-400 italic"
                          >
                            You have no active or completed booking requests
                            scheduled. Submit one to start!
                          </td>
                        </tr>
                      ) : (
                        myReservations.map((res) => {
                          const isApproved = res.status === "APPROVED";
                          return (
                            <tr
                              key={res.id}
                              className="hover:bg-slate-50/70 transition-colors"
                            >
                              <td className="px-5 py-3.5 whitespace-nowrap font-mono font-bold text-slate-700">
                                {res.date}
                              </td>
                              <td className="px-5 py-3.5 font-bold text-blue-900 whitespace-nowrap opacity-90">
                                {res.room || "General Space"}
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-800">
                                {res.attendees ? (
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                                    {res.attendees} pax
                                  </span>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                              <td className="px-5 py-3.5 font-bold whitespace-nowrap text-slate-705">
                                {res.timeSlot}
                              </td>
                              <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-1 text-[9px] font-mono font-black uppercase rounded-lg tracking-wider ${
                                    res.status === "PENDING"
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : res.status === "APPROVED"
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse"
                                        : "bg-rose-100 text-rose-800 border border-rose-200"
                                  }`}
                                >
                                  {res.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-center whitespace-nowrap select-none">
                                <div className="flex items-center justify-center gap-2">
                                  {isApproved ? (
                                    <span
                                      className="p-1.5 text-slate-400 cursor-not-allowed bg-slate-100 rounded-md block"
                                      title="Approved reservations are locked from edits"
                                    >
                                      <Lock
                                        size={13}
                                        className="text-slate-450"
                                      />
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(res)}
                                      className={`p-1.5 rounded-md text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-all cursor-pointer ${
                                        editingResId === res.id
                                          ? "bg-amber-100 ring-2 ring-amber-400"
                                          : "bg-slate-50"
                                      }`}
                                      title="Edit details of this pending request"
                                    >
                                      <Edit size={13} />
                                    </button>
                                  )}

                                  {
                                    res.status === "PENDING" ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCancelReservation(res.id)
                                        }
                                        className="p-1.5 rounded-md bg-slate-50 text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-all cursor-pointer"
                                        title="Cancel reservation (marks as Rejected)"
                                      >
                                        <XCircle size={13} />
                                      </button>
                                    ) : (
                                      <span className="w-[26px]"></span>
                                    ) // Spacer placeholder to align columns perfectly
                                  }

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteReservation(res.id)
                                    }
                                    className="p-1.5 rounded-md bg-slate-50 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all cursor-pointer"
                                    title="Delete completely from your ledger register"
                                  >
                                    <Trash2 size={13} strokeWidth={2} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-blue-50/50 border border-blue-105 p-3.5 rounded-xl text-left mt-5 flex gap-2.5 items-start">
                  <HelpCircle
                    size={16}
                    className="text-blue-600 shrink-0 mt-0.5"
                  />
                  <div className="text-[11px] leading-relaxed text-slate-600 font-medium">
                    Please bring your physical **CPLRC RFID card** on your
                    scheduled booking day for rapid electronic verification on
                    the kiosk simulator. Bookings are approved instantly or
                    manually indexed by staff.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: NOTIFICATIONS FEED */}
          {/* ========================================================= */}
          {activeTab === "notifications" && (
            <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-left">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 flex items-center justify-between">
                <span>Account Notifications</span>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {unreadNotificationsCount} Unread
                </span>
              </h2>

              <div className="space-y-4">
                {rejectedReservationNotifications.map((reservation) => {
                  const notificationId = getRejectedNotificationId(reservation);
                  const isRead = isNotificationRead(notificationId);

                  return (
                  <button
                    type="button"
                    key={notificationId}
                    onClick={() => markNotificationAsRead(notificationId)}
                    className={`w-full text-left p-4 border-l-4 rounded-r-xl flex items-start gap-3 transition-all ${
                      isRead
                        ? "bg-slate-50 border-slate-200 opacity-75"
                        : "bg-rose-50/70 border-rose-600 hover:bg-rose-50"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 mt-2 ${
                        isRead ? "bg-slate-300" : "bg-rose-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-850">
                        Reservation Request Rejected
                      </p>
                      <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed">
                        Your reservation for{" "}
                        <strong className="text-slate-900">
                          {reservation.room || "CPLRC room"}
                        </strong>{" "}
                        on{" "}
                        <strong className="font-mono text-slate-900">
                          {reservation.date}
                        </strong>{" "}
                        at{" "}
                        <strong className="font-mono text-slate-900">
                          {reservation.timeSlot}
                        </strong>{" "}
                        was rejected.
                      </p>
                      <div className="mt-2 rounded-lg bg-white border border-rose-100 px-3 py-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 block mb-1">
                          Reason
                        </span>
                        <p className="text-[10.5px] font-semibold text-slate-700 leading-relaxed">
                          {reservation.rejectionReason}
                        </p>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 block mt-2">
                        {reservation.rejectedAt
                          ? new Date(reservation.rejectedAt).toLocaleString()
                          : "Staff Desk"}{" "}
                        - Staff Desk
                      </span>
                    </div>
                  </button>
                  );
                })}

                {/* 1. Account registration notice */}
                <button
                  type="button"
                  onClick={() => markNotificationAsRead("account-activation")}
                  className={`w-full text-left p-4 border-l-4 rounded-r-xl flex items-start gap-3 transition-all ${
                    isNotificationRead("account-activation")
                      ? "bg-slate-50 border-slate-200 opacity-75"
                      : "bg-blue-50/50 border-blue-600 hover:bg-blue-50"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 mt-2 ${
                      isNotificationRead("account-activation")
                        ? "bg-slate-300"
                        : "bg-blue-500 animate-ping"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-850">
                      CPLRC Profile Activation Completed
                    </p>
                    <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                      Congratulations, your digital Provincial Resource and
                      Learning Center membership account has been registered
                      successfully. You may log in online using Username:{" "}
                      <strong className="font-mono text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-black text-[10px]">
                        {clientInfo.rfid}
                      </strong>{" "}
                      and password to schedule booking spaces.
                    </p>
                    <span className="text-[9px] font-mono text-slate-400 block mt-2">
                      Just now • System Log
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
