/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import {
  Monitor,
  ShieldCheck,
  BookOpen,
  Lock,
  Mail,
  Inbox,
  X,
  QrCode,
} from "lucide-react";
import { INITIAL_USERS, INITIAL_LOGS } from "./data/mockData";
import { PLRCLogo } from "./components/Logo";
import { RFIDScannerSim } from "./components/RFIDScannerSim";
import { AdminDashboard } from "./components/AdminDashboard";
import { ClientDashboard } from "./components/ClientDashboard";
// import { StaffLogin } from "./components/StaffLogin"; // Import new StaffLogin component
import { ClientLogin } from "./components/ClientLogin";
import { QRRegistration } from "./components/QRRegistration";
import { api } from "./services/api";

const LEGACY_LOCAL_ADMIN_RFIDS = new Set(["superadmin", "0000004513", "admin"]);
const LEGACY_LOCAL_ADMIN_IDS = new Set(["SuperAdmin", "Admin-Staff"]);

const withoutLegacyLocalAdminSeeds = (userList) => userList.filter(
  user => !LEGACY_LOCAL_ADMIN_RFIDS.has(user.rfid) && !LEGACY_LOCAL_ADMIN_IDS.has(user.id)
);

export default function App() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [qrClients, setQrClients] = useState([]);
  // Views supporting SPA hash routers: KIOSK, ADMIN, ADMIN_LOGIN, STANDALONE, CLIENT, CLIENT_LOGIN, QR_REGISTRATION
  const [currentView, setCurrentView] = useState("KIOSK");
  const [adminRole, setAdminRole] = useState(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [prefilledRfid, setPrefilledRfid] = useState("");
  const [manualRfid, setManualRfid] = useState("");
  const [manualRfidScan, setManualRfidScan] = useState(null);

  // Unified Session state
  const [loggedInClient, setLoggedInClient] = useState(null);

  // Simulated Email Inbox states
  const [simulatedEmails, setSimulatedEmails] = useState([]);
  const [isMailboxOpen, setIsMailboxOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showEmailToast, setShowEmailToast] = useState({
    show: false,
    name: "",
    email: "",
  });

  // Local storage synchronization
  useEffect(() => {
    const storedUsers = localStorage.getItem("plrc_users");
    const storedLogs = localStorage.getItem("plrc_logs");
    const storedEmails = localStorage.getItem("plrc_simulated_emails");
    const storedQrClients = localStorage.getItem("plrc_qr_clients");

    // 1. Load or initialize QR Clients (specifically registered via QR form, separate from RFID members)
    const INITIAL_QR_CLIENTS = [
      {
        id: "qr-client-seeded-1",
        rfid: "QR-11853915",
        lastName: "Dannug",
        givenName: "Jerome",
        middleName: "Mariano",
        address: "Caritan Sur, Tuguegarao City, Cagayan",
        institution: "Cagayan State University",
        createdAt: "2026-05-23T11:00:00Z"
      },
      {
        id: "qr-client-seeded-2",
        rfid: "QR-50149247",
        lastName: "Singson",
        givenName: "Christian",
        middleName: "Cabral",
        address: "Carig Sur, Tuguegarao City, Cagayan",
        institution: "University of Cagayan Valley",
        createdAt: "2026-05-23T12:15:00Z"
      },
      {
        id: "qr-client-seeded-3",
        rfid: "QR-80271542",
        lastName: "Batang",
        givenName: "Mary Grace",
        middleName: "Velasco",
        address: "Centro, Baggao, Cagayan",
        institution: "Cagayan State University",
        createdAt: "2026-05-23T12:45:00Z"
      }
    ];

    let finalQrClients = INITIAL_QR_CLIENTS;
    if (storedQrClients) {
      try {
        finalQrClients = JSON.parse(storedQrClients);
      } catch (e) {
        finalQrClients = INITIAL_QR_CLIENTS;
      }
    }
    setQrClients(finalQrClients);
    localStorage.setItem("plrc_qr_clients", JSON.stringify(finalQrClients));

    // 2. Load or initialize users
    let finalUsers = INITIAL_USERS;
    if (storedUsers) {
      try {
        finalUsers = JSON.parse(storedUsers);
      } catch (e) {
        finalUsers = INITIAL_USERS;
      }
    }

    finalUsers = withoutLegacyLocalAdminSeeds(finalUsers);

    setUsers(finalUsers);
    localStorage.setItem("plrc_users", JSON.stringify(finalUsers));

    // 2. Load or initialize logs
    if (storedLogs) {
      try {
        setLogs(JSON.parse(storedLogs));
      } catch (e) {
        setLogs(INITIAL_LOGS);
      }
    } else {
      setLogs(INITIAL_LOGS);
      localStorage.setItem("plrc_logs", JSON.stringify(INITIAL_LOGS));
    }

    // 3. Load or initialize simulated email inbox
    let emailList = [];
    if (storedEmails) {
      try {
        emailList = JSON.parse(storedEmails);
      } catch (e) {}
    }

    emailList = emailList.filter((email) => email.username !== "1185391500");
    setSimulatedEmails(emailList);
    localStorage.setItem("plrc_simulated_emails", JSON.stringify(emailList));
  }, []);

  // Prefer server data, with the original local data retained as an offline fallback.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.users.list(), api.logs.list(), api.qrClients.list()])
      .then(([serverUsers, serverLogs, serverQrClients]) => {
        if (!cancelled) {
          setUsers(serverUsers);
          setLogs(serverLogs);
          setQrClients(serverQrClients);
        }
      })
      .catch((error) => console.warn("Backend unavailable; using local data.", error));
    return () => { cancelled = true; };
  }, []);

  // Sync to separate routes via URL Hash!
  useEffect(() => {
    const parseHashRoute = () => {
      const hash = window.location.hash;
      if (
        hash === "#/standalone" ||
        hash === "#/scanner-standalone" ||
        hash === "#/kiosk-standalone"
      ) {
        setCurrentView("STANDALONE");
        } else if (hash === "#/admin/login" || hash === "#/staff/login") {
          setCurrentView("ADMIN_LOGIN");
      } else if (
        hash === "#/qr" ||
        hash === "#/qrcode" ||
        hash === "#/qr-code" ||
        hash === "#/scanner-qr"
      ) {
        setCurrentView("QR_SCANNER");
      } else if (hash === "#/cplrc-sub-qr") {
        setCurrentView("CPLRC_SUB_QR");
      } else if (
        hash === "#/admin" ||
        hash === "#/staff" ||
        hash === "#/staff-desk"
      ) {
        // Check sessionStorage first to avoid flicker or empty role state
        const storedRole = sessionStorage.getItem("plrc_admin_role") || adminRole;
        
        if (storedRole) {
          setAdminRole(storedRole);
        } else if (!adminRole) {
          window.location.hash = "#/admin/login";
          return;
        }
        setCurrentView("ADMIN");
      } else if (hash === "#/client/login" || hash === "#/patron/login") {
        setCurrentView("CLIENT_LOGIN");
      } else if (hash === "#/client" || hash === "#/patron") {
        // Safe check: if no logged-in user, redirect to login
        if (sessionStorage.getItem("plrc_current_user")) {
          try {
            const user = JSON.parse(
              sessionStorage.getItem("plrc_current_user") || "null",
            );
            if (user) {
              handleLoginSuccess(user);
              return;
            }
          } catch (_) { /* ignore */ }
        }
        setCurrentView("CLIENT_LOGIN");
      } else if (hash === "#/login") {
        setCurrentView("CLIENT_LOGIN");
      } else if (hash === "#/qr-register" || hash === "#/registration") {
        setCurrentView("QR_REGISTRATION");
      } else {
        setCurrentView("KIOSK");
      }
    };

    // Load instantly
    parseHashRoute();

    // Listen to browser URL changes
    window.addEventListener("hashchange", parseHashRoute);
    return () => window.removeEventListener("hashchange", parseHashRoute);
  }, []);

  const changeRoute = (targetView) => {
    setCurrentView(targetView);
    if (targetView === "STANDALONE") {
      window.location.hash = "#/standalone";
    } else if (targetView === "QR_SCANNER") {
      window.location.hash = "#/qr-code";
    } else if (targetView === "CPLRC_SUB_QR") {
      window.location.hash = "#/cplrc-sub-qr";
    } else if (targetView === "ADMIN") {
      window.location.hash = "#/admin";
    } else if (targetView === "ADMIN_LOGIN") {
      window.location.hash = "#/admin/login";
    } else if (targetView === "CLIENT") {
      window.location.hash = "#/client";
    } else if (targetView === "CLIENT_LOGIN" || targetView === "LOGIN") {
      window.location.hash = "#/client/login";
    } else {
      window.location.hash = "#/scanner";
    }
  };

  // Actions
  const saveUsers = (updatedUsers) => {
    setUsers(updatedUsers);
    localStorage.setItem("plrc_users", JSON.stringify(updatedUsers));
  };

  const saveLogs = (updatedLogs) => {
    setLogs(updatedLogs);
    localStorage.setItem("plrc_logs", JSON.stringify(updatedLogs));
  };

  const saveQrClients = (updatedList) => {
    setQrClients(updatedList);
    localStorage.setItem("plrc_qr_clients", JSON.stringify(updatedList));
  };

  const handleAddQrClient = async (newClient) => {
    try {
      const saved = await api.qrClients.create(newClient);
      setQrClients((current) => [saved, ...current]);
    } catch (error) {
      alert(`Unable to save QR registration: ${error.message}`);
      throw error;
    }
  };

  const handleDeleteQrClient = async (clientId) => {
    try {
      await api.qrClients.remove(clientId);
      setQrClients((current) => current.filter((c) => c.id !== clientId));
    } catch (error) { alert(`Unable to delete QR registration: ${error.message}`); }
  };

  // Save the user through the API; the backend handles the real registration email.
  const handleAddUser = async (newUser) => {
    let savedUser;
    try { savedUser = await api.users.create(newUser); }
    catch (error) { alert(`Unable to create member: ${error.message}`); return null; }
    const updated = [savedUser, ...users];
    saveUsers(updated);
    return savedUser;
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.users.remove(userId);
      setUsers((current) => current.filter((u) => u.id !== userId));
    } catch (error) { alert(`Unable to delete member: ${error.message}`); }
  };

  const handleUpdateUser = async (updatedUser) => {
    try {
      const saved = await api.users.update(updatedUser);
      setUsers((current) => current.map((u) => u.id === saved.id ? saved : u));
    } catch (error) { alert(`Unable to update member: ${error.message}`); }
  };

  const handleAddLog = async (newLog) => {
    try {
      const saved = await api.logs.create(newLog);
      setLogs((currentLogs) => {
      const updated = [saved, ...currentLogs];
      localStorage.setItem("plrc_logs", JSON.stringify(updated));
      return updated;
    });
    } catch (error) { alert(`Unable to save visit log: ${error.message}`); }
  };

  const handleUpdateLog = async (updatedLog) => {
    try {
      const saved = await api.logs.update(updatedLog);
      setLogs((currentLogs) => {
      const updated = currentLogs.map((l) =>
        l.id === saved.id ? saved : l,
      );
      localStorage.setItem("plrc_logs", JSON.stringify(updated));
      return updated;
    });
    } catch (error) { alert(`Unable to update visit log: ${error.message}`); }
  };

  const handleClearLogs = async () => {
    try { await api.logs.clear(); saveLogs([]); }
    catch (error) { alert(`Unable to clear visit logs: ${error.message}`); }
  };

  const handleCheckOutUser = async (logId) => {
    try {
      const saved = await api.logs.checkout(logId);
      setLogs((current) => current.map((log) => log.id === saved.id ? saved : log));
    } catch (error) { alert(`Unable to check out member: ${error.message}`); }
  };

  // Unified Login Success Handler
  const handleLoginSuccess = (user) => {
    setLoggedInClient(user);
    sessionStorage.setItem("plrc_current_user", JSON.stringify(user));
    
    if (user.role === "superadmin" || user.role === "admin") {
      setAdminRole(user.role);
      sessionStorage.setItem("plrc_admin_role", user.role);
      sessionStorage.setItem("plrc_admin_is_logged", "true");
      changeRoute("ADMIN");
    } else {
      setAdminRole(null);
      changeRoute("CLIENT");
    }
  };

  const handleLogout = () => {
    setLoggedInClient(null);
    setAdminRole(null);
    sessionStorage.removeItem("plrc_current_user");
    sessionStorage.removeItem("plrc_admin_role");
    sessionStorage.removeItem("plrc_admin_is_logged");
    changeRoute("CLIENT_LOGIN");
  };

  // Trigger quick login from the simulated email
  const handleEmailActionLogin = (emailObj) => {
    // Find matching user profile
    const targetUser = users.find((u) => u.rfid === emailObj.username);
    if (targetUser) {
      handleLoginSuccess(targetUser);
      setIsMailboxOpen(false);
      setSelectedEmail(null);
    } else {
      alert(
        `User profile [${emailObj.username}] has been removed from provincial server registry.`,
      );
    }
  };

  // Determine if we should render navigation chrome headers
  const isStandaloneMode =
    currentView === "STANDALONE" || currentView === "QR_SCANNER" || currentView === "CPLRC_SUB_QR" || currentView === "ADMIN_LOGIN" || currentView === "CLIENT_LOGIN";
  const isQrRegistrationMode = currentView === "QR_REGISTRATION";

  return (
    <div className="bg-slate-950 min-h-screen relative flex flex-col font-sans antialiased text-slate-100 selection:bg-amber-500 selection:text-slate-950 text-left">
      {/* 1. Floating Inbound Email Toast Alert */}
      {showEmailToast.show && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 border-2 border-blue-500 p-4 rounded-xl shadow-2xl animate-bounce flex items-start gap-3">
          <Mail
            className="text-blue-400 shrink-0 mt-0.5 animate-pulse"
            size={20}
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-blue-400 uppercase tracking-wider">
              Simulated Email Sent!
            </h4>
            <p className="text-[11px] text-slate-200 mt-1">
              Welcome credentials sent to <strong>{showEmailToast.name}</strong>{" "}
              ({showEmailToast.email}).
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Click the **Simulated Mailbox** upper corner badge to open the
              inbox copy!
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setIsMailboxOpen(true);
                  setShowEmailToast((prev) => ({ ...prev, show: false }));
                }}
                className="text-[9.5px] font-bold px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded uppercase"
              >
                Inspect Inbox
              </button>
              <button
                onClick={() =>
                  setShowEmailToast((prev) => ({ ...prev, show: false }))
                }
                className="text-[9.5px] font-bold px-2 py-1 text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Simulated Mailbox Side panel Modal Drawer */}
      {isMailboxOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#E5E7EB] text-slate-900 flex flex-col h-full shadow-2xl relative border-l border-slate-700">
            {/* Mailbox Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center shrink-0 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Inbox size={18} className="text-blue-400" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">
                    CPLRC Mail Server Outbox Simulation
                  </h3>
                  <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                    Capturing verification emails triggered by patron
                    registrations
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMailboxOpen(false);
                  setSelectedEmail(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mailbox Split Window pane */}
            <div className="flex-1 flex min-h-0">
              {/* Mail list panel (Sidebar) */}
              <div className="w-1/3 border-r border-gray-300 bg-gray-100 flex flex-col overflow-y-auto">
                <div className="p-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white border-b border-gray-200">
                  Inbox Outbox ({simulatedEmails.length})
                </div>
                {simulatedEmails.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 italic">
                    No simulated emails captured.
                  </div>
                ) : (
                  simulatedEmails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`w-full p-4 border-b border-gray-200 text-left transition-all hover:bg-white flex flex-col gap-1 ${
                        selectedEmail?.id === email.id
                          ? "bg-white border-l-4 border-blue-600"
                          : "bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black tracking-tight truncate max-w-[100px] text-blue-900">
                          {email.recipientName}
                        </span>
                        <span className="text-[8.5px] font-mono text-gray-400 shrink-0">
                          {email.timestamp}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-mono font-medium text-gray-500 truncate"
                        title={email.recipientEmail}
                      >
                        {email.recipientEmail}
                      </span>
                      <span className="text-[10.5px] text-slate-800 font-bold truncate mt-1">
                        🔑 Your account has been created
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Mail Render viewer (Right) */}
              <div className="w-2/3 bg-slate-100 flex flex-col p-6 overflow-y-auto justify-start">
                {selectedEmail ? (
                  <div className="space-y-4">
                    {/* Simulated email Client chrome frame */}
                    <div className="text-[10px] bg-white border border-gray-200 p-2.5 rounded-lg space-y-1 font-mono text-slate-500 text-left shadow-xs">
                      <div>
                        <strong>From:</strong> alerts@cplrc.cagayan.gov.ph
                        (Provincial Library Support)
                      </div>
                      <div>
                        <strong>To:</strong> {selectedEmail.recipientName} &lt;
                        {selectedEmail.recipientEmail}&gt;
                      </div>
                      <div>
                        <strong>Subject:</strong> CPLRC - Your Account Has Been
                        Created!
                      </div>
                    </div>

                    {/* INTERACTIVE FIDELITY COPY OF THE EMAIL SHOWN IN PICTURE 1 */}
                    <div className="flex justify-center">
                      <div className="w-[380px] bg-white border border-gray-300 rounded-xl shadow-md overflow-hidden flex flex-col p-5 select-none font-sans text-slate-900 text-center animate-in fade-in duration-200">
                        {/* 1. Header logo center */}
                        <div className="flex justify-center mb-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-white flex items-center justify-center p-1 border border-slate-150">
                            <PLRCLogo size={40} />
                          </div>
                        </div>

                        {/* 2. Blueprint CPLRC title */}
                        <h2 className="text-[#3B82F6] font-[#38BDF8] font-black text-[13px] tracking-wider uppercase leading-none">
                          CPLRC - Digital Log Book
                        </h2>

                        {/* 3. Account created subhead */}
                        <p className="text-slate-650 font-sans font-medium text-[10px] mt-2 mb-4">
                          Your account has been created
                        </p>

                        {/* Divider */}
                        <div className="h-px bg-slate-100 mb-4" />

                        {/* 4. Greeting in exact visual layout block */}
                        <div className="text-left text-[11px] text-slate-700 space-y-2 mb-6 px-1">
                          <p>Hello,</p>
                          <p>Here are your login details:</p>

                          <div className="mt-4 flex flex-col gap-1.5 font-sans">
                            <div>
                              <span className="font-extrabold text-[#111827]">
                                Username:
                              </span>{" "}
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs font-black text-blue-900 select-all">
                                {selectedEmail.username}
                              </span>
                            </div>
                            <div>
                              <span className="font-extrabold text-[#111827]">
                                Password:
                              </span>{" "}
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs font-black text-emerald-900 select-all">
                                {selectedEmail.password}
                              </span>
                            </div>
                            {selectedEmail.loginLink && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <span className="font-extrabold text-[#111827] block mb-1">
                                  Login Portal Link:
                                </span>{" "}
                                <span className="text-[10px] text-blue-600 underline font-mono break-all select-all">
                                  {selectedEmail.loginLink}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 5. Blue CTA Button */}
                        <div className="mb-4">
                          <button
                            onClick={() =>
                              handleEmailActionLogin(selectedEmail)
                            }
                            className="bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs uppercase px-8 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md block w-full text-center cursor-pointer"
                          >
                            Login Now
                          </button>
                        </div>

                        {/* 6. Legal disclaimer italic footer */}
                        <p className="text-[9px] text-slate-400 italic leading-relaxed mt-2">
                          If you did not request this, please ignore this email.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-2">
                    <Mail size={32} className="text-gray-300 animate-pulse" />
                    <p className="text-xs font-bold uppercase tracking-wider">
                      No Email Opened
                    </p>
                    <p className="text-[10.5px] max-w-xs text-slate-500">
                      Select any verification outbox item on the left to review
                      the credentials and simulate 1-click user log-in.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upper Navigation Portal Header bar - HIDDEN IN STANDALONE MODE FOR PURE HARDWARE FEEL */}
      {currentView !== "CLIENT" && !isQrRegistrationMode && (isStandaloneMode ? (
        <header className="bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-40 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-5 py-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Main Title branding - Elegant, Compact Typography */}
            <div className="flex items-center gap-2.5">
              <PLRCLogo size={34} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded tracking-wide leading-none">
                    CPLRC-SYS
                  </span>
                  <h1 className="text-sm font-extrabold tracking-tight font-sans text-slate-50">
                    Cagayan Provincial Learning and Resource Center

                  </h1>
                </div>
                <p className="text-[9px] text-slate-400 font-mono tracking-wider uppercase mt-0.5">
                  CPLRC • Digital Logbook Station
                </p>
              </div>
            </div>

            {/* Mode Switcher portal - Segmented Toggle bar with SPA Hash syncing */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1 select-none shrink-0 items-center">
              {(currentView !== "CLIENT" && currentView !== "CLIENT_LOGIN" && currentView !== "ADMIN_LOGIN") && (
                <>
                  <button
                    onClick={() => changeRoute("KIOSK")}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentView === "KIOSK"
                        ? "bg-sky-500 text-slate-950 shadow-sm"
                        : "text-slate-350 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <Monitor size={12} /> SCANNER
                  </button>

                  <button
                    onClick={() => changeRoute("QR_SCANNER")}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentView === "QR_SCANNER"
                        ? "bg-cyan-500 text-slate-950 shadow-sm font-black"
                        : "text-slate-350 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <QrCode size={12} /> QR KIOSK
                  </button>

                  <button
                    onClick={() => changeRoute("CPLRC_SUB_QR")}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentView === "CPLRC_SUB_QR"
                        ? "bg-violet-500 text-white shadow-sm"
                        : "text-slate-350 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <QrCode size={12} /> CPLRC SUB QR
                  </button>

                  <button
                    onClick={() => changeRoute(loggedInClient?.role === "admin" || loggedInClient?.role === "superadmin" ? "ADMIN" : "ADMIN_LOGIN")}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentView === "ADMIN"
                        ? "bg-amber-400 text-slate-900 shadow-sm"
                        : "text-slate-350 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <ShieldCheck size={12} /> STAFF DESK
                  </button>
                </>
              )}

              <button
                onClick={() => changeRoute(loggedInClient?.role === "client" ? "CLIENT" : "CLIENT_LOGIN")}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === "CLIENT" || currentView === "CLIENT_LOGIN"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-slate-350 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <BookOpen size={12} /> CLIENT PORTAL
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* DISCREET TOP STRIP FOR STANDALONE MODE TO EASILY HEAD BACK */
        <div className="bg-slate-950 py-1.5 px-4 scroll-smooth border-b border-slate-900 flex justify-between items-center text-[10px] font-mono text-slate-500 tracking-wider">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full animate-ping ${currentView === "QR_SCANNER" || currentView === "CPLRC_SUB_QR" ? "bg-cyan-400" : "bg-sky-500"}`} />
            <span className="text-slate-300 font-bold uppercase text-[9px] sm:text-[10px]">
              {currentView === "QR_SCANNER" || currentView === "CPLRC_SUB_QR"
                ? "DEDICATED PORTABLE QR DISPATCH CHECK-IN ROUTE"
                : " Cagayan Provincial Learning and Resource Center"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {currentView === "QR_SCANNER" || currentView === "CPLRC_SUB_QR" ? (
              <button
                onClick={() => changeRoute("STANDALONE")}
                className="text-[9px] bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 px-2.5 py-0.5 rounded font-bold uppercase transition-all"
              >
                📟 SWITCH TO STATIC RFID SWIPER
              </button>
            ) : (
              <button
                onClick={() => changeRoute("QR_SCANNER")}
                className="text-[9px] bg-cyan-500/10 text-cyan-400 hover:bg-cyan-400/20 px-2.2 py-0.5 rounded font-bold uppercase transition-all flex items-center gap-1"
              >
                <QrCode size={10} /> SWITCH TO LIVE QR CAM
              </button>
            )}
            <button
              onClick={() => changeRoute("KIOSK")}
              className="text-[9px] bg-slate-800 hover:bg-slate-750 px-2 py-0.5 rounded font-bold uppercase transition-all text-slate-300"
            >
              ← SPLIT VIEW
            </button>
            <button
              onClick={() => changeRoute("ADMIN_LOGIN")}
              className="text-[9px] bg-amber-400/10 text-amber-400 hover:bg-amber-500/20 px-2 py-0.5 rounded font-bold uppercase transition-all flex items-center gap-1"
            >
              <Lock size={10} /> STAFF LOGIN
            </button>
          </div>
        </div>
      ))}

      {/* Main Screen Router layout container */}
      <main className="flex-1 w-full relative">
        {currentView === "KIOSK" || currentView === "STANDALONE" || currentView === "QR_SCANNER" || currentView === "CPLRC_SUB_QR" ? (
          <div
            className={isStandaloneMode || isQrRegistrationMode ? "py-0 bg-slate-950" : "py-5"}
          >
            {/* Header info guidance */}
            {!isStandaloneMode && (
              <div className="max-w-4xl mx-auto mb-5 px-4 text-center select-none">
                
                <h2 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-tight mt-1 uppercase">
                  TAP YOUR PHYSICAL RFID CARD TO START LOGGING
                </h2>
                <div className="h-[2px] w-12 bg-[#38BDF8] mx-auto mt-2 rounded-full" />
              
              </div>
            )}

            {/* Simulated RFID scanner kiosk */}
            <RFIDScannerSim
              users={users}
              logs={logs}
              qrClients={qrClients}
              onAddLog={handleAddLog}
              onAddQrClient={handleAddQrClient}
              onQrClientsRefresh={saveQrClients}
              onUpdateLog={handleUpdateLog}
              onRegisterClick={() => setShowNewUserModal(true)} // This will now open the admin's add user modal
              initialScanMethod={currentView === "QR_SCANNER" || currentView === "CPLRC_SUB_QR" ? "WEBCAM" : "RFID"}
              initialTerminalLocation={currentView === "CPLRC_SUB_QR" ? "CPLRC SUB" : "1F WALK-IN RECEPTION"}
              onlyQrMode={currentView === "QR_SCANNER" || currentView === "CPLRC_SUB_QR"}
              manualRfidScan={manualRfidScan}
              manualRfid={manualRfid}
              onManualRfidChange={setManualRfid}
              onManualRfidSubmit={() => {
                const code = manualRfid.trim();
                if (!code) return;
                setManualRfidScan({ code, id: Date.now() });
              }}
            />
          </div>
        ) : currentView === "ADMIN" ? (
          <div className="animate-in fade-in duration-200">
            <AdminDashboard
              adminRole={adminRole}
              users={users}
              logs={logs}
              qrClients={qrClients}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              onUpdateUser={handleUpdateUser}
              onDeleteQrClient={handleDeleteQrClient}
              onClearLogs={handleClearLogs}
              onCheckOutUser={handleCheckOutUser}
              onLogout={handleLogout}
              onAddQrClient={handleAddQrClient}
              showNewUserModal={showNewUserModal}
              setShowNewUserModal={setShowNewUserModal}
              prefilledRfid={prefilledRfid}
            />
          </div>
        ) : currentView === "CLIENT" && loggedInClient ? (
          <div className="animate-in fade-in duration-200">
            <ClientDashboard
              users={users}
              loggedInClient={loggedInClient}
              onLogout={handleLogout}
            />
          </div>
        ) : currentView === "QR_REGISTRATION" ? (
          <div className="animate-in fade-in duration-200">
            <QRRegistration
              onAddQrClient={handleAddQrClient}
              onBackToScanner={() => changeRoute("QR_SCANNER")}
            />
          </div>
        ) : currentView === "ADMIN_LOGIN" ? (
          <div className="animate-in fade-in duration-200">
            <ClientLogin
              users={users}
              portal="admin"
              onLoginSuccess={handleLoginSuccess}
              onSwitchPortal={() => changeRoute("CLIENT_LOGIN")}
            />
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <ClientLogin
              users={users}
              portal="client"
              onLoginSuccess={handleLoginSuccess}
              onSwitchPortal={() => changeRoute("ADMIN_LOGIN")}
            />
          </div>
        )}
      </main>

      {/* Footer bar - Rich Monospace Diagnostics - HIDDEN IN STANDALONE MODE */}
      {!isStandaloneMode && !isQrRegistrationMode && currentView !== "CLIENT" && (
        <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-3 text-[10px] font-mono shrink-0 select-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-5 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>SYSTEM STATE: ACTIVE PERSISTENCE</span>
              <span className="text-slate-850">|</span>
              <span>INDEX: CPLRC_CAPITOL_V2.5</span>
            </div>

            <div className="text-slate-500 text-center sm:text-left text-[9.5px]">
              CAGAYAN PROVINCIAL CAPITOL COMPOUND, ALIMANNAO, TUGUEGARAO CITY
            </div>

            <div className="flex items-center gap-3 text-slate-500">
              <span className="hidden sm:inline">
                PING:{" "}
                <strong className="text-emerald-400 font-mono">1.1ms</strong>
              </span>
              <span className="text-slate-800 hidden sm:inline">|</span>
              <span>
                ACC_KEY:{" "}
                <strong className="text-slate-400 font-mono">
                  RFID_TAPE_READY
                </strong>
              </span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
