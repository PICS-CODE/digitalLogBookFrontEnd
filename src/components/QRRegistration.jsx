/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PLRCLogo } from "./Logo";
import { api } from "../services/api";
import {
  User,
  BadgeCheck,
  MapPin,
  Building,
  QrCode,
  Sparkles,
  Download,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export const QRRegistration = ({ onAddQrClient, onBackToScanner }) => {
  const fallbackPatronTypes = ["Student", "Researcher", "Professional / Teacher", "LGU Official", "General Public"];
  const [givenName, setGivenName] = useState(""); // This component is now used within AdminDashboard, so onBackToScanner will close the modal.
  const [patronIdentification, setPatronIdentification] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [address, setAddress] = useState("");
  const [institution, setInstitution] = useState("");
  const [patronTypes, setPatronTypes] = useState([]);

  const [errorMsg, setErrorMsg] = useState("");
  const [successClient, setSuccessClient] = useState(null);
  const [successQrCodeUrl, setSuccessQrCodeUrl] = useState("");

  useEffect(() => {
    const savedPatronTypes = localStorage.getItem("plrc_patron_types");
    if (savedPatronTypes) {
      try {
        setPatronTypes(JSON.parse(savedPatronTypes));
      } catch (_) {
        setPatronTypes(fallbackPatronTypes);
      }
    } else {
      setPatronTypes(fallbackPatronTypes);
    }

    api.settings
      .get()
      .then((settings) => {
        const nextPatronTypes = settings.patronTypes?.length ? settings.patronTypes : fallbackPatronTypes;
        setPatronTypes(nextPatronTypes);
        localStorage.setItem("plrc_patron_types", JSON.stringify(nextPatronTypes));
      })
      .catch((error) => console.warn("Unable to load patron identification settings.", error));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanGiven = givenName.trim();
    const cleanLast = lastName.trim();
    const cleanPatronIdentification = patronIdentification.trim();
    const cleanMiddle = middleName.trim();
    const cleanAddr = address.trim();
    const cleanInst = institution.trim();

    if (!cleanGiven || !cleanLast) {
      setErrorMsg("Please provide your First Name and Last Name.");
      return;
    }

    if (!cleanPatronIdentification) {
      setErrorMsg("Please provide your Patron Identification.");
      return;
    }

    if (!cleanAddr) {
      setErrorMsg("Please provide your Address.");
      return;
    }

    if (!cleanInst) {
      setErrorMsg("Please provide your School, Block, or Institution Name.");
      return;
    }

    // Generate a unique QR ID token
    const uniqueQrId = "QR-" + Math.floor(10000000 + Math.random() * 90000000);

    const newQrClient = {
      id: `qr-client-${Date.now()}`,
      rfid: uniqueQrId, // RFID field is used as the unique scanned identifier
      patronIdentification: cleanPatronIdentification,
      patronType: cleanPatronIdentification,
      givenName: cleanGiven,
      lastName: cleanLast,
      middleName: cleanMiddle,
      address: cleanAddr,
      institution: cleanInst,
      createdAt: new Date().toISOString(),
    };

    try {
      // Generate QR data url
      const qrDataUrl = await QRCode.toDataURL(uniqueQrId, {
        width: 320,
        margin: 2,
        color: {
          dark: "#0F172A", // Slate-900 theme
          light: "#FFFFFF",
        },
      });

      if (typeof onAddQrClient === "function") {
        await onAddQrClient(newQrClient);
      }
      setSuccessQrCodeUrl(qrDataUrl);
      setSuccessClient(newQrClient);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Unable to save the QR registration.");
    }
  };

  const handleDownloadQR = () => {
    if (!successQrCodeUrl || !successClient) return;
    const link = document.createElement("a");
    link.href = successQrCodeUrl;
    link.download = `CPLRC_QR_PASS_${successClient.lastName}_${successClient.givenName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 select-none relative w-full max-w-3xl mx-auto min-w-0 rounded-xl overflow-hidden border border-slate-800">
      {!successClient ? (
        <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-3">
              <PLRCLogo size={52} className="sm:w-16 sm:h-16" />
              <div className="text-center sm:text-left min-w-0">
                <h1 className="text-sm sm:text-base leading-tight font-black text-white uppercase tracking-wide">
                  Cagayan Provincial Learning and Resource Center
                </h1>
                <h2 className="text-xs sm:text-sm leading-tight font-black text-cyan-400 uppercase tracking-wide flex items-center justify-center sm:justify-start gap-2 mt-1">
                  <QrCode className="text-cyan-400 animate-pulse shrink-0" size={16} />
                  CPLRC Guest QR Code Registration
                </h2>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed px-1">
              Fill in these 5 simple credentials below to generate your unique personal library entry QR Code badge instantly.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-lg flex items-center gap-2 font-semibold">
              <ShieldAlert size={14} className="text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 min-w-0">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">First Name <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" required placeholder="e.g. First Name" value={givenName} onChange={(e) => setGivenName(e.target.value)} className="w-full min-w-0 bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Middle Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" placeholder="e.g. Middle Name" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="w-full min-w-0 bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Last Name <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" required placeholder="e.g. Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full min-w-0 bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Patron Identification <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <BadgeCheck className="absolute left-3 top-3 text-slate-500" size={14} />
                  <select required value={patronIdentification} onChange={(e) => setPatronIdentification(e.target.value)} className="w-full min-w-0 appearance-none bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all">
                    <option value="">-- Choose Patron Identification --</option>
                    {patronTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Permanent Address <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" required placeholder="e.g. Permanent Address" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full min-w-0 bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">School / Institution <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" required placeholder="e.g. School / Professional" value={institution} onChange={(e) => setInstitution(e.target.value)} className="w-full min-w-0 bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <button type="submit" className="md:col-span-2 w-full py-3 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-slate-950 font-black text-xs rounded-xl tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/15 cursor-pointer flex items-center justify-center gap-2">
                <Sparkles size={16} /> Generate QR Pass
              </button>
          </div>

          <div className="text-[9.5px] font-mono text-center text-slate-500 pt-4 border-t border-slate-800">
            💡 Registering creates a local profile catalogued in the Walk-In QR database, separated from physical RFID cardholder ledgers.
          </div>
        </form>
      ) : (
        <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1 animate-in zoom-in duration-300">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-lg sm:text-xl leading-tight font-black text-white uppercase tracking-tight">
              QR PASS GENERATED SUCCESSFULLY!
            </h2>
            <p className="text-[11px] text-slate-400">
              Your credentials have been checked and authorized in the database. Use this QR Pass at the digital scanner stations.
            </p>
          </div>

          <div className="bg-white text-slate-950 p-3 sm:p-4 rounded-2xl w-full max-w-[320px] mx-auto shadow-2xl border border-slate-200 relative select-text text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ID Background Image */}
            <img 
              src="/images/id-card.png" 
              className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-2xl"
            />
            <div className="relative z-10">
              <div className="absolute top-1/1 left-1/2 transform -translate-x-1/2 -translate-y-1/2right-3 font-mono text-[7px] text-slate-400 tracking-wider">
                MEMBER PASS • STATE DIGITAL GATE
              </div>
              <div className="flex gap-2 sm:gap-4 items-center mb-4 min-w-0">
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

              <div className="bg-slate-50 border border-slate-105 p-3 rounded-lg flex justify-center mb-4 shadow-inner">
                <img src={successQrCodeUrl} alt="QR Code" className="w-32 h-32 sm:w-36 sm:h-36" />
              </div>

              <div className="space-y-1.5 font-sans border-t border-slate-200/50 pt-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">Full name</span>
                  <span className="text-[10px] font-black text-slate-900 uppercase truncate min-w-0">
                    <span className="text-blue-600">▶</span> {[successClient.givenName, successClient.middleName, successClient.lastName]
                                                              .filter(Boolean)
                                                              .join(" ")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">Patron Type</span>
                  <span className="text-[9px] font-black text-emerald-700 uppercase truncate min-w-0">
                    <span className="text-blue-600">▶</span> {successClient.patronIdentification || successClient.patronType || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">ADDRESS:</span>
                  <span className="text-[9px] font-bold text-slate-800 italic truncate min-w-0">
                    <span className="text-blue-600">▶</span> {successClient.address}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">INSTITUTION:</span>
                  <span className="text-[9px] font-bold text-slate-800 italic truncate min-w-0">
                    <span className="text-blue-600">▶</span> {successClient.institution}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">QR CODE:</span>
                  <span className="text-[10px] font-mono font-black text-cyan-700">
                    <span className="text-blue-600">▶</span> {successClient.rfid}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto pt-4">
            <button type="button" onClick={handleDownloadQR} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-mono font-black text-[10.5px] uppercase tracking-wider rounded-lg shadow-md flex items-center justify-center gap-1.5">
              <Download size={14} /> Download Pass Image
            </button>
            <button type="button" onClick={() => {
                setSuccessClient(null);
                setSuccessQrCodeUrl("");
                setGivenName("");
                setLastName("");
              }} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono font-bold text-[10.5px] uppercase rounded-lg flex items-center justify-center gap-1">
              Go to Terminal reader <ArrowRight size={13} className="text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
