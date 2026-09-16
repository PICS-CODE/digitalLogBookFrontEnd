/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Users,
  Search,
  Trash2,
  Pencil,
  Plus,
  Settings,
  Building,
  X,
  TrendingUp,
  FileSpreadsheet,
  Sparkles,
  Camera,
  Layers,
  Calendar,
  LogOut,
  Clock,
  Home,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Download,
  BookOpen,
} from "lucide-react";
import { SERVICE_OPTIONS } from "../data/mockData";
import { PLRCLogo } from "./Logo";
import QRCode from "qrcode";
import Swal from "sweetalert2";

import { QRRegistration } from "./QRRegistration";
import { EResourceManager } from "./EResourceManager";
import { api } from "../services/api";

const DEFAULT_DISCUSSION_ROOM_TIME_SLOTS = [
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

const STANDARD_RESERVATION_TIME_SLOTS = [
  "AM (8:00 AM - 12:00 PM)",
  "PM (1:00 PM - 5:00 PM)",
  "Full Day (8:00 AM - 5:00 PM)",
];

const getDefaultRoomTimeSlots = (roomName) =>
  roomName === "Discussion Room (BIWAG)" || roomName === "Discussion Room (MALANA)"
    ? DEFAULT_DISCUSSION_ROOM_TIME_SLOTS
    : STANDARD_RESERVATION_TIME_SLOTS;

// Every room has editable booking times. This also upgrades older saved rooms
// that did not yet have a timeSlots field.
const withRoomTimeSlots = (room) => ({
  ...room,
  timeSlots: room.timeSlots?.length ? room.timeSlots : getDefaultRoomTimeSlots(room.name),
});

const mergeRoomTimeSlots = (serverRooms, localRooms = []) =>
  serverRooms.map((room) => {
    const localRoom = localRooms.find((item) => item.name === room.name);
    return withRoomTimeSlots({
      ...room,
      timeSlots: room.timeSlots?.length ? room.timeSlots : localRoom?.timeSlots,
    });
  });

const downloadReservationAttachment = (attachment) => {
  if (!attachment?.dataUrl) return;
  const link = document.createElement("a");
  link.href = attachment.dataUrl;
  link.download = attachment.name || "reservation-attachment";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const getAreaForService = (serviceName = "") => {
  const service = serviceName.trim().toLowerCase();
  if (service.includes("qr code entrance")) return "QR Code Entrance";
  if (service.includes("wi-fi") || service.includes("wifi") || service.includes("voucher")) return "Vouchers";
  if (service.includes("charging") || service.includes("slip")) return "Charging";
  if (service.includes("ubag") || service.includes("cinema")) return "Ubag Cinema";
  if (service.includes("play")) return "Play Area";
  if (service.includes("pvao")) return "PVAO Area";
  if (service.includes("pwd")) return "PWD Area";
  if (service.includes("biwag") || service.includes("discussion room 1") || service.includes("room 1")) return "Discussion Room 1";
  if (service.includes("malana") || service.includes("discussion room 2") || service.includes("room 2")) return "Discussion Room 2";
  if (service.includes("auto") || service.includes("intern") || service.includes("transport")) return "DIGITAL TRANSPORTATION CENTER";
  if (service.includes("printing")) return "Printing";
  return serviceName || "Internet Area";
};

const getAreaBadgeClass = (area = "") => {
  if (area === "Vouchers") return "bg-emerald-100 text-emerald-800";
  if (area === "Charging") return "bg-amber-100 text-amber-800";
  if (area === "Internet Area") return "bg-blue-100 text-blue-800";
  if (area === "Printing") return "bg-rose-100 text-rose-800";
  return "bg-purple-100 text-purple-800";
};

export const getLogDetails = (l, users) => {
  const u = users.find((usr) => usr.rfid === l.rfid);
  const dateObj = new Date(l.checkInTime);
  const formattedDate =
    dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " " +
    dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

  const visitorsName = u
    ? `${u.lastName}, ${u.givenName} ${u.middleName ? u.middleName : ""}`
        .trim()
        .toUpperCase()
    : (l.userFullName || "Unknown").toUpperCase();

  const gender = (u && u.gender) ? String(u.gender) : "Female";

  let ageBracket = (u && u.ageBracket) ? String(u.ageBracket) : "13-21";
  const lowerAge = ageBracket.toLowerCase();

  if (
    lowerAge.includes("youth") ||
    lowerAge.includes("13-24")
  ) {
    ageBracket = "13-21";
  } else if (
    lowerAge.includes("adult") ||
    lowerAge.includes("25-59")
  ) {
    ageBracket = "22-35";
  } else if (
    lowerAge.includes("children") ||
    lowerAge.includes("0-12")
  ) {
    ageBracket = "0-12";
  } else if (
    lowerAge.includes("senior") ||
    lowerAge.includes("60+")
  ) {
    ageBracket = "60+";
  }

  const institution = (u && u.institution) ? String(u.institution) : "Provincial Library Guest";

  const patronType = (
    l.patronType || (u && u.patronType ? u.patronType : "STUDENT")
  ).toString().toUpperCase();

  let area = "Internet Area";
  const srvList = Array.isArray(l.services) ? l.services : [];
  const checkSrv = (kw) => srvList.some(s => typeof s === 'string' && s.toLowerCase().includes(kw.toLowerCase()));

  if (checkSrv("qr code entrance") || l.entryType === "QR_CODE_ENTRANCE") {
    area = l.qrEntranceArea || l.terminalLocation || "QR Code Entrance";
  } else if (srvList.length > 0) {
    area = getAreaForService(srvList[0]);
  }

  let station = l.terminalLocation || "1F CIRCULATION SERVICES";
  if (checkSrv("qr code entrance") || l.entryType === "QR_CODE_ENTRANCE") {
    station = "QR CODE ENTRANCE";
  } else if (!l.terminalLocation && area === "Internet Area") {
    station = "3F INTERNET AREA";
  } else if (
    !l.terminalLocation &&
    area === "Charging" &&
    (l.id.includes("log-sc-6") || l.rfid === "6079889347")
  ) {
    station = "3F CIRCULATION SERVICES";
  } else if (!l.terminalLocation && area === "Charging") {
    station = "1F CIRCULATION SERVICES";
  } else if (!l.terminalLocation && (area === "Discussion Room 1" || area === "Discussion Room 2")) {
    station = "2F STUDY & DISCUSSION";
  } else if (!l.terminalLocation && (checkSrv("auto") || checkSrv("intern"))) {
    station = "DIGITAL TRANSPORTATION CENTER";
  } else if (!l.terminalLocation && area === "Printing") {
    station = "PRINTING SECTOR";
  }

  return {
    formattedDate,
    visitorsName,
    gender,
    ageBracket,
    institution,
    patronType,
    station,
    area,
  };
};

export const AdminDashboard = ({
  adminRole,
  users,
  logs,
  qrClients = [],
  onAddUser,
  onDeleteUser,
  onUpdateUser,
  onDeleteQrClient,
  onClearLogs,
  onCheckOutUser,
  onLogout,
  showNewUserModal,
  setShowNewUserModal,
  prefilledRfid = "",
  onAddQrClient,
}) => {
  // Get the effective role from sessionStorage if prop is temporarily null during route transition
  const effectiveRole = adminRole || sessionStorage.getItem("plrc_admin_role");

  // Navigation tabs in admin
  const [sidebarTab, setSidebarTab] = useState(() => {
    if (effectiveRole === "admin") return "reservations";
    return "dashboard";
  });
  
  const [activeTab, setActiveTab] = useState("users");
  const [showQrRegistrationModal, setShowQrRegistrationModal] = useState(false);
  const [qrQuery, setQrQuery] = useState("");
  const [qrPage, setQrPage] = useState(1);
  const qrRowsPerPage = 10;
  const [settingsTab, setSettingsTab] = useState("institutions");
  const [newInstInput, setNewInstInput] = useState("");
  const [newPatronInput, setNewPatronInput] = useState("");
  const [newRoomInput, setNewRoomInput] = useState("");
  const [rooms, setRooms] = useState(() => {
    const saved = localStorage.getItem("plrc_rooms");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return [
      "Discussion Room (BIWAG)",
      "Discussion Room (MALANA)",
      "Conference Room",
      "Ubag Cinema",
      "Multimedia Room",
    ].map((name) => ({ name, enabled: true, disabledReason: "" }));
  });

  // Dynamic Institutions List
  const [institutions, setInstitutions] = useState(() => {
    return [];
  });

  // Dynamic Patron Types List
  const [patronTypes, setPatronTypes] = useState(() => {
    return [];
  });

  useEffect(() => {
    api.settings.get().then((settings) => {
      setInstitutions(settings.institutions);
      setPatronTypes(settings.patronTypes);
      localStorage.setItem("plrc_patron_types", JSON.stringify(settings.patronTypes || []));
      const savedRooms = JSON.parse(localStorage.getItem("plrc_rooms") || "[]");
      const normalizedRooms = mergeRoomTimeSlots(settings.rooms, savedRooms);
      setRooms(normalizedRooms);
      localStorage.setItem("plrc_rooms", JSON.stringify(normalizedRooms));
    }).catch((error) => console.warn("Unable to load library settings.", error));
  }, []);

  const saveSettings = async (nextInstitutions = institutions, nextPatronTypes = patronTypes, nextRooms = rooms) => {
    const normalizedRooms = nextRooms.map(withRoomTimeSlots);
    const saved = await api.settings.update({ institutions: nextInstitutions, patronTypes: nextPatronTypes, rooms: normalizedRooms });
    setInstitutions(saved.institutions);
    setPatronTypes(saved.patronTypes);
    localStorage.setItem("plrc_patron_types", JSON.stringify(saved.patronTypes || []));
    const savedRooms = mergeRoomTimeSlots(saved.rooms, normalizedRooms);
    setRooms(savedRooms);
    localStorage.setItem("plrc_rooms", JSON.stringify(savedRooms));
  };

  const handleAddInstitution = async () => {
    const val = newInstInput.trim();
    if (val) {
      if (!institutions.includes(val)) {
        const saved = await api.settings.addInstitution(val);
        setInstitutions((current) => [...current, saved.name]);
        setNewInstInput("");
      } else {
        alert("This institution is already in your list.");
      }
    }
  };

  const handleAddPatronType = async () => {
    const val = newPatronInput.trim();
    if (val) {
      if (!patronTypes.includes(val)) {
        const saved = await api.settings.addPatronType(val);
        setPatronTypes((current) => [...current, saved.name]);
        localStorage.setItem("plrc_patron_types", JSON.stringify([...patronTypes, saved.name]));
        setNewPatronInput("");
      } else {
        alert("This patron type is already in your list.");
      }
    }
  };

  const handleAddRoom = async () => {
    const name = newRoomInput.trim();
    if (!name) return;
    if (rooms.some((room) => room.name.toLowerCase() === name.toLowerCase())) {
      alert("This room is already in the settings list.");
      return;
    }
    await saveSettings(institutions, patronTypes, [
      ...rooms,
      { name, enabled: true, disabledReason: "", timeSlots: getDefaultRoomTimeSlots(name) },
    ]);
    setNewRoomInput("");
  };

  const toggleRoomAvailability = async (roomName) => {
    const selectedRoom = rooms.find((room) => room.name === roomName);
    if (!selectedRoom) return;
    if (selectedRoom.enabled) {
      setRoomDisableModal({ roomName, reason: "" });
      return;
    }
    const nextRooms = rooms.map((room) => {
      if (room.name !== roomName) return room;
      return { ...room, enabled: true, disabledReason: "" };
    });
    await saveSettings(institutions, patronTypes, nextRooms);
  };

  const confirmRoomDisable = async () => {
    const reason = roomDisableModal?.reason.trim();
    if (!reason) return;
    const nextRooms = rooms.map((room) =>
      room.name === roomDisableModal.roomName
        ? { ...room, enabled: false, disabledReason: reason }
        : room,
    );
    await saveSettings(institutions, patronTypes, nextRooms);
    setRoomDisableModal(null);
  };

  const configureRoomTimeSlots = (roomConfig) => {
    const currentSlots = roomConfig.timeSlots?.length
      ? roomConfig.timeSlots
      : DEFAULT_DISCUSSION_ROOM_TIME_SLOTS;
    setRoomTimeSlotEditor({
      roomName: roomConfig.name,
      timeSlots: currentSlots.join(", "),
    });
  };

  const handleSaveRoomTimeSlots = async () => {
    const timeSlots = roomTimeSlotEditor.timeSlots
      .split(",")
      .map((slot) => slot.trim())
      .filter(Boolean);
    if (timeSlots.length === 0) {
      alert("Please enter at least one time slot.");
      return;
    }
    const nextRooms = rooms.map((item) =>
      item.name === roomTimeSlotEditor.roomName ? { ...item, timeSlots } : item,
    );
    await saveSettings(institutions, patronTypes, nextRooms);
    setRoomTimeSlotEditor(null);
  };

  const [userQuery, setUserQuery] = useState("");
  const [userPage, setUserPage] = useState(1);
  const userRowsPerPage = 10;

  // Reset to first page when searching
  useEffect(() => {
    setUserPage(1);
  }, [userQuery]);

  useEffect(() => {
    setQrPage(1);
  }, [qrQuery]);

  // Auto-switch tab if role updates later (e.g. from null to admin)
  useEffect(() => {
    if (effectiveRole === "admin" && sidebarTab === "dashboard") {
      setSidebarTab("reservations");
    }
  }, [effectiveRole, sidebarTab]);

  const [adminQrModalUser, setAdminQrModalUser] = useState(null);
  const [adminQrCodeUrl, setAdminQrCodeUrl] = useState("");

  useEffect(() => {
    if (adminQrModalUser && adminQrModalUser.rfid) {
      QRCode.toDataURL(adminQrModalUser.rfid, {
        width: 320,
        margin: 1,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      })
        .then((url) => setAdminQrCodeUrl(url))
        .catch((e) => console.error("Error generating staff preview QR:", e));
    } else {
      setAdminQrCodeUrl("");
    }
  }, [adminQrModalUser]);

  // Live countdown ticker to update stay duration outputs
  const [, setCounterTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCounterTick((pv) => pv + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Calendar States (May 2026 default)
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Date selection states (for blocking or reservation)
  const [targetBlockDate, setTargetBlockDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [targetBlockReason, setTargetBlockReason] = useState("");
  const [targetBlockStatus, setTargetBlockStatus] = useState("closed");

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();

  useEffect(() => {
    setTargetBlockDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`);
  }, [calendarYear, calendarMonth]);

  // Local storage calendar state (for custom closed days)
  const [blockedDays, setBlockedDays] = useState(() => {
    const saved = localStorage.getItem("plrc_blocked_days");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return {
      "2026-05-12": {
        status: "closed",
        reason: "System Maintenance Logbook Call",
      },
      "2026-05-13": { status: "closed", reason: "E-Library Hardware Refresh" },
      "2026-05-14": {
        status: "closed",
        reason: "LUCID Calibration & Re-align",
      },
      "2026-05-15": { status: "closed", reason: "Staff Professional Training" },
      "2026-05-16": {
        status: "holiday",
        reason: "Cagayan Founding Anniversary",
      },
      "2026-05-18": {
        status: "closed",
        reason: "Scheduled Sanitation Routine",
      },
      "2026-05-19": { status: "closed", reason: "Aircon Compressor Servicing" },
      "2026-05-22": {
        status: "closed",
        reason: "Capitol Event - Facility Closed",
      },
      "2026-05-25": { status: "closed", reason: "Water Piping Restoration" },
      "2026-05-28": { status: "closed", reason: "Server Power Rack Upgrade" },
    };
  });

  // Local storage reservations state
  const [reservations, setReservations] = useState(() => {
    const saved = localStorage.getItem("plrc_reservations");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return [
      {
        id: "res-1",
        name: "Jerome Villanueva",
        patronType: "Student",
        date: "2026-05-24",
        timeSlot: "AM (8:00 AM - 12:00 PM)",
        purpose: "e-Library research study",
        status: "PENDING",
      },
      {
        id: "res-2",
        name: "Maria Sophia",
        patronType: "Researcher",
        date: "2026-05-25",
        timeSlot: "PM (1:00 PM - 5:00 PM)",
        purpose: "Archive indexing and history research",
        status: "PENDING",
      },
      {
        id: "res-3",
        name: "Danilo Corpuz",
        patronType: "Professional / Teacher",
        date: "2026-05-28",
        timeSlot: "Full Day (8:00 AM - 5:00 PM)",
        purpose: "Curriculum review resource study",
        status: "PENDING",
      },
    ];
  });

  // Action states for checking reservations
  const [newResName, setNewResName] = useState("");
  const [newResPatronType, setNewResPatronType] = useState("Student");
  const [newResDate, setNewResDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newResRoom, setNewResRoom] = useState("Discussion Room (BIWAG)");
  const [newResTimeSlot, setNewResTimeSlot] = useState("");
  const [newResPurpose, setNewResPurpose] = useState("");
  const [selectedCalendarReservationDate, setSelectedCalendarReservationDate] = useState(null);
  const [rejectingReservation, setRejectingReservation] = useState(null);
  const [reservationRejectReason, setReservationRejectReason] = useState("");
  const [roomTimeSlotEditor, setRoomTimeSlotEditor] = useState(null);
  const [roomDisableModal, setRoomDisableModal] = useState(null);
  const [reservationPage, setReservationPage] = useState(1);
  const reservationsRowsPerPage = 10;
  const adminSelectedRoom = rooms.find((room) => room.name === newResRoom);
  const adminReservationTimeSlots = adminSelectedRoom?.timeSlots?.length
    ? adminSelectedRoom.timeSlots
    : getDefaultRoomTimeSlots(newResRoom);

  useEffect(() => {
    Promise.all([api.reservations.list(), api.blockedDays.list()]).then(([serverReservations, serverBlockedDays]) => {
      setReservations(serverReservations);
      setBlockedDays(Object.fromEntries(serverBlockedDays.map((day) => [day.date, { status: day.status, reason: day.reason }])));
    }).catch((error) => console.warn("Unable to load reservation data.", error));
  }, []);

  const reservationTotalPages = Math.max(
    1,
    Math.ceil(reservations.length / reservationsRowsPerPage),
  );
  const orderedReservations = reservations
    .map((reservation, index) => ({ reservation, index }))
    .sort((a, b) => {
      if (!a.reservation.createdAt || !b.reservation.createdAt) {
        return a.reservation.createdAt ? -1 : b.reservation.createdAt ? 1 : a.index - b.index;
      }
      return new Date(b.reservation.createdAt).getTime() - new Date(a.reservation.createdAt).getTime();
    })
    .map(({ reservation }) => reservation);
  const paginatedReservations = orderedReservations.slice(
    (reservationPage - 1) * reservationsRowsPerPage,
    reservationPage * reservationsRowsPerPage,
  );

  useEffect(() => {
    setReservationPage((page) => Math.min(page, reservationTotalPages));
  }, [reservationTotalPages]);

  // Calendar Day Click Handler: prefill forms
  const handleCalendarDayClick = (dayNum) => {
    const monthStr = (calendarMonth + 1).toString().padStart(2, "0");
    const dayStr = dayNum.toString().padStart(2, "0");
    const formattedDate = `${calendarYear}-${monthStr}-${dayStr}`;
    setTargetBlockDate(formattedDate);
    setNewResDate(formattedDate);
    setSelectedCalendarReservationDate(formattedDate);
    // Set placeholder reason to edit easily
    const current = blockedDays[formattedDate];
    if (current) {
      setTargetBlockReason(current.reason);
      setTargetBlockStatus(current.status || "closed");
    } else {
      setTargetBlockReason("");
      setTargetBlockStatus("closed");
    }
  };

  // Close Day operation
  const handleCloseDay = async () => {
    if (!targetBlockDate) return;
    const day = { id: targetBlockDate, date: targetBlockDate, status: targetBlockStatus, reason: targetBlockReason.trim() || "Facility Closed" };
    try { await api.blockedDays.update(day); } catch { await api.blockedDays.create(day); }
    setBlockedDays((prev) => ({ ...prev, [targetBlockDate]: { status: day.status, reason: day.reason } }));
    window.location.reload();
  };

  // Open Day operation
  const handleOpenDay = async () => {
    if (!targetBlockDate) return;
    await api.blockedDays.remove(targetBlockDate);
    setBlockedDays((prev) => {
      const copy = { ...prev };
      delete copy[targetBlockDate];
      return copy;
    });
  };

  // Create input reservation
  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!newResName.trim() || !newResPurpose.trim() || !newResRoom || !newResTimeSlot) {
      alert(
        "Please fill out Patron Name and Purpose to schedule a room/seat request.",
      );
      return;
    }
    const rawRes = {
      createdAt: new Date().toISOString(),
      name: newResName,
      patronType: newResPatronType,
      date: newResDate,
      room: newResRoom,
      timeSlot: newResTimeSlot,
      purpose: newResPurpose,
      status: "PENDING",
    };
    const saved = await api.reservations.create(rawRes);
    setReservations((prev) => [saved, ...prev]);
    setNewResName("");
    setNewResPurpose("");
    setNewResTimeSlot("");
    alert(
      "Reservation Request catalogued successfully! Active badge incremented.",
    );
  };

  // Edit reservation status
  const handleUpdateReservationStatus = async (id, state, rejectionReason = "") => {
    const current = reservations.find((item) => item.id === id);
    if (!current) return;
    const saved = await api.reservations.update({ ...current, status: state, rejectionReason: state === "REJECTED" ? rejectionReason.trim() : "", rejectedAt: state === "REJECTED" ? new Date().toISOString() : null, approvedAt: state === "APPROVED" ? new Date().toISOString() : null });
    setReservations((prev) => prev.map((item) => item.id === id ? saved : item));
  };

  const openRejectReservationModal = (reservation) => {
    setRejectingReservation(reservation);
    setReservationRejectReason(reservation.rejectionReason || "");
  };

  const closeRejectReservationModal = () => {
    setRejectingReservation(null);
    setReservationRejectReason("");
  };

  const handleSubmitReservationRejection = (e) => {
    e.preventDefault();
    if (!reservationRejectReason.trim()) {
      alert("Please write the reason why this reservation is rejected.");
      return;
    }

    handleUpdateReservationStatus(
      rejectingReservation.id,
      "REJECTED",
      reservationRejectReason,
    );
    closeRejectReservationModal();
  };

  const [logQuery, setLogQuery] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState("all");
  const [logFromDate, setLogFromDate] = useState("");
  const [logToDate, setLogToDate] = useState("");

  // Custom live scanner filters and paging / sorting states
  const [logGenderFilter, setLogGenderFilter] = useState("all");
  const [logAgeFieldFilter, setLogAgeFieldFilter] = useState("all");
  const [logInstitutionFilter, setLogInstitutionFilter] = useState("all");
  const [logPatronTypeFilter, setLogPatronTypeFilter] = useState("all");
  const [logStationFilter, setLogStationFilter] = useState("all");
  const [logAreaFilter, setLogAreaFilter] = useState("all");
  const [logRowsPerPage, setLogRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState("checkInTime");
  const [sortDirection, setSortDirection] = useState("desc");
  const [qrEntranceQuery, setQrEntranceQuery] = useState("");
  const [qrEntranceFromDate, setQrEntranceFromDate] = useState("");
  const [qrEntranceToDate, setQrEntranceToDate] = useState("");
  const [qrEntranceAreaFilter, setQrEntranceAreaFilter] = useState("all");
  const [qrEntrancePatronFilter, setQrEntrancePatronFilter] = useState("all");
  const [qrEntrancePage, setQrEntrancePage] = useState(1);
  const [cplrcSubQuery, setCplrcSubQuery] = useState("");
  const [cplrcSubServiceFilter, setCplrcSubServiceFilter] = useState("all");
  const [cplrcSubStartDate, setCplrcSubStartDate] = useState("");
  const [cplrcSubEndDate, setCplrcSubEndDate] = useState("");

  const [editingUser, setEditingUser] = useState(null);

  // Input states for New User Form (Modal)
  const [formData, setFormData] = useState({
    rfid: prefilledRfid,
    password: "",
    lastName: "",
    givenName: "",
    middleName: "",
    email: "",
    birthday: "",
    phone: "",
    address: "",
    maritalStatus: "Single",
    gender: "Male",
    ageBracket: "Youth (13-24)",
    institution: "",
    patronType: "Student",
    emergencyName: "",
    emergencyPhone: "",
    photoUrl: "",
  });
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  const fileInputRef = useRef(null);

  // Synchronize when editingUser or prefilled changes
  React.useEffect(() => {
    if (editingUser) {
      setFormData({
        rfid: editingUser.rfid,
        password: editingUser.password || "password123",
        lastName: editingUser.lastName || "",
        givenName: editingUser.givenName || "",
        middleName: editingUser.middleName || "",
        email: editingUser.email || "",
        birthday: editingUser.birthday || "",
        phone: editingUser.phone || "",
        address: editingUser.address || "",
        maritalStatus: editingUser.maritalStatus || "Single",
        gender: editingUser.gender || "Male",
        ageBracket: editingUser.ageBracket || "Youth (13-24)",
        institution: editingUser.institution || "",
        patronType: editingUser.patronType || "Student",
        emergencyName: editingUser.emergencyContact?.fullName || "",
        emergencyPhone: editingUser.emergencyContact?.phone || "",
        photoUrl: editingUser.photoUrl || "",
      });
    } else {
      setFormData({
        rfid: prefilledRfid || "",
        password: "",
        lastName: "",
        givenName: "",
        middleName: "",
        email: "",
        birthday: "",
        phone: "",
        address: "",
        maritalStatus: "Single",
        gender: "Male",
        ageBracket: "Youth (13-24)",
        institution: "",
        patronType: "Student",
        emergencyName: "",
        emergencyPhone: "",
        photoUrl: "",
      });
    }
  }, [editingUser, prefilledRfid]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Image Upload handler
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          photoUrl: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          photoUrl: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateMockPhoto = () => {
    const avatarSeed = Math.floor(Math.random() * 70);
    const mockPicUrl = `https://i.pravatar.cc/150?img=${avatarSeed}`;
    setFormData((prev) => ({
      ...prev,
      photoUrl: mockPicUrl,
    }));
  };

  // Submit new user
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingUser) return;
    if (!formData.rfid) {
      alert("RFID is required!");
      return;
    }
    // Only check if it's a new registration or edit is changing RFID
    if (!editingUser || editingUser.rfid !== formData.rfid) {
      if (users.some((u) => u.rfid === formData.rfid)) {
        alert(
          `An existing member is already registered under RFID [${formData.rfid}]`,
        );
        return;
      }
    }

    if (editingUser) {
      const updatedUser = {
        ...editingUser,
        rfid: formData.rfid,
        password: formData.password || "password123",
        lastName: formData.lastName,
        givenName: formData.givenName,
        middleName: formData.middleName,
        email: formData.email,
        birthday: formData.birthday || new Date().toISOString().split("T")[0],
        phone: formData.phone,
        address: formData.address,
        maritalStatus: formData.maritalStatus,
        gender: formData.gender,
        ageBracket: formData.ageBracket,
        institution: formData.institution || "Provincial Library Guest",
        patronType: formData.patronType,
        emergencyContact: {
          fullName: formData.emergencyName,
          phone: formData.emergencyPhone,
        },
        photoUrl: formData.photoUrl || undefined,
      };

      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }
      setEditingUser(null);
    } else {
      const newUser = {
        id: `user-${Date.now()}`,
        rfid: formData.rfid,
        password: formData.password || "password123",
        lastName: formData.lastName,
        givenName: formData.givenName,
        middleName: formData.middleName,
        email: formData.email,
        birthday: formData.birthday || new Date().toISOString().split("T")[0],
        phone: formData.phone,
        address: formData.address,
        maritalStatus: formData.maritalStatus,
        gender: formData.gender,
        ageBracket: formData.ageBracket,
        institution: formData.institution || "Provincial Library Guest",
        patronType: formData.patronType,
        emergencyContact: {
          fullName: formData.emergencyName,
          phone: formData.emergencyPhone,
        },
        photoUrl: formData.photoUrl || undefined,
        role: "client", // Default role for newly registered users
        createdAt: new Date().toISOString(),
      };

      setIsSubmittingUser(true);
      try {
        const savedUser = await onAddUser(newUser);
        if (!savedUser) return;

        await Swal.fire({
          icon: "success",
          title: "Client Registered",
          text: savedUser.email
            ? "The account was created and the registration email was queued."
            : "The client account was created successfully.",
          confirmButtonText: "OK",
          confirmButtonColor: "#2563eb",
        });
      } finally {
        setIsSubmittingUser(false);
      }
    }

    // Reset Form
    setFormData({
      rfid: "",
      password: "",
      lastName: "",
      givenName: "",
      middleName: "",
      email: "",
      birthday: "",
      phone: "",
      address: "",
      maritalStatus: "Single",
      gender: "Male",
      ageBracket: "Youth (13-24)",
      institution: "",
      patronType: "Student",
      emergencyName: "",
      emergencyPhone: "",
      photoUrl: "",
    });
    setShowNewUserModal(false);
  };

  // Filtering users
  const filteredUsers = users.filter((u) => {
    const fullName =
      `${u.givenName} ${u.middleName} ${u.lastName}`.toLowerCase();
    const q = userQuery.toLowerCase();
    return (
      fullName.includes(q) ||
      u.rfid.includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.patronType && u.patronType.toLowerCase().includes(q))
    );
  }).map((user, index) => ({ user, index })).sort((first, second) => {
    const firstDate = new Date(first.user.createdAt || 0).getTime();
    const secondDate = new Date(second.user.createdAt || 0).getTime();
    if (firstDate !== secondDate) return secondDate - firstDate;
    return first.index - second.index;
  }).map(({ user }) => user);

  // Pagination logic for Members
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * userRowsPerPage,
    userPage * userRowsPerPage
  );

  // Filtering Walk-In QR Registrants
  const filteredQrClients = (qrClients || []).filter((c) => {
    const fullName = `${c.givenName} ${c.middleName || ""} ${c.lastName}`.toLowerCase();
    const q = qrQuery.toLowerCase();
    return (
      fullName.includes(q) ||
      c.rfid.includes(q) ||
      (c.patronIdentification && c.patronIdentification.toLowerCase().includes(q)) ||
      (c.patronType && c.patronType.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.institution && c.institution.toLowerCase().includes(q))
    );
  }).sort((firstClient, secondClient) => {
    const firstDate = new Date(firstClient.createdAt || 0).getTime();
    const secondDate = new Date(secondClient.createdAt || 0).getTime();
    return secondDate - firstDate;
  });

  const qrTotalPages = Math.max(1, Math.ceil(filteredQrClients.length / qrRowsPerPage));
  const paginatedQrClients = filteredQrClients.slice(
    (qrPage - 1) * qrRowsPerPage,
    qrPage * qrRowsPerPage,
  );

  // Convert logs to full featured details
  const mappedLogs = logs.map((l) => {
    const details = getLogDetails(l, [...users, ...(qrClients || [])]);
    return {
      ...l,
      ...details,
    };
  });

  // Dedicated ledger for activity recorded by the CPLRC SUB RFID scanner.
  const cplrcSubLogs = mappedLogs
    .filter((l) => l.terminalLocation === "CPLRC SUB")
    .sort(
      (a, b) =>
        new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime(),
    );
  const cplrcSubServices = Array.from(
    new Set([
      "Entrance",
      "WiFi Voucher",
      "Charging Slip",
      ...cplrcSubLogs.flatMap((log) => log.services || []).filter(Boolean),
    ]),
  );
  const filteredCplrcSubLogs = cplrcSubLogs.filter((log) => {
    const query = cplrcSubQuery.toLowerCase();
    const searchMatch =
      !query ||
      (log.visitorsName || "").toLowerCase().includes(query) ||
      (log.rfid || "").toLowerCase().includes(query) ||
      (log.services || []).some((service) =>
        String(service).toLowerCase().includes(query),
      );
    const serviceMatch =
      cplrcSubServiceFilter === "all" ||
      (log.services || []).includes(cplrcSubServiceFilter);
    const loggedAt = new Date(log.checkInTime);
    const startMatch =
      !cplrcSubStartDate ||
      loggedAt >= new Date(`${cplrcSubStartDate}T00:00:00`);
    const endMatch =
      !cplrcSubEndDate ||
      loggedAt <= new Date(`${cplrcSubEndDate}T23:59:59`);
    return searchMatch && serviceMatch && startMatch && endMatch;
  });

  // Filter logs with extensive multiple criteria
  const filteredLogs = mappedLogs.filter((l) => {
    // Exclude QR Code Entrance and CPLRC SUB logs from this general table
    if (
      l.entryType === "QR_CODE_ENTRANCE" || l.terminalLocation === "CPLRC SUB"
    ) {
      return false;
    }

    const queryMatch = !logQuery
      ? true
      : (l.userFullName || "").toLowerCase().includes(logQuery.toLowerCase()) ||
        (l.rfid || "").includes(logQuery) ||
        (l.patronType || "").toLowerCase().includes(logQuery.toLowerCase()) ||
        (l.gender || "").toLowerCase().includes(logQuery.toLowerCase()) ||
        (l.ageBracket || "").toLowerCase().includes(logQuery.toLowerCase()) ||
        (l.institution || "").toLowerCase().includes(logQuery.toLowerCase()) ||
        (l.station || "").toLowerCase().includes(logQuery.toLowerCase()) ||
        (l.area || "").toLowerCase().includes(logQuery.toLowerCase()) ||
        (Array.isArray(l.services) && l.services.some((s) =>
          s && typeof s === 'string' && s.toLowerCase().includes(logQuery.toLowerCase())
        ));

    // Date Filtering Logic
    const checkInDate = new Date(l.checkInTime);
    const dateMatch = (() => {
      const checkInTS = checkInDate.getTime();
      if (logFromDate) {
        const from = new Date(logFromDate);
        from.setHours(0, 0, 0, 0);
        if (checkInTS < from.getTime()) return false;
      }
      if (logToDate) {
        const to = new Date(logToDate);
        to.setHours(23, 59, 59, 999);
        if (checkInTS > to.getTime()) return false;
      }
      return true;
    })();

    const statusMatch =
      logStatusFilter === "all" || l.status === logStatusFilter;
    const genderMatch =
      logGenderFilter === "all" ||
      l.gender.toLowerCase() === logGenderFilter.toLowerCase();
    const ageMatch =
      logAgeFieldFilter === "all" ||
      l.ageBracket.toLowerCase() === logAgeFieldFilter.toLowerCase();
    const instMatch =
      logInstitutionFilter === "all" ||
      l.institution.toLowerCase() === logInstitutionFilter.toLowerCase();
    const patronMatch =
      logPatronTypeFilter === "all" ||
      l.patronType.toLowerCase() === logPatronTypeFilter.toLowerCase();
    const stationMatch =
      logStationFilter === "all" ||
      l.station.toLowerCase() === logStationFilter.toLowerCase();
    const areaMatch =
      logAreaFilter === "all" ||
      l.area.toLowerCase() === logAreaFilter.toLowerCase();

    return (
      queryMatch &&
      dateMatch &&
      statusMatch &&
      genderMatch &&
      ageMatch &&
      instMatch &&
      patronMatch &&
      stationMatch &&
      areaMatch
    );
  });

  // Sort logs based on active sortField and sortDirection
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let comparison = 0;
    if (sortField === "checkInTime") {
      comparison =
        new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
    } else {
      const valA = a[sortField]?.toString() || "";
      const valB = b[sortField]?.toString() || "";
      comparison = valA.localeCompare(valB);
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const qrEntranceLogs = mappedLogs
    .filter(
      (l) => l.entryType === "QR_CODE_ENTRANCE",
    )
    .sort(
      (a, b) =>
        new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime(),
    );
  const qrEntranceAreas = Array.from(
    new Set(
      qrEntranceLogs
        .map((l) => l.qrEntranceArea || l.terminalLocation || l.area)
        .filter(Boolean),
    ),
  );
  const qrEntrancePatronTypes = Array.from(
    new Set(qrEntranceLogs.map((l) => l.patronType).filter(Boolean)),
  );
  const filteredQrEntranceLogs = qrEntranceLogs.filter((l) => {
    const q = qrEntranceQuery.toLowerCase();
    const area = l.qrEntranceArea || l.terminalLocation || l.area || "";
    const queryMatch =
      !q ||
      (l.visitorsName || "").toLowerCase().includes(q) ||
      (l.rfid || "").toLowerCase().includes(q) ||
      area.toLowerCase().includes(q) ||
      (l.patronType || "").toLowerCase().includes(q) ||
      (l.services || []).some((service) => String(service).toLowerCase().includes(q)) ||
      (l.voucherCode || "").toLowerCase().includes(q);

    const checkInDate = new Date(l.checkInTime);
    const fromMatch = !qrEntranceFromDate || checkInDate >= new Date(`${qrEntranceFromDate}T00:00:00`);
    const toMatch = !qrEntranceToDate || checkInDate <= new Date(`${qrEntranceToDate}T23:59:59`);
    const areaMatch =
      qrEntranceAreaFilter === "all" || area === qrEntranceAreaFilter;
    const patronMatch =
      qrEntrancePatronFilter === "all" ||
      l.patronType === qrEntrancePatronFilter;

    return queryMatch && fromMatch && toMatch && areaMatch && patronMatch;
  });
  const qrEntranceRowsPerPage = 10;
  const qrEntranceTotalPages = Math.max(
    1,
    Math.ceil(filteredQrEntranceLogs.length / qrEntranceRowsPerPage),
  );
  const paginatedQrEntranceLogs = filteredQrEntranceLogs.slice(
    (qrEntrancePage - 1) * qrEntranceRowsPerPage,
    qrEntrancePage * qrEntranceRowsPerPage,
  );

  useEffect(() => {
    setQrEntrancePage(1);
  }, [
    qrEntranceQuery,
    qrEntranceFromDate,
    qrEntranceToDate,
    qrEntranceAreaFilter,
    qrEntrancePatronFilter,
  ]);

  const downloadCsv = (filename, headers, rows) => {
    const sanitize = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csvRows = [headers, ...rows].map((row) => row.map(sanitize).join(","));
    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = () => {
    downloadCsv(
      `CPLRC_RFID_Visitors_Report_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date & Time", "RFID Card No", "Visitor Name", "Gender", "Age Bracket", "Institution", "Patron Type", "Station", "Area", "Status"],
      sortedLogs.map((l) => [l.formattedDate, l.rfid, l.visitorsName, l.gender, l.ageBracket, l.institution, l.patronType, l.station, l.area, l.status]),
    );
  };

  const handleDownloadCplrcSub = () => {
    downloadCsv(
      `CPLRC_SUB_RFID_Visitors_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date & Time", "Visitor", "RFID Code", "Institution", "Age Bracket", "Gender", "Patron Type", "Services Required"],
      filteredCplrcSubLogs.map((log) => [log.formattedDate, log.visitorsName, log.rfid, log.institution, log.ageBracket, log.gender, log.patronType, (log.services || []).join(" | ")]),
    );
  };

  const handleDownloadQrEntrance = () => {
    downloadCsv(
      `CPLRC_QR_Entrance_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date & Time", "Visitor", "QR Pass Code", "Target Floor / Area", "Wi-Fi Voucher", "Patron Type"],
      filteredQrEntranceLogs.map((l) => [l.formattedDate, l.visitorsName, l.rfid, l.qrEntranceArea || l.terminalLocation || l.area, (l.services || []).some((service) => String(service).toLowerCase().includes("wifi") || String(service).toLowerCase().includes("voucher")) ? (l.voucherCode || "1 Hour Voucher") : "", l.patronType]),
    );
  };

  const handleDownloadQrClients = () => {
    downloadCsv(
      `CPLRC_Walk_In_QR_Registrants_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Guest Registrant Name", "Patron Identification", "QR Pass Code", "Provincial Address", "Affiliated School or Office", "Registered At"],
      filteredQrClients.map((client) => [`${client.lastName}, ${client.givenName} ${client.middleName || ""}`.trim(), client.patronIdentification || client.patronType || "", client.rfid, client.address, client.institution, client.createdAt]),
    );
  };

  const renderSortHeader = (label, field) => {
    const isSorted = sortField === field;
    return (
      <button
        type="button"
        onClick={() => {
          if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
          } else {
            setSortField(field);
            setSortDirection("asc");
          }
        }}
        className="flex items-center gap-1 font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer uppercase tracking-wider text-[11px] font-sans"
      >
        <span>{label}</span>
        <span className="text-[10px] text-slate-400">
          {isSorted ? (sortDirection === "asc" ? "▲" : "▼") : "▾"}
        </span>
      </button>
    );
  };

  // Dynamic statistics
  const totalMembers = users.length;
  const activeStays = logs.filter((l) => l.status === "ACTIVE").length;
  // Pending reservations count matching badge precisely
  const pendingReservationsCount = reservations.filter(
    (r) => r.status === "PENDING",
  ).length;

  const serviceCounts = {};
  logs.forEach((l) => {
    l.services.forEach((srv) => {
      serviceCounts[srv] = (serviceCounts[srv] || 0) + 1;
    });
  });
  const formattedServices = SERVICE_OPTIONS.map((srv) => ({
    name: srv.name,
    count: serviceCounts[srv.name] || 0,
    color: srv.color,
  })).sort((a, b) => b.count - a.count);

  // Calendar Helpers
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay(); // 0-indexed Sun=0, Mon=1, etc.
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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

  // Generate calendar days grid
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
  const remaining = calendarRows.length % 7;
  if (remaining > 0) {
    for (let i = 0; i < 7 - remaining; i++) {
      calendarRows.push(null);
    }
  }

  // Reservations shown on the dashboard calendar. Rejected requests are not
  // active bookings, so they are kept in the ledger but excluded here.
  const reservationsByDate = reservations.reduce((byDate, reservation) => {
    if (!reservation.date || reservation.status === "REJECTED") return byDate;
    if (!byDate[reservation.date]) byDate[reservation.date] = [];
    byDate[reservation.date].push(reservation);
    return byDate;
  }, {});

  // ====================================================
  // 2. MAIN LOGGED-IN ADMIN CONSOLE LAYOUT WITH SIDEBAR
  // ====================================================
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#F3F4F6] font-sans antialiased text-slate-900">
      {/* LEFT SIDEBAR NAVIGATION PANEL (PIC PERFECT) */}
      <div className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-gray-205 border-gray-200 flex flex-col pt-4 lg:pt-6 pb-3 lg:pb-4 shrink-0 select-none">
        {/* Core title branding with official logo */}
        <div className="flex items-center gap-3 px-4 sm:px-6 mb-4 lg:mb-8">
          <PLRCLogo size={48} />
          <div>
            <span className="font-sans font-black text-[#1E3A8A] text-lg block tracking-tight leading-none">
              CPLRC
            </span>
            <span className="text-[9px] font-mono text-slate-400 block mt-0.5 tracking-wider font-bold">
              DIGITAL PORTAL
            </span>
          </div>
        </div>

        {/* Dynamic Sidebar Links with state triggers */}
        <nav className="flex-1 flex lg:block gap-1.5 overflow-x-auto px-3 sm:px-4 pb-1 lg:pb-0 lg:space-y-1.5 [scrollbar-width:thin]">
          {(effectiveRole === "superadmin" || !effectiveRole) && (
            <button
              onClick={() => setSidebarTab("dashboard")}
              className={`min-w-max lg:w-full flex items-center justify-between px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                sidebarTab === "dashboard" 
                  ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                  : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <Home size={16} />
                Dashboard
              </span>
            </button>
          )}

          {effectiveRole && (
            <button
              onClick={() => setSidebarTab("visitors")}
              className={`min-w-max lg:w-full flex items-center justify-between px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                sidebarTab === "visitors"
                  ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                  : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <Users size={16} />
                Visitors
              </span>
            </button>
          )}

          <button
            onClick={() => setSidebarTab("reservations")}
            className={`min-w-max lg:w-full flex items-center justify-between px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              sidebarTab === "reservations"
                ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Calendar size={16} />
              Reservations
            </span>
            {pendingReservationsCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full select-none animate-pulse">
                {pendingReservationsCount}
              </span>
            )}
          </button>

          {effectiveRole === "superadmin" && (
            <button
              onClick={() => setSidebarTab("settings")}
              className={`min-w-max lg:w-full flex items-center justify-between px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                sidebarTab === "settings"
                  ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                  : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <Settings size={16} />
                Settings
              </span>
            </button>
          )}

          {effectiveRole === "superadmin" && (
            <button
              onClick={() => setSidebarTab("e-resources")}
              className={`min-w-max lg:w-full flex items-center justify-between px-3 sm:px-4 py-2.5 lg:py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                sidebarTab === "e-resources"
                  ? "bg-blue-50 text-[#1E3A8A] border-l-4 border-[#1E3A8A]"
                  : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3"><BookOpen size={16} /> E-Resources</span>
            </button>
          )}
        </nav>

        {/* Staff Desk User profile box at bottom sidebar */}
        <div className="hidden lg:flex mt-auto px-4 pt-4 border-t border-slate-100 items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
              J
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] font-bold text-slate-500 font-mono block leading-none">
                OFFICER LOGGED
              </span>
              <span className="text-xs font-black text-slate-800 truncate block mt-1">
                Jerome Villanueva
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
            title="Log out of Staff Admin portal"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* RIGHT SIDEBAR MAIN VIEWPORT CONTENT PANEL */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP STATUS LINE - Jerome header profile exactly matching layout top banner */}
        <div className="bg-white border-b border-gray-200 py-3.5 px-4 sm:px-6 flex justify-between items-center gap-3 select-none shrink-0">
          <div>
            <h1 className="text-sm sm:text-base font-black text-slate-850 tracking-tight uppercase flex items-center gap-2">
              {sidebarTab === "dashboard" && "CPLRC Dashboard"}
              {sidebarTab === "visitors" && "Patrons & Logs Administration"}
              {sidebarTab === "reservations" && "Room & Computer Bookings"}
              {sidebarTab === "settings" && "System Configuration"}
              {sidebarTab === "e-resources" && "E-Resources Management"}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono text-slate-500 shrink-0">
          <span className="bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded-full text-[10px]">
            {adminRole === "superadmin" ? "SUPERADMIN" : "STAFF ADMIN"} ACCESS
            </span>
            <div className="hidden sm:flex items-center gap-1">
              <Users size={14} className="text-blue-600" />
              <span>
                User:{" "}
                <strong className="text-slate-800 font-sans">Jerome</strong>
              </span>
            </div>
          </div>
        </div>

        {/* DYNAMIC TAB COMPILING PANEL */}
        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          {/* ========================================================= */}
          {/* VIEW: E-RESOURCES MANAGEMENT */}
          {/* ========================================================= */}
          {sidebarTab === "e-resources" && effectiveRole && <EResourceManager />}

          {/* ========================================================= */}
          {/* VIEW: SIDEBAR TAB - RESERVATIONS CALENDAR HOME (DASHBOARD) */}
          {/* ========================================================= */}
          {sidebarTab === "dashboard" && (effectiveRole === "superadmin" || !effectiveRole) && (
            <div className="space-y-6">
              {/* Dynamic visitors and reservations analytics cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 select-none">
                {/* Total Visitors logbook analytics card */}
                <div
                  id="stat-total-visitors"
                  className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center"
                >
                  <h3 className="text-lg font-extrabold text-[#1E3A8A] tracking-tight text-center uppercase">
                    Total Visitors
                  </h3>
                  <p className="text-4xl font-black text-slate-900 mt-2">
                    {totalMembers}
                  </p>
                </div>

                {/* Pending active reservations counter card */}
                <div
                  id="stat-pending-res"
                  className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center"
                >
                  <h3 className="text-lg font-extrabold text-[#1E3A8A] tracking-tight text-center uppercase">
                    Pending Reservations
                  </h3>
                  <p className="text-4xl font-black text-slate-900 mt-2">
                    {pendingReservationsCount}
                  </p>
                </div>
              </div>

              {/* Day controller actions: Close calendar date slots dynamically */}
              <div className="bg-white p-3 sm:p-3 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest font-mono">
                  STAFF SCHEDULER CONTROLLER
                </span>

                <div className="flex flex-col md:flex-row md:items-end gap-2 mt-2">
                  <div className="flex-auto w-full md:max-w-[160px]">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase block mb-1">
                      Target calendar date picker
                    </label>
                    <input
                      type="date"
                      value={targetBlockDate}
                      onChange={(e) => setTargetBlockDate(e.target.value)}
                      className="border border-gray-350 rounded-lg px-2 py-1 text-[11px] w-full focus:ring-1 focus:ring-blue-500 focus:outline-none text-gray-700 bg-slate-50 font-mono"
                    />
                  </div>

                  <div className="flex-auto w-full md:max-w-[420px]">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase block mb-1 font-sans">
                      Reason / scheduled calendar notation description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. System Maintenance, Holiday event, CSU Class Tour (Leave empty to open)"
                      value={targetBlockReason}
                      onChange={(e) => setTargetBlockReason(e.target.value)}
                      className="border border-gray-350 rounded-lg px-2 py-1 text-[11px] w-full focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-800 bg-slate-50"
                    />
                  </div>

                  <div className="flex-auto w-full md:max-w-[180px]">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase block mb-1 font-sans">
                      Calendar status
                    </label>
                    <select
                      value={targetBlockStatus}
                      onChange={(e) => setTargetBlockStatus(e.target.value)}
                      className="border border-gray-350 rounded-lg px-2 py-1 text-[11px] w-full focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-800 bg-slate-50"
                    >
                      <option value="closed">Maintenance Blocked (Orange)</option>
                      <option value="holiday">Holiday Closed (Red)</option>
                    </select>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0 shrink-0">
                    <button
                      onClick={handleCloseDay}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-md uppercase tracking-wide transition-all cursor-pointer shadow-sm"
                    >
                      Close Day
                    </button>
                    <button
                      onClick={handleOpenDay}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-md uppercase tracking-wide transition-all cursor-pointer shadow-sm"
                    >
                      Open Day
                    </button>
                  </div>
                </div>
              </div>

              {/* MONTHLY CALENDAR GRID BOARD - MAY 2026 DEFAULT */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm max-w-[2000px] mx-auto">
                {/* Header arrows selector month picker */}
                <div className="flex justify-between items-center mb-1 border-b border-slate-100 pb-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
                  >
                    <ChevronLeft size={12} className="stroke-[3]" />
                  </button>

                  <h2 className="text-[11px] font-black text-slate-800 tracking-tight font-sans">
                    {monthNames[calendarMonth]} {calendarYear}
                  </h2>

                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
                  >
                    <ChevronRight size={12} className="stroke-[3]" />
                  </button>
                </div>

                {/* Week Column Header names */}
                <div className="grid grid-cols-7 text-center font-bold text-[11px] font-sans text-slate-500 select-none pb-0 uppercase">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                {/* Calendar Day boxes cells */}
                <div className="grid grid-cols-7 gap-px">
                  {calendarRows.map((dayNum, idx) => {
                    if (dayNum === null) {
                      return <div key={`empty-${idx}`} className="h-12 bg-slate-50/30 rounded-sm" />;
                    }

                    const monthStr = (calendarMonth + 1)
                      .toString()
                      .padStart(2, "0");
                    const dayStr = dayNum.toString().padStart(2, "0");
                    const itemDateKey = `${calendarYear}-${monthStr}-${dayStr}`;

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dayDate = new Date(calendarYear, calendarMonth, dayNum);
                    const isToday = dayDate.getTime() === today.getTime();
                    const blockObj = blockedDays[itemDateKey];
                    const dayReservations = reservationsByDate[itemDateKey] || [];
                    let bgClass = "bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/50";
                    let tooltip = dayReservations.length
                      ? `${dayReservations.length} room reservation${dayReservations.length > 1 ? "s" : ""}`
                      : "";

                    if (isToday) {
                      bgClass = "bg-[#10B981] text-white border-2 border-emerald-500 font-extrabold shadow-sm shadow-emerald-200";
                      tooltip = "Today - Active Access Day";
                    } else if (blockObj) {
                      if (blockObj.status === "holiday") {
                        bgClass = "bg-[#DC2626] text-white hover:bg-rose-750 font-bold border border-rose-500";
                        tooltip = `Holiday Closed: ${blockObj.reason}`;
                      } else {
                        bgClass = "bg-[#F97316] text-white hover:bg-amber-600 font-bold border border-amber-500";
                        tooltip = `Closed Day: ${blockObj.reason}`;
                      }
                    }

                    return (
                      <button
                        key={`day-${dayNum}`}
                        onClick={() => handleCalendarDayClick(dayNum)}
                        title={tooltip || `Day ${dayNum} - Available for Booking`}
                        className={`min-h-16 sm:min-h-20 md:min-h-28 rounded-sm flex flex-col items-stretch p-1 sm:p-1.5 text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] relative group ${bgClass}`}
                      >
                        <span className="text-[11px] sm:text-[13px] font-bold block leading-none">
                          {dayNum}
                        </span>

                        {dayReservations.length > 0 && (
                          <div className="hidden sm:block mt-1 space-y-1 overflow-y-auto max-h-20 pr-0.5">
                            {dayReservations.map((reservation) => (
                              <div
                                key={reservation.id}
                                className={`rounded px-1.5 py-1 text-left shadow-sm ${reservation.status === "APPROVED" ? "bg-blue-100 text-blue-950 border border-blue-200" : "bg-amber-100 text-amber-950 border border-amber-200"}`}
                              >
                                <div className="text-[8px] font-black uppercase truncate">{reservation.name || "Guest"}</div>
                                <div className="text-[7px] font-semibold truncate">{reservation.timeSlot || "Time to be confirmed"}</div>
                                <div className="text-[7px] font-bold truncate">{reservation.room || "General Space"}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Hover badge details tooltips for closed indices */}
                        {tooltip && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-900 text-white text-[9px] font-mono font-bold px-2 py-1 rounded shadow-lg z-30 select-none uppercase tracking-wider whitespace-nowrap">
                            {blockObj ? blockObj.reason : "CPLRC ACTIVE NOW"}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Color Legend explanation of May calendar layout */}
                <div className="mt-1.5 pt-1 border-t border-slate-100 flex flex-wrap gap-1.5 text-[7px] font-sans font-bold text-slate-500 justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-[#EF4444] inline-block border border-red-500" />
                    <span>Holiday Closed (Red)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-[#F97316] inline-block border border-amber-500" />
                    <span>Maintenance Blocked (Orange)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-[#10B981] inline-block border border-emerald-500 animate-pulse" />
                    <span>Active selected stay (Green)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-amber-200 inline-block border border-amber-400" />
                    <span>Pending Reservation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-blue-200 inline-block border border-blue-400" />
                    <span>Approved Reservation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-[#F8FAFC] inline-block border border-slate-200" />
                    <span>Full Available standard zone (Gray)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW: SIDEBAR TAB - VISITORS (COMBINES ORIGINAL VIEWS) */}
          {/* ========================================================= */}
          {sidebarTab === "visitors" && effectiveRole === "superadmin" && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200/80 overflow-hidden">
              {/* Tabs strip matching original AdminDashboard precisely */}
              <div className="flex flex-nowrap overflow-x-auto border-b border-gray-200 bg-slate-50/50 p-2 gap-1 [scrollbar-width:thin]">
                <button
                  onClick={() => setActiveTab("users")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    activeTab === "users"
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <Users size={16} /> VISITOR'S DATA ENTRY ({users.length})
                </button>
                <button
                  onClick={() => setActiveTab("qr-clients")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    activeTab === "qr-clients"
                      ? "bg-white text-emerald-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <QrCode size={16} /> Walk-In QR Registrants ({qrClients.length})
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    activeTab === "logs"
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <Clock size={16} /> Live Scanner Logs {/*({logs.length})*/}
                 {/*} <Clock size={16} /> Live Scanner Logs ({filteredLogs.length})*/}
                </button>
                <button
                  onClick={() => setActiveTab("cplrc-sub")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    activeTab === "cplrc-sub"
                      ? "bg-white text-violet-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <Building size={16} /> CPLRC SUB ({cplrcSubLogs.length})
                </button>
                <button
                  onClick={() => setActiveTab("qr-entrance")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    activeTab === "qr-entrance"
                      ? "bg-white text-cyan-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <QrCode size={16} /> QR Code Entrance ({qrEntranceLogs.length})
                </button>
                <button
                  onClick={() => setActiveTab("statistics")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    activeTab === "statistics"
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <TrendingUp size={16} /> Analytics Report
                </button>
              </div>

              <div className="p-4 sm:p-6">
                {/* 1. sub-tab members registry */}
                {activeTab === "users" && (
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-stretch gap-3 mb-6">
                      <div className="relative flex-1">
                        <Search
                          className="absolute left-3.5 top-3.5 text-gray-400"
                          size={18}
                        />
                        <input
                          type="text"
                          placeholder="Search members by full name, patron type, school/inst, or RFID barcode..."
                          className="pl-10 pr-4 py-2.5 w-full text-xs sm:text-sm border border-gray-350 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-sans"
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={handleDownloadExcel}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                        >
                          <FileSpreadsheet size={16} /> Download Excel
                        </button>
                        <button
                          onClick={() => {
                            setEditingUser(null);
                            setFormData((prev) => ({ ...prev, rfid: "" }));
                            setShowNewUserModal(true);
                          }}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                        >
                          <Plus size={16} /> Add Member
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-205 rounded-2xl shadow-xs">
                      <table className="min-w-full divide-y divide-gray-200 text-left">
                        <thead className="bg-slate-55 bg-slate-50 text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider font-mono">
                          <tr>
                            <th className="px-5 py-3.5">Member Name</th>
                            <th className="px-5 py-3.5">RFID Barcode</th>
                            <th className="px-5 py-3.5">Patron Level</th>
                            <th className="px-5 py-3.5 text-center">
                              Contact Info
                            </th>
                            <th className="px-5 py-3.5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-xs sm:text-sm">
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-5 py-12 text-center text-gray-400 italic font-mono uppercase"
                              >
                                No member database entries found matching search
                                filter.
                              </td>
                            </tr>
                          ) : (
                            paginatedUsers.map((u) => (
                              <tr
                                key={u.id}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="px-5 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 overflow-hidden flex items-center justify-center font-bold text-blue-700 text-xs shrink-0 shadow-xs">
                                      {u.photoUrl ? (
                                        <img
                                          src={u.photoUrl}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <span>
                                          {u.givenName[0]}
                                          {u.lastName[0]}
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-extrabold text-slate-800 font-sans">
                                        {u.givenName}{" "}
                                        {u.middleName ? u.middleName + " " : ""}
                                        {u.lastName}
                                      </div>
                                      <div className="text-[10px] text-gray-400 font-mono">
                                        Birtday {u.birthday}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-5 py-4 whitespace-nowrap font-mono">
                                  <span className="bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-bold border border-slate-200 text-xs">
                                    {u.rfid}
                                  </span>
                                </td>

                                <td className="px-5 py-4 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="font-extrabold text-indigo-900 text-[11px] uppercase tracking-wider">
                                      {u.patronType}
                                    </span>
                                    <span className="text-[9.5px] text-gray-400 italic truncate max-w-[170px] mt-0.5">
                                      {u.institution ||
                                        "Provincial Library Guest"}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-5 py-4 text-center">
                                  <div className="text-[11px] text-gray-700 font-bold font-mono">
                                    {u.phone || "No Phone"}
                                  </div>
                                  <div className="text-[9.5px] text-gray-400 italic max-w-[140px] truncate mx-auto mt-0.5">
                                    {u.email || "No Email"}
                                  </div>
                                </td>

                                <td className="px-5 py-4 whitespace-nowrap text-center text-xs flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUser(u);
                                      setShowNewUserModal(true);
                                    }}
                                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                                    title="Edit member record"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAdminQrModalUser(u)}
                                    className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
                                    title="View and download entry QR Code"
                                  >
                                    <QrCode size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const result = await Swal.fire({
                                        title: "Delete member record?",
                                        text: `Are you sure you wish to delete ${u.givenName} ${u.lastName}? Card Token: ${u.rfid}`,
                                        icon: "warning",
                                        showCancelButton: true,
                                        confirmButtonText: "Delete",
                                        cancelButtonText: "Cancel",
                                        confirmButtonColor: "#e11d48",
                                        cancelButtonColor: "#64748b",
                                        reverseButtons: true,
                                      });
                                      if (result.isConfirmed) onDeleteUser(u.id);
                                    }}
                                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                    title="Deregister member record"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination Controls for Members */}
                    <div className="bg-slate-50 px-5 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 rounded-2xl">
                      <div className="text-xs text-slate-500 font-medium font-sans">
                        Showing {filteredUsers.length === 0 ? 0 : (userPage - 1) * userRowsPerPage + 1} to{" "}
                        {Math.min(userPage * userRowsPerPage, filteredUsers.length)} of{" "}
                        {filteredUsers.length} members
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                          disabled={userPage === 1}
                          className={`px-3 py-1 bg-white border border-gray-200 rounded font-bold uppercase transition-all ${userPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'}`}
                        >
                          Prev
                        </button>
                        <div className="flex items-center gap-1">
                          <span className="px-3 py-1 bg-blue-600 text-white font-extrabold rounded shadow-xs">
                            {userPage}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUserPage(prev => Math.min(Math.ceil(filteredUsers.length / userRowsPerPage), prev + 1))}
                          disabled={userPage >= Math.ceil(filteredUsers.length / userRowsPerPage) || filteredUsers.length === 0}
                          className={`px-3 py-1 bg-white border border-gray-200 rounded font-bold uppercase transition-all ${userPage >= Math.ceil(filteredUsers.length / userRowsPerPage) || filteredUsers.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'}`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Walk-In QR Registrants Ledger */}
                {activeTab === "qr-clients" && (
                  <div className="animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row justify-between items-stretch gap-3 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                        <input
                          type="text"
                          placeholder="Search QR Walk-Ins..."
                          className="pl-10 pr-4 py-2.5 w-full text-xs sm:text-sm border border-gray-350 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                          value={qrQuery}
                          onChange={(e) => setQrQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={handleDownloadQrClients}
                          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                        >
                          <FileSpreadsheet size={16} /> Download Excel
                        </button>
                        {adminRole === "superadmin" && (
                          <button
                            onClick={() => setShowQrRegistrationModal(true)}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                          >
                            <Plus size={16} /> Add QR Registrant
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-205 rounded-2xl shadow-xs">
                      <table className="min-w-full divide-y divide-gray-200 text-left">
                        <thead className="bg-[#ECFDF5] text-[10px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider font-mono">
                          <tr>
                            <th className="px-5 py-3.5">Guest Registrant Name</th>
                            <th className="px-5 py-3.5">Patron Identification</th>
                            <th className="px-5 py-3.5">QR Pass Code</th>
                            <th className="px-5 py-3.5">Provincial Address</th>
                            <th className="px-5 py-3.5">Affiliated School or Office</th>
                            <th className="px-5 py-3.5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-xs sm:text-sm">
                          {filteredQrClients.length === 0 ? (
                            <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 italic font-mono uppercase">No QR entries found.</td></tr>
                          ) : (
                            paginatedQrClients.map((c) => (
                              <tr key={c.id} className="hover:bg-emerald-50/20 transition-colors">
                                <td className="px-5 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-xs shrink-0 uppercase">{c.givenName[0]}{c.lastName[0]}</div>
                                    <div><div className="font-extrabold text-slate-900 uppercase">{c.lastName}, {c.givenName}</div><div className="text-[10px] text-slate-400 font-mono">Registered: {new Date(c.createdAt).toLocaleDateString()}</div></div>
                                  </div>
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap"><span className="font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200">{c.patronIdentification || c.patronType || "N/A"}</span></td>
                                <td className="px-5 py-4 whitespace-nowrap"><span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">{c.rfid}</span></td>
                                <td className="px-5 py-4 text-gray-700 max-w-xs truncate font-medium">{c.address}</td>
                                <td className="px-5 py-4 text-slate-800 font-bold max-w-xs truncate">{c.institution}</td>
                                <td className="px-5 py-4 text-center">
                                  <div className="flex justify-center gap-2">
                                    <button onClick={() => setAdminQrModalUser(c)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl cursor-pointer"><QrCode size={14} /></button>
                                      <button onClick={async () => {
                                        const result = await Swal.fire({
                                          title: "Delete QR client?",
                                          text: `Are you sure you want to delete ${c.givenName}?`,
                                          icon: "warning",
                                          showCancelButton: true,
                                          confirmButtonText: "Delete",
                                          cancelButtonText: "Cancel",
                                          confirmButtonColor: "#e11d48",
                                          cancelButtonColor: "#64748b",
                                          reverseButtons: true,
                                        });
                                        if (result.isConfirmed) onDeleteQrClient(c.id);
                                      }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl cursor-pointer"><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="font-mono">
                        Showing {filteredQrClients.length === 0 ? 0 : (qrPage - 1) * qrRowsPerPage + 1}
                        {" - "}
                        {Math.min(qrPage * qrRowsPerPage, filteredQrClients.length)}
                        {" of "}
                        {filteredQrClients.length} QR registrants
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQrPage((page) => Math.max(1, page - 1))}
                          disabled={qrPage === 1}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-slate-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                        >
                          Previous
                        </button>
                        <span className="font-mono font-bold text-slate-700">
                          Page {qrPage} / {qrTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQrPage((page) => Math.min(qrTotalPages, page + 1))}
                          disabled={qrPage === qrTotalPages}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-slate-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "qr-entrance" && (
                  <div className="space-y-6">
                    <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-850 tracking-tight">
                          QR Code Entrance
                        </h1>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
                          <p className="text-xs text-slate-400 italic">
                            Home / QR Code Entrance Table
                          </p>
                          <button
                            onClick={handleDownloadQrEntrance}
                            className="w-fit px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wide cursor-pointer"
                          >
                            <FileSpreadsheet size={14} /> Download Excel
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
                      <div className="p-5 border-b border-gray-100 bg-slate-50/50 space-y-4">
                        <div>
                          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            QR Code Entrance Records
                          </h2>
                          <div className="h-0.5 w-16 bg-cyan-500 mt-1" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 text-slate-450" size={13} />
                          <input
                            type="text"
                            placeholder="Search visitor, QR, area..."
                            value={qrEntranceQuery}
                            onChange={(e) => setQrEntranceQuery(e.target.value)}
                            className="pl-8 pr-3 py-2 w-full text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 bg-white"
                          />
                        </div>
                        <input
                          type="date"
                          value={qrEntranceFromDate}
                          onChange={(e) => setQrEntranceFromDate(e.target.value)}
                          className="bg-white border border-gray-250 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                        />
                        <input
                          type="date"
                          value={qrEntranceToDate}
                          onChange={(e) => setQrEntranceToDate(e.target.value)}
                          className="bg-white border border-gray-250 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                        />
                        <select
                          value={qrEntranceAreaFilter}
                          onChange={(e) => setQrEntranceAreaFilter(e.target.value)}
                          className="bg-white border border-gray-250 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                          <option value="all">All Areas</option>
                          {qrEntranceAreas.map((area) => (
                            <option key={area} value={area}>{area}</option>
                          ))}
                        </select>
                        <select
                          value={qrEntrancePatronFilter}
                          onChange={(e) => setQrEntrancePatronFilter(e.target.value)}
                          className="bg-white border border-gray-250 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                          <option value="all">All Patrons</option>
                          {qrEntrancePatronTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-[#F8FAFC] text-gray-700 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500">Date & Time</th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500">Visitor</th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500">QR Pass Code</th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500">Target Floor / Area</th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500">Wi-Fi Voucher</th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500">Patron Type</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-150 text-xs text-slate-800">
                            {filteredQrEntranceLogs.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-405 italic font-mono uppercase bg-slate-50/40">
                                  No QR code entrance records yet.
                                </td>
                              </tr>
                            ) : (
                              paginatedQrEntranceLogs.map((l) => (
                                <tr key={l.id} className="hover:bg-cyan-50/40 transition-colors">
                                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{l.formattedDate}</td>
                                  <td className="px-4 py-3.5 font-bold text-[#1E3A8A] uppercase">{l.visitorsName}</td>
                                  <td className="px-4 py-3.5 font-mono text-[11px] text-cyan-700 font-bold whitespace-nowrap">{l.rfid}</td>
                                  <td className="px-4 py-3.5 font-bold text-slate-800 whitespace-nowrap">{l.qrEntranceArea || l.terminalLocation || l.area}</td>
                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    {(l.services || []).some((service) => String(service).toLowerCase().includes("wifi") || String(service).toLowerCase().includes("voucher")) ? (
                                      <div className="space-y-0.5">
                                        <span className="inline-block bg-emerald-50 text-emerald-800 text-[10px] font-extrabold uppercase py-0.5 px-2 rounded-md border border-emerald-200">
                                          1 Hour Voucher
                                        </span>
                                        {l.voucherCode && <div className="font-mono text-[9px] text-emerald-700">{l.voucherCode}</div>}
                                        {l.voucherExpiresAt && <div className="text-[9px] text-slate-500">Expires {new Date(l.voucherExpiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</div>}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-medium">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    <span className="bg-slate-100 text-slate-800 text-[10px] font-extrabold uppercase py-0.5 px-2 rounded-md border border-slate-205">
                                      {l.patronType}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-5 py-3 border-t border-gray-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                        <span className="font-mono">
                          Showing {filteredQrEntranceLogs.length === 0 ? 0 : (qrEntrancePage - 1) * qrEntranceRowsPerPage + 1}
                          {" - "}
                          {Math.min(qrEntrancePage * qrEntranceRowsPerPage, filteredQrEntranceLogs.length)}
                          {" of "}
                          {filteredQrEntranceLogs.length} records
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQrEntrancePage((p) => Math.max(1, p - 1))}
                            disabled={qrEntrancePage === 1}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-slate-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                          >
                            Previous
                          </button>
                          <span className="font-mono font-bold text-slate-700">
                            Page {qrEntrancePage} / {qrEntranceTotalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQrEntrancePage((p) => Math.min(qrEntranceTotalPages, p + 1))}
                            disabled={qrEntrancePage === qrEntranceTotalPages}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-slate-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. sub-tab active log attendance */}
                {activeTab === "logs" && (
                  <div className="space-y-6">
                    {/* A. Title Blocks */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h1 className="text-xl sm:text-2xl font-black text-slate-850 tracking-tight">
                            List of Visitors - RFID
                          </h1>
                          <p className="text-xs text-slate-400 italic mt-0.5">
                            Home / List of Visitors - RFID
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            onClick={async () => {
                              const result = await Swal.fire({
                                title: "Purge visitor ledger?",
                                text: "This will reset all logged visitor data. This action cannot be undone.",
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonText: "Purge ledger",
                                cancelButtonText: "Cancel",
                                confirmButtonColor: "#e11d48",
                                cancelButtonColor: "#64748b",
                                reverseButtons: true,
                              });
                              if (result.isConfirmed) onClearLogs();
                            }}
                            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                            Purge Ledger
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* B. Core Visitors Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      {/* Top ribbon border */}
                      <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />

                      <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                        <div>
                          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            List of Visitors - RFID
                          </h2>
                          <div className="h-0.5 w-16 bg-blue-500 mt-1" />
                        </div>

                        {/* Top quick-control bars */}
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
                          {/* Row Limit Selector */}
                          <div className="flex items-center gap-2 text-xs text-slate-600 font-sans">
                            <span className="font-medium">No. of rows:</span>
                            <select
                              value={logRowsPerPage}
                              onChange={(e) =>
                                setLogRowsPerPage(Number(e.target.value))
                              }
                              className="bg-white border border-gray-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                            </select>
                          </div>

                          {/* Green Excel File Exporter */}
                          <button
                            onClick={handleDownloadExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all uppercase cursor-pointer"
                          >
                            <FileSpreadsheet size={15} />
                            Download Excel File
                          </button>

                          {/* Search bar */}
                          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                            <Search
                              className="absolute left-2.5 top-2.5 text-slate-450"
                              size={13}
                            />
                            <input
                              type="text"
                              placeholder="Search..."
                              className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              value={logQuery}
                              onChange={(e) => setLogQuery(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* C. Multi-column Interactive Filter Ribbon */}
                      <div className="p-4 bg-slate-50 border-b border-gray-150 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
                        {/* From Date Filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 font-mono block uppercase">
                            From Date
                          </label>
                          <input
                            type="date"
                            value={logFromDate}
                            onChange={(e) => setLogFromDate(e.target.value)}
                            className="w-full bg-white border border-gray-250 rounded-lg p-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                        </div>

                        {/* To Date Filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 font-mono block uppercase">
                            To Date
                          </label>
                          <input
                            type="date"
                            value={logToDate}
                            onChange={(e) => setLogToDate(e.target.value)}
                            className="w-full bg-white border border-gray-250 rounded-lg p-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                        </div>

                        {/* Gender Filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 font-mono block uppercase">
                            Gender
                          </label>
                          <select
                            value={logGenderFilter}
                            onChange={(e) => setLogGenderFilter(e.target.value)}
                            className="w-full bg-white border border-gray-250 rounded-lg p-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="all">All Genders</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>

                        {/* Age Bracket Filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 font-mono block uppercase">
                            Age Bracket
                          </label>
                          <select
                            value={logAgeFieldFilter}
                            onChange={(e) =>
                              setLogAgeFieldFilter(e.target.value)
                            }
                            className="w-full bg-white border border-gray-250 rounded-lg p-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="all">All Ages</option>
                            <option value="13-21">13-21</option>
                            <option value="22-35">22-35</option>
                            <option value="0-12">0-12</option>
                            <option value="60+">60+</option>
                          </select>
                        </div>

                        {/* Institution Filter */}
                        <div className="space-y-1 col-span-1">
                          <label className="text-[10px] font-bold text-slate-500 font-mono block uppercase">
                            Institution
                          </label>
                          <select
                            value={logInstitutionFilter}
                            onChange={(e) =>
                              setLogInstitutionFilter(e.target.value)
                            }
                            className="w-full bg-white border border-gray-250 rounded-lg p-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="all">All Institutions</option>
                            {Array.from(
                              new Set(mappedLogs.map((m) => m.institution)),
                            )
                              .filter(Boolean)
                              .map((inst) => (
                                <option key={inst} value={inst}>
                                  {inst}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Patron Type Filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 font-mono block uppercase">
                            Patron Type
                          </label>
                          <select
                            value={logPatronTypeFilter}
                            onChange={(e) =>
                              setLogPatronTypeFilter(e.target.value)
                            }
                            className="w-full bg-white border border-gray-250 rounded-lg p-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="all">All Patrons</option>
                            {Array.from(
                              new Set(mappedLogs.map((m) => m.patronType)),
                            )
                              .filter(Boolean)
                              .map((pt) => (
                                <option key={pt} value={pt}>
                                  {pt}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Station Filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 font-mono block uppercase">
                            Station
                          </label>
                          <select
                            value={logStationFilter}
                            onChange={(e) =>
                              setLogStationFilter(e.target.value)
                            }
                            className="w-full bg-white border border-gray-250 rounded-lg p-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="all">All Stations</option>
                            {Array.from(
                              new Set(mappedLogs.map((m) => m.station)),
                            )
                              .filter(Boolean)
                              .map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Area Filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 font-mono block uppercase">
                            Area
                          </label>
                          <select
                            value={logAreaFilter}
                            onChange={(e) => setLogAreaFilter(e.target.value)}
                            className="w-full bg-white border border-gray-250 rounded-lg p-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="all">All Areas</option>
                            {Array.from(new Set(mappedLogs.map((m) => m.area)))
                              .filter(Boolean)
                              .map((ar) => (
                                <option key={ar} value={ar}>
                                  {ar}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* D. Main Data Table conforming fully to the layout screenshot */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-[#F8FAFC] text-gray-700 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 select-none">
                                {renderSortHeader("Date & Time", "checkInTime")}
                              </th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 select-none">
                                {renderSortHeader("Visitors", "visitorsName")}
                              </th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 select-none">
                                {renderSortHeader("Gender", "gender")}
                              </th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 select-none">
                                {renderSortHeader("Age Bracket", "ageBracket")}
                              </th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 select-none">
                                {renderSortHeader("Institution", "institution")}
                              </th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 select-none">
                                {renderSortHeader("Patron Type", "patronType")}
                              </th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 select-none">
                                {renderSortHeader("Station", "station")}
                              </th>
                              <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 select-none">
                                {renderSortHeader("Area", "area")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-150 text-xs text-slate-800">
                            {sortedLogs.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="px-6 py-12 text-center text-slate-405 italic font-mono uppercase bg-slate-50/40"
                                >
                                  No RFID scanning logs match the active filter
                                  configurations.
                                </td>
                              </tr>
                            ) : (
                              sortedLogs
                                .slice(0, logRowsPerPage)
                                .map((l, index) => {
                                  const isLatest =
                                    index === 0 && l.status === "ACTIVE";
                                  return (
                                    <tr
                                      key={l.id}
                                      className={`hover:bg-slate-50/80 transition-colors ${isLatest ? "bg-amber-50/15" : ""}`}
                                    >
                                      {/* 1. Date & Time */}
                                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                        {l.formattedDate}
                                      </td>

                                      {/* 2. Visitors Full Name */}
                                      <td className="px-4 py-3.5 font-bold text-[#1E3A8A]">
                                        <div className="flex flex-col">
                                          <span className="uppercase text-slate-900 font-bold">
                                            {l.visitorsName}
                                          </span>
                                          <span className="text-[9px] font-mono font-medium text-slate-400">
                                            RFID: {l.rfid}
                                          </span>
                                        </div>
                                      </td>

                                      {/* 3. Gender */}
                                      <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                            l.gender.toLowerCase() === "female"
                                              ? "bg-rose-50 text-rose-700 border border-rose-100"
                                              : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                          }`}
                                        >
                                          {l.gender}
                                        </span>
                                      </td>

                                      {/* 4. Age Bracket */}
                                      <td className="px-4 py-3.5 font-mono text-[11px] whitespace-nowrap text-slate-600">
                                        {l.ageBracket}
                                      </td>

                                      {/* 5. Institution */}
                                      <td
                                        className="px-4 py-3.5 font-medium text-slate-750 text-xs max-w-[150px] truncate"
                                        title={l.institution}
                                      >
                                        {l.institution}
                                      </td>

                                      {/* 6. Patron Type */}
                                      <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span className="bg-slate-100 text-slate-800 text-[10px] font-extrabold uppercase py-0.5 px-2 rounded-md border border-slate-205">
                                          {l.patronType}
                                        </span>
                                      </td>

                                      {/* 7. Station */}
                                      <td className="px-4 py-3.5 text-xs font-bold text-[#475569] whitespace-nowrap">
                                        {l.station}
                                      </td>

                                      {/* 8. Area */}
                                      <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${getAreaBadgeClass(l.area)}`}
                                        >
                                          {l.area}
                                        </span>
                                      </td>

                                    </tr>
                                  );
                                })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* E. Paging & Bottom Stat Ribbon matching screenshot specs */}
                      <div className="bg-slate-50 px-5 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div className="text-xs text-slate-500 font-medium font-sans">
                          Showing 1 to{" "}
                          {Math.min(logRowsPerPage, sortedLogs.length)} of{" "}
                          {sortedLogs.length} entries{" "}
                          {filteredLogs.length !== logs.length &&
                            `(filtered from ${logs.length} total)`}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            disabled={true}
                            className="px-3 py-1 bg-white border border-gray-200 rounded text-slate-450 font-bold uppercase cursor-not-allowed opacity-50"
                          >
                            Prev
                          </button>
                          <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded shadow-xs">
                            1
                          </button>
                          <button
                            disabled={true}
                            className="px-3 py-1 bg-white border border-gray-200 rounded text-slate-455 font-bold uppercase cursor-not-allowed opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dedicated CPLRC SUB RFID scanner ledger */}
                {activeTab === "cplrc-sub" && (
                  <div className="animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-600" />
                      <div className="p-5 border-b border-violet-100 bg-violet-50/50">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">CPLRC SUB — RFID Visitor Table</h2>
                            <p className="text-xs text-slate-500 mt-1">Visits recorded through the CPLRC SUB scanner only.</p>
                          </div>
                          <button
                            onClick={handleDownloadCplrcSub}
                            className="w-fit px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wide cursor-pointer"
                          >
                            <FileSpreadsheet size={14} /> Download Excel
                          </button>
                          <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto">
                            <input
                              type="date"
                              value={cplrcSubStartDate}
                              onChange={(e) => setCplrcSubStartDate(e.target.value)}
                              aria-label="CPLRC SUB start date"
                              className="py-2 px-3 text-xs border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            <input
                              type="date"
                              value={cplrcSubEndDate}
                              onChange={(e) => setCplrcSubEndDate(e.target.value)}
                              aria-label="CPLRC SUB end date"
                              className="py-2 px-3 text-xs border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            <div className="relative flex-1 md:w-56">
                              <Search className="absolute left-3 top-2.5 text-violet-400" size={14} />
                              <input
                                type="text"
                                value={cplrcSubQuery}
                                onChange={(e) => setCplrcSubQuery(e.target.value)}
                                placeholder="Search visitor or RFID..."
                                className="w-full pl-8 pr-3 py-2 text-xs border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                              />
                            </div>
                            <select
                              value={cplrcSubServiceFilter}
                              onChange={(e) => setCplrcSubServiceFilter(e.target.value)}
                              className="py-2 px-3 text-xs font-bold text-slate-700 border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                            >
                              <option value="all">All Services</option>
                              {cplrcSubServices.map((service) => <option key={service} value={service}>{service}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left">
                          <thead className="bg-violet-50 text-[10px] sm:text-xs font-bold text-violet-900 uppercase tracking-wider font-mono">
                            <tr>
                              <th className="px-5 py-3.5">Date &amp; Time</th>
                              <th className="px-5 py-3.5">Visitor</th>
                              <th className="px-5 py-3.5">RFID Code</th>
                              <th className="px-5 py-3.5">Institution</th>
                              <th className="px-5 py-3.5">Age Bracket</th>
                              <th className="px-5 py-3.5">Gender</th>
                              <th className="px-5 py-3.5">Patron Type</th>
                              <th className="px-5 py-3.5">Services Required</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200 text-xs text-slate-800">
                            {filteredCplrcSubLogs.length === 0 ? (
                              <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 italic font-mono uppercase">No CPLRC SUB scanner records match the active filters.</td></tr>
                            ) : (
                              filteredCplrcSubLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-violet-50/40 transition-colors">
                                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{log.formattedDate}</td>
                                  <td className="px-5 py-3.5 font-bold text-slate-900 uppercase">{log.visitorsName}</td>
                                  <td className="px-5 py-3.5 font-mono font-bold text-violet-700 whitespace-nowrap">{log.rfid}</td>
                                  <td className="px-5 py-3.5 font-medium text-slate-700">{log.institution}</td>
                                  <td className="px-5 py-3.5 font-mono text-slate-600 whitespace-nowrap">{log.ageBracket}</td>
                                  <td className="px-5 py-3.5 text-slate-700">{log.gender}</td>
                                  <td className="px-5 py-3.5 font-bold text-slate-700 whitespace-nowrap">{log.patronType}</td>
                                  <td className="px-5 py-3.5"><div className="flex flex-wrap gap-1">{(log.services || []).map((service) => <span key={service} className="bg-violet-50 text-violet-800 border border-violet-100 px-2 py-0.5 rounded-md text-[10px] font-bold">{service}</span>)}</div></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. sub-tab analytics metrics and stats */}
                {activeTab === "statistics" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 select-none">
                    {/* Utilized Services bars chart */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-150">
                      <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Sparkles className="text-amber-500" size={16} /> Most
                        Utilized Services Index
                      </h3>

                      <div className="space-y-4">
                        {formattedServices.map((srv, index) => {
                          const maxCount = Math.max(
                            ...formattedServices.map((i) => i.count),
                            1,
                          );
                          const widthPercentage = Math.round(
                            (srv.count / maxCount) * 100,
                          );
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-xs font-bold text-slate-800">
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-sm bg-[#1D4ED8]" />
                                  {srv.name}
                                </span>
                                <span className="text-gray-500 font-mono">
                                  {srv.count} requests
                                </span>
                              </div>

                              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/40">
                                <div
                                  className="h-full bg-blue-600 rounded-full transition-all duration-1000 animate-in slide-in-from-left"
                                  style={{ width: `${widthPercentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Classifications spread */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-150 flex flex-col justify-between">
                      <div>
                        <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                          <Layers className="text-blue-500" size={16} /> Patron
                          Demographics Spread
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                          {Array.from(
                            new Set(users.map((u) => u.patronType)),
                          ).map((type, idx) => {
                            const count = users.filter(
                              (u) => u.patronType === type,
                            ).length;
                            return (
                              <div
                                key={idx}
                                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl"
                              >
                                <span className="text-[9px] uppercase font-mono text-gray-400 block tracking-widest leading-none mb-1 font-black truncate">
                                  {type}
                                </span>
                                <span className="text-xl font-extrabold text-[#1E3A8A] leading-none">
                                  {count}
                                </span>
                                <span className="text-[9px] text-gray-400 block leading-none mt-1 font-semibold">
                                  {Math.round(
                                    (count / (users.length || 1)) * 100,
                                  )}
                                  % of Database
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 leading-normal font-sans">
                        💡 <strong>Summary Analysis:</strong> Students hold the
                        highest service request rate in the Cagayan Learning and
                        Resource Center, actively utilizing computer terminal
                        logbooks for research purposes.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW: SIDEBAR TAB - RESERVATIONS (HIGH FIDELITY LEDGER) */}
          {/* ========================================================= */}
          {sidebarTab === "reservations" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-3 bg-white border border-amber-200 rounded-2xl px-5 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-600">
                    Reservation Queue
                  </span>
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-800 mt-1">
                    Pending Reservations
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-11 min-w-14 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center px-4 text-2xl font-black font-mono">
                    {pendingReservationsCount}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 max-w-[220px]">
                    awaiting admin review in the scheduled reservations ledger
                  </span>
                </div>
              </div>

              {/* Left Column: Register Reservation scheduling form */}
              <div className="xl:col-span-1 bg-white p-5 rounded-3xl border border-gray-200/80 shadow-md h-fit">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-mono">
                  ROOM / TERMINAL BOOKING REGISTRY
                </span>

                {/* Interactive Grid Calendar showing availability for Admin Reservations */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-blue-50/50 mt-4 mb-5 text-center">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="w-8 h-8 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-extrabold text-sm flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    >
                      ‹
                    </button>
                    <span className="font-extrabold text-sm text-[#1D4ED8]">
                      {monthNames[calendarMonth]} {calendarYear}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="w-8 h-8 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-extrabold text-sm flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    >
                      ›
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-800 mb-2 font-sans select-none">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 select-none">
                    {calendarRows.map((dayNum, idx) => {
                      if (dayNum === null) return <div key={`empty-${idx}`} className="aspect-square" />;
                      
                      const monthStr = (calendarMonth + 1).toString().padStart(2, "0");
                      const dayStr = dayNum.toString().padStart(2, "0");
                      const formattedDate = `${calendarYear}-${monthStr}-${dayStr}`;
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dayDate = new Date(calendarYear, calendarMonth, dayNum);
                      const isToday = dayDate.getTime() === today.getTime();
                      const isSelected = newResDate === formattedDate;
                      const blockObj = blockedDays[formattedDate];
                      
                      let bgClass = "bg-white border border-slate-200 text-slate-800 hover:bg-blue-50 hover:border-blue-200";
                      let tooltip = "";

                      if (isToday) {
                        bgClass = "bg-[#10B981] text-white border-2 border-emerald-500 font-extrabold shadow-sm";
                        tooltip = "Today - Active Access Day";
                      } else if (blockObj) {
                        if (blockObj.status === "holiday") {
                          bgClass = "bg-[#DC2626] text-white font-bold border border-rose-500";
                          tooltip = `Holiday: ${blockObj.reason}`;
                        } else {
                          bgClass = "bg-[#F97316] text-white font-bold border border-amber-500";
                          tooltip = `Closed: ${blockObj.reason}`;
                        }
                      } else if (isSelected) {
                        bgClass = "bg-blue-50 border-2 border-[#1D4ED8] text-[#1D4ED8] scale-105 shadow-inner font-extrabold";
                      }

                      return (
                        <button
                          type="button"
                          key={`day-${dayNum}`}
                          onClick={() => handleCalendarDayClick(dayNum)}
                          title={tooltip || `Day ${dayNum}`}
                          className={`aspect-square flex items-center justify-center rounded-lg text-[11px] font-bold transition-all cursor-pointer ${bgClass}`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <p className="text-[10px] text-blue-600 font-bold font-mono mt-3 select-none">
                    ✓ Targeted Date: <span className="bg-[#1D4ED8] text-white px-2 py-0.5 rounded text-[10.5px] font-black">{newResDate}</span>
                  </p>
                </div>

                {/* Legend for Admin Reservations */}
                <div className="flex flex-wrap gap-4 justify-center text-[9px] font-black text-slate-500 uppercase tracking-widest mb-6 select-none border-b border-slate-100 pb-5">
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
                    <span>Holiday</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#10B981] border border-emerald-500" />
                    <span>Today</span>
                  </div>
                </div>

                <form
                  onSubmit={handleCreateReservation}
                  className="mt-4 space-y-4"
                >
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block mb-1 uppercase">
                      Patron Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maria Sophia, Danilo Corpuz"
                      value={newResName}
                      onChange={(e) => setNewResName(e.target.value)}
                      className="border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs w-full focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-800 bg-slate-50 font-sans font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block mb-1 uppercase">
                      Patron level classification
                    </label>
                    <select
                      value={newResPatronType}
                      onChange={(e) => setNewResPatronType(e.target.value)}
                      className="border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs w-full focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-slate-50 font-sans font-semibold"
                    >
                      <option value="Student">Student</option>
                      <option value="Researcher">Researcher</option>
                      <option value="Professional / Teacher">
                        Professional / Teacher
                      </option>
                      <option value="LGU Official">LGU Official</option>
                      <option value="General Public">General Public</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block mb-1 uppercase">
                      Room
                    </label>
                    <select
                      value={newResRoom}
                      onChange={(e) => {
                        setNewResRoom(e.target.value);
                        setNewResTimeSlot("");
                      }}
                      className="border border-gray-300 rounded-xl px-2 py-2 text-[10px] w-full focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-slate-50 font-semibold"
                    >
                      {rooms.map((room) => (
                        <option key={room.name} value={room.name} disabled={!room.enabled}>
                          {room.enabled ? room.name : `${room.name} - Unavailable`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block mb-1 uppercase">
                      Time Slot
                    </label>
                    <select
                      value={newResTimeSlot}
                      onChange={(e) => setNewResTimeSlot(e.target.value)}
                      className="border border-gray-300 rounded-xl px-2 py-2 text-[10px] w-full focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-slate-50 font-semibold"
                      required
                    >
                      <option value="">Select Time</option>
                      {adminReservationTimeSlots.map((slot) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block mb-1 uppercase">
                      Purpose of Booking
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Group thesis presentation, CPU exam prep"
                      value={newResPurpose}
                      onChange={(e) => setNewResPurpose(e.target.value)}
                      className="border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs w-full focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-800 bg-slate-50 font-semibold"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#1D4ED8] hover:bg-blue-850 text-white font-extrabold text-xs rounded-xl shadow-md uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Register Booking
                  </button>
                </form>
              </div>

              {/* Right Column: Bookings Lists table */}
              <div className="xl:col-span-2 space-y-4">
                <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-md">
                  <h3 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-widest pl-1 mb-4 select-none">
                    CPLRC Scheduled Reservations Ledger
                  </h3>

                  <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-xs sm:text-sm font-sans">
                      <thead className="bg-slate-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                        <tr>
                          <th className="px-5 py-3">Patron Name</th>
                          <th className="px-5 py-3">Booking Slot</th>
                          <th className="px-5 py-3">Purpose</th>
                          <th className="px-5 py-3 text-center">File</th>
                          <th className="px-5 py-3 text-center">Status</th>
                          <th className="px-5 py-3 text-center">Controls</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 font-semibold">
                        {reservations.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-5 py-8 text-center text-gray-400 italic font-mono uppercase"
                            >
                              No room reservations catalogued. Use input
                              scheduling cards.
                            </td>
                          </tr>
                        ) : (
                          paginatedReservations.map((res) => (
                            <tr
                              key={res.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-5 py-3">
                                <div className="font-extrabold text-slate-800">
                                  {res.name}
                                </div>
                                <span className="text-[9.5px] text-gray-400 font-mono block uppercase">
                                  {res.patronType}
                                </span>
                              </td>

                              <td className="px-5 py-3 font-mono text-[10.5px]">
                                <div className="text-slate-700">{res.date}</div>
                                <span className="text-[9px] text-blue-500 font-bold font-sans block">
                                  {res.timeSlot}
                                </span>
                                {res.room && (
                                  <div className="mt-1 flex flex-wrap gap-1 items-center">
                                    <span className="bg-blue-50 text-blue-800 text-[8px] font-sans font-black px-1.5 py-0.5 rounded uppercase tracking-wide">
                                      {res.room}
                                    </span>
                                    {res.attendees && (
                                      <span className="bg-amber-50 text-amber-800 text-[8px] font-sans font-black px-1.5 py-0.5 rounded tracking-wide">
                                        {res.attendees} pax
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-3 max-w-[150px] truncate">
                                <span className="text-slate-600 text-xs italic">
                                  {res.purpose}
                                </span>
                              </td>

                              <td className="px-5 py-3 text-center">
                                {res.attachment?.dataUrl ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadReservationAttachment(
                                        res.attachment,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-blue-700 border border-blue-100 hover:bg-blue-100 cursor-pointer"
                                    title={`Download ${res.attachment.name}`}
                                  >
                                    <Download size={12} />
                                    File
                                  </button>
                                ) : (
                                  <span className="text-[9px] font-mono font-bold text-slate-300 uppercase">
                                    None
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    res.status === "PENDING"
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : res.status === "APPROVED"
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : "bg-rose-100 text-rose-800 border border-rose-200"
                                  }`}
                                >
                                  {res.status}
                                </span>
                              </td>

                              <td className="px-5 py-3 text-center">
                                <div className="flex gap-1.5 justify-center">
                                  {res.status === "PENDING" ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          handleUpdateReservationStatus(
                                            res.id,
                                            "APPROVED",
                                          )
                                        }
                                        className="p-1 px-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded font-bold uppercase text-[9px] border border-emerald-200 cursor-pointer"
                                        title="Approve booking"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() =>
                                          openRejectReservationModal(res)
                                        }
                                        className="p-1 px-1.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded font-bold uppercase text-[9px] border border-rose-200 cursor-pointer"
                                        title="Decline booking"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setReservations((prev) =>
                                          prev.filter(
                                            (item) => item.id !== res.id,
                                          ),
                                        );
                                      }}
                                      className="p-1 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded border border-slate-200 cursor-pointer"
                                      title="Purge bookkeeping log"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-1 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="font-mono">
                      Showing {reservations.length === 0 ? 0 : (reservationPage - 1) * reservationsRowsPerPage + 1}
                      {" - "}
                      {Math.min(reservationPage * reservationsRowsPerPage, reservations.length)}
                      {" of "}
                      {reservations.length} reservations
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
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW: SIDEBAR TAB - SETTINGS (SYSTEM CONFIGURATION)      */}
          {/* ========================================================= */}
          {sidebarTab === "settings" && effectiveRole === "superadmin" && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200/80 overflow-hidden animate-in fade-in duration-300">
              {/* Tabs strip matching Visitors design */}
              <div className="flex flex-nowrap overflow-x-auto border-b border-gray-200 bg-slate-50/50 p-2 gap-1 [scrollbar-width:thin]">
                <button
                  onClick={() => setSettingsTab("institutions")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    settingsTab === "institutions"
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <Building size={16} /> Affiliated Institutions
                </button>
                <button
                  onClick={() => setSettingsTab("patrons")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    settingsTab === "patrons"
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <Users size={16} /> Patron Identifications
                </button>
                <button
                  onClick={() => setSettingsTab("rooms")}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
                    settingsTab === "rooms"
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200/40"
                      : "text-gray-500 hover:text-gray-800 hover:bg-slate-100/50"
                  }`}
                >
                  <Calendar size={16} /> Room Settings
                </button>
              </div>

              <div className="p-4 sm:p-6">
                {settingsTab === "institutions" && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        Institution Management
                      </h3>
                      <p className="text-[11px] text-slate-500 mb-6">
                        Configure the list of campuses and offices available for member registration.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2 mb-6 max-w-2xl">
                        <input
                          type="text"
                          value={newInstInput}
                          onChange={(e) => setNewInstInput(e.target.value)}
                          placeholder="Enter new campus or institution name..."
                          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-700 bg-slate-50"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddInstitution()}
                        />
                        <button
                          onClick={handleAddInstitution}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md cursor-pointer"
                        >
                          Add Item
                        </button>
                      </div>

                      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white max-w-2xl">
                        <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Registered Institutions ({institutions.length})
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                          {institutions.map((inst, index) => (
                            <div key={index} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                              <span className="text-xs font-bold text-slate-700 uppercase">{inst}</span>
                              <button
                                onClick={async () => {
                                  const result = await Swal.fire({
                                    title: "Remove institution?",
                                    text: `Are you sure you want to remove "${inst}"?`,
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonText: "Remove",
                                    cancelButtonText: "Cancel",
                                    confirmButtonColor: "#e11d48",
                                    cancelButtonColor: "#64748b",
                                    reverseButtons: true,
                                  });
                                  if (!result.isConfirmed) return;
                                  try {
                                    await api.settings.removeInstitution(inst);
                                    setInstitutions((current) => current.filter((item) => item !== inst));
                                  } catch (error) {
                                    alert(error.message || "Unable to remove institution.");
                                  }
                                }}
                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all md:opacity-0 group-hover:opacity-100 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === "patrons" && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        Patron Level Management
                      </h3>
                      <p className="text-[11px] text-slate-500 mb-6">
                        Update the classification levels for library users (e.g., Guest Speaker, Researcher).
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2 mb-6 max-w-2xl">
                        <input
                          type="text"
                          value={newPatronInput}
                          onChange={(e) => setNewPatronInput(e.target.value)}
                          placeholder="Enter new patron type..."
                          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-700 bg-slate-50"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddPatronType()}
                        />
                        <button
                          onClick={handleAddPatronType}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md cursor-pointer"
                        >
                          Add Item
                        </button>
                      </div>

                      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white max-w-2xl">
                        <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Registered Patron Levels ({patronTypes.length})
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                          {patronTypes.map((type, index) => (
                            <div key={index} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                              <span className="text-xs font-bold text-slate-700 uppercase">{type}</span>
                              <button
                                onClick={async () => {
                                  const result = await Swal.fire({
                                    title: "Remove patron type?",
                                    text: `Are you sure you want to remove "${type}"?`,
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonText: "Remove",
                                    cancelButtonText: "Cancel",
                                    confirmButtonColor: "#e11d48",
                                    cancelButtonColor: "#64748b",
                                    reverseButtons: true,
                                  });
                                  if (!result.isConfirmed) return;
                                  try {
                                    await api.settings.removePatronType(type);
                                    setPatronTypes((current) => {
                                      const nextPatronTypes = current.filter((item) => item !== type);
                                      localStorage.setItem("plrc_patron_types", JSON.stringify(nextPatronTypes));
                                      return nextPatronTypes;
                                    });
                                  } catch (error) {
                                    alert(error.message || "Unable to remove patron type.");
                                  }
                                }}
                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all md:opacity-0 group-hover:opacity-100 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === "rooms" && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        Room Availability Management
                      </h3>
                      <p className="text-[11px] text-slate-500 mb-6">
                        Add booking rooms, or disable a room while it is under maintenance or already unavailable. Disabled rooms cannot be selected in the client reservation form.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2 mb-6 max-w-2xl">
                        <input
                          type="text"
                          value={newRoomInput}
                          onChange={(e) => setNewRoomInput(e.target.value)}
                          placeholder="Enter new room name..."
                          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-700 bg-slate-50"
                          onKeyDown={(e) => e.key === "Enter" && handleAddRoom()}
                        />
                        <button
                          type="button"
                          onClick={handleAddRoom}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md cursor-pointer"
                        >
                          Add Room
                        </button>
                      </div>

                      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white max-w-3xl">
                        <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Booking Rooms ({rooms.length})
                        </div>
                        <div className="divide-y divide-gray-100">
                          {rooms.map((room) => (
                            <div key={room.name} className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between hover:bg-slate-50 transition-colors">
                              <div>
                                <div className="text-xs font-bold text-slate-700 uppercase">{room.name}</div>
                                {!room.enabled && <div className="text-[10px] font-semibold text-rose-600 mt-1">Unavailable: {room.disabledReason || "Unavailable"}</div>}
                                <div className="text-[10px] font-semibold text-slate-500 mt-1">
                                  {room.timeSlots?.length || getDefaultRoomTimeSlots(room.name).length} configured time slots
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => configureRoomTimeSlots(room)}
                                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                >
                                  Configure Times
                                </button>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${room.enabled ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
                                  {room.enabled ? "Available" : "Disabled"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleRoomAvailability(room.name)}
                                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors cursor-pointer ${room.enabled ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"}`}
                                >
                                  {room.enabled ? "Disable" : "Enable"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {roomDisableModal && (
        <div
          className="fixed inset-0 z-[96] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRoomDisableModal(null);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-700 to-rose-500 px-5 py-4 text-white flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-100">
                  Disable Room
                </p>
                <h3 className="text-lg font-black mt-1">{roomDisableModal.roomName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setRoomDisableModal(null)}
                className="p-1.5 rounded-lg text-rose-100 hover:text-white hover:bg-white/15 transition-colors"
                title="Close disable room dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                Why is this room unavailable?
              </label>
              <textarea
                autoFocus
                value={roomDisableModal.reason}
                onChange={(event) =>
                  setRoomDisableModal((current) => ({ ...current, reason: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) confirmRoomDisable();
                }}
                rows={4}
                placeholder="For example: Maintenance or reserved for a private event"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRoomDisableModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRoomDisable}
                  disabled={!roomDisableModal.reason.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Disable Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {roomTimeSlotEditor && (
        <div
          className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRoomTimeSlotEditor(null);
          }}
        >
          <div className="w-full max-w-lg my-auto bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#1E3A8A] to-blue-600 px-5 py-4 text-white flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">
                  Reservation Time Settings
                </p>
                <h3 className="text-lg font-black mt-1">{roomTimeSlotEditor.roomName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setRoomTimeSlotEditor(null)}
                className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors"
                title="Close time settings"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                Time Slots
              </label>
              <textarea
                value={roomTimeSlotEditor.timeSlots}
                onChange={(event) =>
                  setRoomTimeSlotEditor((current) => ({
                    ...current,
                    timeSlots: event.target.value,
                  }))
                }
                rows={5}
                placeholder="8:00am-9:00am, 9:00am-10:00am"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-2">
                Separate each available time slot with a comma.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRoomTimeSlotEditor(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoomTimeSlots}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 shadow-sm"
                >
                  Save Time Slots
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCalendarReservationDate && (
        <div
          className="fixed inset-0 z-[85] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCalendarReservationDate(null);
          }}
        >
          <div className="w-full max-w-2xl my-auto bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#1E3A8A] to-blue-600 px-5 py-4 text-white flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">CPLRC Calendar Reservations</p>
                <h3 className="text-lg font-black mt-1">Reservations for {selectedCalendarReservationDate}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCalendarReservationDate(null)}
                className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors"
                title="Close reservation details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 max-h-[65vh] overflow-y-auto">
              {(() => {
                const selectedDayReservations = reservations.filter(
                  (reservation) => reservation.date === selectedCalendarReservationDate,
                );

                if (selectedDayReservations.length === 0) {
                  return (
                    <div className="py-10 text-center text-slate-500">
                      <Calendar size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-bold">No reservation requests for this date.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-500 font-semibold">
                      {selectedDayReservations.length} reservation{selectedDayReservations.length > 1 ? "s" : ""} found
                    </p>
                    {selectedDayReservations.map((reservation) => (
                      <div key={reservation.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase">{reservation.name || "Guest"}</h4>
                            <p className="text-[11px] font-bold text-slate-500 mt-1">{reservation.patronType || "Library Guest"}</p>
                          </div>
                          <span className={`w-fit px-2 py-1 rounded-md text-[9px] font-black uppercase ${reservation.status === "APPROVED" ? "bg-blue-100 text-blue-800" : reservation.status === "REJECTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                            {reservation.status || "PENDING"}
                          </span>
                        </div>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                          <div className="bg-white border border-slate-150 rounded-lg px-3 py-2">
                            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400">Time</dt>
                            <dd className="font-bold text-slate-700 mt-0.5">{reservation.timeSlot || "Time to be confirmed"}</dd>
                          </div>
                          <div className="bg-white border border-slate-150 rounded-lg px-3 py-2">
                            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400">Room</dt>
                            <dd className="font-bold text-slate-700 mt-0.5">{reservation.room || "General Space"}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {rejectingReservation && (
        <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitReservationRejection}
            className="w-full max-w-md my-auto bg-white rounded-2xl shadow-2xl border border-rose-100 p-4 sm:p-5"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-rose-600">
                  Reject Reservation
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-1">
                  {rejectingReservation.name}
                </h3>
                <p className="text-[10.5px] font-bold text-slate-500 mt-1">
                  {rejectingReservation.date} |{" "}
                  {rejectingReservation.timeSlot}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRejectReservationModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Close rejection modal"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                Reason for rejection
              </label>
              <textarea
                value={reservationRejectReason}
                onChange={(e) => setReservationRejectReason(e.target.value)}
                rows={5}
                placeholder="Write the reason so the client can see it in notifications."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                required
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRejectReservationModal}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-rose-700 shadow-sm"
              >
                Reject Booking
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ==================== NEW RECORD FORM MODAL (IMAGE PERFECT) ================ */}
      {/* ========================================================================= */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden my-auto sm:my-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            {/* Modal Header bar */}
            <div className="bg-blue-600 px-4 sm:px-6 py-4 flex justify-between items-center text-white border-b border-blue-700">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight select-none">
                {editingUser ? "Edit Member Record" : "New Record"}
              </h1>
              <button
                onClick={() => {
                  setShowNewUserModal(false);
                  setEditingUser(null);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all"
              >
                <X size={20} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Modal Contents Form */}
            <form
              onSubmit={handleFormSubmit}
              className="p-4 sm:p-6 overflow-y-auto max-h-[78vh] font-sans"
            >
              {/* Form Input Columns: matched EXACTLY with Picture */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* Column 1 */}
                <div className="space-y-4">
                  {/* RFID input */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-blue-600 block pl-1 mb-1 font-sans">
                      RFID ACCESS BARCODE KEY *
                    </label>
                    <input
                      type="text"
                      name="rfid"
                      placeholder="RFID Code"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400 font-mono"
                      value={formData.rfid}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      LAST NAME *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Last Name"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Middle Name */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      MIDDLE NAME
                    </label>
                    <input
                      type="text"
                      name="middleName"
                      placeholder="Middle Name"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                      value={formData.middleName}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Birthday with small tiny label like picture */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-blue-600 block pl-1 mb-1 font-sans">
                      Birthday *
                    </label>
                    <input
                      type="date"
                      name="birthday"
                      placeholder="mm/dd/yyyy"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-650"
                      value={formData.birthday}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      HOME ADDRESS
                    </label>
                    <input
                      type="text"
                      name="address"
                      placeholder="Address"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Gender dropdown */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      SEX / GENDER
                    </label>
                    <select
                      name="gender"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-600 bg-white"
                      value={formData.gender}
                      onChange={handleInputChange}
                    >
                      <option value="" disabled>-- Choose Gender --</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      
                    </select>
                  </div>

                  {/* Institution Dropdown / Input combo */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      AFFILIATED CAMPUS / INSTITUTION
                    </label>
                    <select
                      name="institution"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-650 bg-white"
                      value={formData.institution}
                      onChange={handleInputChange}
                    >
                      <option value="" disabled>-- Choose Registered Institution --</option>
                      {institutions.map((inst, idx) => (
                        <option key={idx} value={inst}>
                          {inst}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-4">
                  {/* Password */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      PORTAL PASSWORD
                    </label>
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400 font-mono"
                      value={formData.password}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Given Name */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      GIVEN NAME *
                    </label>
                    <input
                      type="text"
                      name="givenName"
                      placeholder="Given Name"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                      value={formData.givenName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      EMAIL ADDRESS
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      PHONE NUMBER
                    </label>
                    <input
                      type="text"
                      name="phone"
                      placeholder="Phone"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400 font-mono"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Marital Status */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      MARITAL STATUS
                    </label>
                    <select
                      name="maritalStatus"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-650 bg-white"
                      value={formData.maritalStatus}
                      onChange={handleInputChange}
                    >
                      <option value="" disabled>-- MARITAL STATUS --</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>

                  {/* Age Bracket */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      AGE BRACKET
                    </label>
                    <select
                      name="ageBracket"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-650 bg-white"
                      value={formData.ageBracket}
                      onChange={handleInputChange}
                    >
                      <option value="Children (0-12)">Children (0-12)</option>
                      <option value="Youth (13-24)">Youth (13-24)</option>
                      <option value="Adult (25-59)">Adult (25-59)</option>
                      <option value="Senior Citizen (60+)">
                        Senior Citizen (60+)
                      </option>
                    </select>
                  </div>

                  {/* Patron Type */}
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block pl-1 mb-1">
                      PATRON IDENTIFICATION
                    </label>
                    <select
                      name="patronType"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-650 bg-white"
                      value={formData.patronType}
                      onChange={handleInputChange}
                    >
                      {patronTypes.map((type, idx) => (
                        <option key={idx} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Emergency Contact Form Segment */}
              <div className="mt-6 border-t border-gray-100 pt-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <input
                      type="text"
                      name="emergencyName"
                      placeholder="Full Name"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                      value={formData.emergencyName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      name="emergencyPhone"
                      placeholder="Phone"
                      className="border border-gray-300 rounded-xl px-4 py-2.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400 font-mono"
                      value={formData.emergencyPhone}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              {/* Footer row: Seal, profile upload, and Save button */}
              <div className="mt-8 border-t border-gray-150 pt-3.5 flex flex-col sm:flex-row items-center justify-between gap-6 pb-2">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <PLRCLogo size={100} className="hidden xs:flex" />
                  <div
                    onClick={() => formData.photoUrl ? setFormData(p => ({...p, photoUrl: ""})) : fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-4 w-44 h-24 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50 relative overflow-hidden group select-none"
                  >
                    {formData.photoUrl ? (
                      <>
                        <img src={formData.photoUrl} alt="Avatar profile" className="w-full h-full object-cover rounded-lg animate-in fade-in" />
                        <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center text-white text-[10px] font-bold">CLICK TO REMOVE</div>
                      </>
                    ) : (
                      <>
                        <Camera className="text-gray-400 mb-1 group-hover:text-blue-500 transition-colors" size={22} />
                        <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600 transition-colors leading-tight">Click or Drag Image Here</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleGenerateMockPhoto(); }} className="mt-1 pb-0.5 text-[8.5px] font-bold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-1 rounded cursor-pointer">Generate Portrait</button>
                      </>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                  </div>
                </div>
                <div className="w-full sm:w-auto self-end">
                  <button type="submit" disabled={isSubmittingUser} className="w-full sm:w-auto px-8 py-3 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold text-xs rounded-lg shadow-md hover:shadow-lg transition-all uppercase tracking-widest border border-blue-800 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">{isSubmittingUser ? "Saving..." : "Save Changes"}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QR REGISTRATION MODAL (SUPERADMIN ONLY) */}
      {/* ========================================================================= */}
      {showQrRegistrationModal && effectiveRole === "superadmin" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center text-white border-b border-emerald-700">
              <h1 className="text-xl font-extrabold tracking-tight select-none">New Client QR </h1>
              <button onClick={() => setShowQrRegistrationModal(false)} className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X size={20} className="stroke-[2.5]" />
              </button>
            </div>
            <div className="max-h-[60vh] sm:max-h-[75vh] overflow-y-auto bg-slate-900">
              <QRRegistration onAddQrClient={onAddQrClient} onBackToScanner={() => setShowQrRegistrationModal(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN QR CARD DOWNLOAD POPUP (ID PREVIEW) */}
      {/* ========================================================================= */}
      {adminQrModalUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5 text-center relative select-none">
            <button onClick={() => setAdminQrModalUser(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-900 cursor-pointer">
              <X size={18} />
            </button>
            <div className="flex justify-center">
              <div className="w-full max-w-[320px] bg-white border border-slate-300 rounded-2xl p-3 sm:p-4 shadow-inner text-slate-900 relative overflow-hidden">
                {/* ID Background Image */}
                <img src="/images/id-card.png" alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                <div className="relative z-10">
                  <div className="absolute top-0 right-0 font-mono text-[7px] text-slate-400 tracking-wider">
                    MEMBER PASS • STATE DIGITAL GATE
                  </div>
                  <div className="flex gap-2 sm:gap-4 items-center mb-4 min-w-0 pr-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-300 shrink-0">
                      <PLRCLogo size={28} />
                    </div>
                    <div>
                      <h3 className="text-[10px] font-black tracking-tight leading-none uppercase text-slate-900">
                        Provincial of Cagayan
                      </h3>
                      <p className="text-[7.5px] font-mono font-bold text-slate-500 tracking-wide mt-1 uppercase break-words">
                        Cagayan Provincial Learning and Resource Center
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-center mb-4 shadow-inner">
                    {adminQrCodeUrl ? (
                      <img src={adminQrCodeUrl} alt="QR Pass" className="w-32 h-32 sm:w-36 sm:h-36 rounded mix-blend-multiply" />
                    ) : (
                      <div className="h-6 w-6 border-2 border-emerald-600 animate-spin border-t-transparent rounded-full" />
                    )}
                  </div>
                  <div className="space-y-1.5 font-sans border-t border-slate-200/50 pt-3 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">Full name</span>
                      <span className="text-[10px] font-black text-slate-900 uppercase truncate min-w-0"><span className="text-blue-600">▶</span> {[adminQrModalUser.givenName, adminQrModalUser.middleName, adminQrModalUser.lastName].filter(Boolean).join(" ")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">Patron Type</span>
                      <span className="text-[9px] font-black text-emerald-700 uppercase truncate min-w-0"><span className="text-blue-600">▶</span> {adminQrModalUser.patronIdentification || adminQrModalUser.patronType || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">ADDRESS:</span>
                      <span className="text-[9px] font-bold text-slate-800 italic truncate min-w-0"><span className="text-blue-600">▶</span> {adminQrModalUser.address || "CAGAYAN PROVINCE"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">INSTITUTION:</span>
                      <span className="text-[9px] font-bold text-slate-800 italic truncate min-w-0"><span className="text-blue-600">▶</span> {adminQrModalUser.institution || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">QR CODE:</span>
                      <span className="text-[10px] font-mono font-black text-cyan-700"><span className="text-blue-600">▶</span> {adminQrModalUser.rfid}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => {
                if (!adminQrCodeUrl) return;
                const link = document.createElement("a");
                link.href = adminQrCodeUrl;
                link.download = `CPLRC_QR_${adminQrModalUser.givenName}_${adminQrModalUser.lastName}.png`;
                link.click();
              }} className="flex-1 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-mono text-[10px] font-bold uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"><Download size={11} /> Save Pass Image</button>
              <button type="button" onClick={() => setAdminQrModalUser(null)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase rounded-xl shadow cursor-pointer">Done Viewing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
