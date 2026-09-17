/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Wifi,
  BatteryCharging,
  Monitor,
  BookOpen,
  Library,
  Printer,
  User,
  Rss,
  CheckCircle,
  XCircle,
  LogOut,
  Hash,
  Activity,
  HelpCircle,
  QrCode,
  Camera,
  Upload,
  Sparkles,
  RefreshCw,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PLRCLogo, CagayanProvinceSeal } from "./Logo";
import jsQR from "jsqr";
import { QRRegistration } from "./QRRegistration";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { api } from "../services/api";

// Icon helper to render the accurate Lucide icon
export const ServiceIcon = ({ name, className = "", size = 24 }) => {
  switch (name) {
    case "Wifi":
      return <Wifi className={className} size={size} />;
    case "BatteryCharging":
      return <BatteryCharging className={className} size={size} />;
    case "Monitor":
      return <Monitor className={className} size={size} />;
    case "BookOpen":
      return <BookOpen className={className} size={size} />;
    case "Library":
      return <Library className={className} size={size} />;
    case "Printer":
      return <Printer className={className} size={size} />;
    case "Activity":
      return <Activity className={className} size={size} />;
    case "User":
      return <User className={className} size={size} />;
    case "Rss":
      return <Rss className={className} size={size} />;
    default:
      return <HelpCircle className={className} size={size} />;
  }
};

