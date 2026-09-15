/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export const PLRCLogo = ({ className = "", size = 120 }) => {
  return (
    <img
      src="img/logopng.png"
      alt="CPLRC Logo"
      className={`object-contain drop-shadow-md select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export const CagayanProvinceSeal = ({ className = "", size = 120 }) => {
  return (
    <img
      src="img/pgc.png"
      alt="Cagayan Province Seal"
      className={`object-contain drop-shadow-md select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export const PLRCHeader = () => {
  return (
    <div className="flex items-center gap-4 bg-blue-950 text-white p-4 rounded-xl shadow-lg border border-blue-900">
      <PLRCLogo size={72} />
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-sans text-amber-400">
          CPLRC Digital Logbook
        </h1>
        <p className="text-xs sm:text-sm text-blue-200 uppercase tracking-widest font-mono">
          Provincial Learning and Resource Center • Cagayan
        </p>
      </div>
    </div>
  );
};
