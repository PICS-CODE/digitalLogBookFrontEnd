import Swal from "sweetalert2";
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
  BookOpen,
} from "lucide-react";
import { PLRCLogo } from "./Logo";
import { api } from "../services/api";
import { EResources } from "./EResources";

const RESERVATION_TIME_OPTIONS = [
  "AM (8:00 AM - 12:00 PM)",
  "PM (1:00 PM - 5:00 PM)",
  "Full Day (8:00 AM - 5:00 PM)",
];

// Every room uses the times configured in Superadmin Room Settings. Older
// rooms without a saved configuration retain the standard booking periods.
const getReservationTimeOptions = (room, roomSettings) => {
  const configuredRoom = roomSettings.find((item) => item.name === room);
  return configuredRoom?.timeSlots?.length
    ? configuredRoom.timeSlots
    : RESERVATION_TIME_OPTIONS;
};

const loadSavedRoomTimeSlots = () => {
  try {
    return JSON.parse(localStorage.getItem("plrc_rooms") || "[]");
  } catch (_) {
    return [];
  }
};
// Keep the client portal on the same selectable booking periods as the
// admin/superadmin reservation form.
const usesReservationTimeDropdown = () => true;

const usesFirstComeFirstServedSlots = (room) =>
  room === "Discussion Room (BIWAG)" || room === "Discussion Room (MALANA)";

const isActiveReservation = (reservation) =>
  reservation.status === "PENDING" || reservation.status === "APPROVED";

