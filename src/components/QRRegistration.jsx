/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import QRCode from "qrcode";
import { PLRCLogo } from "./Logo";
import {
  User,
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
  const [givenName, setGivenName] = useState(""); // This component is now used within AdminDashboard, so onBackToScanner will close the modal.
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [address, setAddress] = useState("");
  const [institution, setInstitution] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successClient, setSuccessClient] = useState(null);
  const [successQrCodeUrl, setSuccessQrCodeUrl] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanGiven = givenName.trim();
    const cleanLast = lastName.trim();
    const cleanMiddle = middleName.trim();
    const cleanAddr = address.trim();
    const cleanInst = institution.trim();

    if (!cleanGiven || !cleanLast) {
      setErrorMsg("Please provide your First Name and Last Name.");
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

      setSuccessQrCodeUrl(qrDataUrl);
      setSuccessClient(newQrClient);
      onAddQrClient(newQrClient);
    } catch (err) {
      console.error(err);
      setErrorMsg("Temporary system error creating your security QR badge descriptor.");
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
    <div className="bg-slate-900 select-none relative w-full">
      {!successClient ? (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-base font-black text-cyan-400 uppercase tracking-wide flex items-center justify-center gap-2">
              <QrCode className="text-cyan-400 animate-pulse" size={18} />
              CPLRC Guest QR Code Registration
            </h2>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Fill in these 5 simple credentials below to generate your unique personal library entry QR Code badge instantly.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-lg flex items-center gap-2 font-semibold">
              <ShieldAlert size={14} className="text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">First Name <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" required placeholder="e.g. Jerome" value={givenName} onChange={(e) => setGivenName(e.target.value)} className="w-full bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Middle Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" placeholder="e.g. Mariano" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="w-full bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">School / Institution <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" required placeholder="e.g. CSU / Professional" value={institution} onChange={(e) => setInstitution(e.target.value)} className="w-full bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Last Name <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" required placeholder="e.g. Dannug" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Provincial Address <span className="text-cyan-400">*</span></label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input type="text" required placeholder="e.g. Tuguegarao City" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 px-9 py-2.5 rounded-xl focus:outline-none transition-all" />
                </div>
              </div>
              <div className="pt-5">
                <button type="submit" className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-slate-950 font-black text-xs rounded-xl tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/15 cursor-pointer flex items-center justify-center gap-2">
                  <Sparkles size={16} /> Generate QR Pass
                </button>
              </div>
            </div>
          </div>

          <div className="text-[9.5px] font-mono text-center text-slate-500 pt-4 border-t border-slate-800">
            💡 Registering creates a local profile catalogued in the Walk-In QR database, separated from physical RFID cardholder ledgers.
          </div>
          <div className="text-center mt-2">
            <button type="button" onClick={onBackToScanner} className="text-slate-500 hover:text-slate-300 text-[10px] font-mono font-bold uppercase transition-colors">
              ← Back to Scanner
            </button>
          </div>
        </form>
      ) : (
        <div className="p-8 space-y-6 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1 animate-in zoom-in duration-300">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              QR PASS GENERATED SUCCESSFULLY!
            </h2>
            <p className="text-[11px] text-slate-400">
              Your credentials have been checked and authorized in the database. Use this QR Pass at the digital scanner stations.
            </p>
          </div>

          <div className="bg-white text-slate-950 p-4 rounded-2xl max-w-xs mx-auto shadow-2xl border border-slate-200 relative select-text text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ID Background Image */}
            <img 
              src="img/id.png" 
              className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-2xl"
            />
            <div className="relative z-10">
              <div className="absolute top-1/1 left-1/2 transform -translate-x-1/2 -translate-y-1/2right-3 font-mono text-[7px] text-slate-400 tracking-wider">
                MEMBER PASS • STATE DIGITAL GATE
              </div>
              <div className="flex gap-4 items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-300">
                  <PLRCLogo size={32} />
                </div>
                <div>
                  <h3 className="text-[10px] font-black tracking-tight leading-none uppercase text-slate-900">
                     Provincial of Cagayan
                  </h3>
                  <p className="text-[7.5px] font-mono font-bold text-slate-500 tracking-wide mt-1 uppercase">
                    Cagayan Provincial Learning and Resource Center
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-105 p-3 rounded-lg flex justify-center mb-4 shadow-inner">
                <img src={successQrCodeUrl} alt="QR Code" className="w-36 h-36" />
              </div>

              <div className="space-y-1.5 font-sans border-t border-slate-200/50 pt-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">Full name</span>
                  <span className="text-[10px] font-black text-slate-900 uppercase truncate">
                    <span className="text-blue-600">▶</span> {[successClient.givenName, successClient.middleName, successClient.lastName]
                                                              .filter(Boolean)
                                                              .join(" ")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">ADDRESS:</span>
                  <span className="text-[9px] font-bold text-slate-800 italic truncate">
                    <span className="text-blue-600">▶</span> {successClient.address}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-slate-500 w-20 shrink-0 uppercase">INSTITUTION:</span>
                  <span className="text-[9px] font-bold text-slate-800 italic truncate">
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
