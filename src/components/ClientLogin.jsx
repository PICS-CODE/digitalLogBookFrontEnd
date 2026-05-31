/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { PLRCLogo } from "./Logo";
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
} from "lucide-react";

export const ClientLogin = ({
  users,
  onLoginSuccess,
  onAddUser,
  prefilledUsername = "",
  prefilledPassword = "",
}) => {
  
  // Login State
  const [username, setUsername] = useState(prefilledUsername);
  const [password, setPassword] = useState(prefilledPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Synchronize prefilled values
  useEffect(() => {
    if (prefilledUsername) setUsername(prefilledUsername);
    if (prefilledPassword) setPassword(prefilledPassword);
  }, [prefilledUsername, prefilledPassword]);

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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Background visual graphics */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-600 via-sky-400 via-amber-400 via-white to-red-600 z-10" />
      <div className="absolute -top-30 -left-30 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl" />
      <div className="absolute -bottom-30 -right-30 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-20 transition-all duration-300">
        
        {/* Brand Header */}
        <div className="bg-slate-950 px-6 py-5 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center p-1.5 border border-slate-700 shadow-sm shrink-0">
              <PLRCLogo size={40} />
            </div>
            <div className="text-left">
              <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 font-extrabold px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest">
                Unified Access Portal
              </span>
              <h1 className="text-sm font-black text-slate-100 uppercase tracking-wide leading-none mt-1">
                Cagayan Provincial Library
              </h1>
            </div>
          </div>

          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 gap-1 text-[10px] font-mono leading-none font-bold">
            <button
              type="button"
              className="px-3 py-1.5 rounded uppercase tracking-wider transition-all cursor-pointer bg-blue-600 text-white font-black"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* VIEW 1: SIGN IN FORM                     */}
        {/* ========================================== */}
            <div className="text-center mb-6 max-w-md mx-auto">
              <h2 className="text-lg font-black text-white tracking-tight uppercase flex items-center justify-center gap-2">
                Sign In To Workspace
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Enter your RFID code or staff username to access your dedicated dashboard.
              </p>
            </div>

            {loginError && (
              <div className="mb-5 bg-rose-500/10 border-l-4 border-rose-500 p-3.5 rounded-r-xl text-left text-xs font-bold font-mono text-rose-300 leading-relaxed">
                ⚠ {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-md mx-auto text-left">
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-400 block pl-1 mb-1.5 uppercase tracking-wider">
                  Username or RFID Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <UserIcon size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. 1185391500"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-700 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center pl-1 mb-1.5">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Portal Account Password
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <Lock size={14} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-700 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all font-mono shadow-md hover:shadow-blue-500/10 cursor-pointer block text-center"
              >
                Sign In to Workspace
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800/85 pt-4">
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg text-left text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                <span className="text-amber-400 font-extrabold flex items-center gap-1 uppercase tracking-wider text-[10px] mb-1">
                  💡 Test Accounts:
                </span>
                <div className="font-mono text-[9px] bg-slate-900 border border-slate-800 p-2 rounded mt-2 text-slate-300 space-y-1">
                  <div className="flex justify-between"><span>SuperAdmin:</span> <span>superadmin (or 0000004513)</span></div>
                  <div className="flex justify-between"><span>Staff Admin:</span> <span>admin</span></div>
                  <div className="flex justify-between"><span>Client:</span> <span>1185391500</span></div>
                </div>
              </div>
            </div>

        {/* Legal footer rights */}
        <div className="bg-slate-950 px-6 py-4 text-center border-t border-slate-800 text-[10px] font-mono text-slate-500 tracking-wider">
          © 2026 PROVINCE OF CAGAYAN • LIBRARY MANAGEMENT INFORMATION SYSTEMS STATION
        </div>

      </div>
    </div>
  );
};