const DEFAULT_ROOMS = [
  "Discussion Room (BIWAG)",
  "Discussion Room (MALANA)",
  "Conference Room",
  "Ubag Cinema",
  "Multimedia Room",
].map((name) => ({ name, enabled: true, disabledReason: "" }));

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
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [resDate, setResDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

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
  const [reservationPage, setReservationPage] = useState(1);
  const reservationsRowsPerPage = 10;
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState([]);
  const [roomSettings, setRoomSettings] = useState(DEFAULT_ROOMS);

  // Local storage calendar state (for custom closed days from admin)
  const [blockedDays, setBlockedDays] = useState({});

  useEffect(() => {
    Promise.all([api.blockedDays.list(), api.settings.get()]).then(([days, settings]) => {
      setBlockedDays(Object.fromEntries(days.map((day) => [day.date, { status: day.status, reason: day.reason }])));
      const savedRooms = loadSavedRoomTimeSlots();
      setRoomSettings(settings.rooms.map((room) => {
        const savedRoom = savedRooms.find((item) => item.name === room.name);
        return room.timeSlots?.length || !savedRoom?.timeSlots?.length
          ? room
          : { ...room, timeSlots: savedRoom.timeSlots };
      }));
    }).catch((error) => console.warn("Unable to load reservation settings.", error));
  }, []);

  const notificationReadStorageKey = loggedInClient
    ? `plrc_read_notifications_${loggedInClient.id || loggedInClient.rfid}`
    : "";
  const notificationDeletedStorageKey = loggedInClient
    ? `plrc_deleted_notifications_${loggedInClient.id || loggedInClient.rfid}`
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

  useEffect(() => {
    if (!notificationDeletedStorageKey) return;
    const saved = localStorage.getItem(notificationDeletedStorageKey);
    if (saved) {
      try {
        setDeletedNotificationIds(JSON.parse(saved));
      } catch (_) {
        setDeletedNotificationIds([]);
      }
    } else {
      setDeletedNotificationIds([]);
    }
  }, [notificationDeletedStorageKey]);

  // Load reservations helper
  const loadReservations = async () => {
    if (!loggedInClient) return;
    try {
      const allRes = await api.reservations.list();
      setAllReservations(allRes);
      setMyReservations(allRes.filter((r) => r.userId === loggedInClient.id || r.name.toLowerCase() === `${loggedInClient.givenName} ${loggedInClient.lastName}`.toLowerCase()));
    } catch (error) { console.error("Failed to load reservations", error); }
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

  // Pull the current superadmin room configuration whenever the client opens
  // the reservation screen, so BIWAG/MALANA time slots stay synchronized.
  useEffect(() => {
    if (activeTab !== "reservation") return;
    api.settings.get()
      .then((settings) => {
        const savedRooms = loadSavedRoomTimeSlots();
        setRoomSettings(settings.rooms.map((room) => {
          const savedRoom = savedRooms.find((item) => item.name === room.name);
          return room.timeSlots?.length || !savedRoom?.timeSlots?.length
            ? room
            : { ...room, timeSlots: savedRoom.timeSlots };
        }));
      })
      .catch((error) => console.warn("Unable to refresh room time slots.", error));
  }, [activeTab]);

  const orderedMyReservations = myReservations
    .map((reservation, index) => ({ reservation, index }))
    .sort((a, b) => {
      if (!a.reservation.createdAt || !b.reservation.createdAt) {
        return a.reservation.createdAt
          ? -1
          : b.reservation.createdAt
            ? 1
            : a.index - b.index;
      }
      return (
        new Date(b.reservation.createdAt).getTime() -
        new Date(a.reservation.createdAt).getTime()
      );
    })
    .map(({ reservation }) => reservation);

  const reservationTotalPages = Math.max(
    1,
    Math.ceil(orderedMyReservations.length / reservationsRowsPerPage),
  );
  const paginatedMyReservations = orderedMyReservations.slice(
    (reservationPage - 1) * reservationsRowsPerPage,
    reservationPage * reservationsRowsPerPage,
  );
  const selectedRoomTimeSlots = getReservationTimeOptions(selectedRoom, roomSettings);

  useEffect(() => {
    setReservationPage((page) => Math.min(page, reservationTotalPages));
  }, [reservationTotalPages]);

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
  const approvedReservationNotifications = myReservations.filter(
    (reservation) => reservation.status === "APPROVED",
  );
  const getRejectedNotificationId = (reservation) =>
    `rejected-${reservation.id}-${reservation.rejectedAt || ""}`;
  const getApprovedNotificationId = (reservation) =>
    `approved-${reservation.id}-${reservation.approvedAt || ""}`;
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
  const deleteNotification = (notificationId) => {
    const updated = [...deletedNotificationIds, notificationId];
    setDeletedNotificationIds(updated);
    if (notificationDeletedStorageKey) {
      localStorage.setItem(notificationDeletedStorageKey, JSON.stringify(updated));
    }
  };
  const visibleRejectedReservationNotifications = rejectedReservationNotifications.filter(
    (reservation) => !deletedNotificationIds.includes(getRejectedNotificationId(reservation)),
  );
  const visibleApprovedReservationNotifications = approvedReservationNotifications.filter(
    (reservation) => !deletedNotificationIds.includes(getApprovedNotificationId(reservation)),
  );
  const notificationIds = [
    ...(deletedNotificationIds.includes("account-activation") ? [] : ["account-activation"]),
    ...visibleRejectedReservationNotifications.map(getRejectedNotificationId),
    ...visibleApprovedReservationNotifications.map(getApprovedNotificationId),
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
    setResDate(new Date().toISOString().split("T")[0]);
    setResSlot("");
    setSelectedRoom("[Choose Option Below]");
    setAttendeeCount("");
    setResPurpose("");
    setReservationFile(null);
    setReservationFileInputKey((current) => current + 1);
  };

  // Cancel reservation request
  const handleCancelReservation = async (resId) => {
    const result = await Swal.fire({
      title: "Cancel booking request?",
      text: "Are you sure you want to cancel this booking request?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancel booking",
      cancelButtonText: "Keep booking",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!result.isConfirmed) {
      return;
    }
    try { const current = allReservations.find((r) => r.id === resId); await api.reservations.update({ ...current, status: "REJECTED" }); await loadReservations(); setBookingSuccess("Reservation request cancelled successfully."); setTimeout(() => setBookingSuccess(""), 5000); } catch (error) { console.error("Failed to cancel reservation", error); }
  };

  // Delete reservation request
  const handleDeleteReservation = async (resId) => {
    const result = await Swal.fire({
      title: "Delete reservation record?",
      text: "Are you sure you want to delete this reservation record?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Keep record",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!result.isConfirmed) {
      return;
    }
    try {
        await api.reservations.remove(resId);
        await loadReservations();

        if (editingResId === resId) {
          handleCancelEdit();
        }

        setBookingSuccess("Reservation deleted successfully.");
        setTimeout(() => setBookingSuccess(""), 5000);
    } catch (error) { console.error("Failed to delete reservation", error); }
  };

  // Handle local profile changes simulation
  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!clientInfo) return;
    try { const saved = await api.users.update(clientInfo); setClientInfo(saved); alert("Profile details synchronized successfully with Provincial registry!"); } catch (error) { alert(`Unable to save profile: ${error.message}`); }
  };

  // Create or Update client reservation request
  const handleRequestBooking = async (e) => {
    e.preventDefault();
    if (!clientInfo) return;

    if (selectedRoom === "[Choose Option Below]" || !selectedRoom) {
      alert("Please select a Room option.");
      return;
    }

    const selectedRoomSettings = roomSettings.find((room) => room.name === selectedRoom);
    if (selectedRoomSettings && !selectedRoomSettings.enabled) {
      alert(`This room is unavailable: ${selectedRoomSettings.disabledReason || "Please choose another room."}`);
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
      !getReservationTimeOptions(selectedRoom, roomSettings).includes(resSlot)
    ) {
      alert("Please choose one of the available reservation time slots.");
      return;
    }

    if (!resPurpose.trim()) {
      alert("Please state your purpose of reservation.");
      return;
    }

    if (isReservationSlotTaken(resSlot, allReservations)) {
      alert("This BIWAG/MALANA time slot is already reserved.");
      loadReservations();
      return;
    }

    try {
      let savedReservation;

      if (editingResId) {
        // Edit mode
        const current = allReservations.find((r) => r.id === editingResId);
        savedReservation = await api.reservations.update({
          ...current,
          date: resDate,
          timeSlot: resSlot,
          purpose: resPurpose,
          room: selectedRoom,
          attendees: attendeeCount,
          attachment: reservationFile,
          status: "PENDING",
        });
        setBookingSuccess(
          "Reservation updated successfully! Awaiting review by ADMIN Staff .",
        );
        setEditingResId(null);
      } else {
        // Create new mode
        const newRes = {
          createdAt: new Date().toISOString(),
          userId: clientInfo.id,
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
        savedReservation = await api.reservations.create(newRes);
        setBookingSuccess(
          "Reservation submitted successfully! Awaiting review by ADMIN Staff.",
        );
      }

      if (savedReservation) {
        setAllReservations((current) =>
          editingResId
            ? current.map((reservation) =>
                reservation.id === savedReservation.id
                  ? savedReservation
                  : reservation,
              )
            : [savedReservation, ...current],
        );
      }
      await loadReservations();

      // Clear state inputs only after the database confirms the save.
      setResPurpose("");
      setSelectedRoom("[Choose Option Below]");
      setAttendeeCount("");
      setResSlot("");
      setReservationFile(null);
      setReservationFileInputKey((current) => current + 1);
      setTimeout(() => setBookingSuccess(""), 5000);
    } catch (error) {
      console.error("Failed to save reservation", error);
      setBookingSuccess("");
      alert(`Unable to save reservation: ${error.message}`);
    }
  };

  // Calendar Helpers
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCalendarDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCalendarDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDayIndex = getFirstDayOfMonth(calendarYear, calendarMonth);
  const calendarRows = [];

  // Padding days before the first of the month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarRows.push(null);
  }
  // Active dates
  for (let i = 1; i <= daysInMonth; i++) {
    calendarRows.push(i);
  }
  // Padding days to form exact grids of 7 columns
  while (calendarRows.length % 7 !== 0) {
    calendarRows.push(null);
  }

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
        className={`${sidebarOpen ? "w-full lg:w-64" : "w-full lg:w-20"} bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col pt-3 lg:pt-6 pb-2 lg:pb-4 shrink-0 transition-all duration-300`}
      >
        {/* Core title branding */}
        <div className="flex items-center gap-3 px-4 sm:px-6 mb-4 lg:mb-8 overflow-hidden">
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
        <nav className="flex-1 flex lg:block gap-1.5 overflow-x-auto px-3 sm:px-4 pb-1 lg:pb-0 lg:space-y-1.5 focus:outline-none [scrollbar-width:thin]">
          <button
            onClick={() => setActiveTab("information")}
            className={`min-w-max lg:w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
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
            className={`min-w-max lg:w-full flex items-center justify-between px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
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
            className={`min-w-max lg:w-full flex items-center justify-between px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
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
            onClick={() => setActiveTab("e-resources")}
            className={`min-w-max lg:w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "e-resources"
                ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
            }`}
          >
            <BookOpen size={16} />
            {sidebarOpen && <span>E-Resources</span>}
          </button>

          <button
            onClick={onLogout}
            className="min-w-max lg:w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer uppercase tracking-wider mt-0 lg:mt-6"
          >
            <LogOut size={16} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </nav>

        {/* Current profile status strip bottom */}
        {sidebarOpen && (
          <div className="hidden lg:block mt-auto px-6 pt-4 border-t border-slate-100 text-left">
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
        <div className="bg-white border-b border-gray-200 py-3 sm:py-4 px-4 sm:px-6 flex justify-between items-center gap-3 select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-slate-100 rounded-lg lg:block hidden cursor-pointer"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-850 tracking-tight uppercase">
                CLIENT PORTAL 
              </h1>
              <p className="hidden sm:block text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">
                Home / Resources / Portal
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs font-mono font-bold text-slate-500 shrink-0">
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
        <div className="min-w-0 flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          {/* ========================================================= */}
          {/* TAB: INFORMATION (PROFILE + ACCESS CARD PREVIEW) */}
          {/* ========================================================= */}
          {activeTab === "information" && (
            <div className="space-y-6">
              {/* SIDE-BY-SIDE ACCESS CARD AND PASSCODE PREVIEWS */}
              <div className="flex w-full min-w-0 flex-col xl:flex-row items-center xl:items-stretch justify-center gap-6">
                
                {/* ACCORDION/PREVIEW: THE HIGH-FIDELITY OFFICIAL ACCREDITED PLRC ACCESS CARD */}
                <div className="relative w-full min-w-0 max-w-[580px] aspect-[1.58/1] min-h-0 bg-white rounded-2xl shadow-xl border border-slate-300/80 overflow-hidden flex flex-col p-2 sm:p-4 select-none text-slate-900 transition-transform duration-300 sm:hover:scale-[1.01]">
                  {/* ID Background Image */}
                  <img 
                    src="/images/id-card.png" 
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
                  <div className="flex min-w-0 items-center justify-between border-b border-blue-100 pb-2 mb-2 bg-transparent relative z-20">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-blue-50 scale-90 border border-slate-100">
                      <img
                        src="/images/cplr.png"
                        alt="Seal"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="text-center flex-1 min-w-0 px-1 select-none">
                      <div className="text-[7.5px] font-mono tracking-widest text-[#1E3A8A] uppercase font-bold leading-none">
                        Republic of the Philippines
                      </div>
                      <div className="text-[8px] font-mono tracking-widest text-emerald-850 font-black uppercase leading-tight mt-0.5">
                        Province of Cagayan
                      </div>
                        <div className="text-[8px] sm:text-[12px] font-sans text-[#1D4ED8] tracking-tight font-black leading-tight">
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
                  <div className="flex-1 min-h-0 flex gap-2 sm:gap-4 items-stretch relative z-20">
                    {/* Left side: Client profile photo inside exact frame */}
                    <div className="w-[22%] max-w-32 h-auto aspect-[3/4] bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden flex flex-col items-center justify-center relative shrink-0 sm:w-28 md:w-32">
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
                    <div className="flex-1 min-w-0 min-h-0 flex flex-col justify-around text-slate-800 text-[clamp(7px,2.3vw,9px)] sm:text-[11px] font-bold py-1 px-0.5 sm:p-2.5 rounded-xl overflow-hidden">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="text-[clamp(6px,2vw,8px)] sm:text-[15px] uppercase tracking-wider font-mono text-slate-500 w-20 sm:w-24 shrink-0 whitespace-nowrap">
                          LAST NAME
                        </span>
                        <div className="flex flex-1 items-start gap-1 min-w-0 text-slate-950 font-black">
                          <span className="text-blue-600">▶</span>
                          <span className="min-w-0 uppercase text-[clamp(7px,2.3vw,9px)] sm:text-[15px] tracking-wide break-words [overflow-wrap:anywhere]">
                            {clientInfo.lastName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="text-[clamp(6px,2vw,8px)] sm:text-[15px] uppercase tracking-wider font-mono text-slate-500 w-20 sm:w-24 shrink-0 whitespace-nowrap">
                          FIRST NAME
                        </span>
                        <div className="flex flex-1 items-start gap-1 min-w-0 text-slate-950 font-black">
                          <span className="text-blue-600">▶</span>
                          <span className="min-w-0 uppercase text-[clamp(7px,2.3vw,9px)] sm:text-[15px] tracking-wide break-words [overflow-wrap:anywhere]">
                            {clientInfo.givenName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-1 min-w-0">
                        <span className="text-[clamp(6px,2vw,8px)] sm:text-[15px] uppercase tracking-wider font-mono text-slate-500 w-20 sm:w-24 shrink-0 whitespace-nowrap">
                          MIDDLE NAME
                        </span>
                        <div className="flex flex-1 items-start gap-1.5 min-w-0 text-slate-950 font-black">
                          <span className="text-blue-600">▶</span>
                          <span className="min-w-0 uppercase text-[clamp(7px,2.3vw,9px)] sm:text-[15px] tracking-wide break-words [overflow-wrap:anywhere]">
                            {clientInfo.middleName || "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="text-[clamp(6px,2vw,8px)] sm:text-[15px] uppercase tracking-wider font-mono text-slate-500 w-20 sm:w-24 shrink-0 whitespace-nowrap">
                          BIRTHDAY
                        </span>
                        <div className="flex flex-1 items-start gap-1 min-w-0 text-slate-950 font-bold">
                          <span className="text-blue-600">▶</span>
                          <span className="min-w-0 uppercase text-[clamp(7px,2.3vw,9px)] sm:text-[15px] tracking-wide break-words [overflow-wrap:anywhere]">
                            {clientInfo.birthday || "YYYY-MM-DD"}
                          </span>
                        </div>
                      </div>

                       <div className="flex items-start gap-1.5 min-w-0">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[clamp(6px,2vw,9px)] sm:text-[15px] uppercase tracking-wider font-mono text-slate-500">
                            ADDRESS 
                          </span>

                          <div className="flex items-start gap-1 min-w-0 text-slate-950 font-medium">
                            <span className="text-blue-600">▶</span>

                            <span className="min-w-0 uppercase tracking-wide text-[clamp(7px,2.3vw,9px)] sm:text-[15px] leading-tight break-words [overflow-wrap:anywhere]">
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
                    <div className="h-6 flex items-center justify-center tracking-[px] opacity-85 select-none scale-y-110">
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
                <div className="w-full min-w-0 box-border bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
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
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
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
              <div className="xl:col-span-1 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
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
                <div className="bg-slate-50/50 p-2 sm:p-4 rounded-xl border border-blue-50/50 mb-5 text-center">
                  {/* Calendar controller */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={handlePrevMonth}
                      type="button"
                      className="w-8 h-8 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-extrabold text-sm flex items-center justify-center transition-all cursor-pointer shadow-sm select-none"
                    >
                      ‹
                    </button>
                    <span className="font-extrabold text-sm text-[#1D4ED8]">
                      {monthNames[calendarMonth]} {calendarYear}
                    </span>
                    <button
                      onClick={handleNextMonth}
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
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5 select-none">
                    {calendarRows.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="aspect-square" />;
                      }

                      const formattedDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dayDate = new Date(calendarYear, calendarMonth, day);
                      const isPast = dayDate < today;
                      const isSelected = resDate === formattedDate;

                      // Check for admin blocked dates
                      const blockObj = blockedDays[formattedDate];
                      const isBlocked = blockObj && blockObj.status === "closed";
                      const isHoliday = blockObj && blockObj.status === "holiday";
                      const isToday = dayDate.getTime() === today.getTime();

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
                            className={`aspect-square flex items-center justify-center rounded-lg text-[10px] sm:text-[11px] cursor-not-allowed transition-all ${bgClass}`}
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
                          className={`aspect-square flex items-center justify-center rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
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
                      {roomSettings.map((room) => (
                        <option key={room.name} value={room.name} disabled={!room.enabled}>
                          {room.enabled
                            ? room.name
                            : `${room.name} — Unavailable: ${room.disabledReason || "Unavailable"}`}
                        </option>
                      ))}
                    </select>
                    {roomSettings.some((room) => !room.enabled) && (
                      <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">
                        <span className="font-black uppercase">Unavailable rooms: </span>
                        {roomSettings
                          .filter((room) => !room.enabled)
                          .map((room) => `${room.name} (${room.disabledReason || "Unavailable"})`)
                          .join(" · ")}
                      </div>
                    )}
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

                  {/* TIME SLOT OPTION — mirrors the admin/superadmin schedule */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Time
                    </label>
                    {usesReservationTimeDropdown(selectedRoom) ? (
                      <>
                        <select
                          value={resSlot}
                          onChange={(e) => setResSlot(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select Time</option>
                          {selectedRoomTimeSlots.map((slot) => {
                            const isTaken = isReservationSlotTaken(slot);
                            return (
                              <option key={slot} value={slot} disabled={isTaken}>
                                {slot}
                                {isTaken ? " - Reserved" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </>
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
              <div className="xl:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
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
                        paginatedMyReservations.map((res) => {
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

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="font-mono">
                    Showing {myReservations.length === 0 ? 0 : (reservationPage - 1) * reservationsRowsPerPage + 1}
                    {" - "}
                    {Math.min(reservationPage * reservationsRowsPerPage, myReservations.length)}
                    {" of "}
                    {myReservations.length} reservations
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReservationPage((page) => Math.max(1, page - 1))}
                      disabled={reservationPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-slate-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                    >
                      Previous
                    </button>
                    <span className="font-mono font-bold text-slate-700">
                      Page {reservationPage} / {reservationTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReservationPage((page) => Math.min(reservationTotalPages, page + 1))}
                      disabled={reservationPage === reservationTotalPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-slate-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-105 p-3.5 rounded-xl text-left mt-5 flex gap-2.5 items-start">
                  <HelpCircle
                    size={16}
                    className="text-blue-600 shrink-0 mt-0.5"
                  />
                  <div className="text-[11px] leading-relaxed text-slate-600 font-medium">
                    Please bring your physical **CPLRC ACCESS CARD ** on your
                    scheduled booking day . Bookings are approved instantly or
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
            <div className="max-w-2xl mx-auto bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 text-left">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 flex items-center justify-between">
                <span>Account Notifications</span>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {unreadNotificationsCount} Unread
                </span>
              </h2>

              <div className="space-y-4">
                {visibleRejectedReservationNotifications.map((reservation) => {
                  const notificationId = getRejectedNotificationId(reservation);
                  const isRead = isNotificationRead(notificationId);

                  return (
                  <div
                    key={notificationId}
                    onClick={() => markNotificationAsRead(notificationId)}
                    role="button"
                    tabIndex={0}
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
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteNotification(notificationId);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-md transition-colors"
                      title="Delete notification"
                      aria-label="Delete rejected reservation notification"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  );
                })}

                {visibleApprovedReservationNotifications.map((reservation) => {
                  const notificationId = getApprovedNotificationId(reservation);
                  const isRead = isNotificationRead(notificationId);

                  return (
                    <div
                      key={notificationId}
                      onClick={() => markNotificationAsRead(notificationId)}
                      role="button"
                      tabIndex={0}
                      className={`w-full text-left p-4 border-l-4 rounded-r-xl flex items-start gap-3 transition-all ${
                        isRead
                          ? "bg-slate-50 border-slate-200 opacity-75"
                          : "bg-emerald-50/70 border-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 mt-2 ${
                          isRead ? "bg-slate-300" : "bg-emerald-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-850">
                          Reservation Request Approved
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
                          has been approved.
                        </p>
                        <span className="text-[9px] font-mono text-slate-400 block mt-2">
                          {reservation.approvedAt
                            ? new Date(reservation.approvedAt).toLocaleString()
                            : "Staff Desk"} - Staff Desk
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteNotification(notificationId);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors"
                        title="Delete notification"
                        aria-label="Delete approved reservation notification"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}

                {/* 1. Account registration notice */}
                {!deletedNotificationIds.includes("account-activation") && <div
                  onClick={() => markNotificationAsRead("account-activation")}
                  role="button"
                  tabIndex={0}
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
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteNotification("account-activation");
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                    title="Delete notification"
                    aria-label="Delete account activation notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>}
              </div>
            </div>
          )}

          {activeTab === "e-resources" && <EResources />}
        </div>
      </div>
    </div>
  );
};
