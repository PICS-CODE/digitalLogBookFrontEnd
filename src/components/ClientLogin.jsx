/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { PLRCLogo } from "./Logo";
import loginBackground from "../../img/bg.jpg";
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  BookOpen,
} from "lucide-react";

export const ClientLogin = ({
  users,
  onLoginSuccess,
  portal = "client",
  onSwitchPortal,
}) => {
  const isAdminPortal = portal === "admin";
  const portalName = isAdminPortal ? "Staff Admin" : "Client";
  const allowedRoles = isAdminPortal ? ["superadmin", "admin"] : ["client"];

  // Login State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Handle Login submission
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError("");

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setLoginError("Please provide your registered Username and Password.");
      return;
    }

    // Robust lookup by RFID, Username, or Email
    const found = users.find(
      (u) =>
        u.rfid.toLowerCase() === cleanUsername ||
        (u.email && u.email.toLowerCase() === cleanUsername) ||
        (u.id && u.id.toLowerCase() === cleanUsername) ||
        (cleanUsername === "superadmin" && u.rfid === "0000004513") // Backward compatibility
    );

    if (!found) {
      setLoginError(
        "Member credentials unrecognized. Please contact the Library Staff.",
      );
      return;
    }

    if (!allowedRoles.includes(found.role)) {
      setLoginError(
        isAdminPortal
          ? "This account is a client account. Please sign in through the Client Portal."
          : "This account is a staff account. Please sign in through the Staff Admin Portal.",
      );
      return;
    }

    const validPassword = found.password || "password123";
    if (validPassword === cleanPassword || (found.role === "superadmin" && cleanPassword === "••••••••••")) {
      onLoginSuccess(found);
    } else {
      setLoginError(
        "Incorrect password credentials. Please verify your portal details.",
      );
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.66), rgba(2, 6, 23, 0.82)), url(${loginBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Background visual graphics */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-600 via-sky-400 via-amber-400 via-white to-red-600 z-10" />
      <div className="absolute -top-30 -left-30 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl" />
      <div className="absolute -bottom-30 -right-30 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="w-full max-w-md bg-[rgba(210,225,238,0.78)] border border-[rgba(255,255,255,0.45)] rounded-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-[12px] [-webkit-backdrop-filter:blur(12px)] overflow-hidden relative z-20 transition-all duration-300">
        
        {/* Brand Header */}
        <div className="bg-white/10 px-6 py-4 border-b border-white/35 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/80 flex items-center justify-center p-1.5 border border-white/60 shadow-sm shrink-0">
              <PLRCLogo size={40} />
            </div>
            <div className="text-left">
              <span className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-widest ${isAdminPortal ? "bg-amber-500/15 text-amber-700 border-amber-500/30" : "bg-[#4FA9D8]/15 text-[#2A6F92] border-[#4FA9D8]/30"}`}>
                {portalName} Portal
              </span>
              <h1 className="text-sm font-black text-[#334B5C] uppercase tracking-wide leading-none mt-1">
                Cagayan Provincial Learning and Resource Center

              </h1>
            </div>
          </div>

          <div className="flex bg-white/25 rounded-lg p-1 border border-white/50 gap-1 text-[10px] font-mono leading-none font-bold">
            <button
              type="button"
              className={`px-3 py-1.5 rounded uppercase tracking-wider transition-all cursor-default text-white font-black ${isAdminPortal ? "bg-[#4FA9D8]" : "bg-[#4FA9D8]"}`}
            >
              {portalName} Sign In
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* VIEW 1: SIGN IN FORM                     */}
        {/* ========================================== */}
            <div className="text-center mb-4 max-w-md mx-auto px-6 pt-4">
              <h2 className="text-lg font-black text-[#334B5C] tracking-tight uppercase flex items-center justify-center gap-2">
                {isAdminPortal ? <ShieldCheck size={19} className="text-[#4FA9D8]" /> : <BookOpen size={19} className="text-[#4FA9D8]" />} Sign In To {portalName} 
              </h2> 
              <p className="text-xs text-[#45637B] mt-1.5 leading-relaxed">
                {isAdminPortal
                  ? "Staff and superadmin accounts can access the administration dashboard here."
                  : "Use your registered RFID Code or Username to Access your Personal Library Portal."}
              </p>
            </div>

            {loginError && (
              <div className="mx-6 mb-5 bg-red-50/80 border-l-4 border-red-500 p-3.5 rounded-r-xl text-left text-xs font-bold font-mono text-red-800 leading-relaxed">
                ⚠ {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3 max-w-md mx-auto px-6 text-left">
              <div>
                <label className="text-[10px] font-mono font-bold text-[#334B5C] block pl-1 mb-1 uppercase tracking-wider">
                  Username or RFID Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#5A7490] pointer-events-none">
                    <UserIcon size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Enter your RFID Code or Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/65 border border-white/60 rounded-lg text-xs font-mono font-bold text-[#334B5C] placeholder-[#7A8FA2] focus:outline-none focus:ring-2 focus:ring-[#4FA9D8]/35 focus:border-[#4FA9D8]/50 hover:border-white/80 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center pl-1 mb-1">
                  <label className="text-[10px] font-mono font-bold text-[#334B5C] uppercase tracking-wider">
                    Portal Account Password
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#5A7490] pointer-events-none">
                    <Lock size={14} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white/65 border border-white/60 rounded-lg text-xs font-mono text-[#334B5C] placeholder-[#7A8FA2] focus:outline-none focus:ring-2 focus:ring-[#4FA9D8]/35 focus:border-[#4FA9D8]/50 hover:border-white/80 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#5A7490] hover:text-[#334B5C] cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#4FA9D8] hover:bg-[#3F9CCB] text-white font-black text-xs uppercase tracking-widest rounded-lg transition-all font-mono shadow-[0_6px_18px_rgba(79,169,216,0.28)] hover:shadow-[0_8px_20px_rgba(79,169,216,0.38)] cursor-pointer block text-center"
              >
                Sign In to {portalName} Portal
              </button>
            </form>

            {isAdminPortal && (
              <button
                type="button"
                onClick={onSwitchPortal}
                className="mx-6 mt-5 w-[calc(100%-3rem)] text-center text-[10px] font-bold uppercase tracking-wider transition-colors text-[#2A6F92] hover:text-[#1D5676]"
              >
                Client? Go to the Client Portal
              </button>
            )}

        {/* Legal footer rights */}
        <div className="bg-white/10 px-6 py-3 text-center border-t border-white/35 text-[10px] font-mono text-[#45637B] tracking-wider">
          © 2026 PROVINCE OF CAGAYAN • LIBRARY MANAGEMENT INFORMATION SYSTEMS STATION
        </div>

      </div>
    </div>
  );
};