export const RFIDScannerSim = ({
  users,
  logs,
  qrClients = [],
  onAddLog,
  onUpdateLog, // This prop is not used in the current version of the component.
  onRegisterClick,
  initialScanMethod = "RFID",
  onAddQrClient,
  onQrClientsRefresh,
  initialTerminalLocation = "1F WALK-IN RECEPTION",
  onlyQrMode = false,
  manualRfidScan = null,
  manualRfid = "",
  onManualRfidChange,
  onManualRfidSubmit,
}) => {
  const [rfidInput, setRfidInput] = useState("");
  const [scannedUser, setScannedUser] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [scannerState, setScannerState] = useState("IDLE");
  const [selectedServices, setSelectedServices] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState(null);
  const [pagesToPrint, setPagesToPrint] = useState(1);
  const hardwareInputRef = React.useRef(null);
  const hardwareBufferRef = React.useRef("");
  const hardwareFlushTimerRef = React.useRef(null);
  const latestHandleScanRef = React.useRef(null);
  // Real-time ticker state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scanMethod, setScanMethod] = useState(initialScanMethod); // "RFID" | "WEBCAM" | "UPLOAD" | "SIM_DROP"
  const quotaResetMs = 12 * 60 * 60 * 1000;

  useEffect(() => {
    setScanMethod(initialScanMethod);
  }, [initialScanMethod]);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const cameraRequestRef = React.useRef(0);
  const [webcamError, setWebcamError] = useState("");
  const [cameraNotice, setCameraNotice] = useState("");
  const [webcamScanning, setWebcamScanning] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState("environment");
  const [cameraDevices, setCameraDevices] = useState([]);
  
  // Quick QR Code Generator dropdown helpers
  const [simSelectedUser, setSimSelectedUser] = useState("");
  const [simQrUrl, setSimQrUrl] = useState("");
  const [registrationQrUrl, setRegistrationQrUrl] = useState("");
  const [showQrRegistrationModal, setShowQrRegistrationModal] = useState(false);

  // Generate dynamic companion QR registration link
  useEffect(() => {
    const regUrl = window.location.origin + "/#/qr-register";
    QRCode.toDataURL(regUrl, {
      width: 140,
      margin: 1,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => setRegistrationQrUrl(url))
      .catch((err) => console.error("Error generating registration QR URL", err));
  }, []);

  const allAvailableUsers = [...users, ...(qrClients || [])];

  // Populate first available user on load
  useEffect(() => {
    if (allAvailableUsers && allAvailableUsers.length > 0 && !simSelectedUser) {
      setSimSelectedUser(allAvailableUsers[0].id);
    }
  }, [allAvailableUsers, simSelectedUser]);

  // Generate QR code for simulated drop-down scanning
  useEffect(() => {
    const matched = allAvailableUsers.find((u) => u.id === simSelectedUser);
    if (matched) {
      QRCode.toDataURL(matched.rfid, {
        width: 140,
        margin: 1,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      })
        .then((url) => setSimQrUrl(url))
        .catch((e) => console.error(e));
    }
  }, [simSelectedUser, allAvailableUsers]);

  // Clean up streams
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const stopWebcamStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  const startWebcam = async (requestedFacingMode = cameraFacingMode) => {
    const requestId = ++cameraRequestRef.current;
    setWebcamError("");
    setCameraNotice("");
    setWebcamScanning(false);
    stopWebcamStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setWebcamError(
        "Webcam access is not available on your browser or device. This feature requires a secure connection (HTTPS) and browser support.",
      );
      console.error("navigator.mediaDevices.getUserMedia is not available.");
      return;
    }

    try {
      const constraints = {
        video: { facingMode: { ideal: requestedFacingMode } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("Webcam play interrupted safely:", err.message);
          });
        }
        setCameraFacingMode(requestedFacingMode);
        setWebcamScanning(true);

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (requestId === cameraRequestRef.current) {
            setCameraDevices(devices.filter((device) => device.kind === "videoinput"));
          }
        } catch (error) {
          console.warn("Unable to enumerate cameras.", error);
        }
      }
    } catch (err) {
      console.error("Camera setup failed", err);
      if (requestedFacingMode === "user") {
        setCameraFacingMode("environment");
        await startWebcam("environment");
        setCameraNotice("Front camera is not available on this device. Keeping the back camera active.");
      } else {
        setWebcamError(
          "Standard webcam hardware access was blocked or is unavailable. Please choose from the 'Simulate Dropdown' or 'Upload Image' tabs below!"
        );
      }
    }
  };

  const stopWebcam = () => {
    cameraRequestRef.current += 1;
    setWebcamScanning(false);
    stopWebcamStream();
  };

  const switchCamera = async () => {
    if (cameraDevices.length < 2) return;
    const nextFacingMode = cameraFacingMode === "environment" ? "user" : "environment";
    await startWebcam(nextFacingMode);
  };

  // Automatically start or stop camera on mode change
  useEffect(() => {
    if (scanMethod === "WEBCAM") {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [scanMethod]);

  // Live decoding tick analyzer inside requestAnimationFrame loop
  useEffect(() => {
    let animId;
    const processFrame = () => {
      if (!webcamScanning || !streamRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        // Build dynamic temporary offscreen canvas
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // run jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          const matchedRfid = code.data.trim();
          playScanBeep();
          handleScan(matchedRfid);
          stopWebcam();
          return;
        }
      }
      if (webcamScanning) {
        animId = requestAnimationFrame(processFrame);
      }
    };

    if (webcamScanning) {
      animId = requestAnimationFrame(processFrame);
    }
    return () => cancelAnimationFrame(animId);
  }, [webcamScanning]);

  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime); 
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (_) {}
  };

  const handleQrFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          playScanBeep();
          handleScan(code.data.trim());
        } else {
          alert("Could not decode any valid QR access token. Please upload a clear photo of the check-in QR Code.");
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const isWithinQuotaWindow = (checkInTime) => {
    const checkInMs = new Date(checkInTime).getTime();
    if (Number.isNaN(checkInMs)) return false;
    return Date.now() - checkInMs < quotaResetMs;
  };

  const getTodayUsage = (rfid) => {
    let totalPagesPrinted = 0;
    let wifiAvailedCount = 0;
    let chargingAvailedCount = 0;

    logs.forEach((log) => {
      if (log.entryType === "SERVICE_UPDATE") return;
      if (log.rfid !== rfid) return;
      if (!isWithinQuotaWindow(log.checkInTime)) return;

      // check printing pages
      if (
        log.services.some((s) => s.toLowerCase().includes("printing")) &&
        log.pagesPrinted
      ) {
        totalPagesPrinted += log.pagesPrinted;
      }
      // check wifi
      if (
        log.services.some(
          (s) =>
            s.toLowerCase().includes("wifi") ||
            s.toLowerCase().includes("voucher"),
        )
      ) {
        wifiAvailedCount++;
      }
      // check charging slip
      if (log.services.some((s) => s.toLowerCase().includes("charging"))) {
        chargingAvailedCount++;
      }
    });

    return { totalPagesPrinted, wifiAvailedCount, chargingAvailedCount };
  };

  const getActivePrintingPages = () => {
    const sessionsToCheck = activeSessions.length > 0 ? activeSessions : [activeSession];
    return sessionsToCheck.reduce((sum, session) => {
      const hasPrinting = (session?.services || []).some((s) =>
        s.toLowerCase().includes("printing"),
      );
      return sum + (hasPrinting ? session.pagesPrinted || 0 : 0);
    }, 0);
  };

  // Location select state (dynamic terminal location preset)
  const [terminalLocation, setTerminalLocation] = useState(initialTerminalLocation);
  const [isChoosingLocation, setIsChoosingLocation] = useState(false);

  useEffect(() => {
    setTerminalLocation(initialTerminalLocation);
  }, [initialTerminalLocation]);

  const locations = [
    "1F WALK-IN RECEPTION",
    "CPLRC SUB",
    "2F STUDY & DISCUSSION",
    "3F CO-WORKING ZONE",
    "4F QUIET STUDY HUB",
    "DIGITAL TRANSFORMATION CENTER",
    "PRINTING SECTOR",
  ];

  const shouldAllowQrEntrance = onlyQrMode || initialTerminalLocation === "INTERNET AREA";

  const getServicesForLocation = (location) => {
    // QR scanners are entrance checkpoints, not service-selection terminals.
    if (onlyQrMode) {
      if (location === "1F WALK-IN RECEPTION") {
        return [
          { id: "qr_1f", name: "1F WALK-IN RECEPTION", icon: "Library", description: "QR entrance assignment for the 1F Walk-In Reception.", color: "sky" },
        ];
      }
      const isInternetArea = location === "INTERNET AREA" || location === "PRINTING SECTOR";
      return [
        {
          id: isInternetArea ? "entrance_auto_enter" : "entrance",
          name: isInternetArea ? "Entrance (Auto Enter)" : "Entrance",
          icon: "Rss",
          description: isInternetArea
            ? "Internet Area entrance is registered automatically."
            : "QR code entrance registration.",
          color: "sky",
        },
      ];
    }

    switch (location) {
      case "CPLRC SUB":
        return [
          {
            id: "entrance",
            name: "Entrance",
            icon: "Rss",
            description: "CPLRC SUB entrance access registration.",
            color: "sky",
          },
          {
            id: "wifi",
            name: "WiFi Voucher",
            icon: "Wifi",
            description: "Access voucher for high-speed internet network.",
            color: "emerald",
          },
          {
            id: "charging",
            name: "Charging Slip",
            icon: "BatteryCharging",
            description: "Plug-in device access. Restricted to 30 mins stay.",
            color: "amber",
          },
          {
            id: "printing",
            name: "Printing",
            icon: "Printer",
            description: "Authorized printing access. Restricted to 10 pages maximum limit.",
            color: "rose",
          },
          {
            id: "internet_area",
            name: "Internet Area",
            icon: "Monitor",
            description: "Access to CPLRC SUB internet workstations.",
            color: "indigo",
          },
        ];
      case "1F WALK-IN RECEPTION":
        return [
          {
            id: "wifi",
            name: "Wi-Fi Voucher",
            icon: "Wifi",
            description: "Access voucher for high-speed internet network.",
            color: "emerald",
          },
          {
            id: "charging",
            name: "Charging Slip",
            icon: "BatteryCharging",
            description: "Plug-in device access. Restricted to 30 mins stay.",
            color: "amber",
          },
          {
            id: "ubag_cinema",
            name: "Ubag Cinema",
            icon: "Monitor",
            description: "Access ticket to CPLRC Audiovisual Ubag Cinema hall.",
            color: "purple",
          },
          {
            id: "play_area",
            name: "Play Area",
            icon: "BookOpen",
            description: "Access pass for educational children play zone.",
            color: "indigo",
          },
          {
            id: "pvao_area",
            name: "PVAO Area",
            icon: "Library",
            description:
              "Philippine Veterans Affairs Office dedicated area log.",
            color: "blue",
          },
          {
            id: "pwd_area",
            name: "PWD Area",
            icon: "User",
            description: "Dedicated assistance and study area for PWD patrons.",
            color: "rose",
          },
        ];
      case "2F STUDY & DISCUSSION":
        return [
          {
            id: "biuag",
            name: "Discussion Room 1 (BIUAG)",
            icon: "Library",
            description: "Collaborative space. Max stay interval 1 hour.",
            color: "indigo",
          },
          {
            id: "malana",
            name: "Discussion Room 2 (MALANA)",
            icon: "BookOpen",
            description: "Collaborative space. Max stay interval 1 hour.",
            color: "blue",
          },
          {
            id: "wifi",
            name: "Wi-Fi Voucher",
            icon: "Wifi",
            description: "Access voucher for high-speed internet network.",
            color: "emerald",
          },
          {
            id: "charging",
            name: "Charging Slip",
            icon: "BatteryCharging",
            description: "Plug-in device access. Restricted to 30 mins stay.",
            color: "amber",
          },
        ];
      case "3F CO-WORKING ZONE":
        return [
          {
            id: "wifi",
            name: "Wi-Fi Voucher",
            icon: "Wifi",
            description: "Access voucher for high-speed internet network.",
            color: "emerald",
          },
          {
            id: "charging",
            name: "Charging Slip",
            icon: "BatteryCharging",
            description: "Plug-in device access. Restricted to 30 mins stay.",
            color: "amber",
          },
        ];
      case "4F QUIET STUDY HUB":
        return [
          {
            id: "wifi",
            name: "Wi-Fi Voucher",
            icon: "Wifi",
            description: "Access voucher for high-speed internet network.",
            color: "emerald",
          },
          {
            id: "charging",
            name: "Charging Slip",
            icon: "BatteryCharging",
            description: "Plug-in device access. Restricted to 30 mins stay.",
            color: "amber",
          },
        ];
      case "DIGITAL TRANSFORMATION CENTER":
      case "DIGITAL TRANSPORTATION CENTER":
        return [
          {
            id: "intern_auto",
            name: "DIGITAL TRANSFORMATION CENTER",
            icon: "Activity",
            description: "Automatic logbook log-in for active CPLRC Interns.",
            color: "emerald",
          },
        ];
      case "PRINTING SECTOR":
      default:
        return [
          {
            id: "printing",
            name: "Printing",
            icon: "Printer",
            description:
              "Authorized printing access. Restricted to 10 pages maximum limit.",
            color: "rose",
          },
        ];
    }
  };

  // Auto ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto clear feedback after scanned state stays too long or on success
  useEffect(() => {
    if (
      scannerState === "SUCCESS_MESSAGE" ||
      scannerState === "ERROR_MESSAGE"
    ) {
      const timer = setTimeout(() => {
        resetScanner();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [scannerState]);

  const resetScanner = () => {
    setRfidInput("");
    setScannedUser(null);
    setActiveSession(null);
    setActiveSessions([]);
    setSelectedServices([]);
    setErrorMessage("");
    setSuccessInfo(null);
    setScannerState("IDLE");
    setPagesToPrint(1);
  };

  const normalizeScanCode = (value) =>
    value
      .trim()
      .replace(/[\r\n\t]/g, "")
      .replace(/^RFID[:\s-]*/i, "");

  const handleScan = async (rfidToScan) => {
    const trimmedRfid = normalizeScanCode(rfidToScan);
    if (!trimmedRfid) return;

    // Check for registration QR scan trigger
    if (
      trimmedRfid.includes("client-login") ||
      trimmedRfid.includes("registration") ||
      trimmedRfid === "REGISTRATION_QR"
    ) {
      setSuccessInfo({
        title: "REGISTRATION CODE DETECTED!",
        subtitle: "Redirecting you to the CPLRC Member Registration Desk. You can register, get your credentials, and display your personalized entry QR Code there!",
        type: "redirect",
      });
      setScannerState("SUCCESS_MESSAGE");
      setTimeout(() => {
        resetScanner();
        onRegisterClick("");
      }, 3500);
      return;
    }

    // Find if user exists
    let matchedUser = users.find((u) => u.rfid === trimmedRfid) ||
                      (qrClients && qrClients.find((q) => q.rfid === trimmedRfid));

    // Refresh QR registrations so a scanner that was already open can see a
    // guest pass created from another phone or device.
    if (!matchedUser && trimmedRfid.startsWith("QR-")) {
      try {
        const latestQrClients = await api.qrClients.list();
        matchedUser = latestQrClients.find((q) => q.rfid === trimmedRfid);
        if (matchedUser && typeof onQrClientsRefresh === "function") {
          onQrClientsRefresh(latestQrClients);
        }
      } catch (error) {
        console.warn("Unable to refresh QR registrations before scan.", error);
      }
    }
    if (!matchedUser) {
      setErrorMessage(
        onlyQrMode
          ? `QR Code badge [${trimmedRfid}] is unregistered in the CPLRC provincial database. If you are a new guest, please register now.`
          : `Access card code [${trimmedRfid}] is unregistered inside the database.`,
      );
      setScannerState("ERROR_MESSAGE");
      return;
    }

    // User is found!
    setScannedUser(matchedUser);

    // CPLRC SUB creates its entrance record first, then stays on the active
    // resource assignment workflow so additional resources can be selected.
    if (terminalLocation === "CPLRC SUB") {
      const checkInTime = new Date().toISOString();
      const session = {
        id: `log-auto-${Date.now()}`,
        rfid: matchedUser.rfid,
        userFullName: `${matchedUser.givenName} ${matchedUser.middleName ? matchedUser.middleName + " " : ""}${matchedUser.lastName}`,
        patronType: matchedUser.patronType,
        services: ["Entrance"],
        terminalLocation,
        entryType: onlyQrMode ? "QR_CODE_ENTRANCE" : "RFID_CHECK_IN",
        checkInTime,
        status: "ACTIVE",
      };
      onAddLog(session);
      setActiveSession(session);
      setActiveSessions([session]);
      setSelectedServices(["Entrance"]);
      setScannerState("SCANNED");
      playScanBeep();
      return;
    }

    // Intern Auto-Deck remains an automatic check-in terminal.
    if (
      terminalLocation === "DIGITAL TRANSFORMATION CENTER" ||
      terminalLocation === "DIGITAL TRANSPORTATION CENTER"
    ) {
      const checkInTime = new Date().toISOString();

      onAddLog({
        id: `log-auto-${Date.now()}`,
        rfid: matchedUser.rfid,
        userFullName: `${matchedUser.givenName} ${matchedUser.middleName ? matchedUser.middleName + " " : ""}${matchedUser.lastName}`,
        patronType: matchedUser.patronType,
        services: ["Digital Transportation Center"],
        terminalLocation,
        entryType: onlyQrMode ? "QR_CODE_ENTRANCE" : "RFID_CHECK_IN",
        checkInTime,
        status: "ACTIVE",
      });
      setSuccessInfo({
        title: "INTERN LOG-IN SUCCESSFUL!",
        subtitle: `Welcome, ${matchedUser.givenName}! Your entry has been recorded successfully.`,
        type: "in",
      });
      setScannerState("SUCCESS_MESSAGE");
      return; // End the function here for auto-check-in terminals
    }

    // Check if user has an active log record in progress
    // In QR mode, every scan is a new entry, so we bypass the active session check.
    const matchedSessions = logs.filter(
      (l) =>
        !onlyQrMode && // <-- This is the new condition
        l.rfid === trimmedRfid &&
        l.status === "ACTIVE" &&
        l.entryType !== "SERVICE_UPDATE",
    );

    const matchedSession = matchedSessions[0];
    if (matchedSession) {
      setActiveSession(matchedSession);
      setActiveSessions(matchedSessions);
      setSelectedServices([
        ...new Set(matchedSessions.flatMap((session) => session.services || [])),
      ]);
      const activePrintingPages = matchedSessions.reduce((sum, session) => {
        const hasPrinting = (session.services || []).some((s) =>
          s.toLowerCase().includes("printing"),
        );
        return sum + (hasPrinting ? session.pagesPrinted || 0 : 0);
      }, 0);
      setPagesToPrint(activePrintingPages || 1);
    } else {
      setActiveSession(null);
      setActiveSessions([]);
      const currentOptions = getServicesForLocation(terminalLocation);
      if (currentOptions.length === 1) {
        setSelectedServices([currentOptions[0].name]);
      } else {
        setSelectedServices([]);
      }
      setPagesToPrint(1);
    }

    setScannerState("SCANNED");
  };

  useEffect(() => {
    latestHandleScanRef.current = handleScan;
  });

  // Lets the RFID field in the kiosk header use the same scan workflow as a card reader.
  useEffect(() => {
    if (!manualRfidScan?.code || onlyQrMode) return;
    handleScan(manualRfidScan.code);
  }, [manualRfidScan, onlyQrMode]);

  const submitHardwareScan = (rawCode) => {
    const normalizedCode = normalizeScanCode(rawCode);
    hardwareBufferRef.current = "";
    if (!normalizedCode) return;

    setRfidInput(normalizedCode);
    latestHandleScanRef.current?.(normalizedCode);
  };

  const handleHardwareKeyDown = (e) => {
    if (onlyQrMode || scanMethod !== "RFID") return;

    if (e.key === "Enter") {
      if (hardwareFlushTimerRef.current) {
        window.clearTimeout(hardwareFlushTimerRef.current);
      }
      submitHardwareScan(hardwareBufferRef.current);
      e.preventDefault();
      return;
    }

    if (e.key.length !== 1) return;

    hardwareBufferRef.current += e.key;

    if (hardwareFlushTimerRef.current) {
      window.clearTimeout(hardwareFlushTimerRef.current);
    }

    hardwareFlushTimerRef.current = window.setTimeout(() => {
      if (hardwareBufferRef.current.length >= 4) {
        submitHardwareScan(hardwareBufferRef.current);
      } else {
        hardwareBufferRef.current = "";
      }
    }, 120);
  };

  useEffect(() => {
    if (onlyQrMode || scanMethod !== "RFID") return undefined;

    const focusHardwareReader = () => {
      hardwareInputRef.current?.focus({ preventScroll: true });
    };

    const captureHardwareReader = (e) => {
      const target = e.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (isEditable && target !== hardwareInputRef.current) return;

      handleHardwareKeyDown(e);
    };

    focusHardwareReader();
    const focusTimer = window.setTimeout(focusHardwareReader, 250);
    window.addEventListener("keydown", captureHardwareReader);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", captureHardwareReader);
      if (hardwareFlushTimerRef.current) {
        window.clearTimeout(hardwareFlushTimerRef.current);
      }
      hardwareBufferRef.current = "";
    };
  }, [onlyQrMode, scanMethod]);

  const toggleService = async (serviceName) => {
    if (selectedServices.includes(serviceName)) {
      setSelectedServices(selectedServices.filter((s) => s !== serviceName));
      return;
    }

    setSelectedServices([...selectedServices, serviceName]);

    // Every newly selected resource gets its own Admin-visible assignment log.
    if (!scannedUser || !activeSession) return;
    const activeResourceAlreadyLogged = [activeSession, ...activeSessions].some(
      (session) => (session.services || []).includes(serviceName),
    );
    if (activeResourceAlreadyLogged) return;

    const checkInTime = new Date().toISOString();
    try {
      await onAddLog({
      id: `service-update-${Date.now()}-${serviceName.replace(/\W+/g, "-")}`,
      groupId: activeSession.groupId || activeSession.id,
      rfid: scannedUser.rfid,
      userFullName: `${scannedUser.givenName} ${scannedUser.middleName ? `${scannedUser.middleName} ` : ""}${scannedUser.lastName}`,
      patronType: scannedUser.patronType,
      services: [serviceName],
      terminalLocation,
      entryType: "SERVICE_UPDATE",
      checkInTime,
      status: "ACTIVE",
      });
    } catch (_) {
      setSelectedServices((current) => current.filter((service) => service !== serviceName));
    }
  };

  const handleCheckIn = async (locationOverride, servicesOverride) => {
    if (!scannedUser) return;

    const location = locationOverride || terminalLocation;
    const services = servicesOverride || selectedServices;

    if (services.length === 0) {
      alert(
        "Please select at least one service to perform your logbook registration.",
      );
      return;
    }

    // Check if a QR entrance log was just created in the last few seconds.
    // If so, update it instead of creating a new one.
    const recentQrLog = logs.find(l =>
      l.rfid === scannedUser.rfid &&
      l.entryType === "QR_CODE_ENTRANCE" &&
      (Date.now() - new Date(l.checkInTime).getTime()) < 5000 // 5-second window
    );

    if (onlyQrMode && recentQrLog) {
      try {
        await onUpdateLog({
        ...recentQrLog,
        services: services,
        terminalLocation: location,
        qrEntranceArea: location,
        });
      } catch (_) {
        return;
      }
      setSuccessInfo({
        title: "DESTINATION UPDATED!",
        subtitle: `Your destination has been changed to [${location}].`,
        type: "edit",
      });
      setScannerState("SUCCESS_MESSAGE");
      return;
    }

    const todayUsage = getTodayUsage(scannedUser.rfid);

    // 1. WiFi Voucher Strict Daily Limit Check
    const selectsWifi = services.some(
      (s) =>
        s.toLowerCase().includes("wifi") || s.toLowerCase().includes("voucher"),
    );
    if (selectsWifi && todayUsage.wifiAvailedCount > 0) {
      alert(
        `🚨 Denied: Patron ${scannedUser.givenName} has already availed of a Wi-Fi Voucher within the last 15 hours. Standard allowance is strictly 1 voucher per guest per reset window!`,
      );
      return;
    }

    // 2. Printing Strict Daily Limit Check
    const selectsPrinting = services.some((s) =>
      s.toLowerCase().includes("printing"),
    );
    if (selectsPrinting) {
      const remaining = Math.max(0, 10 - todayUsage.totalPagesPrinted);
      if (remaining <= 0) {
        alert(
          `🚨 Denied: Patron ${scannedUser.givenName} has already exhausted the 15-hour maximum allowance of 10 printed pages!`,
        );
        return;
      }
      if (pagesToPrint > remaining) {
        alert(
          `🚨 Denied: You requested ${pagesToPrint} pages, but you only have ${remaining} pages left on your 15-hour 10-page printing allowance (Already printed: ${todayUsage.totalPagesPrinted} pages). Please adjust requested pages.`,
        );
        return;
      }
    }

    const destinationServices = new Set(["1st Floor", "Entrance", "Entrance (Auto Enter)"]);
    const duplicateServices = services.filter((serviceName) => {
      return logs.some((log) => {
        if (log.rfid !== scannedUser.rfid) return false;
        if (log.entryType === "SERVICE_UPDATE") return false;
        if (!isWithinQuotaWindow(log.checkInTime)) return false;
        if (!log.services.includes(serviceName)) return false;

        // QR floor selections are separate destinations. The same generic
        // entrance label is valid when the guest chooses another floor.
        if (onlyQrMode && destinationServices.has(serviceName)) {
          return (log.qrEntranceArea || log.terminalLocation) === location;
        }

        return true;
      });
    });

    if (duplicateServices.length > 0) {
      const result = await Swal.fire({
        title: "Duplicate service scan",
        text: `Patron ${scannedUser.givenName} ${scannedUser.lastName} already used: ${duplicateServices.join(", ")}. Authorize another scan?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Authorize scan",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#1d4ed8",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
      });
      if (!result.isConfirmed) {
        return;
      }
    }

    const checkInTime = new Date().toISOString();
    const logGroupId = `log-group-${Date.now()}`;
    try {
      await Promise.all(services.map((serviceName, index) => onAddLog({
        id: `${logGroupId}-${index}`,
        groupId: logGroupId,
        rfid: scannedUser.rfid,
        userFullName: `${scannedUser.givenName} ${scannedUser.middleName ? scannedUser.middleName + " " : ""}${scannedUser.lastName}`,
        patronType: scannedUser.patronType,
        services: [serviceName], // Use the iterated serviceName
        terminalLocation: location,
        qrEntranceArea: onlyQrMode ? location : undefined,
        entryType: onlyQrMode ? "QR_CODE_ENTRANCE" : "RFID_CHECK_IN",
        checkInTime,
        status: "ACTIVE",
        pagesPrinted: serviceName.toLowerCase().includes("printing")
          ? pagesToPrint
          : undefined,
      })));
    } catch (_) {
      setErrorMessage("The visit was not saved. Please check the API connection and try again.");
      return;
    }
    setSuccessInfo({
      title: "CHECK-IN PROCESSED!",
      subtitle: `Welcome back to CPLRC, ${scannedUser.givenName}! Access keys configured in [${location}].`,
      type: "in",
    });
    setScannerState("SUCCESS_MESSAGE");
  };

  const handleCheckOut = () => {
    if (!scannedUser || !activeSession) return;

    const checkOutTime = new Date().toISOString();
    const sessionsToClose = activeSessions.length > 0 ? activeSessions : [activeSession];

    sessionsToClose.forEach((session) => {
      onUpdateLog({
        ...session,
        checkOutTime,
        status: "COMPLETED",
      });
    });
    setSuccessInfo({
      title: "CHECKOUT PROCESSED!",
      subtitle: `Logging departure for ${scannedUser.givenName}. Thank you for visiting CPLRC Cagayan!`,
      type: "out",
    });
    setScannerState("SUCCESS_MESSAGE");
  };

  const handleUpdateServices = async () => {
    if (!scannedUser || !activeSession) return;
    if (selectedServices.length === 0) {
      alert(
        "Please select at least one active assignment or check-out of the facility.",
      );
      return;
    }

    const todayUsage = getTodayUsage(scannedUser.rfid);
    const currentActiveSessions =
      activeSessions.length > 0 ? activeSessions : [activeSession];
    const activeServiceNames = [
      ...new Set(
        currentActiveSessions.flatMap((session) => session.services || []),
      ),
    ];
    const activePrintingPages = getActivePrintingPages();

    // 1. WiFi Voucher Strict Daily Limit Check
    const selectsWifi = selectedServices.some(
      (s) =>
        s.toLowerCase().includes("wifi") || s.toLowerCase().includes("voucher"),
    );
    const previouslyWifi = activeServiceNames.some(
      (s) =>
        s.toLowerCase().includes("wifi") || s.toLowerCase().includes("voucher"),
    );
    if (selectsWifi && !previouslyWifi && todayUsage.wifiAvailedCount > 0) {
      alert(
        `🚨 Denied: Patron ${scannedUser.givenName} has already availed of a Wi-Fi Voucher within the last 15 hours. Usage is restricted to strictly 1 voucher per guest per reset window.`,
      );
      return;
    }

    // 2. Printing Strict Daily Limit Check
    const selectsPrinting = selectedServices.some((s) =>
      s.toLowerCase().includes("printing"),
    );
    const previouslyPrinting = activeServiceNames.some((s) =>
      s.toLowerCase().includes("printing"),
    );
    if (selectsPrinting) {
      const oldPages = previouslyPrinting ? activePrintingPages : 0;
      const otherPagesPrinted = Math.max(
        0,
        todayUsage.totalPagesPrinted - oldPages,
      );
      const remaining = Math.max(0, 10 - otherPagesPrinted);
      if (remaining <= 0) {
        alert(
          `🚨 Denied: Patron ${scannedUser.givenName} has already exhausted the maximum 15-hour allowance of 10 printed pages!`,
        );
        return;
      }
      if (pagesToPrint > remaining) {
        alert(
          `🚨 Denied: Requested count of ${pagesToPrint} pages exceeds remaining 15-hour allowance (${remaining} pages). You already printed ${otherPagesPrinted} pages in other check-ins within this reset window.`,
        );
        return;
      }
    }

    const duplicateServices = selectedServices.filter((serviceName) => {
      if (activeServiceNames.includes(serviceName)) return false; // Allowed to keep existing
      return logs.some((log) => {
        if (currentActiveSessions.some((session) => session.id === log.id)) {
          return false;
        }
        if (log.rfid !== scannedUser.rfid) return false;
        if (log.entryType === "SERVICE_UPDATE") return false;
        if (!isWithinQuotaWindow(log.checkInTime)) return false;
        return log.services.includes(serviceName);
      });
    });

    if (duplicateServices.length > 0) {
      const result = await Swal.fire({
        title: "Duplicate service scan",
        text: `Patron ${scannedUser.givenName} ${scannedUser.lastName} already used: ${duplicateServices.join(", ")}. Authorize another scan?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Authorize scan",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#1d4ed8",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
      });
      if (!result.isConfirmed) {
        return;
      }
    }

    const now = new Date().toISOString();

    // Consolidate all changes into the primary active session log
    // instead of creating new log entries.
    const primarySession = currentActiveSessions[0];
    if (primarySession) {
      onUpdateLog({
        ...primarySession,
        services: selectedServices,
        terminalLocation,
        pagesPrinted: selectsPrinting ? pagesToPrint : primarySession.pagesPrinted,
      });

      // Mark other, older sessions from the same group as completed if they exist
      currentActiveSessions.slice(1).forEach(session => {
        onUpdateLog({
          ...session,
          checkOutTime: now,
          status: "COMPLETED",
        });
      });
    }
    setSuccessInfo({
      title: "ASSIGNMENTS UPDATED!",
      subtitle: `Your active terminal resource keys have been successfully re-aligned for this stay.`,
      type: "edit",
    });
    setScannerState("SUCCESS_MESSAGE");
  };

  // Clock format helpers matching your layout image precisely: "10:37:59 AM" or similar
  const padZero = (n) => n.toString().padStart(2, "0");
  const formattedTimeStr = () => {
    let hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // first hour is 12
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)} ${ampm}`;
  };

  const formattedDateStr = () => {
    const months = [
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
    return `${months[currentTime.getMonth()]} ${currentTime.getDate()}, ${currentTime.getFullYear()}`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6">
      {/* 1. AREA TITLE RIBBON BANNER - Matches your layout image precisely */}
      <div className="relative overflow-hidden bg-sky-500 text-white font-extrabold uppercase py-3 sm:py-4 px-6 text-center shadow-md tracking-wider text-base sm:text-lg hover:bg-sky-650 transition-colors duration-250 select-none border-b border-sky-450 z-10 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span className="font-mono text-amber-300">✦</span>
        <span>{terminalLocation}</span>
        <span className="font-mono text-amber-300">✦</span>

        {/* Dynamic Station Location Selector helper */}
        <button
          onClick={() => setIsChoosingLocation(!isChoosingLocation)}
          className="sm:absolute sm:right-4 text-[10px] font-mono bg-sky-655 text-sky-100 hover:text-white hover:bg-sky-700 px-2 py-1 rounded transition-all border border-sky-400 font-bold uppercase cursor-pointer"
        >
          {isChoosingLocation ? "✕ CLOSE SELECTOR" : "⚙ SWITCH OVER"}
        </button>
      </div>

      {/* Location Selector Slide Down menu */}
      <AnimatePresence>
        {isChoosingLocation && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900 border-b border-slate-800 p-3 flex flex-wrap gap-2 justify-center z-20 relative overflow-hidden"
          >
            {locations.map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  setTerminalLocation(loc);
                  setIsChoosingLocation(false);
                }}
                className={`px-3 py-1 text-[10px] font-mono rounded cursor-pointer transition-all uppercase font-bold ${
                  terminalLocation === loc
                    ? "bg-amber-400 text-slate-950 shadow"
                    : "bg-slate-955 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                }`}
              >
                {loc}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row items-stretch gap-6 mt-6">
        {/* ========================================================= */}
        {/* LEFT COMPONENT: HIGH-FIDELITY ACCESS CARD LAYOUT */}
        {/* ========================================================= */}
        
          {!onlyQrMode && (
          <div className="flex-1 flex flex-col items-center justify-center py-2">
            {/* Card Physical Container frame with ID background image */}
            <div className="relative w-full max-w-[620px] aspect-[1.58/1] bg-slate-50 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col p-4 sm:p-5 select-none text-slate-900 hover:shadow-cyan-400/5 hover:border-slate-400 transition-all duration-300">
            {/* ID Background Image */}
            <img 
              src="/images/id-card.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* Smart Card Header bar - dual matching logos flanking center titles */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2 mb-3 relative z-10 shrink-0 select-none">
              <CagayanProvinceSeal
                size={48}
                className="sm:w-[56px] sm:h-[56px] hover:scale-105 transition-transform duration-250 shrink-0"
              />

              <div className="text-center flex-1 px-1.5 sm:px-2 select-none">
                <p className="text-[7.5px] sm:text-[9px] uppercase tracking-wide text-slate-500 font-bold font-sans">
                  Republic of the Philippines
                </p>
                <p className="text-[8px] sm:text-[10px] tracking-wide text-slate-600 font-extrabold font-sans">
                  Province of Cagayan
                </p>
                <h3 className="text-[10px] sm:text-[12.5px] leading-tight font-black tracking-tight text-[#0B3C5D] font-sans">
                  CAGAYAN PROVINCIAL LIBRARY AND RESOURCE CENTER
                </h3>
              </div>

              <PLRCLogo
                size={48}
                className="sm:w-[56px] sm:h-[56px] hover:scale-105 transition-transform duration-250 shrink-0"
              />
            </div>

            {/* Middle horizontal blue decorative pill with 'ACCESS CARD' */}
            <div className="flex justify-center mb-3 shrink-0 relative z-10 select-none">
              <div className="bg-[#0f172a] text-white px-5 py-0.5 rounded-full text-[8px] sm:text-[10.5px] tracking-[0.35em] font-black uppercase text-center shadow-inner leading-none flex items-center justify-center">
                {onlyQrMode ? "DIGITAL QR PASS" : "ACCESS CARD"}
              </div>
            </div>

            {/* Main Inner Card Frame Body - Split Portrait box + Metadata columns */}
            <div className="flex-1 flex gap-3 sm:gap-4 relative z-10 select-none">
              {/* Photo Frame Container (Left column) - Matches your image border perfectly */}
              {!onlyQrMode && (
                <div className="w-40 h-40 aspect-[3/4] bg-slate-50 border-[3px] border-[#374151] rounded-xl overflow-hidden flex flex-col items-center justify-center relative shadow-md shrink-0">
                  <AnimatePresence mode="wait">
                    {(scannerState === "SCANNED" ||
                      scannerState === "SUCCESS_MESSAGE") &&
                    scannedUser ? (
                      <motion.div
                        key="profile-avatar"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full h-full relative"
                      >
                        {scannedUser.photoUrl ? (
                          <img
                            src={scannedUser.photoUrl}
                            alt="Patron Photo"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col items-center justify-center">
                            <User
                              className="text-slate-500 w-[55%] h-[55%]"
                              strokeWidth={1.5}
                            />
                            <span className="text-[7px] sm:text-[9.5px] font-mono bg-sky-550 text-white px-1.5 py-0.5 rounded-full uppercase mt-1.5 font-bold tracking-tight">
                              {scannedUser.patronType.split(" ")[0]}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle-silhouette"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full h-full flex flex-col items-center justify-center bg-slate-100 relative group"
                      >
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-3 select-none" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Information Grid Container (Right column) */}
              <div className="flex-1 flex flex-col justify-between py-1 select-none">
                {/* Upper Metadata area */}
                <div className="space-y-1 sm:space-y-2 mt-1">
                  {/* LAST NAME */}
                  <div className="flex items-center text-[10px] sm:text-[13px] leading-tight">
                    <span className="w-24 sm:w-28 font-mono text-slate-500 font-bold uppercase tracking-wider text-right italic mr-2 sm:mr-3 shrink-0">
                      LAST NAME ‣
                    </span>
                    <span className="font-sans font-black text-[#1E3A8A] uppercase tracking-wide truncate">
                      {scannedUser ? scannedUser.lastName : "─ ─ ─"}
                    </span>
                  </div>

                  {/* FIRST NAME */}
                  <div className="flex items-center text-[10px] sm:text-[13px] leading-tight">
                    <span className="w-24 sm:w-28 font-mono text-slate-500 font-bold uppercase tracking-wider text-right italic mr-2 sm:mr-3 shrink-0">
                      FIRST NAME ‣
                    </span>
                    <span className="font-sans font-black text-[#1E3A8A] uppercase tracking-wide truncate">
                      {scannedUser ? scannedUser.givenName : "─ ─ ─"}
                    </span>
                  </div>

                  {/* MIDDLE NAME */}
                  <div className="flex items-center text-[10px] sm:text-[13px] leading-tight">
                    <span className="w-24 sm:w-28 font-mono text-slate-500 font-bold uppercase tracking-wider text-right italic mr-2 sm:mr-3 shrink-0">
                      MIDDLE NAME ‣
                    </span>
                    <span className="font-sans font-black text-[#1E3A8A] uppercase tracking-wide truncate">
                      {scannedUser ? scannedUser.middleName || "─" : "─ ─ ─"}
                    </span>
                  </div>

                  {/* Added Birthday and Address fields */}
                  <div className="flex items-center text-[10px] sm:text-[13px] leading-tight">
                    <span className="w-24 sm:w-28 font-mono text-slate-500 font-bold uppercase tracking-wider text-right italic mr-2 sm:mr-3 shrink-0">
                      BIRTHDAY ‣
                    </span>
                    <span className="font-mono font-bold text-slate-700">{scannedUser ? scannedUser.birthday : "─ ─ ─"}</span>
                  </div>
                  <div className="flex items-center text-[10px] sm:text-[13px] leading-tight">
                    <span className="w-24 sm:w-28 font-mono text-slate-500 font-bold uppercase tracking-wider text-right italic mr-2 sm:mr-3 shrink-0">
                      ADDRESS ‣
                    </span>
                    <span className="font-sans font-medium text-slate-600 truncate italic">{scannedUser ? scannedUser.address : "─ ─ ─"}</span>
                  </div>
                </div>

                {/* Lower Dynamic Clock and Date - Aligned exactly like the sample image */}
                <div className="border-t border-slate-100 pt-2 mb-4 select-none">
                  {/* Digital Live Ticking Time label */}
                  <div className="text-[25px] sm:text-[34.5px] font-black text-[#1E293B] font-mono tracking-tighter leading-none select-none">
                    {formattedTimeStr()}
                  </div>

                  {/* Dynamic Date label */}
                  <div className="text-[10px] sm:text-[13.5px] font-bold text-slate-500 tracking-wide font-sans mt-0.5 uppercase">
                    {formattedDateStr()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Access visual confirmation strip under card container */}
          <div className="mt-4 text-center max-w-sm select-none">
            {scannerState === "IDLE" && (
              <p className="text-[11px] font-mono font-bold text-slate-400 flex items-center justify-center gap-1.5 uppercase animate-pulse">
                <Rss className="text-[#06B6D4] stroke-[3.5]" size={13} />
                {onlyQrMode
                  ? "Standby Sensor • Hold QR Code in front of camera feed"
                  : "Standby Sensor • Hold card 2cm near terminal reader"}
              </p>
            )}

            {scannerState === "SCANNED" && scannedUser && (
              <p className="text-[11px] font-mono font-bold text-emerald-400 flex items-center justify-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                {onlyQrMode ? "QR CODE SCANNED SUCCESS:" : "Valid RFID read:"} {scannedUser.rfid} • Confirm service stay
              </p>
            )}

            {scannerState === "SUCCESS_MESSAGE" && successInfo && (
              <p className="text-[11px] font-mono font-bold text-amber-400 uppercase">
                ⚙ ACCESS GRANTED SEC_LOG SEQ COMPLETE
              </p>
            )}
          </div>
        </div>
          )}
        

        {/* ========================================================= */}
        {/* RIGHT COMPONENT: CONSOLE CONTROL SHEET & SERVICE PANEL */}
        {/* ========================================================= */}
        <div
          className={
            onlyQrMode
              ? "w-full grid grid-cols-1 xl:grid-cols-2 gap-4 items-start"
              : "w-full lg:w-[480px] flex flex-col gap-4"
          }
        >
          {/* Main Action sheets: dependent on State machines */}
          <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl ${onlyQrMode ? "xl:order-2" : ""}`}>
            <AnimatePresence mode="wait">
              {/* 1. STATE: IDLE WORKFLOW GUIDE */}
              {scannerState === "IDLE" && (
                <motion.div
                  key="idle-guide"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />{" "}
                      Terminal Attendance Logbook
                    </h3>
                    <h2 className="text-sm font-extrabold text-white tracking-tight mt-1 leading-normal uppercase">
                      Welcome to CPLRC
                    </h2>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded border border-slate-800/80">
                    💡 This walk-up station is configured for{" "}
                    <strong>{terminalLocation}</strong>. Accessing guests must
                    present their {onlyQrMode ? "digital or printed QR Code" : "physical RFID membership card"} to scan in or
                    out. {onlyQrMode && "New users must register at the Staff Desk."}
                  </p>

                  {!onlyQrMode && (
                    <form
                      className="flex w-full gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        onManualRfidSubmit?.();
                      }}
                    >
                      <input
                        type="text"
                        value={manualRfid}
                        onChange={(event) => onManualRfidChange?.(event.target.value)}
                        placeholder="Type RFID number"
                        aria-label="Type RFID number manually"
                        className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-amber-300 placeholder:text-slate-500 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-sky-500 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-950 transition-colors hover:bg-sky-400"
                      >
                        Scan
                      </button>
                    </form>
                  )}

                  {onlyQrMode && (
                    /* QUICK SMARTPHONE REGISTRATION COMPANION QR CARD */
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex gap-3.5 items-center">
                      {registrationQrUrl ? (
                        <div className="bg-white p-1 rounded border border-slate-200 shrink-0 shadow-md">
                          <img
                            src={registrationQrUrl}
                            alt="Registration link QR Code"
                            className="w-16 h-16 sm:w-20 sm:h-20"
                            title="Scan this QR to open the student/visitor registration portal"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-900 animate-pulse rounded shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[9.5px] font-mono font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                          MOBILE SIGN-UP QR
                        </h4>
                        <p className="text-[9.5px] text-slate-450 leading-relaxed mt-1 font-sans">
                          Don't have a check-in QR Code yet? Scan this code on your phone to register, download your pass, and use it to scan immediately!
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 font-mono text-[10px] text-slate-500 border-t border-slate-800 pt-3">
                    <div className="flex justify-between">
                      <span>DEVICE PORT:</span>
                      <span className="text-slate-300">{onlyQrMode ? "LIVE_WEBCAM_DECODER_API" : "SYSTEM-RFID-DEV0"}</span>
                    </div>
                    <div className="flex justify-between">
                      {onlyQrMode ? (
                        <>
                          <span>DECODE FREQUENCY:</span>
                          <span className="text-cyan-400 font-bold">60 FPS CONTINUOUS</span>
                        </>
                      ) : (
                        <>
                          <span>BAUD REGISTER:</span>
                          <span className="text-slate-300">9600 HZ ACTIVE</span>
                        </>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span>STATION ZONE:</span>
                      <span className={onlyQrMode ? "text-cyan-400 font-bold" : "text-amber-400 font-bold"}>{terminalLocation}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 2. STATE: USER SCANNED (CHECK-IN / CHEK-OUT DECISION SHEET) */}
              {scannerState === "SCANNED" && scannedUser && (
                <motion.div
                  key="scanned-sheet"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Scanned Patron quick headers */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase text-amber-500 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">
                        {activeSession
                          ? "LIVE VISITOR Stay"
                          : "NEW CHECK-IN ARRIVAL"}
                      </span>
                      <h4 className="text-xs font-black text-white mt-1 uppercase font-mono">
                        {scannedUser.givenName} {scannedUser.lastName}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-mono block text-slate-500">
                        ACC_LEVEL
                      </span>
                      <span className="text-xs font-mono font-black text-indigo-400 uppercase">
                        {scannedUser.patronType}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Quotas / Compliance Monitor Widget */}
                  {(() => {
                    const todayUsage = getTodayUsage(scannedUser.rfid);
                    return (
                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 space-y-2 text-[10px] font-mono">
                        <div className="text-[8px] font-sans font-bold text-slate-500 uppercase flex items-center gap-1 select-none">
                          <span>📅</span> 15-HOUR COMPLIANCE &amp; QUOTA
                          MONITORS
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[9px]">
                          <div className="bg-slate-900/60 border border-slate-850 p-1.5 rounded flex flex-col justify-between">
                            <span className="text-slate-500 font-mono">
                              🌐 WI-FI VOUCHER
                            </span>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] font-black font-sans">
                                {todayUsage.wifiAvailedCount} / 1
                              </span>
                              <span
                                className={`text-[8px] font-black px-1 rounded uppercase ${todayUsage.wifiAvailedCount > 0 ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"}`}
                              >
                                {todayUsage.wifiAvailedCount > 0
                                  ? "CLAIMED"
                                  : "AVAILABLE"}
                              </span>
                            </div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-850 p-1.5 rounded flex flex-col justify-between">
                            <span className="text-slate-500 font-mono">
                              🖨️ PRINT QUOTA
                            </span>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] font-black font-sans">
                                {todayUsage.totalPagesPrinted} / 10 pages
                              </span>
                              <span
                                className={`text-[8px] font-black px-1 rounded uppercase ${todayUsage.totalPagesPrinted >= 10 ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-300"}`}
                              >
                                {todayUsage.totalPagesPrinted >= 10
                                  ? "EXHAUSTED"
                                  : `${10 - todayUsage.totalPagesPrinted} left`}
                              </span>
                            </div>
                          </div>
                          <div className="bg-slate-900/60 border border-slate-850 p-1.5 rounded flex flex-col justify-between">
                            <span className="text-slate-500 font-mono">
                              ðŸ”Œ CHARGING SLIP
                            </span>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] font-black font-sans">
                                {todayUsage.chargingAvailedCount} / 1
                              </span>
                              <span
                                className={`text-[8px] font-black px-1 rounded uppercase ${todayUsage.chargingAvailedCount > 0 ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"}`}
                              >
                                {todayUsage.chargingAvailedCount > 0
                                  ? "CLAIMED"
                                  : "AVAILABLE"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {activeSession ? (
                    /* ========= ACTIVE VISITOR: TAP OUT OR UPDATE SELECTIONS ========= */
                    <div className="space-y-4">
                      <div>
                        <span className="text-[9px] font-mono font-bold text-slate-500 block uppercase">
                          SECURE ENTRANCE LEDGER REGISTERED:
                        </span>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[10px] mt-1 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">CHECK-IN:</span>
                            <span className="text-slate-300">
                              {new Date(
                                activeSession.checkInTime,
                              ).toLocaleString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {activeSession.services.some((s) =>
                            s.toLowerCase().includes("charging"),
                          ) && (
                            <div className="flex justify-between border-t border-slate-900 pt-1 mt-1">
                              <span className="text-slate-500">
                                🔌 CHARGING REMAINING:
                              </span>
                              <span className="text-emerald-400 font-black">
                                {Math.max(
                                  0,
                                  30 -
                                    Math.floor(
                                      (Date.now() -
                                        new Date(
                                          activeSession.checkInTime,
                                        ).getTime()) /
                                        1000 /
                                        60,
                                    ),
                                )}{" "}
                                MINS LEFT
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active services checkboxes to update */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-mono font-bold text-slate-400 uppercase block">
                          Current Active Resource Assignments
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {getServicesForLocation(terminalLocation).map(
                            (opt) => {
                              const isSelected = selectedServices.includes(
                                opt.name,
                              );
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => toggleService(opt.name)}
                                  className={`flex items-center gap-2 p-1.5 rounded text-left transition-all border ${
                                    isSelected
                                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                      : "bg-slate-955 border-slate-850 hover:border-slate-800 text-slate-400"
                                  }`}
                                >
                                  <span
                                    className={`p-1 rounded ${isSelected ? "bg-emerald-500 text-slate-950" : "bg-slate-800"}`}
                                  >
                                    <ServiceIcon name={opt.icon} size={11} />
                                  </span>
                                  <span className="text-[10px] truncate font-bold uppercase">
                                    {opt.name}
                                  </span>
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>

                      {/* Dynamic settings panel depending on choice */}
                      {(selectedServices.some((s) =>
                        s.toLowerCase().includes("charging"),
                      ) ||
                        selectedServices.some((s) =>
                          s.toLowerCase().includes("printing"),
                        ) ||
                        selectedServices.some(
                          (s) =>
                            s.toUpperCase().includes("BIWAG") ||
                            s.toUpperCase().includes("BIUAG") ||
                            s.toUpperCase().includes("MALANA"),
                        )) && (
                        <div className="space-y-2 border-t border-slate-800/85 pt-3 animate-in fade-in duration-200">
                          {selectedServices.some((s) =>
                            s.toLowerCase().includes("charging"),
                          ) && (
                            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 px-3 py-2.5 rounded-lg space-y-1">
                              <div className="flex justify-between items-center text-[9.5px] font-mono font-black uppercase tracking-wider">
                                <span>🔌 CHARGING STATION INTERVAL</span>
                                <span className="text-[8.5px] bg-amber-400 text-slate-950 px-1 py-0.5 rounded font-sans font-black">
                                  30 MINS ONLY
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-300 leading-relaxed font-sans font-medium">
                                Device stays logged on high-efficiency ports.
                                Stay limit strictly restricted to{" "}
                                <strong>30 minutes</strong> max.
                              </p>
                            </div>
                          )}

                          {selectedServices.some(
                            (s) =>
                              s.toUpperCase().includes("BIWAG") ||
                              s.toUpperCase().includes("BIUAG") ||
                              s.toUpperCase().includes("MALANA"),
                          ) && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 px-3 py-2.5 rounded-lg space-y-1">
                              <div className="flex justify-between items-center text-[9.5px] font-mono font-black uppercase tracking-wider">
                                <span>🏠 DISCUSSION ROOM SESSION</span>
                                <span className="text-[8.5px] bg-indigo-550 text-white px-1 py-0.5 rounded font-sans font-black">
                                  1 HOUR ONLY
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-300 leading-relaxed font-sans font-medium">
                                Restricted to active interactive group studies
                                of 1-4 users. Max stay period strictly set to{" "}
                                <strong>1 Hour Limit</strong> per booking.
                              </p>
                            </div>
                          )}

                          {selectedServices.some((s) =>
                            s.toLowerCase().includes("printing"),
                          ) && (
                            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 px-3 py-2.5 rounded-lg space-y-1.5">
                              <div className="flex justify-between items-center text-[9.5px] font-mono font-black uppercase tracking-wider">
                                <span>🖨️ PRINTING SECTOR REGULATIONS</span>
                                <span className="text-[8.5px] bg-rose-550 text-white px-1 py-0.5 rounded font-sans font-black font-extrabold">
                                  MAX 10 PAGES
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9.5px] text-slate-300 font-bold">
                                  Estimated Pages to Print:
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  placeholder="Pages"
                                  value={pagesToPrint}
                                  onChange={(e) => {
                                    let val = parseInt(e.target.value) || 1;
                                    const todayUsage = getTodayUsage(
                                      scannedUser?.rfid || "",
                                    );
                                    const oldPages = getActivePrintingPages();
                                    const otherPagesPrinted = Math.max(
                                      0,
                                      todayUsage.totalPagesPrinted - oldPages,
                                    );
                                    const remaining = Math.max(
                                      0,
                                      10 - otherPagesPrinted,
                                    );
                                    if (val > remaining) {
                                      alert(
                                        `🚨 Quota Limit: You can print at most ${remaining} pages within this 15-hour reset window (already printed: ${otherPagesPrinted} pages).`,
                                      );
                                      val = remaining;
                                    }
                                    if (val < 1) {
                                      val = 1;
                                    }
                                    setPagesToPrint(val);
                                  }}
                                  className="w-16 px-1.5 py-0.5 text-center text-xs bg-slate-950 border border-slate-800 rounded font-bold font-mono text-rose-300 focus:outline-none"
                                />

                                <span className="text-[8px] text-slate-500 italic mt-0.5">
                                  (CPLRC Catalog Limit)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Control buttons */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleUpdateServices}
                            disabled={selectedServices.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 rounded uppercase text-[10px] font-black tracking-wider transition-all cursor-pointer disabled:opacity-45"
                          >
                            UPDATE REGISTER
                          </button>
                          <button
                            onClick={handleCheckOut}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 py-1.5 px-3 rounded uppercase text-[10px] font-black tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <LogOut size={11} /> TERMINATE &amp; TAP OUT
                          </button>
                        </div>
                        <button
                          onClick={resetScanner}
                          className="w-full bg-slate-800 hover:bg-slate-750 text-slate-400 py-1 text-[9px] rounded font-mono font-bold uppercase transition-all"
                        >
                          ✕ GO BACK TO IDLE TERM
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ========= INACTIVE VISITOR: SELECT INCOMING SERVICES AND TAP IN ========= */
                    <div className="space-y-4">
                      {/* Step 1: Floor / Area selection */}
                      {onlyQrMode && (
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-mono font-black text-cyan-400 uppercase tracking-wider block">
                          📍 STEP 1: CHOOSE TARGET FLOOR / AREA TO USE
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            {
                              id: "1f",
                              label: "1st Floor",
                              desc: "General & Study Lounge",
                              location: "1F WALK-IN RECEPTION",
                              defaultServiceId: "qr_1f",
                              defaultServiceName: "1st Floor",
                            },
                            {
                              id: "2f",
                              label: "2nd Floor",
                              desc: "Discussion & Study Hall",
                              location: "2F STUDY & DISCUSSION",
                              defaultServiceId: "entrance",
                              defaultServiceName: "Entrance",
                            },
                            {
                              id: "3f",
                              label: "3rd Floor",
                              desc: "Collaborative Workspace",
                              location: "3F CO-WORKING ZONE",
                              defaultServiceId: "entrance",
                              defaultServiceName: "Entrance",
                            },
                            {
                              id: "4f",
                              label: "4th Floor",
                              desc: "Quiet Reader Sanctuary",
                              location: "4F QUIET STUDY HUB",
                              defaultServiceId: "entrance",
                              defaultServiceName: "Entrance",
                            },
                            {
                              id: "internet",
                              label: "Internet Area",
                              desc: "PC Terminals & Printing Hub",
                              location: "INTERNET AREA",
                              defaultServiceId: "entrance_auto_enter",
                              defaultServiceName: "Entrance (Auto Enter)",
                            },
                            {
                              id: "wifi-voucher",
                              label: "Wi-Fi Voucher",
                              desc: "One voucher per guest within the quota period.",
                              location: "PRINTING SECTOR",
                              defaultServiceId: "wifi",
                              defaultServiceName: "Wi-Fi Voucher",
                            },
                            {
                              id: "cplrc-sub",
                              label: "CPLRC SUB",
                              desc: "CPLRC SUB QR Scanner",
                              location: "CPLRC SUB",
                              defaultServiceId: "entrance",
                              defaultServiceName: "Entrance",
                            },
                          ].map((floor) => {
                            const isSelected = terminalLocation === floor.location;
                            return (
                              <button
                                key={floor.id}
                                type="button"
                                onClick={() => {
                                  handleCheckIn(floor.location, [floor.defaultServiceName]);
                                }}
                                className={`flex flex-col items-start p-2.5 rounded-lg text-left transition-all border cursor-pointer ${
                                  isSelected
                                    ? "bg-cyan-500/10 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/20"
                                    : "bg-slate-955 border-slate-850 hover:border-slate-800 text-slate-500 hover:text-slate-400"
                                }`}
                              >
                                <span className="text-[10.5px] font-black uppercase tracking-wide truncate">
                                  {isSelected ? "✨ " : ""}{floor.label}
                                </span>
                                <span className="text-[8px] text-slate-500 block leading-tight mt-0.5 truncate">
                                  {floor.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      )}

                      {!onlyQrMode && (
                      <>
                      {/* Step 2: Services Selection check */}
                      <div>
                        <label className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-wider block mb-1.5">
                          {onlyQrMode ? "STEP 2" : "STEP 1"}: SELECT SPECIFIC SERVICES REQUIRED ({selectedServices.length} SELECTED)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {getServicesForLocation(terminalLocation).map(
                            (opt) => {
                              const isSelected = selectedServices.includes(
                                opt.name,
                              );
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => toggleService(opt.name)}
                                  className={`flex items-start gap-2 p-2 rounded text-left transition-all border cursor-pointer ${
                                    isSelected
                                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/10"
                                      : "bg-slate-955 border-slate-850 hover:border-slate-800 text-slate-500 hover:text-slate-350"
                                  }`}
                                >
                                  <div className="mt-0.5 shrink-0">
                                    <span
                                      className={`p-1 rounded inline-block ${isSelected ? "bg-emerald-500 text-slate-950" : "bg-slate-800"}`}
                                    >
                                      <ServiceIcon name={opt.icon} size={11} />
                                    </span>
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="text-[10px] font-bold uppercase truncate leading-tight">
                                      {opt.name}
                                    </div>
                                    <span className="text-[7.5px] text-slate-500 block leading-tight mt-0.5 truncate">
                                      {opt.description}
                                    </span>
                                  </div>
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>

                      {/* Dynamic settings panel depending on choice */}
                      {(selectedServices.some((s) =>
                        s.toLowerCase().includes("charging"),
                      ) ||
                        selectedServices.some((s) =>
                          s.toLowerCase().includes("printing"),
                        ) ||
                        selectedServices.some(
                          (s) =>
                            s.toUpperCase().includes("BIWAG") ||
                            s.toUpperCase().includes("BIUAG") ||
                            s.toUpperCase().includes("MALANA"),
                        )) && (
                        <div className="space-y-2 border-t border-slate-800/85 pt-3 animate-in fade-in duration-200">
                          {selectedServices.some((s) =>
                            s.toLowerCase().includes("charging"),
                          ) && (
                            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 px-3 py-2.5 rounded-lg space-y-1">
                              <div className="flex justify-between items-center text-[9.5px] font-mono font-black uppercase tracking-wider">
                                <span>🔌 CHARGING STATION INTERVAL</span>
                                <span className="text-[8.5px] bg-amber-400 text-slate-950 px-1 py-0.5 rounded font-sans font-black">
                                  30 MINS ONLY
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-300 leading-relaxed font-sans font-medium">
                                Device stays logged on high-efficiency ports.
                                Stay limit strictly restricted to{" "}
                                <strong>30 minutes</strong> max.
                              </p>
                            </div>
                          )}

                          {selectedServices.some(
                            (s) =>
                              s.toUpperCase().includes("BIWAG") ||
                              s.toUpperCase().includes("MALANA"),
                          ) && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 px-3 py-2.5 rounded-lg space-y-1">
                              <div className="flex justify-between items-center text-[9.5px] font-mono font-black uppercase tracking-wider">
                                <span>🏠 DISCUSSION ROOM SESSION</span>
                                <span className="text-[8.5px] bg-indigo-550 text-white px-1 py-0.5 rounded font-sans font-black">
                                  1 HOUR ONLY
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-300 leading-relaxed font-sans font-medium">
                                Restricted to active interactive group studies
                                of 1-4 users. Max stay period strictly set to{" "}
                                <strong>1 Hour Limit</strong> per booking.
                              </p>
                            </div>
                          )}

                          {selectedServices.some((s) =>
                            s.toLowerCase().includes("printing"),
                          ) && (
                            <div className="bg-rose-500/15 border border-rose-500/25 text-rose-200 px-3 py-2.5 rounded-lg space-y-1.5">
                              <div className="flex justify-between items-center text-[9.5px] font-mono font-black uppercase tracking-wider">
                                <span>🖨️ PRINTING SECTOR REGULATIONS</span>
                                <span className="text-[8.5px] bg-rose-550 text-white px-1 py-0.5 rounded font-sans font-black font-extrabold">
                                  MAX 10 PAGES
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9.5px] text-slate-300 font-bold">
                                  Estimated Pages to Print:
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  placeholder="Pages"
                                  value={pagesToPrint}
                                  onChange={(e) => {
                                    let val = parseInt(e.target.value) || 1;
                                    const todayUsage = getTodayUsage(
                                      scannedUser?.rfid || "",
                                    );
                                    const remaining = Math.max(
                                      0,
                                      10 - todayUsage.totalPagesPrinted,
                                    );
                                    if (val > remaining) {
                                      alert(
                                        `🚨 Quota Limit: You can print at most ${remaining} pages within this 15-hour reset window (already printed: ${todayUsage.totalPagesPrinted} pages).`,
                                      );
                                      val = remaining;
                                    }
                                    if (val < 1) {
                                      val = 1;
                                    }
                                    setPagesToPrint(val);
                                  }}
                                  className="w-16 px-1.5 py-0.5 text-center text-xs bg-slate-950 border border-slate-800 rounded font-bold font-mono text-rose-300 focus:outline-none"
                                />

                                <span className="text-[8px] text-slate-500 italic mt-0.5">
                                  (CPLRC Catalog Limit)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      </>
                      )}

                      {/* Control check-in buttons */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleCheckIn()}
                          disabled={selectedServices.length === 0}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 py-2 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                        >
                          CONFIRM SERVICE ACCESS &amp; TAP IN
                        </button>
                        <button
                          onClick={resetScanner}
                          className="w-full bg-slate-850 hover:bg-slate-800 text-slate-400 py-1 text-[9px] rounded font-mono font-bold uppercase transition-all"
                        >
                          ✕ CANCEL ACCESS
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 3. STATE: ACTION SUCCESS/ERROR MESSAGE REACTION SHIELD */}
              {scannerState === "SUCCESS_MESSAGE" && successInfo && (
                <motion.div
                  key="success-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-4"
                >
                  <div className="inline-flex p-2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3 animate-bounce">
                    <CheckCircle size={28} />
                  </div>
                  <h3 className="text-sm font-black text-emerald-400 tracking-wider font-mono uppercase">
                    {successInfo.title}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-2 max-w-sm mx-auto leading-relaxed">
                    {successInfo.subtitle}
                  </p>

                  <div className="mt-5 pt-3 border-t border-slate-800/60">
                    <button
                      onClick={resetScanner}
                      className="text-[9px] font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded uppercase font-bold transition-colors"
                    >
                      RESET SYSTEM MANUALLY
                    </button>
                    <span className="text-[8px] font-mono text-slate-500 block mt-2 animate-pulse uppercase">
                      SEC_ID TERMINAL RE-ARMING IN PROGRESS...
                    </span>
                  </div>
                </motion.div>
              )}

              {scannerState === "ERROR_MESSAGE" && (
                <motion.div
                  key="error-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-4"
                >
                  <div className="inline-flex p-2 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20 mb-3">
                    <XCircle size={28} />
                  </div>
                  <h3 className="text-sm font-black text-rose-400 tracking-wider font-mono uppercase">
                    {onlyQrMode ? "QR PASS REJECTED" : "RFID REJECTED"}
                  </h3>
                  <p className="text-[10px] text-rose-300 mt-2 font-mono bg-slate-950 p-2 rounded border border-rose-950/20 max-w-sm mx-auto break-words select-all">
                    {errorMessage}
                  </p>

                  <div className="mt-5 space-y-2 pt-3 border-t border-slate-800">
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        onClick={() => {
                          const rfidField =
                            errorMessage.match(/\[(\d+)\]/)?.[1] || "";
                          resetScanner();
                          onRegisterClick(rfidField);
                        }}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-mono font-black px-3 py-1.5 rounded uppercase transition-colors shadow-lg cursor-pointer"
                      >
                        {onlyQrMode ? "🆕 NEW CLIENT: DIRECT TO ADMIN TABLE" : "REGISTER ACCESS KEY"}
                      </button>
                      <button
                        onClick={resetScanner}
                        className="bg-slate-800 hover:bg-slate-750 text-slate-400 text-[10px] font-mono font-bold px-3 py-1.5 rounded uppercase transition-colors cursor-pointer"
                      >
                        CLOSE REPORT
                      </button>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 block pt-1 uppercase">
                      Please refer unregistered barcode keys to library staff
                      officers
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ========================================================= */}
          {/* HARDWARE OVERLAY CONTROLLERS: MULTI-MODE CONSOLE (RFID + QR) */}
          {/* ========================================================= */}
          {onlyQrMode && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl select-none xl:order-1">
            
            {/* Console Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className={`text-[10px] font-mono font-black uppercase tracking-widest flex items-center gap-1.5 ${onlyQrMode ? "text-cyan-400" : "text-amber-500"}`}>
                <Activity size={12} className={`${onlyQrMode ? "text-cyan-400" : "text-amber-400"} animate-pulse`} />{" "}
                {onlyQrMode ? "DIGITAL QR CODE DECODER" : "INTEGRATED SCANNER CONTROLLER"}
              </span>
              <span className="text-[8px] font-mono text-slate-500 uppercase">
                {onlyQrMode ? "SYS_QR_TERM" : "SYS_GATE_TERM"}
              </span>
            </div>

            {/* Mode Switch Tab buttons */}
            <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-850 gap-1 text-[10px] font-mono leading-none font-bold mb-3.5">
              {(!onlyQrMode && initialTerminalLocation !== "INTERNET AREA") && (
                <button
                  type="button"
                  onClick={() => {
                    stopWebcam();
                    setScanMethod("RFID");
                  }}
                  className={`flex-1 py-1.5 rounded uppercase tracking-wider transition-all cursor-pointer ${
                    scanMethod === "RFID"
                      ? "bg-amber-500 text-slate-950 font-black shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  📟 RFID Swiper
                </button>
              )}
              {(onlyQrMode || initialTerminalLocation === "INTERNET AREA") && (
                <button
                  type="button"
                  onClick={() => {
                    setScanMethod("WEBCAM");
                  }}
                  className={`flex-1 py-1.5 rounded uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    scanMethod === "WEBCAM"
                      ? "bg-cyan-500 text-slate-950 font-black shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Camera size={10} /> Live QR Cam
                </button>
              )}
              {!onlyQrMode && initialTerminalLocation === "INTERNET AREA" && (
                <button
                  type="button"
                  onClick={() => {
                    stopWebcam();
                    setScanMethod("RFID");
                  }}
                  className={`flex-1 py-1.5 rounded uppercase tracking-wider transition-all cursor-pointer ${
                    scanMethod === "RFID"
                      ? "bg-amber-500 text-slate-950 font-black shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  📟 RFID Swiper
                </button>
              )}
            </div>

            {/* TAB CONTAINER: RFID SWIPER */}
            {scanMethod === "RFID" && !onlyQrMode && (
              <div className="space-y-3">
                <input
                  ref={hardwareInputRef}
                  type="text"
                  inputMode="none"
                  autoComplete="off"
                  aria-label="Physical RFID reader input"
                  className="sr-only"
                  tabIndex={-1}
                />
                <p className="text-[9.5px] text-slate-400 leading-normal">
                  💡 Simulate physical card wave actions by tapping any registered test user database key below or manually inputting credit card RFID code strings.
                </p>

                {/* Database quick swipe selectors */}
                <div>
                  <span className="text-[8px] font-mono font-bold text-slate-500 uppercase block mb-1.5">
                    Registered test members database keys:
                  </span>
                  <div className="grid grid-cols-1 gap-1 max-h-[140px] overflow-y-auto pr-1">
                    {users.map((u) => {
                      const isStayActive = logs.some(
                        (l) => l.rfid === u.rfid && l.status === "ACTIVE",
                      );
                      const activeLog = logs.find(
                        (l) => l.rfid === u.rfid && l.status === "ACTIVE",
                      );
                      const hasCharging = activeLog?.services?.some((s) =>
                        s.toLowerCase().includes("charging"),
                      );
                      let chargingTimeStr = "";
                      if (activeLog && hasCharging) {
                        const elapsed = Math.floor(
                          (Date.now() -
                            new Date(activeLog.checkInTime).getTime()) /
                            60000,
                        );
                        chargingTimeStr = ` (${Math.max(0, 30 - elapsed)}m left)`;
                      }
                      return (
                        <button
                          key={u.id}
                          onClick={() => handleScan(u.rfid)}
                          className="w-full flex items-center justify-between p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-900 hover:border-amber-400/50 rounded transition-all text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold shrink-0 ${
                                isStayActive
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {u.givenName[0]}
                              {u.lastName[0]}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-[10px] font-bold text-slate-300 group-hover:text-amber-400 duration-200 block truncate uppercase leading-none">
                                {u.givenName} {u.lastName}
                              </span>
                              <span className="text-[8.5px] font-mono text-slate-500 mt-0.5 block truncate leading-none">
                                RFID:{" "}
                                <strong className="text-slate-400">
                                  {u.rfid}
                                </strong>{" "}
                                <span className="text-slate-600">|</span>{" "}
                                {u.patronType}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-[8px] px-1 py-0.5 rounded font-mono font-bold shrink-0 uppercase ${
                              isStayActive
                                ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                                : "bg-slate-900 text-slate-600 border border-slate-800"
                            }`}
                          >
                            {isStayActive ? `Live Stay${chargingTimeStr}` : "Out"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Manual numeric swiper trigger */}
                <div className="border-t border-slate-800/80 pt-2.5">
                  <span className="text-[8px] font-mono font-bold text-slate-500 uppercase block mb-1">
                    Manual Access Code simulation:
                  </span>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Hash
                        className="absolute left-1.5 top-1.5 text-slate-500"
                        size={11}
                      />
                      <input
                        type="text"
                        placeholder="10-digit decimal RFID code"
                        className="pl-5 pr-1 py-1 w-full text-[10px] border border-slate-800 bg-slate-950 rounded text-amber-400 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                        value={rfidInput}
                        onChange={(e) =>
                          setRfidInput(e.target.value.replace(/\D/g, ""))
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleScan(rfidInput)
                        }
                      />
                    </div>
                    <button
                      onClick={() => handleScan(rfidInput)}
                      className="px-2.5 bg-sky-500 hover:bg-sky-600 text-slate-950 text-[9px] font-black rounded uppercase tracking-wider transition-all cursor-pointer"
                    >
                      SWIPE CARD
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTAINER: WEBCAM LIVE QR SCANNING */}
            {scanMethod === "WEBCAM" && (
              <div className="space-y-3">
                <p className="text-[9.5px] text-slate-400 leading-normal">
                  📷 Hold up your library card QR Code or phone pass directly in front of your camera to scan & record attendance logbook streams automatically.
                </p>

                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-850 flex flex-col items-center justify-center text-center">
                  {webcamError ? (
                    <div className="p-4 text-rose-400 text-xs font-mono max-w-sm">
                      ⚠ {webcamError}
                    </div>
                  ) : (
                    <>
                      {/* Live camera stream display */}
                      <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover"
                        playsInline
                        muted
                      />
                      
                      {/* Overlapping neon reticle frame */}
                      <div className="absolute inset-x-12 top-6 bottom-6 border-2 border-dashed border-cyan-400/50 rounded-xl flex items-center justify-center pointer-events-none">
                        {/* Shimmer laser scanner beam bouncing up/down */}
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute shadow-md shadow-cyan-400/40 animate-pulse" />
                      </div>

                      {webcamScanning && (
                        <div className="absolute top-2 right-2 bg-slate-900/95 border border-slate-750 text-cyan-400 text-[8px] font-mono px-2 py-0.5 rounded flex items-center gap-1 select-none">
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                          CAMERA_FEED_LIVE
                        </div>
                      )}
                      {cameraNotice && (
                        <div className="absolute bottom-2 left-2 right-2 rounded bg-slate-950/85 px-2 py-1 text-center text-[8px] font-mono text-amber-300">
                          {cameraNotice}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (webcamScanning) {
                        stopWebcam();
                      } else {
                        startWebcam();
                      }
                    }}
                    className={`w-full py-1.5 rounded text-[10px] font-mono uppercase font-black transition-all cursor-pointer ${
                      webcamScanning
                        ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
                        : "bg-cyan-500 hover:bg-cyan-600 text-slate-950"
                    }`}
                  >
                    {webcamScanning ? "✕ Deactivate Camera" : "▶ Start Webcam Stream"}
                  </button>
                  {cameraDevices.length > 1 && (
                    <button
                      type="button"
                      onClick={switchCamera}
                      disabled={!webcamScanning}
                      className="shrink-0 rounded bg-slate-700 px-3 py-1.5 text-[10px] font-mono font-black uppercase text-white transition-all hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RefreshCw size={12} className="mr-1 inline-block" />
                      Switch Camera
                    </button>
                  )}
                </div>
              </div>
            )}

            {scanMethod === "WEBCAM" && onlyQrMode && (
              <button
                type="button"
                onClick={() => setShowQrRegistrationModal(true)}
                className="mt-4 w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/15 cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> Register New Guest
              </button>
            )}

            {/* TAB CONTAINER: FILE UPLOAD DECODER */}
            {scanMethod === "UPLOAD" && (
              <div className="space-y-3">
                <p className="text-[9.5px] text-slate-400 leading-normal font-sans">
                  📤 Drag or browse any screenshot PNG or JPG image containing your library account QR Code to decode it inside the sandboxed reader.
                </p>

                <div className="border border-dashed border-slate-800 bg-slate-950/80 rounded-xl p-6 text-center hover:border-sky-500/50 hover:bg-slate-950 transition-all relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload size={24} className="text-slate-500 mx-auto mb-2 animate-bounce" />
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                    Browse QR Card Image
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                    Click here to select your saved membership pass file.
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTAINER: DYNAMIC DROP-DOWN DUAL DESKTOP PREVIEW SIMULATION */}
            {scanMethod === "SIM_DROP" && (
              <div className="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                <p className="text-[9.5px] text-slate-400 leading-normal">
                  💡 Choose a registered member's identity profile below to generate their dynamic QR Code. Click the scan button to instant-simulate a scanner tap. Excellent for quick testing or webcam-less terminals!
                </p>

                <div>
                  <label className="text-[8px] font-mono font-bold text-slate-500 block mb-1 uppercase">
                    Select Test Subject:
                  </label>
                  <select
                    value={simSelectedUser}
                    onChange={(e) => setSimSelectedUser(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded px-2.5 py-1.5 text-[10px] font-bold"
                  >
                    {allAvailableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.givenName} {u.lastName} ({u.rfid})
                      </option>
                    ))}
                  </select>
                </div>

                {simQrUrl && (
                  <div className="flex items-center gap-4 bg-slate-900 p-2.5 rounded-lg border border-slate-850">
                    <div className="p-1.5 bg-white rounded-lg shrink-0">
                      <img src={simQrUrl} alt="Simulated member scan QR" className="w-20 h-20" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="text-[10px] font-mono">
                        <span className="text-slate-500 block">{onlyQrMode ? "QR PASS DECODE:" : "CARD ID HEX:"}</span>
                        <span className="text-amber-400 font-extrabold pb-1 border-b border-slate-800 block">
                          {allAvailableUsers.find((u) => u.id === simSelectedUser)?.rfid}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const matched = allAvailableUsers.find((u) => u.id === simSelectedUser);
                          if (matched) {
                            playScanBeep();
                            handleScan(matched.rfid);
                          }
                        }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[9.5px] font-mono font-black uppercase rounded tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 w-full"
                      >
                        ⚡ Scan This Member QR
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          playScanBeep();
                          handleScan("REGISTRATION_QR");
                        }}
                        className="px-3 py-1.5 bg-cyan-700/80 hover:bg-cyan-700 text-white text-[9px] font-mono font-bold uppercase rounded tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 w-full border border-cyan-500/20"
                        title="Simulate scanning the QR Code for registration"
                      >
                        📷 Scan Registration QR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
          )}
        </div>
      </div>

      {/* QR Registration Modal */}
      {showQrRegistrationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4 z-50 overflow-hidden">
          <div className="bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[100dvh] sm:max-h-[90vh] overflow-hidden my-0 sm:my-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-800 flex flex-col">
            <div className="bg-cyan-600/20 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-3 text-white border-b border-cyan-500/20 shrink-0">
              <h1 className="text-base sm:text-xl leading-tight font-extrabold tracking-tight select-none text-cyan-300">
                Guest QR Pass Registration
              </h1>
              <button onClick={() => setShowQrRegistrationModal(false)} className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X size={20} className="stroke-[2.5]" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <QRRegistration onAddQrClient={onAddQrClient} onBackToScanner={() => setShowQrRegistrationModal(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
